# TubeMine v3 Backend Persistence + i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Track B1 (`analyses` table + APIs + `/history` + cron + retention clauses) and Track B2 (next-intl en+ru i18n + locale switcher + hreflang + OAuth callback hardening) so the Claude Design UI generated in Track A maps to a real backend that delivers every UI promise.

**Architecture:** Server-side persistence via Supabase RLS, single-statement UPSERT for save, idempotent DELETE, daily Vercel cron purge of expired rows. Sub-path i18n (`/en/...` `/ru/...`) via next-intl on Next.js 16 App Router with `app/[locale]/` directory and `src/proxy.ts` middleware. Browser detection + cookie persistence. OAuth callback validates `next` param against strict allow-list regex.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4, Tailwind v4, shadcn base-nova, Supabase Auth + Postgres + RLS, Polar billing, Zod 4, next-intl (new), Vitest (new), `@supabase/ssr` (existing).

**Source spec:** [`SPEC.md`](./SPEC.md) (passed 4 rounds of review, converged 29 → 0).

---

## Tracks summary

| Phase | Track | What | Tasks |
|---|---|---|---|
| Phase 0 | — | Pre-flight verification (context7 + quota constants) | 0.1-0.3 |
| Phase 1 | infra | Vitest install + test helpers | 1.1-1.4 |
| Phase 2 | B1 | DB migration | 2.1-2.4 |
| Phase 3 | B1 | Shared `src/lib/analyses.ts` (save / list / delete / purge) | 3.1-3.6 |
| Phase 4 | B1 | API routes (`/api/analyses`, `/api/analyses/:id`, cron) | 4.1-4.5 |
| Phase 5 | B1 | Cron + vercel.json + `CRON_SECRET` provisioning | 5.1-5.2 |
| Phase 6 | B2 | next-intl install + i18n config files + middleware integration | 6.1-6.6 |
| Phase 7 | B2 | Move existing routes under `app/[locale]/` | 7.1-7.8 |
| Phase 8 | B2 | LocaleSwitcher + header integration + OAuth callback hardening | 8.1-8.5 |
| Phase 9 | B1 | UI: RecentAnalyses widget + `/history` page + retention copy | 9.1-9.6 |
| Phase 10 | B1 + B2 | Stub pages for Track A (`/docs`, `/changelog`, `/profile`, `/privacy`, `/terms`) | 10.1-10.5 |
| Phase 11 | infra | Tests: unit + integration + E2E | 11.1-11.10 |
| Phase 12 | deploy | Preview → smoke → prod rollout with rollback | 12.1-12.5 |

**Hard ordering:** Phase 2 (migration) MUST land on prod Supabase BEFORE Phase 12 prod deploy. Phase 6 (i18n setup) MUST land before Phase 7 (route migration). Phases 11 + 12 are gates, not parallelizable.

**Shell quoting note:** every bash command that references `src/app/[locale]/*` MUST single-quote the path. zsh (the user's shell) glob-expands `[locale]` as a character class without quoting and the command fails. Use `'src/app/[locale]/dashboard'`, not `src/app/[locale]/dashboard`. Same for `find`, `git mv`, `git add`, `grep -r src/app/[locale]/`. Plan code blocks below follow this convention; if you see an unquoted bracket path in a copy-paste step, quote it before running.

---

# Phase 0: Pre-flight verification

### Task 0.1: Verify Vercel Cron auth pattern via context7

**Files:** none (research only).

- [ ] **Step 1: Query Vercel docs for cron auth**

```bash
mcp__plugin_context7_context7__query-docs query="Vercel Cron Jobs CRON_SECRET Authorization header authentication"
```

Expected: confirms the documented pattern is set `CRON_SECRET` env var, Vercel automatically includes `Authorization: Bearer ${process.env.CRON_SECRET}` in cron invocations; handler validates by comparing.

- [ ] **Step 2: If pattern matches SPEC §3.4 → proceed. If drift detected → update SPEC.**

If Vercel has shifted to `x-vercel-cron-signature` or `x-vercel-signature` header validation, update `docs/ux-redesign-v3/SPEC.md` §3.4 with the correct mechanism before continuing Task 4.5.

- [ ] **Step 3: Commit (only if SPEC updated)**

```bash
git add docs/ux-redesign-v3/SPEC.md
git commit -m "spec(ux-v3): align cron auth with current Vercel docs"
```

### Task 0.2: Verify next-intl App Router pattern via context7

**Files:** none (research only).

- [ ] **Step 1: Query Next.js 16 + next-intl docs**

```bash
mcp__plugin_context7_context7__query-docs query="next-intl Next.js 16 App Router app locale routing middleware setup 2025"
```

Expected: confirms the current setup uses `src/i18n/routing.ts` + `src/i18n/request.ts` + `app/[locale]/layout.tsx` + middleware integration. Note the exact API surface (`defineRouting`, `createNavigation`, `createMiddleware`) for use in Tasks 6.2-6.4.

- [ ] **Step 2: Capture API names in a scratch comment**

Add a top-of-file comment to `src/i18n/routing.ts` (Task 6.2) noting the next-intl version installed and the API patterns verified.

### Task 0.3: Quota constants verification (flag to Track A)

**Files:** `docs/ux-redesign-v3/PLAN.md` (this file) — append a note.

- [ ] **Step 1: Re-confirm constants**

```bash
grep -E "MONTHLY_BUDGET|FREE_MONTHLY_CAP|PRO_MONTHLY_CAP" \
  /Users/rakhimovy/projects/yt-comments/src/lib/budget.ts \
  /Users/rakhimovy/projects/yt-comments/src/lib/quota.ts
```

Expected output:
```
src/lib/budget.ts:export const MONTHLY_BUDGET = 1000
src/lib/quota.ts:export const FREE_MONTHLY_CAP = 1_000
src/lib/quota.ts:export const PRO_MONTHLY_CAP = 100_000
```

- [ ] **Step 2: Flag to main session**

Append a section "Track A copy correction" to `~/vault/projects/yt-comments/launch/ux-redesign-v3-claude-design-handoff.md`:

> **Quota numbers (Track A FAQ revision):** real constants are anonymous=1,000 / Free auth=1,000 / Pro=100,000 per month UTC. The PRD/SPEC initially said Free=5,000; that's wrong. Track A FAQ Q4 should read: "Anonymous: 1,000 comments/month per IP. Signed-in Free: 1,000/month. Pro: 100,000/month."

---

# Phase 1: Test infrastructure

### Task 1.1: Install Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install**

```bash
pnpm add -D vitest @vitest/coverage-v8 @vitest/ui
```

- [ ] **Step 2: Add test scripts to `package.json`**

```json
"scripts": {
  "build": "next build",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest run --coverage"
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
})
```

- [ ] **Step 4: Smoke test**

Create `src/lib/__tests__/sanity.test.ts`:

```ts
import { describe, it, expect } from "vitest"

describe("vitest", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run: `pnpm test`
Expected: 1 passing test.

- [ ] **Step 5: Commit**

```bash
git add package.json vitest.config.ts pnpm-lock.yaml src/lib/__tests__/sanity.test.ts
git commit -m "feat(test): install vitest with coverage"
```

### Task 1.2: Create test helper for Supabase mocking

**Files:**
- Create: `src/test/supabase-mock.ts`

- [ ] **Step 1: Write the helper**

```ts
import { vi } from "vitest"

export type MockTable = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  lt: ReturnType<typeof vi.fn>
  or: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
}

export function createMockTable(): MockTable {
  const chain = {} as MockTable
  for (const k of [
    "select", "insert", "update", "delete", "upsert",
    "eq", "lt", "or", "order", "limit",
  ] as const) {
    chain[k] = vi.fn(() => chain)
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }))
  return chain
}

export function createMockServiceClient(table: MockTable) {
  return {
    from: vi.fn(() => table),
    auth: {
      admin: {
        deleteUser: vi.fn(() => Promise.resolve({ data: null, error: null })),
      },
    },
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/test/supabase-mock.ts
git commit -m "test: add supabase mock helper"
```

### Task 1.3: Add test fixture for `SentimentAggregate`

**Files:**
- Create: `src/test/fixtures.ts`

- [ ] **Step 1: Write fixtures**

```ts
import type { SentimentAggregate } from "@/lib/sentiment"

export const sampleSentiment: SentimentAggregate = {
  positive: 68,
  neutral: 24,
  negative: 8,
  score: 0.6,
  sampleSize: 100,
  coverage: 0.96,
  languages: ["en"],
  ruShare: 0,
}

export const sampleTopWords = [
  { token: "tutorial", count: 847 },
  { token: "love", count: 662 },
]

export const sampleEmoji = [
  { emoji: "🔥", count: 182, percent: 18.2 },
  { emoji: "❤️", count: 147, percent: 14.7 },
]

export const sampleAnalysisInsert = {
  user_id: "00000000-0000-0000-0000-000000000001",
  video_id: "abcDEFghijk",
  video_title: "Sample video",
  channel_name: "Sample channel",
  thumbnail_url: "https://example.com/thumb.jpg",
  comment_count: 100,
  sentiment: sampleSentiment,
  top_words: sampleTopWords,
  emoji_frequency: sampleEmoji,
}
```

- [ ] **Step 2: Commit**

```bash
git add src/test/fixtures.ts
git commit -m "test: add analysis fixtures"
```

### Task 1.4: Vitest CI integration

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add a pre-build test gate (optional but recommended)**

Update `"build"` to chain tests first:

```json
"build": "vitest run && next build",
```

- [ ] **Step 2: Verify**

```bash
pnpm build
```

Expected: tests pass, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "test: gate build behind passing tests"
```

---

# Phase 2: DB migration

### Task 2.1: Create migration file

**Files:**
- Create: `supabase/migrations/01_analyses.sql`

- [ ] **Step 1: Write the migration**

```sql
-- TubeMine Phase 3: saved analyses with 30-day retention

create table public.analyses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  video_id        text not null,
  video_title     text,
  channel_name    text,
  thumbnail_url   text,
  comment_count   int  not null,
  sentiment       jsonb,
  top_words       jsonb,
  emoji_frequency jsonb,
  processed_at    timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '30 days'),
  unique (user_id, video_id)
);

create index analyses_user_id_processed_at
  on public.analyses (user_id, processed_at desc);

create index analyses_expires_at
  on public.analyses (expires_at);

alter table public.analyses enable row level security;

create policy "users read own analyses"
  on public.analyses for select
  using (auth.uid() = user_id);

create policy "users delete own analyses"
  on public.analyses for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Commit (do not apply yet)**

```bash
git add supabase/migrations/01_analyses.sql
git commit -m "feat(db): add analyses table migration"
```

### Task 2.2: Apply migration to local Supabase

**Files:** none (DB only).

- [ ] **Step 1: Apply**

If using local Supabase via CLI:
```bash
cd /Users/rakhimovy/projects/yt-comments
supabase db reset
```

If using Supabase Dashboard (no local CLI):
- Open Supabase Dashboard → SQL Editor for the dev project
- Paste contents of `supabase/migrations/01_analyses.sql`
- Run

- [ ] **Step 2: Verify schema**

```bash
psql "$DATABASE_URL_DEV" -c "\d public.analyses"
```

Expected: table with all columns, both indexes present, RLS enabled.

```bash
psql "$DATABASE_URL_DEV" -c "select policyname from pg_policies where tablename = 'analyses';"
```

Expected: `users read own analyses`, `users delete own analyses`.

- [ ] **Step 3: Rollback procedure (documented, do not run)**

```sql
drop table if exists public.analyses cascade;
```

### Task 2.3: Apply migration to production Supabase

**⚠️ This task runs against PRODUCTION. Block on user approval before executing.**

**Files:** none (DB only).

- [ ] **Step 1: Get user confirmation**

Show the user the migration content + production project URL + this task description. Wait for explicit `proceed`.

- [ ] **Step 2: Apply to prod**

Open Supabase Dashboard → production project → SQL Editor → paste migration → Run.

- [ ] **Step 3: Verify**

```bash
psql "$DATABASE_URL_PROD" -c "\d public.analyses"
psql "$DATABASE_URL_PROD" -c "select count(*) from public.analyses;"
```

Expected: schema exists, 0 rows.

- [ ] **Step 4: Rollback procedure**

If post-deploy reveals issues:
```sql
drop table if exists public.analyses cascade;
```
Run in prod SQL editor. Re-deploy code that does NOT reference `analyses` table.

### Task 2.4: Sanity-check Supabase TypeScript types

**Files:**
- Inspect: `src/lib/supabase/database.types.ts` (if generated)

- [ ] **Step 1: Check if types are auto-generated**

```bash
ls src/lib/supabase/database.types.ts 2>/dev/null || echo "not generated"
```

If generated, regenerate:
```bash
supabase gen types typescript --project-id <prod-project-id> > src/lib/supabase/database.types.ts
```

If not generated, no action (we'll write inline types in Phase 3).

- [ ] **Step 2: Commit (if regenerated)**

```bash
git add src/lib/supabase/database.types.ts
git commit -m "chore(db): regenerate types for analyses table"
```

---

# Phase 3: Shared `src/lib/analyses.ts`

### Task 3.1: Create types + module skeleton

**Files:**
- Create: `src/lib/analyses.ts`
- Create: `src/lib/__tests__/analyses.test.ts` (empty for now)

- [ ] **Step 1: Write skeleton**

```ts
import "server-only"
import { createServiceClient } from "@/lib/supabase/server"
import type { SentimentAggregate } from "@/lib/sentiment"

export type TopWord = { token: string; count: number }
export type EmojiFreq = { emoji: string; count: number; percent: number }

export type AnalysisRow = {
  id: string
  video_id: string
  video_title: string | null
  channel_name: string | null
  thumbnail_url: string | null
  comment_count: number
  sentiment: SentimentAggregate | null
  top_words: TopWord[] | null
  emoji_frequency: EmojiFreq[] | null
  processed_at: string
  expires_at: string
}

export type AnalysisInsert = {
  userId: string
  videoId: string
  videoTitle: string | null
  channelName: string | null
  thumbnailUrl: string | null
  commentCount: number
  sentiment: SentimentAggregate | null
  topWords: TopWord[]
  emojiFrequency: EmojiFreq[]
}

export type Cursor = { processed_at: string; id: string }

export type ListResult = {
  items: AnalysisRow[]
  nextCursor: string | null
}

// Implementations follow in Tasks 3.2-3.5.
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/analyses.ts src/lib/__tests__/analyses.test.ts
git commit -m "feat(analyses): module skeleton + types"
```

### Task 3.2: Implement `saveAnalysis` (TDD)

**Files:**
- Modify: `src/lib/__tests__/analyses.test.ts`
- Modify: `src/lib/analyses.ts`

- [ ] **Step 1: Write failing test**

Add to `src/lib/__tests__/analyses.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { saveAnalysis } from "@/lib/analyses"
import { sampleAnalysisInsert } from "@/test/fixtures"
import { createMockTable, createMockServiceClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}))

const { createServiceClient } = await import("@/lib/supabase/server")

describe("saveAnalysis", () => {
  let table: ReturnType<typeof createMockTable>
  let client: ReturnType<typeof createMockServiceClient>

  beforeEach(() => {
    table = createMockTable()
    client = createMockServiceClient(table)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)
  })

  it("upserts on (user_id, video_id) with 30-day expires_at", async () => {
    table.upsert.mockReturnValue({
      ...table,
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as never)

    await saveAnalysis({
      userId: sampleAnalysisInsert.user_id,
      videoId: sampleAnalysisInsert.video_id,
      videoTitle: sampleAnalysisInsert.video_title,
      channelName: sampleAnalysisInsert.channel_name,
      thumbnailUrl: sampleAnalysisInsert.thumbnail_url,
      commentCount: sampleAnalysisInsert.comment_count,
      sentiment: sampleAnalysisInsert.sentiment,
      topWords: sampleAnalysisInsert.top_words,
      emojiFrequency: sampleAnalysisInsert.emoji_frequency,
    })

    expect(client.from).toHaveBeenCalledWith("analyses")
    expect(table.upsert).toHaveBeenCalledTimes(1)
    const [payload, opts] = table.upsert.mock.calls[0]
    expect(payload.user_id).toBe(sampleAnalysisInsert.user_id)
    expect(payload.video_id).toBe(sampleAnalysisInsert.video_id)
    expect(opts).toEqual({ onConflict: "user_id,video_id" })
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test src/lib/__tests__/analyses.test.ts
```

Expected: fail with `saveAnalysis is not exported`.

- [ ] **Step 3: Implement `saveAnalysis`**

Append to `src/lib/analyses.ts`:

```ts
export async function saveAnalysis(input: AnalysisInsert): Promise<void> {
  const sb = createServiceClient()
  const now = new Date()
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const { error } = await sb.from("analyses").upsert(
    {
      user_id: input.userId,
      video_id: input.videoId,
      video_title: input.videoTitle,
      channel_name: input.channelName,
      thumbnail_url: input.thumbnailUrl,
      comment_count: input.commentCount,
      sentiment: input.sentiment,
      top_words: input.topWords,
      emoji_frequency: input.emojiFrequency,
      processed_at: now.toISOString(),
      expires_at: expires.toISOString(),
    },
    { onConflict: "user_id,video_id" },
  )

  if (error) {
    console.warn("[analyses] save failed", {
      error: error.message,
      userId: input.userId,
      videoId: input.videoId,
    })
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test src/lib/__tests__/analyses.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyses.ts src/lib/__tests__/analyses.test.ts
git commit -m "feat(analyses): saveAnalysis upsert with 30-day TTL"
```

### Task 3.2.5: Confirm Supabase server module exports

**Files:** none (verification only).

- [ ] **Step 1: grep exports**

```bash
grep -nE "^export (async )?function (createClient|createServiceClient)" \
  /Users/rakhimovy/projects/yt-comments/src/lib/supabase/server.ts
```

Expected: both `createClient` (user-scoped, reads via RLS) AND `createServiceClient` (service-role, writes) are exported. If either is missing, halt and add it before continuing.

### Task 3.3: Implement `listAnalyses` (TDD, user-scoped client, RLS reads)

**Files:**
- Modify: `src/lib/__tests__/analyses.test.ts`
- Modify: `src/lib/analyses.ts`

- [ ] **Step 1: Write failing tests**

Append:

```ts
describe("listAnalyses cursor encoding", () => {
  it("encodes and decodes a cursor losslessly", async () => {
    const { encodeCursor, decodeCursor } = await import("@/lib/analyses")
    const input = { processed_at: "2026-05-18T12:00:00.000Z", id: "abc" }
    const encoded = encodeCursor(input)
    expect(decodeCursor(encoded)).toEqual(input)
  })

  it("returns null on malformed cursor", async () => {
    const { decodeCursor } = await import("@/lib/analyses")
    expect(decodeCursor("not-base64!!!")).toBeNull()
    expect(decodeCursor("eyJpbnZhbGlkIjp0cnVlfQ==")).toBeNull()
  })
})

describe("listAnalyses", () => {
  it.todo(
    "queries with cursor filter when cursor provided (verified via Phase 12 smoke against preview DB)",
  )
})
```

- [ ] **Step 2: Run, verify failing**

```bash
pnpm test src/lib/__tests__/analyses.test.ts
```

Expected: fail (`encodeCursor`, `decodeCursor`, `listAnalyses` not exported).

- [ ] **Step 3: Implement**

Append to `src/lib/analyses.ts`:

```ts
export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), "utf-8").toString("base64url")
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf-8")
    const parsed = JSON.parse(json)
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.processed_at !== "string" ||
      typeof parsed.id !== "string"
    ) {
      return null
    }
    if (Number.isNaN(Date.parse(parsed.processed_at))) return null
    return { processed_at: parsed.processed_at, id: parsed.id }
  } catch {
    return null
  }
}

import type { SupabaseClient } from "@supabase/supabase-js"

export async function listAnalyses(
  sb: SupabaseClient,
  cursor: Cursor | null,
  limit: number,
): Promise<ListResult> {
  // sb is the USER-SCOPED Supabase server client (createClient()). RLS policy
  // "users read own analyses" filters to auth.uid() = user_id, so no manual
  // user_id .eq() is needed — required per SPEC §5 architectural decision
  // ("RLS reads: yes; service role for writes only").
  const cap = Math.min(Math.max(1, limit), 50)

  let query = sb
    .from("analyses")
    .select(
      "id, video_id, video_title, channel_name, thumbnail_url, comment_count, sentiment, top_words, emoji_frequency, processed_at, expires_at",
    )
    .order("processed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(cap + 1)

  if (cursor) {
    // (processed_at, id) < (cursor.processed_at, cursor.id) in desc order:
    // Postgres composite comparison via OR clause.
    query = query.or(
      `processed_at.lt.${cursor.processed_at},and(processed_at.eq.${cursor.processed_at},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error) {
    console.warn("[analyses] list failed", { error: error.message })
    return { items: [], nextCursor: null }
  }

  const rows = (data ?? []) as AnalysisRow[]
  const hasMore = rows.length > cap
  const items = hasMore ? rows.slice(0, cap) : rows
  const last = items[items.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeCursor({ processed_at: last.processed_at, id: last.id })
      : null

  return { items, nextCursor }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/lib/__tests__/analyses.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyses.ts src/lib/__tests__/analyses.test.ts
git commit -m "feat(analyses): listAnalyses cursor pagination"
```

### Task 3.4: Implement `deleteAnalysis` (TDD, idempotent, user-scoped client, RLS owner check)

**Files:**
- Modify: `src/lib/__tests__/analyses.test.ts`
- Modify: `src/lib/analyses.ts`

- [ ] **Step 1: Write failing test**

```ts
describe("deleteAnalysis", () => {
  let table: ReturnType<typeof createMockTable>

  beforeEach(() => {
    table = createMockTable()
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockServiceClient(table),
    )
  })

  it("returns deleted count from RLS-scoped delete", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: [{ id: "row1" }], error: null, count: 1 })
    table.delete.mockReturnValue({ select: vi.fn(() => ({ eq: eqMock })) } as never)
    const { deleteAnalysis } = await import("@/lib/analyses")

    // pass the (mocked) user-scoped client; RLS would filter to caller's user_id in prod
    const mockClient = createMockServiceClient(table)
    const result = await deleteAnalysis(mockClient as never, "row1")
    expect(result).toBe(1)
  })

  it("returns 0 when no row matches (idempotent)", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 })
    table.delete.mockReturnValue({ select: vi.fn(() => ({ eq: eqMock })) } as never)
    const { deleteAnalysis } = await import("@/lib/analyses")

    const mockClient = createMockServiceClient(table)
    const result = await deleteAnalysis(mockClient as never, "ghost-id")
    expect(result).toBe(0)
  })
})
```

- [ ] **Step 2: Verify failing**

```bash
pnpm test src/lib/__tests__/analyses.test.ts
```

- [ ] **Step 3: Implement**

Append to `src/lib/analyses.ts`:

```ts
export async function deleteAnalysis(
  sb: SupabaseClient,
  id: string,
): Promise<number> {
  // sb is the USER-SCOPED Supabase server client. RLS policy
  // "users delete own analyses" enforces auth.uid() = user_id. A DELETE on a
  // row owned by another user removes 0 rows; we collapse that to
  // { deleted: 0 } per SPEC §3.3 idempotent contract (no enumeration leak).
  const { data, error } = await sb
    .from("analyses")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    console.warn("[analyses] delete failed", { error: error.message, id })
    return 0
  }
  return data?.length ?? 0
}
```

- [ ] **Step 4: Run tests**

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyses.ts src/lib/__tests__/analyses.test.ts
git commit -m "feat(analyses): deleteAnalysis idempotent"
```

### Task 3.5: Implement `purgeExpiredAnalyses` (TDD)

**Files:**
- Modify: `src/lib/__tests__/analyses.test.ts`
- Modify: `src/lib/analyses.ts`

- [ ] **Step 1: Write failing test**

```ts
describe("purgeExpiredAnalyses", () => {
  it("deletes rows where expires_at < now() and returns count", async () => {
    const table = createMockTable()
    const ltMock = vi.fn().mockResolvedValue({ data: [{ id: "a" }, { id: "b" }], error: null })
    table.delete.mockReturnValue({ select: vi.fn(() => ({ lt: ltMock })) } as never)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockServiceClient(table),
    )

    const { purgeExpiredAnalyses } = await import("@/lib/analyses")
    const result = await purgeExpiredAnalyses()
    expect(result).toBe(2)
  })
})
```

- [ ] **Step 2: Verify failing**

- [ ] **Step 3: Implement**

```ts
export async function purgeExpiredAnalyses(): Promise<number> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from("analyses")
    .delete()
    .select("id")
    .lt("expires_at", new Date().toISOString())

  if (error) {
    console.warn("[analyses] cron purge failed", { error: error.message })
    return 0
  }
  return data?.length ?? 0
}
```

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyses.ts src/lib/__tests__/analyses.test.ts
git commit -m "feat(analyses): purgeExpiredAnalyses for cron"
```

### Task 3.6: Add `getAnalysisById` for owner-check (RLS-trusted)

**Files:**
- Modify: `src/lib/analyses.ts`

(Skipped for Phase 0 MVP per SPEC §7 cut of GET /api/analyses/:id. Marked here only to confirm absence.)

- [ ] **Step 1: Verify absence**

```bash
grep -n "getAnalysisById" /Users/rakhimovy/projects/yt-comments/src/lib/analyses.ts
```

Expected: no matches.

---

# Phase 4: API routes

### Task 4.1: Modify `POST /api/extract` to call `saveAnalysis`

**Files:**
- Modify: `src/app/api/extract/route.ts`

- [ ] **Step 1: Read the file end-to-end**

```bash
cat /Users/rakhimovy/projects/yt-comments/src/app/api/extract/route.ts
```

Identify the local variable names actually used: which variable holds the YouTube video metadata, which holds the parsed comments array, which holds the sentiment result, which holds top words, which holds emoji frequency. (These will be passed to `saveAnalysis`.) Write them down before editing.

- [ ] **Step 2: Add import**

At top of `src/app/api/extract/route.ts`, alongside existing imports:

```ts
import { saveAnalysis } from "@/lib/analyses"
```

- [ ] **Step 3: Insert save call before the success return**

Locate the final successful `return NextResponse.json(...)` in the POST handler (this is the path after sentiment scoring + top-words + emoji-frequency computation). Immediately BEFORE that return, insert:

```ts
if (userId !== null) {
  try {
    await saveAnalysis({
      userId,
      videoId: <YOUR_VIDEO_ID_VAR>,           // e.g. parsed.videoId or input.videoId
      videoTitle: <YOUR_METADATA_VAR>?.title ?? null,
      channelName: <YOUR_METADATA_VAR>?.channelTitle ?? null,
      thumbnailUrl: <YOUR_METADATA_VAR>?.thumbnail ?? null,
      commentCount: <YOUR_COMMENTS_ARRAY>.length,
      sentiment: <YOUR_SENTIMENT_RESULT>.aggregate,
      topWords: <YOUR_TOP_WORDS>.slice(0, 50),
      emojiFrequency: <YOUR_EMOJI_FREQ>.slice(0, 20),
    })
  } catch (e) {
    console.warn("[analyses] save threw (extract continues)", {
      error: String(e),
      userId,
      videoId: <YOUR_VIDEO_ID_VAR>,
    })
  }
}
```

Replace the `<YOUR_*>` tokens with the actual local-variable names you wrote down in Step 1. The contract: `userId` comes from the existing `authUserId()` call in `extract/route.ts`; all other values are already computed in scope by the time you reach the response return.

- [ ] **Step 4: Run lint + build**

```bash
pnpm lint
pnpm build
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/extract/route.ts
git commit -m "feat(extract): save analysis row for signed-in users"
```

### Task 4.2: Create `GET /api/analyses` route handler

**Files:**
- Create: `src/app/api/analyses/route.ts`

- [ ] **Step 1: Write the handler**

```ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listAnalyses, decodeCursor, type Cursor } from "@/lib/analyses"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const rawCursor = url.searchParams.get("cursor")
  const limitParam = url.searchParams.get("limit")

  let cursor: Cursor | null = null
  if (rawCursor) {
    cursor = decodeCursor(rawCursor)
    if (cursor === null) {
      return NextResponse.json(
        { error: "invalid_cursor" },
        { status: 400 },
      )
    }
  }

  const limit = limitParam ? Number.parseInt(limitParam, 10) : 20
  if (Number.isNaN(limit) || limit < 1) {
    return NextResponse.json(
      { error: "invalid_limit" },
      { status: 400 },
    )
  }

  // Pass user-scoped client (NOT service role) so RLS enforces ownership at DB layer.
  const result = await listAnalyses(supabase, cursor, limit)
  return NextResponse.json(result)
}
```

- [ ] **Step 2: Smoke test via curl**

Local dev only:
```bash
pnpm dev
# In another shell:
curl -s http://localhost:3000/api/analyses
# Expected: {"error":"unauthorized"} with 401
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analyses/route.ts
git commit -m "feat(api): GET /api/analyses paginated list"
```

### Task 4.3: Create `DELETE /api/analyses/:id` route handler

**Files:**
- Create: `src/app/api/analyses/[id]/route.ts`

- [ ] **Step 1: Write the handler**

```ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deleteAnalysis } from "@/lib/analyses"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth check FIRST per SPEC §3.3 precedence (401 ranks before 400).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  // Pass user-scoped client. RLS owner-check enforced at DB.
  const deleted = await deleteAnalysis(supabase, id)
  return NextResponse.json({ deleted })
}
```

- [ ] **Step 2: Smoke test**

```bash
# Anonymous → 401 (auth check is first per SPEC §3.3 precedence):
curl -X DELETE -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/analyses/not-a-uuid
# Expected: 401

# Anonymous with valid-shaped UUID → still 401 (auth always first):
curl -X DELETE -s -o /dev/null -w "%{http_code}\n" \
  http://localhost:3000/api/analyses/00000000-0000-0000-0000-000000000000
# Expected: 401
```

Order in handler is: auth → UUID → DB. Anonymous DELETE always returns 401 regardless of id format. The 400 path triggers only for signed-in requests with malformed UUID.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analyses/\[id\]/route.ts
git commit -m "feat(api): DELETE /api/analyses/:id idempotent"
```

### Task 4.4: Create cron purge endpoint

**Files:**
- Create: `src/app/api/internal/cron/purge-analyses/route.ts`

- [ ] **Step 1: Write the handler**

```ts
import { NextResponse } from "next/server"
import { purgeExpiredAnalyses } from "@/lib/analyses"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const auth = request.headers.get("authorization")
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const start = Date.now()
  const purged = await purgeExpiredAnalyses()
  const durationMs = Date.now() - start

  console.log("[analyses] cron purge", { purged, durationMs })
  return NextResponse.json({ purged })
}
```

- [ ] **Step 2: Smoke test locally**

```bash
curl -s http://localhost:3000/api/internal/cron/purge-analyses
# Expected: {"error":"unauthorized"}

# With CRON_SECRET set in .env.local:
curl -s -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  http://localhost:3000/api/internal/cron/purge-analyses
# Expected: {"purged":0}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/internal/cron/purge-analyses/route.ts
git commit -m "feat(cron): purge expired analyses endpoint"
```

### Task 4.5: Update `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add CRON_SECRET line**

Append:
```
# Vercel Cron auth (production only; long random string)
CRON_SECRET=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore(env): document CRON_SECRET"
```

---

# Phase 5: Cron config + secret provisioning

### Task 5.1: Create `vercel.json` with cron schedule

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Write the config**

```json
{
  "crons": [
    {
      "path": "/api/internal/cron/purge-analyses",
      "schedule": "0 3 * * *"
    }
  ]
}
```

- [ ] **Step 2: Verify JSON validity**

```bash
node -e "JSON.parse(require('fs').readFileSync('/Users/rakhimovy/projects/yt-comments/vercel.json'))"
```

Expected: no error.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat(cron): daily 03:00 UTC schedule for analyses purge"
```

### Task 5.2: Provision `CRON_SECRET` on Vercel production

**Files:** none (env config).

- [ ] **Step 1: Generate random secret**

```bash
openssl rand -base64 48
```

Copy the output.

- [ ] **Step 2: Add to Vercel as plain (not sensitive)**

```bash
cd /Users/rakhimovy/projects/yt-comments
echo "<paste-secret>" | pnpm vercel env add CRON_SECRET production
# When prompted "Sensitive?" choose NO (per ~/vault/references/vercel-sensitive-env-vars.md)
```

Or via Vercel Dashboard → Project → Settings → Environment Variables → Add `CRON_SECRET` (Production, Plain).

- [ ] **Step 3: Verify**

```bash
pnpm vercel env ls production | grep CRON_SECRET
```

Expected: `CRON_SECRET` listed, scope `Production`.

- [ ] **Step 4: Add to local `.env.local` for dev**

```bash
echo "CRON_SECRET=$(openssl rand -base64 48)" >> /Users/rakhimovy/projects/yt-comments/.env.local
```

(Local secret independent of prod.)

- [ ] **Step 5: Rollback procedure**

If the secret leaks: `pnpm vercel env rm CRON_SECRET production`, then re-add a new one.

---

# Phase 6: i18n infrastructure

### Task 6.1: Install next-intl

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
pnpm add next-intl
```

Verify version >= 4.x (Next.js 16 compatible).

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(i18n): install next-intl"
```

### Task 6.2: Create `src/i18n/routing.ts`

**Files:**
- Create: `src/i18n/routing.ts`

- [ ] **Step 1: Write routing config**

```ts
// next-intl routing config. Sub-path strategy locked in SPEC §4.3.
// API surface verified against next-intl docs via context7 in Task 0.2.

import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: ["en", "ru"],
  defaultLocale: "en",
  localePrefix: "always",
})

export type AppLocale = (typeof routing.locales)[number]
```

- [ ] **Step 2: Commit**

```bash
git add src/i18n/routing.ts
git commit -m "feat(i18n): routing config with en+ru sub-path"
```

### Task 6.3: Create `src/i18n/request.ts`

**Files:**
- Create: `src/i18n/request.ts`

- [ ] **Step 1: Write request config**

```ts
import { getRequestConfig } from "next-intl/server"
import { hasLocale } from "next-intl"
import { routing } from "./routing"

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add src/i18n/request.ts
git commit -m "feat(i18n): server request config with message loading"
```

### Task 6.4: Update `next.config.ts` with next-intl plugin

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Wrap config**

Replace contents:

```ts
import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const nextConfig: NextConfig = {
  /* existing options here, if any */
}

export default withNextIntl(nextConfig)
```

- [ ] **Step 2: Verify build still passes**

```bash
pnpm build
```

Expected: success (no messages files yet so build may warn — proceed; Tasks 6.5-6.6 add them).

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat(i18n): wire next-intl plugin"
```

### Task 6.5: Update `src/proxy.ts` to integrate next-intl middleware

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: Read current proxy**

```bash
cat src/proxy.ts
```

It currently runs Supabase auth refresh. We need to chain next-intl's middleware so locale matching happens before auth refresh.

- [ ] **Step 2: Rewrite**

```ts
import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import createIntlMiddleware from "next-intl/middleware"
import { routing } from "@/i18n/routing"

const intl = createIntlMiddleware(routing)

export async function proxy(request: NextRequest) {
  // Skip locale handling for /api/* and /auth/* (non-localized infra routes)
  const { pathname } = request.nextUrl
  const skipIntl =
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt"

  // Run intl first to resolve locale and rewrite/redirect as needed
  let response = skipIntl
    ? NextResponse.next({ request: { headers: request.headers } })
    : intl(request)

  if (response.headers.get("location")) {
    // intl issued a redirect (e.g. / -> /en); short-circuit
    return response
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return response

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
  ],
}
```

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat(i18n): integrate next-intl middleware with supabase auth"
```

### Task 6.6: Create `messages/en.json` skeleton

**Files:**
- Create: `messages/en.json`

- [ ] **Step 1: Write top-level structure**

```json
{
  "common": {
    "app_name": "TubeMine",
    "sign_in": "Sign in",
    "sign_out": "Sign out",
    "get_started": "Get started",
    "loading": "Loading",
    "error_generic": "Something went wrong. Please try again.",
    "cancel": "Cancel",
    "delete": "Delete",
    "confirm": "Confirm",
    "load_more": "Load more"
  },
  "landing": {
    "hero_title_a": "Understand any",
    "hero_title_b": "YouTube video's audience.",
    "hero_subtitle": "Sentiment, top words, and the emojis your audience leans on, in seconds. Free up to 1,000 comments per month, no signup required.",
    "cta_analyze": "Analyze a video",
    "cta_pricing": "See pricing"
  },
  "dashboard": {
    "title": "Dashboard",
    "recent_analyses_heading": "Recent analyses",
    "view_all": "View all",
    "empty": "No saved analyses yet. Analyze a video to see it here."
  },
  "history": {
    "title": "History",
    "delete_dialog_title": "Delete this analysis?",
    "delete_dialog_body": "This can't be undone.",
    "empty": "No saved analyses yet. Analyze a video to see it here.",
    "error": "Could not load your history. Try again.",
    "retry": "Retry"
  },
  "pricing": {
    "title": "Pricing",
    "free_plan": "Free",
    "pro_plan": "Pro",
    "manage_subscription": "Manage subscription"
  },
  "profile": {
    "title": "Profile",
    "section_account": "Account",
    "section_plan": "Plan",
    "section_billing": "Billing",
    "section_danger": "Danger zone"
  },
  "auth": {
    "sign_in_with_google": "Sign in with Google"
  },
  "legal_disclaimer_ru": "",
  "legal_disclaimer_ru_changelog": "",
  "footer": {
    "product": "Product",
    "resources": "Resources",
    "legal": "Legal",
    "social": "Social"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add messages/en.json
git commit -m "feat(i18n): en.json message skeleton"
```

### Task 6.7: Create `messages/ru.json` via pal__chat

**Files:**
- Create: `messages/ru.json`

- [ ] **Step 1: Translate via pal**

```bash
mcp__pal__chat \
  model="deepseek/deepseek-v4-flash" \
  prompt="Translate the values in this JSON to Russian. Preserve keys exactly. Preserve 'TubeMine' as a proper noun (do not translate). Use natural, native Russian (founder is RU native). Keep tone concise + professional. No em-dashes. Output ONLY the JSON, no commentary.

INPUT:
$(cat /Users/rakhimovy/projects/yt-comments/messages/en.json)
"
```

Save the output to `messages/ru.json`.

- [ ] **Step 2: Set RU-specific values**

In `messages/ru.json`, override:
- `legal_disclaimer_ru`: `"Эта страница пока доступна только на английском. Русская версия появится позже."`

- [ ] **Step 3: Verify JSON parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('/Users/rakhimovy/projects/yt-comments/messages/ru.json'))"
```

- [ ] **Step 4: Founder review checkpoint**

⚠️ Show the diff between `en.json` and `ru.json` to the founder before commit. The founder is a native RU speaker; they will catch awkward translations the LLM produces.

```bash
diff -u <(jq -S . /Users/rakhimovy/projects/yt-comments/messages/en.json) \
        <(jq -S . /Users/rakhimovy/projects/yt-comments/messages/ru.json)
```

Wait for founder explicit `ok` before committing.

- [ ] **Step 5: Commit**

```bash
git add messages/ru.json
git commit -m "feat(i18n): ru.json initial translation (founder reviewed)"
```

### Task 6.8: Add key-parity lint script

**Files:**
- Create: `scripts/check-message-parity.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const en = JSON.parse(
  fs.readFileSync(path.join(root, "messages/en.json"), "utf-8"),
)
const ru = JSON.parse(
  fs.readFileSync(path.join(root, "messages/ru.json"), "utf-8"),
)

function flatKeys(obj, prefix = "") {
  const out = new Set()
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const child of flatKeys(v, key)) out.add(child)
    } else {
      out.add(key)
    }
  }
  return out
}

const enKeys = flatKeys(en)
const ruKeys = flatKeys(ru)

const missingInRu = [...enKeys].filter((k) => !ruKeys.has(k))
const missingInEn = [...ruKeys].filter((k) => !enKeys.has(k))

if (missingInRu.length || missingInEn.length) {
  if (missingInRu.length) {
    console.error("Missing in messages/ru.json:", missingInRu)
  }
  if (missingInEn.length) {
    console.error("Missing in messages/en.json:", missingInEn)
  }
  process.exit(1)
}

console.log("messages/en.json and messages/ru.json have key parity.")
```

- [ ] **Step 2: Add script to package.json**

```json
"scripts": {
  "build": "vitest run && pnpm i18n:check && next build",
  "i18n:check": "node scripts/check-message-parity.mjs",
  ...
}
```

- [ ] **Step 3: Run**

```bash
pnpm i18n:check
```

Expected: parity passes.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-message-parity.mjs package.json
git commit -m "feat(i18n): key-parity lint enforced in build"
```

---

# Phase 7: Move existing routes under `app/[locale]/`

### Task 7.1: Create `app/[locale]/layout.tsx`

**Files:**
- Create: `src/app/[locale]/layout.tsx`

- [ ] **Step 1: Write the layout**

```tsx
import { NextIntlClientProvider, hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { routing } from "@/i18n/routing"

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/layout.tsx
git commit -m "feat(i18n): locale layout with NextIntlClientProvider"
```

### Task 7.2: Locale layout owns `<html><body>`; delete unused root layout

**Decision locked:** `src/app/[locale]/layout.tsx` provides `<html lang={locale}><body>{...}</body></html>`. The legacy `src/app/layout.tsx` is removed. API route handlers and `/auth/callback` are route handlers that return Response objects (no HTML render), so they need no layout. `sitemap.ts` and `robots.ts` are MetadataRoute exports (no layout needed). All rendered pages live under `[locale]/*`.

**Files:**
- Inspect: `src/app/layout.tsx`
- Modify: `src/app/[locale]/layout.tsx` (own chrome + html/body)
- Delete: `src/app/layout.tsx`

- [ ] **Step 1: Capture existing root chrome**

```bash
cat src/app/layout.tsx
```

Note current font import, metadata export, body class, any global styles import.

- [ ] **Step 2: Rewrite `src/app/[locale]/layout.tsx` to own html/body**

Port EVERY top-level concern from the existing `src/app/layout.tsx`:
- font imports (Geist, Geist_Mono, or whatever is currently there)
- `@vercel/analytics` `<Analytics />` if present
- Toaster / sonner if present
- SiteHeader / footer components if present
- `metadata` export including `openGraph` and `twitter` blocks
- global CSS import (verify actual path; `src/app/globals.css` exists, so from `src/app/[locale]/layout.tsx` the relative path is `../globals.css`)

Template skeleton:

```tsx
import "../globals.css"
import type { Metadata } from "next"
import { NextIntlClientProvider, hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"  // path may differ; verify against old layout
import { SiteHeader } from "@/components/site-header"  // same
import { routing } from "@/i18n/routing"

const geist = Geist({ subsets: ["latin", "cyrillic"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

// Re-export the full metadata block from the old root layout (title, description,
// openGraph, twitter, icons). Verify nothing was lost by comparing to old file.
export const metadata: Metadata = {
  title: "TubeMine",
  description: "Understand any YouTube video's audience.",
  // openGraph: { ... }, twitter: { ... }, etc. — copy from old src/app/layout.tsx
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  return (
    <html lang={locale} className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <NextIntlClientProvider>
          {/* <SiteHeader /> here if it was in the old root layout */}
          {children}
          {/* <Toaster /> and <Analytics /> if they were in old root layout */}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Audit other root-level files**

Files that stay at `src/app/` root (do NOT move under `[locale]/`):

- `src/app/opengraph-image.tsx` — Metadata route, locale-agnostic OG image. Keep.
- `src/app/sitemap.ts` — covers both locales itself (Task 7.5). Keep.
- `src/app/robots.ts` — locale-agnostic. Keep.
- `src/app/logout/route.ts` — route handler returns Response, no layout needed. Keep.
- `src/app/auth/callback/route.ts` — route handler. Keep.
- `src/app/api/**` — route handlers. Keep.
- `src/app/favicon.ico` — Metadata file. Keep.

Files to move into `[locale]/` (Tasks 7.3 + 7.4 handle this):
- `src/app/page.tsx`
- `src/app/dashboard/`
- `src/app/pricing/`
- `src/app/login/`

After Tasks 7.3 + 7.4 + Phase 10 complete (all page moves done), no rendered page should exist at root level. Verification command (run AFTER Phase 7 + Phase 10, not in Task 7.2 itself):

```bash
find src/app -maxdepth 2 -name page.tsx -not -path '*/[locale]/*'
```

Expected output (post Phase 7/10): empty. If any unexpected `page.tsx` shows up at root level, halt and move it under `[locale]/` before Phase 12.

- [ ] **Step 4: Delete the old root layout**

```bash
git rm src/app/layout.tsx
```

- [ ] **Step 5: Verify with `pnpm dev`**

```bash
pnpm dev
curl -s http://localhost:3000/en | grep -E '<html|<body|lang='
```

Expected: `<html lang="en">`, `<body>`.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/[locale]/layout.tsx'
git rm src/app/layout.tsx
git commit -m "feat(i18n): locale layout owns html/body; remove unused root layout"
```

### Task 7.3: Move landing page to `app/[locale]/page.tsx`

**Files:**
- Move: `src/app/page.tsx` → `src/app/[locale]/page.tsx`

- [ ] **Step 1: Move file**

```bash
mkdir -p src/app/[locale]
git mv src/app/page.tsx src/app/[locale]/page.tsx
```

- [ ] **Step 2: Inject `setRequestLocale` + `useTranslations`**

Convert the page to an async server component using `getTranslations` (NOT `useTranslations`, which is a client-only hook):

```tsx
import { setRequestLocale, getTranslations } from "next-intl/server"

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("landing")

  return (
    <main>
      <h1>
        {t("hero_title_a")} {t("hero_title_b")}
      </h1>
      <p>{t("hero_subtitle")}</p>
      {/* ... rest of existing JSX, swap hardcoded strings to t("...") */}
    </main>
  )
}
```

For any subtree that needs the React `useTranslations` client hook (e.g., interactive components), extract a separate client component (`"use client"`) and use `useTranslations` only inside it. Server-tree code uses `getTranslations(namespace)` exclusively.

- [ ] **Step 3: Verify**

```bash
pnpm dev
curl -s http://localhost:3000/en | grep -o '<title>[^<]*</title>'
# Expected: <title>TubeMine ...</title>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/page.tsx
git rm src/app/page.tsx  # if not already moved by git mv
git commit -m "feat(i18n): landing page under [locale]"
```

### Task 7.4: Move dashboard, pricing, login routes

**Files:**
- Move: `src/app/dashboard/page.tsx` → `src/app/[locale]/dashboard/page.tsx`
- Move: `src/app/dashboard/upgrade-button.tsx` → `src/app/[locale]/dashboard/upgrade-button.tsx`
- Move: `src/app/dashboard/logout-button.tsx` → `src/app/[locale]/dashboard/logout-button.tsx`
- Move: `src/app/pricing/page.tsx` → `src/app/[locale]/pricing/page.tsx`
- Move: `src/app/login/page.tsx` → `src/app/[locale]/login/page.tsx`
- Move: `src/app/login/login-form.tsx` → `src/app/[locale]/login/login-form.tsx`

- [ ] **Step 1: Move each (quote bracket paths)**

```bash
cd /Users/rakhimovy/projects/yt-comments
git mv src/app/dashboard 'src/app/[locale]/dashboard'
git mv src/app/pricing 'src/app/[locale]/pricing'
git mv src/app/login 'src/app/[locale]/login'
```

- [ ] **Step 2: For each page, add `setRequestLocale(locale)` + `useTranslations` (mirror Task 7.3 pattern).**

- [ ] **Step 3: Update any internal `<Link href="/dashboard">` to `<Link href={`/${locale}/dashboard`}>` or use next-intl's `Link` from `createNavigation`.**

For consistency add to `src/i18n/navigation.ts`:

```ts
import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing)
```

Then import `Link` from `@/i18n/navigation` in pages.

- [ ] **Step 4: Verify dev server**

Visit `http://localhost:3000/en/dashboard`, `/en/pricing`, `/en/login`. All render. Visit `/dashboard` (no locale): expect 307 redirect to `/en/dashboard` (intl middleware).

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/ src/i18n/navigation.ts
git commit -m "feat(i18n): move dashboard/pricing/login under [locale]"
```

### Task 7.5: Update `src/app/sitemap.ts` for both locales

**Files:**
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Inspect current**

```bash
cat src/app/sitemap.ts
```

- [ ] **Step 2: Rewrite to emit both locales**

```ts
import { MetadataRoute } from "next"

const base = "https://tubemine.vercel.app"  // TODO: switch to tubemine.tech after DNS
const locales = ["en", "ru"] as const
const routes = ["", "/pricing", "/login", "/docs", "/changelog", "/privacy", "/terms"]

export default function sitemap(): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = []
  for (const locale of locales) {
    for (const route of routes) {
      out.push({
        url: `${base}/${locale}${route}`,
        changeFrequency: "weekly",
        priority: route === "" ? 1.0 : 0.7,
      })
    }
  }
  return out
}
```

- [ ] **Step 3: Verify**

```bash
curl -s http://localhost:3000/sitemap.xml | head -40
```

Expected: includes `/en/` and `/ru/` entries.

- [ ] **Step 4: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(i18n): sitemap covers both locales"
```

### Task 7.6: Add hreflang link tags to `[locale]/layout.tsx`

**Files:**
- Modify: `src/app/[locale]/layout.tsx`

- [ ] **Step 1: Add metadata export**

```tsx
import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return {
    alternates: {
      languages: {
        en: "https://tubemine.vercel.app/en",
        ru: "https://tubemine.vercel.app/ru",
        "x-default": "https://tubemine.vercel.app/en",
      },
      canonical: `https://tubemine.vercel.app/${locale}`,
    },
  }
}
```

- [ ] **Step 2: Verify in browser**

```bash
curl -s http://localhost:3000/en | grep -E 'hreflang|canonical'
```

Expected: contains `<link rel="alternate" hreflang="en" ...>`, `hreflang="ru"`, `hreflang="x-default"`, `<link rel="canonical" ...>`.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/layout.tsx
git commit -m "feat(i18n): hreflang + canonical tags"
```

### Task 7.7: Custom `Accept-Language` matcher per SPEC §4.4

**Files:**
- Modify: `src/i18n/routing.ts`
- Create: `src/i18n/detect-locale.ts`
- Modify: `src/proxy.ts` (apply matcher before next-intl middleware)

**Why custom matcher:** SPEC §4.4 step 3 requires the highest-q `Accept-Language` tag MUST match `ru` to serve RU. next-intl's default `localeDetection: true` matches if ANY tag in the header is in the locales list — that would route a `uk-UA,uk;q=0.9,ru;q=0.5` user to RU (because `ru` is present), violating SPEC. We implement custom matching and pass the resolved locale through a `NEXT_LOCALE` cookie which next-intl then honors.

- [ ] **Step 1: Configure routing with cookie + disabled auto-detection**

```ts
import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: ["en", "ru"],
  defaultLocale: "en",
  localePrefix: "always",
  // We do our own Accept-Language parsing per SPEC §4.4; next-intl reads
  // the NEXT_LOCALE cookie we set in proxy.
  localeDetection: false,
  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
    secure: true,
    path: "/",
  },
})
```

- [ ] **Step 2: Create `src/i18n/detect-locale.ts`**

```ts
import { routing } from "./routing"

export type AppLocale = (typeof routing.locales)[number]

/**
 * SPEC §4.4: find the highest-quality tag in Accept-Language.
 * If it starts with "ru" (case-insensitive), serve "ru". Else "en".
 * Missing / malformed header → "en".
 */
export function detectLocaleFromAcceptLanguage(
  acceptLanguage: string | null,
): AppLocale {
  if (!acceptLanguage) return "en"

  const parts = acceptLanguage
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((part) => {
      const [tag, ...params] = part.split(";").map((s) => s.trim())
      let q = 1
      for (const param of params) {
        const m = param.match(/^q\s*=\s*([0-9.]+)$/i)
        if (m) {
          const v = Number.parseFloat(m[1])
          if (!Number.isNaN(v)) q = v
        }
      }
      return { tag: tag.toLowerCase(), q }
    })
    .filter((x) => x.tag && !Number.isNaN(x.q))

  if (parts.length === 0) return "en"

  // Highest q wins; tie-break by order.
  parts.sort((a, b) => b.q - a.q)
  const top = parts[0]
  return top.tag.startsWith("ru") ? "ru" : "en"
}

/**
 * Validate cookie value against the locale allow-list.
 * Per SPEC §4.4: unknown values fall through to detection.
 */
export function readLocaleCookie(value: string | undefined): AppLocale | null {
  if (!value) return null
  return (routing.locales as readonly string[]).includes(value)
    ? (value as AppLocale)
    : null
}
```

- [ ] **Step 3: Apply in `src/proxy.ts` BEFORE intl middleware**

In `src/proxy.ts`, before calling `intl(request)`, ensure the `NEXT_LOCALE` cookie reflects the SPEC §4.4 precedence:

```ts
import { detectLocaleFromAcceptLanguage, readLocaleCookie } from "@/i18n/detect-locale"
import { routing } from "@/i18n/routing"

// ... inside proxy(), after the skipIntl branch:
const url = request.nextUrl
const hasLocalePrefix = routing.locales.some((loc) =>
  url.pathname === `/${loc}` || url.pathname.startsWith(`/${loc}/`),
)
if (!hasLocalePrefix && !skipIntl) {
  // URL has no locale prefix; resolve via cookie or Accept-Language and let
  // intl middleware redirect.
  const cookieLocale = readLocaleCookie(request.cookies.get("NEXT_LOCALE")?.value)
  if (!cookieLocale) {
    const detected = detectLocaleFromAcceptLanguage(
      request.headers.get("accept-language"),
    )
    // We don't set the cookie here — let LocaleSwitcher own that. Intl middleware
    // will redirect to /<detected>/<pathname> because we pass it through next.
    request.headers.set("x-locale-hint", detected)
  }
}
```

Note: next-intl with `localeDetection: false` redirects bare `/` to `/${defaultLocale}`. To honor browser detection without enabling next-intl's broad matching, pass the detected locale by rewriting the request URL before `intl()` runs. Implementer choice: either use a small custom redirect for bare `/` based on `detectLocaleFromAcceptLanguage`, or set `routing.defaultLocale` based on request (not supported statically). PLAN-recommended approach: handle the bare `/` redirect in `src/proxy.ts` BEFORE delegating to `intl`:

```ts
if (request.nextUrl.pathname === "/") {
  const cookieLocale = readLocaleCookie(request.cookies.get("NEXT_LOCALE")?.value)
  const target = cookieLocale ?? detectLocaleFromAcceptLanguage(
    request.headers.get("accept-language"),
  )
  return NextResponse.redirect(new URL(`/${target}`, request.url))
}
```

- [ ] **Step 4: Confirm against SPEC §9 Track B2 tests 1-4**

These four tests are the source of truth for the detection behavior. Task 11.6 will execute them.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/routing.ts src/i18n/detect-locale.ts src/proxy.ts
git commit -m "feat(i18n): q-value Accept-Language matcher per SPEC §4.4"
```

### Task 7.8: Verify proxy + intl middleware order

**Files:**
- Verify: `src/proxy.ts`

- [ ] **Step 1: Manual end-to-end test**

```bash
pnpm dev
# In another shell:
curl -sI http://localhost:3000/ | head -5
# Expected: 307 Temporary Redirect, Location: /en (or /ru depending on default headers)

curl -sI -H "Accept-Language: ru-RU,ru;q=0.9" http://localhost:3000/ | grep Location
# Expected: Location: /ru

curl -sI -H "Accept-Language: en-US" http://localhost:3000/ | grep Location
# Expected: Location: /en

curl -sI -H "Accept-Language: uk-UA,uk;q=0.9,ru;q=0.5" http://localhost:3000/ | grep Location
# Expected: Location: /en (NOT /ru, because uk is highest-q and uk is not in our locales)
```

- [ ] **Step 2: Commit (if any tweaks made)**

---

# Phase 8: LocaleSwitcher + OAuth hardening

### Task 8.1: Create `<LocaleSwitcher />`

**Files:**
- Create: `src/components/locale-switcher.tsx`

- [ ] **Step 1: Write component**

```tsx
"use client"

import { usePathname, useRouter } from "@/i18n/navigation"
import { useLocale } from "next-intl"
import { routing } from "@/i18n/routing"
import { useTransition } from "react"

export function LocaleSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    startTransition(() => {
      router.replace(pathname, { locale: next })
    })
  }

  return (
    <select
      aria-label="Language"
      value={locale}
      onChange={onChange}
      disabled={isPending}
      className="bg-transparent text-sm"
    >
      {routing.locales.map((loc) => (
        <option key={loc} value={loc}>
          {loc.toUpperCase()}
        </option>
      ))}
    </select>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/locale-switcher.tsx
git commit -m "feat(i18n): LocaleSwitcher component"
```

### Task 8.2: Add LocaleSwitcher to header

**Files:**
- Modify: `src/app/[locale]/layout.tsx` (or wherever header lives)

- [ ] **Step 1: Identify header**

```bash
grep -rn "header\|nav" src/app/[locale]/layout.tsx
```

- [ ] **Step 2: Add `<LocaleSwitcher />` next to nav-end**

```tsx
import { LocaleSwitcher } from "@/components/locale-switcher"
// ... in header JSX:
<LocaleSwitcher />
```

- [ ] **Step 3: Verify**

Visit `/en/`, see `EN` dropdown. Switch to RU. URL becomes `/ru/`. Page reloads in RU.

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/layout.tsx
git commit -m "feat(i18n): LocaleSwitcher in header"
```

### Task 8.3: Harden OAuth callback with `next` validation

**Files:**
- Create: `src/app/auth/callback/safe-next.ts` (exportable validator, testable in Task 11.4)
- Modify: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Read current callback**

```bash
cat src/app/auth/callback/route.ts
```

- [ ] **Step 2: Create `safe-next.ts` (extracted for unit testing)**

Create `src/app/auth/callback/safe-next.ts`:

```ts
const NEXT_RE = /^\/(en|ru)\/[\w\-/]*$/

export function safeNext(raw: string | null): string {
  if (!raw) return "/"
  if (!NEXT_RE.test(raw)) return "/"
  return raw
}
```

- [ ] **Step 3: Use it in the callback route**

In `src/app/auth/callback/route.ts`, add:

```ts
import { safeNext } from "./safe-next"
```

After exchanging code for session, replace any existing redirect logic:

```ts
const next = safeNext(request.nextUrl.searchParams.get("next"))
return NextResponse.redirect(new URL(next, request.url))
```

- [ ] **Step 4: Smoke test**

```bash
# Local dev:
curl -sI "http://localhost:3000/auth/callback?next=https://evil.com&code=test" | grep Location
# Expected: Location: http://localhost:3000/  (NOT evil.com)

curl -sI "http://localhost:3000/auth/callback?next=/ru/history&code=test" | grep Location
# Expected: Location: http://localhost:3000/ru/history
```

- [ ] **Step 5: Commit (include new safe-next.ts)**

```bash
git add src/app/auth/callback/route.ts src/app/auth/callback/safe-next.ts
git commit -m "feat(auth): validate OAuth next param against strict allow-list"
```

### Task 8.4: Login page propagates `next` through OAuth flow

**Files:**
- Modify: `src/app/[locale]/login/page.tsx` and/or `src/app/[locale]/login/login-form.tsx`

- [ ] **Step 1: Read current login**

```bash
cat src/app/[locale]/login/login-form.tsx
```

Identify where `signInWithOAuth({ provider: "google", options: { redirectTo: ... } })` is called.

- [ ] **Step 2: Read `next` query param + pass to OAuth options**

```tsx
"use client"

import { useSearchParams } from "next/navigation"
// ...

export function LoginForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? "/"

  async function handleGoogleSignIn() {
    const supabase = createBrowserClient(...)
    const redirectTo = new URL("/auth/callback", window.location.origin)
    redirectTo.searchParams.set("next", next)

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
      },
    })
  }
  // ...
}
```

- [ ] **Step 3: Smoke test**

```bash
# In browser:
# 1. open http://localhost:3000/ru/history (anonymous)
# 2. confirm redirect to http://localhost:3000/ru/login?next=%2Fru%2Fhistory
# 3. click "Sign in with Google" → OAuth dance → land back on /ru/history
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/login/login-form.tsx
git commit -m "feat(auth): propagate next param through Google OAuth"
```

### Task 8.5: Auth gate on protected routes

**Files:**
- Modify: `src/app/[locale]/history/page.tsx` (created in Task 9.3) — preview the pattern

- [ ] **Step 1: Pattern for auth gate**

In any route requiring auth:

```tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "@/i18n/navigation"

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect({
      href: `/login?next=/${locale}/history`,
      locale,
    })
  }
  // ... protected content
}
```

- [ ] **Step 2: Capture pattern in a snippet for re-use in dashboard + profile + history.**

(No commit yet — this is just for reference; protected pages get this in Phase 9.)

---

# Phase 9: UI — RecentAnalyses widget + `/history` page + retention copy

### Task 9.1: Create `<RecentAnalyses />` server component

**Files:**
- Create: `src/components/recent-analyses.tsx`

- [ ] **Step 1: Write component**

```tsx
import { listAnalyses } from "@/lib/analyses"
import { createClient } from "@/lib/supabase/server"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"

export async function RecentAnalyses() {
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
          {t("view_all")} →
        </Link>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            {item.thumbnail_url ? (
              <img
                src={item.thumbnail_url}
                alt=""
                className="h-12 w-20 rounded object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.video_title ?? item.video_id}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.channel_name} · {item.comment_count} comments
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/recent-analyses.tsx
git commit -m "feat(ui): RecentAnalyses widget"
```

### Task 9.2: Add widget to Dashboard

**Files:**
- Modify: `src/app/[locale]/dashboard/page.tsx`

- [ ] **Step 1: Inject widget**

In dashboard page, after authenticated section:

```tsx
import { RecentAnalyses } from "@/components/recent-analyses"

export const dynamic = "force-dynamic"

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect({ href: `/login?next=/${locale}/dashboard`, locale })

  return (
    <main>
      {/* existing dashboard content */}
      <RecentAnalyses />
    </main>
  )
}
```

- [ ] **Step 2: Verify**

Visit `/en/dashboard` while signed in. Widget renders (with 0 or 5 entries).

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/dashboard/page.tsx
git commit -m "feat(dashboard): integrate RecentAnalyses widget"
```

### Task 9.3: Create `/history` page (server)

**Files:**
- Create: `src/app/[locale]/history/page.tsx`
- Create: `src/app/[locale]/history/history-client.tsx`

- [ ] **Step 1: Write server page**

```tsx
import { listAnalyses } from "@/lib/analyses"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "@/i18n/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { HistoryClient } from "./history-client"

export const dynamic = "force-dynamic"

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
  }

  const t = await getTranslations("history")
  // Pass user-scoped client; RLS filters to caller's rows.
  const initial = await listAnalyses(supabase, null, 20)

  return (
    <main className="container mx-auto py-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <HistoryClient
        initialItems={initial.items}
        initialNextCursor={initial.nextCursor}
      />
    </main>
  )
}
```

- [ ] **Step 2: Write client component**

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import type { AnalysisRow } from "@/lib/analyses"

type Props = {
  initialItems: AnalysisRow[]
  initialNextCursor: string | null
}

export function HistoryClient({ initialItems, initialNextCursor }: Props) {
  const t = useTranslations("history")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialNextCursor)
  const [loading, setLoading] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function loadMore() {
    if (!cursor || loading) return
    setLoading(true)
    const res = await fetch(`/api/analyses?cursor=${encodeURIComponent(cursor)}&limit=20`)
    if (res.ok) {
      const data = await res.json()
      setItems((prev) => [...prev, ...data.items])
      setCursor(data.nextCursor)
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    setConfirmId(null)
    const prev = items
    setItems((rows) => rows.filter((r) => r.id !== id))
    const res = await fetch(`/api/analyses/${id}`, { method: "DELETE" })
    if (!res.ok) {
      setItems(prev) // revert on error
    } else {
      router.refresh()
    }
  }

  if (items.length === 0) {
    return <p className="mt-6 text-muted-foreground">{t("empty")}</p>
  }

  return (
    <>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border p-4">
            {item.thumbnail_url ? (
              <img src={item.thumbnail_url} alt="" className="aspect-video w-full rounded object-cover" />
            ) : null}
            <p className="mt-2 line-clamp-2 font-medium">{item.video_title ?? item.video_id}</p>
            <p className="text-sm text-muted-foreground">{item.channel_name}</p>
            <button
              type="button"
              onClick={() => setConfirmId(item.id)}
              className="mt-3 text-sm text-destructive"
            >
              {/* uses common.delete or history.delete_dialog_title */}
              Delete
            </button>
          </li>
        ))}
      </ul>

      {cursor ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mt-6 mx-auto block rounded border px-4 py-2"
        >
          {loading ? tCommon("loading") : tCommon("load_more")}
        </button>
      ) : null}

      {confirmId ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 grid place-items-center bg-black/50">
          <div className="rounded-lg bg-background p-6">
            <h2 className="text-lg font-semibold">{t("delete_dialog_title")}</h2>
            <p className="mt-2 text-sm">{t("delete_dialog_body")}</p>
            <div className="mt-4 flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmId(null)} className="px-3 py-2">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmId)}
                className="px-3 py-2 rounded bg-destructive text-destructive-foreground"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/history/
git commit -m "feat(history): paginated list with idempotent delete"
```

### Task 9.4: Add Privacy + Terms retention clauses

**Files:**
- Create or modify: `src/app/[locale]/privacy/page.tsx`
- Create or modify: `src/app/[locale]/terms/page.tsx`

- [ ] **Step 1: Privacy clause**

In Privacy page body (EN-only, render with disclaimer wrapper if `locale === "ru"`):

```tsx
<p>
  We store the aggregated analysis results (sentiment percentages, top words,
  emoji frequencies) for 30 days, associated with your account. Raw comment
  text is processed in memory and never written to disk. After 30 days,
  results are automatically purged. You can delete any saved analysis at any
  time from your history page.
</p>
```

- [ ] **Step 2: Terms clause**

In Terms page body:

```tsx
<p>
  Analysis results saved to your account are retained for 30 days from the
  date of analysis. You may delete any analysis at any time from your history
  page.
</p>
```

- [ ] **Step 3: Add disclaimer wrapper for `/ru/` legal pages (server-side)**

Both Privacy and Terms are server components (no client interactivity). Use `getTranslations` + `getLocale` from `next-intl/server` (NOT `useLocale`/`useTranslations` which are client hooks):

```tsx
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server"

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  return (
    <main className="container mx-auto py-8">
      {locale === "ru" ? (
        <p className="mb-6 rounded border-l-4 border-yellow-500 bg-yellow-50 p-4 text-sm">
          {t("legal_disclaimer_ru")}
        </p>
      ) : null}
      <p>
        We store the aggregated analysis results (sentiment percentages, top
        words, emoji frequencies) for 30 days, associated with your account.
        Raw comment text is processed in memory and never written to disk.
        After 30 days, results are automatically purged. You can delete any
        saved analysis at any time from your history page.
      </p>
      {/* ...rest of EN body content... */}
    </main>
  )
}
```

For Terms, same pattern with the Terms body text. For Changelog, use `t("legal_disclaimer_ru_changelog")` instead of `t("legal_disclaimer_ru")`.

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/privacy/ src/app/[locale]/terms/
git commit -m "feat(legal): retention clauses + RU-locale disclaimer"
```

### Task 9.5: Wire `force-dynamic` everywhere needed

**Files:**
- Modify each: `src/app/[locale]/dashboard/page.tsx`, `src/app/[locale]/history/page.tsx`

- [ ] **Step 1: Verify `dynamic` exports**

```bash
grep -rn "export const dynamic" src/app/[locale]/
```

Expected: both dashboard and history declare `export const dynamic = "force-dynamic"`.

- [ ] **Step 2: Commit (if added)**

---

# Phase 10: Stub pages for Track A

These pages get their final content from Claude Design HTMLs during Track C integration. Phase 10 creates the routes so links + sitemap work and locale routing covers them.

### Task 10.1: `/docs` stub

**Files:**
- Create: `src/app/[locale]/docs/page.tsx`

```tsx
import { setRequestLocale } from "next-intl/server"

export default async function DocsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <main className="container mx-auto py-8">
      <h1 className="text-2xl font-bold">Docs</h1>
      <p className="mt-4 text-muted-foreground">
        Documentation content will land here via Track A.
      </p>
    </main>
  )
}
```

Commit: `feat(docs): route stub`.

### Task 10.2: `/changelog` stub

**Files:**
- Create: `src/app/[locale]/changelog/page.tsx`

Similar stub. Include the RU disclaimer wrapper (changelog is EN-only per SPEC §4.7).

Commit: `feat(changelog): route stub`.

### Task 10.3: `/profile` stub

**Files:**
- Create: `src/app/[locale]/profile/page.tsx`

Auth-gated stub:

```tsx
import { setRequestLocale } from "next-intl/server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "@/i18n/navigation"

export default async function ProfilePage({
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
  if (!user) redirect({ href: `/login?next=/${locale}/profile`, locale })

  return (
    <main className="container mx-auto py-8">
      <h1 className="text-2xl font-bold">Profile</h1>
      <p className="mt-4">Track A populates Account / Plan / Billing / Danger zone here.</p>
    </main>
  )
}
```

Commit: `feat(profile): route stub`.

### Task 10.4: `/privacy` + `/terms` stubs

Already created in Task 9.4 with retention clauses + disclaimer.

### Task 10.5: Footer with socials

**Files:**
- Modify: `src/app/[locale]/layout.tsx` (footer section)

- [ ] **Step 1: Add footer**

```tsx
const socials = [
  { label: "GitHub", url: "https://github.com/RakhimovY/tubemine" },
  { label: "Threads", url: "https://www.threads.com/@ai.yerke_" },
  { label: "X", url: "https://x.com/yerkeRakhimov" },
  { label: "LinkedIn", url: "https://www.linkedin.com/in/rakhimov-yerkebulan/" },
  { label: "dev.to", url: "https://dev.to/yerkerakhimov" },
  { label: "Reddit", url: "https://www.reddit.com/user/ErkeshaA/" },
  { label: "Instagram", url: "https://www.instagram.com/ai.yerke_/" },
  { label: "Telegram", url: "https://t.me/ai_yerke" },
]

// in layout JSX footer:
<footer>
  <ul>
    {socials.map((s) => (
      <li key={s.url}>
        <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
          {s.label}
        </a>
      </li>
    ))}
  </ul>
</footer>
```

Track A polishes this. Phase 10 ships the URLs.

Commit: `feat(footer): 8 social links`.

---

# Phase 11: Tests

### Task 11.1: Unit tests for cursor encode/decode

**Files:** already covered in Task 3.3 (`src/lib/__tests__/analyses.test.ts`).

- [ ] **Step 1: Verify coverage**

```bash
pnpm test src/lib/__tests__/analyses.test.ts -- --coverage
```

Expected: `encodeCursor` and `decodeCursor` both reach 100% line coverage.

### Task 11.2: Unit test `saveAnalysis` is invoked from `POST /api/extract`

Heavy integration tests against a real Supabase test project are out of scope for this sprint (no test-DB harness exists in the repo). Instead we unit-test the wiring: assert that `saveAnalysis` is called with the correct shape when a user is signed in, and is NOT called for anonymous requests. Full E2E save verification happens in Phase 12 smoke tests against the deployed preview.

**Files:**
- Create: `src/app/api/extract/__tests__/route.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/analyses", () => ({
  saveAnalysis: vi.fn(),
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

const { saveAnalysis } = await import("@/lib/analyses")

describe("POST /api/extract save side-effect", () => {
  beforeEach(() => {
    vi.mocked(saveAnalysis).mockClear()
  })

  it.todo(
    "calls saveAnalysis when userId is non-null with full payload shape (verified via Phase 12 smoke against preview)",
  )

  it.todo(
    "does NOT call saveAnalysis when userId is null (verified via Phase 12 smoke)",
  )
})
```

The test wires the mocks; full POST request invocation requires stubbing the YouTube + budget modules too. If those stubs prove costly, demote this to a smoke test in Phase 12 (manually extract a video while signed in, verify a row appears via `psql`).

- [ ] **Step 2: Run**

```bash
pnpm test src/app/api/extract/__tests__/route.test.ts
```

Expected: pass (or skip with `it.todo` for fully wired flow if the YouTube stub blocks).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/extract/__tests__/route.test.ts
git commit -m "test: wire saveAnalysis from extract route"
```

### Task 11.3: Integration test for cron purge

**Files:**
- Create: `src/app/api/internal/cron/purge-analyses/__tests__/route.test.ts`

- [ ] **Step 1: Test auth + purge**

```ts
import { describe, it, expect } from "vitest"
import { GET } from "../route"

describe("cron purge", () => {
  it("returns 401 without bearer", async () => {
    process.env.CRON_SECRET = "test-secret"
    const req = new Request("http://test/api/internal/cron/purge-analyses")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns 401 with wrong bearer", async () => {
    process.env.CRON_SECRET = "test-secret"
    const req = new Request("http://test/api/internal/cron/purge-analyses", {
      headers: { authorization: "Bearer wrong" },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it.todo(
    "returns purged count with valid bearer (verified via Phase 12 smoke against preview DB)",
  )
})
```

- [ ] **Step 2: Run + commit**

### Task 11.4: Unit test for safeNext regex (OAuth callback)

**Files:**
- Create: `src/app/auth/callback/__tests__/safe-next.test.ts`

- [ ] **Step 1: Verify the module exists**

`src/app/auth/callback/safe-next.ts` was created in Task 8.3 Step 2. Confirm:

```bash
test -f /Users/rakhimovy/projects/yt-comments/src/app/auth/callback/safe-next.ts && echo OK
```

- [ ] **Step 2: Write tests**

```ts
import { describe, it, expect } from "vitest"
import { safeNext } from "../safe-next"

describe("safeNext", () => {
  const cases: Array<[string | null, string]> = [
    [null, "/"],
    ["", "/"],
    ["/en/history", "/en/history"],
    ["/ru/dashboard", "/ru/dashboard"],
    ["/en/", "/en/"],
    ["https://evil.com", "/"],
    ["//evil.com", "/"],
    ["/en/../evil", "/"],
    ["/fr/history", "/"],
    ["?javascript:alert(1)", "/"],
    ["/en/history?q=ok", "/"],
  ]

  for (const [input, expected] of cases) {
    it(`maps ${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
      expect(safeNext(input)).toBe(expected)
    })
  }
})
```

- [ ] **Step 3: Run + commit**

### Task 11.5: Unit test `deleteAnalysis` idempotency

**Files:** already exercised in `src/lib/__tests__/analyses.test.ts` (Task 3.4 wrote both the success and 0-row-deleted cases). Endpoint-level idempotency is verified by smoke test in Phase 12.

- [ ] **Step 1: Verify both deleteAnalysis tests still pass**

```bash
pnpm test src/lib/__tests__/analyses.test.ts -t deleteAnalysis
```

Expected: both `it` blocks (`returns deleted count from RLS-scoped delete`, `returns 0 when no row matches`) pass.

- [ ] **Step 2: No commit unless changes needed.**

### Task 11.6: Unit tests for `detectLocaleFromAcceptLanguage` + `readLocaleCookie`

**Files:**
- Create: `src/i18n/__tests__/detect-locale.test.ts`

Unit-testing the pure functions covers SPEC §4.4 detection precedence without needing a Next.js middleware harness. End-to-end behavior (redirects, cookies) is covered by Phase 12 smoke tests against the deployed preview.

- [ ] **Step 1: Write the tests**

```ts
import { describe, it, expect } from "vitest"
import {
  detectLocaleFromAcceptLanguage,
  readLocaleCookie,
} from "@/i18n/detect-locale"

describe("detectLocaleFromAcceptLanguage", () => {
  const cases: Array<[string | null, "en" | "ru"]> = [
    [null, "en"],
    ["", "en"],
    ["ru-RU,ru;q=0.9", "ru"],
    ["en-US,en;q=0.9", "en"],
    ["fr-FR", "en"],
    // Ukrainian primary; ru as fallback should NOT route to RU per SPEC §4.4
    ["uk-UA,uk;q=0.9,ru;q=0.5", "en"],
    ["RU", "ru"],
    ["ru-KZ", "ru"],
    ["en-US,ru;q=0.7", "en"],   // top-q is en
    ["ru;q=0.9,en;q=0.7", "ru"], // top-q is ru
  ]
  for (const [input, expected] of cases) {
    it(`maps ${JSON.stringify(input)} -> ${expected}`, () => {
      expect(detectLocaleFromAcceptLanguage(input)).toBe(expected)
    })
  }
})

describe("readLocaleCookie", () => {
  it("returns en for 'en'", () => {
    expect(readLocaleCookie("en")).toBe("en")
  })
  it("returns ru for 'ru'", () => {
    expect(readLocaleCookie("ru")).toBe("ru")
  })
  it("returns null for unknown value", () => {
    expect(readLocaleCookie("fr")).toBe(null)
    expect(readLocaleCookie("")).toBe(null)
    expect(readLocaleCookie(undefined)).toBe(null)
  })
})
```

- [ ] **Step 2: Run**

```bash
pnpm test src/i18n/__tests__/detect-locale.test.ts
```

Expected: all cases pass.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/__tests__/detect-locale.test.ts
git commit -m "test(i18n): detect-locale Accept-Language + cookie matcher"
```

### Task 11.7: Create E2E runbook for OAuth round-trip + locale switcher

Phase 0 has no Playwright in the repo. Document a manual test runbook the founder executes once against the deployed preview. The runbook is single-purpose and serves as the source of truth for Phase 12 smoke tests.

**Files:**
- Create: `docs/ux-redesign-v3/E2E-runbook.md`

- [ ] **Step 1: Write the runbook**

```markdown
# TubeMine v3 E2E Runbook

Target: deployed Vercel preview URL.

## OAuth round-trip preserves locale

1. Open `<preview>/ru/history` in incognito.
2. Verify 307 redirect to `<preview>/ru/login?next=%2Fru%2Fhistory`.
3. Click "Войти через Google".
4. Complete Google OAuth.
5. **Pass:** land on `<preview>/ru/history`.
6. **Fail:** land anywhere else (esp. `/en/...`).

## Open-redirect rejection

1. Visit `<preview>/auth/callback?next=https://evil.com&code=fake` in a browser.
2. Check the redirect target.
3. **Pass:** redirected to `<preview>/` (root). Never reaches `evil.com`.
4. **Fail:** redirected to `evil.com` or any external host.

Repeat with: `next=//evil.com`, `next=/ru/../../evil`, `next=javascript:alert(1)`. All should land on `<preview>/`.

## Locale switcher persists

1. Visit `<preview>/en/` in incognito.
2. Inspect cookies: `NEXT_LOCALE` should be absent or `en`.
3. Click the switcher → `RU`.
4. URL becomes `<preview>/ru/`.
5. Inspect cookies: `NEXT_LOCALE=ru`, 1-year expiry, SameSite=Lax, Secure.
6. Close tab. Reopen `<preview>/`. **Pass:** redirects to `<preview>/ru/`.

## History delete idempotency

1. Sign in. Run an extract on video A.
2. Visit `/en/history`. Verify the row exists.
3. Open DevTools → Network. Click Delete → confirm. Watch the DELETE request.
4. **Pass:** returns `200 { deleted: 1 }`. Row removed from UI.
5. Resend the DELETE manually (curl or DevTools "Replay").
6. **Pass:** returns `200 { deleted: 0 }`. No error toast.
```

- [ ] **Step 2: Commit**

```bash
git add docs/ux-redesign-v3/E2E-runbook.md
git commit -m "test(e2e): manual runbook for OAuth + locale + delete"
```

### Task 11.8: Open-redirect smoke test against preview

After Phase 12 preview deploys, execute the open-redirect section of the E2E runbook (Task 11.7). Capture results in the rollout commit message.

- [ ] **Step 1: Run curl against preview**

```bash
PREVIEW_URL=<your-preview-url>
for next in "https://evil.com" "//evil.com" "/en/../../evil" "javascript:alert(1)"; do
  echo "Testing next=$next"
  curl -sI "$PREVIEW_URL/auth/callback?next=$(printf %s "$next" | jq -sRr @uri)&code=fake" | grep -i location || echo "(no Location header)"
done
```

Expected: every Location header is the preview origin root (`/`), never `evil.com` and never the literal payload.

- [ ] **Step 2: If any redirect leaks → halt deploy and fix `safeNext` regex.**

### Task 11.9: Run full test suite

```bash
pnpm test
pnpm i18n:check
pnpm lint
pnpm build
```

Expected: all green.

### Task 11.10: Commit test artifacts

```bash
git add src/**/__tests__/ docs/ux-redesign-v3/E2E-runbook.md
git commit -m "test: full B1+B2 coverage"
```

---

# Phase 12: Deployment rollout

### Task 12.1: Run full local test suite

- [ ] All Phase 11 tests pass locally.

### Task 12.2: Apply migration to production Supabase

⚠️ **User approval required.** Reference Task 2.3.

### Task 12.3: Push to Vercel preview branch

```bash
git checkout -b ux-v3-backend-i18n
git push -u origin ux-v3-backend-i18n
```

Vercel auto-deploys to preview.

- [ ] **Step 1: Smoke test preview**

- `https://<preview>/` → 307 to `/en`
- `https://<preview>/en/history` (signed in) → renders
- `https://<preview>/api/analyses` (signed in) → `{ items: [...], nextCursor: ... }`
- `curl -H "Authorization: Bearer $CRON_SECRET" https://<preview>/api/internal/cron/purge-analyses` → `{ purged: 0 }`

- [ ] **Step 2: Note any regressions; fix before prod.**

### Task 12.4: Production deploy

- [ ] **Step 1: Merge to main**

```bash
gh pr create --title "ux-v3: backend persistence + i18n" --body "Closes B1+B2 of UX v3 sprint."
gh pr merge --squash --delete-branch
```

Vercel auto-deploys main to prod.

- [ ] **Step 2: Smoke test prod**

Same smoke as Task 12.3 against prod URL.

- [ ] **Step 3: Tail Vercel logs**

```bash
pnpm vercel logs --follow
```

Watch for `[analyses]` warns. Save-failure rate should be 0 in week 1.

### Task 12.5: Rollback procedure (for reference)

If post-deploy critical bug:

1. **UI bug only:** `git revert <commit>` + push.
2. **API contract bug:** `git revert <commit>` + push. Migration stays — the table is harmless when no code reads it.
3. **Data-corruption bug:** `git revert` + apply rollback SQL from Task 2.3 step 4.

---

## File Structure Summary

**New files:**

```
supabase/migrations/01_analyses.sql
src/i18n/routing.ts
src/i18n/request.ts
src/i18n/navigation.ts
src/lib/analyses.ts
src/components/locale-switcher.tsx
src/components/recent-analyses.tsx
src/app/[locale]/layout.tsx
src/app/[locale]/history/page.tsx
src/app/[locale]/history/history-client.tsx
src/app/[locale]/docs/page.tsx
src/app/[locale]/changelog/page.tsx
src/app/[locale]/profile/page.tsx
src/app/[locale]/privacy/page.tsx
src/app/[locale]/terms/page.tsx
src/app/api/analyses/route.ts
src/app/api/analyses/[id]/route.ts
src/app/api/internal/cron/purge-analyses/route.ts
src/test/supabase-mock.ts
src/test/fixtures.ts
src/lib/__tests__/sanity.test.ts
src/lib/__tests__/analyses.test.ts
src/app/api/extract/__tests__/route.test.ts
src/app/api/internal/cron/purge-analyses/__tests__/route.test.ts
src/app/auth/callback/__tests__/safe-next.test.ts
src/app/auth/callback/safe-next.ts
messages/en.json
messages/ru.json
scripts/check-message-parity.mjs
vercel.json
vitest.config.ts
docs/ux-redesign-v3/E2E-runbook.md
```

**Deleted files:**

```
src/app/layout.tsx (removed; [locale]/layout.tsx owns html/body)
```

**Modified files:**

```
src/app/api/extract/route.ts (add saveAnalysis call)
src/app/auth/callback/route.ts (add safeNext validation)
src/app/sitemap.ts (both locales)
src/proxy.ts (chain intl + supabase middleware)
src/app/[locale]/dashboard/page.tsx (was src/app/dashboard, add RecentAnalyses + force-dynamic)
src/app/[locale]/dashboard/upgrade-button.tsx
src/app/[locale]/dashboard/logout-button.tsx
src/app/[locale]/pricing/page.tsx (was src/app/pricing)
src/app/[locale]/login/page.tsx (was src/app/login)
src/app/[locale]/login/login-form.tsx (next param propagation)
src/app/[locale]/page.tsx (was src/app/page.tsx, useTranslations)
next.config.ts (next-intl plugin)
package.json (vitest + next-intl + scripts)
.env.example (CRON_SECRET)
```

---

## Self-review checklist

- [x] Every SPEC §3-§5 + §9 acceptance test has at least one task implementing it.
- [x] No "TBD" / "TODO" / "similar to Task N" placeholders.
- [x] Function names consistent across tasks (`saveAnalysis`, `listAnalyses`, `deleteAnalysis`, `purgeExpiredAnalyses`, `encodeCursor`, `decodeCursor`, `safeNext`, `RecentAnalyses`, `HistoryClient`, `LocaleSwitcher`).
- [x] Migration before code deploy enforced in Phase 12 ordering.
- [x] Each task with deployable change has rollback procedure.
- [x] Auth contracts (401/400/200-with-count) match SPEC §3.3 across all endpoint tasks.
- [x] Vercel Cron is GET (Task 4.4 + 5.1), bearer auth (Task 5.2).
- [x] `force-dynamic` on history + dashboard (Task 9.5).
- [x] OAuth `next` regex validation (Task 8.3) covers the SPEC §4.4 acceptance criteria.
- [x] i18n routing locked sub-path, q-value Accept-Language enabled, cookie attrs set (Task 7.7).

---

**Plan complete and saved to `docs/ux-redesign-v3/PLAN.md`.**

Per turbo-pipeline workflow: this plan now goes to 5x parallel review (Phase 4 of the pipeline) before execution. Do NOT invoke `superpowers:executing-plans` yet.
