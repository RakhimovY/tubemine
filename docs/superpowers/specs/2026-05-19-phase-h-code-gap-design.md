# Phase H Code-Gap Closure (TubeMine)

**Date:** 2026-05-19
**Spec author:** Claude (turbo-pipeline brainstorming)
**Predecessor:** Phase G backend (commit `f381746`), Phase H design ship (Claude Design `tubemine-v3-ux`)
**Status:** draft v2 (post round-1 review)
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

## Constraints

- No em-dash, no en-dash anywhere (comments, JSX, JSON, log strings).
- No Polar-banned verbs in NEW user-facing strings: "extract" / "scrape" / "bulk" / "pull data" / "Priority". Reuse "Export ..." pattern.
- No change to Polar webhook signature.
- No change to RLS policies.
- No backwards-compat shims; ship clean code.
- No re-extraction on export (zero YouTube quota cost).
- `exceljs` must be server-only (no client bundle bloat).
- **Payload comments cap: 10,000 per export request.** Server returns 413 if `payload.comments.length > 10_000`. Rationale: Vercel serverless function body default cap is 4.5MB; at average ~500 bytes per comment record, 10k rows ~= 5MB which fits with a comfortable margin. Realistic single-video extract is well below this. Pro users with larger libraries can export in slices via re-extract; not a v1 priority.

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
- `src/app/[locale]/history/page.tsx` does not yet compute tier. Add a `getUserQuota(user.id)` call (cheap, single SELECT, same RLS-protected pattern) and pass into `<HistoryClient tier={tier} ... />`. Also add `export const dynamic = "force-dynamic"` (currently missing; mirrors dashboard).

Anonymous tier is impossible on these pages (both pages redirect unauthenticated users to login). Components type tier as `"free" | "pro"` for these renders.

### 2. Pro "Last 100" history display cap

- Bump `ANALYSES_LIST_MAX` in `src/lib/analyses.ts` from 50 to 100. This is the server-side per-request clamp; bumping it allows a Pro user to actually scroll to row 100 through pagination.
- `/history` page initial fetch: `limit: tier === "pro" ? 20 : 10`.
- For Free tier, `history-client.tsx` must **discard the `nextCursor`** returned by the server on initial render when `tier === "free"`. The server fetches `limit + 1` to detect "has more", but for Free the next-page button is not rendered regardless of cursor presence. (Server caps any future Free `/api/analyses` GET request to `limit: 10` as a server-side check; see below.)
- Server-side `/api/analyses` GET endpoint must enforce per-tier limit cap: Free max 10, Pro max 100. If client requests `limit: 100` as Free, clamp to 10 server-side. This is the only server-side enforcement of "Last N" (display-only per locked decision 2). No DB delete.
- Dashboard "Recent analyses" widget keeps its hardcoded `limit: 5` preview. On Pro tier, render an additional small subtitle line under the heading: `t("dashboard.last_100_analyses")` = "Last 100 analyses saved". Free tier: render `t("dashboard.last_10_analyses")` = "Last 10 analyses saved" subtitle. (Locked destination: subtitle in `recent-analyses.tsx`, not a separate plan card.)
- Known behavior to document in the launch note (not a code change): `saveAnalysis` upserts on `(user_id, video_id)`, so the "100" count is "last 100 unique videos analyzed", not "last 100 extract operations". Acceptable v1 framing; matches the marketing string "100 analyses saved" naturally because re-analyzing the same video produces one logical "analysis" entry per video.

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

Note: `top_words`, `top_emoji`, `sentiment`, `sentiment_distribution`, `unique_*_total` are NOT in the export request body. They are derived again server-side from `comments[]` for the JSON output (re-using `analyzeTopWords`, `analyzeTopEmojis`, `scoreCommentsSentiment` from existing libs). Reason: the client-posted aggregates cannot be trusted for shape, and recomputing from comments is cheap (single in-process pass) and matches what the user actually sees. Wait, no: that contradicts locked decision 6 ("no server re-compute"). Override: skip recomputing aggregates; for JSON output, only include `comments[]` + `videoId` + `videoTitle` + `channelName` + `exported_at` ISO timestamp. Simpler, smaller, less risk of mismatch with what the client just saw.

**Server flow:**
1. `authUserId()` (now imported from `src/lib/auth.ts`).
2. If `userId === null` → 401 `{ error: "Sign in required" }`.
3. `getUserQuota(userId)`. If `quota.tier !== "pro"` → 403 `{ error: "Pro plan required for JSON and Excel export" }`.
4. Parse + validate body with `ExportRequestSchema`. On failure → 400 `{ error: "<first zod issue message>" }`.
5. If `body.comments.length > 10_000` → 413 `{ error: "Export size limited to 10,000 comments per request" }` (also enforced by Zod max).
6. Compute filename: `tubemine-${videoId}-${YYYY-MM-DD}.${ext}` (UTC date, derived server-side).
7. For `format: "json"`: respond with `Content-Type: application/json` + `Content-Disposition: attachment; filename="<name>.json"` + body `{ videoId, videoTitle, channelName, exported_at, comments }` (compact JSON, no indent).
8. For `format: "xlsx"`:
   - Build `exceljs` workbook server-only (single `import ExcelJS from "exceljs"` at top of route file; bundled by Next.js into the server function only).
   - **Single worksheet "Comments"** with header row `["Author", "Comment", "Sentiment", "Likes", "Replies", "Published"]` and one data row per comment.
   - Wrap workbook build + `writeBuffer()` in try/catch. On throw → `console.error("[export] xlsx build failed", err)` + 500 `{ error: "Export build failed" }`.
   - On success → return buffer with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` + `Content-Disposition: attachment; filename="<name>.xlsx"`.
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
  videoId?: string
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
- Existing `downloadCsv()` unchanged.
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
| `dashboard.last_100_analyses` | "Last 100 analyses saved" | "Сохраняются последние 100 анализов" |
| `dashboard.last_10_analyses` | "Last 10 analyses saved" | "Сохраняются последние 10 анализов" |
| `history.cap_label_free` | "Last 10 analyses" | "Последние 10 анализов" |
| `history.cap_label_pro` | "Last 100 analyses" | "Последние 100 анализов" |

(`dashboard.last_*` rendered as small subtitle in `recent-analyses.tsx`; `history.cap_label_*` rendered as subtitle on `/history` page heading.)

No new key for the sentiment label itself (English-only v1 per locked decision 7).
No new key for 403 / 401 / 400 / 413 responses (server returns English error strings; no client localization since the button is not rendered for non-Pro and the response is a developer-grade error message anyway).

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
- `src/components/recent-analyses.tsx` (accept `tier` prop, render tier-aware sentiment label, render tier-aware "Last 10/100 analyses saved" subtitle)
- `src/app/[locale]/dashboard/page.tsx` (pass `quota.tier` into `<RecentAnalyses tier={...} />`)
- `src/app/[locale]/history/page.tsx` (add `export const dynamic = "force-dynamic"`; compute tier via `getUserQuota`; pass tier into `HistoryClient`; choose initial limit `tier === "pro" ? 20 : 10`; render tier-aware subtitle from `history.cap_label_*`)
- `src/app/[locale]/history/history-client.tsx` (accept `tier` prop; render per-row sentiment label; for Free tier, do not render the "Load more" button regardless of cursor presence)
- `src/app/api/extract/route.ts` (import `authUserId` from new `src/lib/auth.ts`; delete inline copy)
- `src/app/api/analyses/route.ts` (clamp `limit` to tier-aware max: Free=10, Pro=100, before passing to `listAnalyses`)
- `src/components/tubemine.tsx` (`downloadJson`, `downloadExcel` handlers; outer try/catch with toast.error; swap `<CsvGate>` import to `<ExportBar>`; pass 3 download handlers; rename `ResultsPanel`'s `onDownload` prop to `onDownloadCsv`)
- `messages/en.json`, `messages/ru.json` (6 new keys)
- `package.json` + lockfile (add `exceljs`)

**Renamed (single rename, no duplicate):**
- `src/components/csv-gate.tsx` → `src/components/export-bar.tsx` (export `ExportBar` replaces `CsvGate`)

**New tests:**
- `src/lib/__tests__/sentiment-summary.test.ts` (qualitative labels for representative distributions; `deriveDistribution` with zero / null aggregate)
- `src/app/api/export/__tests__/route.test.ts` (401 path, 403 path, 400 path on bad body, 413 path on too-large `comments[]`, 200 JSON happy path, 200 xlsx happy path with buffer content-type)

**Untouched (do not change):**
- `src/lib/quota.ts` (FREE_MONTHLY_CAP=5_000, PRO_MONTHLY_CAP=100_000 unchanged)
- `src/lib/sentiment.ts` (scoring engine)
- Polar webhook routes, RLS policies, Supabase schema, env vars

## Edge cases

1. **Anonymous user POSTs to `/api/export`**: 401. Defense-in-depth.
2. **Free user POSTs to `/api/export`**: 403. UI doesn't show the button; defense-in-depth.
3. **Pro user POSTs with invalid format / malformed body**: 400 with first Zod issue message.
4. **Pro user POSTs with empty `comments[]`**: produces a valid empty xlsx (header row only) or valid JSON (empty array). No special error. (Frontend already short-circuits when `comments.length === 0` for `downloadJson` and `downloadExcel`, so this branch is unreachable from the UI; still well-defined on the server.)
5. **Pro user POSTs with `comments.length > 10_000`**: 413 with payload-size error message. Frontend catches as generic export-failed toast.
6. **Sentiment is null on a saved analysis row** (e.g., pre-Phase-G data, or aggregate's positive+neutral+negative === 0): hide the sentiment label entirely. Card still renders title + channel + comment count.
7. **Sentiment all-neutral / score=0 with non-zero counts**: `qualitativeSummary` already returns "Mixed" when neutral >= 0.99. Pro variant returns "{pct}% neutral" with `dominant = "neutral"`. OK.
8. **Tier flipped Pro -> Free mid-session**: next page render re-reads `quota.tier` (force-dynamic); stale Pro session has its 3 buttons in DOM; first POST to `/api/export` gets 403; outer try/catch shows generic "Export failed" toast. No data leak.
9. **Tier flipped Free -> Pro mid-session via webhook**: stale Free session shows only Export CSV; next page navigation reflects new tier. Acceptable; we are not pushing UI updates from server-side events in this sprint.
10. **`saveAnalysis` upsert collapses to existing row by `(user_id, video_id)`**: re-analyzing the same video updates `processed_at` instead of inserting. "Last 100 analyses saved" is effectively "Last 100 unique videos analyzed". Acceptable for v1 (matches user mental model). Document in launch note.
11. **`saveAnalysis` write fails silently** (existing Phase G behavior: `console.warn` only): user sees results but row never lands in DB; `/history` shows nothing. Known limitation pre-dating this sprint; NOT addressed in Phase H. Telemetry deferred to Phase H+1 (out of scope per locked decision).
12. **Free user with exactly 11 rows in DB**: `listAnalyses(limit: 10)` fetches 11, returns 10 items + nextCursor. `history-client.tsx` discards the cursor for Free and does not render "Load more". User sees exactly 10 rows. Older 1 row is preserved in DB (display-only cap).
13. **Pro user reaches 100 cumulative rows in `/history`**: server clamps any larger fetch back to 100 via tier-aware limit. `history-client.tsx` does not need a client-side counter (locked decision 2 removed it).
14. **`/history` page statically cached**: prevented by `export const dynamic = "force-dynamic"` (added in this sprint).
15. **Concurrent JSON + Excel button mash**: each click is an independent POST. Toast each result via the outer try/catch. No mutual lock needed.
16. **Excel `writeBuffer()` throws** (memory pressure, exceljs bug): try/catch returns 500 `{ error: "Export build failed" }`. Frontend shows generic toast.
17. **Browser language not en/ru**: next-intl falls back per existing pattern; sentiment labels remain English; subtitle/keys localized via existing fallback chain.
18. **Tie-break in dominant sentiment**: positive > neutral > negative (locked). Pure stable order, no rounding ambiguity since percentages can tie at 33/33/34 but we pick the dominant *before* rounding.
19. **Round-trip percent on Pro**: `Math.round(dist[dominant] * 100)` can produce "33% positive" + "33% neutral" + "33% negative" displays in different views; consistency is locked by always picking the dominant first, rendering only that.

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
- [ ] `pnpm test` (vitest) green (existing tests + 2 new test files in this sprint)
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
