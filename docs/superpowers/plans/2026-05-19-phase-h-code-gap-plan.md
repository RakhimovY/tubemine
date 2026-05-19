# Phase H Code-Gap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the code gap between Phase H design promises and production code. Ship 4 deliverables: tier-aware sentiment label on Dashboard/history cards, JSON + Excel server-gated export, Pro "Last 100" display cap, i18n parity.

**Architecture:** Add `/api/export` POST endpoint (Pro-gated via Supabase auth + `getUserQuota`), build xlsx via `exceljs` server-only, post client-extracted payload back to server for formatting (no quota burn). Extract `qualitativeSummary` + `deriveDistribution` to shared lib so server components + client components share one source. Rename `csv-gate.tsx` → `export-bar.tsx` and grow it from 1 to 3 buttons for Pro tier. Bump `ANALYSES_LIST_MAX` 50→100 for paginated history.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod, Supabase, Polar, exceljs (new), next-intl, vitest, Vercel Fluid Compute.

**Spec source:** [`docs/superpowers/specs/2026-05-19-phase-h-code-gap-design.md`](../specs/2026-05-19-phase-h-code-gap-design.md)

**Commit strategy:** ONE atomic commit at the end (Task 16). Intermediate verification only.

---

## File map

**New files (3):**
- `src/lib/auth.ts`: lifted `authUserId` helper
- `src/lib/sentiment-summary.ts`: pure `qualitativeSummary` + `deriveDistribution`
- `src/app/api/export/route.ts`: POST endpoint
- `src/app/api/export/__tests__/route.test.ts`: 401/403/400/200 tests

**Renamed (1):**
- `src/components/csv-gate.tsx` → `src/components/export-bar.tsx`

**Modified (9):**
- `src/lib/analyses.ts`
- `src/components/sentiment.tsx`
- `src/components/recent-analyses.tsx`
- `src/components/tubemine.tsx`
- `src/app/[locale]/dashboard/page.tsx`
- `src/app/[locale]/history/page.tsx`
- `src/app/[locale]/history/history-client.tsx`
- `src/app/api/extract/route.ts`
- `messages/en.json`, `messages/ru.json`
- `package.json` + lockfile

**Untouched** (do not change): `src/lib/quota.ts`, `src/lib/sentiment.ts`, `src/app/api/analyses/route.ts`, Polar webhook routes, RLS, Supabase schema.

---

## Task 1: Add `exceljs` dependency

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1.1: Install exceljs**

Run: `pnpm add exceljs`
Expected: dependency added to `dependencies` in `package.json`, lockfile updated. Exit 0.

- [ ] **Step 1.2: Verify install**

Run: `node -e "console.log(require('exceljs').version || 'present')"`
Expected: prints a version string (e.g. `4.4.0`) or `present`, exit 0.

---

## Task 2: Create `src/lib/auth.ts` (lift `authUserId`)

**Files:**
- Create: `src/lib/auth.ts`
- Modify: `src/app/api/extract/route.ts` (delete inline copy, add import)

- [ ] **Step 2.1: Create lib file with the lifted helper**

Create `src/lib/auth.ts` with the following content (note the leading `import "server-only"` to fail loudly if a client component imports it):

```ts
import "server-only"
import { createClient } from "@/lib/supabase/server"

export async function authUserId(): Promise<{
  userId: string | null
  userEmail: string | null
}> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { userId: null, userEmail: null }
  }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return { userId: user?.id ?? null, userEmail: user?.email ?? null }
  } catch {
    return { userId: null, userEmail: null }
  }
}
```

- [ ] **Step 2.2: Remove inline copy from `extract/route.ts` and add import**

In `src/app/api/extract/route.ts`:
- After the existing `import { ytClient } from "@/lib/youtube"` line, add: `import { authUserId } from "@/lib/auth"`
- Delete the inline `async function authUserId()` definition (lines 84-103 in the current file).

- [ ] **Step 2.3: Verify TypeScript still compiles**

Run: `npx tsc --noEmit`
Expected: no errors related to `authUserId` (other unrelated errors are OK at this stage; we will run a full check later).

---

## Task 3: Create `src/lib/sentiment-summary.ts` (pure util)

**Files:**
- Create: `src/lib/sentiment-summary.ts`

- [ ] **Step 3.1: Create the shared lib**

Create `src/lib/sentiment-summary.ts`:

```ts
export type SentimentDistribution = {
  positive: number
  neutral: number
  negative: number
}

/**
 * Convert an aggregate (positive/neutral/negative counts) into a normalized
 * 0-1 distribution. Returns null when total === 0 (caller hides the label).
 *
 * Accepts any object with the three count fields, including the full
 * SentimentAggregate from @/lib/sentiment (structural typing).
 */
export function deriveDistribution(
  agg: { positive: number; neutral: number; negative: number } | null,
): SentimentDistribution | null {
  if (!agg) return null
  const total = agg.positive + agg.neutral + agg.negative
  if (total === 0) return null
  return {
    positive: agg.positive / total,
    neutral: agg.neutral / total,
    negative: agg.negative / total,
  }
}

/**
 * Coarse qualitative label for a distribution. English-only by design;
 * shown on Free-tier surfaces where the exact percent is paywalled.
 */
export function qualitativeSummary(dist: SentimentDistribution): string {
  const { positive: pos, negative: neg, neutral: neu } = dist
  if (neu >= 0.99) return "Mixed"
  if (pos >= 0.3 && neg >= 0.3) return "Polarized audience"
  if (pos >= 0.6) return "Mostly positive"
  if (neg >= 0.6) return "Mostly negative"
  if (pos > neg) return "Leans positive"
  if (neg > pos) return "Leans negative"
  return "Mostly neutral"
}

/**
 * Exact "{pct}% {dominant}" label for Pro tier. Picks the argmax over
 * positive/neutral/negative with tie-break order positive > neutral >
 * negative (per spec locked decision). pct is Math.round'd.
 */
export function proSentimentLabel(dist: SentimentDistribution): string {
  const entries = [
    ["positive", dist.positive],
    ["neutral", dist.neutral],
    ["negative", dist.negative],
  ] as const
  let best = entries[0]
  for (const e of entries) {
    if (e[1] > best[1]) best = e
  }
  return `${Math.round(best[1] * 100)}% ${best[0]}`
}
```

---

## Task 4: Update `src/components/sentiment.tsx` to import from lib

**Files:**
- Modify: `src/components/sentiment.tsx`

- [ ] **Step 4.1: Replace inline definitions with imports**

In `src/components/sentiment.tsx`, make THREE separate edits:

**Edit A (top imports):** After the existing `import type { ExtractTier } from "@/components/tubemine"` line, add the new lib import (this is the only `import` statement; imports MUST be top-level):

```ts
import {
  deriveDistribution,
  qualitativeSummary,
  type SentimentDistribution,
} from "@/lib/sentiment-summary"
```

**Edit B (replace inline type with re-export):** Replace the existing `export type SentimentDistribution = { positive: number; neutral: number; negative: number }` block (lines 22-26) with the re-export:

```ts
export type { SentimentDistribution }
```

**Edit C (delete inline helper functions):** Delete the inline `function deriveDistribution(...)` definition (currently lines 252-262) AND the inline `function qualitativeSummary(...)` definition (currently lines 264-273). Both are now provided by the lib import.

- [ ] **Step 4.2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean (or only errors unrelated to sentiment.tsx).

---

## Task 5: Bump `ANALYSES_LIST_MAX` 50 → 100

**Files:**
- Modify: `src/lib/analyses.ts:12`

- [ ] **Step 5.1: Edit the constant**

In `src/lib/analyses.ts`, change the single line:

```ts
export const ANALYSES_LIST_MAX = 50
```

to:

```ts
export const ANALYSES_LIST_MAX = 100
```

No other changes needed in this file. The `clamp` and cursor logic are size-agnostic.

- [ ] **Step 5.2: Sanity check existing tests**

Run: `pnpm test src/lib`
Expected: existing `analyses` lib tests still pass (if present). If no tests exist for this lib, vitest reports zero tests run for the path; that is acceptable.

---

## Task 6: Add i18n keys to `messages/en.json` and `messages/ru.json`

**Files:**
- Modify: `messages/en.json`, `messages/ru.json`

- [ ] **Step 6.1: Add 5 new keys to `messages/en.json`**

Inside the `"common"` object (after the existing `"load_more": "Load more"` line), add:

```json
    "export_json": "Export JSON",
    "export_excel": "Export Excel",
```

Inside the `"dashboard"` object (after `"empty": "No saved analyses yet. ..."`), add:

```json
    "last_100_saved": "Last 100 analyses saved",
```

Inside the `"history"` object (after the existing `"retry": "Retry"`), add:

```json
    "cap_label_free": "Last 10 analyses",
    "cap_label_pro": "Last 100 analyses",
```

(Note: be careful with trailing commas. JSON requires the comma BETWEEN entries; the last entry of an object has no trailing comma. Either reorder so new keys are NOT last, or add a comma to the previous-last entry.)

- [ ] **Step 6.2: Add the same 5 keys to `messages/ru.json`**

Inside `"common"`:

```json
    "export_json": "Экспорт JSON",
    "export_excel": "Экспорт Excel",
```

Inside `"dashboard"`:

```json
    "last_100_saved": "Сохраняются последние 100 анализов",
```

Inside `"history"`:

```json
    "cap_label_free": "Последние 10 анализов",
    "cap_label_pro": "Последние 100 анализов",
```

- [ ] **Step 6.3: Verify message parity**

Run: `node scripts/check-message-parity.mjs`
Expected: exit 0, no missing keys reported.

- [ ] **Step 6.4: Sanity-check JSON validity**

Run: `jq empty messages/en.json && jq empty messages/ru.json && echo OK`
Expected: prints `OK`. No JSON syntax errors.

---

## Task 7: Create `/api/export` route handler

**Files:**
- Create: `src/app/api/export/route.ts`

- [ ] **Step 7.1: Write the route handler**

Create `src/app/api/export/route.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import ExcelJS from "exceljs"
import { authUserId } from "@/lib/auth"
import { getUserQuota } from "@/lib/quota"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CommentSchema = z.object({
  author: z.string().max(200),
  text: z.string().max(10_000),
  sentiment: z.string().max(20).optional(),
  likes: z.number().int().nonnegative().max(100_000_000),
  replies: z.number().int().nonnegative().max(100_000_000),
  publishedAt: z.string().max(50),
})

const ExportRequestSchema = z.object({
  format: z.enum(["json", "xlsx"]),
  videoId: z.string().regex(/^[\w-]{11}$/),
  videoTitle: z.string().max(500).optional(),
  channelName: z.string().max(200).optional(),
  comments: z.array(CommentSchema).max(10_000),
})

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const { userId } = await authUserId()
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in required" },
      { status: 401 },
    )
  }

  const quota = await getUserQuota(userId)
  if (quota.tier !== "pro") {
    return NextResponse.json(
      { error: "Pro plan required for JSON and Excel export" },
      { status: 403 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    )
  }

  const parsed = ExportRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }

  const { format, videoId, videoTitle, channelName, comments } = parsed.data
  const filenameBase = `tubemine-${videoId}-${todayUtc()}`

  if (format === "json") {
    const payload = {
      videoId,
      videoTitle,
      channelName,
      exported_at: new Date().toISOString(),
      comments,
    }
    return NextResponse.json(payload, {
      headers: {
        "Content-Disposition": `attachment; filename="${filenameBase}.json"`,
      },
    })
  }

  // format === "xlsx"
  try {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Comments")
    sheet.addRow(["Author", "Comment", "Sentiment", "Likes", "Replies", "Published"])
    for (const c of comments) {
      sheet.addRow([
        c.author,
        c.text,
        c.sentiment ?? "",
        c.likes,
        c.replies,
        c.publishedAt,
      ])
    }
    const buffer = await workbook.xlsx.writeBuffer()
    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    })
  } catch (err) {
    console.error("[export] xlsx build failed", err)
    return NextResponse.json(
      { error: "Export build failed" },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 7.2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean (or only errors unrelated to the new route file). exceljs ships types; if missing, install `@types/exceljs` (it should not be required for recent exceljs versions).

---

## Task 8: Create `/api/export` route tests

**Files:**
- Create: `src/app/api/export/__tests__/route.test.ts`

- [ ] **Step 8.1: Write the test file**

Create `src/app/api/export/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  authUserId: vi.fn(),
}))
vi.mock("@/lib/quota", () => ({
  getUserQuota: vi.fn(),
  PRO_MONTHLY_CAP: 100_000,
  FREE_MONTHLY_CAP: 5_000,
}))

import { authUserId } from "@/lib/auth"
import { getUserQuota } from "@/lib/quota"
import { POST } from "../route"

const mockAuth = authUserId as unknown as ReturnType<typeof vi.fn>
const mockQuota = getUserQuota as unknown as ReturnType<typeof vi.fn>

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const goodBody = {
  format: "json" as const,
  videoId: "dQw4w9WgXcQ",
  videoTitle: "Test",
  channelName: "Chan",
  comments: [
    {
      author: "a",
      text: "t",
      likes: 0,
      replies: 0,
      publishedAt: "2026-05-19T00:00:00Z",
    },
  ],
}

describe("POST /api/export", () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockQuota.mockReset()
  })

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue({ userId: null, userEmail: null })
    const res = await POST(makeRequest(goodBody) as never)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toMatch(/sign in/i)
  })

  it("returns 403 when tier is free", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", userEmail: "u1@x" })
    mockQuota.mockResolvedValue({ tier: "free", cap: 5000, used: 0, remaining: 5000, resetAt: "" })
    const res = await POST(makeRequest(goodBody) as never)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/pro/i)
  })

  it("returns 400 on malformed JSON", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", userEmail: "u1@x" })
    mockQuota.mockResolvedValue({ tier: "pro", cap: 100000, used: 0, remaining: 100000, resetAt: "" })
    const req = new Request("http://localhost/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it("returns 400 when comments array exceeds 10000", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", userEmail: "u1@x" })
    mockQuota.mockResolvedValue({ tier: "pro", cap: 100000, used: 0, remaining: 100000, resetAt: "" })
    const body = {
      ...goodBody,
      comments: Array.from({ length: 10_001 }, () => ({
        author: "a",
        text: "t",
        likes: 0,
        replies: 0,
        publishedAt: "2026-05-19T00:00:00Z",
      })),
    }
    const res = await POST(makeRequest(body) as never)
    expect(res.status).toBe(400)
  })

  it("returns 200 with JSON attachment for Pro user, format=json", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", userEmail: "u1@x" })
    mockQuota.mockResolvedValue({ tier: "pro", cap: 100000, used: 0, remaining: 100000, resetAt: "" })
    const res = await POST(makeRequest(goodBody) as never)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-disposition")).toMatch(/attachment.*\.json/)
    const json = await res.json()
    expect(json.videoId).toBe("dQw4w9WgXcQ")
    expect(json.comments).toHaveLength(1)
  })

  it("returns 200 xlsx buffer for Pro user, format=xlsx", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", userEmail: "u1@x" })
    mockQuota.mockResolvedValue({ tier: "pro", cap: 100000, used: 0, remaining: 100000, resetAt: "" })
    const res = await POST(makeRequest({ ...goodBody, format: "xlsx" }) as never)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toMatch(
      /spreadsheetml\.sheet/,
    )
    expect(res.headers.get("content-disposition")).toMatch(/attachment.*\.xlsx/)
    const buf = await res.arrayBuffer()
    expect(buf.byteLength).toBeGreaterThan(0)
  })

  it("returns 200 JSON for Pro with empty comments[] (edge case 4)", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", userEmail: "u1@x" })
    mockQuota.mockResolvedValue({ tier: "pro", cap: 100000, used: 0, remaining: 100000, resetAt: "" })
    const res = await POST(makeRequest({ ...goodBody, comments: [] }) as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.comments).toEqual([])
  })

  it("returns 200 xlsx for Pro with empty comments[] (edge case 4)", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", userEmail: "u1@x" })
    mockQuota.mockResolvedValue({ tier: "pro", cap: 100000, used: 0, remaining: 100000, resetAt: "" })
    const res = await POST(makeRequest({ ...goodBody, format: "xlsx", comments: [] }) as never)
    expect(res.status).toBe(200)
    const buf = await res.arrayBuffer()
    expect(buf.byteLength).toBeGreaterThan(0) // valid xlsx with just header row
  })
})
```

- [ ] **Step 8.2: Run the new tests**

Run: `pnpm test src/app/api/export`
Expected: 6 tests passing.

If any test fails, investigate the failure (likely a mismatch in the route handler implementation from Task 7); fix the handler, not the test (the test reflects the spec). Re-run until green.

---

## Task 9: Pass tier to RecentAnalyses from Dashboard page

**Files:**
- Modify: `src/app/[locale]/dashboard/page.tsx`

- [ ] **Step 9.1: Pass `quota.tier` into `<RecentAnalyses>`**

In `src/app/[locale]/dashboard/page.tsx`, change the final line `<RecentAnalyses />` (line 180) to:

```tsx
<RecentAnalyses tier={quota.tier} />
```

`quota` is already in scope (line 44: `const quota = await getUserQuota(user.id)`). The page is `dynamic = "force-dynamic"` (line 21), so each request fetches fresh tier.

---

## Task 10: Tier-aware `RecentAnalyses` component

**Files:**
- Modify: `src/components/recent-analyses.tsx`

- [ ] **Step 10.1: Rewrite the component**

Replace the entire content of `src/components/recent-analyses.tsx` with:

```tsx
import { listAnalyses } from "@/lib/analyses"
import { createClient } from "@/lib/supabase/server"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import {
  deriveDistribution,
  proSentimentLabel,
  qualitativeSummary,
} from "@/lib/sentiment-summary"

type Tier = "free" | "pro"

export async function RecentAnalyses({ tier }: { tier: Tier }) {
  const t = await getTranslations("dashboard")
  const supabase = await createClient()
  const { items } = await listAnalyses(supabase, null, 5)

  if (items.length === 0) {
    return (
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">{t("recent_analyses_heading")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("recent_analyses_heading")}</h2>
        <Link
          href="/history"
          className="text-sm text-muted-foreground hover:underline"
        >
          {t("view_all")}
        </Link>
      </div>
      {tier === "pro" && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("last_100_saved")}
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {items.map((item) => {
          const dist = deriveDistribution(item.sentiment)
          return (
            <li key={item.id} className="flex items-center gap-3">
              {item.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnail_url}
                  alt=""
                  className="h-12 w-20 rounded object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {item.video_title ?? item.video_id}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.channel_name} · {item.comment_count} comments
                </p>
              </div>
              {dist ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {tier === "free" ? qualitativeSummary(dist) : proSentimentLabel(dist)}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 10.2: TypeScript check on this file**

Run: `npx tsc --noEmit`
Expected: clean (or only errors unrelated to this file).

---

## Task 11: `force-dynamic` + tier on `/history` page

**Files:**
- Modify: `src/app/[locale]/history/page.tsx`

- [ ] **Step 11.1: Add tier resolution + subtitle**

Replace the entire content of `src/app/[locale]/history/page.tsx` with:

```tsx
import { listAnalyses } from "@/lib/analyses"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "@/i18n/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { getUserQuota } from "@/lib/quota"
import { HistoryClient } from "./history-client"

export const dynamic = "force-dynamic"

type Tier = "free" | "pro"

async function resolveTier(userId: string): Promise<Tier> {
  try {
    const quota = await getUserQuota(userId)
    return quota.tier
  } catch (err) {
    console.warn("[history] getUserQuota failed; defaulting to free", err)
    return "free"
  }
}

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect({ href: `/login?next=/${locale}/history`, locale })
    return null
  }

  const t = await getTranslations("history")
  const tier = await resolveTier(user.id)
  const initialLimit = tier === "pro" ? 20 : 10
  const initial = await listAnalyses(supabase, null, initialLimit)
  const subtitleKey = tier === "pro" ? "cap_label_pro" : "cap_label_free"

  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t(subtitleKey)}</p>
      <HistoryClient
        tier={tier}
        initialItems={initial.items}
        initialNextCursor={initial.nextCursor}
      />
    </main>
  )
}
```

---

## Task 12: Tier-aware `HistoryClient`

**Files:**
- Modify: `src/app/[locale]/history/history-client.tsx`

- [ ] **Step 12.1: Add tier prop + label + cap logic**

Replace the entire content of `src/app/[locale]/history/history-client.tsx` with:

```tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import type { AnalysisRow } from "@/lib/analyses"
import {
  deriveDistribution,
  proSentimentLabel,
  qualitativeSummary,
} from "@/lib/sentiment-summary"

type Tier = "free" | "pro"

type Props = {
  tier: Tier
  initialItems: AnalysisRow[]
  initialNextCursor: string | null
}

const PRO_HISTORY_CAP = 100

export function HistoryClient({ tier, initialItems, initialNextCursor }: Props) {
  const t = useTranslations("history")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  // Free tier discards the server cursor; Pro tier tracks it for Load More.
  const [cursor, setCursor] = useState(tier === "pro" ? initialNextCursor : null)
  const [loading, setLoading] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const atCap = tier === "pro" && items.length >= PRO_HISTORY_CAP
  const showLoadMore = tier === "pro" && cursor && !atCap

  async function loadMore() {
    if (!cursor || loading) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/analyses?cursor=${encodeURIComponent(cursor)}&limit=20`,
      )
      if (res.ok) {
        const data = (await res.json()) as {
          items: AnalysisRow[]
          nextCursor: string | null
        }
        setItems((prev) => [...prev, ...data.items].slice(0, PRO_HISTORY_CAP))
        setCursor(data.nextCursor)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setConfirmId(null)
    const prev = items
    setItems((rows) => rows.filter((r) => r.id !== id))
    const res = await fetch(`/api/analyses/${id}`, { method: "DELETE" })
    if (!res.ok) {
      setItems(prev)
      return
    }
    startTransition(() => router.refresh())
  }

  if (items.length === 0) {
    return <p className="mt-6 text-muted-foreground">{t("empty")}</p>
  }

  return (
    <>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const dist = deriveDistribution(item.sentiment)
          return (
            <li key={item.id} className="rounded-lg border p-4">
              {item.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnail_url}
                  alt=""
                  className="aspect-video w-full rounded object-cover"
                />
              ) : null}
              <p className="mt-2 line-clamp-2 font-medium">
                {item.video_title ?? item.video_id}
              </p>
              <p className="text-sm text-muted-foreground">
                {item.channel_name}
              </p>
              {dist ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {tier === "free" ? qualitativeSummary(dist) : proSentimentLabel(dist)}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => setConfirmId(item.id)}
                className="mt-3 inline-flex min-h-11 items-center text-sm text-destructive"
                aria-label={tCommon("delete")}
              >
                {tCommon("delete")}
              </button>
            </li>
          )
        })}
      </ul>

      {showLoadMore ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading || isPending}
          className="mx-auto mt-6 block min-h-11 rounded border px-4 py-2"
        >
          {loading ? tCommon("loading") : tCommon("load_more")}
        </button>
      ) : null}

      {confirmId ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setConfirmId(null)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-dialog-title" className="text-lg font-semibold">
              {t("delete_dialog_title")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("delete_dialog_body")}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="min-h-11 rounded border px-3 py-2"
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmId)}
                className="min-h-11 rounded bg-destructive px-3 py-2 text-destructive-foreground"
              >
                {tCommon("delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
```

- [ ] **Step 12.2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean (or only errors unrelated to this file).

---

## Task 13: Rename `csv-gate.tsx` → `export-bar.tsx` + grow to 3 buttons

**Files:**
- Rename: `src/components/csv-gate.tsx` → `src/components/export-bar.tsx`

- [ ] **Step 13.1: `git mv` the file**

Run: `git mv src/components/csv-gate.tsx src/components/export-bar.tsx`

- [ ] **Step 13.2: Replace its content with the new ExportBar component**

Overwrite `src/components/export-bar.tsx` with:

```tsx
"use client"

import { Link } from "@/i18n/navigation"
import { useEffect } from "react"
import { Download, LogIn } from "lucide-react"
import { useTranslations } from "next-intl"
import { track } from "@vercel/analytics"
import { Button, buttonVariants } from "@/components/ui/button"
import type { ExtractTier } from "@/components/tubemine"

export function ExportBar({
  tier,
  videoId,
  onDownloadCsv,
  onDownloadJson,
  onDownloadExcel,
}: {
  tier: ExtractTier
  videoId?: string
  onDownloadCsv: () => void
  onDownloadJson: () => void | Promise<void>
  onDownloadExcel: () => void | Promise<void>
}) {
  const tCommon = useTranslations("common")

  useEffect(() => {
    if (tier === "anonymous") {
      track("csv_signin_gate_shown", { videoId: videoId ?? "unknown" })
    }
  }, [tier, videoId])

  if (tier === "anonymous") {
    return (
      <Link
        href="/login?redirect=/"
        onClick={() => track("csv_signin_clicked", { videoId: videoId ?? "unknown" })}
        className={buttonVariants({ size: "sm" })}
      >
        <LogIn className="size-4" />
        Sign in to export CSV
      </Link>
    )
  }

  if (tier === "free") {
    return (
      <Button onClick={onDownloadCsv} size="sm">
        <Download className="size-4" />
        Export CSV
      </Button>
    )
  }

  // tier === "pro"
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onDownloadCsv} size="sm">
        <Download className="size-4" />
        Export CSV
      </Button>
      <Button onClick={onDownloadJson} size="sm" variant="outline">
        <Download className="size-4" />
        {tCommon("export_json")}
      </Button>
      <Button onClick={onDownloadExcel} size="sm" variant="outline">
        <Download className="size-4" />
        {tCommon("export_excel")}
      </Button>
    </div>
  )
}
```

---

## Task 14: Wire export handlers + filename + import swap in `tubemine.tsx`

**Files:**
- Modify: `src/components/tubemine.tsx`

- [ ] **Step 14.1: Update the import line**

Find the line `import { CsvGate } from "@/components/csv-gate"` (line 42) and replace with:

```ts
import { ExportBar } from "@/components/export-bar"
```

- [ ] **Step 14.2: Update `downloadCsv` filename to the locked convention**

Replace the existing `downloadCsv()` function body (lines 229-254) with:

```ts
function downloadCsv() {
  if (comments.length === 0) return
  track("csv_downloaded", {
    videoId: preview?.videoId ?? "unknown",
    count: comments.length,
    tier,
  })
  const csv = Papa.unparse(comments, {
    columns: ["author", "text", "sentiment", "likes", "replies", "publishedAt"],
  })
  const today = new Date().toISOString().slice(0, 10)
  const filename = `tubemine-${preview?.videoId ?? "unknown"}-${today}.csv`
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  triggerDownload(blob, filename)
}
```

Add a small helper just above `downloadCsv` (before line 229 in current numbering):

```ts
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 14.3: Add `downloadJson()` and `downloadExcel()` handlers**

Add the following two functions immediately after `downloadCsv` (or anywhere inside the `TubeMine` component body before `return`).

`toast` is already imported in this file (`import { toast } from "sonner"` near the top); no new import needed.

```ts
async function downloadJson() {
  if (comments.length === 0 || !preview) return
  try {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "json",
        videoId: preview.videoId,
        videoTitle: preview.title,
        channelName: preview.channel,
        comments,
      }),
    })
    if (!res.ok) throw new Error(`Export failed (${res.status})`)
    const blob = await res.blob()
    const today = new Date().toISOString().slice(0, 10)
    triggerDownload(blob, `tubemine-${preview.videoId}-${today}.json`)
    track("export_completed", {
      format: "json",
      videoId: preview.videoId,
      count: comments.length,
      tier,
    })
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Export failed")
  }
}

async function downloadExcel() {
  if (comments.length === 0 || !preview) return
  try {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "xlsx",
        videoId: preview.videoId,
        videoTitle: preview.title,
        channelName: preview.channel,
        comments,
      }),
    })
    if (!res.ok) throw new Error(`Export failed (${res.status})`)
    const blob = await res.blob()
    const today = new Date().toISOString().slice(0, 10)
    triggerDownload(blob, `tubemine-${preview.videoId}-${today}.xlsx`)
    track("export_completed", {
      format: "xlsx",
      videoId: preview.videoId,
      count: comments.length,
      tier,
    })
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Export failed")
  }
}
```

- [ ] **Step 14.4: Update `<ResultsPanel>` props + invocation**

Find the `<ResultsPanel>` JSX usage (around line 414) and add the two new props:

```tsx
<ResultsPanel
  comments={comments}
  videoTitle={preview?.title ?? ""}
  videoId={preview?.videoId}
  tier={tier}
  onDownloadCsv={downloadCsv}
  onDownloadJson={downloadJson}
  onDownloadExcel={downloadExcel}
/>
```

(Renamed `onDownload` to `onDownloadCsv` and added the two new ones.)

- [ ] **Step 14.5: Update `ResultsPanel` signature + body**

Find the `function ResultsPanel(...)` declaration (line 442) and change its props + the JSX that mounts the export bar.

Replace the signature block:

```tsx
function ResultsPanel({
  comments,
  videoTitle,
  videoId,
  tier,
  onDownload,
}: {
  comments: Comment[]
  videoTitle: string
  videoId?: string
  tier: ExtractTier
  onDownload: () => void
}) {
```

with:

```tsx
function ResultsPanel({
  comments,
  videoTitle,
  videoId,
  tier,
  onDownloadCsv,
  onDownloadJson,
  onDownloadExcel,
}: {
  comments: Comment[]
  videoTitle: string
  videoId?: string
  tier: ExtractTier
  onDownloadCsv: () => void
  onDownloadJson: () => void | Promise<void>
  onDownloadExcel: () => void | Promise<void>
}) {
```

Inside `ResultsPanel`'s JSX find:

```tsx
<CsvGate tier={tier} onDownload={onDownload} videoId={videoId} />
```

and replace with:

```tsx
<ExportBar
  tier={tier}
  videoId={videoId}
  onDownloadCsv={onDownloadCsv}
  onDownloadJson={onDownloadJson}
  onDownloadExcel={onDownloadExcel}
/>
```

- [ ] **Step 14.6: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean.

---

## Task 15: Full verification suite

**Files:** none modified

- [ ] **Step 15.1: TypeScript**

Run: `npx tsc --noEmit`
Expected: clean. If any error, fix and re-run.

- [ ] **Step 15.2: Linter**

Run: `pnpm lint`
Expected: clean. Fix any warnings/errors per existing repo conventions.

- [ ] **Step 15.3: Unit tests**

Run: `pnpm test`
Expected: all tests pass (existing + 6 new in `export/__tests__/route.test.ts`).

- [ ] **Step 15.4: Message parity**

Run: `node scripts/check-message-parity.mjs`
Expected: exit 0, no missing keys.

- [ ] **Step 15.5: Build**

Run: `pnpm build`
Expected: build succeeds. Inspect output for `exceljs` leaking into client bundles (none of the `app/[locale]/*` bundles should reference exceljs). If exceljs appears in a client chunk, the import is wrong; fix.

Capture the "First Load JS shared by all" line (or per-page size table) so the commit summary can quote bundle-size delta.

- [ ] **Step 15.6: No em-dash / en-dash in changed files**

Run:

```bash
grep -rP '[\x{2013}\x{2014}]' \
  src/lib/auth.ts \
  src/lib/sentiment-summary.ts \
  src/app/api/export/route.ts \
  src/app/api/export/__tests__/route.test.ts \
  src/components/recent-analyses.tsx \
  src/components/sentiment.tsx \
  src/components/export-bar.tsx \
  src/components/tubemine.tsx \
  src/app/[locale]/dashboard/page.tsx \
  src/app/[locale]/history/page.tsx \
  src/app/[locale]/history/history-client.tsx \
  src/lib/analyses.ts \
  src/app/api/extract/route.ts \
  messages/en.json \
  messages/ru.json
```

Expected: no output. If any line matches, replace the offending dash chars with regular punctuation (`,` / `.` / `()` / `:` / `-`) per `~/vault/feedback/no-em-dash.md` rules.

- [ ] **Step 15.7: No Polar-banned verbs in new UI strings**

Run:

```bash
grep -nE "\\b(scrape|bulk|pull data|Priority)\\b" \
  src/components/export-bar.tsx \
  src/components/recent-analyses.tsx \
  src/app/[locale]/history/page.tsx \
  src/app/[locale]/history/history-client.tsx \
  messages/en.json messages/ru.json
```

Expected: only any pre-existing matches (none in NEW strings introduced this sprint). The word "extract" is NOT in any new user-facing string we added (only in internal route names which are not user-facing). If a NEW match exists, fix it.

- [ ] **Step 15.8: Local dev smoke (manual, optional pre-push)**

Skip on CI; run locally if convenient:

```bash
pnpm dev
```

Then in another shell:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/extract
```

Expected: `200`.

```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"format":"json","videoId":"dQw4w9WgXcQ","comments":[]}' \
  -o /dev/null -w "%{http_code}\n" \
  http://localhost:3000/api/export
```

Expected: `401` (no auth cookie).

---

## Task 16: Commit + push gate

**Files:** all changes

- [ ] **Step 16.1: Stage all changes**

Run: `git status` to confirm the working tree includes all files listed in the File Map.

Then: `git add -A` (use this because exceljs install touches `pnpm-lock.yaml` and the rename uses `git mv`).

`★ Note ─────────────────────────────`
Plan-wide use of `git add -A` is acceptable here because we've actively avoided spurious side-files and the only generated file is the lockfile. If unexpected files appear in `git status`, investigate before staging.
`────────────────────────────────────`

- [ ] **Step 16.2: Build commit message**

```bash
git commit -m "$(cat <<'EOF'
feat(paywall): Phase H, dashboard qualitative + JSON/Excel exports + Pro history display

Closes the code gap between Phase H design and production:

- Dashboard "Recent analyses" cards: tier-aware sentiment label
  (Free = qualitative via shared qualitativeSummary, Pro = exact percent)
- /history page: tier-aware sentiment label per row, tier-aware initial
  fetch (Free=10, Pro=20), Pro client-side cap at 100 cumulative items
- New /api/export POST endpoint (Pro-gated): JSON + xlsx via exceljs,
  Zod-validated payload capped at 10k comments per request
- CSV/JSON/Excel filename convention unified: tubemine-{videoId}-{date}.{ext}
- Dashboard Pro subtitle "Last 100 analyses saved"
- ANALYSES_LIST_MAX bumped 50 -> 100 for paginated history
- authUserId lifted to src/lib/auth.ts, reused by extract + export routes
- qualitativeSummary + deriveDistribution moved to src/lib/sentiment-summary.ts
- csv-gate.tsx renamed to export-bar.tsx, renders 1/2/3 buttons by tier
- 5 new i18n keys (EN/RU parity)
- 6 new vitest tests for /api/export auth + validation + format paths

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 16.3: Capture commit SHA + diff stats**

Run: `git log -1 --stat | tail -30` and copy the commit SHA + line stats.

- [ ] **Step 16.4: HARD GATE: AskUserQuestion before push**

Use `AskUserQuestion` showing:
- Commit SHA
- Files changed count
- Insertions / deletions
- Brief 3-bullet description (what shipped)

Ask: "Push to main and deploy?"

Wait for explicit "yes push" / "yes deploy" before continuing.

If user says no: stop here. Plan executes no further until the user revises.

- [ ] **Step 16.5: Push to main (only after gate approved)**

Run: `git push origin main`
Expected: push accepted.

---

## Task 17: Post-push verification

**Files:** none

- [ ] **Step 17.1: Wait for Vercel deploy READY**

Run: `mcp__vercel__list_deployments` (or check the dashboard URL printed in the project) and wait for the latest deploy state to be `READY`.

- [ ] **Step 17.2: Prod `GET /api/extract` shape unchanged**

Run: `curl -s https://tubemine.tech/api/extract | jq .`
Expected: `tier: "anonymous"` shape, same as Phase G. No regression.

- [ ] **Step 17.3: Prod `POST /api/export` rejects anonymous**

Run:

```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"format":"json","videoId":"dQw4w9WgXcQ","comments":[]}' \
  -o /dev/null -w "%{http_code}\n" \
  https://tubemine.tech/api/export
```

Expected: `401`.

- [ ] **Step 17.4: Prod `POST /api/export` xlsx anonymous also 401**

Run:

```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"format":"xlsx","videoId":"dQw4w9WgXcQ","comments":[]}' \
  -o /dev/null -w "%{http_code}\n" \
  https://tubemine.tech/api/export
```

Expected: `401`.

- [ ] **Step 17.5: Optional signed-in smoke (skip if no cookie on hand)**

If the executor has a Pro session cookie locally, run a real export and confirm a 200 response + valid attachment. Otherwise queue for next signed-in session per runbook §6.12 (Vercel CDN limits IP-spoof testing).

---

## Task 18: Vault launch note + status tracker

**Files:** vault (Obsidian) only

- [ ] **Step 18.1: Write the launch note**

Use `mcp__obsidian__write_note` to create `projects/yt-comments/launch/2026-05-19/phase-h-backend-shipped.md` mirroring the Phase G backend launch note format. Include:
- Date + commit SHA + Vercel deploy ID + production status
- "What shipped" table (tier-aware label / JSON export / Excel export / Last-100 cap / i18n)
- Files changed list
- Verification checklist results
- Decisions locked during sprint
- Edge cases covered (subset of spec edge cases)
- Open follow-ups (Phase H+1)
- Sources: spec + plan + Phase G + Phase H design

Frontmatter `tags: [yt-comments, tubemine, phase-h, launch, paywall, backend, code-gap]`.

- [ ] **Step 18.2: Update status tracker**

Use `mcp__obsidian__patch_note` (or `write_note` with append) on `projects/yt-comments/status-tracker.md` to add item 17:

```
17. **2026-05-19:** Phase H code-gap shipped (4 deliverables). Commit `<SHA>` on main, Vercel deploy `<dpl_id>` READY. See [[projects/yt-comments/launch/2026-05-19/phase-h-backend-shipped]].
```

---

## Self-review

After writing the plan above, the author (Claude) reviewed against the spec and confirmed:

1. **Spec coverage:** Every section of the spec maps to one or more tasks:
   - Locked decisions 1-20 → tasks 1, 7, 8, 10, 12, 13, 14 (touch every locked area)
   - §Architecture 1 (tier-aware label) → Tasks 9, 10, 11, 12
   - §Architecture 2 (Pro Last 100) → Tasks 5, 11, 12
   - §Architecture 3 (/api/export) → Tasks 1, 2, 7, 8
   - §Architecture 4 (ExportBar) → Tasks 13, 14
   - §Architecture 5 (i18n) → Task 6
   - §Architecture 6 (qualitativeSummary lib) → Tasks 3, 4
   - §Edge cases 1-24 → covered by Tasks 7 (server gates), 10/12 (null sentiment + null dist), 12 (cap merge slice), 11 (force-dynamic), 14 (try/catch)
   - §Verification → Task 15 + 17
   - §Push gate → Task 16

2. **Placeholder scan:** Every code step contains the actual code. No "TBD", no "similar to Task N" without repeating the code. Verified.

3. **Type consistency:** `Tier = "free" | "pro"` (narrowed) declared identically in `recent-analyses.tsx`, `history/page.tsx`, and `history-client.tsx`. `ExtractTier` (full union) stays in `export-bar.tsx` and `tubemine.tsx`. `SentimentDistribution` declared in `src/lib/sentiment-summary.ts` and re-exported from `sentiment.tsx`. Verified.

The plan ships as 1 atomic commit at Task 16.
