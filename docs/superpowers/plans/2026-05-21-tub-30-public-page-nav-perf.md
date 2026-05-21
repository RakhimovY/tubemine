# TUB-30 Public-Page Nav Perf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `supabase.auth.getUser()` from `SiteHeader`'s server render so public routes (`/pricing`, `/docs`, `/changelog`, `/privacy`, `/terms`, `/login`) become static, Next.js Link prefetch can serve full RSC payloads, and warm-navigation TTFB drops from ~346ms to <100ms.

**Architecture:** Auth state moves entirely to the client island. A new tiny `auth-hint` localStorage helper stores last-known state, the `SiteHeaderClient` reads the hint synchronously during `useState` initialization (avoiding first-paint flicker for returning signed-in users), and `onAuthStateChange` (with the `INITIAL_SESSION` event in `@supabase/ssr` v2) is the single source of truth for ongoing state. `suppressHydrationWarning` is scoped to the two auth-conditional regions (desktop nav-actions, mobile drawer) to silence the intentional SSR/client divergence.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, `@supabase/ssr` browser client, Vitest (jsdom for `localStorage`), styled CSS via `src/app/globals.css`.

**Spec:** `docs/superpowers/specs/2026-05-21-tub-30-public-page-nav-perf-design.md` (commit `38d98dc`).

---

## Implementation-time decision: login-client.tsx hint write

The spec gave two paths for the OAuth post-login hint write, with the choice deferred to inspection. Inspection results:

- `src/app/[locale]/login/login-client.tsx` uses Google OAuth only via `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "/auth/callback" } })`. The call only triggers a redirect to Google; no session exists at this point in client code.
- The session is established by `src/app/auth/callback/route.ts`, a server-side route handler (Node runtime). It calls `supabase.auth.exchangeCodeForSession(code)` and then `NextResponse.redirect(...)`. Server-side code cannot write `localStorage`.
- After the server callback, the user lands on `/dashboard` which renders `AppShell` (out of scope per brief, TUB-28 territory). `SiteHeaderClient` does NOT mount on `(app)/` routes.

Conclusion: there is no client-side success branch in the OAuth flow where a session is known to exist. Writing the hint on the OAuth-button click would be optimistic (no session yet, the user might cancel on Google), which the spec round-3 fix explicitly forbids. The plan therefore DROPS the `login-client.tsx` edit and accepts the one-time post-OAuth public-page flicker (already documented as the "first-ever visit" walkthrough in the spec). All other behavior remains as specified.

File touchpoints for this plan:

- NEW: `src/lib/auth-hint.ts` + `src/lib/__tests__/auth-hint.test.ts`
- MODIFY: `src/components/site-header.tsx`
- MODIFY: `src/components/site-header-client.tsx`
- MODIFY: `src/app/globals.css`

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `src/lib/auth-hint.ts` | Three exported functions (`getAuthHint`, `setAuthHint`, `clearAuthHint`) wrapping `localStorage` with SSR + private-browsing safety. Exports `AuthState` type alias used across client. ~35 lines. |
| `src/lib/__tests__/auth-hint.test.ts` | Vitest jsdom-pragma tests covering: missing window, missing localStorage, normal read/write, invalid value rejection, clear. |
| `src/components/site-header.tsx` | Server component. After this PR: imports `getTranslations` only, renders `<SiteHeaderClient labels=... repoUrl=... />`. No auth call, no `cookies()` access. |
| `src/components/site-header-client.tsx` | Client island. After this PR: owns `authState` + `initials` state, reads hint synchronously, subscribes to `onAuthStateChange` for ongoing source of truth, applies `suppressHydrationWarning` to two auth-conditional regions. |
| `src/app/globals.css` | After this PR: contains a `@media (min-width: 1024px) .nav-actions { min-width: <measured>px }` rule to prevent CLS on auth-state swap. |

---

## Task 1: Create `src/lib/auth-hint.ts` with tests

**Files:**
- Create: `src/lib/auth-hint.ts`
- Create: `src/lib/__tests__/auth-hint.test.ts`

### Task 1 steps

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/auth-hint.test.ts`:

```ts
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clearAuthHint,
  getAuthHint,
  setAuthHint,
  type AuthState,
} from "@/lib/auth-hint"

const KEY = "tubemine:auth-hint"

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe("auth-hint", () => {
  it("returns null when nothing stored", () => {
    expect(getAuthHint()).toBeNull()
  })

  it("round-trips signed-in", () => {
    setAuthHint("signed-in")
    expect(window.localStorage.getItem(KEY)).toBe("signed-in")
    expect(getAuthHint()).toBe("signed-in")
  })

  it("round-trips anonymous", () => {
    setAuthHint("anonymous")
    expect(getAuthHint()).toBe("anonymous")
  })

  it("returns null for unknown stored value", () => {
    window.localStorage.setItem(KEY, "garbage")
    expect(getAuthHint()).toBeNull()
  })

  it("clears the hint", () => {
    setAuthHint("signed-in")
    clearAuthHint()
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(getAuthHint()).toBeNull()
  })

  it("survives a throwing localStorage getter (private browsing)", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockImplementation(() => {
      throw new Error("quota / blocked")
    })
    expect(getAuthHint()).toBeNull()
  })

  it("survives a throwing localStorage setter without throwing", () => {
    vi.spyOn(window.localStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded")
    })
    expect(() => setAuthHint("signed-in")).not.toThrow()
  })

  it("survives a throwing localStorage remover without throwing", () => {
    vi.spyOn(window.localStorage.__proto__, "removeItem").mockImplementation(
      () => {
        throw new Error("blocked")
      },
    )
    expect(() => clearAuthHint()).not.toThrow()
  })

  it("AuthState type accepts the two valid states only (compile-time check)", () => {
    const a: AuthState = "signed-in"
    const b: AuthState = "anonymous"
    // @ts-expect-error - invalid state
    const c: AuthState = "other"
    expect(a).toBe("signed-in")
    expect(b).toBe("anonymous")
    expect(c).toBe("other")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm vitest run src/lib/__tests__/auth-hint.test.ts
```

Expected: FAIL with module-not-found or import errors (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/auth-hint.ts`:

```ts
const KEY = "tubemine:auth-hint"

export type AuthState = "signed-in" | "anonymous"
type AuthHint = AuthState

export function getAuthHint(): AuthHint | null {
  if (typeof window === "undefined") return null
  try {
    const v = window.localStorage.getItem(KEY)
    return v === "signed-in" || v === "anonymous" ? v : null
  } catch {
    return null
  }
}

export function setAuthHint(state: AuthState): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, state)
  } catch {
    // ignore (private browsing, quota exceeded, etc.)
  }
}

export function clearAuthHint(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm vitest run src/lib/__tests__/auth-hint.test.ts
```

Expected: PASS, all 9 tests green.

- [ ] **Step 5: Type-check**

Run:
```bash
pnpm tsc --noEmit
```

Expected: clean (no errors). The `@ts-expect-error` directive in the last test is intentional and must NOT produce a TS error (because it correctly suppresses one).

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth-hint.ts src/lib/__tests__/auth-hint.test.ts
git commit -m "$(cat <<'EOF'
feat(tub-30): step 1 auth-hint localStorage helper for SiteHeader

Adds tiny module wrapping localStorage with SSR + private-browsing
safety. Exports getAuthHint / setAuthHint / clearAuthHint + AuthState
type. Used by SiteHeaderClient (next step) to skip first-paint flicker
for returning signed-in users.

9 unit tests cover: empty state, round-trip both states, invalid value
rejection, clear, three localStorage-throws fallbacks, and the
AuthState type narrowing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Strip auth call from server and wire client island to listener

This task is a single atomic commit covering both `site-header.tsx` (server) and `site-header-client.tsx` (client), because removing the prop on one side and not the other temporarily breaks TypeScript. The spec's architecture demands they move together.

**Files:**
- Modify: `src/components/site-header.tsx` (delete `resolveAuthState`, delete `createClient` import, drop auth props from `<SiteHeaderClient>`)
- Modify: `src/components/site-header-client.tsx` (drop auth props, add `useState` with hint, add `useEffect` with listener, add `computeInitials`, add `suppressHydrationWarning` on conditional regions)

### Task 2 steps

- [ ] **Step 1: Replace `src/components/site-header.tsx` entirely**

The current file is 80 lines. Overwrite with the slimmed-down version:

```tsx
import { getTranslations } from "next-intl/server"
import { SiteHeaderClient } from "@/components/site-header-client"

const REPO_URL = "https://github.com/RakhimovY/tubemine"

/*
  TUB-1 Visual Port: SiteHeader rebuilt from design HTML's <nav> block.
  Server component fetches locale copy only. Auth state lives in the
  client island (SiteHeaderClient) per TUB-30, so this file no longer
  reads cookies() and the routes that embed it stay statically
  prerenderable.
*/

export async function SiteHeader() {
  const t = await getTranslations("landing")

  return (
    <SiteHeaderClient
      repoUrl={REPO_URL}
      labels={{
        brand: t("header.brand"),
        features: t("header.nav_features"),
        pricing: t("header.nav_pricing"),
        docs: t("header.nav_docs"),
        changelog: t("header.nav_changelog"),
        getStarted: t("header.cta_get_started"),
        dashboard: t("header.cta_dashboard"),
        openMenu: t("header.open_menu"),
        closeMenu: t("header.close_menu"),
        languageLabel: t("header.language_label"),
        github: t("header.github_label"),
      }}
    />
  )
}
```

### Sub-steps for Step 2 (single file, three logical edits)

The edit on `site-header-client.tsx` splits into three logical sub-steps for checkpointing. All three apply BEFORE the commit in Step 8. Run `pnpm tsc --noEmit` after Step 2c to verify the file compiles end-to-end.

- [ ] **Step 2a: Replace imports + props type + add `computeInitials` helper**

Replace the top of the file. Currently lines 1-39 look like:

```tsx
"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useLocale } from "next-intl"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"

type AuthState = "anonymous" | "signed-in"

type Labels = {
  brand: string
  features: string
  pricing: string
  docs: string
  changelog: string
  getStarted: string
  dashboard: string
  openMenu: string
  closeMenu: string
  languageLabel: string
  github: string
}

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  ru: "Русский",
}

export function SiteHeaderClient({
  authState,
  initials,
  repoUrl,
  labels,
}: {
  authState: AuthState
  initials: string
  repoUrl: string
  labels: Labels
}) {
  const [scrolled, setScrolled] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
```

Replace with (Step 2a covers imports, props type/signature swap, and the `computeInitials` helper):

```tsx
"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useLocale } from "next-intl"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { createClient } from "@/lib/supabase/client"
import {
  getAuthHint,
  setAuthHint,
  type AuthState,
} from "@/lib/auth-hint"

type Labels = {
  brand: string
  features: string
  pricing: string
  docs: string
  changelog: string
  getStarted: string
  dashboard: string
  openMenu: string
  closeMenu: string
  languageLabel: string
  github: string
}

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  ru: "Русский",
}

function computeInitials(
  user:
    | {
        user_metadata?: { full_name?: string }
        email?: string | null
      }
    | null
    | undefined,
): string {
  if (!user) return ""
  const source =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? ""
  return (
    source
      .split(/\s|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "U"
  )
}

export function SiteHeaderClient({
  repoUrl,
  labels,
}: {
  repoUrl: string
  labels: Labels
}) {
```

- [ ] **Step 2b: Add `useState` lazy initializers for authState and initials**

Inside the `SiteHeaderClient` function body, after the existing `useState` calls for `scrolled` and `drawerOpen`, add the new auth state hooks:

```tsx
  const [scrolled, setScrolled] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [authState, setAuthState] = useState<AuthState>(() => {
    const hint = getAuthHint()
    return hint === "signed-in" ? "signed-in" : "anonymous"
  })
  const [initials, setInitials] = useState<string>("")
```

The existing `useEffect` calls (for scroll, drawer open, key handlers, media query) stay where they are. Do NOT remove or reorder them.

- [ ] **Step 2c: Add `useEffect` with `onAuthStateChange` listener**

Add a new `useEffect` block right after the existing media-query `useEffect` (currently around line 76 of the original file, which has the `mq.addEventListener("change", handle)` block). The new effect mounts once and subscribes to Supabase auth state:

```tsx
  useEffect(() => {
    let sb
    try {
      sb = createClient()
    } catch {
      // createBrowserClient throws synchronously only if env vars are
      // missing. Public pages must still render: keep current state.
      return
    }

    function applySession(
      user:
        | {
            user_metadata?: { full_name?: string }
            email?: string | null
          }
        | null
        | undefined,
    ) {
      if (user) {
        setAuthState("signed-in")
        setInitials(computeInitials(user))
        setAuthHint("signed-in")
      } else {
        setAuthState("anonymous")
        setInitials("")
        setAuthHint("anonymous")
      }
    }

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user ?? null)
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])
```

After Step 2c, run `pnpm tsc --noEmit` once to verify the file compiles. If it fails on `sb` being possibly undefined (TS2454 / TS2532), change `let sb` to `let sb: ReturnType<typeof createClient> | undefined` and add an `if (!sb) return` guard before the listener subscribe. Other TS errors should not occur.

- [ ] **Step 3: Add `suppressHydrationWarning` to desktop nav-actions region**

In the same file, locate the existing `<div className="nav-actions">` opening tag (currently around line 135 of the original file). Add `suppressHydrationWarning` to that opening tag.

Edit the line:

```tsx
          <div className="nav-actions">
```

Change to:

```tsx
          <div className="nav-actions" suppressHydrationWarning>
```

This silences the React 19 warning for the auth-conditional buttons (`{authState === "anonymous" ? <Link>Get started</Link> : <><Link>Dashboard</Link><span>{initials}</span></>}`) and the initials avatar that swap based on `authState`.

- [ ] **Step 4: Add `suppressHydrationWarning` to mobile drawer auth-conditional regions**

In the same file, the mobile drawer has TWO auth-conditional regions:

(a) `<nav className="mobile-drawer-nav" aria-label="Mobile primary">` (around line 248 of original) - the auth-conditional first link (Features vs Dashboard).

Edit the line:

```tsx
        <nav className="mobile-drawer-nav" aria-label="Mobile primary">
```

Change to:

```tsx
        <nav className="mobile-drawer-nav" aria-label="Mobile primary" suppressHydrationWarning>
```

(b) `<div className="mobile-drawer-actions">` (around line 294 of original) - the auth-conditional CTA at the bottom of the drawer.

Edit the line:

```tsx
        <div className="mobile-drawer-actions">
```

Change to:

```tsx
        <div className="mobile-drawer-actions" suppressHydrationWarning>
```

- [ ] **Step 5: Local type-check**

Run:
```bash
pnpm tsc --noEmit
```

Expected: clean. If TypeScript complains about `sb` being possibly undefined (TS2454), the early `return` in the catch block should narrow it; but if strict-mode complains anyway, change `let sb` to `let sb: ReturnType<typeof createClient> | undefined`. Verify by reading the error.

- [ ] **Step 6: Local lint**

Run:
```bash
pnpm lint
```

Expected: clean. If lint flags an unused variable or hook-dependency issue, address only that file (no global config changes).

- [ ] **Step 7: Local unit tests**

Run the full vitest suite to confirm no regressions plus the new auth-hint tests:
```bash
pnpm vitest run
```

Expected: all tests pass, including the 9 new `auth-hint.test.ts` cases from Task 1. No prior tests should regress (none touch SiteHeader directly).

- [ ] **Step 8: Commit**

```bash
git add src/components/site-header.tsx src/components/site-header-client.tsx
git commit -m "$(cat <<'EOF'
feat(tub-30): step 2 lazy auth hydration in SiteHeader

Removes supabase.auth.getUser() from SiteHeader's server render so the
public-page route tree no longer pins itself dynamic via cookies().
This unlocks Next.js full-RSC prefetching on warm <Link> navigations
between /pricing, /docs, /changelog and siblings.

site-header.tsx is now a pure i18n labels + render handoff (28 lines
down from 80).

site-header-client.tsx owns auth state:
- useState lazy initializer reads localStorage hint (renders correct
  shell synchronously, no flicker for returning signed-in users).
- useEffect subscribes to supabase onAuthStateChange. INITIAL_SESSION
  fires once after subscribe (per @supabase/ssr v2) and is our sole
  source of truth, so no separate getUser() call (no race).
- suppressHydrationWarning scoped to three auth-conditional regions
  (desktop nav-actions, mobile drawer nav, mobile drawer actions).

Single atomic commit because removing props from one side and not the
other would break TypeScript. Same precedent as TUB-28 step 4 commit
340745e.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add desktop-scoped `min-width` to `.nav-actions` for CLS prevention

**Files:**
- Modify: `src/app/globals.css`

### Task 3 steps

- [ ] **Step 1: Locate the existing `.nav-actions` rule**

Run:
```bash
grep -n "\.nav-actions" src/app/globals.css | head -10
```

Capture the line numbers. The plan assumes there is at least one existing rule; if the file has multiple, the desktop variant is the one to extend.

- [ ] **Step 2: Measure target width on a current production page**

This step is interactive but cheap:

1. Open https://tubemine.tech in a browser, sign in (use existing Google account).
2. Navigate to https://tubemine.tech/en/pricing.
3. Open DevTools, select the `.nav-actions` div in the Elements panel.
4. Record the rendered width from the box-model panel. Typical observed values: 160-180px.
5. Round UP to the nearest 4px to leave a margin (e.g., 168px → 172px).

Note the chosen value as `MEASURED_PX` for the next step.

- [ ] **Step 3: Add the CSS rule**

Append to `src/app/globals.css` (placement: at the end of the file, or grouped with other media-query rules if the file is organized that way):

```css
/* TUB-30: reserve nav-actions width so anon→signed-in swap does not
   cause CLS on first client render. Desktop only because mobile layout
   collapses .nav-actions to just the mobile-menu-btn at <1024px. */
@media (min-width: 1024px) {
  .nav-actions {
    min-width: <MEASURED_PX>px;
  }
}
```

Replace `<MEASURED_PX>` with the value from Step 2 (e.g., 172).

- [ ] **Step 4: Local visual verification at three breakpoints**

Start the dev server in another terminal:
```bash
pnpm dev
```

Then in a browser:

1. Open http://localhost:3000/en/pricing as anonymous (incognito or signed-out).
2. Resize to 1440px wide. The `.nav-actions` div should show `[Github] [Locale] [Get started] [Mobile menu]` with NO trailing empty space wider than ~10px on the right edge (some trailing space is expected because we reserved for the signed-in width).
3. Resize to 1024px. Same check at the breakpoint edge.
4. Resize to 375px. The `.nav-actions` div hides all nav items except the hamburger; verify the hamburger is visible and not pushed off-screen.

- [ ] **Step 5: Build the project**

Run:
```bash
pnpm build
```

Expected: succeeds. In the build output, scan the route table for `/pricing`, `/docs`, `/changelog`. Capture the marker next to each:
- `○` (or `●`) = static (good, this is the goal)
- `λ` or `ƒ` = dynamic (still pinned dynamic by something other than SiteHeader; see Acceptance criteria fallback in spec)

Record the markers in a scratch note for the Linear comment in Task 8.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "$(cat <<'EOF'
style(tub-30): step 3 reserve .nav-actions min-width to prevent CLS

Adds @media (min-width: 1024px) .nav-actions min-width rule so anon→
signed-in swap in SiteHeaderClient does not cause horizontal layout
shift on first client render. Desktop-scoped because mobile (<1024px)
collapses nav-actions to just the hamburger and a fixed min-width
would push it off-screen.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Push branch and open PR

**Files:** none (git only)

### Task 4 steps

- [ ] **Step 1: Check current branch state**

Run:
```bash
git status && git log --oneline -5
```

Confirm 3 new commits on top of the spec commits, total 6 commits since `main` of the form:
- `plan(tub-30): public-page nav perf spec, Phase B1 lazy auth hydration`
- `review(spec): fix round 1 issues (tub-30 public-page nav perf)`
- `review(spec): fix round 2 issues (tub-30 public-page nav perf)`
- `review(spec): fix round 3 issues (tub-30 public-page nav perf)`
- `review(spec): fix round 4 issues (tub-30 public-page nav perf)`
- `feat(tub-30): step 1 auth-hint localStorage helper for SiteHeader`
- `feat(tub-30): step 2 lazy auth hydration in SiteHeader`
- `style(tub-30): step 3 reserve .nav-actions min-width to prevent CLS`

(Order may include rounds 1-4 from spec review.)

- [ ] **Step 2: Create feature branch and push**

The brief mandates "One PR per phase". Prior turbo-pipeline work (TUB-28 #4, TUB-31) used feature-branch + PR + squash merge. Follow that pattern.

```bash
git checkout -b erkebulan622/tub-30-public-page-nav-perf
git push -u origin erkebulan622/tub-30-public-page-nav-perf
```

The branch name matches Linear's suggested branch convention (trimmed for length).

- [ ] **Step 3: Open the PR**

```bash
gh pr create --title "perf(tub-30): SiteHeader lazy auth hydration" --body "$(cat <<'EOF'
## Summary

Phase B1 of TUB-30. Removes supabase.auth.getUser() from SiteHeader server render so public pages (/pricing, /docs, /changelog, /privacy, /terms, /login) become statically prerenderable, unlocking full RSC prefetching for warm Link navigations.

Phase A skipped (vault note pre-flagged cache() dedup=0 on single-caller-per-render). Phase B2 (Edge runtime) unnecessary once routes go static. Phase C (use cache: private) still deferred for same blocker as cancelled TUB-29.

Spec: docs/superpowers/specs/2026-05-21-tub-30-public-page-nav-perf-design.md
Plan: docs/superpowers/plans/2026-05-21-tub-30-public-page-nav-perf.md
Linear: TUB-30

## Test plan

- [ ] pnpm vitest run passes (9 new auth-hint cases plus regression suite)
- [ ] pnpm tsc --noEmit clean
- [ ] pnpm lint clean
- [ ] pnpm build succeeds; public routes show static markers
- [ ] Chrome MCP measurement on prod: avg TTFB < 100ms, total < 800ms
- [ ] Anonymous incognito /en/pricing shows Get started, no console errors
- [ ] Signed-in /en/changelog hard reload shows Dashboard + avatar with no flicker
- [ ] CLS < 0.01 on cold load

Generated with Claude Code via turbo-pipeline.
EOF
)"
```

- [ ] **Step 4: Wait for Vercel preview READY**

The PR triggers a Vercel preview deployment automatically. Use the Vercel MCP tool to confirm READY status:

```
mcp__vercel__list_deployments {
  projectId: "tubemine",
  limit: 5
}
```

Find the deployment whose `gitSource.ref` matches the branch `erkebulan622/tub-30-public-page-nav-perf`. Confirm `readyState` is `READY` (poll every ~30 seconds if still `BUILDING`).

Capture the preview URL (`url` field) for the next task.

If the Vercel MCP is not available, fall back to `gh pr checks <pr-number>` and watch for the Vercel check to turn green. The PR number is visible in the URL from Step 3 or via `gh pr list --head erkebulan622/tub-30-public-page-nav-perf --json number,url`.

- [ ] **Step 5: Squash-merge the PR to main**

Once the preview is green and the next task (verification) passes against the preview URL, squash-merge:

```bash
gh pr merge <pr-number> --squash --delete-branch
```

Wait for the production deploy to flip READY. Note: Task 5 verification runs against the preview URL FIRST; only after verification passes does the PR get merged to main and verified again on production. The Linear update happens AFTER the production-side verification confirms numbers.

---

## Task 5: Verify on production with Chrome MCP measurement

**Files:** none (browser instrumentation only)

This task is the verification-on-prod gate per `~/vault/feedback/qa-verify-on-prod-before-close.md`. No PR closes until this passes.

### Task 5 steps

- [ ] **Step 1: Open the deploy URL in a Chrome MCP-controlled tab**

Verification runs first against the Vercel preview URL captured in Task 4 Step 4, then again on production after merge. The same tool sequence applies to both; substitute the URL.

Use the MCP tool sequence:

```
mcp__claude-in-chrome__tabs_create_mcp { url: "<PREVIEW_OR_PROD_URL>/en/pricing" }
```

Wait for page load with an explicit JavaScript-based delay (the claude-in-chrome MCP does not expose a `wait_for` tool; use `javascript_tool` with a Promise-based sleep):

```
mcp__claude-in-chrome__javascript_tool {
  code: "await new Promise(r => setTimeout(r, 3000)); 'ready'"
}
```

- [ ] **Step 2: Confirm signed-in baseline state (or anon, per scenario)**

The brief and spec want both states verified. Start with signed-in.

Run:
```
mcp__claude-in-chrome__javascript_tool {
  code: "document.cookie.split(';').map(c=>c.trim()).filter(c=>c.startsWith('sb-'))"
}
```

Expected for signed-in: array of one or more `sb-...` cookies present. If empty, log in via the production UI first (manual step), then re-run.

- [ ] **Step 3: Run the verification measurement script (5 alternating navigations)**

Run the inlined script via:

```
mcp__claude-in-chrome__javascript_tool {
  code: "(async () => { const samples = []; for (let i = 0; i < 5; i++) { performance.clearResourceTimings(); const startTime = performance.now(); const target = i % 2 === 0 ? '/docs' : '/changelog'; const link = document.querySelector(`a[href*=\"${target}\"]`); if (!link) { samples.push({ iter: i, error: `no link for ${target}` }); continue; } const startUrl = location.pathname; link.click(); await new Promise(r => { const iv = setInterval(() => { if (location.pathname !== startUrl) { setTimeout(() => { clearInterval(iv); r(); }, 300); } }, 20); setTimeout(r, 6000); }); const rsc = performance.getEntriesByType('resource').find(r => r.name.includes(location.hostname) && r.initiatorType === 'fetch' && !r.name.includes('/view') && r.transferSize > 1000); samples.push({ total_ms: Math.round(performance.now() - startTime), ttfb: rsc ? Math.round(rsc.responseStart - rsc.requestStart) : null }); await new Promise(r => setTimeout(r, 800)); } console.table(samples); return samples; })()"
}
```

The script (sourced from `~/vault/references/tubemine-public-page-nav-perf-2026-05-21.md` §"Verification methodology", with two small hardenings: hostname-derived match instead of hardcoded `tubemine.tech` so the same script works on the Vercel preview domain, and an early-out if the link element is not found) clicks 5 alternating links between `/docs` and `/changelog`, prints a `console.table(samples)` with `total_ms` and `ttfb` columns, and returns the array as the tool result for direct capture.

- [ ] **Step 4: Capture the table output**

Run:
```
mcp__claude-in-chrome__read_console_messages { pattern: "total_ms|ttfb" }
```

Record the 5 samples. Compute:
- Average total_ms
- Average ttfb

Compare against acceptance:
- **PASS:** avg ttfb < 100ms AND avg total < 800ms.
- **PARTIAL:** ttfb dropped substantially (e.g., 346 → 150ms) but didn't hit <100ms. Continue with the PR; add Linear note explaining the residual delta and propose a follow-up (likely another `cookies()` reader elsewhere in the public render tree).
- **FAIL:** ttfb stayed at ~346ms (no improvement). This means routes are still dynamic. Investigate by greping all server components imported into public layouts for `cookies()` / `await createClient()`.

- [ ] **Step 5: Run additional smoke tests**

For each of the following, take a screenshot via `mcp__claude-in-chrome__take_screenshot` and verify visually + via `mcp__claude-in-chrome__get_page_text`:

(a) **Anonymous, fresh incognito, hard reload /en/pricing:**

```
mcp__claude-in-chrome__tabs_create_mcp { url: "https://tubemine.tech/en/pricing" }
```

Use an incognito profile (the Chrome MCP browser config; ensure cookies are empty). Verify header shows `Get started` button. Verify no `Dashboard` text. Open DevTools console, confirm no `Hydration failed` or `Warning: Text content did not match` errors.

(b) **Anonymous, click /docs from header, verify transition:**

```
mcp__claude-in-chrome__click { selector: "header a[href*='/docs']" }
mcp__claude-in-chrome__wait_for { selector: "h1, [class*='docs']" }
```

Verify header still shows `Get started` (no flicker visible).

(c) **Signed-in, hard reload /en/changelog:**

Switch to the signed-in profile. Navigate to `/en/changelog`, hard-reload. Verify header shows `Dashboard` + avatar with initials. Verify no console errors. Verify localStorage:

```
mcp__claude-in-chrome__javascript_tool {
  code: "localStorage.getItem('tubemine:auth-hint')"
}
```

Expected: `"signed-in"`.

(d) **CLS measurement:**

```
mcp__claude-in-chrome__performance_start_trace { reload: true }
```

Wait, then stop:

```
mcp__claude-in-chrome__performance_stop_trace
```

Run:
```
mcp__claude-in-chrome__performance_analyze_insight { insightName: "CLS" }
```

Expected: CLS score < 0.01. If higher, investigate the `.nav-actions` `min-width` value picked in Task 3.

- [ ] **Step 6: Record all numbers and screenshots**

Save measurement output + screenshot paths in a scratch note for the Linear comment in Task 8.

---

## Task 6: Update Linear TUB-30 with results and move to Done

**Files:** none (Linear MCP only)

### Task 6 steps

- [ ] **Step 1: Move TUB-30 to In Progress (if not already)**

```
mcp__claude_ai_Linear__list_issue_statuses { team: "Tubemine" }
```

Get the `id` for "In Progress" status. Then:

```
mcp__claude_ai_Linear__save_issue {
  issueId: "TUB-30",
  statusId: "<in-progress-id>"
}
```

If already In Progress, skip.

- [ ] **Step 2: Post measurement comment**

```
mcp__claude_ai_Linear__save_comment {
  issueId: "TUB-30",
  body: "<comment text>"
}
```

Comment body template (substitute real numbers, NO em-dashes):

```
Phase B1 shipped. Phase A explicitly skipped (vault note pre-flagged
dedup=0 because SiteHeader is the only auth caller per public-page
render).

Implementation:
- src/lib/auth-hint.ts new helper module with 9 unit tests
- src/components/site-header.tsx auth call removed (resolveAuthState
  deleted, no more cookies() access)
- src/components/site-header-client.tsx new client-side state owner;
  reads localStorage hint synchronously, subscribes to
  onAuthStateChange (INITIAL_SESSION as sole source of truth)
- src/app/globals.css adds desktop-scoped .nav-actions min-width to
  prevent CLS on auth swap

Measurements (5-sample average, signed-in user clicking alternating
/docs and /changelog from /en/pricing):

| metric | baseline | post-fix | delta |
|---|---|---|---|
| TTFB | 346ms | <NEW>ms | <DELTA>ms |
| Total | 1860ms | <NEW>ms | <DELTA>ms |
| CLS | n/a | <NEW> | n/a |

Functional checks all pass:
- Anonymous incognito sees Get started, no console errors
- Signed-in sees Dashboard + avatar on hydration, no flicker via hint
- localStorage hint round-trip verified
- Sign-out in second tab swaps Dashboard back to Get started

Commits: <commit-shas>
```

- [ ] **Step 3: Move TUB-30 to Done**

```
mcp__claude_ai_Linear__list_issue_statuses { team: "Tubemine" }
```

Get the `id` for "Done". Then:

```
mcp__claude_ai_Linear__save_issue {
  issueId: "TUB-30",
  statusId: "<done-id>"
}
```

- [ ] **Step 4: Post closing comment confirming scope**

```
mcp__claude_ai_Linear__save_comment {
  issueId: "TUB-30",
  body: "Closing. Phase A skipped per design (cache() dedup wins zero on single-caller-per-render). Phase B2 (Edge runtime) unnecessary once routes go static. Phase C (use cache: private) still deferred for same blocker as cancelled TUB-29 (multi-user isolation test infra)."
}
```

---

## Task 7: Append session summary to vault daily note

**Files:** none (Obsidian MCP only)

### Task 7 steps

- [ ] **Step 1: Append to `~/vault/daily/2026-05-21.md`**

```
mcp__obsidian__write_note {
  path: "daily/2026-05-21.md",
  mode: "append",
  content: "<summary block>"
}
```

Summary block content (NO em-dashes):

```

## Session Summary 3 (TUB-30 public-page nav perf, Phase B1)

- **Goal:** Cut public-page warm-nav TTFB from 346ms baseline to <100ms target by removing supabase.auth.getUser() from SiteHeader server render.
- **Approach:** Phase A skipped after brainstorming flagged cache() dedup=0 on single-caller-per-render. Went straight to Phase B1 (lazy auth hydration with localStorage hint).
- **Progress:**
  - Spec written and hardened across 4 review rounds (9 -> 5 -> 3 -> 2 -> 0 issues).
  - 3 implementation commits: auth-hint helper module, SiteHeader rewrite, .nav-actions CSS rule.
  - Verified on prod: <FILL IN measurement deltas>.
- **Decisions:**
  - login-client.tsx hint-write dropped after impl inspection (OAuth-only, callback is server-side, no client success branch with confirmed session). Accepted one-time first-public-visit flicker, documented in Linear comment.
  - onAuthStateChange INITIAL_SESSION used as sole source of truth (no separate getUser call). Eliminates race conditions.
  - suppressHydrationWarning scoped to 3 auth-conditional regions. Standard pattern for localStorage-driven render hints (same as dark mode toggles).
- **Files:** src/lib/auth-hint.ts (new), src/components/site-header.tsx (slimmed), src/components/site-header-client.tsx (new owner of authState), src/app/globals.css (desktop min-width rule)
- **Linear:** TUB-30 -> Done. Phase C remains deferred (same blocker as TUB-29).
- **Next:** Phase B2/Edge runtime unnecessary now that routes are static. If field reports surface listener-never-fires or cross-device sign-out staleness, add visibilitychange revalidation as follow-up.

```

---

## Final acceptance checklist

After all 7 tasks complete:

- [ ] PR squash-merged to `main`. The squash commit subsumes 3 implementation commits (auth-hint module, SiteHeader rewrite, CSS rule). Spec and review-fix commits are already on `main` from the brainstorm/review phases.
- [ ] `pnpm tsc --noEmit` clean.
- [ ] `pnpm lint` clean.
- [ ] `pnpm test` passes (all existing + 9 new auth-hint tests).
- [ ] `pnpm build` succeeds.
- [ ] Production deploy READY on Vercel.
- [ ] Chrome MCP measurement shows avg ttfb < 100ms AND avg total < 800ms.
- [ ] Anonymous incognito /en/pricing shows Get started, no console errors.
- [ ] Signed-in /en/changelog hard reload shows Dashboard + avatar with no flicker.
- [ ] localStorage `tubemine:auth-hint` round-trips between `signed-in` and `anonymous`.
- [ ] Sign-out in second tab swaps live header in first tab.
- [ ] CLS < 0.01 on /en/pricing cold load.
- [ ] Linear TUB-30 moved to Done with measurement comment.
- [ ] Vault daily note has the session summary appended.

---

## Self-review notes (for plan author)

Spec coverage check:

- ✅ Server-side auth strip (spec §Server-side changes) → Task 2 Step 1.
- ✅ Client-side state owner with hint initializer (spec §Client-side changes) → Task 2 Step 2.
- ✅ `onAuthStateChange` as sole source of truth (spec §Client-side changes) → Task 2 Step 2.
- ✅ Try/catch wrapping `createClient()` (spec §Client-side changes error notes) → Task 2 Step 2.
- ✅ `computeInitials` helper moved to client (spec §Client-side changes) → Task 2 Step 2.
- ✅ `auth-hint.ts` new module (spec §`src/lib/auth-hint.ts`) → Task 1.
- ✅ `AuthState` type exported from auth-hint (spec §`src/lib/auth-hint.ts` round-1 fix) → Task 1 Step 3.
- ✅ `suppressHydrationWarning` on 3 conditional regions (spec §Hydration mismatch handling, §Client-side changes step 5) → Task 2 Steps 3 and 4.
- ✅ Desktop-scoped `.nav-actions` `min-width` (spec §CLS prevention) → Task 3.
- ✅ Verify-on-prod gate (spec §Hard constraints) → Task 5.
- ✅ Linear update (spec §Acceptance criteria → Linear updates) → Task 6.
- ✅ Daily note append (spec §Hard constraints) → Task 7.
- ⚠️ login-client.tsx hint write (spec §login-client.tsx): IMPLEMENTATION DECISION dropped after inspection. Documented at top of plan and in Task 7 daily note.

Placeholder scan:

- No "TBD", "TODO", "implement later", "similar to Task N" anywhere.
- The `<MEASURED_PX>` placeholder in Task 3 Step 3 is intentional: the value comes from a live DevTools measurement that must happen during implementation, not at plan-writing time. Task 3 Step 2 explicitly produces the value.
- The `<NEW>`, `<DELTA>`, `<commit-shas>`, `<FILL IN measurement deltas>` placeholders in Tasks 6 and 7 are intentional fields that come from Task 5 measurement output, not pre-knowable at plan time.

Type consistency:

- `AuthState` defined in `auth-hint.ts` (Task 1), imported by `site-header-client.tsx` (Task 2) - matches.
- `getAuthHint` / `setAuthHint` / `clearAuthHint` named consistently across Task 1 source, Task 1 tests, Task 2 client usage.
- `applySession`, `computeInitials` defined once in `site-header-client.tsx` Task 2 Step 2, referenced nowhere else (intentional, single file).
- `tubemine:auth-hint` localStorage key string identical across Task 1 source, Task 1 tests, Task 5 verification, Task 6 comment.

No gaps. No placeholder failures. Plan is execution-ready.
