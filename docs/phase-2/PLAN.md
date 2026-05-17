# TubeMine Phase 2 Implementation Plan

Status: DRAFT v3 (after review cycles 1 and 2)
Spec ref: `docs/phase-2/SPEC.md`
Last updated: 2026-05-17

## 1. File-by-file change manifest

### New files

| Path | Purpose | Size estimate |
|---|---|---|
| `src/lib/sentiment/index.ts` | Public API: `scoreCommentsSentiment(texts) -> { perComment, aggregate, languages, coverage }`. Pure, server-only. | ~150 lines |
| `src/lib/sentiment/lexicon-en.ts` | Hand-curated EN word -> valence map, ~600-800 entries, exported as `Readonly<Record<string, number>>`. TypeScript module (not JSON) for tree-shake + zero parse cost. | ~30KB source |
| `src/lib/sentiment/lexicon-ru.ts` | Hand-curated RU word -> valence map, ~200-300 entries. Same shape as EN. | ~12KB source |
| `src/lib/emoji-frequency.ts` | Pure function `topEmojisFromComments(texts, limit)` returning `EmojiCount[]`. Uses `\p{Extended_Pictographic}` regex with ZWJ-aware merging. | ~80 lines |
| `src/components/sentiment.tsx` | Client component, takes `sentiment` prop (full aggregate shape from `/api/extract`), renders stacked bar + summary text. | ~120 lines |
| `src/components/emoji-frequency.tsx` | Client component, takes `comments: Comment[]`, renders top-10 emoji grid. | ~80 lines |
| `src/components/csv-gate.tsx` | Client component, renders either the download button or the sign-in CTA based on `isSignedIn` prop. Replaces the inline `Download CSV` button in `tubemine.tsx`. | ~50 lines |
| `src/lib/sentiment/__tests__/sentiment.test.ts` | Vitest tests. **Cycle 2 cut this** — see §3. | (deferred) |

### Modified files

| Path | What changes | Risk |
|---|---|---|
| `src/lib/types.ts` | Add optional `sentiment?: "positive" \| "negative" \| "neutral" \| "unknown"` to `Comment`. | low |
| `src/app/api/extract/route.ts` | After successful comment fetch + before `bumpUserUsage`, call `scoreCommentsSentiment` and attach per-comment label + aggregate to response. Aggregate becomes `null` if `comments.length < 25` or coverage < 5%. | medium (server payload contract change, client must tolerate `null`) |
| `src/components/tubemine.tsx` | Re-label "Try it" -> "Analyze a video", "Preview" -> "Analyze", "Extract N comments" -> "Analyze N comments", "Extracting..." -> "Analyzing...". Replace inline Download CSV button with `<CsvGate>` reading `isSignedIn` from a new server-fetched prop on `<TubeMine>`. Render `<SentimentPanel>` + `<EmojiPanel>` between `<TopWordsPanel>` and `<ResultsPanel>`. Add tracking events `sentiment_rendered`, `emoji_rendered`, `csv_signin_gate_shown`, `csv_signin_clicked`. | medium (largest single-file change) |
| `src/app/page.tsx` | Update hero sub-copy. Pass `isSignedIn` (from server-side Supabase check) into `<TubeMine>`. Convert `HomePage` from purely-static to lightweight server component that reads session, same pattern as `SiteHeader`. | medium |
| `src/app/layout.tsx` | Update `metadata.description`, OG description, Twitter description, JSON-LD description. | low |
| `src/app/pricing/page.tsx` | Free features: "Research-ready CSV export" -> "CSV export". Add "Sentiment and emoji insights" to both Free and Pro features. | low |
| `package.json` | Rewrite top-level `description`. | low |
| `README.md` | Rewrite top-of-file blurb (one paragraph). Keep technical body intact. | low |

### Deleted files

None.

### Files explicitly NOT touched

- `src/app/api/checkout/route.ts`
- `src/app/api/polar/webhook/route.ts`
- `src/app/api/portal/route.ts`
- `src/lib/polar.ts`
- `src/lib/quota.ts`
- `src/lib/budget.ts`
- `src/app/dashboard/*`
- Any `supabase/migrations/*`
- `proxy.ts`
- `src/lib/supabase/*`

The Phase 1 + 1.5 paid path is sandbox-E2E-proven (commit `217b793` + `phase-1.5-sandbox-e2e-success`). Touching any of those modules in Phase 2 is a regression risk for zero Phase 2 benefit.

## 2. DB migrations

**None.** Sentiment is computed at extract time, not stored. Per-comment labels are ephemeral (live in the response, included in CSV the user downloads, not persisted). The `Comment` table is unchanged.

This was an explicit cycle 1 challenge: "should we cache sentiment results?" Decision: no. (a) Extract endpoint already caches nothing today, (b) recomputing on a 1k-comment extract is sub-50ms, (c) caching adds a Redis key dimension and an invalidation problem for zero observable user benefit.

## 3. Dependency additions

**None.** Cycle 1 considered:

- `vader-sentiment` npm: ~250KB, MIT, but ships full Python-port lexicon and unnecessary text-prep logic. Rejected.
- `sentiment` npm (AFINN-based): MIT, ~80KB, EN-only, smaller but still pulls a generic AFINN dictionary. Rejected because we want hand-curation and want to bundle RU.
- `emoji-regex`: would simplify emoji detection. Rejected because `\p{Extended_Pictographic}` is built into V8 since Node 12 and our target is Node 24.
- `unicode-emoji-json` for emoji names: ~50KB. Rejected, inline ~50-entry name map for the common ones is cheaper.

**Cycle 2 challenged the test framework gap.** The repo has no Vitest / Jest setup. Adding one for a single sentiment-test file is too heavy for a one-session ship. Decision: write a tiny `__tests__/sentiment.manual.ts` script that can be run with `tsx` (already available transitively via `next`), but do not block the ship on it. Test plan in §6 covers manual verification instead.

## 4. Implementation order (sequencing)

Execute in this order. Each step is independently committable. Verify before moving on.

### Step A. Lexicons + sentiment scorer (server-only, pure)

1. Create `src/lib/sentiment/lexicon-en.ts` with the hand-curated EN map.
2. Create `src/lib/sentiment/lexicon-ru.ts` with the hand-curated RU map.
3. Create `src/lib/sentiment/index.ts` with `scoreCommentsSentiment(texts)`.
4. Write `src/lib/sentiment/scratch.ts` (gitignored or one-off `tsx`) that imports the function and runs it on 5 representative comment strings (3 EN, 2 RU). Eyeball the output is sane (positive/negative classifications match human intuition).

Verify: TypeScript compiles. Manual sanity outputs look right.

### Step B. Wire sentiment into `/api/extract`

1. Update `src/lib/types.ts` to add optional `sentiment` field on `Comment`.
2. In `route.ts`, after the `while (comments.length < limit)` loop completes (success path) and before the `bumpUserUsage` call, run `scoreCommentsSentiment(comments.map(c => c.text))`. Attach `sentiment` to each comment by index. Include the aggregate (or `null` if below threshold) in the JSON response.
3. Do NOT block the response on sentiment if it throws: wrap in try/catch and fall through with `sentiment: null` + per-comment `sentiment: undefined`. Sentiment failure must not break extract.

Verify: `curl /api/extract` on a known video, confirm response includes `sentiment` aggregate.

### Step C. Emoji frequency lib + component

1. Create `src/lib/emoji-frequency.ts`.
2. Create `src/components/emoji-frequency.tsx` (client).
3. Add to `tubemine.tsx` render flow only as a smoke test, no wiring to gating yet.

Verify: rendered on a video with many emojis, hidden on a video with none.

### Step D. Sentiment component + render

1. Create `src/components/sentiment.tsx`.
2. Add to `tubemine.tsx` between `TopWordsPanel` and `ResultsPanel`.
3. Read sentiment from the API response (state managed in `tubemine.tsx`).

Verify: widget renders on extract with > 25 comments, hidden below.

### Step E. CSV gating

1. Create `src/components/csv-gate.tsx`.
2. In `tubemine.tsx`, accept new `isSignedIn: boolean` prop. Pass through to `<ResultsPanel>` which passes to `<CsvGate>`.
3. In `src/app/page.tsx`, convert `HomePage` to async server component (Next.js App Router pattern). Use `createClient` from `@/lib/supabase/server` to check session like `SiteHeader` does. Pass `isSignedIn` to `<TubeMine>`.
4. `<CsvGate>` renders `<Button onClick={onDownload}>Download CSV</Button>` when signed in, otherwise `<Link href="/login?redirect=/">Sign in to export CSV</Link>` styled as a button.

Verify: visit `/` anonymously, run extract, confirm CSV button replaced. Sign in, refresh, confirm CSV button restored.

### Step F. Copy updates (text-only sweep)

1. `tubemine.tsx`: label, button text, loading text.
2. `page.tsx`: hero sub-copy.
3. `layout.tsx`: metadata + JSON-LD descriptions.
4. `pricing/page.tsx`: features.
5. `package.json`: description.
6. `README.md`: top-of-file blurb only.

Verify: grep for "extract" in user-facing strings, ensure only `/api/extract` and similar internal references remain.

### Step G. Tracking events

1. Add `track("csv_signin_gate_shown", ...)` in `<CsvGate>` mount effect for anonymous state.
2. Add `track("csv_signin_clicked", ...)` in the sign-in CTA `onClick`.
3. Add `track("sentiment_rendered", ...)` in `<SentimentPanel>` mount effect.
4. Add `track("emoji_rendered", ...)` in `<EmojiPanel>` mount effect.

Verify: in Vercel Analytics during smoke test, events fire.

### Step H. Build / lint / typecheck

```bash
pnpm install
pnpm lint
pnpm build
```

Verify: zero errors, zero warnings introduced by Phase 2.

### Step I. Visual verification on local dev

1. `pnpm dev`
2. chrome-devtools MCP: take screenshots of:
   - Hero (anonymous, no extract yet)
   - Anonymous after extract (Top Words + Sentiment + Emoji + Results with sign-in gate)
   - Signed-in after extract (same widgets + Download CSV button)
   - `/pricing` page
   - Sign-in page
3. Confirm screenshots match SPEC §7 mental walkthrough.

### Step J. Commit + push + deploy

1. Single commit with all changes. Conventional message: `feat: Phase 2 - sentiment + emoji analytics, CSV gating, analytics-first copy`.
2. `git push origin main`. Vercel auto-deploy.
3. Wait for READY (~1-2 min).
4. Re-run chrome-devtools screenshots on `tubemine.vercel.app`.

### Step K. Vault filing + final report

1. `mcp__obsidian__write_note` to `projects/yt-comments/launch/phase-2-shipped-session.md`.
2. Append session summary to `daily/2026-05-17.md`.
3. Final report to user.

## 5. Test plan

Manual verification matrix (no automated framework in repo).

### 5.1 Server-side sentiment

| Input | Expected |
|---|---|
| "I love this video" | per-comment positive, aggregate skews positive |
| "absolutely terrible content" | per-comment negative |
| "ok I guess" | per-comment neutral (or unknown) |
| "this is not bad" (negation) | per-comment positive (bad valence flipped) |
| "это просто шедевр" | per-comment positive, RU coverage flag |
| 1000 random comments from a real video | aggregate score is in -1..+1, coverage > 0.05 |
| 0 comments | aggregate is `null`, no crash |
| 10 comments (below threshold) | aggregate is `null`, no crash |
| Sentiment throws synthetic error | `/api/extract` still returns comments, sentiment is `null` |

### 5.2 Emoji frequency

| Input | Expected |
|---|---|
| "great video 🔥🔥🔥" | 🔥 with count 3 |
| "thanks ❤️ from family 👨‍👩‍👧" | 2 entries, ZWJ family merged |
| "no emojis here" | empty array, widget hidden |
| 1000 comments from emoji-heavy channel | top 10 sorted by count desc |

### 5.3 CSV gating

| Scenario | Expected |
|---|---|
| Anonymous, extract, click "Sign in to export CSV" | redirected to `/login?redirect=/` |
| Anonymous, post sign-in | landed on `/dashboard` with one-time toast about re-pasting URL |
| Free signed-in, extract, click Download CSV | CSV downloads with sentiment column populated |
| Pro signed-in, extract 5000 comments, click Download | CSV downloads with all 5000 rows |

### 5.4 Tracking events (Vercel Analytics console)

| Action | Event fired |
|---|---|
| Anonymous extract completes | `sentiment_rendered`, `emoji_rendered`, `csv_signin_gate_shown` |
| Click sign-in CTA | `csv_signin_clicked` |
| Signed-in CSV download | `csv_downloaded` (unchanged from Phase 1.5) |

### 5.5 Build smoke

- `pnpm build` succeeds.
- Built bundle size of `/page` chunk increases by < 5KB gzipped (lexicon stays server-side).
- `pnpm start` serves the production build, page renders correctly.

## 6. Rollback plan

If Phase 2 breaks production:

1. `git revert <phase-2-commit-sha>` on main.
2. `git push`. Vercel auto-deploys the revert.
3. Time to recovery: ~3 min (revert + build + deploy).

No DB migration to roll back. No env var changes. No webhook surface changes. Polar billing untouched.

Sub-rollback: if only one widget misbehaves but others are fine, can hide it via a feature flag-less inline `if (process.env.NEXT_PUBLIC_SENTIMENT === "off") return null` constant. Cycle 2 explicitly rejected adding a real feature flag (the rule says "don't add feature flags for backwards compatibility"). If we need granular off, revert is the answer.

## 7. Visual verification protocol (chrome-devtools MCP)

For each state below, capture a full-page screenshot and confirm against acceptance criteria.

| State | URL | Auth | Action |
|---|---|---|---|
| 1 | `/` | none | none, hero only |
| 2 | `/` | none | after extract on `dQw4w9WgXcQ` |
| 3 | `/login` | none | landing |
| 4 | `/` | signed-in (any tier) | after extract |
| 5 | `/dashboard` | signed-in | landing |
| 6 | `/pricing` | none | landing |

Save screenshots to `/tmp/tubemine-phase-2-<state>.png`. Reference in final shipped report.

Repeat states 1, 2, 4, 6 on production URL `tubemine.vercel.app` after deploy.

## 8. Polar review readiness check

Before declaring ship complete, verify:

- [ ] Visit `tubemine.vercel.app` as a fresh visitor in incognito.
- [ ] Hero: no "extract", no "download", no "CSV" visible above the fold.
- [ ] Paste any YouTube URL, hit Analyze. Confirm widgets render in this order: Top Words, Sentiment, Emoji, Comments table with sign-in gate.
- [ ] No "Download CSV" button visible until sign-in.
- [ ] Navigate to `/pricing`. Confirm feature lists emphasize analytics.
- [ ] Open GitHub repo link from footer. Confirm repo description is the new analytics blurb (Vercel-redirected GitHub badge).
- [ ] View page source on `/`. Confirm `<title>` and JSON-LD `description` contain "sentiment" and not "CSV export" / "research-ready".

Pass all = ship-ready. Fail any = fix before declaring done.

## 9. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| RU lexicon too small to be useful | medium | low (widget shows experimental tag) | accept; ship and iterate |
| Sentiment regex / negation handling produces bad scores on edge cases | medium | medium | wrap in try/catch, return `null` on error, never block extract |
| `<HomePage>` becoming async server component breaks the existing hero layout / CSR hooks | low | medium | server component renders to RSC + passes `isSignedIn` as prop; client demo lives inside `<TubeMine>` which is already `"use client"`. Pattern matches `SiteHeader`. |
| Emoji ZWJ-merge regex differs across Node versions | low | low | target Node 24 (already set), tested manually |
| Conversion drops because anonymous users no longer get CSV instantly | medium | high (revenue) | accept; this IS the Polar mitigation. Add tracking to measure, can revert |
| Polar reviewer still bans after Phase 2 | low | very high | nothing 100% prevents this, but Phase 2 stacks the deck. KYC + this reposition + visible analytics is the strongest signal we can send |

## 10. Cycle 1 review log (self anti-yes-man)

1. **v1 had a Vitest setup as a hard requirement.** Removed in v2 because the repo has no test framework and adding one is more work than the test is worth for a single utility. Replaced with manual verification matrix.
2. **v1 stored sentiment in the DB.** Removed in v2 because we recompute on every extract and there is no caching benefit at the current scale.
3. **v1 had a feature flag for CSV gating.** Removed in v2: the codebase doesn't use feature flags, and a `NEXT_PUBLIC_DISABLE_CSV_GATE` env would just rot. If we want to undo, revert.
4. **v1 implementation order put copy changes first.** Reordered in v2: ship the analytics widgets first (those are the substantive value), then copy. If copy lands first and the build breaks, we look like we pulled CSV without a replacement.
5. **v1 had a TODO marker for "lexicon source TBD".** Replaced in v2 with concrete word counts (~600-800 EN, ~200-300 RU) and storage decision (TS modules, not JSON).
6. **v1 had a dedicated `/api/sentiment` endpoint.** Cut in v2: sentiment lives inside `/api/extract` because we have the data right there. Avoids a second auth check, second usage record, second response cycle.

## 11. Cycle 2 review log (fresh-eyes / staff engineer)

1. **"Would I ship this?"** Yes. The only thing I'd push back on is the hand-curated lexicon quality. Cycle 2 commits to dropping the lexicon code into the same commit as a real artifact, not a stub.
2. **What did the author defend that they shouldn't have?** v1 / v2 still kept per-comment sentiment label in the on-screen table. Cycle 2 cut it: it's noise + falsely precise. Sentiment label only flows to CSV.
3. **Language match to user's stated intent ("просто скачать комментарий"):** preserved. CSV is one click for signed-in users. We added analytics on top, did not remove the export capability.
4. **2-minute Polar reviewer simulation:** the only remaining "extract" exposure is the API endpoint URL if they open devtools. Acceptable, it's an internal name.
5. **Unspoken concern (first revenue ASAP):** the implementation is small enough to ship in one session. Acceptance criteria allow rollback in <5 min if it tanks. KYC is parallel-track and not blocked by this work.
6. **Was the spec answered by the plan?** Every spec acceptance criterion maps to an implementation step in §4. Every implementation step has a verify step before the next. No spec item is orphaned.

## 12. Anti-yes-man self-critique on this plan

Things I almost defended but shouldn't have:

- **Vitest framework setup.** Tempting because "tests are good", but the cost (~1 hour to wire up + 1 hour to write meaningful tests) is high vs. a manual matrix that catches the same bugs. Single-session ship discipline says no.
- **A "feature flag" for CSV gating.** Looks defensive but introduces env-var sprawl. Revert is the right tool.
- **A separate `/api/sentiment` endpoint.** Sounded clean as a microservice but pays auth + usage tax twice. Inline in `/api/extract` is right.
- **Caching sentiment per video.** Looks scalable but premature; the Redis key dimension expands the surface area and we have no measured need.

Things that might bite us anyway:

- **Hand-curated RU lexicon will be opinionated.** Anyone reviewing the file might disagree with specific word choices. Acceptable: it's a starting point, marked experimental, can be PR'd over.
- **`HomePage` becoming async breaks something subtle.** Unlikely (the page is mostly static markup), but a possibility. Mitigation: visual verification step I before deploy.
- **CSV gating may drop anonymous-to-signed-in conversion in the short term.** Cycle 1 worried about this. Counter: anonymous users currently extract + leave with a CSV and never come back. Forcing sign-in for CSV at worst halves the CSV downloads, at best doubles the sign-ups. We will measure.

End of PLAN.
