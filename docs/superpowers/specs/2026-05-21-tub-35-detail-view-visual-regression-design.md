# TUB-35 Visual Regression Sweep: Detail View Styling Fix + Visual Fidelity Gate

Status: spec
Owner: TUB-35 turbo
Date: 2026-05-21
Linear: TUB-35

## Context

After shipping TUB-34 (history overhaul) on 2026-05-21, three regressions remained:

1. `/history/:id` detail view renders Sentiment and Emoji as inline JSX (plain text / bullet list) instead of reusing the shared `SentimentPanel` (bar with %) and `EmojiPanel` (grid with badges) components used on `/dashboard`. The page also lacks the `.tm-design .dashboard-page` CSS scope wrapper, so scoped design tokens do not apply.
2. Dashboard analytical panels (TopWords + Sentiment + Emoji + Results) may have stopped rendering after a fresh extract. Suspected false alarm caused by the preview-on-paste bug fixed in `adfd43e`, but unverified.
3. The verify-on-prod gate that exists today (DOM presence + network checks) does not detect visual regressions. We need a mandatory visual fidelity gate to be added to the QA playbook so future turbos catch panel-reuse failures before merge.

Two prior regressions in the same sweep already shipped:
- `adfd43e`: `/history` list row layout collision + extract preview auto-load on URL paste.
- `003cd13`: visible warning when comments are not stored for a legacy row.

This spec covers the remaining 3 items.

## Out of scope

- Any change to `src/components/sentiment.tsx`, `src/components/emoji-frequency.tsx`, `src/components/top-words.tsx`.
- Any change to `src/components/tubemine.tsx` (TUB-33 territory).
- Any change to `src/app/[locale]/(app)/history/history-client.tsx` (locked, shipped in `adfd43e`).
- Any change to tier-aware download button gating in detail view (CSV always, JSON + Excel Pro-only must remain identical).
- Performance or accessibility work on detail view beyond what panel reuse delivers for free.
- Any new translation keys (existing panel i18n keys are already shipped).

## Goals

- Detail view renders Sentiment as a bar with % and Emoji as a card grid with badges, visually matching the `/dashboard` inline render.
- Detail view is wrapped in `.dashboard-page` so scoped CSS tokens apply identically to `/history` and `/profile`.
- Dashboard 4-panel render after fresh extract is verified on prod (screenshot evidence in Linear).
- Future turbos that introduce a new view rendering existing data shapes are forced (by playbook + per-turbo prompt mandate) to (a) reuse shared panel components and (b) verify scoped CSS applies on prod.

## PR plan (2 sequential PRs)

### PR 1: detail view styling fix + Bug B verification

Single file change, plus verification work.

`src/components/analysis-detail-view.tsx`:

1. Add imports:
   - `import { SentimentPanel, type SentimentAggregateProp } from "@/components/sentiment"`
   - `import { EmojiPanel } from "@/components/emoji-frequency"`
   - `import type { EmojiCount } from "@/lib/emoji-frequency"`
2. Replace inline Sentiment JSX (the `<div className="mt-6 rounded-lg border p-6">` block that prints `+N / =N / -N`) with:
   ```tsx
   {sentiment && (
     <SentimentPanel
       tier={tier}
       aggregate={sentiment as SentimentAggregateProp}
       distribution={null}
       commentsAnalyzed={row.comment_count}
     />
   )}
   ```
   Notes:
   - `SentimentPanel` accepts `tier: "anonymous" | "free" | "pro"`; detail view's `tier: "free" | "pro"` is a structural subset, no cast needed.
   - `distribution={null}` is safe: `SentimentPanel` calls `deriveDistribution(aggregate)` when distribution is null.
   - DB shape `SentimentAggregate` (from `@/lib/sentiment`) is structurally identical to `SentimentAggregateProp` (positive, neutral, negative, score, sampleSize, coverage, languages, ruShare). The cast is type-level only.
3. Replace inline Emoji JSX (the `<div className="mt-6 rounded-lg border p-6">` block with `<ul>` of emoji items) with:
   ```tsx
   {emojis.length > 0 && (() => {
     const visible = tier === "pro" ? emojis : emojis.slice(0, 15)
     return (
       <EmojiPanel
         tier={tier}
         items={visible.map<EmojiCount>((e) => ({
           emoji: e.emoji,
           count: e.count,
           share: (e.percent ?? 0) / 100,
         }))}
         totalUnique={emojis.length}
       />
     )
   })()}
   ```
   Notes:
   - DB `EmojiFreq` has `{emoji, count, percent}` where percent is 0..100. `EmojiCount` expects `share` as 0..1, so divide by 100 at the boundary. Defensive `?? 0` covers legacy rows where `percent` may be null/undefined.
   - Pre-slice to 15 for free tier preserves existing tier gating from the inline JSX (`emojis.slice(0, tier === "pro" ? emojis.length : 15)`).
   - `totalUnique` uses the full stored array length so the free-tier upgrade CTA computation `remaining = totalUnique - items.length` shows a non-zero "see N more" when the stored array has more than 15 items.
4. Wrap the entire component return in `<div className="dashboard-page">`, keeping the existing `<div className="mx-auto max-w-5xl px-4 py-8">` as the inner content container:
   ```tsx
   return (
     <div className="dashboard-page">
       <div className="mx-auto max-w-5xl px-4 py-8">
         ...existing JSX...
       </div>
     </div>
   )
   ```
   Notes:
   - `.tm-design` is already on `<body>` from the locale layout; only `.dashboard-page` needs adding.
   - `/history` (list) and `/profile` already use the same wrapper, so no novel layout interaction.
   - The CSS for `.dashboard-page` sets `min-height: 100vh`, `display: grid`, `gap: --space-7`. This will not break the existing inline `<div className="mx-auto max-w-5xl px-4 py-8">` content container, which becomes a single grid item.
5. Remove now-unused local variable patterns if they read more clearly removed. Keep `sentiment`, `topWords`, `emojis` extraction as-is.

Build + commit + push + verify-on-prod.

#### Bug B verification (during PR 1 verify-on-prod)

After PR 1 deploys, in the same Chrome MCP session:

1. Sign in to `https://tubemine.tech/en/dashboard` (use authed cookies from main session; if expired, document deferral in Linear comment and skip).
2. Paste a small YouTube URL (`https://youtu.be/PHqshQPRxt4`) into the Quick analyze input. Wait ~1s for the debounced preview auto-load.
3. Click "Analyze N comments". Wait for extract to complete.
4. Scroll the dashboard. Take screenshot.
5. Assert: `TopWordsPanel`, `SentimentPanel`, `EmojiPanel`, `ResultsPanel` all render under the preview, above the Recent Analyses block.
6. If all 4 render then Bug B is a false alarm. Document in Linear comment.
7. If any panel is missing then it is a real regression but PR 1 scope is limited to `analysis-detail-view.tsx`. Root cause is almost certainly in `tubemine.tsx` (out of scope for this turbo per the TUB-33 lock). Document the regression in a new Linear sub-issue (TUB-35-followup) with reproduction steps and screenshot, then continue with PR 1 verify. Do NOT widen PR 1 scope into `tubemine.tsx`.

### PR 2: vault updates (TC-CSS-008 + playbook 13 visual fidelity gate)

No code changes. Two vault writes via `mcp__obsidian__write_note` / `patch_note`.

Vault paths below are vault-root-relative (per `mcp__obsidian__write_note` convention; vault root is `~/vault/`).

`projects/yt-comments/qa/test-cases.md`: append TC-CSS-008 entry. Title: "Detail view visual fidelity matches dashboard inline panels." Steps:
1. Open `/history` on prod after an extract has run.
2. Click into any analysis row.
3. Verify Sentiment renders as a horizontal bar with % labels (not "+N / =N / -N" plain text).
4. Verify Emoji renders as a card grid with emoji + count badges (not an inline `<ul>`).
5. Verify the page has `min-height: 100vh` background from `.dashboard-page` (DevTools getComputedStyle on the wrapper).
6. Take screenshot. Compare against `/dashboard` after-extract screenshot. They should look visually identical for these panels modulo data values.

Acceptance: pixel-equivalent panel styling. Less than 3% pixel diff for panel regions excluding text content.

`playbooks/saas-roadmap/13-qa-user-flows-and-test-cases.md`: extend (append new sub-section under existing cluster 8, OR add new mandate paragraph if cluster structure differs).

Content to add (verbatim, no em-dash):

> ## Visual fidelity gate (mandatory Tier 2 check)
>
> After every turbo PR merges to main, the verify-on-prod step MUST include a visual screenshot comparison, not just DOM and network assertions. DOM/network gates are insufficient for visual regressions.
>
> Open the changed page on prod via Chrome MCP. Screenshot every section that renders analytical panels (Sentiment, Top Words, Emoji, Comments table). Compare against the reference dashboard inline view OR the source design HTML if the page is a visual port. Acceptance: less than 3% pixel diff for panel regions excluding text content (text values differ across analyses by design).
>
> ### Turbo prompt mandates
>
> When a turbo prompt introduces a new page or view that renders existing data shapes (sentiment / top words / emojis / comments), the prompt MUST include both:
>
> 1. "Reuse shared panel components from `src/components/sentiment.tsx`, `src/components/emoji-frequency.tsx`, `src/components/top-words.tsx`. Do NOT write inline JSX for these data shapes."
> 2. "Wrap the page return in `<div className=\"dashboard-page\">` (the `.tm-design` body class is global). Verify on prod via getComputedStyle that scoped CSS tokens apply (returns design token color, not browser default)."
>
> Reason: TUB-35 incident on 2026-05-21 where `/history/:id` shipped with inline plain-text Sentiment and `<ul>` Emoji, plus no design CSS scope wrapper. Caught only after user-reported visual regression, not by verify-on-prod gate. Component reuse + scope wrapper is a 5-line fix per page if mandated up front; a full PR cycle if caught after merge.

### Constraints (lessons baked in)

- No em-dash anywhere in source, commits, PR text, Linear comments, or vault notes. Banned codepoints U+2014 and U+2013.
- No destructive git ops. No `git reset --hard`, no force push, no branch delete, no checkout-discard.
- Verify-on-prod between PRs. Push PR 1, wait Vercel READY, hard-reload, screenshot + DOM assertion, THEN PR 2.
- `pnpm build` before every commit. No TypeScript errors. No missing i18n keys.
- Tier-aware download behavior must not regress: Free sees CSV only; Pro sees CSV + JSON + Excel. Verify via Chrome MCP after PR 1.
- Reuse shared components only. No inline JSX clone of Sentiment / Emoji / TopWords. No new prop spreads or wrapper components.
- Visual fidelity self-check: screenshot detail view, screenshot dashboard, eyeball-compare Sentiment + Emoji panels. They must look visually identical modulo data values.

## Risks

- **Type cast `SentimentAggregate as SentimentAggregateProp`.** Mitigation: structural shapes are identical; if a field is added to `SentimentAggregateProp` later, TypeScript will flag at the call site.
- **`.dashboard-page` wrapper introduces unexpected layout.** Mitigation: inner content container retains existing classes. If the wrapper applies grid layout that misplaces children, we extract a panels-only scope class. Spec-time analysis: dashboard-page CSS sets `min-height`, `display: grid`, `gap`, `background`. The existing inner `mx-auto max-w-5xl px-4 py-8` becomes a single grid item; no displacement expected.
- **EmojiPanel `totalUnique` semantic mismatch.** Detail view uses stored array length, but dashboard uses scan-time total. Users may see a smaller number on detail view than dashboard. Accepted: stored-array-length is the only number available without re-scanning, and it matches the "displayed unique" count.
- **Bug B is a real regression, not a false alarm.** Mitigation: if any of the 4 panels do not render on fresh dashboard extract, investigate root cause before merging PR 1.
- **Authenticated Chrome MCP session expires.** Mitigation: if re-OAuth required, document Bug B verification as deferred in Linear; do not block PR 1 merge on Bug B if the only blocker is auth.

## Acceptance criteria

PR 1:
- [ ] `analysis-detail-view.tsx` imports `SentimentPanel` and `EmojiPanel`, contains zero inline Sentiment/Emoji JSX, and wraps return in `<div className="dashboard-page">`.
- [ ] `pnpm build` passes with zero TypeScript errors.
- [ ] Commit pushed to main, Vercel deploy READY.
- [ ] Prod `/history/:id` for an existing analysis shows: Sentiment bar with % (not plain text), Emoji card grid with badges (not `<ul>`), tier-aware download buttons (CSV always, JSON + Excel Pro-only).
- [ ] Prod dashboard after fresh extract shows TopWords + Sentiment + Emoji + Results panels (Bug B verification documented; if regression real, sub-issue filed but PR 1 still ships).
- [ ] Linear comment with commit SHA + verify-on-prod evidence + Bug B verdict.

PR 2 (vault writes, vault-root-relative paths):
- [ ] `projects/yt-comments/qa/test-cases.md` contains TC-CSS-008 with full steps and acceptance.
- [ ] `playbooks/saas-roadmap/13-qa-user-flows-and-test-cases.md` contains the visual fidelity gate sub-section + turbo prompt mandate.
- [ ] Linear comment with vault note paths + content summary.

Final:
- [ ] TUB-35 moved to Done.
- [ ] Daily note appended with PR SHAs, before/after notes, Bug B verdict, TC-CSS-008 + playbook 13 entries.
