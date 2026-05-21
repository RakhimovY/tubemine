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

`RecentAnalyses` (`src/components/recent-analyses.tsx`) is a server component fetching 5 items via `listAnalyses(supabase, null, 5)`. No action buttons. Has thumbnail + sentiment qualitative/quantitative split by tier.

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

`saveAnalysis` writes comments via threshold-based fallback:

```ts
const COMMENTS_INLINE_THRESHOLD_BYTES = 5 * 1024 * 1024  // 5 MB serialized
const serialized = JSON.stringify(input.comments)
const useBlob = Buffer.byteLength(serialized, "utf-8") > COMMENTS_INLINE_THRESHOLD_BYTES

let commentsJson: StoredComment[] | null = input.comments
let commentsBlobPath: string | null = null

if (useBlob) {
  commentsBlobPath = await uploadCommentsBlob(input.userId, input.videoId, serialized)
  commentsJson = null
}
// upsert with comments=commentsJson, comments_blob_path=commentsBlobPath
```

`uploadCommentsBlob` lives in new `src/lib/supabase/storage.ts`. Bucket: `analyses-comments` (PRIVATE, service-role write, NO public reads). Object key: `<userId>/<videoId>.json`. Stored as `application/json` (uncompressed for MVP simplicity; gzip is V2).

Bucket creation: new migration `supabase/migrations/03_analyses_comments.sql` also creates the bucket via `insert into storage.buckets (id, name, public) values ('analyses-comments', 'analyses-comments', false) on conflict do nothing;`. No storage RLS policies created; bucket is service-role-only access. API reads go through server code holding service client.

On `deleteAnalysis`: if row has `comments_blob_path` not null, after successful DELETE, fire-and-forget storage delete (best-effort; orphan blobs are cheap and a sweeper cron can purge later). Cron `purgeExpiredAnalyses` extended to also delete blobs for expired rows.

#### 5.4 Read paths

New `getAnalysisById(sb, id): Promise<AnalysisRow & { comments: StoredComment[] | null } | null>`:

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

**Modify** `POST /api/export/route.ts`: accept optional `analysisId` field in request body alongside existing extract flow.

- When `analysisId` present + user authenticated: load row via `getAnalysisById`, build export from cached comments. Do NOT call YT API. Return 404 if row null. Return 410 if `has_comments === false` (legacy row, cannot export from cache).
- When `analysisId` absent: existing extract flow unchanged.

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
- `src/app/[locale]/(app)/history/[id]/not-found.tsx`: simple "Analysis not found or expired" with link back to /history
- `src/components/analysis-detail-view.tsx`: client component composing:
  - Header card: thumbnail + title + channel + comment count + processed_at + expires_at
  - Action row: Download CSV (always for authed), Download JSON + Excel (Pro only), Delete-with-undo (always)
  - `<TopWordsPanel tier items totalUnique commentsAnalyzed />` (existing, reused)
  - Sentiment panel (extracted from existing TubeMine sentiment chip into reusable `<SentimentPanel tier sentiment />`)
  - Emoji panel (extracted into reusable `<EmojiPanel tier items />`)
  - `<CommentsTable comments />` (new, virtualized)
- `src/components/comments-table.tsx`: virtualized table using **`@tanstack/react-virtual`** (new dependency, ~3KB, well-maintained). Columns: author, text (truncate with expand), sentiment chip, likes, publishedAt. Mobile (< 640px): card layout per row instead of grid. Closes legacy known fail TC-0039.

Reuse decisions for sentiment + emoji: extract the existing inline JSX from `src/components/tubemine.tsx` analytics section into named components in `src/components/sentiment-panel.tsx` and `src/components/emoji-panel.tsx`, then re-import in tubemine.tsx. This is a low-risk extraction: same JSX, new file, no behavior change. tubemine.tsx is in TUB-33 territory but this is a minimal extraction confined to the analytics-render block (not the extract-flow logic). The constraint forbids touching extract flow, not extracting analytics-render JSX into shared components.

#### 5.10 Legacy row handling

If `has_comments === false`:

- Top words / sentiment / emojis panels still render (those columns are always present)
- Comments table area shows inline notice: `i18n("history_detail.legacy_no_comments")` = "Comments aren't stored for analyses from before this update. Re-extract to view them."
- Download CSV/JSON/Excel buttons are visually disabled (`aria-disabled`, no click handler) with tooltip explaining why
- Delete button still works

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
read_more
```

`scripts/check-message-parity.mjs` enforces parity at build time; both files updated together.

#### 5.12 PR 2 verify-on-prod

- Visit `/history/:id` for the row from PR 1 verify
- All four panels render with correct tier-aware data
- Mobile (375px viewport via Chrome MCP `emulate`): comments table usable, no horizontal page scroll
- Download CSV from detail view: assert **NO** call to `/api/extract` or YT API in network panel (only `/api/export?analysisId=...` or equivalent)
- Pro tier: Download CSV+JSON+Excel all work and use cached path
- Legacy row (manually mutate `comments = null` on one test row): placeholder + disabled buttons + no JS error

---

### PR 3: Unified `<AnalysesList>` component + dashboard refactor + history refactor + delete-with-undo

#### 5.13 New file `src/components/analyses-list.tsx`

Client component, accepts props:

```ts
type AnalysesListProps = {
  initialItems: AnalysisRow[]
  initialCursor: string | null
  tier: "free" | "pro"
  compact: boolean         // true: no actions, no thumbnail enlargement
  showActions: boolean     // true: per-row View / Download menu / Delete
  paginated: boolean       // true: load-more pagination via cursor
  limit: number            // page size hint (10 for compact, 20 for full)
  viewAllHref?: string     // "View all" link target if compact
}
```

Renders unordered list of rows. Each row:

- Link `<Link href="/history/[id]">` wraps thumbnail + title + channel + count = navigates to detail
- If `showActions`: trailing button cluster:
  - **View** (icon-only, same nav target as row link, present for affordance clarity)
  - **Download** popover menu: tier-aware CSV / JSON / Excel options. Direct download via `/api/export?analysisId=...` (or POST equivalent).
  - **Delete** button: triggers optimistic removal + 5s Sonner toast with Undo action.

Empty state: shared `<EmptyAnalysesList tier />` component with translated CTA back to /dashboard.

#### 5.14 Delete-with-undo (no API call until window closes)

Implementation in `<AnalysesList>`:

```ts
const [pendingDeletes, setPendingDeletes] = useState<Map<string, NodeJS.Timeout>>(new Map())

function handleDelete(id: string) {
  // 1. Optimistically remove from rendered list (filter pendingDeletes out of items)
  // 2. Show Sonner toast with action button "Undo"
  // 3. Schedule actual DELETE call after 5000ms
  const timer = setTimeout(async () => {
    await fetch(`/api/analyses/${id}`, { method: "DELETE" })
    setPendingDeletes(prev => { const m = new Map(prev); m.delete(id); return m })
    track("history_deleted", { analysis_id_hash: hashId(id) })
  }, 5000)
  setPendingDeletes(prev => new Map(prev).set(id, timer))

  toast(t("delete_pending"), {
    action: { label: t("undo"), onClick: () => undoDelete(id) },
    duration: 5000,
  })
}

function undoDelete(id: string) {
  const timer = pendingDeletes.get(id)
  if (timer) clearTimeout(timer)
  setPendingDeletes(prev => { const m = new Map(prev); m.delete(id); return m })
  // Row re-appears: filter logic excludes ids in pendingDeletes
}
```

Unmount cleanup: in `useEffect` cleanup, flush pending timers by firing the DELETE immediately (do NOT silently drop them; the user moved away expecting deletion to commit). Alternative: clear timers and not commit; chosen behavior: commit-on-unmount because the user already saw the row disappear.

#### 5.15 Refactor existing consumers

- `src/components/recent-analyses.tsx`: convert from inline rendering to thin wrapper that fetches first 10 server-side then mounts `<AnalysesList compact limit={10} showActions={false} initialItems={...} viewAllHref="/history" />`.
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

- `history_analysis_opened` (props: `analysis_id_hash`, `tier`)
- `history_csv_downloaded` (props: `analysis_id_hash`, `from_detail` boolean)
- `history_json_downloaded`
- `history_excel_downloaded`
- `history_deleted` (props: `analysis_id_hash`, `committed` boolean - true after timer fires)
- `history_delete_undone` (props: `analysis_id_hash`)

If there's an allowed-events whitelist (check `src/lib/track.ts` or equivalent), add these entries.

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
- TC-HISTORY-008: Detail view comments table virtualizes for >5K rows (closes legacy TC-0039)
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

Unmount: flush pending timers by firing the DELETE immediately
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
| Delete during undo window: user closes tab | flush pending timer in unmount cleanup |
| Delete after row already gone (race) | server returns `{ deleted: 0 }` - silent success, no error toast |
| Storage upload fails (PR 1 write) | log warning, fall back to inline (truncate comments array if necessary); the row save still succeeds with whatever fits, aggregates always persist |
| Storage delete fails (DELETE side-effect) | log warning, swallow; orphan blobs are non-critical |

## 8. Performance + cost

- Serialized `StoredComment[]` for a typical video (200-500 comments) ≈ 50-200 KB. Well within inline JSONB.
- 5MB threshold ≈ 12-15K comments typical (varies with comment length). Pro tier max is 100K comments; ~10-30% of Pro extracts will route to blob.
- Blob storage cost: ~$0.021/GB/month on Supabase. 1000 Pro extracts averaging 8MB each = 8GB = $0.17/month. Negligible.
- Detail view server render: 1 DB row read + optional 1 blob fetch. Cached `getUser`. Should TTFB < 250ms warm.
- Comments table virtualization: only ~20 DOM nodes regardless of 50K rows.
- No new DB indexes needed: lookups by `(user_id, processed_at desc)` already indexed; lookups by `id` use PK.

## 9. Security

- RLS unchanged; new columns inherit row policy.
- Storage bucket `analyses-comments` is private; service-role only access. No public reads. URL-guessing attack surface: zero (no public URL).
- Authorization for blob reads: gate happens at the row-level SELECT; if RLS denied, blob is never fetched.
- Comment text written from extract path is user-supplied YT comment content. NEVER rendered as HTML on detail view; always rendered as text content with React's automatic escaping. The CSV/JSON/Excel export reuses existing serialization; CSV path already has injection-safe formula prefix handling (verify in code review).
- New analytics event payloads: hash analysis_id (e.g. first 8 chars of sha256) to avoid leaking raw UUIDs into analytics service.

## 10. Out of scope hardening / file-touchpoint contract

May edit:

- `supabase/migrations/03_analyses_comments.sql` (new)
- `src/lib/analyses.ts` (extend types, add `computeExpiresAt`, `getAnalysisById`; update `saveAnalysis`, `purgeExpiredAnalyses`)
- `src/lib/comments.ts` (new: `StoredComment` type)
- `src/lib/supabase/storage.ts` (new: `uploadCommentsBlob`, `downloadCommentsBlob`, `deleteCommentsBlob`)
- `src/app/api/extract/route.ts` (pass `comments` + `tier` to `saveAnalysis`)
- `src/app/api/analyses/[id]/route.ts` (add `GET`)
- `src/app/api/export/route.ts` (accept `analysisId`)
- `src/app/[locale]/(app)/history/[id]/{page,loading,not-found}.tsx` (new)
- `src/app/[locale]/(app)/history/history-client.tsx` (refactor to use unified component)
- `src/components/analyses-list.tsx` (new)
- `src/components/recent-analyses.tsx` (refactor)
- `src/components/analysis-detail-view.tsx` (new)
- `src/components/comments-table.tsx` (new, virtualized)
- `src/components/sentiment-panel.tsx` (new, extracted from tubemine.tsx analytics block)
- `src/components/emoji-panel.tsx` (new, extracted from tubemine.tsx analytics block)
- `src/components/tubemine.tsx` (only the analytics-render block: swap inline JSX for new component imports; do NOT modify extract flow, useEffect chain, or state machine)
- `messages/{en,ru}.json` (new keys under `history_detail`)
- `src/lib/track.ts` (if exists; add new event names to whitelist)
- `src/components/__tests__/*` + `src/lib/__tests__/*`
- `package.json` (add `@tanstack/react-virtual` dependency)

MUST NOT touch:

- `src/components/site-header*.tsx` (TUB-30 done)
- `src/app/[locale]/pricing/page.tsx` (TUB-32 territory)
- `src/app/[locale]/login/page.tsx` (TUB-32 territory)
- `src/app/[locale]/{docs,changelog}/page.tsx` (TUB-31 done)
- `src/components/tubemine.tsx` extract flow (TUB-33 territory; only analytics-render block extraction permitted)
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
6. Comments table renders 10K+ rows without DOM bloat (virtualized)
7. Legacy rows (comments IS NULL) render gracefully with placeholder + disabled downloads
8. RLS confirmed: user A cannot access user B's analysis
9. Mobile (375px) usable on detail view
10. All TC-HISTORY-001..010 pass on prod
