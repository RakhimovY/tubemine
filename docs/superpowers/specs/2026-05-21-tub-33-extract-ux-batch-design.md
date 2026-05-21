# TUB-33 Extract UX Batch (Design Spec)

Date: 2026-05-21
Status: Draft for plan
Linear: TUB-33 (to create)

## 1. Background

User-reported UX issues 2026-05-21 (post-launch usage):

1. Two-step extract is friction. Paste URL, preview renders, user must click a second button to actually run extract. Wasted click.
2. Top words panel for Pro tier renders 400+ items as one scrollable wall. Loses the value-prop ("all ranked") inside an unusable UI.
3. The Save CSV export button has poor contrast (light background plus light text) and likely fails WCAG AA on the action bar.

Three issues, three independent PRs, one Linear issue tracking all of them.

## 2. Goals

- One-step extract: paste URL plus single click triggers analyze. Preview card shows information only; the primary CTA next to the input drives extraction.
- Tier-aware Top words panel: Anon 5 (no change), Free 15 (no change), Pro 30 default with "Show all NNN" expand control.
- Save CSV button (and the rest of the export bar) meets WCAG AA contrast: at least 4.5:1 for normal text or 3.0:1 for large/icon-equivalent text.
- Three sequential PRs (A, B, C). Each verified on prod via Chrome MCP before the next ships.

## 3. Non-goals

- No changes to `recent-analyses.tsx` or `(app)/history` route (TUB-34 territory).
- No changes to pricing or login pages (TUB-32 territory).
- No changes to the API tier slicing in `src/app/api/extract/route.ts`. Server already enforces tier limits; Phase B is purely client-side display of what the server returns.
- No new dependencies.
- No payment, RLS, or DB migration touchpoints.

## 4. Constraints (hard)

- No em-dash codepoints (U+2014, U+2013) anywhere: source files, commits, PR descriptions, Linear comments, vault notes. Use `,` `.` `()` `:` `-`.
- File touchpoint scope (HARD):
  - May edit: `src/components/tubemine.tsx`, `src/components/top-words.tsx`, `src/app/globals.css`, `messages/en.json`, `messages/ru.json`.
  - Must not edit: `src/components/recent-analyses.tsx`, `src/app/[locale]/(app)/history/*`, `src/lib/analyses.ts`, pricing/login pages, header components, dashboard layout, API routes, Supabase schema.
- Each PR ships, deploys, gets verified on prod via Chrome MCP, then the next PR starts. No mega-PR.
- Tier-aware behavior for all three tiers (anon, free, pro) must remain correct after the change.

## 5. Phase A: One-step extract

### 5.1 Current state (file: `src/components/tubemine.tsx`)

Two state branches drive UX today:

- Lines 335 to 388: main form. Submit calls `onPreview`. Button label = `t("cta")` (generic "Analyze"), disabled only during loading.
- Lines 409 to 470: preview confirmation card. Two buttons inside the card: primary "Analyze N comments" (calls `onExtract`) and ghost "Try another URL" (calls `reset`).

This forces two clicks: submit URL, then confirm.

### 5.2 Target state

The same `<form>` `onSubmit` handler picks the right action based on whether `preview` is non-null. The preview card becomes a passive info card with no buttons.

Behaviour matrix:

| State | Button label | Button enabled | Submit handler |
|---|---|---|---|
| `!preview && !previewLoading` | `t("cta")` (Analyze) | URL field non-empty (HTML5) | `onPreview` |
| `previewLoading` | `<Loader2 spin/>` (current) | false | n/a |
| `preview && !extractLoading` | `tEx("analyze_n_comments", {count: extractCount})` | `extractCount > 0 && !preview.commentsDisabled` | `onExtract` |
| `extractLoading` | loader plus `tEx("analyzing")` | false | n/a |

The button gets an additional CSS class `btn--ready` when `preview && !previewLoading && !extractLoading && extractCount > 0`. The class is scoped under `.tm-design .btn--primary.btn--ready` and provides:

- A brighter accent background (token `--color-accent` or a slightly punchier shade of `--color-surface-muted`).
- A subtle 1.6s `animation: tm-ready-pulse infinite alternate` on `box-shadow` only (no layout shift, low CPU). Animation honors `prefers-reduced-motion: reduce` by setting `animation: none`.

### 5.3 Reset path

Once preview is loaded, the user can re-paste a different URL to invalidate. Implementation: `useEffect` that compares `form.watch("url")` against the URL that produced the current preview (stored alongside `preview` in a `previewSourceUrl` state). When the watched URL diverges from `previewSourceUrl` AND the input is non-empty AND the user is not currently submitting, clear `preview`, `comments`, `sentiment`, `distribution`, `analytics` so the form returns to its first state.

If the user clears the input entirely, also call the same clear path.

Note: existing `reset()` function (line 215) stays in the file because the results section retains an explicit "start over" action below the comments table. The standalone "Try another URL" button inside the preview card (lines 459 to 467) is removed in Phase A.

### 5.4 Preview card after Phase A

Lines 410 to 470 collapse to a pure info card: thumbnail plus title plus channel plus the three meta spans (views, likes, comments). The action row (lines 438 to 468) is deleted. The card itself stays for context; only the buttons go.

### 5.5 i18n changes

No new keys required. The existing `landing.demo.cta` and `extractor.analyze_n_comments` keys are reused.

### 5.6 Acceptance criteria

- DOM query `document.querySelectorAll('button').find(b => /Analyze\s\d+\scomments/.test(b.textContent ?? ""))` returns the MAIN form button (not a preview card child) when preview is loaded.
- DOM query for any button inside the preview card (descendant of the element matching `.mt-6.rounded-xl.border-border\/60`) returns 0.
- After paste plus single click sequence on a Pro account, extract completes and results render. No second click required.
- Replacing the URL in the input after preview is shown invalidates the preview (the info card disappears, button reverts to `t("cta")` label).
- `prefers-reduced-motion: reduce` disables the ready-state pulse.

## 6. Phase B: Top words tier-aware pagination

### 6.1 Current state (file: `src/components/top-words.tsx`)

The panel renders every item it receives via `items.map`. For Pro the API returns the full ranked list (could be 50, 100, 400+ unique words depending on video). Result: a vertical wall, often longer than the viewport.

### 6.2 Target state

Behaviour by tier:

| Tier | Initial display | Expand control |
|---|---|---|
| anonymous | up to 5 items | none |
| free | up to 15 items | none |
| pro | up to 30 items | "Show all NNN" plus "Hide" toggle |

Implementation: introduce `const [expanded, setExpanded] = useState(false)` and derive `displayedItems`:

```tsx
const initialCap = tier === "pro" ? 30 : items.length
const displayedItems = expanded ? items : items.slice(0, initialCap)
const hasMore = tier === "pro" && items.length > 30
```

The `<div className="grid gap-1.5 sm:grid-cols-2">` block iterates `displayedItems` instead of `items`. The expand button (rendered after the grid, before the upgrade CTA and the footnote) appears only when `hasMore` is true.

Use existing `Button` import (or, to avoid adding the import, a plain `<button>` with `className="text-xs underline-offset-4 hover:underline text-foreground/80 self-start"` to match the existing upgrade link styling). Decision: plain `<button>` to keep the file scope tight and visual style consistent with the upgrade CTA `<Link>` already present.

The button label uses `t("show_all", {count: items.length})` when collapsed and `t("hide")` when expanded.

The `unique_top_shown` meta in the header (line 38 to 43) keeps the existing `shown: items.length` semantic but should reflect what is actually shown. Replace `shown: items.length` with `shown: displayedItems.length` so the count tracks the expand state.

### 6.3 Tier coupling

`tier` already passes through `TopWordsPanel` props (line 12). No prop signature change. No API change required: server continues to return whatever it returns per tier.

### 6.4 i18n changes

Add to `messages/en.json` under `analytics.top_words`:

```json
"show_all": "Show all {count}",
"hide": "Hide"
```

Add to `messages/ru.json` under `analytics.top_words`:

```json
"show_all": "Показать все {count}",
"hide": "Скрыть"
```

### 6.5 Acceptance criteria

- For Pro on a video with more than 30 unique words: panel renders exactly 30 rows initially. "Show all NNN" button visible at the bottom. Click expands to full list. Button label flips to "Hide" / "Скрыть". Click hides again.
- For Pro on a video with 30 or fewer unique words: no expand button shown.
- For Free: panel shows up to 15 rows (current behaviour). No expand button.
- For Anon: panel shows up to 5 rows (current behaviour). No expand button.
- The "shown" meta count in the header reflects `displayedItems.length`.

## 7. Phase C: Action button contrast

### 7.1 Current state

`src/components/export-bar.tsx` renders shadcn `<Button>` instances. Default variant resolves to Tailwind tokens (`bg-primary text-primary-foreground`). Inside the `.tm-design` design layer (light theme with low-saturation cards) this combination ships a Save CSV button that visually reads as off-white on off-white. User-reported as "почти не видно". The same defect likely affects Save JSON and Save Excel (outline variant) for Pro.

### 7.2 Target state

The main extract CTA already uses a high-contrast token pair via `.tm-design .btn--primary` (line 303 of globals.css): `--btn-bg: var(--color-surface-muted)` plus `--btn-fg: var(--color-text-inverse)`. Same pair for the export bar.

Approach: do NOT change shadcn `Button` defaults globally (would affect other surfaces). Instead, scope a `.tm-design` selector override on the `<Button>` rendered inside the export bar. Add a stable class `tm-action-btn` to each `<Button>` in `export-bar.tsx`, then in `globals.css`:

```css
.tm-design .tm-action-btn {
  background: var(--color-surface-muted);
  color: var(--color-text-inverse);
  border: 1px solid var(--color-surface-muted);
}
.tm-design .tm-action-btn:hover { background: #ececef; }
.tm-design .tm-action-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(245,245,247,0.18);
}
.tm-design .tm-action-btn[data-variant="outline"] {
  background: transparent;
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
}
.tm-design .tm-action-btn[data-variant="outline"]:hover {
  background: rgba(245,245,247,0.08);
}
```

Where `data-variant` is set in `export-bar.tsx` per `<Button>` (`data-variant="outline"` on the Save JSON and Save Excel buttons; nothing on Save CSV).

Implementation note: shadcn `<Button>` accepts arbitrary HTML attributes via prop spread; `className` plus `data-variant` are both safe to add without modifying the Button primitive.

### 7.3 Verification approach

Before edit: navigate to prod, run a real extract, capture `getComputedStyle` on the Save CSV button. Compute WCAG contrast ratio between `backgroundColor` and `color` resolved values. Record as baseline.

After edit: same measurement. Assert ratio is at least 4.5:1 (normal text) for primary; at least 3.0:1 for outline variants with explicit icon. Screenshot proof.

### 7.4 i18n changes

None. Existing keys `common.save_csv`, `common.save_json`, `common.save_excel` are reused unchanged.

### 7.5 Acceptance criteria

- Save CSV button computed contrast >= 4.5:1 (or >= 3.0:1 if classified as large text by font-size threshold at the button's resolved CSS).
- Save JSON and Save Excel (Pro tier) outline buttons have border and text contrast >= 3.0:1 against the surrounding card background.
- No regression to the main "Analyze" CTA contrast (same tokens used; unchanged).
- No change to the visual layout (button sizes and positions stay identical).

## 8. Ship order and verification

Three PRs in order, one phase each. Between each PR:

1. Push branch, open PR (PR title prefixed with `feat(extractor):` or `fix(extractor):` or `fix(css):`).
2. Merge to main. Vercel autobuilds.
3. Wait for Vercel deployment to be READY (poll `mcp__vercel__list_deployments` with `state: READY` filter or use the project hook).
4. Hard-reload prod URL via Chrome MCP. Run DOM assertion plus screenshot proof.
5. Add a comment on Linear TUB-33 with commit SHA + verify result.
6. Then proceed to next phase.

PR-A: `feat(extractor): collapse two-step extract into one click [TUB-33]`
PR-B: `feat(top-words): tier-aware pagination for Pro [TUB-33]`
PR-C: `fix(export-bar): WCAG AA contrast on action buttons [TUB-33]`

## 9. Verification matrix (Chrome MCP)

### Phase A verification

- Navigate to `https://tubemine.tech/en/dashboard` (signed-in Pro session).
- Paste `https://youtu.be/PHqshQPRxt4` into the URL input.
- Wait for preview card to render.
- Assert: no element inside preview card matches `button:where(:not([type="submit"]))`. Specifically the regex `/Analyze \d+ comments/` does not match any button INSIDE the preview card; the same regex matches the MAIN form submit button.
- Screenshot: preview card with no action buttons; main button visibly in ready state.
- Click main button once. Assert: extract completes within reasonable time and results panel populates.
- Edit URL in input. Assert: preview card disappears, main button label reverts to default.

### Phase B verification

- Pro tier (current session): extract a video with more than 30 unique words.
  - Assert: `document.querySelectorAll('[data-testid="top-words-row"]').length === 30` (if data-testid added) or count grid rows by selector.
  - Click "Show all NNN".
  - Assert: row count grows past 30 and matches `unique_words_total` for the request.
  - Assert: button label is "Скрыть" or "Hide".
- Free tier: 15 rows, no expand button. Defer this branch to manual TC if no test account is available; document deferral in Linear comment.
- Anon tier: 5 rows, no expand button. Defer to manual TC if anon quota is exhausted.

### Phase C verification

- Run extract.
- For each Save CSV / Save JSON / Save Excel button:
  - `getComputedStyle(el).backgroundColor`
  - `getComputedStyle(el).color`
  - Compute relative luminance for each, compute contrast ratio.
- Assert each ratio crosses its WCAG threshold (4.5:1 for filled, 3.0:1 for outline icon-led).
- Screenshot the export bar.

## 10. Linear and vault updates

- Create issue TUB-33 in Tubemine team, priority Medium, status In Progress. Description references this spec path and lists the three sub-deliverables.
- After each phase ships and verifies, comment on TUB-33 with commit SHA, PR link, verify result.
- After all three phases verified, move TUB-33 to Done with closing summary.
- Append three test cases to `~/vault/projects/yt-comments/qa/test-cases.md`:
  - `TC-EXTRACT-OneStep`
  - `TC-TOP-WORDS-PaginatedDisplay`
  - `TC-CSS-008` (extends the existing TC-CSS-002 contrast cluster)
- Append session summary block to `~/vault/daily/2026-05-21.md`.

## 11. Risks and mitigations

- Risk: removing the preview confirm button surprises users who used the two-step flow as a "preview before commit" pattern. Mitigation: preview card still appears (info plus thumbnail), the only change is that the confirm step collapses into the existing top-level CTA. The user's own request validates the change.
- Risk: ready-state pulse animation triggers motion sensitivity. Mitigation: `prefers-reduced-motion: reduce` guard removes the animation entirely.
- Risk: Phase B caps at 30 hides useful long-tail words for Pro power users. Mitigation: explicit "Show all NNN" button surfaces the full list one click away. Value-prop preserved.
- Risk: Phase C contrast fix overrides interact with future shadcn upgrades. Mitigation: scoped under `.tm-design` plus a dedicated `tm-action-btn` class. No global shadcn primitive change.
- Risk: parallel TUB-32 turbo touches `src/app/globals.css` (pricing or login section). Mitigation: Phase C edits are scoped to a new block added at the end of the export-bar styles section; no overlap with pricing or login selectors. Rebase before merge.

## 12. Out of scope (explicit)

- Top emojis panel pagination (separate issue if needed).
- Sentiment panel layout changes.
- Recent analyses overhaul (TUB-34).
- Any work on the dashboard or profile layout.
- Adding new analytics events beyond what already fires.
