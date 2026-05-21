# TUB-28 INP Perf Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/dashboard` sidebar nav-item INP from 2097 ms toward < 600 ms via 3 staged commits: add `loading.tsx`, replace `listAnalyses(100)` with a cheap count query, and wrap auth/quota fetches in `react.cache` for per-request dedup. Step 4 (cache wrap) is conditional on prod INP still being > 600 ms after Steps 1+2.

**Architecture:** No structural change. Server-rendered Next.js 16 App Router. Route group `src/app/[locale]/(app)/` with `AppShell` chrome in `layout.tsx`, three sibling pages (`dashboard`, `profile`, `history`). Supabase RLS scopes per-user. Changes: (1) Suspense fallback for instant skeleton; (2) head-only count query instead of 100-row fetch; (3) `react.cache` shims around `supabase.auth.getUser()` and `getUserQuota(userId)` to avoid duplicate fetches inside one request.

**Tech Stack:** Next.js 16.2.6, React 19.2.4, TypeScript, `next-intl` 4.12, `@supabase/ssr` 0.10.3, `@supabase/supabase-js` 2.105.4, vitest, pnpm. No new deps.

**Spec:** `docs/superpowers/specs/2026-05-21-tub-28-inp-perf-refactor-design.md`.
**Linear:** [TUB-28](https://linear.app/qostap/issue/TUB-28).

---

## Constants for every task

- Project root: `/Users/rakhimovy/projects/yt-comments`. All paths below are relative to this root unless absolute.
- Prod URL: `https://tubemine.tech`.
- Locale used for verify: `en` (URL `/en/dashboard`).
- Test command: `pnpm test` (runs `NODE_ENV=test vitest run`).
- Single-file test: `pnpm test -- src/lib/__tests__/<file>.test.ts`.
- Build (validates message parity + types + bundle): `pnpm build`.
- Lint: `pnpm lint`.
- No em-dash (`U+2014`) or en-dash (`U+2013`) in any code, comment, or commit message. Use `,` `.` `()` `:` `-` only.
- `redirect` import in pages comes from `@/i18n/navigation`, not `next/navigation`.

### Chrome MCP `javascript_tool` invocation contract

Every JS snippet in this plan that is meant to run via `mcp__claude-in-chrome__javascript_tool` is wrapped in an async IIFE so it works whether the tool wraps the code or evals it directly. Pattern:

```js
(async () => {
  // assertion code
  return { /* result object */ }
})()
```

The tool returns the resolved promise. If a snippet below shows bare top-level `return`/`await`, treat it as inside an implicit IIFE: wrap it yourself in `(async () => { ... })()` before passing to the tool.

### Rollback procedure (referenced by verify-on-prod steps)

Used by 1.10, 2.12, 3.14 when a verify assertion or Tier 1 TC fails on prod.

1. Identify the bad deployment: `mcp__vercel__list_deployments` (filter `target=production`). The TOP entry is the bad one; the SECOND entry is the last known-good deployment. Copy the second entry's `url` (e.g., `tubemine-abc123-rakhimovy.vercel.app`).
2. Run rollback: `vercel rollback <previous-deployment-url> -y` (the `-y` skips the confirmation prompt). Example: `vercel rollback tubemine-abc123-rakhimovy.vercel.app -y`.
3. Wait ~5 seconds, hard-reload `https://tubemine.tech` and confirm content matches the previous known-good state.
4. Do NOT push more commits on top of the failed branch. Open a NEW branch off the last known-good `main` SHA, fix the issue there, preview-test, then merge.
5. Comment on TUB-28 with: "Step N rolled back (commit `<bad-SHA>`). Cause: `<short reason>`. New branch: `<new-branch>`."

---

## File Structure (locked decisions)

| File | Operation | Responsibility |
|---|---|---|
| `src/app/[locale]/(app)/loading.tsx` | create (Task 1) | Suspense fallback for `(app)` child pages. Static React, no data deps, no translations. |
| `src/lib/analyses.ts` | modify (Task 2) | Add `getAnalysesCount(sb)` helper. |
| `src/app/[locale]/(app)/layout.tsx` | modify (Task 2 + Task 3) | Task 2: swap `listAnalyses(100)` for `getAnalysesCount`. Task 3: swap `supabase.auth.getUser()` for `getCachedUser()`. |
| `src/lib/__tests__/analyses-count.test.ts` | create (Task 2) | Happy-path unit test for `getAnalysesCount`. |
| `src/lib/supabase/server.ts` | modify (Task 3) | Add `getCachedUser` export (`cache(...)`-wrapped) with RSC-only JSDoc. |
| `src/lib/quota.ts` | modify (Task 3) | Wrap existing `getUserQuota` with `react.cache` for per-request dedup. |
| `src/app/[locale]/(app)/dashboard/page.tsx` | modify (Task 3) | Replace `supabase.auth.getUser()` with `getCachedUser()`. |
| `src/app/[locale]/(app)/profile/page.tsx` | modify (Task 3) | Same as dashboard. |
| `src/app/[locale]/(app)/history/page.tsx` | modify (Task 3) | Same as dashboard. |

No other files are touched. No new dependencies. No new directories.

---

## Pre-flight (do once, before Task 1)

- [ ] **PF.1: Refresh Linear context.**

Run from any shell context that can reach Linear MCP:
- `mcp__claude_ai_Linear__get_issue('TUB-28')` to confirm current status.
- `mcp__claude_ai_Linear__save_issue` to move TUB-28 from Backlog to In Progress. Use the existing team/status IDs returned by `get_issue`.

- [ ] **PF.2: Verify clean working tree on `main`.**

Run: `git status`
Expected: `On branch main` ... `nothing to commit, working tree clean`.

If dirty: stash or commit BEFORE starting Task 1. Do NOT branch off a dirty tree.

- [ ] **PF.3: Confirm prod deploy of current `main` is READY.**

Run: `mcp__vercel__list_deployments` with `projectId=tubemine` (find the canonical projectId via `mcp__vercel__list_projects` if unknown). Expected: latest deployment for `main` has `readyState=READY`.

If not READY: wait for the in-flight deploy to finish before starting Task 1.

---

## Task 1: Add `loading.tsx` (Step 1 in spec)

**Files:**
- Create: `src/app/[locale]/(app)/loading.tsx`

Bite-sized steps:

- [ ] **1.1: Branch off main.**

```bash
git checkout main
git pull --ff-only origin main
git checkout -b fix/tub-28-step-1-loading-skeleton
```

Expected: branch `fix/tub-28-step-1-loading-skeleton` created and checked out.

- [ ] **1.2: Create `loading.tsx`.**

Write the following to `src/app/[locale]/(app)/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

/*
  TUB-28 Step 1: Suspense fallback for child pages in the (app) route group.
  Renders instantly on navigation between /dashboard, /profile, /history while
  the new page's server data resolves. AppShell chrome (topbar + sidebar) is
  already mounted by the parent layout, so this file only fills .main-inner.

  Hard rules:
    - No t() / getTranslations() / useTranslations(). Locale-agnostic body.
    - No auth. No data fetches.
    - Reserved class .is-placeholder is NOT used here (owned by
      .recent-thumb.is-placeholder in globals.css line 1776 for missing
      thumbnail fallback). Use [data-slot="skeleton"] from the Skeleton
      primitive instead.

  Block heights match the real dashboard sections so transition to real
  content does not visibly jump.
*/
export default function AppGroupLoading() {
  return (
    <div className="dashboard-page" aria-busy="true" aria-live="polite">
      {/* Welcome strip placeholder. Real welcome-strip is ~56px tall. */}
      <Skeleton className="h-14 w-2/3" />

      {/* Usage card placeholder. Real usage card is ~180px tall. */}
      <Skeleton className="h-44 w-full rounded-xl" />

      {/* Quick analyze card placeholder. Real quick-analyze is ~220px tall. */}
      <Skeleton className="h-56 w-full rounded-xl" />

      {/* Recent analyses list: 5 rows, ~64px each. */}
      <div className="recent-list">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  )
}
```

- [ ] **1.3: Verify the new file has no banned characters.**

Run: `grep -cP '[\x{2014}\x{2013}]' src/app/\[locale\]/\(app\)/loading.tsx`
Expected: `0`.

- [ ] **1.4: Type-check + build.**

Run: `pnpm build`
Expected: success (vitest passes, message parity OK, Next.js build completes).

If TypeScript errors mention missing `Skeleton` import: verify the file at `src/components/ui/skeleton.tsx` exports `Skeleton`. Do NOT modify that file.

- [ ] **1.5: Lint.**

Run: `pnpm lint`
Expected: no errors.

- [ ] **1.6: Commit.**

```bash
git add src/app/\[locale\]/\(app\)/loading.tsx
git commit -m "$(cat <<'EOF'
perf(tub-28): step 1 add loading.tsx for (app) route group

Suspense fallback so sidebar nav-item clicks render skeleton instantly
while the new page server-resolves. AppShell chrome already mounted by
parent layout, so this file only fills .main-inner with 4 dashboard-shaped
skeleton blocks (welcome strip, usage card, quick analyze, 5 recent rows).
No translations, no auth, no data deps. Uses [data-slot="skeleton"] from
existing Skeleton primitive; reserved .is-placeholder class untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **1.7: Push and open PR.**

```bash
git push -u origin fix/tub-28-step-1-loading-skeleton
gh pr create --title "perf(tub-28): step 1 add loading.tsx for (app) route group" --body "$(cat <<'EOF'
## Summary
- Adds Suspense fallback for child pages in the (app) route group so sidebar nav clicks render an instant skeleton.
- AppShell chrome stays mounted across navigation; only .main-inner gets the skeleton.
- Zero data dependencies; pure markup.

## Test plan
- [ ] Preview URL renders skeleton when navigating /dashboard -> /profile -> /history
- [ ] DOM has [data-slot="skeleton"] within 100ms of click
- [ ] No new lint or TS errors
- [ ] No visible CLS jump (< 0.05) on transition

Relates to: TUB-28
EOF
)"
```

Expected: PR URL returned. Vercel auto-creates a preview deployment.

- [ ] **1.8: Verify preview, then merge.**

Wait for Vercel preview to reach READY (poll `mcp__vercel__list_deployments` filtered to the PR branch). Hard-reload the preview URL in Chrome MCP (`mcp__claude-in-chrome__navigate` to the preview URL + `/en/dashboard`). Click any sidebar nav-item, observe a skeleton flash.

Then merge the PR:
```bash
gh pr merge --squash --delete-branch
git checkout main
git pull --ff-only origin main
```

- [ ] **1.9: Wait for prod deploy READY.**

Run: `mcp__vercel__list_deployments` (filter to `target=production`, latest commit on `main`).
Expected: `readyState=READY`.

- [ ] **1.10: Verify on prod via Chrome MCP.**

Navigate to `https://tubemine.tech/en/dashboard` via `mcp__claude-in-chrome__navigate`. Sign in if not authed (this verify is best run with a real authed session in the user's main browser; if running headless-anonymous, the auth redirect will happen, still acceptable for verifying the skeleton path).

Execute DOM assertion via `mcp__claude-in-chrome__javascript_tool` (IIFE-wrapped per Chrome MCP invocation contract above):

```js
(async () => {
  // Click the History nav item, capture if skeleton element exists within 100ms.
  const link = document.querySelector('aside a[href$="/history"]')
  const before = performance.now()
  link?.click()
  let skeletonSeen = false
  const start = Date.now()
  while (Date.now() - start < 200) {
    if (document.querySelector('[data-slot="skeleton"]')) {
      skeletonSeen = true
      break
    }
    await new Promise(r => setTimeout(r, 10))
  }
  return { skeletonSeen, elapsedMs: performance.now() - before }
})()
```

Expected: `skeletonSeen=true`, `elapsedMs < 100`.

Also take a screenshot via `mcp__claude-in-chrome__take_screenshot` for sanity.

- [ ] **1.11a: Tier 1 TC #1 - SideNav highlights current page.**

Run via Chrome MCP javascript_tool:

```js
(async () => {
  // Navigate to /profile from current page.
  const profileLink = document.querySelector('aside a[href$="/profile"]')
  profileLink?.click()
  await new Promise(r => setTimeout(r, 800)) // allow page transition
  const active = document.querySelector('aside a.is-active')
  return {
    activeHref: active?.getAttribute('href') ?? null,
    pass: active?.getAttribute('href')?.endsWith('/profile') ?? false,
  }
})()
```

Expected: `pass=true`. If `pass=false`: invoke "Rollback procedure" section above.

- [ ] **1.11b: Tier 1 TC #2 - AppShell persists across navigation (no remount).**

Run:

```js
(async () => {
  // Capture sidebar nodeRef before navigation.
  const sidebarBefore = document.querySelector('aside.sidebar')
  const beforeId = sidebarBefore?.getAttribute('id') ?? null
  // Navigate to /history.
  document.querySelector('aside a[href$="/history"]')?.click()
  await new Promise(r => setTimeout(r, 800))
  const sidebarAfter = document.querySelector('aside.sidebar')
  // Same DOM node = AppShell preserved.
  return {
    sameNode: sidebarBefore === sidebarAfter,
    sameId: beforeId === sidebarAfter?.getAttribute('id'),
    pass: sidebarBefore === sidebarAfter,
  }
})()
```

Expected: `pass=true` (sidebar is the same JS object, AppShell not remounted). If `pass=false`: invoke "Rollback procedure".

- [ ] **1.11c: Tier 1 TC #8 - Skeleton flashes on nav.**

This was already executed in 1.10. If 1.10 passed, mark TC #8 PASS here and proceed.

If 1.11a/b/c all PASS: proceed to 1.12. If any FAIL: invoke "Rollback procedure" section above.

- [ ] **1.12: Comment on TUB-28 with Task 1 result.**

Use `mcp__claude_ai_Linear__save_comment` with body:

```
Step 1 (loading.tsx) shipped: <commit SHA>.

Tier 1 verify: TC #1 PASS, TC #2 PASS, TC #8 PASS (skeleton observed within <N> ms of click).

INP measurement (if Vercel Analytics visible): <number> ms.

Proceeding to Step 2.
```

- [ ] **1.13: Append progress to vault daily note.**

Use `mcp__obsidian__write_note` with mode `append` to `daily/2026-05-21.md`:

```
- Turbo #1 INP perf progress: Step 1 (loading.tsx) shipped <SHA>. Tier 1 verify clean. Proceeding to Step 2.
```

Subheading "Turbo #1 INP perf progress" should be created on first append if it does not already exist in today's note.

---

## Task 2: Replace `listAnalyses(100)` with `getAnalysesCount` (Step 2 in spec)

**Files:**
- Modify: `src/lib/analyses.ts` (append `getAnalysesCount`)
- Modify: `src/app/[locale]/(app)/layout.tsx` (swap fetch)
- Create: `src/lib/__tests__/analyses-count.test.ts` (happy-path test)

Bite-sized steps:

- [ ] **2.1: Branch off main (after Task 1 merged).**

```bash
git checkout main
git pull --ff-only origin main
git checkout -b fix/tub-28-step-2-analyses-count
```

- [ ] **2.2: Write the failing test.**

Create `src/lib/__tests__/analyses-count.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getAnalysesCount } from "@/lib/analyses"

describe("getAnalysesCount", () => {
  it("returns the count when supabase responds with no error", async () => {
    const select = vi.fn().mockResolvedValue({ count: 7, error: null })
    const from = vi.fn().mockReturnValue({ select })
    const sb = { from } as unknown as SupabaseClient

    const result = await getAnalysesCount(sb)

    expect(result).toBe(7)
    expect(from).toHaveBeenCalledWith("analyses")
    expect(select).toHaveBeenCalledWith("id", { count: "exact", head: true })
  })
})
```

- [ ] **2.3: Run the test, confirm it fails.**

Run: `pnpm test -- src/lib/__tests__/analyses-count.test.ts`
Expected: FAIL with `getAnalysesCount` undefined or import error.

- [ ] **2.4: Add `getAnalysesCount` helper to `src/lib/analyses.ts`.**

Append AFTER the existing `purgeExpiredAnalyses` function (current end of file at line ~191), before any final newline:

```ts
export async function getAnalysesCount(sb: SupabaseClient): Promise<number> {
  // sb is the USER-SCOPED Supabase server client. RLS policy
  // "users read own analyses" filters auth.uid() = user_id, so count is
  // scoped to the caller. head:true + count:'exact' returns a count
  // without a row payload (index-only scan when possible).
  const { count, error } = await sb
    .from("analyses")
    .select("id", { count: "exact", head: true })
  if (error) {
    console.warn("[analyses] count failed", { error: error.message })
    return 0
  }
  return count ?? 0
}
```

- [ ] **2.5: Re-run the test, confirm it passes.**

Run: `pnpm test -- src/lib/__tests__/analyses-count.test.ts`
Expected: PASS (1 test).

- [ ] **2.6: Modify `(app)/layout.tsx` to use the new helper.**

In `src/app/[locale]/(app)/layout.tsx`:

a) Change the import line for analyses. Replace:
```ts
import { listAnalyses } from "@/lib/analyses"
```
with:
```ts
import { getAnalysesCount } from "@/lib/analyses"
```

b) Replace the `Promise.all` block (currently lines ~38-45):
```ts
const [quota, recent] = await Promise.all([
  getUserQuota(user.id),
  listAnalyses(supabase, null, 100),
])

const tier: Tier = quota.tier
const initials = buildInitials(user.email, user.user_metadata?.full_name)
const historyCount = recent.items.length
```

with:

```ts
const [quota, historyCount] = await Promise.all([
  getUserQuota(user.id),
  getAnalysesCount(supabase),
])

const tier: Tier = quota.tier
const initials = buildInitials(user.email, user.user_metadata?.full_name)
```

- [ ] **2.7: Run the full vitest suite + lint + build to catch regressions.**

Run: `pnpm test`
Expected: all tests pass (including the new `analyses-count.test.ts`).

Run: `pnpm lint`
Expected: no errors. If lint complains that `listAnalyses` import is unused elsewhere in `layout.tsx`, confirm step 2.6a removed it; rerun.

Run: `pnpm build`
Expected: success.

- [ ] **2.8: Audit for em/en-dash.**

Run: `grep -cP '[\x{2014}\x{2013}]' src/lib/analyses.ts src/app/\[locale\]/\(app\)/layout.tsx src/lib/__tests__/analyses-count.test.ts`
Expected: `0` for each.

- [ ] **2.9: Commit.**

```bash
git add src/lib/analyses.ts src/lib/__tests__/analyses-count.test.ts src/app/\[locale\]/\(app\)/layout.tsx
git commit -m "$(cat <<'EOF'
perf(tub-28): step 2 swap listAnalyses(100) for getAnalysesCount

Layout previously fetched 100 rows of analyses just to compute the sidebar
history-count badge (recent.items.length). Replace with a head-only
count:'exact' query that returns just the integer, saving ~500-900 ms per
intra-(app) navigation. Sidebar badge still shows the real total via the
existing side-nav.tsx guard historyCount > 0; brand-new users and
RLS-denied fallbacks both render with the badge hidden.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **2.10: Push and open PR.**

```bash
git push -u origin fix/tub-28-step-2-analyses-count
gh pr create --title "perf(tub-28): step 2 swap listAnalyses(100) for getAnalysesCount" --body "$(cat <<'EOF'
## Summary
- Layout drops the 100-row analyses fetch; replaces with head-only count query (~500-900ms saved per intra-(app) nav).
- Sidebar count badge still renders correctly (real total when > 0, hidden when 0).
- New unit test in src/lib/__tests__/analyses-count.test.ts.

## Test plan
- [ ] pnpm test passes (incl. new analyses-count.test)
- [ ] Preview /dashboard, /history, /profile all load without error
- [ ] Sidebar History badge shows real count for a user with > 0 analyses
- [ ] User B (incognito) sees their own count, not User A's
- [ ] No new RLS errors in Vercel logs

Relates to: TUB-28
EOF
)"
```

- [ ] **2.11: Verify preview, merge, wait prod READY.**

Same pattern as Task 1 steps 1.8-1.9.

- [ ] **2.12: Verify on prod via Chrome MCP.**

Navigate to `https://tubemine.tech/en/dashboard` authed. Run JS assertion:

```js
(async () => {
  const aside = document.querySelector('aside.sidebar')
  const countSpan = aside?.querySelector('a[href$="/history"] .count')
  return {
    hasSidebar: !!aside,
    countSpanText: countSpan?.textContent ?? null,
    countSpanPresent: !!countSpan,
  }
})()
```

Expected:
- For a user with > 0 saved analyses: `countSpanPresent=true`, `countSpanText` is a positive integer matching the user's actual count (sanity-check against `/history` page row total).
- For a brand-new user with 0 analyses: `countSpanPresent=false` (badge hidden by `historyCount > 0` guard).

Take screenshot of `/dashboard` for visual record.

- [ ] **2.13: Multi-user RLS isolation check.**

In Chrome MCP regular tab: log in as User A, observe sidebar count = N.
Open new incognito tab (`mcp__claude-in-chrome__tabs_create_mcp` if supported, or User runs manually). Log in as User B. Observe User B's sidebar count = M (their own value, not N).

If incognito automation is unavailable in the current Chrome MCP setup, ask the user to verify manually with a second account.

- [ ] **2.14: Tier 1 verify (full 9 TCs).**

Run each TC below as its own sub-checklist item. Record PASS/FAIL. If ANY TC fails: invoke "Rollback procedure" section.

- [ ] **2.14.1: TC #1 - SideNav highlights current page.** (Use the same JS snippet as step 1.11a.)
- [ ] **2.14.2: TC #2 - AppShell persists across navigation.** (Same as 1.11b.)
- [ ] **2.14.3a: TC #3 - run a fresh analysis.**

  Use the dashboard quick-analyze form on `/en/dashboard` to analyze any test YouTube video. Wait for the analysis to complete (the page shows top words / sentiment / emoji panels).

- [ ] **2.14.3b: TC #3 - obtain your user UUID.**

  Navigate to `/en/profile` in the authed Chrome MCP tab. Run in `mcp__claude-in-chrome__javascript_tool`:

  ```js
  (async () => {
    // Profile page renders TWO .field-row .mono spans:
    //   index 0 = user.email at page.tsx line 140
    //   index 1 = user.id (UUID) at page.tsx line 171
    // Index-based selection is stable because no other .mono spans live
    // in .field-row on the profile page.
    const monos = document.querySelectorAll('.field-row .mono')
    return {
      email: monos[0]?.textContent ?? null,
      userId: monos[1]?.textContent ?? null,
    }
  })()
  ```

  Expected: `email` is your authed email, `userId` is a UUID string. Copy `userId` for step 2.14.3c. If `userId` is undefined or not a UUID-shape string: STOP, the page markup may have drifted; do not proceed with an invalid value.

- [ ] **2.14.3c: TC #3 - query DB and assert non-null fields.**

  Run via `mcp__claude_ai_Supabase__execute_sql` (paste the UUID from 2.14.3b in place of `<your-uuid>`):

  ```sql
  select video_title, channel_name, thumbnail_url
  from analyses
  where user_id = '<your-uuid>'
  order by processed_at desc
  limit 1
  ```

  Expected: exactly one row, all three fields non-null. If any field is null or zero rows return: TC #3 FAILS; invoke "Rollback procedure".
- [ ] **2.14.4: TC #4 - Recent Analyses row has no `.is-placeholder` class for real data.**
  ```js
  (async () => {
    const rows = document.querySelectorAll('.recent-list .recent-row')
    const placeholders = document.querySelectorAll('.recent-list .recent-row .is-placeholder')
    return { rowCount: rows.length, placeholderCount: placeholders.length, pass: placeholders.length === 0 || rows.length > 0 }
  })()
  ```
  Expected: `pass=true`. (Placeholders only allowed on thumbnails when source row has no thumbnail_url.)
- [ ] **2.14.5: TC #5 - History row video_title renders real title.**
  Navigate to `/en/history`. Run (selectors verified against `src/app/[locale]/(app)/history/history-client.tsx`: desktop rows use `.video-title-link`, mobile cards use `.hcr-title`):
  ```js
  (async () => {
    const titles = Array.from(document.querySelectorAll('.history-row .video-title-link, .history-card-row .hcr-title')).map(el => el.textContent?.trim())
    const looksLikeVideoId = titles.some(t => t && /^[A-Za-z0-9_-]{11}$/.test(t))
    return {
      titlesSample: titles.slice(0, 5),
      titlesCount: titles.length,
      pass: titles.length > 0 && !looksLikeVideoId,
    }
  })()
  ```
  Expected: `pass=true` (at least one title rendered AND none of them is a raw 11-char videoId).
  If `titles.length === 0`: account has no saved analyses yet. Run TC #3 first to seed an analysis, then re-run this assertion.
- [ ] **2.14.6: TC #6 - User A in regular browser sees only own data.**
  Human-driven (requires two real user accounts; coordinate with user via the same pattern as step 2.13 if Chrome MCP cannot drive a second isolated session). In regular browser tab (User A): sidebar count `N`, dashboard Recent Analyses 5 rows owned by User A.
- [ ] **2.14.7: TC #7 - User B in incognito sees own data, no User A leakage.**
  Human-driven (same pattern as 2.14.6). In incognito (User B): sidebar count `M` (different), Recent Analyses owned by User B.
- [ ] **2.14.8: TC #8 - Skeleton on nav.** (Same JS as 1.10 step.)
- [ ] **2.14.9: TC #9 - Sidebar count badge.** (Same JS as step 2.12.)

- [ ] **2.15: Comment on TUB-28 + append to daily note.**

Same pattern as 1.12 and 1.13, with Step 2 SHA + Tier 1 result + INP delta if measurable from Vercel Analytics.

---

## Task 3: React `cache()` per-request dedup (Step 4 in spec; CONDITIONAL)

**Pre-trigger check** (do NOT skip):

- [ ] **3.0: Measure post-Step-2 INP on prod.**

Pull INP for `/dashboard` sidebar nav-item from Vercel Web Analytics for the past hour (or last 10 nav clicks if user count is low). If INP `<= 600 ms`: SKIP Task 3 entirely (mark task tree complete here, jump to "Wrap up" section). If INP `> 600 ms`: proceed with Task 3.

If Vercel Analytics doesn't have enough samples to measure: do one manual Chrome DevTools INP overlay measurement on prod (`mcp__claude-in-chrome__navigate` to /en/dashboard, open DevTools manually via user, observe INP overlay number on a real click). If still > 600 ms or measurement is impossible: proceed with Task 3 as a precaution.

**Files (6 total, all in single atomic commit per spec § 6):**
- Modify: `src/lib/supabase/server.ts`
- Modify: `src/lib/quota.ts`
- Modify: `src/app/[locale]/(app)/layout.tsx`
- Modify: `src/app/[locale]/(app)/dashboard/page.tsx`
- Modify: `src/app/[locale]/(app)/profile/page.tsx`
- Modify: `src/app/[locale]/(app)/history/page.tsx`

Bite-sized steps:

- [ ] **3.1: Branch off main.**

```bash
git checkout main
git pull --ff-only origin main
git checkout -b fix/tub-28-step-4-react-cache-dedup
```

- [ ] **3.2: Add `getCachedUser` to `src/lib/supabase/server.ts`.**

Read the current file. At the top of the imports section, after the existing `import "server-only"`, add:
```ts
import { cache } from "react"
```

At the END of the file (after `createServiceClient`), append the new export verbatim:

```ts

/**
 * Per-request memoized auth lookup. RSC-ONLY.
 *
 * Use ONLY from server components rendered inside the React render tree
 * (layouts, pages under `src/app/[locale]/(app)/`).
 *
 * Do NOT call from:
 *   - Route handlers (`app/api/.../route.ts`)
 *   - Server actions
 *   - Middleware (`middleware.ts`)
 *   - Webhook handlers
 *
 * `react.cache` only dedupes within a single RSC render pass. Calling from
 * non-RSC contexts gives no dedup and may surprise future readers; use the
 * direct `(await createClient()).auth.getUser()` pattern there instead.
 */
export const getCachedUser = cache(async () => {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  return user
})
```

- [ ] **3.3.pre: Pre-check existing mocks of `@/lib/quota`.**

Run:
```bash
grep -rn 'vi\.mock.*"@/lib/quota"\|from "@/lib/quota"' src --include='*.test.ts' --include='*.test.tsx'
```

Expected output (at time of plan authoring):
```
src/app/api/export/__tests__/route.test.ts:6:vi.mock("@/lib/quota", () => ({
src/app/api/export/__tests__/route.test.ts:7:  getUserQuota: vi.fn(),
src/app/api/export/__tests__/route.test.ts:13:import { getUserQuota } from "@/lib/quota"
```

This single test mocks the module via `vi.mock("@/lib/quota", () => ({ getUserQuota: vi.fn() }))` which replaces the module export with a fresh vi.fn(). The cache wrap is transparent to this style of mock because the mock entirely overrides the export. **No test change is required.** If the grep returns ANY OTHER mock pattern (e.g., `vi.spyOn(quotaModule, 'getUserQuota')`), pause and consult with the user before proceeding; spy-on-import-binding may need updating.

- [ ] **3.3a: Add `react.cache` import to `src/lib/quota.ts`.**

In `src/lib/quota.ts`, line 1-2 currently reads:
```ts
import "server-only"
import { createServiceClient } from "@/lib/supabase/server"
```

Change to:
```ts
import "server-only"
import { cache } from "react"
import { createServiceClient } from "@/lib/supabase/server"
```

- [ ] **3.3b: Replace `export async function getUserQuota` with cached export.**

The current declaration (lines 55-77 of `src/lib/quota.ts`) is:

```ts
export async function getUserQuota(userId: string): Promise<UserQuota> {
  const sb = createServiceClient()
  const [tier, usageRes] = await Promise.all([
    effectiveTier(userId),
    sb
      .from("usage")
      .select("comments_used")
      .eq("user_id", userId)
      .eq("month", currentMonth())
      .maybeSingle(),
  ])

  const cap = tier === "pro" ? PRO_MONTHLY_CAP : FREE_MONTHLY_CAP
  const used = usageRes.data?.comments_used ?? 0

  return {
    tier,
    cap,
    used,
    remaining: Math.max(0, cap - used),
    resetAt: nextMonthFirstIso(),
  }
}
```

Replace it verbatim with:

```ts
const _getUserQuota = async (userId: string): Promise<UserQuota> => {
  const sb = createServiceClient()
  const [tier, usageRes] = await Promise.all([
    effectiveTier(userId),
    sb
      .from("usage")
      .select("comments_used")
      .eq("user_id", userId)
      .eq("month", currentMonth())
      .maybeSingle(),
  ])

  const cap = tier === "pro" ? PRO_MONTHLY_CAP : FREE_MONTHLY_CAP
  const used = usageRes.data?.comments_used ?? 0

  return {
    tier,
    cap,
    used,
    remaining: Math.max(0, cap - used),
    resetAt: nextMonthFirstIso(),
  }
}

export const getUserQuota = cache(_getUserQuota)
```

- [ ] **3.3c: Diff-check the edit touched only the expected lines.**

Run: `git diff src/lib/quota.ts`

Expected change set:
- One added line at the imports: `import { cache } from "react"`
- The `export async function getUserQuota(...)` -> `const _getUserQuota = async (...)`  rename
- A new line appended after the function body: `export const getUserQuota = cache(_getUserQuota)`

Nothing else in the file should change. If you see whitespace-only diffs, formatting changes, or unrelated edits, undo them: `git checkout -- src/lib/quota.ts` then redo step 3.3a/b.

- [ ] **3.4: Run tests to confirm wrap didn't break anything.**

Run: `pnpm test`
Expected: all tests pass, including `src/app/api/export/__tests__/route.test.ts` (the one test that mocks `@/lib/quota`).

If the export route test fails, the mock pattern is incompatible. Recovery:
1. Open `src/app/api/export/__tests__/route.test.ts`.
2. Look at the `vi.mock("@/lib/quota", () => ({ getUserQuota: vi.fn() }))` block.
3. The mock entirely replaces the module, so the cache wrap should not interfere. If it still fails, the failure is a different bug; report the exact error message and pause.

If any OTHER test fails (not the export route test): the failure is unrelated to this wrap; capture the error and pause for analysis.

- [ ] **3.5: Modify `(app)/layout.tsx`.**

Read the current `src/app/[locale]/(app)/layout.tsx`. Add to imports:
```ts
import { getCachedUser } from "@/lib/supabase/server"
```

Remove the destructured `getUser` block (currently around lines 29-32):
```ts
const supabase = await createClient()
const {
  data: { user },
} = await supabase.auth.getUser()
```

Replace with:
```ts
const supabase = await createClient()
const user = await getCachedUser()
```

(Keep `supabase` because Task 2 made layout use `getAnalysesCount(supabase)` immediately below.)

The existing `if (!user)` redirect (currently line ~33) stays unchanged.

- [ ] **3.6: Modify `dashboard/page.tsx`.**

Add to imports:
```ts
import { getCachedUser } from "@/lib/supabase/server"
```

Find and replace (currently around lines 61-64):
```ts
const supabase = await createClient()
const {
  data: { user },
} = await supabase.auth.getUser()
```

with:
```ts
const supabase = await createClient()
const user = await getCachedUser()
```

(Keep `supabase` because line 72's `listAnalyses(supabase, null, 5)` uses it.)

Existing `if (!user) { redirect(...) }` block unchanged.

- [ ] **3.7: Modify `profile/page.tsx`.**

Add to imports:
```ts
import { getCachedUser } from "@/lib/supabase/server"
```

Find and replace (currently around lines 40-43):
```ts
const supabase = await createClient()
const {
  data: { user },
} = await supabase.auth.getUser()
```

with:
```ts
const supabase = await createClient()
const user = await getCachedUser()
```

(Keep `supabase` because line ~52's `supabase.from("subscriptions").select(...)` uses it.)

Existing `if (!user) { redirect(...) }` block unchanged.

- [ ] **3.8: Modify `history/page.tsx`.**

Add to imports:
```ts
import { getCachedUser } from "@/lib/supabase/server"
```

Find and replace (currently around lines 36-39):
```ts
const supabase = await createClient()
const {
  data: { user },
} = await supabase.auth.getUser()
```

with:
```ts
const supabase = await createClient()
const user = await getCachedUser()
```

(Keep `supabase` because line ~47's `listAnalyses(supabase, null, 100)` uses it.)

Existing `if (!user) { redirect(...) }` block unchanged.

- [ ] **3.9: Lint + type-check + build all together.**

Run: `pnpm lint`
Expected: no errors.

Run: `pnpm build`
Expected: success. If TS errors mention `getCachedUser` not exported: re-check Step 3.2 syntax.

If the build fails because some test file imports `supabase.auth.getUser()` directly: those tests don't exist for these pages (verified: only existing auth-touching tests are in `src/lib/__tests__/`). If somehow surfaces, fix in the same commit.

- [ ] **3.10: Audit for em/en-dash across all 6 modified files.**

Run:
```bash
grep -cP '[\x{2014}\x{2013}]' \
  src/lib/supabase/server.ts \
  src/lib/quota.ts \
  src/app/\[locale\]/\(app\)/layout.tsx \
  src/app/\[locale\]/\(app\)/dashboard/page.tsx \
  src/app/\[locale\]/\(app\)/profile/page.tsx \
  src/app/\[locale\]/\(app\)/history/page.tsx
```
Expected: `0` for each file.

- [ ] **3.11: Single atomic commit.**

```bash
git add \
  src/lib/supabase/server.ts \
  src/lib/quota.ts \
  src/app/\[locale\]/\(app\)/layout.tsx \
  src/app/\[locale\]/\(app\)/dashboard/page.tsx \
  src/app/\[locale\]/\(app\)/profile/page.tsx \
  src/app/\[locale\]/\(app\)/history/page.tsx
git commit -m "$(cat <<'EOF'
perf(tub-28): step 4 react.cache dedup for getUser + getUserQuota

Wrap supabase.auth.getUser() (via getCachedUser export co-located with
createClient in lib/supabase/server.ts) and getUserQuota in react.cache so
layout + pages share the same auth + quota result inside a single RSC
render pass. Saves ~300-500 ms per intra-(app) navigation by eliminating
3-4x duplicate fetches. Per-request scope, no cross-user leak.

getCachedUser carries a JSDoc RSC-only restriction: callers must be inside
the React render tree (layouts, pages). Route handlers, server actions,
middleware, and webhook handlers should keep using the direct
(await createClient()).auth.getUser() pattern.

Single atomic commit covers 6 files; partial state would break the build.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **3.12: Push and open PR.**

```bash
git push -u origin fix/tub-28-step-4-react-cache-dedup
gh pr create --title "perf(tub-28): step 4 react.cache dedup for getUser + getUserQuota" --body "$(cat <<'EOF'
## Summary
- Wraps supabase.auth.getUser() in getCachedUser (lib/supabase/server.ts) and getUserQuota in lib/quota.ts via react.cache.
- Layout + pages share results within one RSC render pass; saves ~300-500ms of duplicate fetches per intra-(app) navigation.
- getCachedUser is RSC-only (JSDoc warning included).
- All 6 file changes in one atomic commit to avoid partial-build state.

## Test plan
- [ ] pnpm test passes
- [ ] Preview /dashboard, /history, /profile all load without auth errors
- [ ] User A and User B simultaneous (concurrent requests) see only their own quota
- [ ] Vercel logs show no PGRST301 RLS denials post-merge
- [ ] INP measurement under 600ms (target)

Relates to: TUB-28
EOF
)"
```

- [ ] **3.13: Verify preview, merge, wait prod READY.**

Same pattern as Task 1 / 2.

- [ ] **3.14: Verify on prod via Chrome MCP.**

Sign in to `https://tubemine.tech/en/dashboard`. Run:

```js
(async () => {
  // Assert basic page works (auth flowed through getCachedUser correctly).
  return {
    hasMain: !!document.querySelector('main.main'),
    hasUserAvatar: !!document.querySelector('.topbar-user .avatar'),
    hasUsageCard: !!document.querySelector('.usage-card'),
  }
})()
```

Expected: all three `true`.

Then trigger a sidebar nav click (`/dashboard` -> `/profile` -> `/history`) and observe INP via DevTools INP overlay (manually if not automatable). Record the number.

- [ ] **3.15: Multi-user concurrent isolation check.**

Open TWO simultaneous tabs (one regular, one incognito) logged in as different users. Hard-reload `/dashboard` in both within 5 seconds of each other. Confirm each user's:
- Usage card shows THEIR quota (different `used / cap` numbers).
- Sidebar count shows THEIR count.
- Topbar tier badge matches THEIR tier.

If User A sees User B's quota or vice versa: **CRITICAL** - rollback immediately, file a P0 issue, do NOT proceed.

- [ ] **3.16: Tier 1 verify (all 9 TCs).**

Re-run all 9 sub-checks from step 2.14 (2.14.1 through 2.14.9). The auth-touching TCs (#6, #7) are especially important here because Step 4 changed how `getUser()` and `getUserQuota` are reached. If any TC fails: invoke "Rollback procedure" section.

- [ ] **3.16.1: TC #1.** Same JS as 2.14.1.
- [ ] **3.16.2: TC #2.** Same JS as 2.14.2.
- [ ] **3.16.3a: TC #3 - run fresh analysis.** Same as 2.14.3a.
- [ ] **3.16.3b: TC #3 - obtain UUID.** Same JS as 2.14.3b.
- [ ] **3.16.3c: TC #3 - query DB + assert non-null.** Same SQL as 2.14.3c.
- [ ] **3.16.4: TC #4.** Same JS as 2.14.4.
- [ ] **3.16.5: TC #5.** Same JS as 2.14.5.
- [ ] **3.16.6: TC #6.** User A isolation, human-driven (see 2.14.6 caveat).
- [ ] **3.16.7: TC #7.** User B incognito isolation, human-driven (see 2.14.7 caveat).
- [ ] **3.16.8: TC #8.** Same as 2.14.8.
- [ ] **3.16.9: TC #9.** Same as 2.14.9.

- [ ] **3.17: Comment on TUB-28 + append to daily note.**

Same pattern. Include measured INP number.

---

## Wrap up (always run, after Task 1+2 or 1+2+3)

- [ ] **W.1: 24-hour prod observation window.**

After the LAST task's prod deploy is READY: wait 24 hours, monitor Vercel logs for:
- Any new `PGRST301` (RLS violation) errors.
- Any new 5xx error rate spike on `/en/dashboard`, `/en/profile`, `/en/history`.
- Any user-reported quota anomalies (none expected).

If anything anomalous appears: roll back to the last known-good deploy via Vercel Instant Rollback (`vercel rollback`).

- [ ] **W.2: Move TUB-28 to Done.**

After 24 hours stable, use `mcp__claude_ai_Linear__save_issue` to move TUB-28 to status `Done`. Final comment via `save_comment`:

```
TUB-28 closed.

Shipped (in order):
- Step 1 (loading.tsx): <SHA>
- Step 2 (getAnalysesCount): <SHA>
- Step 4 (react.cache dedup): <SHA or "skipped, INP under 600 ms after Step 2">

Final INP: <number> ms (was 2097 ms baseline).

Step 3 (caching via 'use cache' + Edge Config kill switch) NOT attempted in this session; deferred to TUB-29.

24-hour observation clean. No new RLS errors, no 5xx spike.
```

- [ ] **W.3: Final hand-off append to `~/vault/daily/2026-05-21.md`.**

Use `mcp__obsidian__write_note` with mode `append`:

```
## Session Summary (HH:MM) - TUB-28 INP perf refactor shipped

- **Goal:** Reduce /dashboard sidebar nav-item INP from 2097ms to < 600ms via 3 staged commits (steps 1, 2, optional 4).
- **Progress:**
  - Step 1 (loading.tsx): <SHA>
  - Step 2 (getAnalysesCount swap): <SHA>
  - Step 4 (react.cache dedup): <SHA or "skipped">
- **Final INP:** <number> ms.
- **Linear:** TUB-28 moved to Done.
- **Out of scope (preserved):** Step 3 caching deferred to TUB-29. Branded error.tsx separate issue.
- **Confirmed:** Step 3 (caching directives) NOT attempted in this session.
- **Next:** TUB-29 if INP not yet < 300 ms target.

---
*Session ended at HH:MM*
```

---

## Self-review checklist (the planner runs this before handing off)

- [x] Spec coverage: Step 1 -> Task 1; Step 2 -> Task 2; Step 4 -> Task 3 (conditional); Linear updates -> PF.1, 1.12, 2.15, 3.17, W.2; daily-note hand-off -> 1.13, 2.15, 3.17, W.3; multi-user isolation verified in 2.13 + 3.15. Tier 1 9-TC subset run in 1.11 (subset), 2.14 (full), 3.16 (full). All spec § 7 acceptance bullets are exercised. Branded `error.tsx` out-of-scope (per § 5) - no task. Step 3 caching deferred (per § 5) - no task.
- [x] Placeholder scan: no TBD / TODO / FIXME / "add appropriate error handling" / "similar to Task N". Every code block is complete and copy-pasteable.
- [x] Type consistency: `getAnalysesCount(sb: SupabaseClient): Promise<number>` used identically in tests and layout. `getCachedUser` used identically across 4 page files. `getUserQuota(userId: string): Promise<UserQuota>` signature preserved (only inner `_getUserQuota` introduced, still returns `UserQuota`).
- [x] Bite-sized: each step is one action (write code, run command, commit, etc.); no step combines multiple concerns.
- [x] Exact paths: every file path is absolute or relative-to-root, exact extension. No `[locale]` or `(app)` segments lost.
- [x] Exact commands: every shell command has expected output noted. Test runner is `pnpm test`. Build is `pnpm build`. Lint is `pnpm lint`.
- [x] No em/en-dash: spot-grep on the plan itself before commit.
- [x] Atomic-commit requirement for Task 3 (6 files): enforced in step 3.11.
