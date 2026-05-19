# Phase H Code-Gap Closure (TubeMine)

**Date:** 2026-05-19
**Spec author:** Claude (turbo-pipeline brainstorming)
**Predecessor:** Phase G backend (commit `f381746`), Phase H design ship (Claude Design `tubemine-v3-ux`)
**Status:** draft, awaiting plan + execution
**Risk surface:** small

## Mission

Close the code-side gap between Phase H design promises and production code. Ship four production code changes today so that the public marketing of TubeMine Pro on the pricing/landing/dashboard pages is actually delivered by the running service.

The Phase H design (Claude Design) advertises Pro features that the code does not yet implement: "Last 100 analyses saved", "CSV, JSON, Excel export". The Dashboard sentiment history list is also not tier-aware in production code.

## Locked decisions (do not re-litigate)

1. **Excel export ships today** using `exceljs`, minimal viable: data only, no formatting polish.
2. **Pro history cap is DISPLAY-ONLY.** No DB cap, no cleanup script. The "Last 100" promise is satisfied by what the user sees on screen.
3. **Server-side gating.** JSON and Excel exports go through a new server endpoint that 403s non-Pro users. Client-side button visibility is UX only; auth is on the server.
4. **Conditional rendering** for tier-aware labels (not the dual-label body-data CSS pattern). Tier is resolved server-side in `resolveTier()`/`getUserQuota()`, so a branch in JSX is cleaner than CSS visibility toggles. Mid-session upgrade flips correctly because dashboard pages are `dynamic = "force-dynamic"`.
5. **3 inline export buttons for Pro**, not a dropdown. Existing ResultsPanel header is responsive flex-wrap, no shadcn dropdown dependency needed.
6. **Re-use existing extract payload, no server re-extraction.** The export endpoint receives the already-computed data from the client and only formats it (no YouTube API quota cost).
7. **Re-use existing `qualitativeSummary()` strings.** They ARE the Phase H qualitative scheme: "Mostly positive", "Leans positive", "Mixed", "Polarized audience", "Mostly neutral", "Leans negative", "Mostly negative".

## Constraints

- No em-dash, no en-dash anywhere (comments, JSX, JSON, log strings).
- No Polar-banned verbs in NEW user-facing strings: "extract" / "scrape" / "bulk" / "pull data" / "Priority". Reuse "Export ..." pattern.
- No change to Polar webhook signature.
- No change to RLS policies.
- No backwards-compat shims; ship clean code.
- No re-extraction on export (zero YouTube quota cost).
- `exceljs` must be server-only (no client bundle bloat).

## Architecture

### 1. Tier-aware sentiment label on Dashboard "Recent analyses" + `/history` page

Server resolves tier on the page (already done on home + dashboard; add on history page). Tier passes down to the list component as a prop. Each row component:

- If `item.sentiment` is null → render nothing (do not invent "0%").
- If `tier === "free"` → render qualitative label via `qualitativeSummary(sentiment)`.
- If `tier === "pro"` → render exact "{pct}% {dominant}" where dominant is "positive" / "neutral" / "negative" picked by argmax of the distribution.

Tier propagation:
- `src/app/[locale]/dashboard/page.tsx` already calls `getUserQuota(user.id)`. Pass `quota.tier` to `<RecentAnalyses tier={quota.tier} />`.
- `src/app/[locale]/history/page.tsx` does not yet compute tier. Add a `getUserQuota(user.id)` call (cheap, single SELECT, same RLS-protected table) and pass the tier into `<HistoryClient tier={tier} ... />`.

Anonymous tier is impossible on these pages (both pages redirect unauthenticated users to login). So tier is always `"free"` or `"pro"` for these renders.

### 2. Pro "Last 100" history display cap

- Bump `ANALYSES_LIST_MAX` in `src/lib/analyses.ts` from 50 to 100. This is the documented presentation cap, not a DB delete.
- `src/app/[locale]/history/page.tsx` initial fetch: `limit: tier === "pro" ? 20 : 10`. Pro keeps the existing 20-per-page pagination and can scroll up to 100 cumulative; Free fetches at most 10 (one short page, no pagination cursor).
- For Pro, also enforce a client-side hard cap of 100 cumulative items (defense-in-depth so a buggy backend cannot accidentally page past 100). Adapter: `history-client.tsx` tracks `items.length` and disables the "Load more" button at 100.
- Dashboard "Recent analyses" widget keeps its hardcoded `limit: 5` preview. Add a Pro-only heading suffix in the recent-analyses card "Last 100 analyses saved" (or move to dashboard plan card per design).

### 3. JSON + Excel export via new `/api/export` endpoint

File: `src/app/api/export/route.ts`

```
POST /api/export
Content-Type: application/json
Body: {
  format: "json" | "xlsx",
  videoId: string,
  payload: {
    comments: Comment[],
    sentiment: SentimentAggregate | null,
    sentiment_distribution: SentimentDistribution | null,
    top_words: WordCount[],
    top_emoji: EmojiCount[],
    unique_words_total: number,
    unique_emoji_total: number,
    video_title?: string,
    channel_name?: string,
  }
}
```

Server flow:
1. `authUserId()` (existing helper, lift from `extract/route.ts` into `src/lib/auth.ts` or duplicate).
2. If no userId → 401 `{ error: "Sign in required" }`.
3. `getUserQuota(userId)`. If `quota.tier !== "pro"` → 403 `{ error: "Pro required for JSON/Excel export" }`.
4. Validate `format` is `"json" | "xlsx"`.
5. Compute filename: `tubemine-${videoId}-${YYYY-MM-DD}.${ext}` (server time UTC).
6. For `"json"`: stringify payload + standard JSON headers + `Content-Disposition: attachment; filename="..."`.
7. For `"xlsx"`: build `exceljs` workbook server-only with 2 sheets:
   - **Sheet 1 "Summary"**: video metadata rows (Video ID, Video Title, Channel, Comment Count, Sentiment Score, Positive %, Neutral %, Negative %), then top-20 words table (word, count), then top-20 emoji table (emoji, count, share %).
   - **Sheet 2 "Comments"**: full comments array with columns Author, Text, Sentiment (label), Likes, Replies, Published.
   - Return buffer with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` + `Content-Disposition`.
8. No DB write. No quota touch.

Server-only import: `import ExcelJS from "exceljs"` lives inside route file (App Router route handlers run server-only in Next.js by default; never bundled to client).

### 4. Frontend export buttons in `ResultsPanel`

`src/components/csv-gate.tsx` becomes `export-bar.tsx` (rename) OR a new sibling `export-bar.tsx` that wraps the three buttons. Decision: **new file `src/components/export-bar.tsx`** that internally renders CsvGate for the CSV button + adds JSON / Excel buttons for Pro. Avoids breaking existing CsvGate tests / imports.

```tsx
<ExportBar tier={tier} onDownloadCsv={...} onDownloadJson={...} onDownloadExcel={...} videoId={videoId} />
```

Logic:
- `tier === "anonymous"` → render existing "Sign in to export CSV" link.
- `tier === "free"` → render "Export CSV" only.
- `tier === "pro"` → render "Export CSV", "Export JSON", "Export Excel" inline (flex-wrap).

`tubemine.tsx` adds `downloadJson()` and `downloadExcel()` handlers that:
- POST to `/api/export` with `{ format, videoId, payload: {...current extracted data} }`.
- On success, read response as blob, trigger download via temporary anchor (same UX pattern as `downloadCsv()`).
- On 403 → `toast.error(...)`. (Server gate is authoritative; the button only shows for Pro, but defense-in-depth.)
- Fire `track("export_completed", { format, tier, videoId, count })` analytics.

ResultsPanel header swaps `<CsvGate ... />` for `<ExportBar ... />` with all three handlers wired.

### 5. i18n keys

`messages/en.json` and `messages/ru.json` get new entries under the appropriate namespaces. RU uses Cyrillic.

- `common.export_json` = "Export JSON" / "Экспорт JSON"
- `common.export_excel` = "Export Excel" / "Экспорт Excel"
- `common.export_pro_required` = "Pro plan required for JSON and Excel export." / "Для экспорта JSON и Excel нужен план Pro."
- `dashboard.last_100_analyses` = "Last 100 analyses saved" / "Сохраняются последние 100 анализов" (only rendered on Pro tier)
- `history.last_100_pro_cap` = "Last 100 analyses" / "Последние 100 анализов" (subtitle on history page for Pro)
- `history.last_10_free_cap` = "Last 10 analyses" / "Последние 10 анализов" (subtitle on history page for Free)
- `dashboard.sentiment_label_qualitative` namespace unnecessary (the qualitative strings come from `qualitativeSummary()` which returns English-only strings today; per Phase G design these are English-only fixed strings; keep them English-only for v1 and add i18n in a later sprint when the marketing page also goes bilingual on sentiment labels).

Run `node scripts/check-message-parity.mjs` after edits.

### 6. `qualitativeSummary` extraction

Move the function from `src/components/sentiment.tsx:264` to `src/lib/sentiment-summary.ts`. Both `sentiment.tsx` (client component) and `recent-analyses.tsx` (server component) and `history-client.tsx` (client component) import from the shared lib. The lib must be pure (no React, no "use client", no server-only), so it works in both worlds.

Also export a sibling helper `dominantSentimentLabel(distribution)` that returns `{ pct: number, label: "positive" | "neutral" | "negative" }` for the Pro variant ("68% positive").

## Files touched (final list)

**New:**
- `src/lib/sentiment-summary.ts` (pure util)
- `src/app/api/export/route.ts` (POST endpoint)
- `src/components/export-bar.tsx` (3-button wrapper)

**Modified:**
- `src/lib/analyses.ts` (`ANALYSES_LIST_MAX` 50 → 100, no other changes)
- `src/components/sentiment.tsx` (import `qualitativeSummary` from lib, drop inline definition)
- `src/components/recent-analyses.tsx` (accept tier prop, render label + optional "Last 100" subtitle)
- `src/app/[locale]/dashboard/page.tsx` (pass `quota.tier` into `<RecentAnalyses tier={...} />`)
- `src/app/[locale]/history/page.tsx` (compute tier via `getUserQuota`, pass into `HistoryClient`, choose initial limit per tier)
- `src/app/[locale]/history/history-client.tsx` (accept tier prop, render per-row label, cap Pro at 100 cumulative, hide pagination for Free after 10)
- `src/components/tubemine.tsx` (`downloadJson`, `downloadExcel` handlers, swap `<CsvGate>` for `<ExportBar>`)
- `messages/en.json`, `messages/ru.json` (new keys above)
- `package.json` + lockfile (add `exceljs`)

**Untouched (do not change):**
- `src/components/csv-gate.tsx` (kept for backwards-compat; `export-bar.tsx` may internally reuse it OR be standalone)
- `src/app/api/extract/route.ts` (no changes; export endpoint is separate)
- `src/lib/quota.ts` (FREE_MONTHLY_CAP, PRO_MONTHLY_CAP unchanged)
- Polar webhook, RLS policies, Supabase schema

## Edge cases

1. **Anonymous user POSTs to `/api/export`**: returns 401. Frontend would not have shown the button, but defense-in-depth handles a hand-crafted curl.
2. **Free user POSTs to `/api/export`**: returns 403. Button is not rendered for Free, but defense-in-depth.
3. **Pro user POSTs with invalid format**: 400.
4. **Pro user POSTs with empty payload.comments**: produce valid JSON / Excel anyway (empty Comments sheet, Summary sheet shows 0 count). No special error.
5. **Sentiment is null on a saved analysis row** (e.g., pre-Phase-G data): hide the sentiment label entirely. Card still renders title + channel + comment count.
6. **Sentiment all-neutral / score=0**: `qualitativeSummary` already returns "Mixed" or "Mostly neutral". OK.
7. **History page server fetches the wrong limit (e.g., Free user gets 20 items by bug)**: client-side does NOT trust the server; the page subtitle renders the cap label from the same tier value the page resolved, so server-bug visible as inconsistency. Acceptable for v1.
8. **Pro tier flipped to Free mid-session**: next page render re-reads `quota.tier` (force-dynamic). Stale Pro session has its 3 buttons; first POST to `/api/export` gets 403 with toast. No data leak.
9. **Excel buffer size**: at the Pro cap of 100,000 comments per month, a single export could be hundreds of thousands of rows. Realistic upper bound for one export = whatever the user just extracted, capped by their remaining quota. Worst-case single export ~100k rows, exceljs handles this in seconds with reasonable memory. No streaming needed for v1.
10. **Concurrent JSON + Excel button mash**: each click is an independent POST. Toast each result. No mutual lock needed.
11. **Browser language not en/ru**: next-intl falls back per existing pattern; no new logic needed.
12. **Anonymous user, dashboard page**: redirects to login. Never reaches RecentAnalyses with `tier === "anonymous"`. Type stays `"free" | "pro"` for these components.

## Out of scope (Phase H+1 or never)

- Excel formatting (column widths, freeze panes, conditional formatting on sentiment column). Ship raw data only.
- JSON pretty-print toggle. Default to compact JSON.
- Server-rendered Russian qualitative labels. Phase H+1 if the marketing team wants RU sentiment labels.
- DB cleanup cron for analyses older than 100. Out of scope by user decision (display-only cap).
- API tier (the design says "API coming soon"). No code change.
- Excel export from saved analyses on `/history` (current flow exports the live extracted result only; revisit when users ask).
- Bumping `FREE_MONTHLY_CAP` or `PRO_MONTHLY_CAP`. No change.

## Verification checklist (gate before push)

Pre-push:
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test` (vitest) green (existing tests + any new ones in this sprint)
- [ ] `pnpm lint` clean
- [ ] `node scripts/check-message-parity.mjs` clean (EN/RU keys aligned)
- [ ] `grep -P '[\x{2013}\x{2014}]' src/` returns no matches in changed files
- [ ] Local `next dev` smoke (manual or scripted curl):
  - Anonymous: `GET /api/extract` → `tier: "anonymous"`. Dashboard/history pages redirect to login.
  - Free signed-in cookie: `POST /api/export {format:"json"}` → 403 with `{error: "Pro required..."}`. UI shows only Export CSV button. Dashboard "Recent analyses" cards show qualitative labels.
  - Pro signed-in cookie: `POST /api/export {format:"json"}` → 200, valid attachment. `POST /api/export {format:"xlsx"}` → 200, valid `.xlsx` (open in Numbers/Excel and confirm two sheets). UI shows all 3 export buttons. Dashboard cards show exact percentages.
- [ ] No Polar-banned verb in any new UI string ("extract", "scrape", "bulk", "pull data", "Priority")
- [ ] `pnpm build` succeeds (catches client-bundle bloat regression)

Hard gate before `git push`:
- AskUserQuestion with commit SHA, files changed count, line diff stats. Wait for explicit yes.

Post-push:
- Vercel deploy reaches READY.
- Prod `GET /api/extract` still returns shape with `tier: "anonymous"`.
- Prod `POST /api/export` with no auth cookie returns 401.
- Prod `POST /api/export` with Free cookie returns 403 (skip if no Free test account on hand).

## Risks

- **`exceljs` client bundle inclusion**: mitigated by server-only import in route handler. Risk: small. If `pnpm build` shows client bundle grew >100KB, regress.
- **`ANALYSES_LIST_MAX` bump from 50 to 100**: doubles the worst-case row count for a list response. Each row is < 5KB. 100 rows < 500KB. Acceptable.
- **Server-side `/api/export` adds Active CPU cost** (per Vercel Fluid Compute pricing). For typical 5k-comment Excel export, < 2s CPU. Negligible at current MRR scale.
- **403 UX on Free side-loaded request**: toast message only, no redirect. Acceptable for defense-in-depth (UI doesn't show the button).
- **Mobile pricing card overlap with new "Last 100" line on Pro card**: design pane shipped this; if there is a 375px overflow, we will catch it in the dev smoke. Mitigation if needed: shorten string.

## Success criteria

- All Phase H design promises are deliverable by the running service:
  - "CSV, JSON, Excel export" on Pro pricing card → ✓ via 3 buttons + endpoint.
  - "Last 100 analyses saved" → ✓ via list cap + heading.
  - Dashboard history cards qualitative on Free, exact on Pro → ✓ via tier-aware label.
- No regression in existing Phase G shape (sentiment widget, top words / emoji curiosity gaps, CSV gate).
- Bundle size stable (verified via `pnpm build` output).
- All verification checklist items green.

## References

- `projects/yt-comments/launch/2026-05-19/phase-h-card-cleanup-and-history-tail.md` (design ship note)
- `projects/yt-comments/launch/2026-05-19/phase-g-tier-aware-paywall-backend.md` (Phase G backend reference, commit `f381746`)
- `references/dual-label-body-data-tier-pattern.md` (pattern considered but rejected for this sprint, see locked decision 4)
- `queries/paywall-curiosity-gap.md` (gating psychology)
- `playbooks/saas-roadmap/12-production-shipping-runbook.md` §6.12 (X-Forwarded-For Vercel CDN lesson; informs the "no IP-spoof curl on prod" testing decision)
