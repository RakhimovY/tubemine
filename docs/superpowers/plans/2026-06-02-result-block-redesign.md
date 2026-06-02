# Result Block Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the analysis "Result Block" design 1:1 using our existing `.tm-design`-scoped CSS + React components, so the analysis output looks identical and dense on both the landing demo and the dashboard, with bulletproof responsive behavior and zero text overflow.

**Architecture:** All new CSS lives under `.tm-design .result-block` (descendant-scoped) so it reuses the design's class names without colliding with the shipped landing feature blocks. A new presentational `<ResultBlock>` composes a header + a 3-column widget grid (Sentiment, Top Words, Emoji) + a comments table, and is shared verbatim by `<TubeMine>` (real data) and `<DemoSampleResult>` (mock data). The three widget panels are restyled from shadcn `<Card>` to bare `.widget` divs. Responsive reflow is container-query driven (`container-name: rb`) at 1000/720/640px.

**Tech Stack:** Next.js 16 App Router, Tailwind v4 (tokens under `.tm-design`, not `@theme`), React 19, next-intl (EN+RU), Vitest + React Testing Library (jsdom), lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-06-02-result-block-redesign-design.md`

**Branch:** `feat/result-block-redesign` (already created and checked out)

---

## File Structure

- Create `src/components/result-block.tsx` — `ResultBlock`, internal `CommentsTable` + `SentChip`, and `ResultBlockSkeleton`.
- Modify `src/components/sentiment.tsx` — `SentimentPanel` renders a bare `.widget`.
- Modify `src/components/top-words.tsx` — `TopWordsPanel` renders a bare `.widget`.
- Modify `src/components/emoji-frequency.tsx` — `EmojiPanel` renders a bare `.widget`.
- Modify `src/components/export-bar.tsx` — emit `.btn` / `.btn--primary` / `.btn--outline` pills.
- Modify `src/components/tubemine.tsx` — render `<ResultBlock>` + `<ResultBlockSkeleton>`; remove the inline `ResultsPanel` and the three old panel skeletons; reorder widgets.
- Modify `src/components/demo-sample-result.tsx` — render `<ResultBlock>` with mock data.
- Modify `src/app/globals.css` — add `--rb-width`; add the `.tm-design .result-block` CSS section; widen `.demo-wrap` + dashboard `.main-inner`; cap `.demo-form`.
- Modify `messages/en.json` + `messages/ru.json` — emoji heading -> "Emoji"; add `extractor.col_sentiment`, `analytics.sentiment.anon_locked_text`, `analytics.sentiment.anon_locked_cta`.
- Create `src/components/__tests__/result-block.test.tsx` — composition, per-tier, header truncation, table, mobile reflow hooks.
- Modify `src/components/__tests__/emoji-frequency.test.tsx` — keep M17 gate, add `.em-row` assertion.
- Modify `src/components/__tests__/analytics-skeleton.test.tsx` — `result-block-skeleton` testid; delete the vacuous second test.

---

## Task 1: i18n keys (EN + RU)

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/ru.json`
- Test: `node scripts/check-message-parity.mjs`

- [ ] **Step 1: Add/change EN keys.**

In `messages/en.json`, change `analytics.emoji.heading` from `"Top emojis"` to `"Emoji"`. Add `extractor.col_sentiment` to the `extractor` object (next to `col_when`): `"col_sentiment": "Sentiment"`. Add to `analytics.sentiment`:
```json
"anon_locked_text": "Sign in to see the sentiment breakdown for this video.",
"anon_locked_cta": "Sign in"
```

- [ ] **Step 2: Add/change RU keys (same paths).**

In `messages/ru.json`, change `analytics.emoji.heading` to `"Эмодзи"`. Add `extractor.col_sentiment`: `"Тональность"`. Add to `analytics.sentiment`:
```json
"anon_locked_text": "Войдите, чтобы увидеть разбор тональности для этого видео.",
"anon_locked_cta": "Войти"
```

All three new keys are plain strings (no ICU plural), so the RU plural-branch test does not apply to them. Do NOT remove `anon_prefix` / `anon_link` / `anon_suffix` (still required by `analytics-i18n-parity.test`). Do NOT use any em-dash or en-dash.

- [ ] **Step 3: Run parity check.**

Run: `node scripts/check-message-parity.mjs`
Expected: exits 0 (EN and RU key sets match).

- [ ] **Step 4: Run the i18n parity test.**

Run: `NODE_ENV=test npx vitest run src/components/__tests__/analytics-i18n-parity.test.ts`
Expected: PASS (all required keys present in both locales).

- [ ] **Step 5: Commit.**

```bash
git add messages/en.json messages/ru.json
git commit -m "i18n(result-block): Emoji heading + col_sentiment + anon-locked sentiment keys"
```

---

## Task 2: Result-block CSS

**Files:**
- Modify: `src/app/globals.css` (add `--rb-width` to the `.tm-design` token block ~line 244; append the result-block section at end of file; edit `.demo-wrap` line 477, `.demo-form` line 478, dashboard `.main-inner` line 1548)

This task is pure CSS; it is verified by `next build` at the end (Task 10) and by manual review. No unit test.

- [ ] **Step 1: Add the `--rb-width` token.**

In `src/app/globals.css`, inside the `.tm-design { ... }` block, after the `--motion-ease: ...;` line (around line 244), add:
```css
  /* Result block max width (shared landing demo + dashboard) */
  --rb-width: 1120px;
```

- [ ] **Step 2: Widen `.demo-wrap` and cap `.demo-form`.**

Replace the existing line:
```css
.tm-design .demo-wrap { max-width: 880px; margin: 0 auto; }
```
with:
```css
.tm-design .demo-wrap { max-width: var(--rb-width); margin: 0 auto; }
```
Then, on the existing `.tm-design .demo-form { ... }` rule (the long one starting `display: flex; flex-direction: column;`), add `max-width: 820px; margin-inline: auto;` to its declaration block so the search bar stays comfortable while the result block goes wide. (Append the two properties before the closing `}` of that rule.)

- [ ] **Step 3: Widen the dashboard content column.**

Replace, inside `.tm-design .dashboard-page .main-inner { ... }` (~line 1545-1551), the line `max-width: 980px;` with `max-width: var(--rb-width);`.

- [ ] **Step 4: Append the result-block CSS section at the END of `src/app/globals.css`.**

```css
/* =====================================================================
   Result Block redesign. Ported 1:1 from the Result Block design,
   scoped under .tm-design .result-block so it cannot collide with the
   shipped landing feature-block classes (.widget, .tw-row, .emoji-row...).
   Tokens: cards use --radius-sm (8px), bars use --radius-xs (6px),
   pills use --radius-lg; spacing/color/font reuse existing tokens.
   ===================================================================== */
.tm-design .result-block {
  width: 100%;
  max-width: var(--rb-width);
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  container-type: inline-size;
  container-name: rb;
}
.tm-design .result-block > * { min-width: 0; }

/* Header */
.tm-design .result-block .rb-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-5) var(--space-6); flex-wrap: wrap;
  padding: var(--space-5) var(--space-6);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
}
.tm-design .result-block .rb-head-l { min-width: 0; max-width: 100%; flex: 1 1 auto; }
.tm-design .result-block .rb-head-title {
  font-size: var(--font-size-2xl); font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em; line-height: 1.2; overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.tm-design .result-block .rb-head-video {
  margin-top: 3px; color: var(--color-text-secondary); font-size: var(--font-size-sm);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
}
.tm-design .result-block .rb-head-video .by { color: var(--color-text-tertiary); }
.tm-design .result-block .rb-exports { display: flex; align-items: center; gap: var(--space-3); flex-shrink: 0; flex-wrap: wrap; }

/* Widgets row */
.tm-design .result-block .rb-widgets { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-5); align-items: stretch; }
.tm-design .result-block .widget {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  padding: var(--space-6);
  display: flex; flex-direction: column; gap: var(--space-5);
  min-width: 0;
}
.tm-design .result-block .widget-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-2) var(--space-4); flex-wrap: wrap; }
.tm-design .result-block .widget-head-l { min-width: 0; flex: 1 1 auto; }
.tm-design .result-block .widget-head .widget-meta { flex: 0 0 auto; }
.tm-design .result-block .widget-title { font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); letter-spacing: -0.005em; display: inline-flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.tm-design .result-block .widget-sub { margin-top: 2px; color: var(--color-text-tertiary); font-size: var(--font-size-xs); font-family: var(--font-family-mono); }
.tm-design .result-block .widget-meta { color: var(--color-text-tertiary); font-size: var(--font-size-xs); font-family: var(--font-family-mono); white-space: nowrap; text-align: right; }
.tm-design .result-block .widget-body { display: flex; flex-direction: column; gap: var(--space-5); flex: 1; }
.tm-design .result-block .widget-foot { margin-top: auto; }

/* Export pill variants (Save JSON / Save Excel) */
.tm-design .result-block .btn--outline { --btn-bg: rgba(245,245,247,0.04); --btn-fg: var(--color-text-secondary); --btn-border: var(--color-border-strong); --btn-bg-hover: rgba(245,245,247,0.09); }
.tm-design .result-block .btn--outline:hover { color: var(--color-text-primary); }

/* RU experimental pill */
.tm-design .result-block .ru-pill {
  display: inline-flex; align-items: center; gap: var(--space-2);
  font-family: var(--font-family-mono); font-size: 10px; letter-spacing: 0.03em;
  padding: 2px 7px; border-radius: var(--radius-lg);
  color: var(--color-feedback-warning); border: 1px solid rgba(251,191,36,0.35); background: rgba(251,191,36,0.08);
}

/* Tier CTA */
.tm-design .result-block .tier-cta {
  display: inline-flex; align-items: center; gap: var(--space-3);
  font-size: var(--font-size-xs); font-family: var(--font-family-mono); color: var(--color-text-tertiary);
  padding-top: var(--space-4); margin-top: var(--space-4); border-top: 1px solid var(--color-border-subtle);
}
.tm-design .result-block .tier-cta a { color: var(--color-text-secondary); border-bottom: 1px solid rgba(245,245,247,0.25); padding-bottom: 1px; }
.tm-design .result-block .tier-cta a:hover { color: var(--color-text-primary); border-color: var(--color-border-focus); }
.tm-design .result-block .tier-cta.btnlike { cursor: pointer; background: none; border-left: 0; border-right: 0; border-bottom: 0; width: 100%; text-align: left; }
.tm-design .result-block .tier-cta.btnlike svg { transition: transform var(--motion-duration-fast) var(--motion-ease); }

/* Sentiment widget */
.tm-design .result-block .s-locked {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--space-4); text-align: center; padding: var(--space-6) var(--space-4);
  color: var(--color-text-secondary); font-size: var(--font-size-sm); line-height: 1.5;
}
.tm-design .result-block .s-locked .lock-badge {
  width: 34px; height: 34px; border-radius: var(--radius-lg);
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(245,245,247,0.05); border: 1px solid var(--color-border-subtle); color: var(--color-text-tertiary);
}
.tm-design .result-block .s-locked a { color: var(--color-text-primary); border-bottom: 1px solid var(--color-border-focus); padding-bottom: 1px; }
.tm-design .result-block .s-bar { display: flex; width: 100%; border-radius: var(--radius-lg); overflow: hidden; background: rgba(245,245,247,0.04); }
.tm-design .result-block .s-bar.h14 { height: 14px; }
.tm-design .result-block .s-bar.h22 { height: 22px; }
.tm-design .result-block .s-bar > span { display: flex; align-items: center; justify-content: center; height: 100%; min-width: 0; }
.tm-design .result-block .s-bar .pos { background: var(--color-accent-positive); }
.tm-design .result-block .s-bar .neu { background: rgba(245,245,247,0.30); }
.tm-design .result-block .s-bar .neg { background: var(--color-accent-negative); }
.tm-design .result-block .s-bar i { font-style: normal; font-family: var(--font-family-mono); font-size: 11px; font-weight: 500; color: rgba(8,12,10,0.78); text-shadow: 0 1px 0 rgba(255,255,255,0.12); }
.tm-design .result-block .s-bar .neu i { color: var(--color-text-primary); text-shadow: none; }
.tm-design .result-block .s-label { display: inline-flex; align-items: center; gap: var(--space-3); font-size: var(--font-size-md); font-weight: var(--font-weight-medium); }
.tm-design .result-block .s-label .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-accent-positive); }
.tm-design .result-block .s-legend { display: grid; gap: var(--space-3); font-family: var(--font-family-mono); font-size: var(--font-size-xs); }
.tm-design .result-block .s-legend .row { display: flex; align-items: center; gap: var(--space-3); color: var(--color-text-secondary); }
.tm-design .result-block .s-legend .ld { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.tm-design .result-block .s-legend .ld.pos { background: var(--color-accent-positive); }
.tm-design .result-block .s-legend .ld.neu { background: rgba(245,245,247,0.30); }
.tm-design .result-block .s-legend .ld.neg { background: var(--color-accent-negative); }
.tm-design .result-block .s-legend .lname { color: var(--color-text-secondary); }
.tm-design .result-block .s-legend .lval { margin-left: auto; color: var(--color-text-primary); font-variant-numeric: tabular-nums; }
.tm-design .result-block .s-foot { color: var(--color-text-tertiary); font-size: 11px; font-family: var(--font-family-mono); }

/* Top words widget */
.tm-design .result-block .tw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2) var(--space-4); }
.tm-design .result-block .tw-row { display: grid; grid-template-columns: minmax(0,1fr) max-content; align-items: center; gap: var(--space-2); }
.tm-design .result-block .tw-bar { position: relative; height: 26px; border-radius: var(--radius-xs); background: rgba(245,245,247,0.04); overflow: hidden; display: flex; align-items: center; }
.tm-design .result-block .tw-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: var(--radius-xs); background: linear-gradient(90deg, rgba(245,245,247,0.16) 0%, rgba(245,245,247,0.06) 100%); }
.tm-design .result-block .tw-word { position: relative; z-index: 1; padding-left: var(--space-4); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tm-design .result-block .tw-count { font-family: var(--font-family-mono); font-size: var(--font-size-xs); color: var(--color-text-tertiary); text-align: right; font-variant-numeric: tabular-nums; min-width: 20px; padding-left: 2px; }

/* Emoji widget */
.tm-design .result-block .em-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2) var(--space-5); }
.tm-design .result-block .em-row {
  display: grid; grid-template-columns: 22px minmax(0,1fr) 42px; align-items: center; gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xs); background: rgba(245,245,247,0.03); border: 1px solid var(--color-border-subtle);
}
.tm-design .result-block .em-row .glyph { font-size: 18px; line-height: 1; text-align: center; }
.tm-design .result-block .em-bar { height: 4px; background: rgba(245,245,247,0.07); border-radius: var(--radius-lg); overflow: hidden; }
.tm-design .result-block .em-bar > span { display: block; height: 100%; background: var(--color-text-primary); border-radius: var(--radius-lg); opacity: 0.85; }
.tm-design .result-block .em-pct { font-family: var(--font-family-mono); font-size: var(--font-size-xs); color: var(--color-text-secondary); text-align: right; font-variant-numeric: tabular-nums; }

/* Comments table */
.tm-design .result-block .ctable-card {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.tm-design .result-block .ctable-scroll { max-height: 580px; overflow: auto; }
.tm-design .result-block table.ctable { width: 100%; border-collapse: collapse; table-layout: fixed; min-width: 760px; }
.tm-design .result-block .ctable thead th {
  position: sticky; top: 0; z-index: 2;
  background: #121214;
  text-align: left; vertical-align: middle;
  font-family: var(--font-family-mono); font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--color-text-tertiary);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border-strong);
  white-space: nowrap;
}
.tm-design .result-block .ctable thead th.num { text-align: right; }
.tm-design .result-block .ctable tbody td { padding: var(--space-4) var(--space-5); vertical-align: top; border-bottom: 1px solid var(--color-border-subtle); }
.tm-design .result-block .ctable tbody tr:last-child td { border-bottom: 0; }
.tm-design .result-block .ctable tbody tr:hover td { background: rgba(245,245,247,0.018); }
.tm-design .result-block .c-author { font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tm-design .result-block .c-text { font-size: var(--font-size-sm); color: var(--color-text-primary); line-height: 1.55; overflow-wrap: anywhere; }
.tm-design .result-block .c-sent { display: inline-flex; align-items: center; gap: var(--space-3); font-family: var(--font-family-mono); font-size: var(--font-size-xs); color: var(--color-text-secondary); white-space: nowrap; min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.tm-design .result-block .c-sent .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.tm-design .result-block .c-sent.pos .dot { background: var(--color-accent-positive); }
.tm-design .result-block .c-sent.neu .dot { background: rgba(245,245,247,0.30); }
.tm-design .result-block .c-sent.neg .dot { background: var(--color-accent-negative); }
.tm-design .result-block .c-num { font-family: var(--font-family-mono); font-size: var(--font-size-sm); color: var(--color-text-secondary); text-align: right; font-variant-numeric: tabular-nums; }
.tm-design .result-block .c-num.zero { color: var(--color-text-disabled); }
.tm-design .result-block .c-when { font-family: var(--font-family-mono); font-size: var(--font-size-xs); color: var(--color-text-tertiary); white-space: nowrap; }
.tm-design .result-block .m-label { display: none; }

/* Skeleton */
@keyframes shimmer-rb { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.tm-design .result-block .skel {
  display: block; border-radius: var(--radius-xs);
  background: linear-gradient(90deg, rgba(245,245,247,0.04) 0%, rgba(245,245,247,0.11) 50%, rgba(245,245,247,0.04) 100%);
  background-size: 200% 100%; animation: shimmer-rb 1.6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) { .tm-design .result-block .skel { animation-duration: 3s; } }
.tm-design .result-block .sk-line { height: 12px; border-radius: var(--radius-xs); }
.tm-design .result-block .skw-head { display: flex; justify-content: space-between; align-items: center; gap: var(--space-6); padding: var(--space-5) var(--space-6); background: var(--color-surface-raised); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); }
.tm-design .result-block .sk-emrow { height: 34px; border-radius: var(--radius-xs); }
.tm-design .result-block .sk-ctable { padding: 0; background: var(--color-surface-raised); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); overflow: hidden; }
.tm-design .result-block .sk-ctrow { display: grid; grid-template-columns: 168px minmax(0,1fr) 116px 76px 76px 84px; gap: var(--space-5); padding: var(--space-5); border-bottom: 1px solid var(--color-border-subtle); align-items: center; }
.tm-design .result-block .sk-ctrow:last-child { border-bottom: 0; }
.tm-design .result-block .sk-cthead { background: #121214; border-bottom: 1px solid var(--color-border-strong); }

/* Responsive (container-query driven, keyed off the result block's own width) */
@container rb (max-width: 1000px) {
  .tm-design .result-block .tw-grid { gap: var(--space-1) var(--space-3); }
  .tm-design .result-block .em-grid { gap: var(--space-1) var(--space-3); }
}
@container rb (max-width: 720px) {
  .tm-design .result-block .rb-widgets { grid-template-columns: 1fr; gap: var(--space-5); }
  .tm-design .result-block .tw-grid { grid-template-columns: 1fr 1fr; gap: var(--space-2) var(--space-6); }
  .tm-design .result-block .em-grid { grid-template-columns: 1fr 1fr; gap: var(--space-2) var(--space-6); }
}
@container rb (max-width: 640px) {
  .tm-design .result-block .rb-head { flex-direction: column; align-items: stretch; }
  .tm-design .result-block .rb-exports { justify-content: flex-start; }
  .tm-design .result-block .rb-head-video { max-width: 100%; }
  .tm-design .result-block .widget-meta { text-align: left; }
  .tm-design .result-block .tw-grid { grid-template-columns: 1fr; gap: var(--space-1) 0; }
  .tm-design .result-block .em-grid { grid-template-columns: 1fr; gap: var(--space-2) 0; }
  .tm-design .result-block table.ctable { min-width: 0; width: 100%; display: block; table-layout: auto; }
  .tm-design .result-block .ctable colgroup, .tm-design .result-block .ctable thead { display: none; }
  .tm-design .result-block .ctable tbody { display: block; }
  .tm-design .result-block .ctable tbody tr { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-2) var(--space-4); padding: var(--space-5) var(--space-6); border-bottom: 1px solid var(--color-border-subtle); }
  .tm-design .result-block .ctable tbody tr:hover td { background: transparent; }
  .tm-design .result-block .ctable tbody td { display: inline-flex; align-items: baseline; gap: var(--space-1); padding: 0; border: 0; }
  .tm-design .result-block .ctable .col-author { order: 1; min-width: 0; max-width: 100%; }
  .tm-design .result-block .ctable .col-author .c-author { max-width: 100%; color: var(--color-text-primary); }
  .tm-design .result-block .ctable .col-sent { order: 2; }
  .tm-design .result-block .ctable .col-likes { order: 3; }
  .tm-design .result-block .ctable .col-replies { order: 4; }
  .tm-design .result-block .ctable .col-when { order: 5; margin-left: auto; }
  .tm-design .result-block .ctable .col-likes .c-num, .tm-design .result-block .ctable .col-replies .c-num { display: inline; color: var(--color-text-secondary); }
  .tm-design .result-block .ctable .col-comment { order: 6; flex: 0 0 100%; display: block; margin-top: 2px; }
  .tm-design .result-block .m-label { display: inline; font-family: var(--font-family-mono); font-size: 11px; color: var(--color-text-tertiary); }
  .tm-design .result-block .skw-head { flex-wrap: wrap; }
  .tm-design .result-block .sk-ctrow { display: flex; flex-wrap: wrap; gap: var(--space-3) var(--space-4); }
  .tm-design .result-block .sk-ctrow > .skel { flex: 0 0 auto; min-width: 48px; }
  .tm-design .result-block .sk-ctrow > .skel:nth-child(2) { flex: 1 1 100%; order: 6; }
}
```

- [ ] **Step 5: Sanity-check CSS parses (no build).**

Run: `node -e "const fs=require('fs');const c=fs.readFileSync('src/app/globals.css','utf8');const o=(c.match(/{/g)||[]).length,cl=(c.match(/}/g)||[]).length;if(o!==cl){console.error('brace mismatch',o,cl);process.exit(1)}console.log('braces balanced',o)"`
Expected: prints "braces balanced N" (open == close).

- [ ] **Step 6: Commit.**

```bash
git add src/app/globals.css
git commit -m "style(result-block): scoped CSS + width tokens (demo-wrap, main-inner)"
```

---

## Task 3: ExportBar pills

**Files:**
- Modify: `src/components/export-bar.tsx`
- Test: `src/components/__tests__/export-bar.test.tsx` (existing, text-based, must still pass)

- [ ] **Step 1: Replace the component body with design `.btn` pills.**

Replace the entire `export function ExportBar(...) { ... }` body so the file reads:
```tsx
"use client"

import { Download } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ExtractTier } from "@/components/tubemine"

export function ExportBar({
  tier,
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

  // anon + free share the single CSV control (Papa.unparse runs client-side).
  if (tier === "anonymous" || tier === "free") {
    return (
      <button type="button" onClick={onDownloadCsv} className="btn btn--primary tm-action-btn">
        <Download className="icon icon-sm" aria-hidden="true" />
        {tCommon("save_csv")}
      </button>
    )
  }

  // tier === "pro"
  return (
    <>
      <button type="button" onClick={onDownloadCsv} className="btn btn--primary tm-action-btn">
        <Download className="icon icon-sm" aria-hidden="true" />
        {tCommon("save_csv")}
      </button>
      <button type="button" onClick={() => void onDownloadJson()} className="btn btn--outline">
        <Download className="icon icon-sm" aria-hidden="true" />
        {tCommon("save_json")}
      </button>
      <button type="button" onClick={() => void onDownloadExcel()} className="btn btn--outline">
        <Download className="icon icon-sm" aria-hidden="true" />
        {tCommon("save_excel")}
      </button>
    </>
  )
}
```

- [ ] **Step 2: Run the export-bar test.**

Run: `NODE_ENV=test npx vitest run src/components/__tests__/export-bar.test.tsx`
Expected: PASS (all 3 tests; text content unchanged).

- [ ] **Step 3: Commit.**

```bash
git add src/components/export-bar.tsx
git commit -m "style(export-bar): design .btn pills (primary CSV + outline JSON/Excel)"
```

---

## Task 4: SentimentPanel -> bare `.widget`

**Files:**
- Modify: `src/components/sentiment.tsx`
- Test: `src/components/__tests__/sentiment.test.tsx` (new)

- [ ] **Step 1: Write the failing test.**

Create `src/components/__tests__/sentiment.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SentimentPanel, type SentimentAggregateProp } from "../sentiment"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}))
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

const agg: SentimentAggregateProp = {
  positive: 13207, neutral: 4661, negative: 1554,
  score: 0.6, sampleSize: 19422, coverage: 0.92,
  languages: ["en"], ruShare: 0,
}
const dist = { positive: 0.68, neutral: 0.24, negative: 0.08 }

describe("SentimentPanel redesign", () => {
  it("anon: renders the locked teaser (no bar, no legend)", () => {
    const { container } = render(
      <SentimentPanel tier="anonymous" aggregate={null} distribution={null} commentsAnalyzed={19422} />,
    )
    expect(container.querySelector(".widget")).not.toBeNull()
    expect(container.querySelector(".s-locked")).not.toBeNull()
    expect(container.querySelector(".s-bar")).toBeNull()
    expect(container.querySelector(".s-legend")).toBeNull()
  })

  it("anon with 0 comments: renders nothing", () => {
    const { container } = render(
      <SentimentPanel tier="anonymous" aggregate={null} distribution={null} commentsAnalyzed={0} />,
    )
    expect(container.querySelector(".widget")).toBeNull()
  })

  it("free: renders the h14 bar + label, no legend", () => {
    const { container } = render(
      <SentimentPanel tier="free" aggregate={agg} distribution={dist} commentsAnalyzed={19422} />,
    )
    expect(container.querySelector(".s-bar.h14")).not.toBeNull()
    expect(container.querySelector(".s-label")).not.toBeNull()
    expect(container.querySelector(".s-legend")).toBeNull()
    expect(container.querySelector(".s-foot")).toBeNull()
  })

  it("pro: renders h22 bar with % labels + legend + foot", () => {
    const { container } = render(
      <SentimentPanel tier="pro" aggregate={agg} distribution={dist} commentsAnalyzed={19422} />,
    )
    expect(container.querySelector(".s-bar.h22")).not.toBeNull()
    expect(container.querySelector(".s-legend")).not.toBeNull()
    expect(container.querySelector(".s-foot")).not.toBeNull()
    expect(container.textContent).toContain("68%")
  })

  it("pro: shows RU pill when ruShare >= 0.25", () => {
    const { container } = render(
      <SentimentPanel tier="pro" aggregate={{ ...agg, ruShare: 0.3 }} distribution={dist} commentsAnalyzed={19422} />,
    )
    expect(container.querySelector(".ru-pill")).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails.**

Run: `NODE_ENV=test npx vitest run src/components/__tests__/sentiment.test.tsx`
Expected: FAIL (current component renders `<Card>`, no `.s-locked` / `.s-bar` / `.widget`).

- [ ] **Step 3: Rewrite `src/components/sentiment.tsx`.**

Replace the file from the `export function SentimentPanel` declaration through the end (keep the top `export type SentimentAggregateProp` and `export type { SentimentDistribution }`). Replace imports at the top: remove `Activity, FlaskConical`; remove `Card, CardContent`. The new file:
```tsx
"use client"

import { useEffect } from "react"
import { Lock } from "lucide-react"
import { track } from "@vercel/analytics"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { formatNumber } from "@/lib/format"
import type { ExtractTier } from "@/components/tubemine"
import {
  deriveDistribution,
  qualitativeSummary,
  type SentimentDistribution,
} from "@/lib/sentiment-summary"

export type SentimentAggregateProp = {
  positive: number
  neutral: number
  negative: number
  score: number
  sampleSize: number
  coverage: number
  languages: Array<"en" | "ru">
  ruShare: number
}

export type { SentimentDistribution }

export function SentimentPanel({
  tier,
  aggregate,
  distribution,
  commentsAnalyzed,
}: {
  tier: ExtractTier
  aggregate: SentimentAggregateProp | null
  distribution: SentimentDistribution | null
  commentsAnalyzed: number
}) {
  const tLabel = useTranslations("sentiment_label")
  const t = useTranslations("analytics.sentiment")
  useEffect(() => {
    if (tier === "anonymous") {
      track("sentiment_curiosity_gap_shown", { commentsAnalyzed })
      return
    }
    if (!aggregate) return
    track("sentiment_rendered", {
      tier,
      score: Number(aggregate.score.toFixed(2)),
      positive: aggregate.positive,
      negative: aggregate.negative,
      coverage: Number(aggregate.coverage.toFixed(2)),
      languages: aggregate.languages.join(","),
    })
  }, [tier, aggregate, commentsAnalyzed])

  if (tier === "anonymous") {
    if (commentsAnalyzed === 0) return null
    return (
      <div className="widget" data-testid="sentiment-widget">
        <Head t={t} ru={false} count={commentsAnalyzed} />
        <div className="s-locked">
          <span className="lock-badge">
            <Lock className="size-4" aria-hidden="true" />
          </span>
          <div>{t("anon_locked_text")}</div>
          <div>
            <Link href="/login?next=/">{t("anon_locked_cta")}</Link>
          </div>
        </div>
      </div>
    )
  }

  if (!aggregate) return null
  const dist = distribution ?? deriveDistribution(aggregate)
  if (!dist) return null

  const ruExperimental = aggregate.ruShare >= 0.25
  const summary = tLabel(qualitativeSummary(dist))
  const pct = (n: number) => Math.round(n * 100)

  if (tier === "free") {
    return (
      <div className="widget" data-testid="sentiment-widget">
        <Head t={t} ru={ruExperimental} count={aggregate.sampleSize} />
        <div className="widget-body">
          <div className="s-bar h14" role="img" aria-label={t("free_bar_aria")}>
            {aggregate.positive > 0 && <span className="pos" style={{ width: `${dist.positive * 100}%` }} />}
            {aggregate.neutral > 0 && <span className="neu" style={{ width: `${dist.neutral * 100}%` }} />}
            {aggregate.negative > 0 && <span className="neg" style={{ width: `${dist.negative * 100}%` }} />}
          </div>
          <div className="s-label">
            <span className="dot" /> {summary}
          </div>
        </div>
        <div className="tier-cta widget-foot">
          <Lock className="size-3" aria-hidden="true" />
          <Link href="/pricing">{t("upgrade_cta")}</Link>
        </div>
      </div>
    )
  }

  // pro
  return (
    <div className="widget" data-testid="sentiment-widget">
      <Head t={t} ru={ruExperimental} count={aggregate.sampleSize} />
      <div className="widget-body">
        <div
          className="s-bar h22"
          role="img"
          aria-label={t("pro_bar_aria", { pos: pct(dist.positive), neu: pct(dist.neutral), neg: pct(dist.negative) })}
        >
          {aggregate.positive > 0 && (
            <span className="pos" style={{ width: `${dist.positive * 100}%` }}>
              {pct(dist.positive) >= 8 ? <i>{pct(dist.positive)}%</i> : null}
            </span>
          )}
          {aggregate.neutral > 0 && (
            <span className="neu" style={{ width: `${dist.neutral * 100}%` }}>
              {pct(dist.neutral) >= 8 ? <i>{pct(dist.neutral)}%</i> : null}
            </span>
          )}
          {aggregate.negative > 0 && (
            <span className="neg" style={{ width: `${dist.negative * 100}%` }}>
              {pct(dist.negative) >= 8 ? <i>{pct(dist.negative)}%</i> : null}
            </span>
          )}
        </div>
        <div className="s-legend">
          <div className="row">
            <span className="ld pos" />
            <span className="lname">{t("legend_positive")}</span>
            <span className="lval">{formatNumber(aggregate.positive)}</span>
          </div>
          <div className="row">
            <span className="ld neu" />
            <span className="lname">{t("legend_neutral")}</span>
            <span className="lval">{formatNumber(aggregate.neutral)}</span>
          </div>
          <div className="row">
            <span className="ld neg" />
            <span className="lname">{t("legend_negative")}</span>
            <span className="lval">{formatNumber(aggregate.negative)}</span>
          </div>
        </div>
        <div className="s-label">
          <span className="dot" /> {summary}
        </div>
      </div>
      <div className="s-foot widget-foot">
        {t("footnote", { percent: Math.round(aggregate.coverage * 100) })}
      </div>
    </div>
  )
}

function Head({
  t,
  ru,
  count,
}: {
  t: (key: string, values?: Record<string, number | string>) => string
  ru: boolean
  count: number
}) {
  return (
    <div className="widget-head">
      <div className="widget-head-l">
        <div className="widget-title">
          {t("heading")}
          {ru ? (
            <span className="ru-pill" title={t("ru_experimental_title")}>
              <span>&#946;</span> {t("ru_experimental")}
            </span>
          ) : null}
        </div>
        <div className="widget-sub">{t("across_comments", { count })}</div>
      </div>
    </div>
  )
}
```
Note: `&#946;` is the Greek small letter beta (the RU-experimental marker), used instead of any dash glyph.

- [ ] **Step 4: Run the test to confirm it passes.**

Run: `NODE_ENV=test npx vitest run src/components/__tests__/sentiment.test.tsx`
Expected: PASS (all 5).

- [ ] **Step 5: Commit.**

```bash
git add src/components/sentiment.tsx src/components/__tests__/sentiment.test.tsx
git commit -m "style(sentiment): bare .widget (locked teaser / free bar / pro legend)"
```

---

## Task 5: TopWordsPanel -> bare `.widget`

**Files:**
- Modify: `src/components/top-words.tsx`
- Test: `src/components/__tests__/top-words.test.tsx` (new)

- [ ] **Step 1: Write the failing test.**

Create `src/components/__tests__/top-words.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TopWordsPanel } from "../top-words"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, number | string>) =>
    values && values.count !== undefined ? `${key}:${values.count}` : key,
}))

const words = Array.from({ length: 40 }, (_, i) => ({ word: `w${i}`, count: 100 - i }))

describe("TopWordsPanel redesign", () => {
  it("renders a .widget with a .tw-grid of .tw-row, word inside the bar", () => {
    const { container } = render(
      <TopWordsPanel tier="free" items={words.slice(0, 15)} totalUnique={1284} commentsAnalyzed={19422} />,
    )
    expect(container.querySelector(".widget")).not.toBeNull()
    expect(container.querySelector(".tw-grid")).not.toBeNull()
    const firstRow = container.querySelector(".tw-row")
    expect(firstRow?.querySelector(".tw-bar .tw-word")).not.toBeNull()
    expect(firstRow?.querySelector(".tw-count")).not.toBeNull()
  })

  it("does NOT render the methodology footnote text", () => {
    const { container } = render(
      <TopWordsPanel tier="free" items={words.slice(0, 15)} totalUnique={1284} commentsAnalyzed={19422} />,
    )
    expect(container.textContent).not.toContain("footnote")
  })

  it("pro: shows 30 rows initially and a Show all toggle when > 30", () => {
    const { container } = render(
      <TopWordsPanel tier="pro" items={words} totalUnique={1284} commentsAnalyzed={19422} />,
    )
    expect(container.querySelectorAll(".tw-row")).toHaveLength(30)
    expect(container.querySelector(".tier-cta.btnlike")).not.toBeNull()
  })

  it("anon: shows the sign-in CTA when more words remain", () => {
    const { container } = render(
      <TopWordsPanel tier="anonymous" items={words.slice(0, 5)} totalUnique={1284} commentsAnalyzed={19422} />,
    )
    expect(container.querySelectorAll(".tw-row")).toHaveLength(5)
    expect(container.querySelector(".tier-cta a")).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails.**

Run: `NODE_ENV=test npx vitest run src/components/__tests__/top-words.test.tsx`
Expected: FAIL (current renders `<Card>` + `.tw-row` with a different structure, plus footnote).

- [ ] **Step 3: Rewrite `src/components/top-words.tsx`.**

Replace imports (remove `Card, CardContent`, `Sparkles`; add `ChevronDown, Lock, LogIn`) and the component. The full file:
```tsx
"use client"

import { useState } from "react"
import { ChevronDown, Lock, LogIn } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { formatNumber } from "@/lib/format"
import type { WordCount } from "@/lib/top-words"
import type { ExtractTier } from "@/components/tubemine"

export function TopWordsPanel({
  tier,
  items,
  totalUnique,
  commentsAnalyzed,
}: {
  tier: ExtractTier
  items: WordCount[]
  totalUnique: number
  commentsAnalyzed: number
}) {
  const t = useTranslations("analytics.top_words")
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null

  const PRO_INITIAL_CAP = 30
  const initialCap = tier === "pro" ? PRO_INITIAL_CAP : items.length
  const displayedItems = expanded ? items : items.slice(0, initialCap)
  const hasMore = tier === "pro" && items.length > PRO_INITIAL_CAP

  const max = items[0].count
  const remaining = Math.max(0, totalUnique - items.length)
  const cta = upgradeCta(t, tier, remaining)

  return (
    <div className="widget" data-testid="top-words-widget">
      <div className="widget-head">
        <div className="widget-head-l">
          <div className="widget-title">{t("heading")}</div>
          <div className="widget-sub">{t("across_comments", { count: commentsAnalyzed })}</div>
        </div>
        <div className="widget-meta">
          {t("unique_top_shown", { total: totalUnique, shown: items.length })}
        </div>
      </div>
      <div className="widget-body">
        <div className="tw-grid">
          {displayedItems.map(({ word, count }) => {
            const pct = Math.max(8, Math.round((count / max) * 100))
            return (
              <div key={word} className="tw-row">
                <div className="tw-bar">
                  <span className="tw-fill" style={{ width: `${pct}%` }} />
                  <span className="tw-word">{word}</span>
                </div>
                <div className="tw-count">{formatNumber(count)}</div>
              </div>
            )
          })}
        </div>
      </div>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="tier-cta btnlike widget-foot"
        >
          <ChevronDown
            className="size-3"
            aria-hidden="true"
            style={{ transform: expanded ? "rotate(180deg)" : undefined }}
          />
          <span>{expanded ? t("hide") : t("show_all", { count: items.length })}</span>
        </button>
      ) : null}
      {cta ? (
        <div className="tier-cta widget-foot">
          {tier === "anonymous" ? (
            <LogIn className="size-3" aria-hidden="true" />
          ) : (
            <Lock className="size-3" aria-hidden="true" />
          )}
          <Link href={cta.href}>{cta.label}</Link>
        </div>
      ) : null}
    </div>
  )
}

function upgradeCta(
  t: (key: string, values?: Record<string, number | string>) => string,
  tier: ExtractTier,
  remaining: number,
): { href: string; label: string } | null {
  if (remaining <= 0) return null
  if (tier === "anonymous") {
    return { href: "/login?next=/", label: t("cta_anon", { count: remaining }) }
  }
  if (tier === "free") {
    return { href: "/pricing", label: t("cta_free", { count: remaining }) }
  }
  return null
}
```
Note: both the Show-all toggle and the CTA use `.widget-foot` (`margin-top: auto`); when both render, the toggle (first in source) gets pushed to the bottom and the CTA follows it. In practice pro never shows the CTA (`upgradeCta` returns null for pro), and anon/free never show the toggle, so only one `.widget-foot` is present per tier.

- [ ] **Step 4: Run the test to confirm it passes.**

Run: `NODE_ENV=test npx vitest run src/components/__tests__/top-words.test.tsx`
Expected: PASS (all 4).

- [ ] **Step 5: Commit.**

```bash
git add src/components/top-words.tsx src/components/__tests__/top-words.test.tsx
git commit -m "style(top-words): bare .widget, word inside proportional bar, no footnote"
```

---

## Task 6: EmojiPanel -> compact `.widget` rows

**Files:**
- Modify: `src/components/emoji-frequency.tsx`
- Test: `src/components/__tests__/emoji-frequency.test.tsx` (existing, extend)

- [ ] **Step 1: Update the test (add `.em-row` assertions, keep M17 gate).**

Replace the whole `describe(...)` block in `src/components/__tests__/emoji-frequency.test.tsx` with:
```tsx
describe("EmojiPanel redesign + M17 percent gate", () => {
  it("renders compact .em-row rows with a bar", () => {
    const { container } = render(<EmojiPanel tier="pro" items={items} totalUnique={20} />)
    expect(container.querySelector(".widget")).not.toBeNull()
    expect(container.querySelector(".em-grid")).not.toBeNull()
    expect(container.querySelectorAll(".em-row")).toHaveLength(items.length)
    expect(container.querySelector(".em-row .em-bar")).not.toBeNull()
  })

  it("anon: hides % values from visible text", () => {
    render(<EmojiPanel tier="anonymous" items={items} totalUnique={20} />)
    expect(document.body.textContent).not.toContain("50%")
    expect(document.body.textContent).not.toContain("25%")
  })

  it("free: hides % values from visible text", () => {
    render(<EmojiPanel tier="free" items={items} totalUnique={20} />)
    expect(document.body.textContent).not.toContain("50%")
    expect(document.body.textContent).not.toContain("25%")
  })

  it("pro: shows % values in visible text", () => {
    render(<EmojiPanel tier="pro" items={items} totalUnique={20} />)
    expect(document.body.textContent).toContain("50%")
    expect(document.body.textContent).toContain("25%")
  })
})
```
(The `items`, mocks, and imports at the top of the file stay as they are.)

- [ ] **Step 2: Run it to confirm the new structural test fails.**

Run: `NODE_ENV=test npx vitest run src/components/__tests__/emoji-frequency.test.tsx`
Expected: FAIL on the first test (`.em-grid` / `.em-row` not present yet); the 3 gate tests still pass.

- [ ] **Step 3: Rewrite `src/components/emoji-frequency.tsx`.**

Replace imports (`Smile` -> `LogIn`; keep `Lock`) and the component. Full file:
```tsx
"use client"

import { useEffect } from "react"
import { Lock, LogIn } from "lucide-react"
import { track } from "@vercel/analytics"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { emojiName, type EmojiCount } from "@/lib/emoji-frequency"
import { formatNumber } from "@/lib/format"
import type { ExtractTier } from "@/components/tubemine"

export function EmojiPanel({
  tier,
  items,
  totalUnique,
}: {
  tier: ExtractTier
  items: EmojiCount[]
  totalUnique: number
}) {
  const t = useTranslations("analytics.emoji")
  useEffect(() => {
    if (items.length === 0) return
    track("emoji_rendered", {
      tier,
      uniqueCount: items.length,
      totalCount: items.reduce((sum, e) => sum + e.count, 0),
    })
  }, [tier, items])

  if (items.length === 0) return null

  const remaining = Math.max(0, totalUnique - items.length)
  const cta = upgradeCta(t, tier, remaining)
  const maxShare = items[0]?.share ?? 0

  return (
    <div className="widget" data-testid="emoji-widget">
      <div className="widget-head">
        <div className="widget-head-l">
          <div className="widget-title">{t("heading")}</div>
          <div className="widget-sub">{t("sub")}</div>
        </div>
        <div className="widget-meta">
          {t("unique_top_shown", { total: totalUnique, shown: items.length })}
        </div>
      </div>
      <div className="widget-body">
        <div className="em-grid">
          {items.map(({ emoji, count, share }) => {
            const barPct = maxShare > 0 ? Math.round((share / maxShare) * 100) : 0
            return (
              <div
                key={emoji}
                className="em-row"
                role="img"
                aria-label={
                  tier === "pro"
                    ? `${emojiName(emoji)}, ${count} occurrences (${Math.round(share * 100)} percent)`
                    : `${emojiName(emoji)}, ${count} occurrences`
                }
              >
                <span className="glyph">{emoji}</span>
                <span className="em-bar">
                  <span style={{ width: `${barPct}%` }} />
                </span>
                <span className="em-pct">
                  {tier === "pro" ? `${Math.round(share * 100)}%` : formatNumber(count)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      {cta ? (
        <div className="tier-cta widget-foot">
          {tier === "anonymous" ? (
            <LogIn className="size-3" aria-hidden="true" />
          ) : (
            <Lock className="size-3" aria-hidden="true" />
          )}
          <Link href={cta.href}>{cta.label}</Link>
        </div>
      ) : null}
    </div>
  )
}

function upgradeCta(
  t: (key: string, values?: Record<string, number | string>) => string,
  tier: ExtractTier,
  remaining: number,
): { href: string; label: string } | null {
  if (remaining <= 0) return null
  if (tier === "anonymous") {
    return { href: "/login?next=/", label: t("cta_anon", { count: remaining }) }
  }
  if (tier === "free") {
    return { href: "/pricing", label: t("cta_free", { count: remaining }) }
  }
  return null
}
```

- [ ] **Step 4: Run the test to confirm all pass.**

Run: `NODE_ENV=test npx vitest run src/components/__tests__/emoji-frequency.test.tsx`
Expected: PASS (all 4, including the M17 gate).

- [ ] **Step 5: Commit.**

```bash
git add src/components/emoji-frequency.tsx src/components/__tests__/emoji-frequency.test.tsx
git commit -m "style(emoji): compact glyph|bar|value rows (percent gated to pro)"
```

---

## Task 7: ResultBlock + CommentsTable + ResultBlockSkeleton

**Files:**
- Create: `src/components/result-block.tsx`
- Test: `src/components/__tests__/result-block.test.tsx` (new)

- [ ] **Step 1: Write the failing test.**

Create `src/components/__tests__/result-block.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ResultBlock, ResultBlockSkeleton, type ResultBlockData } from "../result-block"
import type { SentimentAggregateProp } from "../sentiment"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}))
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, number | string>) =>
    values && values.count !== undefined ? `${key}:${values.count}` : key,
}))

const agg: SentimentAggregateProp = {
  positive: 13207, neutral: 4661, negative: 1554,
  score: 0.6, sampleSize: 19422, coverage: 0.92,
  languages: ["en"], ruShare: 0,
}
const dist = { positive: 0.68, neutral: 0.24, negative: 0.08 }

const base: ResultBlockData = {
  tier: "pro",
  commentsAnalyzed: 19422,
  videoTitle: "A very long video title that should be ellipsized in the header subline area",
  channel: "@PixelForge",
  sentiment: agg,
  distribution: dist,
  topWords: [
    { word: "tutorial", count: 847 },
    { word: "colorgradingworkflow", count: 662 },
  ],
  uniqueWordsTotal: 1284,
  topEmoji: [
    { emoji: "\u{1F525}", count: 3541, share: 0.182 },
    { emoji: "❤️", count: 2860, share: 0.147 },
  ],
  uniqueEmojiTotal: 142,
  comments: [
    { author: "@sarah_makes", text: "Great workflow video, instantly subscribed.", likes: 1240, replies: 38, publishedAt: "2026-05-30T12:00:00.000Z", sentiment: "positive" },
    { author: "@longwinded_larry_the_editor_who_writes_full_essays", text: "x".repeat(400), likes: 17, replies: 0, publishedAt: "2026-05-28T12:00:00.000Z", sentiment: "neutral" },
  ],
  onDownloadCsv: vi.fn(),
  onDownloadJson: vi.fn(),
  onDownloadExcel: vi.fn(),
}

describe("ResultBlock", () => {
  it("renders header + 3-widget grid (Sentiment, Top Words, Emoji order) + table", () => {
    const { container } = render(<ResultBlock {...base} />)
    expect(container.querySelector(".result-block")).not.toBeNull()
    expect(container.querySelector(".rb-head")).not.toBeNull()
    const widgets = container.querySelector(".rb-widgets")
    expect(widgets).not.toBeNull()
    const order = Array.from(widgets!.children).map((c) => c.getAttribute("data-testid"))
    expect(order).toEqual(["sentiment-widget", "top-words-widget", "emoji-widget"])
    expect(container.querySelector(".ctable-card table.ctable")).not.toBeNull()
  })

  it("header subline truncates: carries a title attr with the full title + channel", () => {
    const { container } = render(<ResultBlock {...base} />)
    const sub = container.querySelector(".rb-head-video")
    expect(sub).not.toBeNull()
    expect(sub!.getAttribute("title")).toContain(base.videoTitle)
    expect(sub!.getAttribute("title")).toContain("@PixelForge")
    expect(sub!.querySelector(".by")?.textContent).toContain("@PixelForge")
  })

  it("comments table has 6 columns including Sentiment, dash for zero replies", () => {
    const { container } = render(<ResultBlock {...base} />)
    const heads = Array.from(container.querySelectorAll(".ctable thead th")).map((th) => th.textContent)
    expect(heads).toEqual(["col_author", "col_comment", "col_sentiment", "col_likes", "col_replies", "col_when"])
    // second comment has replies: 0 -> dash placeholder + .zero
    const zero = container.querySelector(".ctable tbody tr:last-child .col-replies .c-num.zero")
    expect(zero?.textContent).toBe("dash_placeholder")
  })

  it("each comment row renders a sentiment chip and mobile m-label hooks", () => {
    const { container } = render(<ResultBlock {...base} />)
    expect(container.querySelector(".col-sent .c-sent.pos")).not.toBeNull()
    expect(container.querySelector(".col-sent .c-sent.neu")).not.toBeNull()
    expect(container.querySelectorAll(".col-likes .m-label").length).toBe(2)
    expect(container.querySelector(".col-author .c-author")?.getAttribute("title")).toContain("@sarah_makes")
  })

  it("anon: locked sentiment + single Save CSV", () => {
    const { container } = render(<ResultBlock {...base} tier="anonymous" sentiment={null} distribution={null} />)
    expect(container.querySelector(".s-locked")).not.toBeNull()
    expect(container.querySelectorAll(".rb-exports button").length).toBe(1)
  })

  it("pro: three export buttons", () => {
    const { container } = render(<ResultBlock {...base} />)
    expect(container.querySelectorAll(".rb-exports button").length).toBe(3)
  })

  it("skeleton renders with testid + result-block container", () => {
    const { container, getByTestId } = render(<ResultBlockSkeleton />)
    expect(getByTestId("result-block-skeleton")).not.toBeNull()
    expect(container.querySelector(".result-block .rb-widgets")).not.toBeNull()
    expect(container.querySelector(".sk-ctable")).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails.**

Run: `NODE_ENV=test npx vitest run src/components/__tests__/result-block.test.tsx`
Expected: FAIL ("Cannot find module '../result-block'").

- [ ] **Step 3: Create `src/components/result-block.tsx`.**

```tsx
"use client"

import { useTranslations } from "next-intl"
import { formatNumber, formatDateRelative } from "@/lib/format"
import type { Comment } from "@/lib/types"
import type { WordCount } from "@/lib/top-words"
import type { EmojiCount } from "@/lib/emoji-frequency"
import {
  SentimentPanel,
  type SentimentAggregateProp,
  type SentimentDistribution,
} from "@/components/sentiment"
import { TopWordsPanel } from "@/components/top-words"
import { EmojiPanel } from "@/components/emoji-frequency"
import { ExportBar } from "@/components/export-bar"
import type { ExtractTier } from "@/components/tubemine"

export type ResultBlockData = {
  tier: ExtractTier
  commentsAnalyzed: number
  videoTitle: string
  channel: string
  sentiment: SentimentAggregateProp | null
  distribution: SentimentDistribution | null
  topWords: WordCount[]
  uniqueWordsTotal: number
  topEmoji: EmojiCount[]
  uniqueEmojiTotal: number
  comments: Comment[]
  onDownloadCsv: () => void
  onDownloadJson: () => void | Promise<void>
  onDownloadExcel: () => void | Promise<void>
}

export function ResultBlock(props: ResultBlockData) {
  const tEx = useTranslations("extractor")
  const { tier, commentsAnalyzed, videoTitle, channel } = props
  return (
    <div className="result-block">
      <div className="rb-head">
        <div className="rb-head-l">
          <div className="rb-head-title">{tEx("results_header", { count: commentsAnalyzed })}</div>
          {videoTitle ? (
            <div className="rb-head-video" title={`${videoTitle} ${channel}`.trim()}>
              {videoTitle}
              {channel ? <span className="by">{` · ${channel}`}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="rb-exports">
          <ExportBar
            tier={tier}
            onDownloadCsv={props.onDownloadCsv}
            onDownloadJson={props.onDownloadJson}
            onDownloadExcel={props.onDownloadExcel}
          />
        </div>
      </div>
      <div className="rb-widgets">
        <SentimentPanel
          tier={tier}
          aggregate={props.sentiment}
          distribution={props.distribution}
          commentsAnalyzed={commentsAnalyzed}
        />
        <TopWordsPanel
          tier={tier}
          items={props.topWords}
          totalUnique={props.uniqueWordsTotal}
          commentsAnalyzed={commentsAnalyzed}
        />
        <EmojiPanel tier={tier} items={props.topEmoji} totalUnique={props.uniqueEmojiTotal} />
      </div>
      <CommentsTable comments={props.comments} />
    </div>
  )
}

function CommentsTable({ comments }: { comments: Comment[] }) {
  const tEx = useTranslations("extractor")
  const tSent = useTranslations("analytics.sentiment")
  const dash = tEx("dash_placeholder")
  return (
    <div className="ctable-card">
      <div className="ctable-scroll">
        <table className="ctable">
          <colgroup>
            <col style={{ width: 168 }} />
            <col />
            <col style={{ width: 116 }} />
            <col style={{ width: 76 }} />
            <col style={{ width: 76 }} />
            <col style={{ width: 84 }} />
          </colgroup>
          <thead>
            <tr>
              <th>{tEx("col_author")}</th>
              <th>{tEx("col_comment")}</th>
              <th>{tEx("col_sentiment")}</th>
              <th className="num">{tEx("col_likes")}</th>
              <th className="num">{tEx("col_replies")}</th>
              <th>{tEx("col_when")}</th>
            </tr>
          </thead>
          <tbody>
            {comments.map((c, i) => (
              <tr key={i}>
                <td className="col-author">
                  <div className="c-author" title={c.author}>
                    {c.author}
                  </div>
                </td>
                <td className="col-comment">
                  <div className="c-text">{c.text}</div>
                </td>
                <td className="col-sent">
                  <SentChip sentiment={c.sentiment} tSent={tSent} dash={dash} />
                </td>
                <td className="col-likes">
                  <div className="c-num">{formatNumber(c.likes)}</div>
                  <span className="m-label">{tEx("col_likes")}</span>
                </td>
                <td className="col-replies">
                  <div className={`c-num${c.replies > 0 ? "" : " zero"}`}>
                    {c.replies > 0 ? formatNumber(c.replies) : dash}
                  </div>
                  <span className="m-label">{tEx("col_replies")}</span>
                </td>
                <td className="col-when">
                  <div className="c-when">{formatDateRelative(c.publishedAt)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SentChip({
  sentiment,
  tSent,
  dash,
}: {
  sentiment?: Comment["sentiment"]
  tSent: (key: string) => string
  dash: string
}) {
  if (sentiment === "positive") {
    return (
      <span className="c-sent pos">
        <span className="dot" />
        {tSent("legend_positive")}
      </span>
    )
  }
  if (sentiment === "negative") {
    return (
      <span className="c-sent neg">
        <span className="dot" />
        {tSent("legend_negative")}
      </span>
    )
  }
  if (sentiment === "neutral") {
    return (
      <span className="c-sent neu">
        <span className="dot" />
        {tSent("legend_neutral")}
      </span>
    )
  }
  return <span className="c-num zero">{dash}</span>
}

export function ResultBlockSkeleton() {
  const sentLineWidths = ["60%", "70%", "80%"]
  const headWidths = [50, 40, 60, 50, 60, 50]
  return (
    <div
      className="result-block"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="result-block-skeleton"
    >
      <div className="skw-head">
        <div style={{ display: "grid", gap: 8, flex: 1, maxWidth: 360 }}>
          <span className="skel sk-line" style={{ height: 16, width: "55%" }} />
          <span className="skel sk-line" style={{ height: 11, width: "80%" }} />
        </div>
        <span className="skel" style={{ width: 104, height: 34, borderRadius: 9999 }} />
      </div>
      <div className="rb-widgets">
        <div className="widget">
          <div className="widget-head">
            <div style={{ display: "grid", gap: 6, flex: 1 }}>
              <span className="skel sk-line" style={{ width: "50%" }} />
              <span className="skel sk-line" style={{ height: 10, width: "70%" }} />
            </div>
          </div>
          <span className="skel sk-line" style={{ height: 14, borderRadius: 9999 }} />
          {sentLineWidths.map((w, i) => (
            <span key={i} className="skel sk-line" style={{ width: w }} />
          ))}
        </div>
        <div className="widget">
          <div className="widget-head">
            <div style={{ display: "grid", gap: 6, flex: 1 }}>
              <span className="skel sk-line" style={{ width: "45%" }} />
              <span className="skel sk-line" style={{ height: 10, width: "70%" }} />
            </div>
          </div>
          <div className="tw-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="skel" style={{ height: 26, borderRadius: 6 }} />
            ))}
          </div>
        </div>
        <div className="widget">
          <div className="widget-head">
            <div style={{ display: "grid", gap: 6, flex: 1 }}>
              <span className="skel sk-line" style={{ width: "40%" }} />
              <span className="skel sk-line" style={{ height: 10, width: "65%" }} />
            </div>
          </div>
          <div className="em-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="skel sk-emrow" />
            ))}
          </div>
        </div>
      </div>
      <div className="sk-ctable">
        <div className="sk-ctrow sk-cthead">
          {headWidths.map((w, i) => (
            <span key={i} className="skel sk-line" style={{ width: `${w}%`, opacity: 0.6 }} />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, r) => (
          <div key={r} className="sk-ctrow">
            <span className="skel sk-line" style={{ width: "80%" }} />
            <span className="skel sk-line" style={{ width: "95%" }} />
            <span className="skel sk-line" style={{ width: "70%" }} />
            <span className="skel sk-line" style={{ width: "60%", justifySelf: "end" }} />
            <span className="skel sk-line" style={{ width: "50%", justifySelf: "end" }} />
            <span className="skel sk-line" style={{ width: "80%" }} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes.**

Run: `NODE_ENV=test npx vitest run src/components/__tests__/result-block.test.tsx`
Expected: PASS (all 7).

- [ ] **Step 5: Commit.**

```bash
git add src/components/result-block.tsx src/components/__tests__/result-block.test.tsx
git commit -m "feat(result-block): ResultBlock + CommentsTable + skeleton (shared composer)"
```

---

## Task 8: Wire ResultBlock into TubeMine

**Files:**
- Modify: `src/components/tubemine.tsx`
- Test: `src/components/__tests__/analytics-skeleton.test.tsx` (existing, update)

- [ ] **Step 1: Update the imports in `src/components/tubemine.tsx`.**

In the import block (lines ~13-37): remove the imports for `Card, CardContent` (from `@/components/ui/card`), the entire `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` block (from `@/components/ui/table`), `formatDateRelative, formatNumber` (from `@/lib/format`), `TopWordsPanel`, the `SentimentPanel` named import block, `EmojiPanel`, and `ExportBar`. Keep `Skeleton` (used by `PreviewSkeleton`), `extractVideoId, type Comment, type VideoMeta`, `sanitizeCommentRowForSpreadsheet`, `BudgetStatus`, `WordCount`, `EmojiCount`, and `DemoSampleResult`. Add the new import and keep the `SentimentAggregateProp` / `SentimentDistribution` types (still referenced in state):
```tsx
import {
  type SentimentAggregateProp,
  type SentimentDistribution,
} from "@/components/sentiment"
import { ResultBlock, ResultBlockSkeleton } from "@/components/result-block"
```

- [ ] **Step 2: Replace the loading-skeleton block.**

Replace this block (the `extractLoading && comments.length === 0 && preview` fragment that renders `<TopWordsSkeleton /> <SentimentSkeleton /> <EmojiSkeleton />`):
```tsx
      {extractLoading && comments.length === 0 && preview && (
        <>
          <TopWordsSkeleton />
          <SentimentSkeleton />
          <EmojiSkeleton />
        </>
      )}
```
with:
```tsx
      {extractLoading && comments.length === 0 && preview && (
        <div className="mt-6">
          <ResultBlockSkeleton />
        </div>
      )}
```

- [ ] **Step 3: Replace the results block.**

Replace the `comments.length > 0` block (which renders `<TopWordsPanel/> <SentimentPanel/> <EmojiPanel/> <ResultsPanel/>`) with:
```tsx
      {comments.length > 0 && (
        <div className="mt-6">
          <ResultBlock
            tier={tier}
            commentsAnalyzed={comments.length}
            videoTitle={preview?.title ?? ""}
            channel={preview?.channel ?? ""}
            sentiment={sentiment}
            distribution={distribution}
            topWords={analytics.topWords}
            uniqueWordsTotal={analytics.uniqueWordsTotal}
            topEmoji={analytics.topEmoji}
            uniqueEmojiTotal={analytics.uniqueEmojiTotal}
            comments={comments}
            onDownloadCsv={downloadCsv}
            onDownloadJson={downloadJson}
            onDownloadExcel={downloadExcel}
          />
        </div>
      )}
```

- [ ] **Step 4: Delete the now-unused functions.**

Delete from `src/components/tubemine.tsx`: `function TopWordsSkeleton()`, `function SentimentSkeleton()`, `function EmojiSkeleton()`, the `type ResultsPanelLabels = {...}`, and `function ResultsPanel({...}) {...}` (the entire inline results-panel component at the bottom of the file). Keep `function PreviewSkeleton()`.

- [ ] **Step 5: Typecheck the file (catch unused imports / dangling refs).**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. If any "is declared but its value is never read" appears for an import, remove that import. If "Cannot find name 'ResultsPanel'" appears, a reference was missed in Steps 2-3.

- [ ] **Step 6: Update `src/components/__tests__/analytics-skeleton.test.tsx`.**

Replace the file body's `describe(...)` block with:
```tsx
describe("Result block skeleton (loading)", () => {
  it("does NOT render the result-block skeleton when no preview and not loading", () => {
    // pending mock: initial fetch on mount (budget refresh)
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch
    const { queryByTestId } = render(<TubeMine tier="anonymous" />)
    expect(queryByTestId("result-block-skeleton")).toBeNull()
  })
})
```
Keep the file's top mocks and imports unchanged. (The previous vacuous `expect(true).toBe(true)` test and the three old testids are removed.)

- [ ] **Step 7: Run the affected tests.**

Run: `NODE_ENV=test npx vitest run src/components/__tests__/analytics-skeleton.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 8: Commit.**

```bash
git add src/components/tubemine.tsx src/components/__tests__/analytics-skeleton.test.tsx
git commit -m "feat(tubemine): render shared ResultBlock + ResultBlockSkeleton, drop inline panels"
```

---

## Task 9: DemoSampleResult -> ResultBlock with mock data

**Files:**
- Modify: `src/components/demo-sample-result.tsx`
- Test: `src/components/__tests__/demo-sample-result.test.tsx` (new)

- [ ] **Step 1: Write the failing test.**

Create `src/components/__tests__/demo-sample-result.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DemoSampleResult } from "../demo-sample-result"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}))
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, number | string>) =>
    values && values.count !== undefined ? `${key}:${values.count}` : key,
}))

describe("DemoSampleResult", () => {
  it("renders the anon result block (locked sentiment, single export, table)", () => {
    const { container } = render(<DemoSampleResult />)
    expect(container.querySelector(".result-block")).not.toBeNull()
    expect(container.querySelector(".rb-widgets")).not.toBeNull()
    expect(container.querySelector(".s-locked")).not.toBeNull()
    expect(container.querySelectorAll(".rb-exports button").length).toBe(1)
    expect(container.querySelector(".ctable-card")).not.toBeNull()
  })

  it("uses long mock strings (long author + long word) for truncation stress", () => {
    const { container } = render(<DemoSampleResult />)
    expect(container.textContent).toContain("colorgradingworkflow")
    expect(container.querySelector('[title*="longwinded_larry"]')).not.toBeNull()
  })

  it("contains no em-dash or en-dash in rendered text", () => {
    const { container } = render(<DemoSampleResult />)
    expect(container.textContent).not.toMatch(/[—–]/)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails.**

Run: `NODE_ENV=test npx vitest run src/components/__tests__/demo-sample-result.test.tsx`
Expected: FAIL (current DemoSampleResult renders `.demo-result` / `.widget-grid`, not `.result-block`).

- [ ] **Step 3: Rewrite `src/components/demo-sample-result.tsx`.**

```tsx
"use client"

import { ResultBlock } from "@/components/result-block"
import type { Comment } from "@/lib/types"
import type { WordCount } from "@/lib/top-words"
import type { EmojiCount } from "@/lib/emoji-frequency"

/*
  Static promo block shown to anonymous visitors on the landing demo section as
  an educational preview of what TubeMine analysis output looks like. It renders
  the SAME real <ResultBlock> the dashboard uses, fed mock data at the anonymous
  tier (locked sentiment, top 5 words / emoji, single Save CSV). It must hide as
  soon as the real flow takes over; that gating lives in <TubeMine>.

  Mock strings deliberately include a long video title, a long author handle, and
  a long word to stress-test truncation. No em-dash or en-dash anywhere.
*/

const MOCK_TITLE =
  "How I Actually Edit My YouTube Videos in 2026, My Complete Start to Finish Editing Workflow, Gear, Plugins and Color Grading Setup (Full Uncut Walkthrough)"
const MOCK_CHANNEL = "@PixelForge"

const MOCK_WORDS: WordCount[] = [
  { word: "tutorial", count: 847 },
  { word: "colorgradingworkflow", count: 662 },
  { word: "workflow", count: 543 },
  { word: "helpful", count: 449 },
  { word: "thanks", count: 398 },
]

const MOCK_EMOJI: EmojiCount[] = [
  { emoji: "\u{1F525}", count: 3541, share: 0.182 },
  { emoji: "❤️", count: 2860, share: 0.147 },
  { emoji: "\u{1F44F}", count: 2198, share: 0.113 },
  { emoji: "\u{1F4AF}", count: 1867, share: 0.096 },
  { emoji: "\u{1F60D}", count: 1634, share: 0.084 },
]

const MOCK_COMMENTS: Comment[] = [
  {
    author: "@sarah_makes",
    text: "This is the workflow video I have needed for months. The premiere shortcut at 4:12 alone is worth a sub. Thank you so much, instantly subscribed.",
    likes: 1240,
    replies: 38,
    publishedAt: "2026-05-30T12:00:00.000Z",
    sentiment: "positive",
  },
  {
    author: "@mike.travels",
    text: "Quick question, what mic are you using for the voiceover? It sounds amazing and I have been hunting for an upgrade.",
    likes: 312,
    replies: 5,
    publishedAt: "2026-05-29T12:00:00.000Z",
    sentiment: "neutral",
  },
  {
    author: "@designdaily",
    text: "Love the part about cutting B-roll first. I always do it last and it slows me down so much. Trying this tomorrow.",
    likes: 209,
    replies: 12,
    publishedAt: "2026-05-28T12:00:00.000Z",
    sentiment: "positive",
  },
  {
    author: "@priya.films",
    text: "Way too long. This could have been a 6 minute video honestly, half of it is filler and repeated points.",
    likes: 41,
    replies: 9,
    publishedAt: "2026-05-27T12:00:00.000Z",
    sentiment: "negative",
  },
  {
    author: "@longwinded_larry_the_editor_who_writes_full_essays",
    text: "Okay so I have been editing for about three years now and I picked up at least four things from this that I had never seen before, especially the bit about color matching across clips shot on different cameras, and the section on audio ducking under the voiceover, so thank you for putting this together, it is clearly a lot of work.",
    likes: 17,
    replies: 0,
    publishedAt: "2026-05-25T12:00:00.000Z",
    sentiment: "neutral",
  },
]

const noop = () => {}

export function DemoSampleResult() {
  return (
    <div className="mt-6" aria-live="polite">
      <ResultBlock
        tier="anonymous"
        commentsAnalyzed={19422}
        videoTitle={MOCK_TITLE}
        channel={MOCK_CHANNEL}
        sentiment={null}
        distribution={null}
        topWords={MOCK_WORDS}
        uniqueWordsTotal={1284}
        topEmoji={MOCK_EMOJI}
        uniqueEmojiTotal={142}
        comments={MOCK_COMMENTS}
        onDownloadCsv={noop}
        onDownloadJson={noop}
        onDownloadExcel={noop}
      />
    </div>
  )
}
```
Note: `commentsAnalyzed={19422}` drives the anon SentimentPanel to render the locked teaser (it only returns null when the count is 0). The Save CSV button is a no-op for this static teaser.

- [ ] **Step 4: Run the test to confirm it passes.**

Run: `NODE_ENV=test npx vitest run src/components/__tests__/demo-sample-result.test.tsx`
Expected: PASS (all 3).

- [ ] **Step 5: Commit.**

```bash
git add src/components/demo-sample-result.tsx src/components/__tests__/demo-sample-result.test.tsx
git commit -m "feat(demo-sample): render the real ResultBlock with mock data (anon tier)"
```

---

## Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Lint.**

Run: `npm run lint`
Expected: no errors. Fix any unused import / `no-impure-functions` issues introduced (do not weaken rules).

- [ ] **Step 2: Typecheck.**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Full test suite.**

Run: `npm test`
Expected: all tests pass (this also runs the i18n parity guard tests).

- [ ] **Step 4: Message parity.**

Run: `node scripts/check-message-parity.mjs`
Expected: exits 0.

- [ ] **Step 5: Production build.**

Run: `npm run build`
Expected: succeeds (this runs `vitest run` + `check-message-parity` + `next build`). Confirm no CSS or type errors.

- [ ] **Step 6: Em-dash / en-dash sweep on the files changed.**

Run: `grep -nP "[\x{2014}\x{2013}]" src/components/result-block.tsx src/components/demo-sample-result.tsx src/components/sentiment.tsx src/components/top-words.tsx src/components/emoji-frequency.tsx src/components/export-bar.tsx src/components/tubemine.tsx messages/en.json messages/ru.json docs/superpowers/plans/2026-06-02-result-block-redesign.md docs/superpowers/specs/2026-06-02-result-block-redesign-design.md || echo "CLEAN: no em-dash/en-dash"`
Expected: prints "CLEAN: no em-dash/en-dash".

- [ ] **Step 7: Manual visual check (dev server).**

Run: `npm run dev`, then in a browser:
- Landing `/` (anonymous): the demo placeholder shows the 3-up widget grid (locked Sentiment, Top Words with the long word ellipsized inside its bar, compact Emoji rows), and the comments table with the long author handle. Resize to ~880 and mobile: widgets collapse to 1 column under ~720px, the table reflows into stacked cards under ~640px, no horizontal page scroll, no text overflow.
- Sign in and open `/dashboard`: run a real analysis; confirm the result block matches the landing look at the wider (~1120) dashboard width, the per-comment Sentiment column shows chips, zero replies show a dash, and the sticky header stays put while scrolling the table.
- Toggle the locale to RU: confirm widget metas, sentiment labels, and CTAs render without clipping or overlap.

- [ ] **Step 8: Final commit (if any lint/type fixups were made).**

```bash
git add -A
git commit -m "chore(result-block): lint/type/build verification fixups" || echo "nothing to commit"
```

---

## Self-Review Notes (author)

- **Spec coverage:** result-block wrapper (Task 7), header restyle + truncation (Task 7), 3 widget restyles (Tasks 4-6), comments table + mobile reflow (Tasks 2 CSS + 7), DemoSampleResult rewrite (Task 9), dashboard widen (Task 2), bulletproof responsive (Task 2 container queries + `min-width:0`), i18n (Task 1), tests (Tasks 4-9), loading skeleton (Tasks 2 + 7 + 8). Empty state is intentionally out of scope per the spec.
- **Type consistency:** `ResultBlockData` (Task 7) is consumed identically in TubeMine (Task 8) and DemoSampleResult (Task 9). `SentimentAggregateProp` / `SentimentDistribution` re-exported from `sentiment.tsx` and imported where needed. `Comment` fields (`likes`/`replies` numbers, `publishedAt` ISO, optional `sentiment`) match the mock data and `CommentsTable`.
- **No placeholders:** every code step contains full source. The only "edit existing rule" steps (Task 2 width edits, Task 8 import edits) name exact strings to find and the exact replacement.
