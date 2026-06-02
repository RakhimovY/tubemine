# Result Block redesign (1:1 visual, our stack)

Date: 2026-06-02
Branch: `feat/result-block-redesign`
Status: spec

## Goal

Recreate the analysis "Result Block" design pixel-for-pixel using our existing
Next.js 16 + Tailwind v4 + shadcn + `.tm-design`-scoped CSS stack and our
existing shared components, so the analysis output looks identical and
dense/minimalist on BOTH the landing demo and the dashboard, with bulletproof
responsive behavior and zero text overflow at any width.

Authoritative visual source: `/Users/rakhimovy/Downloads/tubemine-v3-ux/project/TubeMine Result Block.html`.
We recreate its VISUAL OUTPUT, not its literal markup. The prototype's dev-only
width toggle (`#widthToggle`) and any "Design preview" panel are NOT shipped.

## Non-negotiable constraints (binding)

- 1:1 visual fidelity with the Result Block design at every width: colors,
  spacing, radii, type, and the exact layouts below.
- OUR stack only. Reuse the design tokens already in `src/app/globals.css`
  under `.tm-design` (surface, text, border, accent-positive/negative,
  `--space-1..8`, `--radius-xs/sm/md/lg`, `--font-*`). Do NOT invent new tokens.
  One new layout variable is allowed: `--rb-width: 1120px`.
- NEVER output an em-dash (U+2014) or en-dash (U+2013) anywhere (code, comments,
  copy, mock data). Use commas, periods, parentheses, colons, or plain hyphens.
- Preserve all product logic: tier gating, next-intl i18n (keep all existing
  message keys, keep EN + RU parity, the `check-message-parity` build step must
  pass), Vercel Analytics `track(...)` events, data shapes, and API contracts.
  Visual refresh only.
- Preserve the widget labels exactly: Sentiment, Top Words, Emoji. Never use the
  verbs extract / download / scrape in copy (use analyze, see, save). The CSV
  button stays "Save CSV".
- All existing tests must still pass (adjusting a test to a deliberate visual
  change is allowed; weakening or deleting tests to force a pass is not).

## Token mapping (design `--r-*`/`--s*` to repo tokens)

The design HTML defines its own radius scale `--r-xs:6 --r-sm:6 --r-md:8
--r-lg:10 --r-pill:9999`. We map to the repo's existing tokens, which already
cover the values used by the result block:

| Design usage | Design value | Repo token to use |
|---|---|---|
| card / widget radius (`--r-md`) | 8px | `--radius-sm` (8px) |
| bar + emoji-row radius (`--r-sm`) | 6px | `--radius-xs` (6px) |
| pill (`--r-pill`) | 9999px | `--radius-lg` (9999px) |
| spacing `--s1..s8` | 4..24 | `--space-1..8` (identical) |
| font sizes / weights | identical | `--font-size-*`, `--font-weight-*` |
| colors (surface/text/border/pos/neg/neu/warn) | identical | `--color-*` |

The repo's `--radius-md` (14px) is wider than the design's 8px card radius and
is deliberately NOT used by the result block. No new radius tokens are created.

The design's neutral sentiment color is `rgba(245,245,247,0.30)` (`--neu`); the
repo's global `--color-sentiment-neutral` resolves differently. For the result
block we reproduce the design neutral exactly with `rgba(245,245,247,0.30)`,
applied (scoped under `.result-block`) to the sentiment bar neutral segment, the
legend neutral dot, and the comment-table neutral chip dot. See the
SentimentPanel "Neutral color" note for the exact selectors. The shipped landing
feature-block `.sentiment-bar` lives outside `.result-block` and is untouched.

## Keystone architecture decision: scope ALL new CSS under `.tm-design .result-block`

These generic class names are ALREADY defined globally under `.tm-design` and
are used by the SHIPPED landing feature blocks (`src/app/[locale]/page.tsx`
sections `features.*`): `.widget`, `.widget-head`, `.widget-title`,
`.widget-sub`, `.tw-list`, `.tw-row`, `.tw-bar`, `.tw-word`, `.tw-count`,
`.emoji-grid`, `.emoji-row`. Redefining them globally would break those shipped
blocks.

Therefore every new rule in this redesign is written as
`.tm-design .result-block <selector>` (descendant of the result-block
container). The shipped feature blocks are NOT inside `.result-block`, so their
existing rules keep applying; the higher-specificity `.result-block` rules apply
only inside the result block. The container query uses `container-name: rb` set
on `.result-block`.

This isolation is mandatory and is the single most important implementation
rule in this spec.

## Component architecture

The analysis result is already rendered by ONE shared `<TubeMine>` mounted on
both the landing demo (`tier="anonymous"`) and the dashboard
(`tier={user tier}`). The per-block panels already exist and are already shared.
We RESTYLE them and add one composing wrapper. We do NOT create parallel
components.

```
src/components/
  result-block.tsx     NEW: <ResultBlock> (presentational) + <ResultBlockSkeleton>
                         composes RbHead + .rb-widgets(Sentiment,TopWords,Emoji)
                         + CommentsTable. Shared verbatim by TubeMine and
                         DemoSampleResult.
  tubemine.tsx         MODIFY: render <ResultBlock> with real state; remove old
                         inline ResultsPanel + the 3 old panel skeletons; reorder
                         to Sentiment, Top Words, Emoji.
  sentiment.tsx        MODIFY: SentimentPanel renders a bare .widget (no <Card>).
  top-words.tsx        MODIFY: TopWordsPanel renders a bare .widget.
  emoji-frequency.tsx  MODIFY: EmojiPanel renders a bare .widget (compact rows).
  export-bar.tsx       MODIFY: emit design .btn/.btn--primary/.btn--outline pills.
  demo-sample-result.tsx MODIFY: render <ResultBlock> with mock data, anon tier.
src/app/globals.css    MODIFY: add --rb-width; add ".tm-design .result-block"
                         CSS section; widen .demo-wrap + dashboard .main-inner;
                         cap .demo-form width.
messages/en.json, ru.json  MODIFY: emoji heading -> "Emoji"; add sentiment
                         anon-locked keys; keep all other keys + EN/RU parity.
```

### `ResultBlock` (new presentational component, `"use client"`)

Props:

```ts
type ResultBlockData = {
  tier: ExtractTier
  commentsAnalyzed: number          // header count + widget "across N comments"
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
```

Renders:

```
<div className="result-block">
  <RbHead tier count={commentsAnalyzed} videoTitle channel
          exports={<ExportBar tier onDownload* />} />
  <div className="rb-widgets">
    <SentimentPanel tier aggregate distribution commentsAnalyzed />
    <TopWordsPanel  tier items totalUnique commentsAnalyzed />
    <EmojiPanel     tier items totalUnique />
  </div>
  <CommentsTable tier comments />
</div>
```

- Order is Sentiment, Top Words, Emoji (matches the design left-to-right). This
  is a change from today's Top Words, Sentiment, Emoji order.
- `ResultBlock` calls `useTranslations("extractor")` itself for the header title
  and comment-table column labels, so `TubeMine` no longer threads a `labels`
  object.
- `RbHead` and `CommentsTable` are defined inside `result-block.tsx`.

### `RbHead`

```
<div className="rb-head">
  <div className="rb-head-l">
    <div className="rb-head-title">{tEx("results_header", { count })}</div>
    <div className="rb-head-video" title={`${videoTitle} ${channel}`}>
      {videoTitle} <span className="by">{`· ${channel}`}</span>
    </div>
  </div>
  <div className="rb-exports">{exports}</div>
</div>
```

- The existing `extractor.results_header` value is already
  "{count, number} {count, plural, one {comment} other {comments}} analyzed"
  = "19,422 comments analyzed", which matches the design copy exactly. No
  message change for the header. The number is rendered inside a
  `.rb-head-title` styled with `font-variant-numeric: tabular-nums` and
  `font-weight: var(--font-weight-semibold)`; we do NOT use next-intl rich text
  (a `<b>` inside an already-semibold title is visually equivalent and avoids
  ICU rich-text fragility).
- `.rb-head-l` has `min-width: 0` so the subline can truncate. `.rb-head-video`
  is `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 100%`, so it never crosses the card edge at any width.
- The separator between title and channel is a middle dot (`·`), never a
  dash. `channel` is passed already containing no leading dot.

### `CommentsTable` (replaces the old inline `ResultsPanel` table)

The header that used to sit above this table now lives in `RbHead`. The table
becomes a standalone card. Rebuilt as a plain `<table className="ctable">`
(not shadcn `<Table>`), matching the design's 6-column grid:

```
.ctable colgroup widths: 168px | (1fr) | 116px | 76px | 76px | 84px
columns:                 Author | Comment | Sentiment | Likes | Replies | When
```

```
<div className="ctable-card">
  <div className="ctable-scroll">
    <table className="ctable">
      <colgroup> 6 cols with the widths above </colgroup>
      <thead> sticky header row, Likes/Replies right-aligned (th.num) </thead>
      <tbody>
        per comment <tr> with <td className="col-author|col-comment|col-sent|
        col-likes|col-replies|col-when">
      </tbody>
    </table>
  </div>
</div>
```

Scroll + sticky header (critical): `.ctable-scroll` MUST set `max-height: 580px;
overflow: auto;` (design value). `position: sticky` on the `thead th` needs a
bounded scrolling ancestor; `container-type: inline-size` on `.result-block`
does NOT create a vertical scroll context. Without the bounded `.ctable-scroll`
the header would not stick within the card (regression vs today's
`max-h-[60vh] overflow-auto`). The `<table className="ctable">` uses
`table-layout: fixed; min-width: 760px;` so the colgroup widths hold; the
`min-width` is removed in the 640px mobile reflow.

Per-cell:
- `col-author`: `<div className="c-author" title={author}>{author}</div>`
  (truncates with ellipsis).
- `col-comment`: `<div className="c-text">{text}</div>` (wraps,
  `overflow-wrap: anywhere`, never breaks layout).
- `col-sent`: sentiment chip from `Comment.sentiment`
  (`"positive"|"negative"|"neutral"|"unknown"|undefined`). The chip
  (`.c-sent`) is `white-space: nowrap; min-width: 0; overflow: hidden;
  text-overflow: ellipsis` so a long RU label (e.g. "Нейтрально", which is
  borderline in the 116px column) ellipsizes rather than overflowing the cell.
  On mobile (stacked card) the chip sits in a flex row with room, no
  truncation. Value:
  - positive -> `<span className="c-sent pos"><span className="dot"/>{label}</span>`
  - negative -> `c-sent neg`
  - neutral  -> `c-sent neu`
  - unknown / undefined -> render the dash placeholder `<span className="c-num
    zero">{tEx("dash_placeholder")}</span>` (so the column never collapses).
  Sentiment labels reuse `analytics.sentiment.legend_positive/neutral/negative`.
- `col-likes`: `<div className="c-num">{formatNumber(likes)}</div>` plus a
  hidden mobile `<span className="m-label">{tEx("col_likes")}</span>`.
- `col-replies`: `<div className="c-num {zero}">{replies>0 ?
  formatNumber(replies) : tEx("dash_placeholder")}</div>` plus
  `<span className="m-label">{tEx("col_replies")}</span>`. Zero replies show a
  plain hyphen "-" and the `.c-num.zero` muted color.
- `col-when`: `<div className="c-when">{formatDateRelative(publishedAt)}</div>`.

Column header labels: `col_author`, `col_comment`, a NEW `col_sentiment`,
`col_likes`, `col_replies`, `col_when` (all from the `extractor` namespace).
`extractor.col_sentiment` does NOT exist yet and is added to both locales
(EN "Sentiment", RU "Тональность"). Note: unrelated `history.col_sentiment`
(RU "Тон") and `history_detail.column_sentiment` (RU "Тональность") already
exist in other namespaces; do not reuse or modify them, add the new
`extractor.col_sentiment`.

Mobile reflow (`@container rb (max-width: 640px)`): the table reflows into
stacked cards exactly as the design: `thead` + `colgroup` hidden, each `tr`
becomes a flex-wrap card with the meta line (author, sentiment, likes, replies,
when) on top via `order` and the full comment text below
(`.col-comment { order: 6; flex: 0 0 100% }`). The `.m-label` mono captions
become visible on mobile only.

### `ResultBlockSkeleton`

Replaces the three separate shadcn-based skeletons (`TopWordsSkeleton`,
`SentimentSkeleton`, `EmojiSkeleton`) in `tubemine.tsx`. The wrapper uses
`.result-block` (so widths + container query match the final geometry) and
carries `data-testid="result-block-skeleton"`, `role="status"`,
`aria-live="polite"`, `aria-busy="true"`. Port the design's `renderLoading`
markup (Result Block HTML lines 738-785) 1:1:

- Shimmer primitive: a scoped `.tm-design .result-block .skel` class using the
  design's gradient + `background-size: 200% 100%` and a `@keyframes
  shimmer-rb` animation. (The repo has no global `@keyframes shimmer`; current
  skeletons use shadcn `<Skeleton>` with `animate-pulse`. The `-rb` suffix is
  just namespacing hygiene next to the existing `tm-spin` / `dashboard-pulse`
  keyframes.) Add a `@media (prefers-reduced-motion: reduce)` rule slowing it to
  3s. `.sk-line` is the thin-line variant.
- Header: `.skw-head` (flex, two stacked shimmer lines on the left, a 104px x
  34px pill shimmer on the right).
- Widgets: a `.rb-widgets` grid of three `.widget` skeletons:
  - sentiment widget: header lines, a 14px full-width pill shimmer (the bar),
    plus 3 `.sk-line` rows.
  - top-words widget: header lines, then a `.tw-grid` of 8 `height:26px`
    shimmer bars.
  - emoji widget: header lines, then an `.em-grid` (the SAME class the real
    emoji panel uses, so the skeleton inherits the 640px single-column
    collapse) containing 8 `.sk-emrow` (34px) shimmer rows. Do NOT introduce a
    separate `.sk-emgrid`, or the skeleton's emoji block would not reflow like
    the real panel on mobile. Do NOT use the old global `.emoji-grid`/
    `.emoji-row` names (isolation rule).
- Comments table: `.sk-ctable` containing a sticky `.sk-cthead` header row plus
  4 `.sk-ctrow` rows. `.sk-ctrow` uses the SAME 6-col grid as the real table:
  `grid-template-columns: 168px minmax(0,1fr) 116px 76px 76px 84px`.
- Mobile (`@container rb (max-width: 640px)`): port the design's skeleton
  reflow (lines 384-388): `.skw-head` wraps; `.sk-ctrow` becomes flex-wrap with
  the second (comment) line spanning 100% at `order: 6`.

Counts (8 word bars, 8 emoji rows, 4 comment rows) and the exact px values are
taken verbatim from the design `renderLoading`.

## Panel restyles

### SentimentPanel (`sentiment.tsx`)

Bare `.widget` (no `<Card>`, no `mt-6`). Head:

```
<div className="widget-head">
  <div className="widget-head-l">
    <div className="widget-title">{t("heading")} {ruExperimental && <RuPill/>}</div>
    <div className="widget-sub">{t("across_comments", { count })}</div>
  </div>
</div>
```

- RU experimental pill (`ruShare >= 0.25`): `<span className="ru-pill"><span>
  β</span> {t("ru_experimental")}</span>` (Greek beta `β`, never a
  dash). Keeps the existing `ru_experimental` key.

Body by tier:
- anonymous: locked teaser `.s-locked` with a lock badge, the line
  `{t("anon_locked_text")}` and a `{t("anon_locked_cta")}` sign-in link to
  `/login?next=/`. NO bar, NO numbers. (Keeps today's guard: returns `null` when
  `commentsAnalyzed === 0`.) New keys `anon_locked_text` ("Sign in to see the
  sentiment breakdown for this video.") and `anon_locked_cta` ("Sign in") are
  added to both locales. The existing `anon_prefix` / `anon_link` / `anon_suffix`
  keys are KEPT (still required by `analytics-i18n-parity.test`).
- free: `.s-bar.h14` (three segments pos/neu/neg, no inline %), then a
  `.s-label` (dot + qualitative summary from `sentiment_label.*`), then a
  `.tier-cta` (lock icon + `t("upgrade_cta")` link to `/pricing`).
- pro: `.s-bar.h22` with inline per-segment `%` labels (`<i>` only when segment
  width >= 8%), then `.s-legend` (three rows, dot + label + right-aligned exact
  count via `formatNumber`), then a `.s-label` summary, then a `.s-foot`
  coverage footnote `t("footnote", { percent })`.

Segment rendering rule (preserve current guards): render each pos/neu/neg
segment ONLY when its underlying COUNT is > 0 (today's code conditions on
`aggregate.positive > 0` etc., NOT on `dist >= floor`). A 0-count segment must
not render a zero-width div, which would leave a 1px border/background seam at
the boundary. Keep this count-based condition in the new `.s-bar` markup for
both free and pro.

Neutral color (1:1): the design's neutral is `rgba(245,245,247,0.30)` (`--neu`),
which differs from the existing global `--color-sentiment-neutral` rendering.
Inside `.result-block` ONLY, use `rgba(245,245,247,0.30)` for the neutral
sentiment bar segment (`.s-bar .neu`), the legend neutral dot
(`.s-legend .ld.neu`), and the comment-table neutral chip dot
(`.c-sent.neu .dot`). The shipped landing feature-block `.sentiment-bar` and its
`.sentiment-neu` are a different element outside `.result-block` and are left
untouched.

Keep all existing sentiment keys, `track("sentiment_*")` events, and the
`deriveDistribution` / `qualitativeSummary` logic unchanged.

### TopWordsPanel (`top-words.tsx`)

Bare `.widget`. Head: `.widget-title` "Top words" + `.widget-sub`
`across_comments` + `.widget-meta` `unique_top_shown` (right side, wraps below
the title when tight). Body:

```
<div className="tw-grid">          // 2 columns; 1 column on mobile
  per word:
  <div className="tw-row">
    <div className="tw-bar"><span className="tw-fill" style="width:{pct}%"/>
      <span className="tw-word">{word}</span></div>     // word INSIDE the bar
    <div className="tw-count">{formatNumber(count)}</div> // count OUTSIDE
  </div>
</div>
```

- `pct = max(8, round(count / maxCount * 100))` (design uses an 8% floor so
  short bars stay legible). `maxCount = items[0].count` (the list is sorted
  descending and non-empty here, since the panel returns null when empty).
- Critical: `.tw-fill` is `position: absolute` (the colored bar), and `.tw-word`
  is the only IN-FLOW child of `.tw-bar`, so the word span occupies the FULL bar
  width (not the fill width). The ellipsis container is therefore the whole
  `.tw-bar` (`.tw-word { white-space:nowrap; overflow:hidden;
  text-overflow:ellipsis }`), NOT the 8% fill. Do not clip the word to the
  fill, or a long word at an 8% bar would show a single letter. Full words stay
  visible at normal widths; the long mock word `colorgradingworkflow` is the
  truncation stress test (it ellipsizes against the bar, never overflows it).
- Pro: initial cap 30 (`PRO_INITIAL_CAP`, unchanged) with a `.tier-cta.btnlike`
  toggle `show_all` / `hide` and a chevron that rotates 180 degrees when
  expanded.
- anon/free CTA: existing `.tier-cta` (sign-in icon or lock icon + existing
  `cta_anon` / `cta_free` link). The footnote `t("footnote")` is kept but moves
  under the body as a `.widget-foot` caption (small, muted). Keep all keys.

### EmojiPanel (`emoji-frequency.tsx`)

Bare `.widget`. Head: `.widget-title` "Emoji" (heading value changes from
"Top emojis" to "Emoji" in both locales) + `.widget-sub` (existing `sub` key) +
`.widget-meta` (`unique_top_shown`). The design's sub copy "N comments with
emoji" is a computed count NOT present in the panel's props (only `items` and
`totalUnique`); we deliberately keep the existing `sub` copy
("how your audience reacts") rather than invent a new data field. The sub line
is a small mono caption, not a fidelity-critical layout element, so this is an
acceptable copy divergence (documented). Body is the compact 2-column row list
(NOT the old 10-across grid):

```
<div className="em-grid">             // 2 cols; 1 col on mobile
  per emoji:
  <div className="em-row">            // grid: 22px | minmax(0,1fr) | 42px
    <span className="glyph">{emoji}</span>
    <span className="em-bar"><span style="width:{barPct}%"/></span>
    <span className="em-pct">{value}</span>
  </div>
</div>
```

- `maxShare = items[0]?.share ?? 0` (list is sorted descending). `barPct =
  maxShare > 0 ? Math.round((share / maxShare) * 100) : 0` (proportional bar,
  shown for ALL tiers; the `maxShare > 0` guard prevents a `NaN%` width when a
  degenerate set has share 0). The panel already returns null when
  `items.length === 0`.
- `value` resolves the percent gate (M17 product logic, preserved):
  - pro -> `${round(share*100)}%`
  - anon / free -> `formatNumber(count)` (integer count, NOT a percent)
  The proportional bar is not an exact percentage, so anon/free never expose the
  gated `%` text. The existing `emoji-frequency.test` (M17) keeps passing.
- aria-label per row keeps the emoji name + count (+ percent only for pro), as
  today.
- anon/free CTA: existing `.tier-cta` with `cta_anon` / `cta_free`. Keep keys
  and `track("emoji_rendered")`.

### ExportBar (`export-bar.tsx`)

Restyle to the design's pill buttons (the export-bar test asserts text content,
not classes, so this is safe):
- anon + free: a single `<button className="btn btn--primary tm-action-btn">`
  with the download glyph + `common.save_csv` ("Save CSV").
- pro: the same primary "Save CSV" plus two `<button className="btn
  btn--outline">` for `save_json` and `save_excel`.
Keep handlers, tier gating, and i18n keys unchanged.

## DemoSampleResult rewrite (`demo-sample-result.tsx`)

Replace the hand-written markup with a single `<ResultBlock>` fed mock data and
`tier="anonymous"`, so the anonymous landing placeholder renders the SAME real
panels as the dashboard result (the "trust contract"). Mock data mirrors the
design's `DATA` block: a long video title, a long author handle
(`@longwinded_larry_the_editor_who_writes_full_essays`), a long word
(`colorgradingworkflow`), six sample comments with per-comment sentiment, and
the word/emoji lists. NO em-dash or en-dash anywhere in the mock strings (the
design's title uses an em-dash; we replace it with a comma or parentheses).
Export handlers are no-ops for the static teaser (it is a visual preview; the
anon "Save CSV" gate behavior is unchanged elsewhere). The component still
mounts only when there is no real preview / results (gating in `TubeMine`
unchanged).

Mock data shape (important): the mock comments must be typed as `Comment[]`, so
`publishedAt` is an ISO date string (e.g. a fixed `"2026-05-30T12:00:00.000Z"`,
NOT the design's relative `"2d ago"` which would break `formatDateRelative`),
and `likes` / `replies` are NUMBERS (e.g. `1240`, `0`, NOT the design's
comma-formatted `"1,240"` strings; `formatNumber` adds separators at render).
The mock sentiment aggregate is a `SentimentAggregateProp`; the words list is
`WordCount[]`; the emoji list is `EmojiCount[]` (with `share`). Since
`tier="anonymous"`, the mock numbers shown match the anon view (top 5 words /
emoji, locked sentiment). The "When" column renders the fixed ISO dates through
`formatDateRelative` (which is relative to the current time), so the displayed
strings ("today" / "Nd ago" / "Nw ago" ...) shift over time at day-bucket
granularity. This is acceptable for a static teaser and mirrors how real
results render time; it is the existing behavior for the live comments table, so
no hydration mismatch (the buckets are coarse). Do NOT claim deterministic
output and do NOT call `Date.now()` directly in the mock.

## Layout and width

Add `--rb-width: 1120px` to the `.tm-design` token block.

- `.tm-design .result-block { width:100%; max-width: var(--rb-width);
  margin-inline:auto; display:flex; flex-direction:column; gap: var(--space-5);
  container-type: inline-size; container-name: rb; }` and
  `.tm-design .result-block > * { min-width: 0; }`.
- Landing: `.tm-design .demo-wrap { max-width: var(--rb-width); }` (was 880px) so
  the result block can reach 1120 on landing too. The input form is re-capped
  with `.tm-design .demo-form { max-width: 820px; margin-inline: auto; }` so the
  search bar stays comfortable while results go wide.
- Dashboard: `.tm-design .dashboard-page .main-inner { max-width: var(--rb-width);
  }` (was 980px). The other dashboard chrome cards (welcome strip, usage card,
  recent list, tier cards) keep their existing rules and simply render up to
  1120 wide; nothing about their structure changes. The dashboard quick-analyze
  input inherits the shared 820px `.demo-form` cap.

Result: on both surfaces the form area stays comfortable, the result block and
comments table use the full design width up to 1120, and both surfaces share
identical width behavior.

## Responsive (bulletproof, container-query driven)

Container queries on `.result-block` (`container-name: rb`), matching the design
breakpoints exactly:
- `@container rb (max-width: 1000px)`: tighten `.tw-grid` / `.em-grid` column
  gaps so words never clip in the tightest 3-up arrangement.
- `@container rb (max-width: 720px)`: `.rb-widgets` collapses to a single
  column; `.tw-grid` / `.em-grid` stay 2-up with generous row room.
- `@container rb (max-width: 640px)`: `.rb-head` stacks; `.tw-grid` / `.em-grid`
  go single-column; the comments table reflows into stacked cards.

Every flex/grid child that holds truncatable text gets `min-width: 0`
(`.rb-head-l`, `.widget-head-l`, `.tw-word`, `.c-author`, `.result-block > *`).
Acceptance: at ~1120 / ~880 / mobile there is ZERO text overflow, ZERO
header/meta overlap, NO horizontal page scroll, and no STRUCTURAL label
(column header, widget meta, tier CTA) is clipped or overlapped. Note: the
single-line ellipsis truncation of the long video subline (`.rb-head-video`) is
the intended, designed behavior (the full text stays available via the `title`
attribute) and is NOT a "disappearing label"; when both the title and channel
are long the channel is the part ellipsized away, which is acceptable.

`.rb-widgets` grid: keep `grid-template-columns: repeat(3, 1fr)` (NOT auto-fit).
A panel returning `null` (e.g. `EmojiPanel` when a video has no emoji, or
`SentimentPanel` when its aggregate is null) leaves a trailing empty grid cell.
This is acceptable (the remaining widgets stay at their designed 3-up width with
empty space on the right; no overflow, no overlap). Do NOT switch to
auto-fit/auto-fill, which would re-stretch 2 widgets and break the 3-up
proportions. In the common path (the result block only renders when
`comments.length > 0`, so the header count is always >= 1) all three widgets
render.

## i18n changes (EN + RU parity maintained)

- `analytics.emoji.heading`: "Top emojis" -> "Emoji" (EN); RU equivalent updated
  to "Эмодзи".
- Add `extractor.col_sentiment`: EN "Sentiment", RU "Тональность".
- Add `analytics.sentiment.anon_locked_text` and
  `analytics.sentiment.anon_locked_cta` (EN + RU).
- All three new keys (`col_sentiment`, `anon_locked_text`, `anon_locked_cta`)
  are PLAIN static strings with no `{count}` / ICU plural, so the RU
  `one/few/many/other` plural-branch assertions in `analytics-i18n-parity.test`
  do not apply to them.
- All other existing keys are kept (no deletions), so `check-message-parity`
  and `analytics-i18n-parity.test` stay green. New keys are added to BOTH
  locales in the same edit.

## Testing

Vitest + React Testing Library, following existing patterns (`// @vitest-environment
jsdom`, mock `next-intl` so `useTranslations` returns the key, mock
`@/i18n/navigation` and `@vercel/analytics`).

- NEW `result-block.test.tsx`:
  - renders `.rb-widgets` containing Sentiment, Top Words, Emoji in that order.
  - per-tier: anon -> `.s-locked` present and no `.s-bar`; single Save CSV.
    free -> `.s-bar.h14` present, qualitative summary present, single Save CSV.
    pro -> `.s-bar.h22` with per-segment `%`, `.s-legend` exact counts, and
    Save CSV + JSON + Excel.
  - header subline truncation: `.rb-head-video` carries a `title` attr equal to
    the full title+channel and renders the channel after a middle dot.
  - comments table: 6 column headers incl Sentiment; zero-replies cell shows the
    dash placeholder; a per-comment sentiment chip class matches the comment's
    sentiment.
  - mobile reflow hooks: each row renders `.m-label` captions and `col-*`
    classes (the structural hooks the container query reflows; jsdom cannot
    compute container-query layout, so we assert the DOM hooks exist).
- UPDATE `emoji-frequency.test.tsx`: keep the M17 percent-gate assertions
  (anon/free hide `%`, pro shows `%`); add an assertion that `.em-row` and an
  `.em-bar` render.
- UPDATE `analytics-skeleton.test.tsx`: in the first test, assert
  `result-block-skeleton` testid is absent when idle (no preview, not loading),
  replacing the three removed `top-words-skeleton` / `sentiment-skeleton` /
  `emoji-skeleton` queries. DELETE the second test (`"on extractLoading: renders
  all 3 analytics skeletons"`) and its stale comment block: it currently asserts
  only `expect(true).toBe(true)` (vacuous) and its name + comments describe the
  removed 3-skeleton model. The idle-absence assertion plus the new
  `result-block.test.tsx` coverage replace it; this is removing dead/stale test
  scaffolding, not weakening real coverage.
- `export-bar.test.tsx`: unchanged (text-based) and must still pass.

## Manual verification

Run lint, typecheck, the full vitest suite, `check-message-parity`, and
`next build`; all clean. Then run the app and view the landing demo and the
dashboard at mobile, ~880, and desktop widths. Confirm: visual matches the
Result Block design, no text overflows any card, tiers render correctly, both
EN and RU render, and no horizontal page scroll.

## Out of scope

- The rest of the site (hero, pricing, profile, legal, login, history). Only the
  result-block components, the landing demo mount, the dashboard quick-analyze /
  result area, and the demo placeholder are touched.
- Any backend or API change (the later server-side trim of the anonymous payload
  to 5 is NOT in this task).
- The prototype's dev-only width toggle and "Design preview" panel.
- The design's standalone "empty" comments state is NOT wired into TubeMine's
  flow in this pass: the current code only renders results when
  `comments.length > 0`, the preview already warns and blocks analyze when
  comments are disabled or zero, so the post-extract-empty path is unreachable
  today. Wiring a new empty state would require changing TubeMine's state
  machine, which is unrequested scope. The loading state IS in scope (it exists
  today and must match the new geometry).

## Vault doc sync (not blocking)

If the Obsidian MCP is available, append the new result-block visual behavior to
`projects/yt-comments/qa/flows-summary.md` and `qa/test-cases.md`. If not, note
in the final summary that the vault doc sync is pending.
