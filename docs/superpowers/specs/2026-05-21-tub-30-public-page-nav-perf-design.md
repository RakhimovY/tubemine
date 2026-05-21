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

**`src/lib/auth-hint.ts`** (new file, ~30 lines):

Three exported helpers wrapping `localStorage` with try/catch for SSR and private-browsing safety:

```ts
const KEY = "tubemine:auth-hint"
type AuthHint = "signed-in" | "anonymous"

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

1. Remove `authState` and `initials` from the props type.
2. Add new state owned by the component:
   ```ts
   const [authState, setAuthState] = useState<AuthState>(() => {
     const hint = getAuthHint()
     return hint === "signed-in" ? "signed-in" : "anonymous"
   })
   const [initials, setInitials] = useState<string>("")
   ```
   Note: the `useState` initializer runs once at mount, synchronously before paint. The localStorage read is fast (sub-millisecond) and safe for SSR because `getAuthHint` returns `null` when `window` is undefined.
3. Add an effect that fetches the actual user from Supabase in the browser:
   ```ts
   useEffect(() => {
     const sb = createClient() // from @/lib/supabase/client
     let cancelled = false

     async function load() {
       const { data: { user } } = await sb.auth.getUser()
       if (cancelled) return
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
     load()

     const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
       if (cancelled) return
       const user = session?.user ?? null
       if (user) {
         setAuthState("signed-in")
         setInitials(computeInitials(user))
         setAuthHint("signed-in")
       } else {
         setAuthState("anonymous")
         setInitials("")
         setAuthHint("anonymous")
       }
     })

     return () => {
       cancelled = true
       sub.subscription.unsubscribe()
     }
   }, [])
   ```
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
5. The JSX that switches on `authState === "anonymous"` vs `"signed-in"` stays exactly as it is. The initials span and dashboard CTA continue to render conditionally.

### Hydration walkthrough

**First-ever visit, signed-in user lands on /docs:**

1. RSC arrives in ~10-50ms (prefetched or initial nav).
2. HTML paints with anonymous shell ("Get started" button visible).
3. JS hydrates. `SiteHeaderClient` mounts.
4. `getAuthHint()` returns `null` (first visit, no key set).
5. Initial state: `"anonymous"`. UI matches what SSR rendered.
6. `useEffect` fires `supabase.auth.getUser()`. ~100-300ms later, user found.
7. `setAuthState("signed-in")` + `setAuthHint("signed-in")`. UI swaps to Dashboard CTA + avatar.
8. Visible flicker on this one-time first visit only.

**Subsequent navigation (same browser, signed-in):**

1. RSC arrives (~5-30ms, prefetched from browser RSC cache).
2. HTML paints with anonymous shell (SSR cannot read localStorage; the shell is static).
3. JS hydrates. `SiteHeaderClient` mounts.
4. `getAuthHint()` returns `"signed-in"`.
5. Initial state: `"signed-in"`. First client render shows Dashboard CTA + avatar **before** any network call.
   - Note: this *is* a hydration mismatch with the SSR'd anon shell. Because the mismatch happens inside a client component on initial mount, React will reconcile it as a normal client update on the same frame as hydration completes. No user-visible flicker, no console error (we use `useState` lazy initializer, not `useLayoutEffect`).
6. `useEffect` validates in background. No state change. No re-render.

**Sign-out in another tab:**

1. Other tab calls `sb.auth.signOut()`.
2. `onAuthStateChange` fires in this tab with `session = null`.
3. State updates to `"anonymous"`, hint cleared (via `setAuthHint("anonymous")`).
4. UI swaps Dashboard → Get started.

### Hydration mismatch handling

The localStorage hint pattern intentionally lets the first client render diverge from SSR for returning signed-in users. React 19 (used by Next.js 16) handles client/server divergence inside client components gracefully when the divergence happens inside `useState` lazy initializers, because the state is initialized in the same pass as hydration. The recommendation from React docs is:

> If you intentionally need the server and client to render different things, you can do a two-pass rendering: render the SSR'd output first, then update state in `useEffect` to render the client-only content.

Our pattern is essentially that, but the trigger is the lazy `useState` initializer reading localStorage (which is browser-only and returns `null` during SSR via the `window === undefined` guard). The framework treats this as a controlled mismatch with no warning, identical to common patterns like dark-mode preference reads. Verified pattern: search the codebase for any prior localStorage-based render branch confirms expected behavior, and the React 19 docs section "[Bug?] Why am I getting a hydration mismatch?" explicitly covers this case.

### CLS prevention

The right side of the nav has two variants:

- **Anonymous:** `[Github icon] [Locale switcher] [Get started button] [Mobile menu]`
- **Signed-in:** `[Github icon] [Locale switcher] [Dashboard button] [Avatar 30px] [Mobile menu]`

The width delta is the 30px avatar + ~8px gap = ~38px.

Mitigation: add `min-width` to the `.nav-actions` container sized for the wider (signed-in) variant. Implementation:

1. Find the `.nav-actions` rule in the relevant styled-jsx block or global CSS file.
2. Add `min-width: <value>px` matching the signed-in layout.
3. Verify visually that anonymous users see no horizontal layout shift between SSR paint and post-mount; signed-in users see no shift on hint hit.

If the CSS source is hard to pinpoint, fallback: wrap the auth-conditional region (`{authState === "anonymous" ? ... : ...}`) in a `<div>` with `min-width: 168px; display: flex; justify-content: flex-end;` inline (the 168px is the measured width of `[Dashboard button] + [Avatar 30px]` plus standard gap; precise value to be confirmed during implementation).

### Out of scope

- **Phase A:** confirmed no-op for TTFB. Not shipped.
- **Phase B2 Edge runtime:** unnecessary once routes go static.
- **Phase C `'use cache: private'`:** same blocker as TUB-29.
- **Refactoring `SiteHeaderClient` visual structure:** the JSX inside the conditional branches stays byte-identical.
- **Touching `(app)/` route group:** TUB-28 territory, completed.
- **Touching `/docs` or `/changelog` content:** TUB-31 territory, completed.
- **Adding tests for the auth-hint helper:** the helper is a thin `localStorage` wrapper with try/catch. Manual prod verification covers the critical path; unit testing localStorage shims has low ROI here. Could be added later if we ever extract `auth-hint` into a more complex state machine.

## File touchpoints

May edit:

- `src/components/site-header.tsx` (server, ~40 lines deleted, no additions)
- `src/components/site-header-client.tsx` (client, ~60 lines added: hooks, effect, initials helper)
- `src/lib/auth-hint.ts` (new file, ~30 lines)
- One CSS source file for `.nav-actions` `min-width` (likely `src/app/globals.css` or a styled-jsx block; located during implementation)

Must NOT touch:

- `src/app/[locale]/(app)/**` (TUB-28 territory)
- `src/app/[locale]/{docs,changelog}/page.tsx` (TUB-31 territory)
- `messages/*.json` (i18n keys already correct)
- API routes, Supabase RLS, payment code, middleware
- `src/lib/supabase/server.ts` `getCachedUser` (still used by `(app)/` route group)

## Acceptance criteria

After deploy to production and verification:

### Performance (primary metric)

Run the Chrome MCP measurement script from `~/vault/references/tubemine-public-page-nav-perf-2026-05-21.md` §"Verification methodology" on `/en/pricing`. Click 5 alternating navigations between `/docs` and `/changelog`. Compute averages.

- **Average RSC TTFB across the 5 samples: <100ms** (Phase B target from Linear TUB-30 body).
- **Average total transition: <800ms** (Phase B target).
- **Baseline reference:** average TTFB 346ms, average total 1860ms.

Pass criteria: both averages strictly below target.

### Functional (smoke tests on prod)

- **Anonymous user, hard reload `/en/pricing`:** header renders `Get started` CTA. No `Dashboard` shown. No console error.
- **Anonymous user, click `/docs`:** transition completes, header still shows `Get started`. No flicker.
- **Sign in via `/login` flow:** after redirect to `/dashboard`, hint is set to `"signed-in"` (verify in DevTools Application → Local Storage).
- **Signed-in user, click `/pricing` from header:** Dashboard CTA + avatar appear without flicker (hint hit on first client render).
- **Signed-in user, hard reload `/en/changelog`:** Dashboard CTA + avatar appear immediately on hydration (hint hit). Background validation does not change state.
- **Signed-in user, open second tab, sign out in second tab, switch back to first tab:** within 1 render, first tab header swaps to `Get started`. `onAuthStateChange` listener confirmed.
- **CLS measurement:** Performance trace on `/en/pricing` cold load shows CLS <0.01. No layout shift between SSR paint and any client update.

### Build / lint

- `pnpm tsc --noEmit` clean.
- `pnpm lint` clean.
- `pnpm build` succeeds; build log shows the affected public-page routes as static or `prerendered` (look for the `○ /pricing`, `○ /docs`, etc. markers in Next.js build output, vs. the current `λ` marker indicating dynamic). If the build output still flags routes as dynamic for other reasons (locale handling, `setRequestLocale`, etc.), capture the output and verify in the deploy log that warm-navigation RSC fetches are now served as static responses (200 with cache-able headers).

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
| Hydration mismatch warning shows in browser console for returning signed-in users | Medium | Console noise, no functional break | Use `useState` lazy initializer pattern (verified above). If warning still appears, add `suppressHydrationWarning` to the specific element that branches on `authState`. |
| `onAuthStateChange` fires immediately on subscribe with current session and creates a double-render | Low | Brief extra render, no user impact | Compare new session to current state before calling `setAuthState`; React would bail out on identical setState anyway. |
| localStorage hint becomes stale after a backend-driven session revocation | Low | Brief wrong-state flicker on next visit, corrects after `getUser()` resolves | Acceptable. Same magnitude as the no-hint case. The validation `useEffect` runs unconditionally and corrects. |
| CSS `min-width` value picked is wrong, layout looks unbalanced for anonymous users | Medium | Visual nit, no functional break | During implementation, measure the signed-in layout width via DevTools, pick a value that matches exactly. Cross-check on mobile (the mobile drawer is a separate path and not affected). |
| Mobile drawer auth-conditional logic also needs the same treatment | High | Drawer shows wrong CTAs until client hydrates | Drawer JSX is inside `SiteHeaderClient` and uses the same `authState` state. Single source of truth. No extra change needed. |
| Pricing page or login page have additional server-side `cookies()` access that pins them dynamic | Medium | These specific pages still dynamic post-fix | Out of scope for this issue. TUB-30 acceptance focuses on `/docs` and `/changelog` (where the issue was measured). `/pricing` and `/login` follow-up only if their TTFB stays high. |

## References

- Measurement methodology: `~/vault/references/tubemine-public-page-nav-perf-2026-05-21.md`
- Parent research: `~/vault/references/nextjs16-perf-refactor-safe-rollout.md`
- Verification gate: `~/vault/feedback/qa-verify-on-prod-before-close.md`
- Linear issue: TUB-30
- Related: TUB-28 (app-shell INP, Done), TUB-29 (app-shell caching, Cancelled, same blocker as Phase C), TUB-31 (docs+changelog content, Done)
- TUB-28 commit defining `getCachedUser`: `340745e`
