# TUB-35 Detail View Visual Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `/history/:id` detail view to reuse `SentimentPanel` + `EmojiPanel` shared components and wrap in `.dashboard-page` design CSS scope, verify Bug B (dashboard panels after fresh extract) on prod, and codify visual fidelity gate in vault.

**Architecture:** Single-file React edit in `src/components/analysis-detail-view.tsx` replacing inline JSX with shared panel components. Map DB shape (`SentimentAggregate`, `EmojiFreq[]`) to component props (`SentimentAggregateProp`, `EmojiCount[]`) at the call site. No new files. Vault writes via `mcp__obsidian__write_note` and `mcp__obsidian__patch_note`.

**Tech Stack:** Next.js 16 App Router, React 19 client component, TypeScript, Tailwind, pnpm, Chrome DevTools MCP for verify-on-prod, Obsidian MCP for vault writes, Linear MCP for tracking.

---

## File Structure

**Modified (PR 1):**
- `src/components/analysis-detail-view.tsx` (already exists, currently 207 lines). Replace inline Sentiment + Emoji JSX with shared component usage; wrap return in `<div className="dashboard-page">`. Single file.

**Created/modified (PR 2, vault, vault-root-relative paths):**
- `projects/yt-comments/qa/test-cases.md` (append TC-CSS-008)
- `playbooks/saas-roadmap/13-qa-user-flows-and-test-cases.md` (append visual fidelity gate sub-section + turbo prompt mandate)

**Locked, do NOT touch:**
- `src/components/sentiment.tsx`, `src/components/emoji-frequency.tsx`, `src/components/top-words.tsx` (shared panels, reuse only)
- `src/components/tubemine.tsx` (TUB-33 territory)
- `src/app/[locale]/(app)/history/history-client.tsx` (TUB-34 main session locked)
- `src/app/[locale]/(app)/history/[id]/page.tsx` (server route; if wrapper needs change, prefer wrapping inside the client component)
- All other panels' internal logic

---

## Pre-flight check (do FIRST before any task)

- [ ] **Step 0.1: Read Linear ticket and move to In Progress**

Run: `mcp__claude_ai_Linear__get_issue` with `id: "TUB-35"`. Read description, acceptance criteria, risk register fully. Then `save_issue` to set status to "In Progress".

- [ ] **Step 0.2: Confirm baseline git state**

Run:
```bash
git status
git log --oneline -3
```
Expected: working tree clean, on `main`, top commits include the spec commit `5e76d51 review(spec): fix round 1 issues ...` and `9725fb9 docs(tub-35): spec ...`.

- [ ] **Step 0.3: Read the current detail view to confirm starting state**

Read `src/components/analysis-detail-view.tsx` lines 1-207. Confirm:
- Line 8 imports `TopWordsPanel`. No import for `SentimentPanel` / `EmojiPanel` yet.
- Lines 173-180 contain inline Sentiment `<div>` with plain `+/=/-` text.
- Lines 182-194 contain inline Emoji `<div>` with `<ul>`.
- Line 88 opens with `<div className="mx-auto max-w-5xl px-4 py-8">` (no `dashboard-page` wrapper).

If file already has the changes (someone else applied them), STOP and re-sync with user.

---

## PR 1: Detail view styling fix

### Task 1: Replace inline JSX with shared panel components + add design scope wrapper

**Files:**
- Modify: `src/components/analysis-detail-view.tsx`

- [ ] **Step 1.1: Update imports**

Add these imports near the existing top-of-file imports:

```ts
import { SentimentPanel, type SentimentAggregateProp } from "@/components/sentiment"
import { EmojiPanel } from "@/components/emoji-frequency"
import type { EmojiCount } from "@/lib/emoji-frequency"
```

Apply via Edit on the imports block. Place the new imports between the existing `TopWordsPanel` import and `CommentsTable` import, keeping alphabetical grouping consistent with current style.

Final import block should resemble:

```ts
"use client"

import { useEffect, useState } from "react"
import { track } from "@vercel/analytics"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useRouter } from "@/i18n/navigation"
import { TopWordsPanel } from "@/components/top-words"
import { SentimentPanel, type SentimentAggregateProp } from "@/components/sentiment"
import { EmojiPanel } from "@/components/emoji-frequency"
import { CommentsTable } from "@/components/comments-table"
import { Button } from "@/components/ui/button"
import type { AnalysisDetailRow, TopWord, EmojiFreq } from "@/lib/analyses"
import type { SentimentAggregate } from "@/lib/sentiment"
import type { EmojiCount } from "@/lib/emoji-frequency"
```

- [ ] **Step 1.2: Replace the inline Sentiment block**

Find this exact block (currently lines 173-180):

```tsx
      {sentiment && (
        <div className="mt-6 rounded-lg border p-6">
          <h2 className="text-sm font-medium">Sentiment</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            +{sentiment.positive} / ={sentiment.neutral} / -{sentiment.negative}
          </p>
        </div>
      )}
```

Replace with:

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

Notes for the engineer:
- `tier: "free" | "pro"` assigns into `SentimentPanel`'s `tier: "anonymous" | "free" | "pro"` (wider) without a cast.
- `distribution={null}` is safe: `SentimentPanel` calls `deriveDistribution(aggregate)` when distribution is null (verified at `src/components/sentiment.tsx:88-90`).
- `SentimentAggregate` (server-only type) and `SentimentAggregateProp` (client type) are structurally identical. The `as` is a type-level satisfaction only.

- [ ] **Step 1.3: Replace the inline Emoji block**

Find this exact block (currently lines 182-194):

```tsx
      {emojis.length > 0 && (
        <div className="mt-6 rounded-lg border p-6">
          <h2 className="text-sm font-medium">Emoji frequency</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {emojis.slice(0, tier === "pro" ? emojis.length : 15).map((e) => (
              <li key={e.emoji} className="text-sm">
                {e.emoji}{" "}
                <span className="text-xs text-muted-foreground">{e.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
```

Replace with:

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

Notes for the engineer:
- The IIFE pattern is used so we can declare `visible` locally without lifting state up. Mirrors the dashboard pattern of pre-shaped panel props.
- `EmojiFreq.percent` is 0..100 in the DB shape; `EmojiCount.share` is 0..1, hence divide by 100. Defensive `?? 0` for legacy rows.
- Free-tier slice to 15 preserves prior visible-emoji count; `totalUnique={emojis.length}` keeps the free-tier "see N more" upgrade CTA accurate.

- [ ] **Step 1.4: Wrap return in `<div className="dashboard-page">`**

Find the start of the return JSX (currently line 87-88):

```tsx
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
```

Replace with:

```tsx
  return (
    <div className="dashboard-page">
      <div className="mx-auto max-w-5xl px-4 py-8">
```

Then find the closing of that outer div (currently line 204-205):

```tsx
    </div>
  )
}
```

Replace with:

```tsx
      </div>
    </div>
  )
}
```

Notes:
- `.tm-design` is already on `<body>` from `src/app/[locale]/layout.tsx:91`. Adding `.dashboard-page` activates the scoped CSS tokens at `src/app/globals.css:1308` (--sidebar-w, --header-h, background, grid).
- The inner `mx-auto max-w-5xl px-4 py-8` container becomes a single grid item inside the wrapper. No layout displacement is expected because `.dashboard-page` uses `display: grid; gap: --space-7; align-content: start` which accepts any single child.

- [ ] **Step 1.5: Run `pnpm build` to verify TypeScript + Next.js compile pass**

Run: `pnpm build`

Expected:
- Exit code 0
- No TypeScript errors
- No "missing i18n key" warnings
- All routes generated

If errors: read first failure, fix at root cause, re-run. Do NOT skip with `--no-lint` or `--no-typescript`.

- [ ] **Step 1.6: Em-dash sweep on the modified file**

Run: `grep -nP "[\x{2013}\x{2014}]" src/components/analysis-detail-view.tsx && echo "EM-DASH FOUND" || echo "clean"`

Expected: `clean`

If `EM-DASH FOUND`: locate and replace with `-`, `:`, `,`, or `()` as appropriate. Re-run until `clean`.

- [ ] **Step 1.7: Commit PR 1 changes**

Run:
```bash
git add src/components/analysis-detail-view.tsx
git commit -m "$(cat <<'EOF'
fix(tub-35): detail view reuses Sentiment + Emoji panels under dashboard scope

Replace inline JSX (plain-text +/=/- sentiment, ul emoji list) with shared
SentimentPanel and EmojiPanel components so the detail view matches the
dashboard inline render. Wrap return in .dashboard-page so scoped design
tokens apply.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds (pre-commit hooks pass), HEAD advances.

- [ ] **Step 1.8: Push to main**

Run: `git push origin main`

Expected: push accepted, Vercel deploy starts.

### Task 2: Verify PR 1 on production via Chrome DevTools MCP

- [ ] **Step 2.1: Wait for Vercel deploy READY**

Run: `mcp__vercel__list_deployments` with `projectId` for tubemine (find via `mcp__vercel__list_projects` if not cached). Poll until the deploy for the latest commit reaches `READY` (`state: "READY"` or `readyState: "READY"`). If still `BUILDING` after first check, wait ~45s and re-poll. Hard fail if `ERROR` or `CANCELED`; in that case fetch `get_deployment_build_logs` and fix.

- [ ] **Step 2.2: Open detail view on prod**

Run: `mcp__chrome-devtools__list_pages`. If a tubemine.tech tab already exists from main-session work, select it via `select_page`. Otherwise `new_page` with `url: "https://tubemine.tech/en/history"`.

Take screenshot via `mcp__chrome-devtools__take_screenshot` with `format: "png"`. Snapshot via `take_snapshot`. Verify the History list renders.

Pick the first analysis row link and `click` it. Wait via `wait_for` for the detail-route heading to appear (text in `h1.truncate` or page selector returns the analysis title).

- [ ] **Step 2.3: Assert detail view visual fidelity**

Snapshot the detail page. Verify (use `evaluate_script` for getComputedStyle checks):

a. Outer wrapper has `.dashboard-page` class:
```js
({ ok: document.querySelector('.dashboard-page') !== null })
```
Expected: `{ ok: true }`.

b. Scoped CSS token applies (background from `.tm-design .dashboard-page`):
```js
(() => {
  const el = document.querySelector('.dashboard-page')
  if (!el) return { ok: false, why: "no .dashboard-page" }
  const bg = getComputedStyle(el).backgroundColor
  return { ok: bg !== '' && bg !== 'rgba(0, 0, 0, 0)', bg }
})()
```
Expected: `ok: true` and `bg` is a non-transparent color (matches `var(--color-surface-base)` resolution).

c. Sentiment panel renders as a Card with a horizontal bar, not plain text. Check:
```js
(() => {
  const headings = Array.from(document.querySelectorAll('h2'))
  const sentimentH = headings.find(h => /sentiment/i.test(h.textContent || ''))
  if (!sentimentH) return { ok: false, why: "no sentiment heading" }
  const card = sentimentH.closest('[class*="card"], .border, [class*="border-border"]')
  // SentimentPanel renders bars inside divs with style/width attributes
  const hasBar = card ? card.querySelector('[style*="width"]') !== null : false
  // Make sure the legacy plain-text format is gone
  const hasLegacy = (card?.textContent || '').match(/^\s*\+\d+\s*\/\s*=\d+\s*\/\s*-\d+\s*$/m) !== null
  return { ok: hasBar && !hasLegacy, hasBar, hasLegacy }
})()
```
Expected: `ok: true`.

d. Emoji panel renders as a card/grid, not a `<ul>`:
```js
(() => {
  const headings = Array.from(document.querySelectorAll('h2'))
  const emojiH = headings.find(h => /emoji/i.test(h.textContent || ''))
  if (!emojiH) return { ok: false, why: "no emoji heading" }
  const card = emojiH.closest('[class*="card"], .border, [class*="border-border"]')
  const hasUL = card ? card.querySelector('ul') !== null : true
  const hasGrid = card ? card.querySelector('[class*="grid"], [class*="flex"]') !== null : false
  return { ok: !hasUL && hasGrid, hasUL, hasGrid }
})()
```
Expected: `ok: true` (no `<ul>`, has flex/grid).

e. Tier-aware download buttons present:
```js
(() => {
  const btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim() || '')
  return { btns, hasCSV: btns.some(t => /csv/i.test(t)) }
})()
```
Expected: at minimum `hasCSV: true`. If logged in as Pro: JSON and Excel buttons also present.

- [ ] **Step 2.4: Take "after" screenshot for Linear evidence**

Run `take_screenshot` of the detail page (full page if possible). Save as `/tmp/tub-35-detail-after.png` (`filePath` arg). This is the visual evidence for the Linear comment.

- [ ] **Step 2.5: Bug B verification: dashboard 4-panel render after fresh extract**

Navigate via Chrome MCP to `https://tubemine.tech/en/dashboard`. If session not authed (login wall visible), document deferral in Linear and skip 2.6 + 2.7.

If authed:

a. Locate the Quick analyze input. `fill` with `https://youtu.be/PHqshQPRxt4`. Wait 1s via `wait_for` for the debounced preview auto-load (preview thumbnail appears).

b. Click "Analyze N comments" button (text varies with N). Use `take_snapshot` to find the button uid by partial text match.

c. Wait for extract to complete: poll via `wait_for` for an element selector that appears when results render (e.g., the Results panel header or any TopWords bar).

- [ ] **Step 2.6: Assert dashboard renders 4 panels**

After extract completes, run:

```js
(() => {
  const headings = Array.from(document.querySelectorAll('h2')).map(h => (h.textContent || '').trim())
  return {
    topWords: headings.some(h => /top words/i.test(h)),
    sentiment: headings.some(h => /sentiment/i.test(h)),
    emoji: headings.some(h => /emoji/i.test(h)),
    results: headings.some(h => /(results|comments)/i.test(h)),
    all: headings,
  }
})()
```

Expected: `topWords`, `sentiment`, `emoji`, `results` all `true`.

- If all 4 true: Bug B is a false alarm. Take screenshot `/tmp/tub-35-dashboard-after.png` as evidence.
- If any false: Bug B is a real regression. Per spec, do NOT widen PR 1 scope into `tubemine.tsx`. Create a Linear sub-issue via `mcp__claude_ai_Linear__save_issue` titled "TUB-35 follow-up: dashboard panel(s) missing after extract" with the failing assertion JSON and a screenshot, then proceed.

- [ ] **Step 2.7: File the Bug B verdict comment on TUB-35**

Run `mcp__claude_ai_Linear__save_comment` on TUB-35 with body:

```
PR 1 shipped: <commit-sha>

Bug A (detail view styling): FIXED.
- /history/:id wrapped in .dashboard-page
- Sentiment renders as bar with % (verified via DOM assertion, screenshot /tmp/tub-35-detail-after.png)
- Emoji renders as Card grid with badges (no <ul>)
- Tier-aware downloads intact

Bug B (dashboard 4 panels after extract): <FALSE ALARM | REAL REGRESSION, see sub-issue TUB-XX | DEFERRED, session not authed>
```

Replace tokens with actual values. No em-dash.

---

## PR 2: Vault writes (TC-CSS-008 + playbook 13)

### Task 3: Append TC-CSS-008 to vault QA test cases

**Files:**
- Modify (vault, vault-root-relative): `projects/yt-comments/qa/test-cases.md`

- [ ] **Step 3.1: Read the current test-cases file to understand its structure**

Run `mcp__obsidian__read_note` with `filepath: "projects/yt-comments/qa/test-cases.md"`. Note the existing TC numbering convention (e.g., are entries titled `## TC-CSS-007:` or `### TC-CSS-007`), table-of-contents location, and any frontmatter `updated:` date that should be bumped.

If the file does not exist, create it with appropriate frontmatter (see vault conventions in `~/.claude/CLAUDE.md`). If it does exist, prefer `patch_note` with `operation: append` so we do not disturb earlier content.

- [ ] **Step 3.2: Append TC-CSS-008 entry**

Run `mcp__obsidian__patch_note` with:
- `filepath: "projects/yt-comments/qa/test-cases.md"`
- `operation: "append"`
- `content` (verbatim, no em-dash):

```markdown

## TC-CSS-008: Detail view visual fidelity matches dashboard inline panels

**Why:** TUB-35 incident on 2026-05-21. /history/:id shipped with inline plain-text Sentiment and <ul> Emoji, plus no design CSS scope wrapper. Verify-on-prod DOM/network gate is insufficient for visual regressions.

**Pre-requisites:** Authed session (Free or Pro). At least one analysis exists in /history.

**Steps:**
1. Open /history on prod after an extract has run.
2. Click into any analysis row to reach /history/:id.
3. Verify Sentiment renders as a horizontal bar with % labels (not "+N / =N / -N" plain text).
4. Verify Emoji renders as a Card grid with emoji + count badges (not an inline <ul>).
5. Open DevTools. Run `getComputedStyle(document.querySelector('.dashboard-page')).backgroundColor`. Confirm it returns a non-transparent color (the design token --color-surface-base resolved value), not `rgba(0, 0, 0, 0)` or empty.
6. Take screenshot of detail view. Take screenshot of /dashboard after-extract view. Compare side by side for Sentiment + Emoji panels.

**Acceptance:** Less than 3% pixel diff for panel regions excluding text content (text values differ across analyses by design).

**Regression history:** introduced in TUB-34 PR 2 (98a0cff), fixed in TUB-35 PR 1.
```

Expected: patch returns success, file updated.

- [ ] **Step 3.3: Confirm TC-CSS-008 is present**

Run `mcp__obsidian__read_note` again and verify the TC-CSS-008 section appears at the bottom (or wherever append placed it) with the acceptance criterion intact and no em-dash characters.

Run em-dash sanity check by reading the relevant section and visually scanning for `—` or `–`.

### Task 4: Extend playbook 13 with visual fidelity gate

**Files:**
- Modify (vault, vault-root-relative): `playbooks/saas-roadmap/13-qa-user-flows-and-test-cases.md`

- [ ] **Step 4.1: Read the playbook to find the right insertion point**

Run `mcp__obsidian__read_note` with `filepath: "playbooks/saas-roadmap/13-qa-user-flows-and-test-cases.md"`. Locate cluster 8 (visual fidelity) if it exists, otherwise plan to append a new top-level sub-section near the end of the document but above any "Changelog" / "Index" trailing block.

- [ ] **Step 4.2: Append visual fidelity gate sub-section**

Run `mcp__obsidian__patch_note` with:
- `filepath: "playbooks/saas-roadmap/13-qa-user-flows-and-test-cases.md"`
- `operation: "append"`
- `content` (verbatim, no em-dash):

```markdown

## Visual fidelity gate (mandatory Tier 2 check)

After every turbo PR merges to main, the verify-on-prod step MUST include a visual screenshot comparison, not just DOM and network assertions. DOM/network gates are insufficient for visual regressions.

Open the changed page on prod via Chrome MCP. Screenshot every section that renders analytical panels (Sentiment, Top Words, Emoji, Comments table). Compare against the reference dashboard inline view OR the source design HTML if the page is a visual port. Acceptance: less than 3% pixel diff for panel regions excluding text content (text values differ across analyses by design).

### Turbo prompt mandates

When a turbo prompt introduces a new page or view that renders existing data shapes (sentiment / top words / emojis / comments), the prompt MUST include both:

1. "Reuse shared panel components from `src/components/sentiment.tsx`, `src/components/emoji-frequency.tsx`, `src/components/top-words.tsx`. Do NOT write inline JSX for these data shapes."
2. "Wrap the page return in `<div className=\"dashboard-page\">` (the `.tm-design` body class is global). Verify on prod via getComputedStyle that scoped CSS tokens apply (returns design token color, not browser default)."

Reason: TUB-35 incident on 2026-05-21 where /history/:id shipped with inline plain-text Sentiment and <ul> Emoji, plus no design CSS scope wrapper. Caught only after user-reported visual regression, not by verify-on-prod gate. Component reuse + scope wrapper is a 5-line fix per page if mandated up front; a full PR cycle if caught after merge.
```

Expected: patch returns success.

- [ ] **Step 4.3: Confirm playbook update is present and em-dash clean**

Run `mcp__obsidian__read_note` and scroll/grep through the file for "Visual fidelity gate". Confirm:
- The sub-section is present with all three numbered items.
- No `—` (em-dash) or `–` (en-dash) characters.

### Task 5: File final Linear comment + move TUB-35 to Done

- [ ] **Step 5.1: Add PR 2 / vault evidence comment**

Run `mcp__claude_ai_Linear__save_comment` on TUB-35:

```
PR 2 shipped (vault writes only, no code commit).

- TC-CSS-008 added to projects/yt-comments/qa/test-cases.md
- Visual fidelity gate sub-section added to playbooks/saas-roadmap/13-qa-user-flows-and-test-cases.md
- Turbo prompt mandates documented (shared-component reuse + .dashboard-page wrapper)

TUB-35 closed.
```

- [ ] **Step 5.2: Move TUB-35 to Done**

Run `mcp__claude_ai_Linear__list_issue_statuses` to confirm the "Done" status id for the TUB team. Then `save_issue` on TUB-35 with `stateId` set to the Done status.

### Task 6: Hand-off summary to daily note

- [ ] **Step 6.1: Append daily-note session summary**

Run `mcp__obsidian__patch_note` with:
- `filepath: "daily/2026-05-21.md"`
- `operation: "append"`
- `content` (template per global CLAUDE.md, RU language):

```markdown

## Session Summary (HH:MM) TUB-35 Visual regression sweep

- **Goal:** fix /history/:id detail view styling regression + verify Bug B + закрепить visual fidelity gate.
- **Progress:**
  - PR 1 (commit <sha>): src/components/analysis-detail-view.tsx переиспользует SentimentPanel + EmojiPanel, обёрнут в .dashboard-page.
  - Verify-on-prod пройден: DOM + getComputedStyle + screenshots.
  - Bug B: <FALSE ALARM | REAL REGRESSION (sub-issue) | DEFERRED>.
  - PR 2 (vault): TC-CSS-008 + playbook 13 visual fidelity gate.
- **Decisions:** Не расширяли PR 1 в tubemine.tsx даже при подтверждённой регрессии Bug B (TUB-33 lock). Sub-issue для follow-up.
- **Files:**
  - src/components/analysis-detail-view.tsx
  - docs/superpowers/specs/2026-05-21-tub-35-detail-view-visual-regression-design.md
  - docs/superpowers/plans/2026-05-21-tub-35-detail-view-visual-regression.md
  - vault: projects/yt-comments/qa/test-cases.md (TC-CSS-008)
  - vault: playbooks/saas-roadmap/13-qa-user-flows-and-test-cases.md (visual fidelity gate)
- **Next:** TUB-35 Done. Если Bug B вышло реальной регрессией, дочерний issue trackает фикс в tubemine.tsx.
```

Replace HH:MM with current time, sha with the PR 1 commit, and the Bug B verdict.

- [ ] **Step 6.2: Final em-dash sweep across all artifacts modified this session**

Run:

```bash
for f in src/components/analysis-detail-view.tsx \
         docs/superpowers/specs/2026-05-21-tub-35-detail-view-visual-regression-design.md \
         docs/superpowers/plans/2026-05-21-tub-35-detail-view-visual-regression.md; do
  if grep -lP "[\x{2013}\x{2014}]" "$f" > /dev/null 2>&1; then
    echo "EM-DASH IN: $f"
    grep -nP "[\x{2013}\x{2014}]" "$f"
  fi
done
echo "scan complete"
```

Expected: only "scan complete" output. If any `EM-DASH IN` line: open the file, replace, re-run.

For vault notes (not on local disk), spot-check via the read_note output captured in earlier steps.

- [ ] **Step 6.3: Verify clean final state**

Run:
```bash
git status
git log --oneline -5
```

Expected:
- Working tree clean.
- Recent commits include the PR 1 commit, the spec commit (5e76d51), spec creation (9725fb9), and the plan commit (this session, see Task 0.4 if added; otherwise the plan was committed at brainstorming time and not now).

If the plan file is not yet committed (created at writing-plans time without an explicit commit), commit it now:

```bash
git add docs/superpowers/plans/2026-05-21-tub-35-detail-view-visual-regression.md
git commit -m "$(cat <<'EOF'
docs(tub-35): plan for detail view visual regression sweep

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

Then STOP.

---

## Self-review checklist (engineer should mentally confirm before declaring done)

- [ ] PR 1 commit exists on `main` and is on Vercel READY.
- [ ] `/history/:id` on prod shows Sentiment bar + Emoji card grid (not inline JSX).
- [ ] `.dashboard-page` wrapper exists in DOM, `getComputedStyle` returns non-transparent background.
- [ ] Tier-aware downloads work (CSV always, JSON + Excel Pro-only).
- [ ] Bug B verified one of: FALSE ALARM with screenshot, REAL REGRESSION with sub-issue + screenshot, DEFERRED with stated reason.
- [ ] TC-CSS-008 present in vault `projects/yt-comments/qa/test-cases.md`.
- [ ] Visual fidelity gate sub-section present in vault `playbooks/saas-roadmap/13-qa-user-flows-and-test-cases.md`.
- [ ] No em-dash (U+2014 or U+2013) anywhere in code, spec, plan, commits, comments, vault writes.
- [ ] No destructive git ops were used (no reset --hard, no force push, no branch delete).
- [ ] TUB-35 status is Done in Linear.
- [ ] Daily note `daily/2026-05-21.md` has session summary.
