# TUB-34: Recent analyses + History overhaul (cache comments, instant return, unified view)

**Status:** Design
**Linear:** TUB-34
**Date:** 2026-05-21
**Author:** turbo-pipeline

## 1. Problem

User feedback (2026-05-21): "история сейчас бесполезный, ничего не дает юзеру". The /history page shows past extractions with metadata only. Users cannot:

1. Re-open past analytics (top words, sentiment, emojis, comments table)
2. Re-download CSV/JSON/Excel from cached data (must re-extract = wastes YT quota)
3. View comment-by-comment data without re-extracting

Dashboard "Recent analyses" block has zero actions. /history page has limited actions. No detail view exists. Aggregates (top_words, sentiment, emoji_frequency) ARE already persisted in the `analyses` table, but per-comment data is NOT. Re-viewing a past analysis today requires re-running extraction = burns YT Data API quota and wastes time.

## 2. Goals

1. Cache per-comment data so re-view + re-export are instant + zero YT quota
2. Add `/history/:id` detail view route (deep-linkable, back-button-friendly)
3. Unify Dashboard recent block and /history page through one `<AnalysesList>` component
4. Tier-aware retention TTL (Free 30 days, Pro 100 days) and tier-aware actions (Free=CSV; Pro=CSV+JSON+Excel)
5. Delete-with-undo (5s Sonner window, no actual API call until window closes)
6. Virtualize comments table to handle 50K-row Pro extracts without DOM bloat

## 3. Non-goals (deferred)

- Re-analyze action (refresh from YT, replaces cached row): V2, separate Linear issue
- Public sharing of analyses (deep-link to anonymous user): V3
- Bulk delete: V2
- Full-text search within stored comments JSONB: V3
- Storage cost dashboard for user: V2
- Compressed JSON storage (pg compression beyond TOAST defaults): defer until storage pain is real
- Migration of existing legacy rows (comments IS NULL): placeholder in UI, no backfill
- Anonymous tier history: anon has no history at all (no rows saved)

## 4. Current state

DB `public.analyses` (per `supabase/migrations/01_analyses.sql`) stores:

- `id uuid PRIMARY KEY`
- `user_id uuid REFERENCES auth.users ON DELETE CASCADE`
- `video_id text`, `video_title text`, `channel_name text`, `thumbnail_url text`, `comment_count int`
- `sentiment jsonb`, `top_words jsonb`, `emoji_frequency jsonb`
- `processed_at timestamptz`, `expires_at timestamptz` (default `now() + 30 days`)
- UNIQUE `(user_id, video_id)`
- RLS: SELECT and DELETE policies on `auth.uid() = user_id`. No INSERT/UPDATE policies = service-role only writes.

`saveAnalysis` (server-only, `src/lib/analyses.ts`) computes `expires_at` via `ANALYSES_TTL_MS = 30 * 24 * 3600 * 1000` constant. Upserts on `(user_id, video_id)`. Uses service client.

`deleteAnalysis(sb, id)` exists; idempotent (returns 0 row count if not found or not owned). RLS enforces ownership.

`/api/analyses/[id]/route.ts` exists with `DELETE` only. No `GET` endpoint yet.

`TopWordsPanel` (`src/components/top-words.tsx`) already implements tier-aware pagination (Pro `PRO_INITIAL_CAP=30` + expand toggle, Free shows all received items). Reuse directly in detail view.

`RecentAnalyses` (`src/components/recent-analyses.tsx`) is a server component fetching 5 items via `listAnalyses(supabase, null, 5)`. No action buttons. Has thumbnail + sentiment qualitative/quantitative split by tier. **Intentional UX change in PR 3:** the dashboard recent block expands from 5 to 10 items to give users more visible history at a glance without scrolling, while still keeping the "View all" link to /history.

## 5. Phased delivery (4 sequential PRs)

Each PR ships to main, deploys to Vercel, gets verified on prod via Chrome MCP, then next PR begins. No mega-PR.

### PR 1: Backend (DB migration + tier-aware TTL + comments persistence + reads + writes)

#### 5.1 New DB migration `supabase/migrations/03_analyses_comments.sql`

```sql
alter table public.analyses
  add column if not exists comments jsonb,
  add column if not exists comments_blob_path text;
```

Both columns nullable. No backfill of existing rows. RLS already covers them transitively (column-level inherits row policy).

No new RLS policies needed: existing `users read own analyses` covers SELECT of new columns; existing `users delete own analyses` covers DELETE; INSERT/UPDATE remain service-role only.

#### 5.2 Tier-aware TTL

Replace `ANALYSES_TTL_MS` constant with a function:

```ts
// src/lib/analyses.ts
const FREE_TTL_DAYS = 30
const PRO_TTL_DAYS = 100

export function computeExpiresAt(now: Date, tier: "free" | "pro"): Date {
  const days = tier === "pro" ? PRO_TTL_DAYS : FREE_TTL_DAYS
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
}
```

`saveAnalysis` accepts `tier: "free" | "pro"` in its `AnalysisInsert` type and calls `computeExpiresAt(now, tier)`. Caller (`/api/extract/route.ts`) already resolves effective tier for quota checks; passes through.

Existing rows keep their current `expires_at`. New saves use new TTL. No backfill.

**Tier change mid-window (explicit behavior):** `expires_at` is computed once at save time from the user's tier at that moment. Subsequent tier changes (upgrade or downgrade) do NOT mutate existing rows. A user who upgrades from Free to Pro the day after a save keeps the 30d TTL on that row but gets 100d on all future saves. A user who downgrades from Pro to Free keeps 100d on existing rows. This is the intentional behavior - we never rewrite historical retention.

#### 5.3 Comments persistence

Define centralized type in new `src/lib/comments.ts`:

```ts
export type StoredComment = {
  authorName: string | null
  text: string
  likes: number
  replies: number | null
  publishedAt: string | null  // ISO
  sentiment: "positive" | "neutral" | "negative" | "unknown" | null
}
```

Extend `AnalysisInsert`:

```ts
export type AnalysisInsert = {
  // ...existing fields
  tier: "free" | "pro"
  comments: StoredComment[]
}
```

`saveAnalysis` writes comments via threshold-based fallback. CRITICAL: both `comments` and `comments_blob_path` columns are ALWAYS set explicitly in the upsert (one will be null, the other populated). This avoids the tier-downgrade-then-reextract trap where an old `comments_blob_path` could linger when the new save writes only the `comments` column.

```ts
const COMMENTS_INLINE_THRESHOLD_BYTES = 5 * 1024 * 1024  // 5 MB serialized
const COMMENTS_HARD_MAX_BYTES = 45 * 1024 * 1024         // 45 MB; Supabase storage default per-object limit is 50 MB, leave headroom
const serialized = JSON.stringify(input.comments)
const size = Buffer.byteLength(serialized, "utf-8")
const useBlob = size > COMMENTS_INLINE_THRESHOLD_BYTES

let commentsJson: StoredComment[] | null
let commentsBlobPath: string | null

if (useBlob) {
  if (size > COMMENTS_HARD_MAX_BYTES) {
    // Pro extract pushed beyond storage object limit. Skip persistence rather than crash.
    // /api/extract live response still returns comments to the client; only the cache row is sacrificed.
    console.warn("[analyses] comments payload exceeds hard max, skipping persistence", { size })
    return
  }
  commentsBlobPath = `${input.userId}/${input.videoId}.json`
  commentsJson = null
} else {
  commentsJson = input.comments
  commentsBlobPath = null
}
// 1. Upsert row with BOTH columns explicit
// 2. If commentsBlobPath set, upload blob (overwrite-on-conflict)
```

`uploadCommentsBlob` lives in new `src/lib/supabase/storage.ts`. Bucket: `analyses-comments` (PRIVATE, service-role write, NO public reads). Object key: `<userId>/<videoId>.json`. Stored as `application/json` (uncompressed for MVP simplicity; gzip is V2).

**Path-traversal hardening:** `uploadCommentsBlob` MUST validate inputs at the boundary even though callers are server-only: assert `userId` matches uuid regex (`/^[0-9a-f-]{36}$/i`) and `videoId` matches YouTube id regex (`/^[A-Za-z0-9_-]{11}$/`). Throw early on mismatch. Same validation in `downloadCommentsBlob(path)` (split path on `/`, validate both segments). Defense in depth against a future caller passing an unvalidated string.

Bucket creation: created out-of-band via Supabase MCP (`mcp__claude_ai_Supabase__execute_sql` running `insert into storage.buckets (id, name, public) values ('analyses-comments', 'analyses-comments', false) on conflict do nothing;`) at PR 1 deploy time, NOT in the SQL migration file (avoids ordering issues with hosted Supabase migration runner that may not have privileges on the `storage` schema in all configurations). The PR 1 verify checklist must include "confirm bucket exists in Supabase dashboard before extract test." No storage RLS policies on `storage.objects` are created. Since service role bypasses RLS and no authenticated/anon policy exists, default behavior is deny for non-service callers - which is exactly what we want.

On `deleteAnalysis`: if row has `comments_blob_path` not null, after successful DELETE, fire-and-forget storage delete (best-effort). Cron `purgeExpiredAnalyses` extended to: (a) collect `comments_blob_path` of expired rows BEFORE deleting them, (b) delete the rows, (c) batch-delete the collected blob paths via storage admin client.

Orphan blobs (from rare failure paths like upsert-after-upload exception or DELETE-side fire-and-forget failures) are accepted as a known small cost. At expected scale (§8: ~$0.17/month for 1000 Pro extracts), orphan rate would have to be massive to matter. No bucket-listing sweep is needed; if orphans ever become measurable, a follow-up sweep can be added. Out of MVP scope.

**Save order to prevent sweep races and dangling rows:**

The blob key is `<userId>/<videoId>.json` (deterministic). On re-extract, the upsert updates the existing row AND the upload overwrites the existing blob. This is intentional: one canonical blob per (user, video) pair, always in sync with the row.

1. Compute `commentsBlobPath = <userId>/<videoId>.json` (no upload yet)
2. Upsert row with `comments_blob_path = commentsBlobPath` (or `comments` inline JSONB if below threshold) - the row now references a path
3. Upload blob to that path (overwrite-on-conflict, no versioning)

If step 2 fails: nothing to clean up; no blob written.
If step 3 fails: row exists with stale `comments_blob_path` but no blob. `getAnalysisById` blob fetch returns 404; UI shows `comments_unavailable` (transient infra) error path per §7.

**Concurrent-read race on re-extract:** A reader in another tab may receive a torn or stale comments payload if it reads between step 2 (row upserted with new path) and step 3 (blob upload completes). Documented limitation - accepted because (a) re-extract of the same video while a detail tab is open is rare, (b) the user is the same person triggering both actions, (c) the worst outcome is one stale display; refresh fixes it. Not addressed in MVP.

This ordering is stable against most concurrent reads, and there's no permanent state where a blob exists without a row pointer.

**Re-extract during pending delete (DATA LOSS guard):** `saveAnalysis` is keyed `UNIQUE (user_id, video_id)`. If the user has an optimistic-delete timer pending for row R and then triggers a fresh extract of the same video, the upsert REFRESHES R in place. The pending timer (unaware of the re-extract) will fire and DELETE the freshly-refreshed row. To prevent this, the `<AnalysesList>` delete-with-undo must cancel any pending timer keyed by `videoId` when the user navigates back to dashboard and triggers a new extract. Mechanism: pending timers are also indexed by `video_id`; the extract-success client event (already exists) clears any pending timer with the matching videoId via `window.dispatchEvent(new CustomEvent('tubemine:analysis-saved', { detail: { videoId } }))`. `<AnalysesList>` mounts a listener that cancels pending deletes for matching videoId.

#### 5.4 Read paths

**Performance pin for list queries:** `listAnalyses` MUST keep its existing column projection (already does not select `comments`; verify before changing). New `comments` column must NEVER be in list-endpoint SELECTs - it would force TOAST decompression of multi-MB JSONB per row across every recent-block / history-page render. Only `getAnalysisById` and the export cache branch SELECT it.

New `getAnalysisById(userSb: SupabaseClient, id: string): Promise<AnalysisRow & { comments: StoredComment[] | null } | null>`. The parameter name `userSb` is significant: this function MUST receive a user-scoped Supabase client (from existing `createClient()` factory in `src/lib/supabase/server.ts`, the request-cookie-aware factory), never the service client. The row-level SELECT is the authorization gate; if it returns nothing (RLS denied), the blob fetch never runs. Document this at the function definition and add a code comment warning against passing a service client.

Storage operations (`downloadCommentsBlob`, `uploadCommentsBlob`, `deleteCommentsBlob`) use the EXISTING `createServiceClient()` factory in `src/lib/supabase/server.ts` (per existing pattern; `SUPABASE_SERVICE_ROLE_KEY` already wired in env). No new factory file needed.

- SELECT row including `comments` and `comments_blob_path` columns
- If `comments_blob_path` not null, fetch blob via service client (NOT user client; user client cannot read from private bucket without policy), parse JSON, attach as `comments`
- Return null if row not found (RLS hides foreign rows = behaves identically to not-found = no enumeration leak)

Blob read uses service client deliberately. Authorization is already established at the row level by the user-scoped SELECT returning the row at all. If the row read returned nothing (RLS denied), we skip the blob fetch entirely.

#### 5.5 API surface changes

**New** `GET /api/analyses/[id]`:

```
401 if no user
400 if id not UUID
404 if row null (RLS hides; legitimate not-found indistinguishable)
200 with { id, video_id, video_title, channel_name, thumbnail_url,
          comment_count, sentiment, top_words, emoji_frequency,
          processed_at, expires_at, comments: StoredComment[] | null,
          has_comments: boolean }
```

`has_comments` is true if `comments` non-null OR `comments_blob_path` non-null. Used by UI to distinguish legacy rows from new rows.

**Modify** `POST /api/export/route.ts`: add a new `mode` discriminator field to make the schema branching explicit. Canonical export-from-cache call: **POST `/api/export` with `Content-Type: application/json` body `{ mode: "cache", analysisId, format }`**; existing extract call shifts to `{ mode: "extract", ...currentFields }`. Use `z.discriminatedUnion("mode", [extractSchema, cacheSchema])`. The existing call sites in the live extract flow get updated in the same PR to include `mode: "extract"`. CSV branch: existing route currently supports `json | xlsx` per Zod schema; extend to include `csv` for the cache branch (the live extract has its own CSV path already; do NOT regress that route).

- When `mode === "cache"` + user authenticated: load row directly via Supabase SELECT (NOT through `getAnalysisById`, because `getAnalysisById` already attaches blob contents - we need the raw row to inspect `comments_blob_path`). Read `(comments, comments_blob_path)`. If both null -> 410 `comments_not_stored`. Otherwise call `downloadCommentsBlob(comments_blob_path)` if path set, else use inline `comments`. If blob fetch throws or returns null (parse error / not found), return 500 `comments_unavailable`. Then build export from the resulting `StoredComment[]` array. Do NOT call YT API. Return 404 if row missing.
- When `mode === "extract"`: existing extract flow unchanged.

Implementation note: the cache branch deliberately bypasses `getAnalysisById` for export. `getAnalysisById` is for the detail view which wants the resolved `comments` array attached; the export handler wants to differentiate "legacy null" from "blob fetch failed" without ambiguity.

**Modify** `/api/extract/route.ts` (`src/app/api/extract/route.ts` around line 266): pass full `comments` array and resolved `tier` to `saveAnalysis`. Map runtime `Comment` shape to `StoredComment` (drop intermediate scratch fields, keep author/text/likes/replies/publishedAt/sentiment).

#### 5.6 RLS sanity check (BLOCKER for PR 1)

Required test, gates PR 1 merge:

1. Create analysis as user A via `/api/extract`
2. Sign in as user B
3. Confirm `GET /api/analyses/<A's id>` returns 404 (RLS hides)
4. Confirm `DELETE /api/analyses/<A's id>` returns `{ deleted: 0 }` (RLS denies)
5. Confirm `POST /api/export { analysisId: <A's id> }` returns 404 (RLS hides upstream)

Implementation: integration test against Supabase test project OR documented manual procedure with two test accounts.

#### 5.7 PR 1 tests

- Unit: `computeExpiresAt(now, "free")` = +30 days; `computeExpiresAt(now, "pro")` = +100 days
- Unit: blob threshold fallback returns `commentsBlobPath !== null` when serialized > 5 MB; null otherwise
- Integration (`saveAnalysis`): row persists with `comments` populated for small payload; `comments_blob_path` populated + storage object exists for large payload
- Integration (`getAnalysisById`): inline row reads back; blob row reads back via storage fetch
- Integration (DELETE side-effect): blob is deleted when row deleted
- Integration (RLS): user B cannot read user A's analysis

#### 5.8 PR 1 verify-on-prod

- Trigger fresh extract of a small public video via prod /dashboard
- Inspect via Supabase MCP: row has `comments` populated, `expires_at` correctly tier-aware
- `GET /api/analyses/:id` returns full payload with comments
- `DELETE /api/analyses/:id` removes row + blob (if applicable)
- Confirm no regressions in /dashboard recent block or existing /history list

---

### PR 2: Detail view route `/history/:id`

#### 5.9 New files

- `src/app/[locale]/(app)/history/[id]/page.tsx`: server component. Loads via cached `getUser` + `getAnalysisById(supabase, id)`. Passes tier-resolved data to client component. Wraps response in i18n. Returns `notFound()` on null.
- `src/app/[locale]/(app)/history/[id]/loading.tsx`: skeleton matching the four panels (top words, sentiment, emojis, comments table)
- (No separate `not-found.tsx` file in this PR; `page.tsx` calls `notFound()` which renders the nearest existing not-found boundary or default Next.js 404. The i18n keys `not_found_title`/`not_found_body`/`back_to_history_link` are added in case a custom boundary is wired later, but no new boundary file ships in MVP.)
- `src/components/analysis-detail-view.tsx`: client component composing:
  - Header card: thumbnail + title + channel + comment count + processed_at + expires_at
  - Action row: Download CSV (always for authed), Download JSON + Excel (Pro only), Delete-with-undo (always)
  - `<TopWordsPanel tier items totalUnique commentsAnalyzed />` (existing, reused)
  - Sentiment + emoji panels: render inline JSX in `analysis-detail-view.tsx`, duplicating the small visual block already in `tubemine.tsx`. NO extraction into shared components in this turbo - tubemine.tsx is TUB-33 territory and the JSX is short enough that duplication is safer than extraction. If a third consumer appears later, unify then.
  - `<CommentsTable comments />` (new, virtualized)
- `src/components/comments-table.tsx`: virtualized table using **`@tanstack/react-virtual`** (new dependency, ~3KB, well-maintained). Columns: author, text (CSS line-clamp with `title` attribute tooltip for full text; NO per-row expand toggle to keep virtualizer row heights uniform), sentiment chip, likes, publishedAt. Mobile (< 640px): card layout per row instead of grid. Closes legacy known fail TC-0039. Must handle 50K rows without DOM bloat (this is the Pro extract maximum and the hardened threshold for TC-HISTORY-008).

#### 5.10 Legacy row handling

If `has_comments === false`:

- Top words / sentiment / emojis panels still render (those columns are always present)
- Comments table area shows inline notice: `i18n("history_detail.legacy_no_comments")` = "Comments aren't stored for analyses from before this update. Re-extract to view them."
- Download CSV/JSON/Excel buttons are visually disabled (`aria-disabled`, no click handler) with tooltip explaining why
- Delete button still works

**comment_count is source of truth:** Detail view header always displays the `comment_count` column. Comments table renders `comments.length` rows below it. The extract path guarantees `comment_count === comments.length` at save time (both derived from the same array), so divergence is not expected. No runtime assertion or warning log is needed. The empty-array case (`comments: []`) is unreachable in practice because `/api/extract` rejects videos with zero extractable comments before reaching `saveAnalysis`; if it ever surfaces, the comments table renders empty naturally.

#### 5.11 PR 2 i18n keys (new)

`messages/en.json` + `messages/ru.json` add `history_detail` namespace:

```
title
back_to_history
processed_at_label
expires_at_label
comment_count_label
download_csv
download_json
download_excel
delete
legacy_no_comments
not_found_title
not_found_body
back_to_history_link
comments_table_heading
comments_table_empty
column_author
column_text
column_sentiment
column_likes
column_published
delete_pending     # interpolated: "Deleting {title}" so rapid-multi-delete toasts are distinguishable
undo
undo_too_late
```

Also added to general namespace if not present: error toasts (`export_failed_legacy`, `export_failed_transient`).

`scripts/check-message-parity.mjs` enforces parity at build time; both files updated together.

#### 5.12 PR 2 verify-on-prod

- Visit `/history/:id` for the row from PR 1 verify
- All four panels render with correct tier-aware data
- Mobile (375px viewport via Chrome MCP `emulate`): comments table usable, no horizontal page scroll
- Download CSV from detail view: assert **NO** call to `/api/extract` or YT API in network panel (only POST `/api/export` with `analysisId` in JSON body)
- Pro tier: Download CSV+JSON+Excel all work and use cached path
- Legacy row (manually mutate `comments = null` on one test row): placeholder + disabled buttons + no JS error

---

### PR 3: Unified `<AnalysesList>` component + dashboard refactor + history refactor + delete-with-undo

#### 5.13 New file `src/components/analyses-list.tsx`

Client component, accepts props:

```ts
// AnalysisRow already defined in src/lib/analyses.ts; reuse it directly.
// AnalysisRow.sentiment is typed as SentimentAggregate | null (the project's
// existing type); supabase-js returns the JSONB column already shaped. No new
// parse step needed for list/detail consumers.
import type { AnalysisRow } from "@/lib/analyses"

type AnalysesListProps = {
  initialItems: AnalysisRow[]
  initialCursor: string | null  // existing keyset cursor base64url-encoded {processed_at, id}, per src/lib/analyses.ts encodeCursor/decodeCursor
  tier: "free" | "pro"
  compact: boolean         // true: no actions, no thumbnail enlargement
  showActions: boolean     // true: per-row Download menu / Delete (no separate View button; row link handles nav)
  paginated: boolean       // true: load-more pagination via cursor
  limit: number            // page size hint (10 for compact, 20 for full)
  // No viewAllHref: when compact=true the component hardcodes <Link href="/history">
  // with label sourced from the existing `dashboard.view_all` i18n key (already
  // present in messages/{en,ru}.json; reused as-is, no new key needed).
}
```

**Wire-shape pin (cross-server/client):** All timestamps cross the server -> client boundary as ISO strings (supabase-js already returns `timestamptz` as ISO strings). The pre-existing `AnalysisRow` type in `src/lib/analyses.ts` already uses `string` for `processed_at` / `expires_at`, so reuse is direct.

**Conditional render path:** When `showActions=false`, the component takes an early-return rendering pure-display markup and never executes the delete-with-undo `useRef`/`useState` code paths. Sonner is subscribed once at the app root (`<Toaster />` in root layout), so dashboard rendering does NOT create extra subscribers. No child-component split is needed; single-component branching is sufficient.

Renders unordered list of rows. Each row:

- Link `<Link href="/history/[id]">` wraps thumbnail + title + channel + count = navigates to detail
- If `showActions`: trailing button cluster:
  - **Download** popover menu: tier-aware CSV / JSON / Excel options. Each option triggers a `fetch('/api/export', { method: 'POST', body: JSON.stringify({ mode: 'cache', analysisId, format }) })`, then converts the response body to a Blob and triggers a download via a hidden anchor with `download` attribute. (Row click on the link area still navigates to /history/:id; no redundant View icon button.)
  - **Delete** button: triggers optimistic removal + 5s Sonner toast with Undo action.

Empty state: shared `<EmptyAnalysesList tier />` component with translated CTA back to /dashboard.

#### 5.14 Delete-with-undo (no API call until window closes)

Implementation in `<AnalysesList>`:

```ts
type PendingDelete = { timer: ReturnType<typeof setTimeout>; committed: boolean }
const pendingRef = useRef<Map<string, PendingDelete>>(new Map())
const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

function handleDelete(id: string) {
  // 1. Optimistically remove from rendered list (filter pendingIds out of items)
  setPendingIds(prev => new Set(prev).add(id))

  // 2. Schedule actual DELETE call after 5000ms; mark committed BEFORE the fetch
  //    so undoDelete sees the committed flag and skips restoring the row.
  const timer = setTimeout(async () => {
    const entry = pendingRef.current.get(id)
    if (!entry) return
    entry.committed = true
    try {
      await fetch(`/api/analyses/${id}`, { method: "DELETE" })
      track("history_deleted", { analysis_id_hash: id.slice(0, 8) })
    } finally {
      pendingRef.current.delete(id)
      // Row stays hidden; we do not remove from pendingIds since it has been committed.
    }
  }, 5000)
  pendingRef.current.set(id, { timer, committed: false })

  // 3. Show Sonner toast with action button "Undo".
  //    Note: toast duration matches timer; if user manually dismisses the toast
  //    via Sonner's close button, the timer still fires (we treat dismiss as
  //    "I see it, accept the delete"). This matches Gmail's Undo Send pattern.
  toast(t("delete_pending", { title: videoTitle ?? videoId }), {
    action: { label: t("undo"), onClick: () => undoDelete(id) },
    duration: 5000,
  })
}

function undoDelete(id: string) {
  const entry = pendingRef.current.get(id)
  if (!entry) return                    // already committed and cleaned up
  if (entry.committed) {                // timer fired; DELETE in flight or completed
    toast.error(t("undo_too_late"))     // "Undo unavailable - delete already submitted"
    // Note: we do NOT assert server-side success here. If the in-flight DELETE
    // failed (5xx, network drop), the row will resurrect on next page load.
    // That's acceptable: user can simply re-delete.
    return
  }
  clearTimeout(entry.timer)
  pendingRef.current.delete(id)
  setPendingIds(prev => { const next = new Set(prev); next.delete(id); return next })
  track("history_delete_undone", { analysis_id_hash: id.slice(0, 8) })
}
```

Unmount cleanup: in `useEffect` cleanup, **clear all pending timers WITHOUT firing the DELETE** (Gmail-style undo). Reasoning: the user navigated away. The pending DELETE was always conditional; if we commit-on-unmount, we get the failure mode where the user navigates to that very row's detail and sees a ghost 404. Clear-and-drop is simpler, matches user mental model ("the row disappeared in this view; I never confirmed it"), and tolerates real tab-close where `fetch()` from unmount would be cancelled by the browser anyway. The row will resurface on next page load if it was never actually deleted, and the optimistic-hide was page-local.

#### 5.15 Refactor existing consumers

- `src/components/recent-analyses.tsx`: convert from inline rendering to thin wrapper that fetches first 10 server-side then mounts `<AnalysesList compact limit={10} showActions={false} initialItems={...} />`.
- `src/app/[locale]/(app)/history/history-client.tsx`: refactor to use `<AnalysesList paginated showActions limit={20} initialItems={...} />`. Existing pagination cursor logic moves into AnalysesList.

Both consumers keep their existing data-fetching server boundary (RLS-scoped supabase client). Only the row-rendering is unified.

#### 5.16 PR 3 verify-on-prod

- Dashboard recent block shows 10 entries with no action buttons; "View all" works
- /history full list shows action buttons (View, Download menu, Delete)
- Row click navigates to /history/:id (not modal)
- Delete-with-undo: row vanishes immediately; toast shows; clicking Undo within 5s restores row; no DELETE network call observed during undo window
- After 5s, network panel shows the DELETE call
- Tier-aware Download menu: Free shows CSV only; Pro shows CSV+JSON+Excel
- Empty state renders for new test account with zero rows

---

### PR 4: Polish (i18n parity, analytics, tests, vault, playbook)

#### 5.17 i18n parity

All new keys present in both `messages/en.json` and `messages/ru.json`. Build-time enforced by `scripts/check-message-parity.mjs`. RU translations natural (tone matches existing keys).

#### 5.18 Analytics events

Add `track()` calls (existing helper). New events:

- `history_analysis_opened` (props: `analysis_id_prefix`, `tier`) - fired from a `useEffect(() => { track(...) }, [])` inside `<AnalysisDetailView>` (client component) on first mount. `analysis_id_prefix` is `id.slice(0, 8)` (sync, no async hash). 8 hex chars of a uuid is enough to disambiguate without leaking the full id into the analytics pipeline.
- `history_downloaded` (props: `analysis_id_prefix`, `format: "csv" | "json" | "xlsx"`)
- `history_deleted` (props: `analysis_id_prefix`) - fires only when the 5s timer commits the DELETE; never fires on undo
- `history_delete_undone` (props: `analysis_id_prefix`) - fires when user clicks Undo before commit

`track` is imported directly from `@vercel/analytics` (existing pattern in `sentiment.tsx`, `tubemine.tsx`, `emoji-frequency.tsx`); there is no local whitelist module. The repo's `analytics-i18n-parity.test.ts` is the actual contract enforcer: it scans call sites and asserts every event name has matching i18n parity (if applicable). Add the new event names to that test's expected list at the same time the calls land.

#### 5.19 Tests

- Component test for `<AnalysesList>` in both modes (compact, full)
- Component test for `<AnalysisDetailView>` with legacy row props (assert placeholder, disabled buttons)
- Integration test for delete-with-undo flow (fake timers, assert no fetch call until timer fires, undo cancels)
- E2E (manual via Chrome MCP, documented in test-cases.md): TC-HISTORY-001..010 below

#### 5.20 Vault + playbook updates

Append to `~/vault/projects/yt-comments/qa/test-cases.md`:

- TC-HISTORY-001: `/history/:id` loads stored aggregates + comments without `/api/extract` YT call
- TC-HISTORY-002: Download CSV from history view uses cached comments (no YT call in network)
- TC-HISTORY-003: Tier-aware Download buttons (Free=CSV; Pro=CSV+JSON+Excel) match live extract view
- TC-HISTORY-004: Delete-with-undo: optimistic removal, undo within 5s restores, no DELETE call observed during undo
- TC-HISTORY-005: Legacy row (`comments IS NULL`) shows placeholder, Download buttons disabled, no JS error
- TC-HISTORY-006: Tier-aware TTL: Free row `expires_at = processed_at + 30d`, Pro row `+ 100d`
- TC-HISTORY-007: `<AnalysesList>` renders correctly in both compact (dashboard) and full (history) contexts
- TC-HISTORY-008: Detail view comments table virtualization smoke (closes legacy TC-0039). Verify with a synthetic ~2000-row mock analysis (component-level test or temporary dev fixture; no need to generate a real 50K extract just for QA): smooth scrolling, no console errors, DOM node count for the table region stays in the low hundreds (relying on `@tanstack/react-virtual` guarantees). The real 50K stress test is deferred until a Pro user reports jank.
- TC-HISTORY-009: Mobile responsive at 375px: detail view usable, no horizontal page scroll
- TC-HISTORY-010: RLS: user A cannot GET or DELETE `/api/analyses/:id` for user B's analysis

Append to `~/vault/playbooks/saas-roadmap/13-qa-user-flows-and-test-cases.md`: cluster 10 "Cached analysis storage + history detail" referencing all TC-HISTORY entries as mandatory.

#### 5.21 PR 4 verify-on-prod

- All RU strings render on `/history` and `/history/:id`
- Analytics events fire (check via Vercel Analytics or dev console)
- All TC-HISTORY-* pass via Chrome MCP
- Build manifest still healthy (no accidental dynamic routes; `/history/:id` is intentionally dynamic per-id)

## 6. Data flow

### 6.1 Extract path (writes)

```
POST /api/extract
  -> fetch YT comments (or pull from in-memory accumulator)
  -> score sentiment per comment
  -> build aggregates (top_words, sentiment, emoji_frequency)
  -> map Comment[] -> StoredComment[]
  -> resolve user tier (existing logic)
  -> saveAnalysis({ ...aggregates, tier, comments: StoredComment[] })
       -> serialize comments, check size threshold
       -> if > 5MB: upload to analyses-comments/<userId>/<videoId>.json, set comments_blob_path
       -> else: inline JSONB
       -> upsert with computed tier-aware expires_at
  -> return response unchanged
```

### 6.2 Detail view path (reads)

```
GET /history/:id (server component)
  -> auth check (cached getUser)
  -> getAnalysisById(userSupabase, id)
       -> SELECT row (RLS-scoped); return null if not own/expired
       -> if comments_blob_path: fetch blob via service client, parse, attach
       -> else: attach inline comments JSONB
  -> render <AnalysisDetailView />
```

### 6.3 Export-from-cache path

```
POST /api/export { analysisId, format }
  -> auth check
  -> getAnalysisById(userSupabase, analysisId); 404 if null
  -> 410 if has_comments === false (legacy)
  -> generate file from cached StoredComment[]
  -> stream response; NO YT call
```

### 6.4 Delete path (optimistic + commit)

```
Client: handleDelete(id)
  -> optimistic remove from rendered list (filter pendingDeletes)
  -> show Sonner toast 5s with Undo
  -> setTimeout 5s: fire DELETE /api/analyses/:id
       -> server: deleteAnalysis(userSupabase, id) (RLS enforced)
       -> server: delete blob if comments_blob_path set
  -> on Undo: clearTimeout, restore row

Unmount (including any in-app navigation away from /history, e.g. click into /history/:id while a delete is pending): clear all pending timers WITHOUT firing the DELETE (Gmail-style undo, per §5.14). Row resurrects on next page load since the server never received the DELETE. Side benefit: if a user clicks the row to inspect right after triggering its delete, they reach the detail page on a fully-alive row instead of a ghost-404.
```

## 7. Error handling

| Scenario | Behavior |
|---|---|
| `GET /api/analyses/:id` non-UUID | 400 `invalid_id` |
| `GET /api/analyses/:id` not authed | 401 `unauthorized` |
| `GET /api/analyses/:id` not owned or not found | 404 `not_found` (RLS hides) |
| `GET /api/analyses/:id` row exists, blob fetch fails | 500 `comments_unavailable` (do NOT crash UI; client falls back to legacy placeholder + retry CTA) |
| Detail page row null | `notFound()` -> Next.js 404 page |
| Export with legacy row | 410 `comments_not_stored` |
| Export with valid row but format invalid | 400 `invalid_format` |
| Delete during undo window: user closes tab or navigates | clear timer WITHOUT firing DELETE; row resurrects on next page load (per §5.14 clear-and-drop) |
| Delete fetch rejects after 5s timer fires (server 5xx) | `committed=true` was set BEFORE the fetch; user-visible behavior: row stays hidden in current page, but next page load resurrects it. Acceptable: user can re-delete. No retry, no error toast (silent fail). |
| Blob upload fails after upsert succeeded with `comments_blob_path` set | Row exists, blob missing. `getAnalysisById` returns row with blob fetch failing -> 500 `comments_unavailable`. User can re-extract to refresh. Acceptable transient state. |
| Delete after row already gone (race) | server returns `{ deleted: 0 }` - silent success, no error toast |
| Storage upload fails (PR 1 write) | the whole `saveAnalysis` call fails; `/api/extract` returns 200 to the client with the extracted comments+aggregates so the LIVE extract view still works, but the row is NOT persisted. Caller logs an error. We never silently truncate (would create inconsistent `comment_count` vs cached `comments` length). User can re-extract to retry. |
| Storage delete fails (DELETE side-effect) | log warning, swallow; orphan accepted (small cost at expected scale per §8) |
| Comments payload exceeds Supabase storage hard limit (~45MB+) | `saveAnalysis` skips persistence and logs warning; `/api/extract` response still streams comments to client (live view works); user can re-extract with a lower limit if they want history. Acceptable degraded case for outlier 100K-comment extracts with very long text. |
| Concurrent delete from two devices (multi-device user) | Device B's immediate DELETE wins. Device A's 5s timer fires later, server returns `{deleted: 0}` (idempotent), no error shown to A. A's `pendingIds` set still has the id so the row stays hidden until page reload. Acceptable: identical end state. |
| Account deletion cascade (ON DELETE CASCADE on user_id) | DB cascades the row removal but the app-layer `deleteAnalysis` blob cleanup is bypassed - orphaned blobs in storage remain. Known limitation. GDPR mitigation: when wiring account deletion in a future PR, add an explicit storage cleanup pass (list bucket by `<userId>/` prefix, delete matching objects) BEFORE the DB cascade. Out of MVP scope. |
| Cursor pagination + pending delete row in next-page anchor | If the last visible row in page N has a pending delete and the user clicks "load more", the keyset cursor `{processed_at, id}` is computed from the still-rendered (non-pending) last row. Deleted rows are excluded from pendingIds in the rendered list before cursor extraction. No duplicate or skipped rows. |
| Browser background-tab throttling during 5s undo window | Chrome may delay `setTimeout` in background tabs. Effect: row stays hidden in active tab until the (delayed) timer fires; DELETE commits whenever the browser unthrottles. Acceptable: user-initiated delete eventually completes; F5 confirms state. |
| Two-tab delete race | NOT addressed in MVP. Tab A starts undo timer; Tab B (or detail page) is open on same row. If commit fires while Tab B is open, subsequent actions in Tab B will 404. Acceptable: users editing the same record from two tabs is rare for this product. Documented limitation. V2 may add BroadcastChannel coordination. |

## 8. Performance + cost

- Serialized `StoredComment[]` for a typical video (200-500 comments) ≈ 50-200 KB. Well within inline JSONB.
- 5MB threshold ≈ 12-15K comments typical (varies with comment length). Pro tier max is 100K comments; expect a meaningful share (anywhere from 10-50% depending on comment length distribution) of Pro extracts to route to blob. PostgreSQL TOAST handles large JSONB but read latency grows above a few MB; if PR 1 verify-on-prod shows >500ms blob-equivalent reads at the 5MB boundary, lower the threshold to 1-2MB as a follow-up tweak.
- Blob storage cost: ~$0.021/GB/month on Supabase. 1000 Pro extracts averaging 8MB each = 8GB = $0.17/month. Negligible.
- Detail view server render: 1 DB row read + optional 1 blob fetch. Cached `getUser`. Should TTFB < 250ms warm.
- Comments table virtualization: only ~20 DOM nodes regardless of 50K rows.
- No new DB indexes needed: lookups by `(user_id, processed_at desc)` already indexed; lookups by `id` use PK.

## 9. Security

- RLS unchanged; new columns inherit row policy.
- Storage bucket `analyses-comments` is private; service-role only access. No public reads. URL-guessing attack surface: zero (no public URL).
- Authorization for blob reads: gate happens at the row-level SELECT; if RLS denied, blob is never fetched.
- Comment text written from extract path is user-supplied YT comment content. NEVER rendered as HTML on detail view; always rendered as text content with React's automatic escaping. The CSV/JSON/Excel export reuses existing serialization; CSV path already has injection-safe formula prefix handling (verify in code review).
- New analytics event payloads: send `id.slice(0, 8)` (first 8 hex chars of the uuid v4) as `analysis_id_prefix` to keep events disambiguatable while not leaking the full id into the analytics pipeline. Sync, no SubtleCrypto needed.

## 10. Out of scope hardening / file-touchpoint contract

May edit:

- `supabase/migrations/03_analyses_comments.sql` (new)
- `src/lib/analyses.ts` (extend types, add `computeExpiresAt`, `getAnalysisById`; update `saveAnalysis`, `purgeExpiredAnalyses`)
- `src/lib/comments.ts` (new: `StoredComment` type)
- `src/lib/supabase/storage.ts` (new: `uploadCommentsBlob(userId, videoId, json) -> path`, `downloadCommentsBlob(path) -> StoredComment[]` (THROWS on 404 or parse error - never returns null silently; callers wrap in try/catch and translate to `comments_unavailable` UI state), `deleteCommentsBlob(path) -> void` (best-effort, swallows errors); all three use `createServiceClient()` internally and return promises)
- `src/app/api/extract/route.ts` (pass `comments` + `tier` to `saveAnalysis`)
- `src/app/api/analyses/[id]/route.ts` (add `GET`)
- `src/app/api/export/route.ts` (accept `analysisId`)
- `src/app/[locale]/(app)/history/[id]/{page,loading,not-found}.tsx` (new)
- `src/app/[locale]/(app)/history/history-client.tsx` (refactor to use unified component)
- `src/components/analyses-list.tsx` (new)
- `src/components/recent-analyses.tsx` (refactor)
- `src/components/analysis-detail-view.tsx` (new)
- `src/components/comments-table.tsx` (new, virtualized)
- `src/components/empty-analyses-list.tsx` (new, shared empty state)
- `messages/{en,ru}.json` (new keys under `history_detail`)
- Update `src/__tests__/analytics-i18n-parity.test.ts` (existing test) with new event names
- `src/components/__tests__/*` + `src/lib/__tests__/*`
- `package.json` (add `@tanstack/react-virtual` dependency)

MUST NOT touch:

- `src/components/site-header*.tsx` (TUB-30 done)
- `src/app/[locale]/pricing/page.tsx` (TUB-32 territory)
- `src/app/[locale]/login/page.tsx` (TUB-32 territory)
- `src/app/[locale]/{docs,changelog}/page.tsx` (TUB-31 done)
- `src/components/tubemine.tsx` (entire file - TUB-33 territory; sentiment/emoji JSX is duplicated in `analysis-detail-view.tsx` rather than extracted, per round-1 YAGNI review)
- `src/lib/auth-hint.ts`, `src/lib/auth-cached.ts` (shared infra; reuse only)
- Payment / Polar / Stripe code
- Header / Footer / SideNav (unless adding "View all" link)

## 11. Open questions resolved up front

| Question | Answer |
|---|---|
| Virtualization library? | `@tanstack/react-virtual` - lightweight, headless, headless-only, established in Next.js ecosystem |
| Storage compression? | No for MVP; gzip is V2 optimization |
| Inline vs blob threshold? | 5 MB serialized JSONB |
| Modal vs separate route for detail? | Separate route `/history/:id` (deep-linkable, back-button-friendly, mobile-friendly) |
| Refresh-from-YT button? | Out of scope, V2 |
| Anon users get history? | No. Anonymous tier never gets a row saved. Same as current behavior. |
| TTL for existing rows? | Untouched. New saves use new tier-aware TTL going forward. |
| Sentiment per-comment storage? | Stored in `StoredComment.sentiment` so detail view + cached export are tier-aware-symmetric with live extract view. |

## 12. Rollback plan

Each PR is small and independent:

- PR 1 rollback: drop columns + bucket (no data loss for old aggregates). Revert code. Existing recent-analyses + /history continue working with aggregates-only.
- PR 2 rollback: delete `/history/:id` route files. /history list stays. No data implication.
- PR 3 rollback: revert AnalysesList; restore inline recent-analyses + history-client renderers. No data implication.
- PR 4 rollback: revert i18n + analytics + test additions. Functional code unaffected.

Each commit ships independently to main and is independently revertible via `git revert`.

## 13. Success criteria

1. User can click any row in /history → see top words, sentiment %, emojis, comments table - all without YT API call
2. User can download CSV (Free+Pro) / JSON+Excel (Pro) from /history/:id - using cached data, no YT call
3. Dashboard "Recent analyses" and /history share one component implementation
4. Delete action shows undo toast; clicking undo within 5s restores row; no DELETE network call during undo
5. Pro analysis row stays accessible for 100 days; Free for 30 days
6. Comments table renders 50K rows without DOM bloat (virtualized)
7. Legacy rows (comments IS NULL) render gracefully with placeholder + disabled downloads
8. RLS confirmed: user A cannot access user B's analysis
9. Mobile (375px) usable on detail view
10. All TC-HISTORY-001..010 pass on prod
