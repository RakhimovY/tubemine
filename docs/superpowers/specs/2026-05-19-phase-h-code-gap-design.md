# Phase H Code-Gap Closure (TubeMine)

**Date:** 2026-05-19
**Spec author:** Claude (turbo-pipeline brainstorming)
**Predecessor:** Phase G backend (commit `f381746`), Phase H design ship (Claude Design `tubemine-v3-ux`)
**Status:** draft v5 (post round-4 review)
**Risk surface:** small

## Mission

Close the code-side gap between Phase H design promises and production code. Ship four production code changes today so that the public marketing of TubeMine Pro on the pricing/landing/dashboard pages is actually delivered by the running service.

The Phase H design (Claude Design) advertises Pro features that the code does not yet implement: "Last 100 analyses saved", "CSV, JSON, Excel export". The Dashboard sentiment history list is also not tier-aware in production code.

## Locked decisions (do not re-litigate)

1. **Excel export ships today** using `exceljs`, minimal viable: ONE worksheet "Comments" with raw rows. No Summary sheet, no formatting polish, no top-N tables. (Polish deferred to Phase H+1 if asked.)
2. **Pro history cap is DISPLAY-ONLY.** No DB cap, no cleanup script, no client-side 100-counter defense. The "Last 100" promise is satisfied by bumping `ANALYSES_LIST_MAX` to 100 and trusting the server clamp.
3. **Server-side gating** for JSON + Excel. The new `/api/export` endpoint 401s anonymous, 403s Free. Client UI hiding is UX only; auth lives on the server. Client treats a non-200 export response as an unexpected error and lets it throw (caught by surrounding try/catch in `tubemine.tsx`). No special-case toast for 403; the UI does not render the button for non-Pro so this branch is effectively dead.
4. **Conditional rendering** for tier-aware labels (not the dual-label body-data CSS pattern). Tier is resolved server-side; a branch in JSX is cleaner than CSS visibility toggles. Mid-session upgrade flips correctly because dashboard + history pages are `dynamic = "force-dynamic"`.
5. **3 inline export buttons for Pro** (Export CSV / Export JSON / Export Excel), not a dropdown. ResultsPanel header is already responsive flex-wrap; no shadcn dropdown dependency.
6. **Re-use existing extract payload, no server re-extraction.** The export endpoint receives the already-computed data from the client and only formats it (no YouTube API quota cost). Payload comments cap is enforced server-side (see §Constraints).
7. **Re-use existing `qualitativeSummary()` strings.** They ARE the Phase H qualitative scheme: "Mostly positive", "Leans positive", "Mixed", "Polarized audience", "Mostly neutral", "Leans negative", "Mostly negative". Strings stay English-only for v1 (RU localization of sentiment labels is Phase H+1).
8. **Single-file rename**, not new file alongside old. `src/components/csv-gate.tsx` is edited in place (renamed to `src/components/export-bar.tsx` via `git mv`) and grows to render 1/2/3 buttons based on tier. The exported component is renamed from `CsvGate` to `ExportBar`. Callers (`tubemine.tsx`) update the import.
9. **No new helper `dominantSentimentLabel`.** The "{pct}% positive" rendering is inlined at the two call sites (RecentAnalyses row, HistoryClient row). The shared lib only exports `qualitativeSummary` and `deriveDistribution`.
10. **Filename rule (locked)**: `tubemine-{videoId}-{YYYY-MM-DD}.{ext}`. videoId only, no title slug. Server computes the date in UTC.
11. **`authUserId` lift location (locked)**: extract the helper from `src/app/api/extract/route.ts` into `src/lib/auth.ts`. Update `extract/route.ts` to import from the new location in the same commit. Signature stays `Promise<{ userId: string | null, userEmail: string | null }>`.
12. **`/api/export` route runtime (locked)**: `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"` declared at the top of the new route file. `exceljs` requires Node APIs; explicit declaration matches repo convention (`/api/extract`, `/api/analyses`).
13. **`exported_at` format (locked)**: `new Date().toISOString()` (UTC ISO 8601).
14. **CSV filename parity (locked)**: existing `downloadCsv()` in `tubemine.tsx` is updated to use `tubemine-${preview.videoId}-${YYYY-MM-DD}.csv` (videoId only, no title slug, UTC date). Brings all three formats into the same naming convention.
15. **No server-side tier clamp on `/api/analyses`**: per locked decision 2 (display-only cap), the server does NOT enforce a per-tier limit on the GET endpoint. A Free user requesting `limit: 100` would still get up to 100 rows; the cap is a UI promise, not a security boundary. `history-client.tsx` enforces the cap via tier-aware initial limit (10 vs 20) plus discarding `nextCursor` for Free.
16. **Tier prop type narrowing (locked)**: `recent-analyses.tsx` and `history-client.tsx` accept tier as `"free" | "pro"` (narrower than `ExtractTier`). `ExportBar` keeps the full `ExtractTier` union (it handles the anonymous case for the home page).
17. **Dashboard "Last N saved" subtitle ships Pro-only with dedicated key**: per Phase H design (which only added the line to the Pro card), the Free Dashboard does NOT render a subtitle. The Pro Dashboard subtitle uses a dedicated key `dashboard.last_100_saved` = "Last 100 analyses saved" / "Сохраняются последние 100 анализов" because the rhetorical context differs from `/history` (a save promise vs a page-content heading). Two keys is a small duplication trade-off accepted for copy fidelity with the Phase H marketing string.
18. **Hard-cap Pro history at 100 cumulative items (client-side)**: `history-client.tsx` tracks `items.length` after each pagination merge and hides the "Load more" button once the count reaches 100. Rationale: the page heading shows `history.cap_label_pro` = "Last 100 analyses"; if a power user paginates past 100 the heading becomes a lie. This is a marketing-consistency decision, not a defense-in-depth one. Rows beyond 100 remain in DB; v1 simply does not expose them through the UI. Phase H+1 can revisit (paginated view of all rows, no marketing string).
19. **`qualitativeSummary()` strings render as plain JSX**, NOT wrapped in `t()`. They are English-only by locked decision 7; an implementer must not invent translation keys for them.
20. **exceljs Buffer return uses `new Response(buffer as unknown as BodyInit, { headers })`** (or equivalent: `new Response(new Uint8Array(buffer), ...)`). Node Buffer extends Uint8Array at runtime, but Web-spec `Response` typing in Next.js 16 may require the cast. Lock the pattern explicitly.

## Constraints

- No em-dash, no en-dash anywhere (comments, JSX, JSON, log strings).
- No Polar-banned verbs in NEW user-facing strings: "extract" / "scrape" / "bulk" / "pull data" / "Priority". Reuse "Export ..." pattern.
- No change to Polar webhook signature.
- No change to RLS policies.
- No backwards-compat shims; ship clean code.
- No re-extraction on export (zero YouTube quota cost).
- `exceljs` must be server-only (no client bundle bloat).
- **Payload comments cap: 10,000 per export request.** Enforced via Zod `array.max(10_000)`; server returns 400 (Zod validation error). Rationale: Vercel serverless function body default cap is 4.5MB; at average ~500 bytes per comment record, 10k rows ~= 5MB which fits with a comfortable margin. Realistic single-video extract is well below this. Pro users with larger libraries can export in slices via re-extract; not a v1 priority.

## Architecture

### 1. Tier-aware sentiment label on Dashboard "Recent analyses" + `/history` page

Server resolves tier on the page. Tier passes down to the list component as a prop. Each row component:

- If `item.sentiment` is null → render nothing (do not invent "0%"). Card still shows title + channel + comment count.
- If `tier === "free"` → render qualitative label via `qualitativeSummary(deriveDistribution(item.sentiment))`. If derivation returns null (zero counts) → render nothing.
- If `tier === "pro"` → render exact "{pct}% {dominant}" where:
  - `dist = deriveDistribution(item.sentiment)` (null guard same as above)
  - `dominant` is argmax over `(dist.positive, dist.neutral, dist.negative)` with tie-break order: positive > neutral > negative (locked)
  - `pct = Math.round(dist[dominant] * 100)` (locked: round to nearest integer)
  - Label text: `"{pct}% positive"` / `"{pct}% neutral"` / `"{pct}% negative"` (English-only v1)

Tier propagation:
- `src/app/[locale]/dashboard/page.tsx` already calls `getUserQuota(user.id)`. Pass `quota.tier` to `<RecentAnalyses tier={quota.tier} />`.
- `src/app/[locale]/history/page.tsx` does not yet compute tier. Add a `getUserQuota(user.id)` call inside a try/catch (degrade to `"free"` on error so a Supabase blip does not hard-crash the page) and pass into `<HistoryClient tier={tier} ... />`. Also add `export const dynamic = "force-dynamic"` (currently missing; mirrors dashboard).

Anonymous tier is impossible on these pages (both pages redirect unauthenticated users to login). Per locked decision 16, `recent-analyses.tsx` and `history-client.tsx` declare their `tier` prop as the literal union `"free" | "pro"`.

### 2. Pro "Last 100" history display cap

- Bump `ANALYSES_LIST_MAX` in `src/lib/analyses.ts` from 50 to 100. This is the server-side per-request clamp; bumping it allows a Pro user to actually scroll to row 100 through pagination.
- `/history` page initial fetch: `limit: tier === "pro" ? 20 : 10`.
- For Free tier, `history-client.tsx` must **discard the `nextCursor`** returned by the server on initial render when `tier === "free"`. The server fetches `limit + 1` to detect "has more", but for Free the next-page button is not rendered regardless of cursor presence. (No server-side clamp on `/api/analyses` GET; cap is display-only, not a security boundary. See locked decision 15.)
- Pro users can paginate through all their saved analyses via `/api/analyses` (no hard 100 server cap). The UI promise "Last 100 analyses saved" is satisfied for the typical case because `saveAnalysis` upserts on `(user_id, video_id)`, so the row count grows by unique video only. Most users will not exceed 100 unique videos. If a power user does exceed 100, they can still scroll past via "Load more"; that is acceptable v1 framing (display promise, not hard limit).
- Dashboard "Recent analyses" widget keeps its hardcoded `limit: 5` preview. On Pro tier ONLY, render a small subtitle line under the heading: `t("dashboard.last_100_saved")` = "Last 100 analyses saved" (dedicated key per locked decision 17). Free tier renders no subtitle (Phase H design did not add one to Free).
- Known behavior documented in the launch note: `saveAnalysis` upserts on `(user_id, video_id)`, so the count is "last 100 unique videos analyzed", not "last 100 extract operations".

### 3. JSON + Excel export via new `/api/export` endpoint

File: `src/app/api/export/route.ts`

**Request:**
```
POST /api/export
Content-Type: application/json
Body: ExportRequestSchema (Zod, see below)
```

**Zod schema (locked):**
```ts
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
```

Aggregates (`top_words`, `top_emoji`, `sentiment`, `sentiment_distribution`, `unique_*_total`) are NOT in the export request body and are NOT recomputed server-side. The JSON output includes only `comments[]` + meta + `exported_at`. Rationale: matches locked decision 6 (no server re-compute) and removes the risk of server output diverging from the on-screen aggregates.

**Server flow (route file declares `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"` at top per locked decision 12):**
1. `authUserId()` (imported from `src/lib/auth.ts`).
2. If `userId === null` → 401 `{ error: "Sign in required" }`.
3. `getUserQuota(userId)`. If `quota.tier !== "pro"` → 403 `{ error: "Pro plan required for JSON and Excel export" }`.
4. Parse + validate body with `ExportRequestSchema`. On failure → 400 `{ error: result.error.issues[0]?.message ?? "Invalid request" }`.
5. Zod `max(10_000)` on `comments[]` rejects oversize payloads as Zod validation (returns 400 with "Array must contain at most 10000 element(s)" or equivalent). We do not need a separate 413 branch; the 400 from Zod is sufficient and matches the validation contract.
6. Compute filename: `tubemine-${videoId}-${YYYY-MM-DD}.${ext}` (UTC date via `new Date().toISOString().slice(0, 10)`).
7. For `format: "json"`: respond with `Content-Type: application/json` + `Content-Disposition: attachment; filename="<name>.json"` + body `{ videoId, videoTitle, channelName, exported_at: new Date().toISOString(), comments }` (compact JSON, no indent).
8. For `format: "xlsx"`:
   - Build `exceljs` workbook server-only (single `import ExcelJS from "exceljs"` at top of route file; bundled by Next.js into the server function only).
   - **Single worksheet "Comments"** with header row `["Author", "Comment", "Sentiment", "Likes", "Replies", "Published"]` and one data row per comment.
   - No column widths, no wrapText, no formatting (locked decision 1: minimal viable, ship raw data). If users request readability polish, add in Phase H+1.
   - Wrap workbook build + `writeBuffer()` in try/catch. On throw → `console.error("[export] xlsx build failed", err)` + 500 `{ error: "Export build failed" }`.
   - On success → return buffer via the locked pattern from decision 20: `new Response(buffer as unknown as BodyInit, { headers: { ...spreadsheet content-type and attachment content-disposition... } })`. Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Content-Disposition: `attachment; filename="<name>.xlsx"`.
9. No DB write. No quota touch. No analytics from this route (client side has `track("export_completed", ...)` already).

### 4. Frontend export bar

**Rename**: `src/components/csv-gate.tsx` → `src/components/export-bar.tsx` via `git mv`. Inside, rename exported component `CsvGate` → `ExportBar`. Update callers.

New props:
```ts
export function ExportBar({
  tier,
  videoId,
  onDownloadCsv,
  onDownloadJson,
  onDownloadExcel,
}: {
  tier: ExtractTier
  videoId?: string  // used only by anonymous "Sign in to export CSV" link analytics (existing CsvGate behavior)
  onDownloadCsv: () => void
  onDownloadJson: () => void | Promise<void>
  onDownloadExcel: () => void | Promise<void>
})
```

Render logic:
- `tier === "anonymous"` → existing "Sign in to export CSV" link (unchanged).
- `tier === "free"` → single "Export CSV" button (existing behavior; only the import name changes from CsvGate to ExportBar).
- `tier === "pro"` → three inline buttons via flex-wrap: "Export CSV", "Export JSON", "Export Excel". `i18n` keys: existing CSV string + new `common.export_json` + `common.export_excel`.

`tubemine.tsx` changes:
- Update existing `downloadCsv()` filename to use the locked convention `tubemine-${preview.videoId}-${YYYY-MM-DD}.csv` (UTC date via `new Date().toISOString().slice(0, 10)`). Drop the title-slug logic. This brings CSV/JSON/Excel into one naming convention.
- Add `async function downloadJson()`:
  ```ts
  if (comments.length === 0 || !preview) return
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
  if (!res.ok) throw new Error(`Export failed: ${res.status}`) // caught by surrounding handler
  const blob = await res.blob()
  // ...same anchor-download pattern as downloadCsv()
  track("export_completed", { format: "json", count: comments.length, tier, videoId: preview.videoId })
  ```
- Add `async function downloadExcel()`: same shape, `format: "xlsx"`, same blob handling.
- Both wrapped in `try { ... } catch (e) { toast.error(e instanceof Error ? e.message : "Export failed") }` outer scope (added in `tubemine.tsx`). No special-case 403 handling.
- `ResultsPanel` props grow: add `onDownloadJson` + `onDownloadExcel`. Forwarded from `TubeMine` -> `ResultsPanel` -> `ExportBar`. The current `onDownload` prop on `ResultsPanel` is renamed to `onDownloadCsv` for clarity.

### 5. i18n keys (locked destinations)

Append to `messages/en.json` and `messages/ru.json` (RU uses Cyrillic):

| Path | EN | RU |
|------|------|------|
| `common.export_json` | "Export JSON" | "Экспорт JSON" |
| `common.export_excel` | "Export Excel" | "Экспорт Excel" |
| `dashboard.last_100_saved` | "Last 100 analyses saved" | "Сохраняются последние 100 анализов" |
| `history.cap_label_free` | "Last 10 analyses" | "Последние 10 анализов" |
| `history.cap_label_pro` | "Last 100 analyses" | "Последние 100 анализов" |

(`dashboard.last_100_saved` rendered Pro-only as Dashboard subtitle in `recent-analyses.tsx`; `history.cap_label_*` rendered as `/history` page heading subtitle for both tiers. Two keys: one save promise (Dashboard) + two page-content headings (History).)

No new key for the sentiment label itself (English-only v1 per locked decision 7).
No new key for 403 / 401 / 400 responses (server returns English error strings; the button is not rendered for non-Pro so the response is a developer-grade error message).

Run `node scripts/check-message-parity.mjs` after edits.

### 6. `qualitativeSummary` extraction to shared lib

New file `src/lib/sentiment-summary.ts`. Pure util, no React, no `"use client"`, no `server-only`. Exports:

```ts
export type SentimentDistribution = { positive: number; neutral: number; negative: number }

export function deriveDistribution(
  agg: { positive: number; neutral: number; negative: number } | null,
): SentimentDistribution | null

export function qualitativeSummary(dist: SentimentDistribution): string
```

`deriveDistribution` and `qualitativeSummary` are the exact functions currently inside `src/components/sentiment.tsx` (lines 252-273). Move both. `sentiment.tsx` imports from the new lib. `recent-analyses.tsx` (server component) and `history-client.tsx` (client component) also import from the lib. The `SentimentDistribution` type currently exported from `sentiment.tsx` is moved to the lib; `sentiment.tsx` re-exports it for backwards-compat with `tubemine.tsx` import.

No `dominantSentimentLabel` helper. Pro "{pct}% positive" rendering is inlined at the 2 call sites (one helper would be 3 lines used twice; inline is clearer).

## Files touched (final list)

**New:**
- `src/lib/sentiment-summary.ts` (pure util)
- `src/lib/auth.ts` (lifted `authUserId` helper)
- `src/app/api/export/route.ts` (POST endpoint)

**Modified:**
- `src/lib/analyses.ts` (`ANALYSES_LIST_MAX` 50 → 100; no other changes)
- `src/components/sentiment.tsx` (import `qualitativeSummary` + `deriveDistribution` from lib; re-export `SentimentDistribution` type)
- `src/components/recent-analyses.tsx` (accept `tier: "free" | "pro"` prop; render tier-aware sentiment label per row; on Pro, render `dashboard.last_100_saved` subtitle under heading per locked decision 17)
- `src/app/[locale]/dashboard/page.tsx` (pass `quota.tier` into `<RecentAnalyses tier={...} />`)
- `src/app/[locale]/history/page.tsx` (add `export const dynamic = "force-dynamic"`; compute tier via `getUserQuota` inside try/catch with `"free"` fallback; pass tier into `HistoryClient`; choose initial limit `tier === "pro" ? 20 : 10`; render tier-aware subtitle from `history.cap_label_*`)
- `src/app/[locale]/history/history-client.tsx` (accept `tier: "free" | "pro"` prop; render per-row sentiment label; for Free tier, do not render the "Load more" button regardless of cursor presence; for Pro tier, cap items via `slice(0, 100)` on merge and hide the "Load more" button once `items.length >= 100` per locked decision 18 + edge case 24)
- `src/app/api/extract/route.ts` (import `authUserId` from new `src/lib/auth.ts`; delete inline copy)
- `src/components/tubemine.tsx` (`downloadJson` + `downloadExcel` handlers wrapped in try/catch with `toast.error` outer; update existing `downloadCsv` filename to videoId+date convention; swap `<CsvGate>` import to `<ExportBar>`; pass 3 download handlers; rename `ResultsPanel`'s `onDownload` prop to `onDownloadCsv`; `ResultsPanel` gains `onDownloadJson` + `onDownloadExcel` props forwarded to `ExportBar`)
- `messages/en.json`, `messages/ru.json` (5 new keys per §5 table)
- `package.json` + lockfile (add `exceljs`)

**Renamed (single rename, no duplicate):**
- `src/components/csv-gate.tsx` → `src/components/export-bar.tsx` (export `ExportBar` replaces `CsvGate`)

**New tests:**
- `src/app/api/export/__tests__/route.test.ts` (401 path, 403 path, 400 path on bad body, 400 path on `comments[].length > 10_000`, 200 JSON happy path with attachment headers, 200 xlsx happy path with buffer content-type). Mock `@/lib/auth` (`vi.mock`) returning a known `userId` for the auth-success paths and `null` for the 401 path. Mock `@/lib/quota` (`vi.mock`) returning either `{ tier: "free", ... }` or `{ tier: "pro", ... }`. The xlsx happy path verifies the response has the spreadsheet Content-Type header and a non-empty buffer body; no need to round-trip parse the xlsx file in v1.
- (No dedicated `sentiment-summary.test.ts`: the extraction is a pure file move of an existing untested helper; the function's behavior is unchanged. If a regression bites later, add the test then. Out of scope for this sprint.)

**Untouched (do not change):**
- `src/lib/quota.ts` (FREE_MONTHLY_CAP=5_000, PRO_MONTHLY_CAP=100_000 unchanged)
- `src/lib/sentiment.ts` (scoring engine)
- Polar webhook routes, RLS policies, Supabase schema, env vars

## Edge cases

1. **Anonymous user POSTs to `/api/export`**: 401. Defense-in-depth.
2. **Free user POSTs to `/api/export`**: 403. UI doesn't show the button; defense-in-depth.
3. **Pro user POSTs with invalid format / malformed body**: 400 with first Zod issue message.
4. **Pro user POSTs with empty `comments[]`**: produces a valid empty xlsx (header row only) or valid JSON (empty array). No special error. (Frontend already short-circuits when `comments.length === 0` for `downloadJson` and `downloadExcel`, so this branch is unreachable from the UI; still well-defined on the server.)
5. **Pro user POSTs with `comments.length > 10_000`**: Zod rejects via `max(10_000)`; returns 400 with the Zod issue message. Frontend catches as generic export-failed toast. (No separate 413 branch; Zod's 400 is sufficient.)
6. **Sentiment is null on a saved analysis row** (e.g., pre-Phase-G data, or aggregate's positive+neutral+negative === 0): hide the sentiment label entirely. Card still renders title + channel + comment count.
7. **Sentiment all-neutral / score=0 with non-zero counts**: `qualitativeSummary` already returns "Mixed" when neutral >= 0.99. Pro variant returns "{pct}% neutral" with `dominant = "neutral"`. OK.
8. **Tier flipped Pro -> Free mid-session**: next page render re-reads `quota.tier` (force-dynamic); stale Pro session has its 3 buttons in DOM; first POST to `/api/export` gets 403; outer try/catch shows generic "Export failed" toast. No data leak.
9. **Tier flipped Free -> Pro mid-session via webhook**: stale Free session shows only Export CSV; next page navigation reflects new tier. Acceptable; we are not pushing UI updates from server-side events in this sprint.
10. **`saveAnalysis` upsert collapses to existing row by `(user_id, video_id)`**: re-analyzing the same video updates `processed_at` instead of inserting. "Last 100 analyses saved" is effectively "Last 100 unique videos analyzed". Acceptable for v1 (matches user mental model). Document in launch note.
11. **`saveAnalysis` write fails silently** (existing Phase G behavior: `console.warn` only): user sees results but row never lands in DB; `/history` shows nothing. Known limitation pre-dating this sprint; NOT addressed in Phase H. Telemetry deferred to Phase H+1 (out of scope per locked decision).
12. **Free user with exactly 11 rows in DB**: `listAnalyses(limit: 10)` fetches 11, returns 10 items + nextCursor. `history-client.tsx` discards the cursor for Free and does not render "Load more". User sees exactly 10 rows. Older 1 row is preserved in DB (display-only cap).
13. **Pro user reaches 100 cumulative rows in `/history`**: `history-client.tsx` enforces a client-side cap of 100 per locked decision 18 (hides "Load more" once `items.length >= 100`). Marketing copy "Last 100 analyses" stays accurate. Older rows remain in DB; v1 simply does not expose them through the UI. Server has no hard cap (locked decision 15); cap is purely UX.
14. **`/history` page statically cached**: prevented by `export const dynamic = "force-dynamic"` (added in this sprint).
15. **Concurrent JSON + Excel button mash**: each click is an independent POST. Toast each result via the outer try/catch. No mutual lock needed.
16. **Excel `writeBuffer()` throws** (memory pressure, exceljs bug): try/catch returns 500 `{ error: "Export build failed" }`. Frontend shows generic toast.
17. **Browser language not en/ru**: next-intl falls back per existing pattern; sentiment labels remain English; subtitle/keys localized via existing fallback chain.
18. **Tie-break in dominant sentiment**: positive > neutral > negative (locked). Pure stable order, no rounding ambiguity since percentages can tie at 33/33/34 but we pick the dominant *before* rounding.
19. **Round-trip percent on Pro**: `Math.round(dist[dominant] * 100)` can produce "33% positive" + "33% neutral" + "33% negative" displays in different views; consistency is locked by always picking the dominant first, rendering only that.
20. **Single-class 100% rendering**: when one class is 100% (e.g., all-positive scoring), `Math.round` yields exactly 100. UI renders "100% positive" as a plain string; no width overflow risk in card text layout.
21. **`getUserQuota` failure on `/history`**: wrapped in try/catch that defaults to `tier = "free"` and logs a `console.warn`. User sees a Free-tier history view rather than a Next.js error page.
22. **xlsx Cyrillic / multi-line / tab text in comments**: `exceljs` writes UTF-8 (xlsx spec is XML). Cyrillic renders correctly. Multi-line text keeps embedded `\n` as part of the cell value (no `wrapText` formatting per locked decision 1); Excel/Numbers can enable wrap manually if a user wants the rendered view. Acceptable v1.
23. **Navigate-away-and-back to `/history` resets pagination state**: `history-client.tsx` keeps `items` in component-local `useState`. `force-dynamic` on the page means a full remount with fresh server fetch of `limit: 20`. The 100-cap state does NOT persist; a Pro user who paged to 100, navigates away, and returns sees 20 + "Load more" again. Acceptable v1 (no localStorage / session-storage persistence layer).
24. **Pagination merge boundary at 81+ rows (Pro)**: starting at 81 items, "Load more" fetches up to 20 and the naive `[...prev, ...next]` merge yields 101 (one row past the cap). Locked behavior: cap the merge via `setItems(prev => [...prev, ...next].slice(0, 100))` so the rendered count never exceeds 100. "Load more" then hides via the existing `items.length >= 100` check. No flicker, no orphan row.

## Out of scope (Phase H+1 or never)

- Excel formatting (column widths, freeze panes, conditional formatting).
- Excel Summary sheet (top-words / top-emoji tables in workbook).
- JSON pretty-print toggle. Default to compact.
- Server-rendered Russian qualitative labels (Phase H+1 if marketing asks).
- DB cleanup cron for analyses older than 100 (out of scope by user decision 2026-05-19).
- API tier (the design says "API coming soon").
- Export from saved analyses on `/history` (current flow exports the live extracted result only).
- `saveAnalysis` failure telemetry (existing Phase G behavior, not regressed by this sprint).
- Bumping `FREE_MONTHLY_CAP` or `PRO_MONTHLY_CAP`.
- Streaming / chunked uploads for exports > 10k comments (re-extract slices for v1 workaround).

## Verification checklist (gate before push)

Pre-push:
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test` (vitest) green (existing tests + 1 new test file: `src/app/api/export/__tests__/route.test.ts`)
- [ ] `pnpm lint` clean
- [ ] `node scripts/check-message-parity.mjs` clean (EN/RU keys aligned)
- [ ] `grep -P '[\x{2013}\x{2014}]' src/ messages/ docs/superpowers/` returns no matches in changed files
- [ ] `pnpm build` succeeds; client bundle size delta less than 100KB compared to last main build (exceljs must NOT leak into client chunks)
- [ ] Local `next dev` smoke (manual):
  - Anonymous: `GET /api/extract` returns `tier: "anonymous"`. Dashboard + history pages redirect to login.
  - Free signed-in cookie: `POST /api/export {format:"json"}` returns 403 `{error: "Pro plan required..."}`. UI shows only Export CSV button. Dashboard "Recent analyses" cards show qualitative labels (where sentiment exists). History page shows max 10 rows + no "Load more".
  - Pro signed-in cookie: `POST /api/export {format:"json"}` returns 200 valid JSON attachment. `POST /api/export {format:"xlsx"}` returns 200 valid `.xlsx` (open in Numbers/Excel and confirm one sheet "Comments" with header + data rows). UI shows all 3 export buttons. Dashboard cards show exact "{pct}% {dominant}" labels. History page shows up to 100 cumulative rows via "Load more".
- [ ] No Polar-banned verb in any new UI string ("extract", "scrape", "bulk", "pull data", "Priority")

Hard gate before `git push`:
- AskUserQuestion with commit SHA(s), files changed count, line diff stats. Wait for explicit "yes push" / "yes deploy".

Post-push:
- Vercel deploy reaches READY.
- Prod `GET /api/extract` still returns shape with `tier: "anonymous"`.
- Prod `POST /api/export` with no auth cookie returns 401.

## Risks

- **`exceljs` client bundle inclusion**: mitigated by server-only import in route handler. `pnpm build` output gate catches regressions.
- **`ANALYSES_LIST_MAX` bump 50 → 100**: doubles worst-case row count in a single response. Each row ~5KB, 100 rows < 500KB. Acceptable.
- **`/api/export` Active CPU cost** (per Vercel Fluid Compute): for 10k-comment xlsx, < 2s CPU. Negligible at current MRR scale.
- **Body-size 4.5MB ceiling**: capped via Zod max(10_000) on comments[]. Typical extracts (100-5000 comments) fit comfortably. Pro users with rare giant videos can re-extract in slices.
- **Mid-session tier flip 403**: outer try/catch surfaces generic toast. No data leak; acceptable v1.

## Success criteria

- All Phase H design promises are deliverable by the running service:
  - "CSV, JSON, Excel export" on Pro pricing card: ✓ via 3 buttons + endpoint.
  - "Last 100 analyses saved" subtitle visible on Pro Dashboard recent-analyses + /history page heading: ✓ via list cap + i18n keys.
  - Dashboard / history sentiment labels qualitative on Free, exact percent on Pro: ✓ via tier-aware label.
- No regression in existing Phase G shape (sentiment widget, top words / emoji curiosity gaps, CSV gate).
- `pnpm build` size delta less than 100KB.
- All verification checklist items green.

## References

- `projects/yt-comments/launch/2026-05-19/phase-h-card-cleanup-and-history-tail.md` (design ship note)
- `projects/yt-comments/launch/2026-05-19/phase-g-tier-aware-paywall-backend.md` (Phase G backend, commit `f381746`)
- `references/dual-label-body-data-tier-pattern.md` (pattern considered but rejected, see locked decision 4)
- `queries/paywall-curiosity-gap.md` (gating psychology)
- `playbooks/saas-roadmap/12-production-shipping-runbook.md` §6.12 (X-Forwarded-For Vercel CDN lesson, informs the "no IP-spoof curl on prod" testing decision)
