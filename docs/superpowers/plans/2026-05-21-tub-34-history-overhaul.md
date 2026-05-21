# TUB-34 History Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache per-comment data for instant re-view and zero-YT-quota exports; ship /history/:id detail route; unify Dashboard recent block and /history page through one `<AnalysesList>` component with tier-aware downloads and delete-with-undo.

**Architecture:** Threshold-based persistence (`comments` JSONB inline OR `comments_blob_path` to Supabase storage at >5MB serialized) keeps the data model simple. Detail view is a new server route at `/[locale]/(app)/history/[id]/page.tsx` rendering a client `<AnalysisDetailView>` with virtualized comments table. Unified `<AnalysesList>` client component renders both dashboard and history contexts via `compact` / `showActions` flags. Delete-with-undo uses a 5s `setTimeout` with `committed` flag race guard; unmount clears timers without firing DELETE (Gmail-style).

**Tech Stack:** Next.js 16 App Router + Supabase (RLS-scoped reads, service-role writes, storage bucket) + TypeScript + Sonner + @tanstack/react-virtual (new).

**Spec:** `docs/superpowers/specs/2026-05-21-tub-34-history-overhaul-design.md` (commit 113200c).

**Phased delivery:** 4 PRs, each ships to main and verifies on prod before the next begins.

---

## File Structure

### PR 1: Backend

Create:

- `supabase/migrations/03_analyses_comments.sql` - DB migration adding `comments` JSONB + `comments_blob_path` TEXT columns
- `src/lib/comments.ts` - `StoredComment` type
- `src/lib/supabase/storage.ts` - `uploadCommentsBlob` / `downloadCommentsBlob` / `deleteCommentsBlob` helpers
- `src/lib/__tests__/storage.test.ts`
- `src/lib/__tests__/analyses-tub34.test.ts` - tests for `computeExpiresAt`, blob threshold, `getAnalysisById`

Modify:

- `src/lib/analyses.ts` - add `computeExpiresAt`, extend `AnalysisInsert`/`saveAnalysis`, add `getAnalysisById`, extend `purgeExpiredAnalyses`
- `src/app/api/extract/route.ts` - pass `tier` + `comments` to `saveAnalysis`
- `src/app/api/analyses/[id]/route.ts` - add `GET` handler
- `src/app/api/export/route.ts` - add `mode: "cache" | "extract"` discriminated union; cache branch reads cached comments

### PR 2: Detail route

Create:

- `src/app/[locale]/(app)/history/[id]/page.tsx` - server component
- `src/app/[locale]/(app)/history/[id]/loading.tsx` - skeleton
- `src/components/analysis-detail-view.tsx` - client component composing all panels
- `src/components/comments-table.tsx` - virtualized table
- `src/components/__tests__/analysis-detail-view.test.tsx`

Modify:

- `messages/en.json` - add `history_detail` namespace
- `messages/ru.json` - add `history_detail` namespace
- `package.json` - add `@tanstack/react-virtual` dependency

### PR 3: Unified component

Create:

- `src/components/analyses-list.tsx` - unified client component with delete-with-undo
- `src/components/empty-analyses-list.tsx` - shared empty state
- `src/components/__tests__/analyses-list.test.tsx`

Modify:

- `src/components/recent-analyses.tsx` - refactor to thin wrapper around `<AnalysesList compact limit={10} showActions={false} />`
- `src/app/[locale]/(app)/history/history-client.tsx` - refactor to `<AnalysesList paginated showActions limit={20} />`

### PR 4: Polish

Modify:

- `messages/en.json`, `messages/ru.json` - finalize parity
- `src/__tests__/analytics-i18n-parity.test.ts` - add new event names
- `~/vault/projects/yt-comments/qa/test-cases.md` - TC-HISTORY cluster (via Obsidian MCP)
- `~/vault/playbooks/saas-roadmap/13-qa-user-flows-and-test-cases.md` - cluster 10 (via Obsidian MCP)
- `~/vault/daily/2026-05-21.md` - session summary (via Obsidian MCP)

---

## PR 1: Backend (DB migration + writes + reads + tier-aware TTL)

### Task 1.1: DB migration for comments columns

**Files:**
- Create: `supabase/migrations/03_analyses_comments.sql`

- [ ] **Step 1: Write migration SQL**

Create `supabase/migrations/03_analyses_comments.sql`:

```sql
-- TUB-34: cache per-comment data for instant re-view and zero-YT-quota exports.
-- comments stores small payloads inline as JSONB; large payloads go to the
-- analyses-comments storage bucket and comments_blob_path holds the key.
-- Both columns nullable; existing rows (pre-TUB-34) keep null on both = "legacy".

alter table public.analyses
  add column if not exists comments jsonb,
  add column if not exists comments_blob_path text;

-- No new RLS policies: column-level reads inherit the row policy.
-- INSERT/UPDATE remain service-role-only (no policy = default deny for non-service).
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Run via `mcp__claude_ai_Supabase__apply_migration` (project: production):
- name: `03_analyses_comments`
- query: contents of the SQL file above

- [ ] **Step 3: Create storage bucket via Supabase MCP**

Run via `mcp__claude_ai_Supabase__execute_sql`:

```sql
insert into storage.buckets (id, name, public)
values ('analyses-comments', 'analyses-comments', false)
on conflict do nothing;
```

- [ ] **Step 4: Verify migration applied**

Run via `mcp__claude_ai_Supabase__list_tables`: confirm `analyses` has `comments` and `comments_blob_path` columns.
Run via `mcp__claude_ai_Supabase__execute_sql`: `select count(*) from storage.buckets where id = 'analyses-comments';` -> expect 1.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/03_analyses_comments.sql
git commit -m "feat(tub-34): db migration adds comments + comments_blob_path columns to analyses"
```

### Task 1.2: StoredComment type

**Files:**
- Create: `src/lib/comments.ts`

- [ ] **Step 1: Write the type**

```ts
// Persisted shape of one YT comment in the analyses cache (JSONB or storage blob).
// Kept minimal: only the fields needed by the detail view + cache export paths.
export type StoredComment = {
  authorName: string | null
  text: string
  likes: number
  replies: number | null
  publishedAt: string | null // ISO
  sentiment: "positive" | "neutral" | "negative" | "unknown" | null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/comments.ts
git commit -m "feat(tub-34): add StoredComment type"
```

### Task 1.3: Storage helpers with path-traversal hardening

**Files:**
- Create: `src/lib/supabase/storage.ts`
- Test: `src/lib/__tests__/storage.test.ts`

- [ ] **Step 1: Write failing test**

`src/lib/__tests__/storage.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { commentsBlobPath } from "@/lib/supabase/storage"

describe("commentsBlobPath", () => {
  const userId = "11111111-2222-3333-4444-555555555555"
  it("formats path as <userId>/<videoId>.json", () => {
    expect(commentsBlobPath(userId, "dQw4w9WgXcQ")).toBe(
      "11111111-2222-3333-4444-555555555555/dQw4w9WgXcQ.json",
    )
  })
  it("rejects invalid uuid", () => {
    expect(() => commentsBlobPath("not-a-uuid", "dQw4w9WgXcQ")).toThrow()
  })
  it("rejects path-traversal videoId", () => {
    expect(() => commentsBlobPath(userId, "../etc/passwd")).toThrow()
  })
  it("rejects YT id wrong length", () => {
    expect(() => commentsBlobPath(userId, "short")).toThrow()
  })
})
```

- [ ] **Step 2: Run test, verify fails**

Run: `pnpm vitest run src/lib/__tests__/storage.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement storage helpers**

`src/lib/supabase/storage.ts`:

```ts
import "server-only"
import { createServiceClient } from "@/lib/supabase/server"
import type { StoredComment } from "@/lib/comments"

const BUCKET = "analyses-comments"
const UUID_RE = /^[0-9a-f-]{36}$/i
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/

export function commentsBlobPath(userId: string, videoId: string): string {
  if (!UUID_RE.test(userId)) {
    throw new Error("commentsBlobPath: invalid userId")
  }
  if (!YT_ID_RE.test(videoId)) {
    throw new Error("commentsBlobPath: invalid videoId")
  }
  return `${userId}/${videoId}.json`
}

function splitAndValidatePath(path: string): { userId: string; videoId: string } {
  const parts = path.split("/")
  if (parts.length !== 2) throw new Error("invalid blob path")
  const [userId, fname] = parts
  if (!fname.endsWith(".json")) throw new Error("invalid blob path")
  const videoId = fname.slice(0, -5)
  if (!UUID_RE.test(userId) || !YT_ID_RE.test(videoId)) {
    throw new Error("invalid blob path segments")
  }
  return { userId, videoId }
}

export async function uploadCommentsBlob(
  userId: string,
  videoId: string,
  json: string,
): Promise<string> {
  const path = commentsBlobPath(userId, videoId)
  const sb = createServiceClient()
  const { error } = await sb.storage.from(BUCKET).upload(path, json, {
    contentType: "application/json",
    upsert: true,
  })
  if (error) throw new Error(`uploadCommentsBlob: ${error.message}`)
  return path
}

export async function downloadCommentsBlob(path: string): Promise<StoredComment[]> {
  splitAndValidatePath(path) // throws on tampering
  const sb = createServiceClient()
  const { data, error } = await sb.storage.from(BUCKET).download(path)
  if (error || !data) throw new Error(`downloadCommentsBlob: ${error?.message ?? "no data"}`)
  const text = await data.text()
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) throw new Error("not an array")
    return parsed as StoredComment[]
  } catch (e) {
    throw new Error(`downloadCommentsBlob parse: ${(e as Error).message}`)
  }
}

export async function deleteCommentsBlob(path: string): Promise<void> {
  try {
    splitAndValidatePath(path)
    const sb = createServiceClient()
    await sb.storage.from(BUCKET).remove([path])
  } catch (e) {
    console.warn("[storage] deleteCommentsBlob failed (swallowed)", { path, error: (e as Error).message })
  }
}
```

- [ ] **Step 4: Run test, verify passes**

Run: `pnpm vitest run src/lib/__tests__/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/storage.ts src/lib/__tests__/storage.test.ts
git commit -m "feat(tub-34): add storage helpers for comments blob (path-traversal hardened)"
```

### Task 1.4: Tier-aware TTL helper

**Files:**
- Modify: `src/lib/analyses.ts`
- Test: `src/lib/__tests__/analyses-tub34.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/__tests__/analyses-tub34.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { computeExpiresAt } from "@/lib/analyses"

describe("computeExpiresAt", () => {
  it("free = +30 days", () => {
    const now = new Date("2026-05-21T00:00:00Z")
    const got = computeExpiresAt(now, "free")
    expect(got.toISOString()).toBe("2026-06-20T00:00:00.000Z")
  })
  it("pro = +100 days", () => {
    const now = new Date("2026-05-21T00:00:00Z")
    const got = computeExpiresAt(now, "pro")
    expect(got.toISOString()).toBe("2026-08-29T00:00:00.000Z")
  })
})
```

- [ ] **Step 2: Run test, verify fails**

Run: `pnpm vitest run src/lib/__tests__/analyses-tub34.test.ts`
Expected: FAIL (export not found).

- [ ] **Step 3: Add helper and replace TTL constant**

Edit `src/lib/analyses.ts`. Replace the existing line:

```ts
const ANALYSES_TTL_MS = 30 * 24 * 60 * 60 * 1000
```

with:

```ts
const FREE_TTL_DAYS = 30
const PRO_TTL_DAYS = 100

export function computeExpiresAt(now: Date, tier: "free" | "pro"): Date {
  const days = tier === "pro" ? PRO_TTL_DAYS : FREE_TTL_DAYS
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
}
```

- [ ] **Step 4: Run test, verify passes**

Run: `pnpm vitest run src/lib/__tests__/analyses-tub34.test.ts`
Expected: PASS.

### Task 1.5: Extend AnalysisInsert with tier + comments; wire saveAnalysis

**Files:**
- Modify: `src/lib/analyses.ts`

- [ ] **Step 1: Extend types and saveAnalysis**

In `src/lib/analyses.ts`:

1. Add imports at top: `import { commentsBlobPath, uploadCommentsBlob } from "@/lib/supabase/storage"`, `import type { StoredComment } from "@/lib/comments"`.

2. Extend `AnalysisInsert`:

```ts
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
  tier: "free" | "pro"
  comments: StoredComment[]
}
```

3. Replace `saveAnalysis` body:

```ts
const COMMENTS_INLINE_THRESHOLD_BYTES = 5 * 1024 * 1024
const COMMENTS_HARD_MAX_BYTES = 45 * 1024 * 1024

export async function saveAnalysis(input: AnalysisInsert): Promise<void> {
  const sb = createServiceClient()
  const now = new Date()
  const expires = computeExpiresAt(now, input.tier)

  const serialized = JSON.stringify(input.comments)
  const size = Buffer.byteLength(serialized, "utf-8")
  if (size > COMMENTS_HARD_MAX_BYTES) {
    console.warn("[analyses] comments payload exceeds hard max, skipping persistence", {
      size,
      userId: input.userId,
      videoId: input.videoId,
    })
    return
  }
  const useBlob = size > COMMENTS_INLINE_THRESHOLD_BYTES
  let commentsJson: StoredComment[] | null
  let commentsBlobPathValue: string | null

  if (useBlob) {
    commentsBlobPathValue = commentsBlobPath(input.userId, input.videoId)
    commentsJson = null
  } else {
    commentsJson = input.comments
    commentsBlobPathValue = null
  }

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
      comments: commentsJson,
      comments_blob_path: commentsBlobPathValue,
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
    return
  }

  if (commentsBlobPathValue) {
    try {
      await uploadCommentsBlob(input.userId, input.videoId, serialized)
    } catch (e) {
      // Per spec §7: on blob upload failure with row already upserted, the row
      // points at a missing blob. Detail view shows comments_unavailable on
      // read. We log but do NOT roll back the row, because the live extract
      // response has already returned to the client; rolling back would leave
      // them with aggregates only and no cache reference. Accepted transient.
      console.warn("[analyses] blob upload failed after row upsert", {
        error: (e as Error).message,
        path: commentsBlobPathValue,
      })
    }
  }
}
```

- [ ] **Step 2: Add to AnalysisRow type**

Edit `AnalysisRow` in `src/lib/analyses.ts` (do NOT modify existing list query - listAnalyses must continue to NOT select comments):

```ts
export type AnalysisRow = {
  id: string
  user_id?: string // present when service-client SELECT includes it
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

// (Detail-row type with comments is defined in Task 1.6 as AnalysisDetailRow.
// Do not add a parallel AnalysisRowWithComments type here to avoid drift.)
```

- [ ] **Step 3: Confirm listAnalyses NEVER selects comments**

Open `src/lib/analyses.ts` and verify the existing `listAnalyses` `.select(...)` string excludes `comments` and `comments_blob_path`. Currently it selects:

```
"id, video_id, video_title, channel_name, thumbnail_url, comment_count, sentiment, top_words, emoji_frequency, processed_at, expires_at"
```

This is correct (no change needed). Add a code comment above the select line:

```ts
// IMPORTANT: never include `comments` or `comments_blob_path` here - TOAST
// decompression of multi-MB JSONB across every list render would crater perf.
// Use getAnalysisById for the single-row detail view that needs comments.
```

- [ ] **Step 4: Build to check types**

Run: `pnpm build`
Expected: SUCCESS. If TS errors about callers of `saveAnalysis`, defer fixing to Task 1.7 (extract route).

If new errors in `extract/route.ts` only: that's expected; move on (will be fixed in Task 1.7).

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyses.ts src/lib/__tests__/analyses-tub34.test.ts
git commit -m "feat(tub-34): tier-aware TTL + comments persistence in saveAnalysis"
```

### Task 1.6: getAnalysisById + extend purgeExpiredAnalyses

**Files:**
- Modify: `src/lib/analyses.ts`
- Test: `src/lib/__tests__/analyses-tub34.test.ts`

- [ ] **Step 1: Add getAnalysisById**

At the top of `src/lib/analyses.ts` add (if not already present):

```ts
import type { SupabaseClient } from "@supabase/supabase-js"
import { downloadCommentsBlob, deleteCommentsBlob } from "@/lib/supabase/storage"
import type { StoredComment } from "@/lib/comments"
```

Append to `src/lib/analyses.ts`:

```ts
export type AnalysisDetailRow = AnalysisRow & {
  comments: StoredComment[] | null
  comments_blob_path: string | null
}

export type GetAnalysisByIdResult =
  | { ok: true; row: AnalysisDetailRow }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "comments_unavailable"; row: AnalysisDetailRow }

/**
 * Load a single analysis for the detail view, including comments.
 *
 * CRITICAL: `userSb` MUST be the user-scoped client (from createClient()).
 * The row-level SELECT through RLS is the authorization gate. If RLS returns
 * nothing, blob fetch never runs. Passing a service client here would
 * silently expose cross-user comments.
 *
 * Returns a discriminated result so callers can distinguish:
 *  - row missing -> 404
 *  - row present but blob fetch failed -> 500 comments_unavailable
 *  - happy path -> 200 with comments attached
 */
export async function getAnalysisById(
  userSb: SupabaseClient,
  id: string,
): Promise<GetAnalysisByIdResult> {
  if (!UUID_RE.test(id)) return { ok: false, reason: "not_found" }
  const { data, error } = await userSb
    .from("analyses")
    .select(
      "id, video_id, video_title, channel_name, thumbnail_url, comment_count, sentiment, top_words, emoji_frequency, comments, comments_blob_path, processed_at, expires_at",
    )
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.warn("[analyses] getAnalysisById error", { error: error.message, id })
    return { ok: false, reason: "not_found" }
  }
  if (!data) return { ok: false, reason: "not_found" }
  const row = data as AnalysisDetailRow
  if (row.comments_blob_path && !row.comments) {
    try {
      row.comments = await downloadCommentsBlob(row.comments_blob_path)
    } catch (e) {
      console.warn("[analyses] blob download failed", {
        error: (e as Error).message,
        path: row.comments_blob_path,
      })
      row.comments = null
      return { ok: false, reason: "comments_unavailable", row }
    }
  }
  return { ok: true, row }
}
```

Note: `UUID_RE` is already declared at the top of `src/lib/analyses.ts` (existing) - reuse it. Do NOT add a `UUID_FULL_RE` alias.

- [ ] **Step 2: Extend purgeExpiredAnalyses to delete blobs**

Replace existing `purgeExpiredAnalyses` body:

```ts
export async function purgeExpiredAnalyses(): Promise<number> {
  const sb = createServiceClient()
  // Collect blob paths BEFORE deleting rows.
  const { data: expired, error: selErr } = await sb
    .from("analyses")
    .select("id, comments_blob_path")
    .lt("expires_at", new Date().toISOString())
  if (selErr) {
    console.warn("[analyses] cron list expired failed", { error: selErr.message })
    return 0
  }
  const blobPaths = (expired ?? [])
    .map((r) => (r as { comments_blob_path: string | null }).comments_blob_path)
    .filter((p): p is string => !!p)

  const { data, error } = await sb
    .from("analyses")
    .delete()
    .select("id")
    .lt("expires_at", new Date().toISOString())
  if (error) {
    console.warn("[analyses] cron purge failed", { error: error.message })
    return 0
  }
  // Best-effort blob cleanup. Orphans accepted per spec §5.3.
  await Promise.all(blobPaths.map((p) => deleteCommentsBlob(p)))
  return data?.length ?? 0
}
```

- [ ] **Step 3: Extend deleteAnalysis to clean up blob**

Find existing `deleteAnalysis` in `src/lib/analyses.ts`. Replace body:

```ts
export async function deleteAnalysis(
  sb: SupabaseClient,
  id: string,
): Promise<number> {
  const { data, error } = await sb
    .from("analyses")
    .delete()
    .select("id, comments_blob_path")
    .eq("id", id)

  if (error) {
    console.warn("[analyses] delete failed", { error: error.message, id })
    return 0
  }
  // Fire-and-forget blob cleanup if applicable.
  for (const row of data ?? []) {
    const path = (row as { comments_blob_path: string | null }).comments_blob_path
    if (path) void deleteCommentsBlob(path)
  }
  return data?.length ?? 0
}
```

- [ ] **Step 4: Build to check types**

Run: `pnpm build`
Expected: SUCCESS (or extract-route errors still pending Task 1.7).

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyses.ts
git commit -m "feat(tub-34): add getAnalysisById + blob cleanup on delete/purge"
```

### Task 1.7: Wire /api/extract to pass tier + comments

**Files:**
- Modify: `src/app/api/extract/route.ts`

- [ ] **Step 1: Read current saveAnalysis call site**

Open `src/app/api/extract/route.ts` and find the existing `saveAnalysis({ ... })` call (around line 266 per spec §4).

- [ ] **Step 2: Map Comment[] to StoredComment[] and pass userQuota.tier**

Recon-confirmed: in `src/app/api/extract/route.ts`, the save block lives inside `if (mode === "user" && userId && userQuota)`. The runtime `Comment` shape (per `src/lib/types.ts`) is `{ author: string; text: string; likes: number; publishedAt: string; replies: number; sentiment?: ... }`. The outer `tier` variable is `ExtractTier = "anonymous" | "free" | "pro"`, so use `userQuota.tier` (narrowed `"free" | "pro"`) for the save. `metaSnippet` is the variable holding video meta.

Add at the top of the file:

```ts
import type { StoredComment } from "@/lib/comments"
```

Inside the `if (mode === "user" && userId && userQuota)` block, right before the existing `await saveAnalysis({...})` call, build the StoredComment array and pass it through:

```ts
const storedComments: StoredComment[] = comments.map((c) => ({
  authorName: c.author ?? null,
  text: c.text,
  likes: c.likes,
  replies: c.replies,
  publishedAt: c.publishedAt,
  sentiment: c.sentiment ?? null,
}))

await saveAnalysis({
  userId,
  videoId,
  videoTitle: metaSnippet?.title ?? null,
  channelName: metaSnippet?.channelTitle ?? null,
  thumbnailUrl:
    metaSnippet?.thumbnails?.high?.url ??
    metaSnippet?.thumbnails?.medium?.url ??
    metaSnippet?.thumbnails?.default?.url ??
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  commentCount: comments.length,
  sentiment: sentimentAggregate,
  topWords: topWordsStored,
  emojiFrequency: emojiStored,
  tier: userQuota.tier,
  comments: storedComments,
})
```

This replaces the existing 13-line saveAnalysis call inside the try block (recon: lines 266-281). The added fields are `tier` and `comments`. Keep the surrounding try/catch warn intact.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/extract/route.ts
git commit -m "feat(tub-34): /api/extract passes tier + comments to saveAnalysis"
```

### Task 1.8: GET /api/analyses/[id]

**Files:**
- Modify: `src/app/api/analyses/[id]/route.ts`

- [ ] **Step 1: Add GET handler alongside existing DELETE**

In `src/app/api/analyses/[id]/route.ts`, the existing file already declares `UUID_RE` and imports `createClient`, `NextResponse`. Add the new import for `getAnalysisById`, then add the GET handler:

```ts
import { getAnalysisById } from "@/lib/analyses"
// UUID_RE is already declared at the top of this file (existing).
// createClient, NextResponse are already imported.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const result = await getAnalysisById(supabase, id)
  if (!result.ok && result.reason === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  if (!result.ok && result.reason === "comments_unavailable") {
    return NextResponse.json({ error: "comments_unavailable" }, { status: 500 })
  }
  const row = result.ok ? result.row : (result as never)
  const has_comments = row.comments != null || row.comments_blob_path != null
  return NextResponse.json({
    id: row.id,
    video_id: row.video_id,
    video_title: row.video_title,
    channel_name: row.channel_name,
    thumbnail_url: row.thumbnail_url,
    comment_count: row.comment_count,
    sentiment: row.sentiment,
    top_words: row.top_words,
    emoji_frequency: row.emoji_frequency,
    processed_at: row.processed_at,
    expires_at: row.expires_at,
    comments: row.comments,
    has_comments,
  })
}
```

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analyses/\[id\]/route.ts
git commit -m "feat(tub-34): add GET /api/analyses/[id]"
```

### Task 1.9: Cache branch of /api/export

**Files:**
- Modify: `src/app/api/export/route.ts`

- [ ] **Step 1: Read current schema and handler**

Read `src/app/api/export/route.ts`. The existing schema is `ExportRequestSchema` with `format: z.enum(["json", "xlsx"])`. We add a discriminated union with `mode`.

- [ ] **Step 2: Verify CSV serializer location**

Run: `rg -l "Content-Type.*text/csv|csv.*Content-Disposition" src/`. Note the file/function where CSV serialization for live extract currently lives (likely a client-side serializer in tubemine.tsx since /api/export only handles json+xlsx).

- [ ] **Step 3: Add mode-OPTIONAL schema (preserves spec §10 file contract)**

Critical design choice: rather than requiring `mode` on every request (which would force editing `src/components/tubemine.tsx` - forbidden by spec §10), make `mode` OPTIONAL with default `"extract"`. Existing callers (tubemine.tsx Save JSON/Excel) keep working unchanged. New cache callers explicitly send `mode: "cache"`.

Replace `ExportRequestSchema` block with:

```ts
const ExtractExportRequestSchema = z.object({
  mode: z.literal("extract").default("extract"),
  format: z.enum(["json", "xlsx"]),
  videoId: z.string().regex(/^[\w-]{11}$/),
  videoTitle: z.string().max(500).optional(),
  channelName: z.string().max(200).optional(),
  comments: z.array(CommentSchema).max(10_000),
})

const CacheExportRequestSchema = z.object({
  mode: z.literal("cache"),
  analysisId: z.string().uuid(),
  format: z.enum(["csv", "json", "xlsx"]),
})

// z.discriminatedUnion needs a literal discriminator; use z.union + manual
// discrimination because Extract's mode has a default which makes it not
// purely literal at the type level.
const RequestSchema = z.union([CacheExportRequestSchema, ExtractExportRequestSchema])
```

- [ ] **Step 4: Move Pro gate BELOW schema parse + skip for cache CSV (free-tier downloads work)**

Current code:

```ts
const quota = await getUserQuota(userId)
if (quota.tier !== "pro") {
  return NextResponse.json({ error: "Pro plan required ..." }, { status: 403 })
}

// ... json parse + zod parse later
```

Concretely, the new POST handler body up through the tier gate looks like this (replacing the existing top of the POST handler):

```ts
export async function POST(req: NextRequest) {
  const { userId } = await authUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }
  const data = parsed.data

  // Tier-gate per format (move BELOW schema parse so cache+csv works for Free):
  //   - cache + csv         : free OR pro (Free retention promise per pricing)
  //   - cache + json/xlsx   : pro only
  //   - extract + json/xlsx : pro only (existing behavior)
  const needsPro =
    (data.mode === "extract" && (data.format === "json" || data.format === "xlsx")) ||
    (data.mode === "cache" && (data.format === "json" || data.format === "xlsx"))

  if (needsPro) {
    const quota = await getUserQuota(userId)
    if (quota.tier !== "pro") {
      return NextResponse.json(
        { error: "Pro plan required for this export format" },
        { status: 403 },
      )
    }
  }

  // ... (Step 6 mode-branching code goes here)
}
```

- [ ] **Step 5: Add buildExportResponse helper (concrete body)**

Define the helper INLINE in the route file (do NOT extract to a separate module - keeps the route self-contained). Lift the existing JSON + xlsx branches verbatim, plus a new CSV branch:

```ts
async function buildExportResponse(
  format: "csv" | "json" | "xlsx",
  payload: {
    videoId: string
    videoTitle?: string
    channelName?: string
    comments: Array<{
      author: string
      text: string
      sentiment?: string
      likes: number
      replies: number
      publishedAt: string
    }>,
  },
): Promise<Response> {
  const filenameBase = `tubemine-${payload.videoId}-${todayUtc()}`

  if (format === "json") {
    const out = {
      videoId: payload.videoId,
      videoTitle: payload.videoTitle,
      channelName: payload.channelName,
      exported_at: new Date().toISOString(),
      comments: payload.comments,
    }
    return NextResponse.json(out, {
      headers: {
        "Content-Disposition": `attachment; filename="${filenameBase}.json"`,
      },
    })
  }

  if (format === "csv") {
    const header = ["Author", "Comment", "Sentiment", "Likes", "Replies", "Published"]
    const escape = (v: string | number) => {
      const s = String(v)
      // sanitizeForSpreadsheet prepends ' to formula-leading cells
      const safe = sanitizeForSpreadsheet(s)
      if (/["\n,]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
      return safe
    }
    const lines = [header.join(",")]
    for (const c of payload.comments) {
      lines.push(
        [
          escape(c.author),
          escape(c.text),
          escape(c.sentiment ?? ""),
          c.likes,
          c.replies,
          escape(c.publishedAt),
        ].join(","),
      )
    }
    const csv = lines.join("\n")
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    })
  }

  // format === "xlsx" - lift the existing ExcelJS block verbatim, but read
  // inputs from `payload` instead of locally-scoped vars. Existing block
  // starts at "const workbook = new ExcelJS.Workbook()" - move it here and
  // wire up returns.
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Comments")
  sheet.addRow(["Author", "Comment", "Sentiment", "Likes", "Replies", "Published"])
  const stringCols = [1, 2, 3, 6]
  for (const c of payload.comments) {
    const row = sheet.addRow([
      sanitizeForSpreadsheet(c.author),
      sanitizeForSpreadsheet(c.text),
      sanitizeForSpreadsheet(c.sentiment ?? ""),
      c.likes,
      c.replies,
      sanitizeForSpreadsheet(c.publishedAt),
    ])
    for (const col of stringCols) {
      row.getCell(col).numFmt = "@"
    }
  }
  const buffer = await workbook.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
    },
  })
}
```

- [ ] **Step 6: Branch on mode in POST handler**

The schema from Step 3 is already in place. Now replace the existing format-branching tail of the POST handler with the mode-aware version below. **Do NOT re-declare any schema; do NOT re-add imports already added in Step 3.** Just the handler logic:

```ts
// (Tier gate already applied above per Step 4.)
if (data.mode === "cache") {
  // Use the userId already resolved by authUserId() at the top of the
  // handler. Spawn a fresh user-scoped client for the row read so RLS
  // applies (authUserId() returns a bare userId; for SELECT under RLS we
  // need the cookie-bound supabase client).
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from("analyses")
    .select("video_id, video_title, channel_name, comments, comments_blob_path")
    .eq("id", data.analysisId)
    .maybeSingle()
  if (error || !row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  let comments: StoredComment[] | null = (row.comments as StoredComment[] | null) ?? null
  if (!comments && row.comments_blob_path) {
    try {
      comments = await downloadCommentsBlob(row.comments_blob_path as string)
    } catch (e) {
      console.warn("[export] cache blob download failed", { error: (e as Error).message })
      return NextResponse.json({ error: "comments_unavailable" }, { status: 500 })
    }
  }
  if (!comments) {
    return NextResponse.json({ error: "comments_not_stored" }, { status: 410 })
  }
  const exportComments = comments.map((c) => ({
    author: c.authorName ?? "",
    text: c.text,
    sentiment: c.sentiment ?? undefined,
    likes: c.likes,
    replies: c.replies ?? 0,
    publishedAt: c.publishedAt ?? "",
  }))
  return buildExportResponse(data.format, {
    videoId: row.video_id as string,
    videoTitle: (row.video_title as string | null) ?? undefined,
    channelName: (row.channel_name as string | null) ?? undefined,
    comments: exportComments,
  })
}

// data.mode === "extract" - reuse the helper with payload built from request.
return buildExportResponse(data.format, {
  videoId: data.videoId,
  videoTitle: data.videoTitle,
  channelName: data.channelName,
  comments: data.comments,
})
```

Imports to add at top of file: `import { createClient } from "@/lib/supabase/server"`, `import { downloadCommentsBlob } from "@/lib/supabase/storage"`, `import type { StoredComment } from "@/lib/comments"`.

- [ ] **Step 7: Build**

Run: `pnpm build`
Expected: SUCCESS. If `buildExportResponse` signature doesn't compile, inspect existing serializer code and adjust.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/export/route.ts
git commit -m "feat(tub-34): /api/export gains cache mode (zero-YT-quota export from cached comments)"
```

### Task 1.9b: Sanity-check existing export tests still pass

**Files:**
- Modify (optional): `src/app/api/export/__tests__/route.test.ts`

Because `mode` defaults to `"extract"` (Task 1.9 Step 3), the existing test bodies (which omit `mode`) should still pass the schema. Verify.

- [ ] **Step 1: Run existing export route tests**

```bash
pnpm vitest run src/app/api/export/__tests__/route.test.ts
```

Expected: PASS (no test changes needed). If a test fails because the Pro gate now happens AFTER schema parse, you may need to adjust an expected status code or test setup; address only on actual failure.

- [ ] **Step 2: Build**

```bash
pnpm build
```

Expected: SUCCESS.

- [ ] **Step 3: Commit (if any test changes)**

```bash
git add src/app/api/export/__tests__/route.test.ts
git commit -m "test(tub-34): adjust export route tests for new schema/gate order"
```

### Task 1.10: PR 1 verify-on-prod (BLOCKER)

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: Wait for Vercel deploy READY**

Use `mcp__vercel__list_deployments` filtered by recent commits; wait for status READY.

- [ ] **Step 3: Trigger a fresh extract on prod**

Via Chrome MCP: navigate to https://tubemine.tech (sign in if needed), run an extract on a small public video (~100 comments). Note the resulting analysis row id.

- [ ] **Step 4: Inspect row via Supabase MCP**

Run via `mcp__claude_ai_Supabase__execute_sql`:

```sql
select id, comment_count, comments is not null as has_inline, comments_blob_path is not null as has_blob,
       processed_at, expires_at,
       extract(day from (expires_at - processed_at)) as ttl_days
from public.analyses
order by processed_at desc
limit 3;
```

Assert: top row has either `has_inline=true` or `has_blob=true`. `ttl_days` matches the test account's tier (30 for free, 100 for pro).

- [ ] **Step 5: GET /api/analyses/[id]**

Via Chrome MCP authenticated tab, `fetch('/api/analyses/<id>')`. Assert 200 with `has_comments: true` and `comments` array length matching `comment_count`.

- [ ] **Step 6: DELETE /api/analyses/[id]**

`fetch('/api/analyses/<id>', { method: 'DELETE' })`. Assert `{ deleted: 1 }`. Re-query SQL: row gone. If `has_blob` was true, run `select count(*) from storage.objects where bucket_id = 'analyses-comments' and name like '%/<videoId>.json';` -> expect 0.

- [ ] **Step 7: RLS sanity check (BLOCKER)**

Document procedure:
- Create row as user A via the extract above.
- Sign in as user B (if test account available) OR use `mcp__claude_ai_Supabase__execute_sql` to set Postgres role to a second user manually.
- Confirm `GET /api/analyses/<A's id>` returns 404 from user B's session.
- Confirm `DELETE /api/analyses/<A's id>` returns `{ deleted: 0 }`.

If RLS fails -> stop, file critical bug, do NOT proceed to PR 2.

- [ ] **Step 8: Document verification in Linear**

Add a comment to TUB-34 via `mcp__claude_ai_Linear__save_comment`: PR 1 verified on prod, listing observed `has_inline` / `has_blob` / `ttl_days`, RLS check passed.

---

## PR 2: Detail view route `/history/:id`

### Task 2.1: Install @tanstack/react-virtual

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependency**

```bash
pnpm add @tanstack/react-virtual
```

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(tub-34): add @tanstack/react-virtual for comments table"
```

### Task 2.2: i18n keys (en + ru)

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Add history_detail namespace to en.json**

Append (or merge with existing top-level object) into `messages/en.json`:

```json
{
  "history_detail": {
    "title": "Analysis detail",
    "back_to_history": "Back to history",
    "processed_at_label": "Processed",
    "expires_at_label": "Expires",
    "comment_count_label": "comments",
    "download_csv": "Download CSV",
    "download_json": "Download JSON",
    "download_excel": "Download Excel",
    "delete": "Delete",
    "legacy_no_comments": "Comments aren't stored for analyses from before this update. Re-extract to view them.",
    "not_found_title": "Analysis not found",
    "not_found_body": "It may have expired or been deleted.",
    "back_to_history_link": "Back to history",
    "comments_table_heading": "Comments",
    "comments_table_empty": "No comments stored",
    "column_author": "Author",
    "column_text": "Comment",
    "column_sentiment": "Sentiment",
    "column_likes": "Likes",
    "column_published": "Published",
    "delete_pending": "Deleting {title}",
    "undo": "Undo",
    "undo_too_late": "Undo unavailable - delete already submitted",
    "export_failed_legacy": "Comments not stored for this analysis",
    "export_failed_transient": "Couldn't load cached comments - try again"
  }
}
```

- [ ] **Step 2: Add identical-shape RU translations to ru.json**

```json
{
  "history_detail": {
    "title": "Детали анализа",
    "back_to_history": "Назад к истории",
    "processed_at_label": "Обработано",
    "expires_at_label": "Истекает",
    "comment_count_label": "комментариев",
    "download_csv": "Скачать CSV",
    "download_json": "Скачать JSON",
    "download_excel": "Скачать Excel",
    "delete": "Удалить",
    "legacy_no_comments": "Для старых анализов комментарии не сохраняются. Переанализируйте, чтобы увидеть их.",
    "not_found_title": "Анализ не найден",
    "not_found_body": "Возможно, он истёк или был удалён.",
    "back_to_history_link": "Назад к истории",
    "comments_table_heading": "Комментарии",
    "comments_table_empty": "Комментарии не сохранены",
    "column_author": "Автор",
    "column_text": "Комментарий",
    "column_sentiment": "Тональность",
    "column_likes": "Лайки",
    "column_published": "Опубликовано",
    "delete_pending": "Удаляем {title}",
    "undo": "Отменить",
    "undo_too_late": "Отмена недоступна - удаление уже отправлено",
    "export_failed_legacy": "Комментарии не сохранены для этого анализа",
    "export_failed_transient": "Не удалось загрузить кешированные комментарии - попробуйте снова"
  }
}
```

- [ ] **Step 3: Run parity check**

```bash
node scripts/check-message-parity.mjs
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/ru.json
git commit -m "i18n(tub-34): add history_detail namespace (en + ru parity)"
```

### Task 2.3: CommentsTable virtualized component

**Files:**
- Create: `src/components/comments-table.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client"

import { useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useTranslations } from "next-intl"
import type { StoredComment } from "@/lib/comments"

export function CommentsTable({ comments }: { comments: StoredComment[] }) {
  const t = useTranslations("history_detail")
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: comments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  })

  if (comments.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("comments_table_empty")}</p>
  }

  return (
    <div className="mt-6 rounded-lg border">
      <div className="hidden grid-cols-[1fr_2fr_auto_auto_auto] gap-3 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
        <span>{t("column_author")}</span>
        <span>{t("column_text")}</span>
        <span>{t("column_sentiment")}</span>
        <span>{t("column_likes")}</span>
        <span>{t("column_published")}</span>
      </div>
      <div ref={parentRef} className="h-[600px] overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const c = comments[vi.index]
            return (
              <div
                key={vi.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vi.start}px)`,
                  height: vi.size,
                }}
                className="grid grid-cols-1 gap-2 border-b px-4 py-2 sm:grid-cols-[1fr_2fr_auto_auto_auto] sm:gap-3"
              >
                <span className="truncate text-xs font-medium" title={c.authorName ?? ""}>
                  {c.authorName ?? ""}
                </span>
                <span
                  className="line-clamp-2 text-xs text-foreground/90"
                  title={c.text}
                >
                  {c.text}
                </span>
                <span className="text-xs text-muted-foreground">{c.sentiment ?? "-"}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{c.likes}</span>
                <span className="text-xs text-muted-foreground">
                  {c.publishedAt ? new Date(c.publishedAt).toLocaleDateString() : ""}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add src/components/comments-table.tsx
git commit -m "feat(tub-34): virtualized CommentsTable (@tanstack/react-virtual)"
```

### Task 2.4: AnalysisDetailView client component

**Files:**
- Create: `src/components/analysis-detail-view.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client"

import { useEffect, useState } from "react"
import { track } from "@vercel/analytics"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useRouter } from "@/i18n/navigation"
import { TopWordsPanel } from "@/components/top-words"
import { CommentsTable } from "@/components/comments-table"
import { Button } from "@/components/ui/button"
import type { TopWord, EmojiFreq } from "@/lib/analyses"
import type { SentimentAggregate } from "@/lib/sentiment"

type Tier = "free" | "pro"

import type { AnalysisDetailRow } from "@/lib/analyses"

export type AnalysisDetailViewProps = {
  tier: Tier
  row: AnalysisDetailRow & { has_comments: boolean }
}

export function AnalysisDetailView({ tier, row }: AnalysisDetailViewProps) {
  const t = useTranslations("history_detail")
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    track("history_analysis_opened", { analysis_id_prefix: row.id.slice(0, 8), tier })
  }, [row.id, tier])

  async function download(format: "csv" | "json" | "xlsx") {
    if (!row.has_comments) return
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "cache", analysisId: row.id, format }),
      })
      if (res.status === 410) {
        toast.error(t("export_failed_legacy"))
        return
      }
      if (!res.ok) {
        toast.error(t("export_failed_transient"))
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${row.video_id}.${format === "xlsx" ? "xlsx" : format}`
      a.click()
      URL.revokeObjectURL(url)
      track("history_downloaded", { analysis_id_prefix: row.id.slice(0, 8), format })
    } catch {
      toast.error(t("export_failed_transient"))
    }
  }

  async function onDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/analyses/${row.id}`, { method: "DELETE" })
      if (res.ok) {
        track("history_deleted", { analysis_id_prefix: row.id.slice(0, 8) })
        router.replace("/history")
      } else {
        toast.error(t("export_failed_transient"))
        setDeleting(false)
      }
    } catch {
      toast.error(t("export_failed_transient"))
      setDeleting(false)
    }
  }

  const sentiment = row.sentiment as SentimentAggregate | null
  const topWords = (row.top_words ?? []) as TopWord[]
  const emojis = (row.emoji_frequency ?? []) as EmojiFreq[]

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start gap-4">
        {row.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.thumbnail_url} alt="" className="h-24 w-40 rounded object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{row.video_title ?? row.video_id}</h1>
          <p className="truncate text-sm text-muted-foreground">{row.channel_name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("processed_at_label")}: {new Date(row.processed_at).toLocaleString()}
            {" · "}
            {t("expires_at_label")}: {new Date(row.expires_at).toLocaleDateString()}
            {" · "}
            {row.comment_count} {t("comment_count_label")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!row.has_comments}
            onClick={() => download("csv")}
          >
            {t("download_csv")}
          </Button>
          {tier === "pro" && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={!row.has_comments}
                onClick={() => download("json")}
              >
                {t("download_json")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!row.has_comments}
                onClick={() => download("xlsx")}
              >
                {t("download_excel")}
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={deleting}>
            {t("delete")}
          </Button>
        </div>
      </div>

      {topWords.length > 0 && (
        <TopWordsPanel
          tier={tier === "pro" ? "pro" : "free"}
          items={topWords.map((w) => ({ word: w.token, count: w.count }))}
          totalUnique={topWords.length}
          commentsAnalyzed={row.comment_count}
        />
      )}

      {sentiment && (
        <div className="mt-6 rounded-lg border p-6">
          <h2 className="text-sm font-medium">Sentiment</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            +{sentiment.positive} / ={sentiment.neutral} / -{sentiment.negative}
          </p>
        </div>
      )}

      {emojis.length > 0 && (
        <div className="mt-6 rounded-lg border p-6">
          <h2 className="text-sm font-medium">Emoji frequency</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {emojis.slice(0, tier === "pro" ? emojis.length : 15).map((e) => (
              <li key={e.emoji} className="text-sm">
                {e.emoji} <span className="text-xs text-muted-foreground">{e.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mt-8 text-sm font-medium">{t("comments_table_heading")}</h2>
      {row.has_comments && row.comments ? (
        <CommentsTable comments={row.comments} />
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{t("legacy_no_comments")}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: SUCCESS. If imports of `TopWordsPanel` / `SentimentAggregate` / `Button` don't match actual exports, adjust accordingly.

- [ ] **Step 3: Commit**

```bash
git add src/components/analysis-detail-view.tsx
git commit -m "feat(tub-34): AnalysisDetailView client component (tier-aware, legacy-safe)"
```

### Task 2.5: /history/[id] server page + loading

**Files:**
- Create: `src/app/[locale]/(app)/history/[id]/page.tsx`
- Create: `src/app/[locale]/(app)/history/[id]/loading.tsx`

- [ ] **Step 1: page.tsx**

```tsx
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAnalysisById } from "@/lib/analyses"
import { AnalysisDetailView } from "@/components/analysis-detail-view"
import { getUserQuota } from "@/lib/quota"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const result = await getAnalysisById(supabase, id)
  if (!result.ok && result.reason === "not_found") {
    notFound()
  }
  // After the narrow above, result is { ok: true, row } OR
  // { ok: false, reason: "comments_unavailable", row }. Both shapes have `row`.
  const row = result.ok ? result.row : result.row
  const quota = await getUserQuota(user.id)
  // getUserQuota returns Tier ("free" | "pro"). The expression below is type-safe
  // but explicit for self-documentation: only "pro" gets Pro-tier rendering.
  const tier: "free" | "pro" = quota.tier === "pro" ? "pro" : "free"
  const has_comments = row.comments != null || row.comments_blob_path != null

  return <AnalysisDetailView tier={tier} row={{ ...row, has_comments }} />
}
```

Note: `getUserQuota` is the existing exported function in `src/lib/quota.ts` returning `{ tier, ... }`. Use it directly; do NOT rely on a `resolveEffectiveTier` helper.

- [ ] **Step 2: loading.tsx**

```tsx
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="h-24 w-full animate-pulse rounded bg-muted" />
      <div className="mt-6 h-32 animate-pulse rounded bg-muted" />
      <div className="mt-6 h-64 animate-pulse rounded bg-muted" />
    </div>
  )
}
```

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\[locale\]/\(app\)/history/\[id\]/
git commit -m "feat(tub-34): add /history/[id] detail route"
```

### Task 2.6: PR 2 verify-on-prod

- [ ] **Step 1: Push and wait deploy**

```bash
git push origin main
```

Wait for Vercel READY via `mcp__vercel__list_deployments`.

- [ ] **Step 2: Chrome MCP smoke**

Via Chrome MCP, navigate to `https://tubemine.tech/en/history/<id-from-PR1>`. Assert:
- Page renders without console errors
- Header card shows thumbnail, title, channel, processed_at, expires_at
- Top words / sentiment / emoji panels render
- Comments table renders rows; scroll works

- [ ] **Step 3: Network assertion - cached download**

Open DevTools Network tab. Click Download CSV. Assert: POST `/api/export` with `mode: "cache"` body; status 200; **NO** call to `/api/extract` or `youtube.googleapis.com`. Repeat for JSON and Excel if account is Pro.

- [ ] **Step 4: Mobile viewport**

Use `mcp__chrome-devtools__emulate` to resize to 375px. Verify no horizontal page scroll; comments table cards stack vertically.

- [ ] **Step 5: Legacy row check**

Via Supabase MCP, manually update one test row: `update public.analyses set comments = null, comments_blob_path = null where id = '<test-row>';`. Reload detail page. Assert: legacy placeholder text shown, Download buttons visually disabled, no JS error in console.

- [ ] **Step 6: Linear comment**

Add verification comment to TUB-34.

---

## PR 3: Unified AnalysesList + dashboard refactor + delete-with-undo

### Task 3.1: Empty state component

**Files:**
- Create: `src/components/empty-analyses-list.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client"

import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"

export function EmptyAnalysesList() {
  const t = useTranslations("dashboard")
  return (
    <div className="rounded-lg border p-6 text-center">
      <p className="text-sm text-muted-foreground">{t("empty")}</p>
      <Link href="/" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
        {t("start_extracting")}
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Add the `start_extracting` key to both message files (parity required)**

In `messages/en.json` under the existing `"dashboard"` namespace, add:

```json
"start_extracting": "Start extracting"
```

In `messages/ru.json` under `"dashboard"`:

```json
"start_extracting": "Начать извлечение"
```

Run: `node scripts/check-message-parity.mjs` -> expect PASS.

- [ ] **Step 2: Commit**

```bash
git add src/components/empty-analyses-list.tsx messages/en.json messages/ru.json
git commit -m "feat(tub-34): EmptyAnalysesList shared empty state"
```

### Task 3.2: AnalysesList unified component with delete-with-undo

**Files:**
- Create: `src/components/analyses-list.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { track } from "@vercel/analytics"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { EmptyAnalysesList } from "@/components/empty-analyses-list"
import type { AnalysisRow } from "@/lib/analyses"

type Tier = "free" | "pro"

export type AnalysesListProps = {
  initialItems: AnalysisRow[]
  initialCursor: string | null
  tier: Tier
  compact: boolean
  showActions: boolean
  paginated: boolean
  limit: number
}

type PendingDelete = { timer: ReturnType<typeof setTimeout>; committed: boolean; videoId: string }

export function AnalysesList({
  initialItems,
  initialCursor,
  tier,
  compact,
  showActions,
  paginated,
  limit,
}: AnalysesListProps) {
  const t = useTranslations("history_detail")
  const tDash = useTranslations("dashboard")
  const [items, setItems] = useState<AnalysisRow[]>(initialItems)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [loading, setLoading] = useState(false)
  const pendingRef = useRef<Map<string, PendingDelete>>(new Map())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    function onSaved(e: Event) {
      const detail = (e as CustomEvent<{ videoId: string }>).detail
      if (!detail) return
      for (const [id, entry] of pendingRef.current) {
        if (entry.videoId === detail.videoId && !entry.committed) {
          clearTimeout(entry.timer)
          pendingRef.current.delete(id)
          setPendingIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        }
      }
    }
    window.addEventListener("tubemine:analysis-saved", onSaved as EventListener)
    return () => {
      window.removeEventListener("tubemine:analysis-saved", onSaved as EventListener)
      // Unmount: clear all pending timers WITHOUT firing DELETE (Gmail-style).
      for (const entry of pendingRef.current.values()) clearTimeout(entry.timer)
      pendingRef.current.clear()
    }
  }, [])

  const visible = items.filter((it) => !pendingIds.has(it.id))

  if (!showActions) {
    if (visible.length === 0) {
      return <EmptyAnalysesList />
    }
    return (
      <div className="rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{tDash("recent_analyses_heading")}</h2>
          <Link href="/history" className="text-sm text-muted-foreground hover:underline">
            {tDash("view_all")}
          </Link>
        </div>
        <ul className="mt-4 space-y-3">
          {visible.slice(0, limit).map((it) => (
            <li key={it.id}>
              <Link
                href={`/history/${it.id}`}
                className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50"
              >
                {it.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.thumbnail_url}
                    alt=""
                    className="h-12 w-20 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {it.video_title ?? it.video_id}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {it.channel_name} · {it.comment_count} comments
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (visible.length === 0) {
    return <EmptyAnalysesList />
  }

  async function loadMore() {
    if (!cursor || loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/analyses?cursor=${encodeURIComponent(cursor)}&limit=${limit}`)
      if (res.ok) {
        const data = (await res.json()) as { items: AnalysisRow[]; nextCursor: string | null }
        setItems((prev) => [...prev, ...data.items])
        setCursor(data.nextCursor)
      }
    } finally {
      setLoading(false)
    }
  }

  function scheduleDelete(it: AnalysisRow) {
    if (pendingRef.current.has(it.id)) return
    setPendingIds((prev) => new Set(prev).add(it.id))
    const timer = setTimeout(async () => {
      const entry = pendingRef.current.get(it.id)
      if (!entry) return
      entry.committed = true
      try {
        await fetch(`/api/analyses/${it.id}`, { method: "DELETE" })
        track("history_deleted", { analysis_id_prefix: it.id.slice(0, 8) })
      } finally {
        pendingRef.current.delete(it.id)
      }
    }, 5000)
    pendingRef.current.set(it.id, { timer, committed: false, videoId: it.video_id })
    toast(t("delete_pending", { title: it.video_title ?? it.video_id }), {
      action: { label: t("undo"), onClick: () => undoDelete(it.id) },
      duration: 5000,
    })
  }

  function undoDelete(id: string) {
    const entry = pendingRef.current.get(id)
    if (!entry) return
    if (entry.committed) {
      toast.error(t("undo_too_late"))
      return
    }
    clearTimeout(entry.timer)
    pendingRef.current.delete(id)
    setPendingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    track("history_delete_undone", { analysis_id_prefix: id.slice(0, 8) })
  }

  async function download(it: AnalysisRow, format: "csv" | "json" | "xlsx") {
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "cache", analysisId: it.id, format }),
      })
      if (res.status === 403) {
        // Tier downgrade mid-session: server says Pro required for this format.
        toast.error(t("export_failed_transient"))
        return
      }
      if (!res.ok) {
        toast.error(t("export_failed_transient"))
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${it.video_id}.${format === "xlsx" ? "xlsx" : format}`
      a.click()
      URL.revokeObjectURL(url)
      track("history_downloaded", { analysis_id_prefix: it.id.slice(0, 8), format })
    } catch {
      toast.error(t("export_failed_transient"))
    }
  }

  return (
    <ul className="space-y-3">
      {visible.map((it) => (
        <li key={it.id} className="flex items-center gap-3 rounded-lg border p-3">
          <Link href={`/history/${it.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            {it.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.thumbnail_url} alt="" className="h-12 w-20 rounded object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{it.video_title ?? it.video_id}</p>
              <p className="truncate text-xs text-muted-foreground">
                {it.channel_name} · {it.comment_count} comments
              </p>
            </div>
          </Link>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => download(it, "csv")}>
              {t("download_csv")}
            </Button>
            {tier === "pro" && (
              <>
                <Button variant="outline" size="sm" onClick={() => download(it, "json")}>
                  {t("download_json")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => download(it, "xlsx")}>
                  {t("download_excel")}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => scheduleDelete(it)}>
              {t("delete")}
            </Button>
          </div>
        </li>
      ))}
      {paginated && cursor && (
        <li className="text-center">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
            Load more
          </Button>
        </li>
      )}
    </ul>
  )
}
```

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add src/components/analyses-list.tsx
git commit -m "feat(tub-34): unified AnalysesList with delete-with-undo"
```

### Task 3.3: (REMOVED) Rapid re-extract during pending delete

Spec §10 forbids touching `src/components/tubemine.tsx`. The rapid-re-extract data-loss guard (custom event dispatch from extract success) cannot be wired without modifying tubemine.tsx. Documented in spec §5.3 as an accepted MVP limitation: very low likelihood (user must delete from /history, navigate to dashboard, and re-extract same video within 5s). The AnalysesList `tubemine:analysis-saved` event listener remains harmless dead code that will activate when this guard ships in a follow-up PR.

No tasks here. Skip to Task 3.4.

### Task 3.4: Bump dashboard recent block from 5 to 10 items (in-place)

**Files:**
- Modify: `src/app/[locale]/(app)/dashboard/page.tsx`

Recon-confirmed: `RecentAnalyses` (the existing component in `src/components/recent-analyses.tsx`) is unused dead code. The dashboard page inlines its own `.recent-list` markup at lines 186-225+, fetching 5 items via `listAnalyses(supabase, null, 5)`. To honor spec §5.15 (dashboard shows 10 items with no action buttons, view-all link works) WITHOUT destroying the existing `.recent-row` design system, change only the limit number.

- [ ] **Step 1: Bump fetch limit**

In `src/app/[locale]/(app)/dashboard/page.tsx` line ~70, change:

```ts
listAnalyses(supabase, null, 5),
```

to:

```ts
listAnalyses(supabase, null, 10),
```

- [ ] **Step 2: Confirm recent rows link to /history/:id**

Verify the existing dashboard `.recent-row` markup wraps each row in a link to `/history/${item.id}` (use the i18n `<Link>` from `@/i18n/navigation`). If not already linked, wrap each `<article>` content in a `<Link href={`/history/${item.id}`}>`. This makes dashboard rows navigable into the detail view per spec §5.13 "Click row navigates via Next.js Link to /history/:id".

If the existing markup already navigates somewhere else (e.g. opens the YT video URL), keep that behavior on the thumbnail / external-link affordance but add a separate row-area click target that navigates to /history/:id. Keep changes minimal; do not redesign the row.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add 'src/app/[locale]/(app)/dashboard/page.tsx'
git commit -m "feat(tub-34): dashboard recent block bumped 5->10 + links to /history/:id"
```

Note: the unused `src/components/recent-analyses.tsx` is left untouched (dead code; cleanup is out of scope). The new `<AnalysesList>` component still ships from Task 3.2 and is consumed by /history page (Task 3.5 in-place changes integrate the same patterns).

### Task 3.5: Add new actions in-place to existing history-client (preserve visual port)

**Files:**
- Modify: `src/app/[locale]/(app)/history/history-client.tsx`

`history-client.tsx` is 1007 lines of locked-in TUB-1 visual-port markup (.history-row / .history-table / .empty-state-card / tm-toast-host classes). Wholesale replacement with `<AnalysesList>` would destroy the design port. Instead, **add the new behaviors in-place** to the existing component, leaving the visual structure intact. The `<AnalysesList>` unified component shipped in Task 3.2 is used for the DASHBOARD recent block only (Task 3.4); the /history page gets minimal in-place additions here.

Scope of in-place changes:
1. Add a "Detail" row link target so clicking any history row navigates to `/history/:id`.
2. Add per-row Download menu (CSV for all, +JSON/+Excel for Pro) that POSTs `/api/export` with `mode: "cache"`.
3. Add delete-with-undo logic: 5s `setTimeout` + Sonner toast + committed-flag race guard + unmount clear-and-drop. Reuse the same pattern as `<AnalysesList>` (Task 3.2) but inline into history-client.

- [ ] **Step 1: Read the existing row-render block**

Open `src/app/[locale]/(app)/history/history-client.tsx`. Locate the `.history-row` render block (likely inside a `.map(item => ...)` over `items`). Identify the exact JSX node for one row.

- [ ] **Step 2: Wrap row in /history/:id link**

If the row is not already wrapped in a Next-i18n `<Link href={`/history/${item.id}`}>`, wrap it (or wrap the thumbnail+title sub-block; not the action buttons). Use the `Link` from `@/i18n/navigation`.

- [ ] **Step 3: Add action buttons**

Inside each `.history-row` (next to existing controls, or in a new `.history-row__actions` cluster), add:

```tsx
<button
  type="button"
  className="tm-action-btn"
  onClick={() => downloadFromCache(item, "csv")}
>
  {t("download_csv")}
</button>
{tier === "pro" && (
  <>
    <button type="button" className="tm-action-btn" onClick={() => downloadFromCache(item, "json")}>
      {t("download_json")}
    </button>
    <button type="button" className="tm-action-btn" onClick={() => downloadFromCache(item, "xlsx")}>
      {t("download_excel")}
    </button>
  </>
)}
<button type="button" className="tm-action-btn tm-action-btn--ghost" onClick={() => scheduleDelete(item)}>
  {t("delete")}
</button>
```

`t` comes from `useTranslations("history_detail")` (add the import + hook call near the top of the component).

- [ ] **Step 4: Add delete-with-undo + download helpers**

Inside the existing HistoryClient component body, add (mirroring Task 3.2 pattern):

```ts
type PendingDelete = { timer: ReturnType<typeof setTimeout>; committed: boolean; videoId: string }
const pendingRef = useRef<Map<string, PendingDelete>>(new Map())
const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
const t = useTranslations("history_detail")

useEffect(() => {
  return () => {
    for (const entry of pendingRef.current.values()) clearTimeout(entry.timer)
    pendingRef.current.clear()
  }
}, [])

function scheduleDelete(item: AnalysisRow) {
  if (pendingRef.current.has(item.id)) return
  setPendingIds((prev) => new Set(prev).add(item.id))
  const timer = setTimeout(async () => {
    const entry = pendingRef.current.get(item.id)
    if (!entry) return
    entry.committed = true
    try {
      await fetch(`/api/analyses/${item.id}`, { method: "DELETE" })
      track("history_deleted", { analysis_id_prefix: item.id.slice(0, 8) })
    } finally {
      pendingRef.current.delete(item.id)
    }
  }, 5000)
  pendingRef.current.set(item.id, { timer, committed: false, videoId: item.video_id })
  toast(t("delete_pending", { title: item.video_title ?? item.video_id }), {
    action: { label: t("undo"), onClick: () => undoDelete(item.id) },
    duration: 5000,
  })
}

function undoDelete(id: string) {
  const entry = pendingRef.current.get(id)
  if (!entry) return
  if (entry.committed) {
    toast.error(t("undo_too_late"))
    return
  }
  clearTimeout(entry.timer)
  pendingRef.current.delete(id)
  setPendingIds((prev) => {
    const next = new Set(prev)
    next.delete(id)
    return next
  })
  track("history_delete_undone", { analysis_id_prefix: id.slice(0, 8) })
}

async function downloadFromCache(item: AnalysisRow, format: "csv" | "json" | "xlsx") {
  try {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "cache", analysisId: item.id, format }),
    })
    if (!res.ok) {
      toast.error(t("export_failed_transient"))
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${item.video_id}.${format === "xlsx" ? "xlsx" : format}`
    a.click()
    URL.revokeObjectURL(url)
    track("history_downloaded", { analysis_id_prefix: item.id.slice(0, 8), format })
  } catch {
    toast.error(t("export_failed_transient"))
  }
}
```

Add imports at top of file: `import { useRef, useState, useEffect } from "react"`, `import { useTranslations } from "next-intl"`, `import { toast } from "sonner"`, `import { track } from "@vercel/analytics"`, `import { Link } from "@/i18n/navigation"` (if not already present).

- [ ] **Step 5: Filter pendingIds from rendered items**

Locate the `items.map((item) => ...)` block. Wrap with a filter:

```ts
items.filter((item) => !pendingIds.has(item.id)).map((item) => ...)
```

This implements optimistic-remove.

- [ ] **Step 6: Build**

```bash
pnpm build
```

Expected: SUCCESS. If TypeScript errors in unrelated parts of history-client.tsx surface (the file is 1007 lines), fix only ones caused by the new imports/identifiers. Pre-existing issues are out of scope.

- [ ] **Step 7: Commit**

```bash
git add src/app/\[locale\]/\(app\)/history/history-client.tsx
git commit -m "refactor(tub-34): history page adds delete-with-undo + cache export inline (preserves visual port)"
```

### Task 3.6: PR 3 verify-on-prod

- [ ] **Step 1: Push + wait deploy**

```bash
git push origin main
```

Wait for Vercel READY.

- [ ] **Step 2: Dashboard recent block**

Chrome MCP -> https://tubemine.tech (signed in). Confirm:
- Recent analyses block shows up to 10 entries
- NO action buttons next to rows
- "View all" link points to /history

- [ ] **Step 3: History page**

Navigate to /history. Confirm:
- Full list with Download CSV + Delete buttons per row
- Pro tier: also JSON + Excel buttons
- Clicking a row navigates to /history/:id

- [ ] **Step 4: Delete-with-undo**

Click Delete on one row. Confirm:
- Row vanishes immediately
- Sonner toast with Undo appears
- Network panel: NO DELETE call yet
- Click Undo within 5s: row restored, NO DELETE call ever fired
- Click Delete again, wait 5s without undo: NOW DELETE fires; row stays gone

- [ ] **Step 5: (Skipped) Re-extract during pending delete**

This guard was dropped per Task 3.3 (spec §10 forbids touching tubemine.tsx to dispatch the saved-event). Documented as MVP limitation in spec §5.3. No verification step here.

- [ ] **Step 6: Linear comment**

Add verification comment to TUB-34.

---

## PR 4: Polish (i18n parity, analytics, tests, vault, playbook)

### Task 4.1: Analytics events allowlist (if it exists)

- [ ] **Step 1: Locate analytics event allowlist (if any)**

Run:

```bash
rg -l "history_analysis_opened|track\\(" src/ --type=ts --type=tsx | head
rg -l "analytics.*parity|allowlist.*event" src/ tests/ 2>/dev/null
```

If a file like `src/__tests__/analytics-i18n-parity.test.ts` or a similar allowlist exists, add the four new event names: `history_analysis_opened`, `history_downloaded`, `history_deleted`, `history_delete_undone`.

If no such file exists (recon-confirmed: it does not at time of plan-writing), skip this task. The new `track(...)` calls are already in place from PRs 2-3, and `@vercel/analytics` does not require a whitelist.

- [ ] **Step 2: Commit (only if changes made)**

```bash
git add <file>
git commit -m "test(tub-34): add new history analytics events to allowlist"
```

Otherwise: no commit; task is a no-op.

### Task 4.2: AnalysesList component test

**Files:**
- Create: `src/components/__tests__/analyses-list.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { AnalysesList } from "@/components/analyses-list"
import type { AnalysisRow } from "@/lib/analyses"

// Stub all client-only deps so the component renders in jsdom without
// requiring NextIntlClientProvider or app router context.
vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}))
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock("sonner", () => ({
  toast: Object.assign(() => {}, { error: () => {} }),
}))
vi.mock("@vercel/analytics", () => ({ track: () => {} }))

const sample: AnalysisRow = {
  id: "11111111-1111-1111-1111-111111111111",
  video_id: "dQw4w9WgXcQ",
  video_title: "Test video",
  channel_name: "Test channel",
  thumbnail_url: null,
  comment_count: 42,
  sentiment: null,
  top_words: null,
  emoji_frequency: null,
  processed_at: "2026-05-21T00:00:00Z",
  expires_at: "2026-06-20T00:00:00Z",
}

describe("AnalysesList", () => {
  it("compact mode renders without action buttons", () => {
    render(
      <AnalysesList
        initialItems={[sample]}
        initialCursor={null}
        tier="free"
        compact={true}
        showActions={false}
        paginated={false}
        limit={10}
      />,
    )
    expect(screen.getByText("Test video")).toBeInTheDocument()
    expect(screen.queryByText(/download/i)).toBeNull()
  })
  it("full mode renders Delete and Download for Free", () => {
    render(
      <AnalysesList
        initialItems={[sample]}
        initialCursor={null}
        tier="free"
        compact={false}
        showActions={true}
        paginated={false}
        limit={20}
      />,
    )
    expect(screen.getByText("download_csv")).toBeInTheDocument()
    expect(screen.queryByText("download_json")).toBeNull()
  })
  it("full mode for Pro renders JSON + Excel too", () => {
    render(
      <AnalysesList
        initialItems={[sample]}
        initialCursor={null}
        tier="pro"
        compact={false}
        showActions={true}
        paginated={false}
        limit={20}
      />,
    )
    expect(screen.getByText("download_json")).toBeInTheDocument()
    expect(screen.getByText("download_excel")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test**

Run: `pnpm vitest run src/components/__tests__/analyses-list.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/__tests__/analyses-list.test.tsx
git commit -m "test(tub-34): AnalysesList compact + full + Pro rendering"
```

### Task 4.3: Vault QA test cases (TC-HISTORY cluster)

- [ ] **Step 1: Append to test-cases.md via Obsidian MCP**

Use `mcp__obsidian__patch_note` on `projects/yt-comments/qa/test-cases.md` (append mode):

```markdown
## TC-HISTORY cluster (TUB-34, added 2026-05-21)

- **TC-HISTORY-001:** `/history/:id` loads stored aggregates + comments without `/api/extract` YT call.
  *Repro:* sign in, visit `/history/<id>` for a row created post-TUB-34. Network panel: no `/api/extract`, no `youtube.googleapis.com`. All four panels (top words, sentiment, emoji, comments table) render.

- **TC-HISTORY-002:** Download CSV from history view uses cached comments.
  *Repro:* on `/history/<id>`, click Download CSV. Network panel: POST `/api/export` body has `mode: "cache"`; NO `/api/extract` call; CSV downloads successfully.

- **TC-HISTORY-003:** Tier-aware Download buttons.
  *Repro:* Free tier sees only Download CSV button. Pro tier sees CSV + JSON + Excel. Matches live extract view tier matrix.

- **TC-HISTORY-004:** Delete-with-undo.
  *Repro:* on `/history`, click Delete on a row. Row vanishes immediately; Sonner toast with Undo shows. Network: NO DELETE call yet. Click Undo within 5s -> row restored; NO DELETE ever fired. Re-test with no undo: after 5s, DELETE call fires; row stays gone on reload.

- **TC-HISTORY-005:** Legacy row placeholder.
  *Repro:* on a row with `comments IS NULL AND comments_blob_path IS NULL`, visit `/history/<id>`. Comments table area shows the legacy placeholder; Download buttons are disabled (`aria-disabled`); no JS error.

- **TC-HISTORY-006:** Tier-aware TTL.
  *Repro:* Free user extracts -> row `expires_at - processed_at` ≈ 30 days. Pro user extracts -> ≈ 100 days. Verify via SQL.

- **TC-HISTORY-007:** Unified AnalysesList contexts.
  *Repro:* Dashboard recent block (compact) shows up to 10 rows with no action buttons. /history (full) shows action buttons. Same row markup base, conditional rendering.

- **TC-HISTORY-008:** Virtualized comments table smoke.
  *Repro:* render `<CommentsTable>` with a synthetic 2K-row mock fixture (component test or dev fixture). Scroll: smooth, no console errors, DOM node count in low hundreds. Real 50K stress deferred to user-reported jank.

- **TC-HISTORY-009:** Mobile detail view.
  *Repro:* Chrome MCP `emulate(375x812)`. Detail view: no horizontal page scroll. Comments table cards stack one per row.

- **TC-HISTORY-010:** RLS isolation.
  *Repro:* Sign in as user A, create row. Sign in as user B (or set Postgres role). `GET /api/analyses/<A's id>` returns 404. `DELETE /api/analyses/<A's id>` returns `{deleted: 0}`. `POST /api/export {mode: "cache", analysisId: <A's id>}` returns 404.
```

- [ ] **Step 2: Confirm written**

Use `mcp__obsidian__read_note` on the same path; verify TC-HISTORY entries present.

### Task 4.4: Playbook cluster 10

- [ ] **Step 1: Append cluster 10 to playbook**

Use `mcp__obsidian__patch_note` on `playbooks/saas-roadmap/13-qa-user-flows-and-test-cases.md`:

```markdown
## Mandatory TC cluster 10: Cached analysis storage + history detail

Applies to any SaaS that ships a history page with cached per-record data and tier-aware exports. Trigger this cluster when:
- A history list of past records gains a detail view route
- Re-export from cache is added
- Tier-aware retention TTLs are introduced

Mandatory TCs (use TC-HISTORY-NNN pattern):
- 001 Cached detail load (no upstream API call)
- 002 Re-export from cache (no upstream API call)
- 003 Tier-aware action buttons match live view
- 004 Optimistic delete with undo (no API call during window)
- 005 Legacy row placeholder (graceful null handling)
- 006 Tier-aware TTL in expires_at
- 007 Unified list component across contexts
- 008 Virtualized list smoke (large-N scroll)
- 009 Mobile detail responsive (no horizontal scroll)
- 010 RLS isolation across users

Reference implementation: TubeMine TUB-34 (2026-05-21).
```

### Task 4.5: PR 4 verify-on-prod + Linear close

- [ ] **Step 1: Push + wait deploy**

```bash
git push origin main
```

Wait for Vercel READY.

- [ ] **Step 2: Run all TC-HISTORY-* on prod**

Walk through TC-001..010 via Chrome MCP + Supabase MCP. Note any failures.

- [ ] **Step 3: i18n RU spot-check**

Switch to RU locale (`/ru/history` and `/ru/history/<id>`). Verify all new strings render in Russian without keys leaking.

- [ ] **Step 4: Analytics spot-check**

Open Vercel Analytics dashboard; trigger `history_analysis_opened`, `history_downloaded`, `history_deleted` events. Verify they land in the dashboard within ~1 min.

- [ ] **Step 5: Linear close**

Add closing comment to TUB-34 via `mcp__claude_ai_Linear__save_comment` summarizing all commit SHAs, TC-HISTORY status, and any deferred items. Then update issue to state "Done":

```
mcp__claude_ai_Linear__save_issue({ id: "TUB-34", state: "Done" })
```

- [ ] **Step 6: Update daily note**

Append session summary block to `~/vault/daily/2026-05-21.md` via Obsidian MCP (template per ~/.claude/CLAUDE.md daily-notes section).

---

## Verification: spec coverage checklist

After all 4 PRs ship, verify every spec section has at least one task:

- §5.1 Migration -> Task 1.1
- §5.2 Tier-aware TTL -> Task 1.4
- §5.3 Comments persistence + blob -> Tasks 1.2, 1.3, 1.5
- §5.4 Read paths (getAnalysisById) -> Task 1.6
- §5.5 API surface (GET + export cache mode) -> Tasks 1.8, 1.9
- §5.6 RLS sanity check -> Task 1.10 step 7
- §5.7 PR 1 tests -> Tasks 1.3, 1.4 (units), Task 1.10 (integration on prod)
- §5.9 Detail route files -> Tasks 2.4, 2.5
- §5.10 Legacy row handling -> Task 2.4 (has_comments guard in onClick + disabled state)
- §5.11 i18n keys -> Task 2.2
- §5.12 PR 2 verify -> Task 2.6
- §5.13 AnalysesList component -> Task 3.2
- §5.14 Delete-with-undo + committed flag -> Task 3.2
- §5.15 Refactor consumers -> Tasks 3.4, 3.5
- §5.16 PR 3 verify -> Task 3.6
- §5.17 i18n parity -> enforced by build (`check-message-parity.mjs`) at Task 2.2
- §5.18 Analytics events -> Task 4.1
- §5.19 Tests -> Tasks 4.1, 4.2
- §5.20 Vault + playbook -> Tasks 4.3, 4.4
- §5.21 PR 4 verify -> Task 4.5
