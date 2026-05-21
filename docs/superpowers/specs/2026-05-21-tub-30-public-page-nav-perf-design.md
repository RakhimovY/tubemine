# TUB-30 Public-Page Nav Perf: SiteHeader lazy auth hydration (Phase B1)

**Linear:** TUB-30 (https://linear.app/qostap/issue/TUB-30/public-page-nav-perf-avg-1860ms-transition-346ms-ttfb)
**Date:** 2026-05-21
**Status:** spec
**Author:** turbo-pipeline session
**Related research:** `~/vault/references/tubemine-public-page-nav-perf-2026-05-21.md`

## Problem

User reported 2026-05-21: "любая навигация очень долго идет". Chrome MCP measurements on production confirmed:

- Average public-page transition: **1860ms** click-to-content-visible
- Average RSC TTFB: **346ms** of pure server compute
- RSC payload: 2KB (network is not the bottleneck)

Root cause: `src/components/site-header.tsx:32-35` calls `supabase.auth.getUser()` on every public-page server render. This:

1. Adds 200-400ms of server compute per request (the documented Supabase auth check latency).
2. Forces the route to be **dynamic** (the call chain reads `cookies()` via `createClient()`), which means Next.js cannot prefetch full RSC payloads for `<Link>` navigation. Prefetch only fetches `loading.tsx` for dynamic routes, so warm `<Link>` clicks still pay the full server-render cost.

## Scope decisions made in brainstorming

### Phase A skipped

The original Linear issue proposed Phase A (`React.cache()` wrap + explicit `prefetch={true}`) before Phase B (lazy hydration). Brainstorming confirmed Phase A is a no-op for the TTFB metric:

- `getCachedUser` already exists in `src/lib/supabase/server.ts:42` (from TUB-28 commit `340745e`). It is `react.cache`-wrapped. `react.cache` is a per-render-pass dedup, not a longer-lived memo. `SiteHeader` is the only auth caller per public-page render, so dedup wins zero. The vault note explicitly flagged this.
- Explicit `prefetch={true}` on `<Link>` is the default. Next.js prefetches in-viewport links by default. The prefetch is already firing; it just hits a dynamic route that returns only `loading.tsx`. Setting the flag explicitly changes nothing.

Phase A is dropped. Going straight to Phase B1.

### Phase B2 (Edge runtime) deferred

Not needed once B1 makes routes static. Edge runtime is a server-render acceleration; static prefetched RSC bypasses server render entirely on warm navigation.

### Phase C (`'use cache: private'`) out of scope

Same blocker as cancelled TUB-29: requires a second test account for multi-user isolation verification. Not in this sprint.

## Design

### Architecture summary

```
BEFORE (dynamic routes, no RSC prefetch)
SiteHeader (server, dynamic)
 ├─ resolveAuthState()
 │   ├─ createClient()            ← cookies() pins route as dynamic
 │   └─ supabase.auth.getUser()   ← 200-400ms per request
 ├─ getTranslations("landing")
 └─ <SiteHeaderClient authState initials labels ... />

AFTER (static routes, full RSC prefetch enabled)
SiteHeader (server, static)
 ├─ getTranslations("landing")
 └─ <SiteHeaderClient labels ... />
        ↓ (browser only)
        ├─ getAuthHint() from localStorage (sync, before paint)
        ├─ initial state := hint ?? "anonymous"
        ├─ render correct shell based on initial state
        ├─ useEffect: supabase.auth.getUser()
        │   → if changed, setState + setAuthHint
        └─ useEffect: supabase.auth.onAuthStateChange()
            → setState + setAuthHint on every change (cross-tab sync)
```

### Server-side changes

**`src/components/site-header.tsx`** (server component):

1. Delete the entire `resolveAuthState()` function (lines 19-51).
2. Delete the import of `createClient` from `@/lib/supabase/server`.
3. Drop `state` and `initials` from `SiteHeader`'s body and from the `<SiteHeaderClient>` props.
4. Keep `getTranslations("landing")` and the labels object. Labels remain server-rendered (no auth dependency, locale is in the URL path).

Final signature after edit: pure i18n + render handoff, no auth touch on the server.

After this change, `SiteHeader` no longer reads `cookies()` directly or transitively. The public-page route tree (`/pricing`, `/docs`, `/changelog`, `/privacy`, `/terms`, `/login`, `/`) becomes static (or at minimum, no longer pinned dynamic by SiteHeader). Next.js `<Link>` prefetch can then serve full RSC payloads for warm-navigation hits.

### Client-side changes

**`src/lib/auth-hint.ts`** (new file, ~35 lines):

Three exported helpers wrapping `localStorage` with try/catch for SSR and private-browsing safety. Also exports the shared `AuthState` type alias used by `SiteHeaderClient`:

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

export function setAuthHint(state: AuthHint): void {
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

**`src/components/site-header-client.tsx`** (client component):

1. Remove `authState` and `initials` from the props type. Import `AuthState`, `getAuthHint`, and `setAuthHint` from `@/lib/auth-hint`.
2. Add new state owned by the component:
   ```ts
   import type { AuthState } from "@/lib/auth-hint"
   import { getAuthHint, setAuthHint } from "@/lib/auth-hint"

   const [authState, setAuthState] = useState<AuthState>(() => {
     const hint = getAuthHint()
     return hint === "signed-in" ? "signed-in" : "anonymous"
   })
   const [initials, setInitials] = useState<string>("")
   ```
   Note: the `useState` initializer runs once at mount, synchronously. The localStorage read is fast (sub-millisecond) and safe for SSR because `getAuthHint` returns `null` when `window` is undefined.
3. Add an effect that subscribes to Supabase auth state. `onAuthStateChange` in `@supabase/ssr` v2 fires an `INITIAL_SESSION` event right after subscription (on the next tick) with the current session loaded from cookies. This event is our single source of truth, so we do NOT also call `supabase.auth.getUser()` separately - the listener alone handles both initial-state delivery and ongoing changes. This removes the load-vs-listener race flagged in spec review.

   ```ts
   useEffect(() => {
     let sb
     try {
       sb = createClient() // from @/lib/supabase/client
     } catch {
       // createBrowserClient throws only if env vars are missing.
       // Public pages must still render: keep current state, do not flip.
       return
     }

     function applySession(user: { user_metadata?: { full_name?: string }; email?: string | null } | null | undefined) {
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

   Error handling notes:
   - `createClient()` (the browser builder) throws synchronously only if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is undefined. Wrapped in try/catch; on failure the component keeps whatever state the hint initializer set. Header remains usable.
   - `onAuthStateChange` itself does not throw. If Supabase's internal session load fails (corrupt cookie, network down), the listener will fire with `session = null`, and `applySession` correctly sets anonymous state. This explicitly clears a stale "signed-in" hint, so a downed auth API never leaves a returning user stuck displaying a Dashboard CTA they can no longer use.
4. Add a `computeInitials` helper (moved from the server file verbatim):
   ```ts
   function computeInitials(user: { user_metadata?: { full_name?: string }; email?: string | null }): string {
     const source =
       (user.user_metadata?.full_name as string | undefined) ??
       user.email ??
       ""
     return (
       source
         .split(/\s|@/)
         .filter(Boolean)
         .slice(0, 2)
         .map((s) => s[0]?.toUpperCase() ?? "")
         .join("") || "U"
     )
   }
   ```
5. The JSX that switches on `authState === "anonymous"` vs `"signed-in"` stays structurally identical. There are two auth-conditional regions: (a) the desktop nav-links + nav-actions block (around lines 100-183 of the current file), and (b) the mobile drawer nav + mobile-drawer-actions block (around lines 249-313). Both consume the same `authState` state - one source of truth covers both. Add `suppressHydrationWarning` (see Hydration mismatch handling section below) only to the outer container element of each conditional region, not to every child node.

**`src/app/[locale]/login/login-client.tsx`** (existing client component, small additive change):

The `(app)/` route group renders `AppShell`, not `SiteHeaderClient`. So when a user logs in and is redirected to `/dashboard`, no `SiteHeaderClient` mounts and no hint is written. The first post-login visit to a public page would then start with no hint, briefly show anon shell, and flicker to signed-in once `INITIAL_SESSION` fires. To eliminate that flicker:

1. Import `setAuthHint` from `@/lib/auth-hint`.
2. Write `setAuthHint("signed-in")` ONLY on confirmed-success paths, where a real session was returned. Concretely:
   - **Email/password (or magic link) flow:** inside the branch that handles the resolved `signInWithPassword`/`signInWithOtp` response, after asserting `data.session != null` and `error == null`. Do NOT write before the network call returns. Do NOT write in an optimistic pre-redirect path.
   - **OAuth flow:** the initial click that calls `signInWithOAuth` is a redirect to the provider; do NOT write the hint there (no session exists yet). The hint must be written in the OAuth callback handler that processes `?code=...` and exchanges it for a session. If that callback handler is on the server side and `login-client.tsx` itself does not see the callback, then the post-OAuth-redirect lands the user in `(app)/` (out of scope), so the OAuth case may fall back to the same flicker-once behavior as post-logout. Inspect the current login flow during implementation to choose: write hint in the OAuth callback if the callback is client-side, otherwise accept the one-time post-OAuth flicker and document in the Linear comment.
3. Do NOT write `setAuthHint("anonymous")` from `login-client.tsx`. The `SiteHeaderClient` listener writes that on its own when `applySession(null)` runs.

This is the only edit outside the SiteHeader family. It is a small additive change (import + one call inside a confirmed-success branch) co-located with where the auth state actually changes. No new dependency, no scope creep.

The point of constraining the write to confirmed-success branches: avoid a stale `"signed-in"` hint when a client-side success path is followed by a server-side rejection. The accepted edge case (listener fires SIGNED_OUT, hint corrected) covers the residual risk if a session is server-revoked after this point.

### Hydration walkthrough

**First-ever visit, signed-in user lands on /docs (no hint yet because login wrote it via login-client.tsx but this is a fresh browser):**

1. RSC arrives in ~10-50ms (prefetched or initial nav).
2. HTML paints with anonymous shell ("Get started" button visible).
3. JS hydrates. `SiteHeaderClient` mounts.
4. `getAuthHint()` returns `null` (first visit, no key set).
5. Initial state: `"anonymous"`. UI matches what SSR rendered.
6. `useEffect` runs, subscribes to `onAuthStateChange`. Supabase v2 client immediately schedules an `INITIAL_SESSION` event for the next tick, reading session from cookies.
7. ~10-50ms later: `INITIAL_SESSION` fires with the user's session.
8. `applySession(user)` runs: `setAuthState("signed-in")` + `setInitials(...)` + `setAuthHint("signed-in")`. UI swaps to Dashboard CTA + avatar.
9. Visible flicker on this one-time first visit only. Subsequent visits skip this because login-client.tsx writes the hint on successful auth (see Client-side changes additions below).

**Subsequent navigation (same browser, signed-in, hint already set by login or prior public visit):**

1. RSC arrives (~5-30ms, prefetched from browser RSC cache).
2. HTML paints with anonymous shell (SSR cannot read localStorage; the shell is static).
3. JS hydrates. `SiteHeaderClient` mounts.
4. `getAuthHint()` returns `"signed-in"`.
5. Initial state: `"signed-in"`. First client render shows Dashboard CTA + avatar **before** the listener has fired.
   - This is a hydration mismatch with the SSR'd anon shell. `suppressHydrationWarning` on the auth-conditional regions suppresses the React warning. Visually: SSR HTML never paints to screen because hydration commits the corrected state in the same paint frame.
6. `useEffect` subscribes to `onAuthStateChange`. `INITIAL_SESSION` fires soon after with the current session.
7. `applySession(user)` runs but produces the same state values; React bails out on identical `setState` calls. No re-render.

**Sign-out in another tab (same browser):**

1. Other tab calls `sb.auth.signOut()`.
2. `onAuthStateChange` fires in this tab (via `@supabase/ssr` cross-tab storage broadcast) with `session = null`.
3. `applySession(null)`: `setAuthState("anonymous")` + `setAuthHint("anonymous")`.
4. UI swaps Dashboard → Get started.

**Sign-in in another tab (same browser):**

Symmetric to sign-out. Tab B is open on /pricing as anonymous; user signs in on Tab A.

1. Tab A's `login-client.tsx` completes the successful sign-in, calls `setAuthHint("signed-in")` and triggers Supabase session storage write.
2. `@supabase/ssr` broadcasts the SIGNED_IN event cross-tab via its own auth-storage key (separate mechanism from our hint key).
3. Tab B's `onAuthStateChange` fires with the new session.
4. `applySession(user)`: `setAuthState("signed-in")` + `setInitials(...)` + `setAuthHint("signed-in")`.
5. UI swaps Get started → Dashboard.

Note: the `tubemine:auth-hint` localStorage key also fires a `storage` event in Tab B, but we do NOT subscribe to native `storage` events. We only react to Supabase's own broadcast via `onAuthStateChange`. This is intentional: Supabase's broadcast includes the session payload, so Tab B can compute initials without re-fetching. The hint key is a render-acceleration artifact, not a coordination channel.

**Cross-device or admin-revoked sign-out (out of cross-tab broadcast scope):**

The local listener only fires for sign-outs originating in the same browser. If the user signs out on a different device, or admin revokes the session server-side, the local hint stays `"signed-in"` until cleared by some other event (manual localStorage clear, eventually another tab signs out locally, or session token actually expires and Supabase refreshes the listener state). User-visible impact: header shows Dashboard CTA, user clicks it, server middleware finds no valid session and redirects to `/login`. Same outcome as any expired session and considered acceptable; see Risk register.

### Hydration mismatch handling

The localStorage hint pattern intentionally lets the first client render diverge from SSR for returning signed-in users. React 19 (used by Next.js 16) WILL emit a hydration warning when SSR-rendered DOM differs from the initial client render of a client component, regardless of `useState` lazy initializer placement. The hint pattern relies on this expected behavior, so we silence the warning explicitly on the diverging subtree.

Approach:

1. Wrap each auth-conditional region (desktop nav-actions, mobile-drawer-nav, mobile-drawer-actions) in its existing parent element and add `suppressHydrationWarning` to that parent. This tells React: "I know SSR and first client render differ here; do not warn."
2. Do NOT apply `suppressHydrationWarning` to the entire `SiteHeaderClient` root. Scope it to just the regions that actually diverge.
3. Verification: open DevTools console on a returning signed-in user's first navigation post-deploy. Console must be free of `Hydration failed` and `Warning: Text content did not match` errors.

Tradeoff: `suppressHydrationWarning` silences the warning but does NOT prevent the mismatch itself. The visual outcome is: SSR HTML shows anon shell briefly (microseconds, before client takes over), then the lazy initializer fires the hint-correct render in the same hydration frame. For returning signed-in users this is imperceptible because hydration commits in one paint; the SSR'd DOM never actually paints to screen before client reconciliation completes. This is the same pattern used by dark-mode toggles and any other localStorage-based render hint.

### CLS prevention

The right side of the nav has two variants:

- **Anonymous:** `[Github icon] [Locale switcher] [Get started button] [Mobile menu]`
- **Signed-in:** `[Github icon] [Locale switcher] [Dashboard button] [Avatar 30px] [Mobile menu]`

The width delta is the 30px avatar + ~8px gap = ~38px.

Mitigation: add `min-width` to the `.nav-actions` container sized for the wider (signed-in) variant, but **only at the desktop breakpoint**. On narrow viewports (<1024px, the existing breakpoint where the desktop nav-links hide and the mobile menu trigger takes over) the layout collapses to mobile-menu-button only, and a fixed desktop `min-width` would push the hamburger off-screen or cause horizontal overflow.

Implementation:

1. Locate the `.nav-actions` rule. The brainstorming pass showed the styles are in the landing styled-jsx block referenced by the file header comment, but the exact source file is located during implementation (a `grep -r ".nav-actions" src/ app/` resolves it). Likely candidates: `src/app/[locale]/page.tsx` styled-jsx block, or a global CSS file imported by `[locale]/layout.tsx`.
2. Scope the `min-width` rule inside a desktop media query that matches the existing `@media (min-width: 1024px)` breakpoint already used by `SiteHeaderClient` (it watches `window.matchMedia("(min-width: 1024px)")`). The rule looks like:
   ```css
   @media (min-width: 1024px) {
     .nav-actions {
       min-width: <value>px; /* measured during impl */
     }
   }
   ```
3. The exact pixel value cannot be known without measuring the rendered signed-in layout. During implementation: open DevTools on a signed-in production page, inspect the `.nav-actions` width when both Dashboard button and avatar are present, take that value (likely 160-180px including gaps), apply.
4. Verify visually at three viewport widths: 1440px (desktop), 1024px (breakpoint edge), 375px (mobile). No layout shift on any. No hamburger off-screen on mobile.

### Out of scope

- **Phase A:** confirmed no-op for TTFB. Not shipped.
- **Phase B2 Edge runtime:** unnecessary once routes go static.
- **Phase C `'use cache: private'`:** same blocker as TUB-29.
- **Refactoring `SiteHeaderClient` visual structure:** the JSX inside the conditional branches stays byte-identical.
- **Touching `(app)/` route group:** TUB-28 territory, completed. Includes the logout button in profile page; first-post-logout-flicker accepted (see Risk register).
- **Touching `/docs` or `/changelog` content:** TUB-31 territory, completed.
- **Adding tests for the auth-hint helper:** the helper is a thin `localStorage` wrapper with try/catch. Manual prod verification covers the critical path; unit testing localStorage shims has low ROI here. Could be added later if we ever extract `auth-hint` into a more complex state machine.
- **Timeout fallback when `onAuthStateChange` doesn't fire:** Accepted risk, see Risk register. Add only if production reports show this happening.
- **Cross-device sign-out revalidation:** Accepted risk, see Risk register. Add `visibilitychange` revalidation only if production reports surface.

## File touchpoints

May edit:

- `src/components/site-header.tsx` (server, ~40 lines deleted, no additions)
- `src/components/site-header-client.tsx` (client, ~60 lines added: hooks, effect, initials helper, suppressHydrationWarning placement)
- `src/lib/auth-hint.ts` (new file, ~35 lines)
- `src/app/[locale]/login/login-client.tsx` (existing client, 2-line additive change: import + one `setAuthHint("signed-in")` call in success callback)
- One CSS source file for `.nav-actions` desktop-scoped `min-width` (likely `src/app/globals.css` or a styled-jsx block; located during implementation via `grep -r ".nav-actions" src/ app/`)

Must NOT touch:

- `src/app/[locale]/(app)/**` (TUB-28 territory)
- `src/app/[locale]/{docs,changelog}/page.tsx` (TUB-31 territory)
- `messages/*.json` (i18n keys already correct)
- API routes, Supabase RLS, payment code, middleware
- `src/lib/supabase/server.ts` `getCachedUser` (still used by `(app)/` route group)

## Acceptance criteria

After deploy to production and verification:

### Performance (primary metric)

Run the Chrome MCP measurement script from `~/vault/references/tubemine-public-page-nav-perf-2026-05-21.md` §"Verification methodology". The measurement procedure:

1. Navigate to `/en/pricing` (this is the starting URL, used as the page from which clicks originate). The script measures the 5 clicks that follow.
2. The script clicks 5 alternating Link navigations: pricing→docs, docs→changelog, changelog→docs, docs→changelog, changelog→docs (matching the baseline measurement methodology exactly).
3. Each click captures total transition time and RSC TTFB.
4. Compute average across the 5 measured navigations.

Pass criteria (Phase B target from Linear TUB-30 body), evaluated on these 5 navigations between /docs and /changelog:

- **Average RSC TTFB across the 5 samples: <100ms**
- **Average total transition: <800ms**
- **Baseline reference:** average TTFB 346ms, average total 1860ms (from the same script run pre-fix).

`/pricing` is the launch point only; its own TTFB is NOT part of the pass gate (it has additional server-side render work that this issue does not address). `/login` is similarly excluded - it has its own auth handling concerns out of scope here. If `/pricing` or `/login` TTFB remains high post-fix, that is a follow-up issue, not a TUB-30 blocker.

### Functional (smoke tests on prod)

- **Anonymous user (fresh incognito, no localStorage hint), hard reload `/en/pricing`:** header renders `Get started` CTA. No `Dashboard` shown. No console error. After the listener fires, `localStorage["tubemine:auth-hint"]` is set to `"anonymous"` (this is intentional: the listener always writes the truth after firing, so subsequent visits also skip any initial-render ambiguity). This is not a regression - it is the expected steady-state.
- **Anonymous user (fresh incognito), click `/docs`:** transition completes, header still shows `Get started`. No flicker (initial state = "anonymous" matches SSR, and `applySession(null)` produces the same value).
- **Anonymous user with stale "signed-in" hint** (clear cookies but keep localStorage, then visit /pricing): initial render briefly shows Dashboard CTA, then `onAuthStateChange` fires with `session = null`, state flips to anonymous within one render. The hint also clears (overwritten to "anonymous"). This brief incorrect-state flicker is expected and acceptable; the next visit shows correct state immediately.
- **Sign in via `/login` flow:** immediately after the login callback completes (BEFORE the redirect to `/dashboard` finishes navigation), `localStorage["tubemine:auth-hint"]` is set to `"signed-in"`. Verify in DevTools Application → Local Storage on the `/login` URL itself, or on `/dashboard` right after landing. The hint is written by `login-client.tsx`, not by `SiteHeaderClient` (which never mounts on `/dashboard`).
- **Signed-in user, click `/pricing` from header:** Dashboard CTA + avatar appear without flicker (hint hit on first client render).
- **Signed-in user, hard reload `/en/changelog`:** Dashboard CTA + avatar appear immediately on hydration (hint hit). Background validation does not change state.
- **Signed-in user, open second tab, sign out in second tab, switch back to first tab:** within 1 render, first tab header swaps to `Get started`. `onAuthStateChange` listener confirmed.
- **CLS measurement:** Performance trace on `/en/pricing` cold load shows CLS <0.01. No layout shift between SSR paint and any client update.

### Build / lint

- `pnpm tsc --noEmit` clean.
- `pnpm lint` clean.
- `pnpm build` succeeds; build log shows the affected public-page routes as static or `prerendered` (look for the `○` (or `●`) markers next to `/pricing`, `/docs`, `/changelog` in the Next.js build output, vs. the current `λ` or `ƒ` marker indicating dynamic). If the build output still flags routes as dynamic for other reasons (locale handling, `setRequestLocale`, middleware), use the production-network gate as fallback:

  **Network-gate fallback** (run from a signed-in browser session on production):
  1. Open DevTools Network tab, filter to `Fetch/XHR`.
  2. Hover a `<Link>` to `/docs` from `/pricing`; observe the prefetch RSC request to `/_next/...rsc=1` or similar.
  3. Click the link.
  4. The click-time RSC request must show in DevTools as a fresh fetch with one of these signals indicating static-route caching:
     - response header `x-nextjs-cache: HIT` or `x-vercel-cache: HIT`, OR
     - response header `cache-control` containing `s-maxage` or `immutable`, OR
     - response transferred size < 500 bytes (indicating the prefetched payload was served from disk cache rather than re-rendered).
  5. If none of these signals are present, the route is still dynamic. File a TUB-30 follow-up issue, do not close TUB-30 as Done.

### Linear updates

- Move TUB-30 status to "In Progress" before pushing PR.
- After verification on prod passes: add Linear comment with commit SHA, PR URL, before/after measurement table, and CLS score.
- After all acceptance criteria pass: move TUB-30 to "Done" with closing summary comment that includes:
  - Phases shipped (B1 only)
  - Final TTFB + total averages vs baseline
  - Confirmation that Phase A was skipped (vault note pre-flagged dedup=0)
  - Confirmation that Phase C is still deferred (same blocker as cancelled TUB-29)

## Hard constraints

These were called out in the turbo-pipeline brief and apply throughout:

1. **No em-dash anywhere.** Per `~/.claude/CLAUDE.md` global rule. Applies to source files, commits, PR descriptions, Linear comments, vault notes. Banned codepoints: U+2014 and U+2013. Use `,` `.` `()` `:` `-` instead. Prior turbo runs slipped em-dash into Linear comments; do not repeat.
2. **Verify-on-prod gate** per `~/vault/feedback/qa-verify-on-prod-before-close.md`. Sequence: push → wait Vercel READY → hard-reload prod URL → DOM assertion → screenshot. No skip.
3. **One PR for the phase.** Phase B1 ships in a single PR to `main`.
4. **No new dependencies.** Use existing React, existing `@supabase/ssr` `createBrowserClient` (already imported by `src/lib/supabase/client.ts`).
5. **Final hand-off:** append session summary to `~/vault/daily/2026-05-21.md` in append mode.

## Risk register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Routes still flagged dynamic by another `cookies()` reader in the public render tree | Low | Build still uses dynamic rendering, TTFB does not drop | Grep `src/app/[locale]/(public)`, `src/app/[locale]/page.tsx`, `src/app/[locale]/layout.tsx`, and any landing-page server components for `cookies()` and `createClient` calls before merge. If found, address in same PR or carve into TUB-30 follow-up issue. |
| Hydration mismatch warning shows in browser console for returning signed-in users | High (expected) | Console noise, no functional break | `suppressHydrationWarning` applied to each auth-conditional region in `site-header-client.tsx` (see Hydration mismatch handling). Verification: console clean on prod check post-deploy. |
| `onAuthStateChange` INITIAL_SESSION event races with separate `getUser()` call | Resolved by design | N/A | Design uses listener as sole source of truth, no separate `getUser()` call. INITIAL_SESSION fires once after subscribe, handles initial state, no race possible. |
| Supabase auth API down or network failure during initial-session load | Low | Listener fires with `session = null`, header renders anonymous, stale "signed-in" hint cleared | Documented in Client-side changes error notes. Outcome is correct: anon view is the safe default; Dashboard click would 401 anyway. |
| localStorage hint becomes stale after a backend-driven session revocation | Low | Brief wrong-state flicker on next visit, corrects after `getUser()` resolves | Acceptable. Same magnitude as the no-hint case. The validation `useEffect` runs unconditionally and corrects. |
| CSS `min-width` value picked is wrong, layout looks unbalanced for anonymous users | Medium | Visual nit, no functional break | During implementation, measure the signed-in layout width via DevTools, pick a value that matches exactly. Cross-check on mobile (the mobile drawer is a separate path and not affected). |
| `min-width` rule applied globally (not gated to desktop breakpoint) pushes hamburger off-screen on mobile | Medium | Mobile layout broken | Scope rule inside `@media (min-width: 1024px)` (matches existing breakpoint used by SiteHeaderClient). Verify at 1440px / 1024px / 375px during implementation. |
| Mobile drawer auth-conditional logic shows wrong CTAs on first paint for returning signed-in users | Resolved by design | N/A | Drawer JSX is inside `SiteHeaderClient` and reads the same `authState` state. The hint-based initial state covers both desktop nav-actions and mobile drawer simultaneously. Single source of truth, single render branch decision. |
| `onAuthStateChange` listener never fires (Supabase client bug, throttled background tab, corrupted IndexedDB) - hint stays "signed-in" indefinitely | Very Low | User sees Dashboard CTA, clicks it, gets redirected to `/login` by middleware. Same UX as expired session. | Accepted. No timeout fallback added because (a) the failure mode is rare, (b) the worst outcome is one redirect bounce, (c) adding a 3-5s timeout `getUser()` reintroduces complexity equivalent to the load-vs-listener race the design removed. If field reports show this occurring, add the fallback in a follow-up. |
| Cross-device or admin-revoked sign-out leaves stale "signed-in" hint on local browser | Low | Same as above: header shows wrong CTA until user clicks, then middleware redirects. | Accepted. The `onAuthStateChange` cross-tab broadcast does NOT cross device boundaries (uses browser-local storage events). User-facing impact is minor: one wrong-state paint per stale-hint session, then auto-corrected on Dashboard click. Adding `visibilitychange` revalidation is extra complexity for an edge case; defer unless reports surface. |
| First post-logout public-page visit flickers (user logs out from `(app)/` profile, then navigates back to /pricing) | Medium | One brief Dashboard → Get started swap on first visit only | Accepted. The logout button lives in `(app)/` which the brief explicitly forbids touching. The `onAuthStateChange` cross-tab listener fires on the next public-page mount with `session = null` and clears the hint. Subsequent visits are correct. Severity: cosmetic, one-time per logout. |
| Pricing page or login page have additional server-side `cookies()` access that pins them dynamic | Medium | These specific pages still dynamic post-fix | Out of scope for this issue. TUB-30 acceptance focuses on `/docs` and `/changelog` (where the issue was measured). `/pricing` and `/login` follow-up only if their TTFB stays high. |

## References

- Measurement methodology: `~/vault/references/tubemine-public-page-nav-perf-2026-05-21.md`
- Parent research: `~/vault/references/nextjs16-perf-refactor-safe-rollout.md`
- Verification gate: `~/vault/feedback/qa-verify-on-prod-before-close.md`
- Linear issue: TUB-30
- Related: TUB-28 (app-shell INP, Done), TUB-29 (app-shell caching, Cancelled, same blocker as Phase C), TUB-31 (docs+changelog content, Done)
- TUB-28 commit defining `getCachedUser`: `340745e`
