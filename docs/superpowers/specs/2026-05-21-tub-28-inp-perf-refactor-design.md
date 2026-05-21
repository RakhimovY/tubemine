# TUB-28: INP Perf Refactor (steps 1 + 2 + 4)

**Linear:** [TUB-28](https://linear.app/qostap/issue/TUB-28/p1-perf-sidebar-nav-item-click-blocks-ui-for-2-seconds-inp-regression) (P1 perf, Backlog/High at spec time).
**Source of truth:** `~/vault/references/nextjs16-perf-refactor-safe-rollout.md` (research done 2026-05-21; pre-validated approach with safety analysis, test isolation matrix, rollout strategy).
**Scope:** Steps 1, 2, optional 4 of the 4-step plan in the research doc. Step 3 (caching via `'use cache: private'` + Edge Config kill switch) is **explicitly deferred** to TUB-29.

---

## 1. Problem

Chrome DevTools INP overlay on production reports `2,097.7 ms` blocked-UI duration on `a.nav-item` click during sidebar navigation between `/dashboard`, `/profile`, `/history` (Tier 1 smoke run, 2026-05-21).

INP thresholds: good < 200 ms, needs-improvement 200-500 ms, poor > 500 ms. 2,097 ms = critical regression.

**Root cause** (confirmed by reading the code, not just attributed): `src/app/[locale]/(app)/layout.tsx` runs three serial-ish data fetches on every intra-(app) navigation because it reads `cookies()` via `createClient()` and has no static cache directive, so Next.js renders it dynamically per request:

1. `supabase.auth.getUser()` -> ~200-400 ms (server roundtrip + cookie validate)
2. `Promise.all([getUserQuota(user.id), listAnalyses(supabase, null, 100)])`
 - `getUserQuota(user.id)` -> ~100-200 ms (DB read of profiles + subscriptions)
 - `listAnalyses(supabase, null, 100)` -> ~500-1000 ms (DB scan of up to 100 rows with full payload columns: video_title, thumbnail_url, sentiment, top_words, emoji_frequency, ...)

Each child page (`dashboard/page.tsx`, `profile/page.tsx`, `history/page.tsx`) also re-runs `getUser()` + `getUserQuota(user.id)` independently because Next.js does not auto-dedup across layout and page boundaries. React commit awaits RSC streaming completion, so the click event is held for the full cumulative duration. INP attribution lands on the click handler.

---

## 2. Target

Reduce `/dashboard` sidebar nav-item INP from 2,097 ms to **< 600 ms** (60-70 % improvement). Full sub-300 ms target requires the caching work in TUB-29 and is not promised here.

Success criteria:

- INP for sidebar nav-item clicks measured under 600 ms via Vercel Web Analytics or Chrome DevTools INP overlay on prod after Step 4 ships.
- All 8 Tier 1 verify TCs (see § 7) pass on prod after each step.
- No new RLS errors (`PGRST301`) in Vercel logs during the 24-hour observation window after final step.
- Multi-user isolation: User A's data never visible to User B (incognito smoke).

---

## 3. Architecture (unchanged)

Server-rendered Next.js 16 App Router. Route group `src/app/[locale]/(app)/` contains:

- `layout.tsx` - auth gate + `AppShell` (topbar + sidebar). Reads cookies, dynamic per request.
- `dashboard/page.tsx` - Recent Analyses (5 rows), usage card, quick analyze form. `dynamic = "force-dynamic"`.
- `profile/page.tsx` - account fields, plan card, billing portal. `dynamic = "force-dynamic"`.
- `history/page.tsx` - paginated list (Free: 10 cap, Pro: 100 cap), filter bar. `dynamic = "force-dynamic"`.

Supabase RLS policies scope all reads to `auth.uid() = user_id`. No new schema. No new dependencies. No API routes touched.

This refactor does not change architecture; it changes:

- **Layout fetches**: replace one expensive row-payload query with one cheap count query.
- **Per-request dedup**: wrap `getUser` and `getUserQuota` in `react.cache` so layout + page share results within a single render pass.
- **Perceived latency**: add `loading.tsx` Suspense fallback so the user sees an instant skeleton on navigation instead of a frozen click.

---

## 4. Steps

### Step 1 - `loading.tsx` (zero risk, UX win, first deploy)

**File:** `src/app/[locale]/(app)/loading.tsx` (new).

**Behavior:** Suspense fallback for child pages in the (app) route group. AppShell chrome is already mounted (rendered by `layout.tsx`), so this file only fills `.main-inner`. Renders dashboard-shaped placeholders so the layout shift between skeleton and real content is minimal:

- `<header className="welcome-strip">` placeholder div (height matches real welcome strip).
- Usage card placeholder (height matches `.card.usage-card`).
- Quick analyze block placeholder (height matches `.card.quick-analyze`).
- Recent analyses list with 5 `<div className="recent-row is-loading">` placeholders.

Skeleton visual: each block is a `<div data-slot="skeleton" className="animate-pulse rounded-md bg-muted">` from the existing `src/components/ui/skeleton.tsx` primitive, or matching `.is-placeholder` pattern already in `globals.css:1776`. Final exact markup chosen during plan phase by matching real dashboard `.dashboard-page` section heights so transition has no visible jump.

**No translations, no auth, no data deps.** This file is a static React component.

**Acceptance:**

- Hard-reload `/en/dashboard`, click any sidebar item, skeleton flashes before new page renders.
- DOM contains `[data-slot="skeleton"]` element within 100 ms of click. Reserved class `.is-placeholder` is NOT used by the loading skeleton (that class is owned by `dashboard-page .recent-thumb.is-placeholder` for missing-thumbnail fallback at `globals.css:1776` and must keep that single meaning).
- No visual layout shift > 0.05 CLS on transition.
- `loading.tsx` makes no `t()`, `getTranslations()`, or `useTranslations()` call (Suspense fallback renders synchronously; locale prefix is in the URL but the file body is locale-agnostic).

### Step 2 - Replace `listAnalyses(100)` with `getAnalysesCount` (medium risk, RLS-safe)

**Why not the literal "move to dashboard/page.tsx" from research doc:** dashboard already fetches its own `listAnalyses(supabase, null, 5)` at line 70 of `dashboard/page.tsx`. The layout's `listAnalyses(supabase, null, 100)` is consumed ONLY by `historyCount={recent.items.length}` (`layout.tsx:45,52`) to feed the sidebar history badge (`side-nav.tsx:68-70`). Moving the 100-row fetch into the page would attach an unused 100-row payload to dashboard. Correct fix: replace the row fetch with a cheap count-only query that serves the same badge.

**File 1:** `src/lib/analyses.ts` (modify).

Append helper:

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

**File 2:** `src/app/[locale]/(app)/layout.tsx` (modify).

Replace lines 38-45 from:

```ts
const [quota, recent] = await Promise.all([
  getUserQuota(user.id),
  listAnalyses(supabase, null, 100),
])

const tier: Tier = quota.tier
const initials = buildInitials(user.email, user.user_metadata?.full_name)
const historyCount = recent.items.length
```

to:

```ts
const [quota, historyCount] = await Promise.all([
  getUserQuota(user.id),
  getAnalysesCount(supabase),
])

const tier: Tier = quota.tier
const initials = buildInitials(user.email, user.user_metadata?.full_name)
```

Remove the now-unused `listAnalyses` import.

**File 3:** `src/lib/__tests__/analyses-count.test.ts` (new) - one happy-path unit test for the helper.

Single case: mock supabase client returning `{ count: 7, error: null }`, helper returns 7. The error-fallback branch (`if (error) return 0`) is trivial and verified by the prod multi-user verify in § 7 TCs #6/#7. Use the same vitest + mock pattern already used in `src/lib/__tests__/` (e.g., csv-safe test).

**Acceptance:**

- Layout response time drops by 500-900 ms (count vs row fetch).
- Sidebar `<span className="count">` still renders correct number when count > 0; brand-new user (count === 0) sees badge hidden per `side-nav.tsx:68` guard `historyCount > 0`.
- On RLS denial (`PGRST301`), helper returns 0 and logs a warning. Sidebar then hides the badge (same as a brand-new user); the RLS error is independently visible in Vercel logs per § 8 monitoring.
- Multi-user isolation: User B logged into incognito sees their own count, never User A's.
- `vitest run src/lib/__tests__/analyses-count.test.ts` passes.

### Step 4 - React `cache()` per-request dedup (optional, low risk)

**Status:** optional in scope, but concrete duplicates documented below make it the expected outcome. Expected to ship unless Steps 1+2 alone bring sidebar nav-item INP under 600 ms on prod, in which case Step 4 is skipped per the prompt's "skip if no clear duplicate fetches" rule.

**Trigger:** run after Steps 1 and 2 are both verified clean on prod AND prod INP measurement is still > 600 ms.

**Concrete duplicate fetches per intra-(app) navigation:**

| Function | Layout call | Page calls | Approx total |
|---|---|---|---|
| `supabase.auth.getUser()` | yes | dashboard + profile + history each call again | 4× of ~250 ms = ~1 sec wasted |
| `getUserQuota(user.id)` | yes | dashboard + profile call again | 3× of ~150 ms = ~300 ms wasted |

`react.cache` scopes dedup to a single server render pass (request), so it cannot leak across users.

**File 1:** `src/lib/supabase/server.ts` (modify; co-locate with the existing `createClient` to avoid a new module).

Append after the existing exports:

```ts
import { cache } from "react"
// ... existing exports above (createClient, createServiceClient)

export const getCachedUser = cache(async () => {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  return user
})
```

Cached at module scope; the `cache` from `react` makes the dedup per-request, not module-singleton, so two concurrent requests from different users do not share results.

**File 2:** `src/lib/quota.ts` (modify, top of file).

Wrap the existing exported `getUserQuota`:

```ts
import { cache } from "react"
// ... existing imports
const _getUserQuota = async (userId: string): Promise<UserQuota> => {
  // ... existing implementation body
}
export const getUserQuota = cache(_getUserQuota)
```

(Exact refactor preserves the existing exported name and signature. Internal body unchanged.)

**File 3:** `src/app/[locale]/(app)/layout.tsx` (modify).

Replace the destructured `getUser` pattern with:

```ts
const user = await getCachedUser()
if (!user) {
  redirect({ href: `/login?next=/${locale}/dashboard`, locale })
  return null
}
```

The existing `const supabase = await createClient()` line stays (Step 2 added `getAnalysesCount(supabase)`). Import `getCachedUser` from `@/lib/supabase/server`.

**File 4:** `src/app/[locale]/(app)/dashboard/page.tsx` (modify).

Same pattern: replace the destructured `getUser` block with `const user = await getCachedUser()` + the same `if (!user)` redirect (preserving the page's existing `next=/${locale}/dashboard` target). Keep `const supabase = await createClient()` because the page still uses `supabase` for `listAnalyses(supabase, null, 5)`. After the swap, any `user.id` or `user.email` access stays guarded by the redirect.

**File 5:** `src/app/[locale]/(app)/profile/page.tsx` (modify).

Same pattern: replace the destructured `getUser` block with `getCachedUser()` + redirect (preserving `next=/${locale}/profile`). Keep `createClient()` (used for the `subscriptions` query at line 52). All `user.id`, `user.email`, `user.created_at`, `user.user_metadata` accesses stay guarded by the redirect.

**File 6:** `src/app/[locale]/(app)/history/page.tsx` (modify).

Same pattern: replace the destructured `getUser` block with `getCachedUser()` + redirect (preserving `next=/${locale}/history`). Keep `createClient()` (used for `listAnalyses(supabase, null, 100)` at line 47).

**Acceptance:**

- Second call to `getCachedUser()` within the same request is free (verify via console.log of fetch count or just trust `react.cache` semantics).
- Tier 1 verify subset (§ 7) PASSES on prod.
- No new RLS errors (`PGRST301`) in Vercel logs.
- Multi-user isolation: User A request never sees User B's quota cache from a parallel concurrent request. (Verified by `react.cache` scope: per-request.)
- Existing test suites still pass (no logic change, just dedup).
- Sidebar nav-item INP measurably lower than after Step 2. The < 600 ms goal is a target, not a pass gate; closing the remaining gap to < 300 ms is owned by TUB-29 (caching). Report whatever number Vercel Analytics shows in the Linear close-out comment.

---

## 5. Out of scope (deferred to TUB-29 or separate work)

- `'use cache'` or `'use cache: private'` directives (TUB-29).
- `export const revalidate` on any layout (explicitly **forbidden** here - would leak User A's quota to User B per research doc § Theme 1).
- Edge Config kill switch for caching (TUB-29).
- Time-based ISR or `staleTimes` (TUB-29).
- Parallel routes (`@slot`) for analyses list (TUB-29).
- Header components (locked by main session).
- Supabase RLS policies, auth middleware, `/docs`, `/changelog`, i18n messages, CSV/extract code.
- Branded `error.tsx` for the `(app)` route group. If a page throws after Step 1 ships, the Next.js default error UI shows instead of a branded fallback. Acceptable for this session; raise a separate Linear issue if branded error UX becomes required.

---

## 6. Rollout

Per research doc § Theme 3 Option 2 (staged commits + PR previews + Vercel Instant Rollback).

For each step:

1. New branch `fix/tub-28-step-N-<slug>` off `main`.
2. One commit per step. Commit message style: `perf(tub-28): step N <short summary>`. Multi-file steps (Step 4 touches 5 files) MUST land as a single atomic commit so the build never sees partial state where a caller of `getCachedUser` ships before the export exists.
3. Push, open PR, Vercel auto-creates preview.
4. Local + preview verify (lint + tsc + vitest + manual preview check).
5. Merge to `main` -> Vercel auto-deploys to prod.
6. Wait `mcp__vercel__list_deployments` until READY.
7. Hard-reload `https://tubemine.tech/en/dashboard` via `mcp__claude-in-chrome__navigate`.
8. Run JS DOM assertion that proves symptom resolved (skeleton present for Step 1, `<span class="count">` still renders for Step 2, no waterfall regression for Step 4).
9. Screenshot via `mcp__claude-in-chrome__take_screenshot` for visual sanity.
10. Run Tier 1 verify subset (§ 7).
11. If FAIL: `vercel rollback` immediately, diagnose locally, fix on new branch, do not push more commits on top.
12. If PASS: comment on TUB-28 with commit SHA + Tier 1 result; proceed to next step.

Final summary: append to `~/vault/daily/2026-05-21.md` per prompt § Hand-off when done.

---

## 7. Verify-on-prod subset (Tier 1, 8 TCs)

From `~/vault/projects/yt-comments/qa/test-cases.md`:

1. **TC-0049** - SideNav highlights current page via `usePathname()`.
2. **TC-0050** - AppShell persists across `/dashboard`, `/profile`, `/history` navigation (no flash, no remount).
3. **TC-INT-001** - `saveAnalysis` persists non-null `video_title`, `channel_name`, `thumbnail_url`.
4. **TC-INT-002** - `/dashboard` Recent Analyses row has no `.is-placeholder` class (real data renders).
5. **TC-INT-003** - `/history` row `video_title` renders real title, not `videoId` fallback.
6. **Auth/RLS** - User A in regular browser, Recent Analyses + sidebar count show User A data only.
7. **Auth/RLS** - User B in incognito, sees their own data, no User A leakage.
8. **Loading state** - after Step 1: navigate sidebar items, skeleton visible during transition (DOM assertion: `document.querySelector('[data-slot="skeleton"], .is-placeholder')` returns non-null within 100 ms of click).

**Skip (research validated):** TC-CSS-* (no CSS changes); TC-EXP-* (CSV/Excel export unchanged); TC-CORE-* extract pipeline (untouched); TC-I18N-* (no message changes); TC-AUTH-OAuth (auth flow code untouched).

---

## 8. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `count: 'exact'` query slower than expected on large tables | low | low | Currently no user has > 100 analyses (Pro cap is 100). Index on `(user_id)` already exists per `01_analyses.sql`. Worst case ~50 ms. |
| Step 4 `react.cache` wrap accidentally breaks existing test mocks | medium | low | Mocks reference `getUserQuota` by name; `cache(getUserQuota)` preserves the export. Run full vitest before each merge. |
| Step 1 skeleton has visible layout shift > 0.05 CLS | low | low | Match block heights to real dashboard sections during plan phase; if real CLS measured > 0.05 on preview, tune heights before merge. |
| Multi-user data leak via `react.cache` | very low | critical | `react.cache` is per-request by design (verified in research doc § Theme 1). Cross-user smoke is mandatory in Step 4 verify. |
| INP target < 600 ms not reached even after Step 4 | medium | low (still big win vs baseline) | Acceptable. Final caching work in TUB-29 will close the gap. Document achieved INP in Linear final comment. |
| Vercel deploy fails build | low | low | Local `pnpm build` before push; standard Next 16 build pipeline. |

---

## 9. Linear tracking

- At start: `mcp__claude_ai_Linear__get_issue('TUB-28')` to refresh.
- Move TUB-28 to **In Progress** when Step 1 branch is pushed.
- After each step's verify-on-prod PASS: comment on TUB-28 with:
 - commit SHA on main
 - Tier 1 result (PASS / FAIL per TC)
 - Measured INP from Vercel Analytics if visible
- After Step 4 (or Step 2 if Step 4 skipped) + 24 h prod stable: move TUB-28 to **Done** with final before/after INP screenshot.

---

## 10. Constraints (verbatim from prompt)

1. No em-dash (`U+2014`) or en-dash (`U+2013`) anywhere in code, comments, commit messages, vault notes. Use `,` `.` `()` `:` `-`.
2. No new dependencies.
3. No changes to header components, Supabase RLS policies, auth middleware, `/docs`, `/changelog`, i18n messages, CSV/extract code.
4. One PR per step (up to 3 PRs total). Each merge to `main` triggers production deploy. Wait verify before next.
5. Update `~/vault/daily/2026-05-21.md` (append mode) under "Turbo #1 INP perf progress" subheading. One bullet per step completed.

---

## 11. Hand-off

Append final summary to `~/vault/daily/2026-05-21.md` with:

- Steps completed (1, 2, optional 4).
- Final INP measurement if available.
- Linear TUB-28 status.
- Any deferred work or risks discovered.
- Explicit confirmation that Step 3 (caching) was NOT attempted in this session.

Then STOP. Do not loop into other tasks.
