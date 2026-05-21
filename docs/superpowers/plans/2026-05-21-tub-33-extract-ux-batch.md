# TUB-33 Extract UX Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three independent UX fixes (one-step extract, Pro top-words pagination, Save CSV WCAG AA contrast) as three sequential PRs, with prod verification between each.

**Architecture:** Pure client-side changes inside three files (`tubemine.tsx`, `top-words.tsx`, `globals.css`) plus `export-bar.tsx` className addition and two i18n keys. No server, DB, or API changes. State logic uses existing react-hook-form + `useWatch`. Pagination uses local `useState`. Contrast fix uses scoped CSS with `!important` to out-rank shadcn Tailwind utilities.

**Tech Stack:** Next.js 16 (App Router), React, react-hook-form, next-intl, shadcn/ui, Tailwind v4, Vercel deployment, Chrome MCP for verify-on-prod.

**Spec reference:** `docs/superpowers/specs/2026-05-21-tub-33-extract-ux-batch-design.md`

---

## Task 0: Linear ticket setup

**Files:** none (Linear API only)

- [ ] **Step 1: Create Linear issue TUB-33**

Tool: `mcp__claude_ai_Linear__save_issue` with team `Tubemine`, title `Extract UX batch (one-step, top words pagination, button contrast)`, priority 3, status In Progress. Body:

```
Three sub-deliverables shipped as three sequential PRs:

A) One-step extract UX in src/components/tubemine.tsx
B) Tier-aware top words pagination in src/components/top-words.tsx
C) Save CSV button WCAG AA contrast in src/app/globals.css + export-bar.tsx

Spec: docs/superpowers/specs/2026-05-21-tub-33-extract-ux-batch-design.md
Plan: docs/superpowers/plans/2026-05-21-tub-33-extract-ux-batch.md

Each phase verifies on https://tubemine.tech via Chrome MCP before next ships.
```

Expected: returned issue identifier `TUB-33` (or whatever Tubemine team auto-assigns). Record the identifier; all subsequent comments target it.

- [ ] **Step 2: Confirm issue is in "In Progress" status**

Tool: `mcp__claude_ai_Linear__get_issue` with the returned identifier. Verify `state.name === "In Progress"`.

---

## Phase A: One-step extract

### Task A1: Add `previewSourceUrl` state, `previewRequestIdRef`, and `useWatch` reset effect

**Files:**
- Modify: `src/components/tubemine.tsx` (imports, state declarations, `onPreview`, new effect)

- [ ] **Step 1: Add `useRef` and `useWatch` imports**

Find:
```tsx
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
```

Replace with:
```tsx
import { useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
```

- [ ] **Step 2: Add `previewSourceUrl` state next to `preview`**

Find:
```tsx
  const [preview, setPreview] = useState<VideoMeta | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
```

Replace with:
```tsx
  const [preview, setPreview] = useState<VideoMeta | null>(null)
  const [previewSourceUrl, setPreviewSourceUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
```

- [ ] **Step 3: Add `previewRequestIdRef` after the `form` declaration**

Find:
```tsx
  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(FormSchema),
    defaultValues: { url: "" },
  })
```

Replace with:
```tsx
  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(FormSchema),
    defaultValues: { url: "" },
  })

  const previewRequestIdRef = useRef(0)
  const watchedUrl = useWatch({ control: form.control, name: "url" })
```

- [ ] **Step 4: Add reset effect that watches URL changes**

Locate the existing `useEffect(() => { fetch("/api/extract"...` block. AFTER that closing block (the one ending with `}, [])` and its eslint-disable comment), insert:

```tsx
  useEffect(() => {
    if (previewSourceUrl === null) return
    if (watchedUrl === previewSourceUrl) return
    setPreview(null)
    setPreviewSourceUrl(null)
    setComments([])
    setSentiment(null)
    setDistribution(null)
    setAnalytics(EMPTY_ANALYTICS)
  }, [watchedUrl, previewSourceUrl])
```

- [ ] **Step 5: Update `onPreview` to use request-id race guard**

Find the entire `async function onPreview(values: FormValues) { ... }` function and replace its body (from the opening brace after the signature to the matching close before `async function onExtract`) with:

```tsx
  async function onPreview(values: FormValues) {
    previewRequestIdRef.current += 1
    const myId = previewRequestIdRef.current
    setPreviewLoading(true)
    setComments([])
    setSentiment(null)
    setDistribution(null)
    setAnalytics(EMPTY_ANALYTICS)
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: values.url }),
      })
      const data = await res.json()
      if (myId !== previewRequestIdRef.current) return
      if (!res.ok) {
        toast.error(data.error ?? tEx("toast_preview_failed"))
        return
      }
      setPreview(data as VideoMeta)
      setPreviewSourceUrl(values.url)
      track("preview_loaded", {
        videoId: data.videoId,
        commentCount: data.commentCount,
        disabled: data.commentsDisabled ? "true" : "false",
      })
      if (data.commentsDisabled || data.commentCount === 0) {
        toast.warning(tEx("toast_comments_disabled"))
      }
    } catch (e) {
      if (myId !== previewRequestIdRef.current) return
      toast.error(e instanceof Error ? e.message : tEx("toast_network_error"))
    } finally {
      if (myId === previewRequestIdRef.current) {
        setPreviewLoading(false)
      }
    }
  }
```

- [ ] **Step 6: Update `reset()` to clear `previewSourceUrl` too**

Find:
```tsx
  function reset() {
    setPreview(null)
    setComments([])
    setSentiment(null)
    setDistribution(null)
    setAnalytics(EMPTY_ANALYTICS)
    form.reset({ url: "" })
  }
```

Replace with:
```tsx
  function reset() {
    setPreview(null)
    setPreviewSourceUrl(null)
    setComments([])
    setSentiment(null)
    setDistribution(null)
    setAnalytics(EMPTY_ANALYTICS)
    form.reset({ url: "" })
  }
```

- [ ] **Step 7: Type-check the file**

Run: `pnpm tsc --noEmit` (or `npm run typecheck` if defined).
Expected: clean exit, no new errors.

### Task A2: Rewire form submit and button to drive `onPreview` or `onExtract` based on `preview` state; strip preview-card buttons

**Files:**
- Modify: `src/components/tubemine.tsx` (form `<form>` block, preview card markup)

- [ ] **Step 1: Replace the form `onSubmit` handler and button**

Find:
```tsx
      <form
        onSubmit={form.handleSubmit(onPreview)}
        className="demo-form"
        noValidate
      >
```

Replace with:
```tsx
      <form
        onSubmit={form.handleSubmit((values) => {
          if (preview) {
            void onExtract()
          } else {
            void onPreview(values)
          }
        })}
        className="demo-form"
        noValidate
      >
```

- [ ] **Step 2: Update the main submit button label and disabled gate**

Find:
```tsx
        <button
          type="submit"
          className={`btn btn--primary btn-lg${previewLoading ? " is-loading" : ""}`}
          disabled={previewLoading || extractLoading}
        >
          {previewLoading ? <Loader2 className="size-4 animate-spin" /> : t("cta")}
        </button>
```

Replace with:
```tsx
        <button
          type="submit"
          className={`btn btn--primary btn-lg${previewLoading || extractLoading ? " is-loading" : ""}`}
          disabled={
            previewLoading ||
            extractLoading ||
            (preview !== null &&
              (preview.commentsDisabled ||
                extractCount === 0 ||
                (budget?.remaining ?? 1) === 0))
          }
        >
          {previewLoading || extractLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : preview ? (
            tEx("analyze_n_comments", { count: extractCount })
          ) : (
            t("cta")
          )}
        </button>
```

- [ ] **Step 3: Strip the in-card action row from the preview card**

Find:
```tsx
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onExtract}
              className={`btn btn--primary btn-lg${extractLoading ? " is-loading" : ""}`}
              disabled={
                extractLoading ||
                preview.commentCount === 0 ||
                preview.commentsDisabled ||
                (budget?.remaining ?? 1) === 0
              }
            >
              {extractLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {tEx("analyzing")}
                </>
              ) : (
                <>{tEx("analyze_n_comments", { count: extractCount })}</>
              )}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={extractLoading}
              className="btn btn--ghost btn-sm"
            >
              <RotateCcw className="size-3.5" />
              {tEx("try_another_url")}
            </button>
          </div>
        </div>
      )}
```

Replace with:
```tsx
        </div>
      )}
```

- [ ] **Step 4: Remove the now-unused `RotateCcw` import if no other usage remains**

Run: `grep -n "RotateCcw" src/components/tubemine.tsx`.
- If only the import line remains, edit:

  Find: `import { Loader2, RotateCcw, Link as LinkIcon } from "lucide-react"`
  Replace: `import { Loader2, Link as LinkIcon } from "lucide-react"`

- If `RotateCcw` is used elsewhere (results panel or similar), leave the import as is.

- [ ] **Step 5: Type-check**

Run: `pnpm tsc --noEmit`.
Expected: clean.

- [ ] **Step 6: Run unit tests in the components area**

Run: `pnpm vitest run src/components/__tests__ --reporter=basic` (or whatever test runner is configured).
Expected: pass. If a `tubemine.test.tsx` exists that asserts old two-step DOM, it MUST be updated to the one-step assertion. Read the test file before changing. If updates needed, follow TDD: add the new assertion first, run (fail), update the component if needed (it already matches), run (pass).

If no test file exists for `tubemine.tsx` interactivity: do not invent one. Manual prod verification (§Phase A verification below) is the gate.

- [ ] **Step 7: Local dev smoke**

Run: `pnpm dev` in background. Open `http://localhost:3000/en` in Chrome MCP, paste a known YouTube URL, observe one-step flow. Kill dev server when done.

### Task A3: Commit, push, open PR, verify on prod

- [ ] **Step 1: Em-dash check**

Run: `grep -nP "[\x{2014}\x{2013}]" src/components/tubemine.tsx`.
Expected: empty output (no em-dash).

- [ ] **Step 2: Stage exactly the touched files**

Run: `git status --short`.
Verify only `src/components/tubemine.tsx` is staged for this PR (no pricing or login overlap from parallel TUB-32).

```bash
git add src/components/tubemine.tsx
git status --short
```

If parallel TUB-32 files appear in `git status` (e.g., `src/app/[locale]/pricing/page.tsx`, `src/components/pricing-tier-aware.tsx`), do NOT stage them.

- [ ] **Step 3: Commit (let hooks run normally)**

```bash
git commit -m "$(cat <<'EOF'
feat(extractor): collapse two-step extract into one click [TUB-33]

Submit handler now picks onPreview or onExtract based on preview state.
Preview card is info-only; in-card confirm/reset buttons removed.
URL edits after preview invalidate it via useWatch+useEffect.
In-flight preview race guarded by previewRequestIdRef.

Spec: docs/superpowers/specs/2026-05-21-tub-33-extract-ux-batch-design.md
Plan: docs/superpowers/plans/2026-05-21-tub-33-extract-ux-batch.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If a pre-commit hook fails: read the failure, fix the issue, re-stage, create a NEW commit. Never `--no-verify`.

- [ ] **Step 4: Push to origin/main (direct-to-main is the project convention per recent commits)**

Run: `git push origin main`.

- [ ] **Step 5: Poll Vercel for READY deployment**

Tool: `mcp__vercel__list_deployments` with project `yt-comments` (or whatever project name is registered). Filter `state: "READY"` and find the deployment whose `meta.githubCommitSha` matches the commit just pushed.

If READY not yet visible, wait 30 seconds and re-check. Stop after 5 minutes; if still not READY, fetch build logs via `mcp__vercel__get_deployment_build_logs` and surface the error.

- [ ] **Step 6: Chrome MCP verification on prod**

Sequence:

1. `mcp__claude-in-chrome__tabs_context_mcp` to find existing tab or create new.
2. `mcp__claude-in-chrome__navigate` to `https://tubemine.tech/en/dashboard` (signed-in Pro session if user is already logged in; otherwise `/en` for the landing demo).
3. `mcp__claude-in-chrome__javascript_tool` to execute:
   ```js
   const input = document.getElementById('demoUrl')
   input.value = 'https://youtu.be/PHqshQPRxt4'
   input.dispatchEvent(new Event('input', {bubbles: true}))
   input.dispatchEvent(new Event('change', {bubbles: true}))
   document.querySelector('form.demo-form')?.requestSubmit()
   ```
4. Wait for preview card to render (poll for the title element).
5. Run assertion:
   ```js
   const previewCard = [...document.querySelectorAll('.rounded-xl')].find(el => el.querySelector('img'))
   const buttonsInsideCard = previewCard?.querySelectorAll('button')?.length ?? -1
   const mainBtn = document.querySelector('form.demo-form button[type=submit]')
   const mainBtnText = mainBtn?.textContent?.trim()
   ({ buttonsInsideCard, mainBtnText, mainBtnDisabled: mainBtn?.disabled })
   ```
   Expected: `buttonsInsideCard === 0`, `mainBtnText` matches `/Analyze\s\d+\scomments?/`, `mainBtnDisabled === false`.
6. `mcp__claude-in-chrome__gif_creator` or `mcp__chrome-devtools__take_screenshot` for evidence.

- [ ] **Step 7: Comment on Linear TUB-33 with results**

Tool: `mcp__claude_ai_Linear__save_comment` with body summarizing:
- Phase A merged: commit SHA
- Verify-on-prod assertion result (buttonsInsideCard, mainBtnText)
- Screenshot or video reference (attach via `mcp__claude_ai_Linear__create_attachment_from_upload` if available)

---

## Phase B: Tier-aware top words pagination

### Task B1: Add `expanded` state, `displayedItems`, and conditional expand button

**Files:**
- Modify: `src/components/top-words.tsx`

- [ ] **Step 1: Add `useState` import**

Find:
```tsx
"use client"

import { Lock, Sparkles } from "lucide-react"
```

Replace with:
```tsx
"use client"

import { useState } from "react"
import { Lock, Sparkles } from "lucide-react"
```

- [ ] **Step 2: Add pagination constant and state inside the component**

Find:
```tsx
  const t = useTranslations("analytics.top_words")
  if (items.length === 0) return null

  const max = items[0].count
  const remaining = Math.max(0, totalUnique - items.length)
  const cta = upgradeCta(t, tier, remaining)
```

Replace with:
```tsx
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
```

- [ ] **Step 3: Render `displayedItems` instead of `items` in the grid**

Find:
```tsx
        <div className="grid gap-1.5 sm:grid-cols-2">
          {items.map(({ word, count }) => {
```

Replace with:
```tsx
        <div className="grid gap-1.5 sm:grid-cols-2">
          {displayedItems.map(({ word, count }) => {
```

- [ ] **Step 4: Insert expand toggle between the grid and the upgrade CTA**

Find:
```tsx
        </div>
        {cta ? (
          <Link
```

Replace with:
```tsx
        </div>
        {hasMore ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex w-fit items-center gap-1.5 text-xs text-foreground/80 underline-offset-4 hover:underline"
          >
            {expanded ? t("hide") : t("show_all", { count: items.length })}
          </button>
        ) : null}
        {cta ? (
          <Link
```

- [ ] **Step 5: Type-check**

Run: `pnpm tsc --noEmit`.
Expected: clean.

### Task B2: Add i18n keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Find the `analytics.top_words` block in en.json**

Run: `grep -n '"top_words"' messages/en.json`. Open the file at the match. Find the `top_words: { ... }` object closing brace.

- [ ] **Step 2: Add the two new keys to en.json**

Inside the `top_words` object, add (preserving JSON syntax: comma after previous last key):

```json
    "show_all": "Show all {count}",
    "hide": "Hide"
```

- [ ] **Step 3: Same for ru.json**

Inside the `top_words` object in `messages/ru.json`:

```json
    "show_all": "Показать все {count}",
    "hide": "Скрыть"
```

- [ ] **Step 4: Validate JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/ru.json','utf8')); console.log('OK')"`.
Expected: `OK`.

- [ ] **Step 5: Em-dash check on both message files**

Run: `grep -nP "[\x{2014}\x{2013}]" messages/en.json messages/ru.json` (focus on the new keys).
Expected: no em-dash in the new keys.

### Task B3: Commit, push, verify on prod

- [ ] **Step 1: Em-dash check on all touched files**

Run: `grep -nP "[\x{2014}\x{2013}]" src/components/top-words.tsx messages/en.json messages/ru.json`.
Expected: empty (or pre-existing matches that are not your additions). If anything appears in the new additions, fix.

- [ ] **Step 2: Stage only this phase's files**

```bash
git status --short
git add src/components/top-words.tsx messages/en.json messages/ru.json
git status --short
```

Reject staging if parallel TUB-32 files have entered the tree.

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(top-words): tier-aware pagination for Pro [TUB-33]

Pro tier now shows first 30 ranked words by default with
"Show all NNN" / "Hide" toggle. Anon (5) and Free (15) unchanged.
Header "shown" count keeps server-returned items.length so the
Pro value-prop ("all ranked") stays visible.

Spec: docs/superpowers/specs/2026-05-21-tub-33-extract-ux-batch-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Push**

Run: `git push origin main`.

- [ ] **Step 5: Wait for Vercel READY**

Same procedure as Task A3 Step 5.

- [ ] **Step 6: Chrome MCP verification on prod**

1. Navigate to `https://tubemine.tech/en/dashboard` (Pro session).
2. Submit a YouTube URL with high comment volume (e.g., `https://youtu.be/PHqshQPRxt4`).
3. Click the (now one-step) main button. Wait for results to render.
4. Run JS assertion:
   ```js
   // Locate the Top Words card by heading text.
   const heading = [...document.querySelectorAll('h2')].find(h => /Top words|Топ\sслов/.test(h.textContent ?? ''))
   const card = heading?.closest('.border-border\\/60') ?? heading?.closest('[class*="border"]')
   const rows = card?.querySelectorAll('.grid > div') ?? []
   const expandBtn = card?.querySelector('button')
   const expandBtnText = expandBtn?.textContent?.trim()
   ({ rowCount: rows.length, expandBtnText })
   ```
   Expected (Pro on >30-word video): `rowCount === 30`, `expandBtnText` matches `/Show all \d+|Показать все \d+/`.
5. Click expand: `expandBtn.click()`.
6. Re-run row count. Expected: `rowCount > 30` and equal to the full `items.length` returned by the server. `expandBtnText` now matches `/Hide|Скрыть/`.
7. Screenshot for evidence.

- [ ] **Step 7: Tier branch verification (best effort)**

If a Free or Anon test account is available, repeat with that account and confirm no expand button + correct row count (15 / 5). If not available, document as "deferred to user manual TC" in Linear comment.

- [ ] **Step 8: Comment on Linear TUB-33**

`mcp__claude_ai_Linear__save_comment`: Phase B merged SHA, verify assertions (rowCount collapsed, rowCount expanded, button text states), any deferred tier branches.

---

## Phase C: Save CSV button contrast

### Task C1: Baseline contrast measurement on prod (pre-edit)

**Files:** none (measurement only)

- [ ] **Step 1: Chrome MCP navigate to prod with a completed extract**

Navigate to `https://tubemine.tech/en/dashboard`, run any extract that produces results. The Save CSV button must be visible.

- [ ] **Step 2: Compute baseline contrast ratios**

Execute via `mcp__claude-in-chrome__javascript_tool`:

```js
function relLum(rgbStr) {
  const m = rgbStr.match(/\d+(\.\d+)?/g)
  if (!m) return 0
  const [r, g, b] = m.slice(0, 3).map(Number).map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a, b) {
  const [L1, L2] = [relLum(a), relLum(b)].sort((x, y) => y - x)
  return (L1 + 0.05) / (L2 + 0.05)
}
const btns = [...document.querySelectorAll('button')].filter(b => /Save\s|Скачать\sCSV|JSON|Excel/.test(b.textContent ?? ''))
btns.map(b => {
  const cs = getComputedStyle(b)
  return {
    text: b.textContent.trim(),
    bg: cs.backgroundColor,
    fg: cs.color,
    ratio: Number(contrast(cs.backgroundColor, cs.color).toFixed(2)),
  }
})
```

- [ ] **Step 3: Record baselines in Linear TUB-33 comment**

Save the array as a code block in a Linear comment titled "Phase C baseline contrast measurement". This determines whether JSON / Excel buttons are in scope.

### Task C2: Apply CSS override + className addition

**Files:**
- Modify: `src/app/globals.css` (append new block near other `.tm-design .btn` rules)
- Modify: `src/components/export-bar.tsx` (add `className="tm-action-btn"` to Save CSV `<Button>` instances)

- [ ] **Step 1: Add `tm-action-btn` class to Save CSV buttons in export-bar.tsx**

Find:
```tsx
  if (tier === "anonymous" || tier === "free") {
    return (
      <Button onClick={onDownloadCsv} size="sm">
        <Download className="size-4" />
        {tCommon("save_csv")}
      </Button>
    )
  }
```

Replace with:
```tsx
  if (tier === "anonymous" || tier === "free") {
    return (
      <Button onClick={onDownloadCsv} size="sm" className="tm-action-btn">
        <Download className="size-4" />
        {tCommon("save_csv")}
      </Button>
    )
  }
```

Then find the Pro branch Save CSV `<Button>`:
```tsx
  // tier === "pro"
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onDownloadCsv} size="sm">
        <Download className="size-4" />
        {tCommon("save_csv")}
      </Button>
```

Replace with:
```tsx
  // tier === "pro"
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onDownloadCsv} size="sm" className="tm-action-btn">
        <Download className="size-4" />
        {tCommon("save_csv")}
      </Button>
```

(Save JSON and Save Excel `<Button variant="outline">` are NOT touched unless baseline measurement showed them failing AA. If they failed: see Step 3 below.)

- [ ] **Step 2: Append the override block to globals.css**

Run `grep -n "btn--ghost" src/app/globals.css` and locate the end of the button-related selectors (around line 311 per spec context). Append a new block after the last `.tm-design .btn-lg` rule (or at any clear injection point inside the design layer):

```css
/* TUB-33 Phase C: WCAG AA contrast on the Save CSV action button. */
.tm-design .tm-action-btn {
  background-color: var(--color-surface-muted) !important;
  color: var(--color-text-inverse) !important;
  border: 1px solid var(--color-surface-muted);
}
.tm-design .tm-action-btn:hover { background-color: #ececef !important; }
.tm-design .tm-action-btn:focus-visible {
  outline: 2px solid var(--color-text-primary);
  outline-offset: 2px;
}
.tm-design .tm-action-btn:disabled,
.tm-design .tm-action-btn[aria-disabled="true"] {
  opacity: 0.55;
  cursor: not-allowed;
}
```

- [ ] **Step 3: ONLY IF baseline measurement (Task C1) showed Save JSON or Save Excel failing AA**

Otherwise SKIP this step.

In `export-bar.tsx`, add `className="tm-action-btn-outline"` to the Save JSON and Save Excel `<Button>` instances.

In `globals.css`, after the `.tm-action-btn` block, append:

```css
.tm-design .tm-action-btn-outline {
  background-color: transparent !important;
  color: var(--color-text-primary) !important;
  border: 1px solid var(--color-border-strong) !important;
}
.tm-design .tm-action-btn-outline:hover {
  background-color: rgba(245,245,247,0.08) !important;
}
.tm-design .tm-action-btn-outline:focus-visible {
  outline: 2px solid var(--color-text-primary);
  outline-offset: 2px;
}
```

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`.
Expected: clean.

- [ ] **Step 5: Em-dash check**

Run: `grep -nP "[\x{2014}\x{2013}]" src/app/globals.css src/components/export-bar.tsx`.
Expected: no NEW em-dash from this PR (pre-existing matches elsewhere in `globals.css` are out of scope).

### Task C3: Commit, push, verify on prod

- [ ] **Step 1: Stage only this phase's files**

```bash
git status --short
git add src/app/globals.css src/components/export-bar.tsx
git status --short
```

Reject any parallel TUB-32 changes from staging.

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
fix(export-bar): WCAG AA contrast on Save CSV action button [TUB-33]

Saves CSV button was light-on-light inside .tm-design surface,
failing WCAG AA. Scoped override pins background to
--color-surface-muted and text to --color-text-inverse with
!important to outrank shadcn Tailwind utilities. Focus ring
moved to outline with offset for visibility.

Spec: docs/superpowers/specs/2026-05-21-tub-33-extract-ux-batch-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push**

Run: `git push origin main`.

- [ ] **Step 4: Wait for Vercel READY**

Same procedure as Task A3 Step 5.

- [ ] **Step 5: Post-deploy contrast assertion on prod**

Re-run the script from Task C1 Step 2. Assert:
- Save CSV ratio >= 4.5 (or >= 3.0 if computed font-size and weight classify as large text per WCAG SC 1.4.3).
- If Step 3 of Task C2 was executed: Save JSON / Save Excel ratio at the same threshold.
- If Step 3 of Task C2 was SKIPPED: no assertion on Save JSON / Save Excel.

If Save CSV still fails: investigate cascade (use DevTools-equivalent JS to inspect which rules apply via `getMatchedCSSRules` or by checking inline rules count). If `!important` is being overridden by another `!important` in shadcn or component-scoped CSS, escalate selector specificity (e.g., add a sibling class or add `:where()`-defeating compound selector) and ship a follow-up commit.

- [ ] **Step 6: Screenshot the export bar**

`mcp__chrome-devtools__take_screenshot` focused on the results panel header.

- [ ] **Step 7: Comment on Linear TUB-33**

`mcp__claude_ai_Linear__save_comment`: Phase C merged SHA, before/after contrast ratios per button, screenshot reference.

---

## Task Z: Close out

### Task Z1: Move Linear TUB-33 to Done

- [ ] **Step 1: Final close-out Linear comment**

Tool: `mcp__claude_ai_Linear__save_comment` on TUB-33:

```
All three phases shipped and verified on https://tubemine.tech.

Phase A (one-step extract): commit <SHA-A>
Phase B (top words pagination): commit <SHA-B>
Phase C (Save CSV contrast): commit <SHA-C>

Verify-on-prod results recorded in per-phase comments above.

Test cases added to vault qa/test-cases.md:
- TC-EXTRACT-OneStep
- TC-TOP-WORDS-PaginatedDisplay
- TC-CSS-008
```

Fill in SHAs from `git log --oneline -10` after Phase C.

- [ ] **Step 2: Move issue to Done**

Tool: `mcp__claude_ai_Linear__save_issue` with the TUB-33 identifier and `status: "Done"`.

### Task Z2: Vault updates

**Files:**
- Append to `~/vault/projects/yt-comments/qa/test-cases.md`
- Append to `~/vault/daily/2026-05-21.md`

- [ ] **Step 1: Append three new test cases to vault qa catalog**

Tool: `mcp__obsidian__write_note` with `mode: append` to `projects/yt-comments/qa/test-cases.md`. Append:

```markdown

## TC-EXTRACT-OneStep (TUB-33 Phase A)
- Pre: signed-in Pro session on https://tubemine.tech
- Steps:
  1. Paste a valid YouTube URL into the demo URL input.
  2. Wait for preview card to render.
- Assertions:
  - Preview card contains 0 buttons.
  - Main form submit button text matches /Analyze \d+ comments?/.
  - Main button is enabled.
  3. Click main button.
- Assertion: extract completes, results panel populates.
  4. Edit the URL in the input.
- Assertion: preview card disappears, main button reverts to default "Analyze".

## TC-TOP-WORDS-PaginatedDisplay (TUB-33 Phase B)
- Pre: results panel rendered on a video with > 30 unique words.
- Assertions (Pro):
  - Top Words card renders exactly 30 grid rows initially.
  - "Show all NNN" / "Показать все NNN" button visible.
  - Click expand: row count grows to items.length, button text flips to "Hide" / "Скрыть".
- Assertions (Free): 15 rows, no expand.
- Assertions (Anon): 5 rows, no expand.

## TC-CSS-008 action button contrast (TUB-33 Phase C, extends TC-CSS-002)
- Pre: results panel rendered, Save CSV button visible.
- Computation: relative luminance of getComputedStyle(btn).backgroundColor vs .color.
- Assertion: contrast ratio >= 4.5:1 (WCAG AA normal text) or >= 3.0:1 (large text).
- Focus state assertion: outline ring contrast vs surrounding background >= 3.0:1 (WCAG 2.4.7).
```

- [ ] **Step 2: Append daily-note session summary**

Tool: `mcp__obsidian__write_note` with `mode: append` to `daily/2026-05-21.md`. Append:

```markdown

## Session Summary (HH:MM) - TUB-33 Extract UX batch
- **Goal:** Ship one-step extract + Pro top-words pagination + Save CSV contrast fix as three sequential PRs.
- **Progress:** All three phases merged and verified on https://tubemine.tech via Chrome MCP.
- **Decisions:**
  - Form submit handler picks onPreview or onExtract by preview state (no separate ready-pulse animation, label flip is enough).
  - Top words: defensive client cap kept ONLY for Pro (anon/free trust the server slice).
  - Phase C uses !important from the start to avoid Tailwind v4 layer-order roulette.
- **Files (code):**
  - src/components/tubemine.tsx (Phase A)
  - src/components/top-words.tsx, messages/{en,ru}.json (Phase B)
  - src/app/globals.css, src/components/export-bar.tsx (Phase C)
- **Files (vault):** projects/yt-comments/qa/test-cases.md (3 new TCs), daily/2026-05-21.md (this block).
- **Linear:** TUB-33 Done with per-phase verify comments and SHAs.
- **Next:** TUB-34 (recent analyses overhaul) if separately scheduled. Out of scope here.
```

Fill in HH:MM and SHAs at write time.

- [ ] **Step 3: Verify vault writes**

Tool: `mcp__obsidian__read_note` on both notes to confirm append succeeded and frontmatter unchanged.

---

## Self-Review

**Spec coverage check (against `docs/superpowers/specs/2026-05-21-tub-33-extract-ux-batch-design.md`):**
- §5 Phase A: covered by Task A1 (state + race + reset effect), A2 (form + button + strip card), A3 (ship + verify). All five 5.6 acceptance criteria mapped to Step 6 of A3.
- §6 Phase B: covered by Task B1 (panel logic), B2 (i18n), B3 (ship + verify). 6.5 acceptance criteria mapped to B3 Step 6 + Step 7.
- §7 Phase C: covered by Task C1 (baseline), C2 (apply), C3 (ship + verify). 7.5 acceptance criteria mapped to C3 Step 5.
- §8 ship order: enforced by the linear A then B then C task ordering with explicit prod-verify between phases.
- §9 verification matrix: each phase's Step 6 mirrors the relevant §9 sub-section.
- §10 Linear and vault: covered by Task 0, Task Z1, Task Z2.

**Placeholder scan:** no "TBD", no "similar to Task N", no "add appropriate handling". All code edits show exact find/replace strings. JSON keys spelled out. CSS block spelled out.

**Type consistency:**
- `previewRequestIdRef` (Task A1) referenced in A2 in the new `onPreview` body. Same name.
- `setPreviewSourceUrl` introduced in A1 used in A1 Step 5 and A2 Step 1 reset. Same name.
- `tm-action-btn` class added in C2 Step 1 matches CSS selector in C2 Step 2. Same name.
- `displayedItems` (B1 Step 2) used in B1 Step 3. Same name.

Plan is internally consistent and ready to execute.
