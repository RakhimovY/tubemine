# TUB-32: Public routes static-migration sweep (follow-up to TUB-30)

**Date:** 2026-05-21
**Author:** turbo-pipeline
**Status:** draft
**Parent issue:** Linear TUB-32
**Predecessor:** TUB-30 (`docs/superpowers/specs/2026-05-21-tub-30-public-page-nav-perf-design.md`), commit `fc8e1045`

## 1. Goal

Eliminate `force-dynamic` from the two remaining high-traffic public routes (`/[locale]/pricing`, `/[locale]/page.tsx`), promote them to static prerender, and move all auth- and tier-dependent UI behind a client-hydration boundary using the proven TUB-30 lazy-auth pattern. Keep `/[locale]/login` dynamic with documented justification.

Baseline (Chrome MCP measurement, 2026-05-21 evening, after TUB-30 ship):

| Transition | TTFB | RSC size | Behaviour |
|---|---|---|---|
| /docs to /changelog | 171ms | 300 bytes | 304 cache HIT (static prerendered) |
| /changelog to /pricing | 274ms | 9337 bytes | fresh server render |
| /docs to /pricing | 359ms | 9338 bytes | fresh server render |
| /pricing to /changelog | 192ms | 22907 bytes | cached body |

`/docs` and `/changelog` shipped with TUB-30 lazy-hydration and prerender at build time. `/pricing` and `/` (landing) still emit `ƒ` in build manifest and pay 200-400ms server TTFB per navigation for the same `supabase.auth.getUser` + `getUserQuota` round-trip already removed from `SiteHeader`.

Target after this work:

- `/[locale]/pricing` average TTFB <120ms (within static-baseline band)
- `/[locale]/page.tsx` average TTFB <120ms
- Build manifest shows full-block (static) marker for both routes
- Zero regression in revenue path: `PricingIntentRedirect` post-OAuth `?intent=signup` flow still lands at `/api/checkout`
- Zero regression in tier-aware UX: anon, free, pro variants all render correctly on `/pricing`

## 2. Scope

### 2.1 In scope (TWO PRs)

**PR 1: `/[locale]/pricing` static migration**

- Remove `export const dynamic = "force-dynamic"` from `src/app/[locale]/pricing/page.tsx`
- Remove `loadAuthState` server helper (delete inline function + `createClient` import + `getUserQuota` import)
- Move all tier-conditional UI into a new client component `src/components/pricing-tier-aware.tsx`
- Refactor `PricingIntentRedirect` to consume client-resolved auth state (not server props)
- Reserve CLS-safe min-height on the CTA footer zones so anon -> signed-in swap does not shift the comparison table below

**PR 2: `/[locale]/page.tsx` (landing) static migration**

- Remove `export const dynamic = "force-dynamic"` from `src/app/[locale]/page.tsx`
- Remove `resolveHomeAuthState` server helper (delete inline function + `createClient` + `getUserQuota` imports)
- Remove the server `if (!isAnonymous) redirect(...)` hard redirect; move equivalent logic into a new client island `src/components/landing-auth-gate.tsx` that consumes `getAuthHint()` for instant client-side redirect when hint indicates signed-in
- Render `<TubeMine tier=...>` with anonymous tier by default. Wrap in a thin client wrapper that hydrates the actual tier (free or pro) after client resolution. The `tier` prop continues to come from a client-side resolved value, never from the server pass.
- `<DemoSampleResult>` rendered by default (anonymous-leaning). Client gate unmounts it after signed-in resolves on cold load (rare path: signed-in user with no hint hitting `/` directly).

**Shared infrastructure (extends, does not replace):**

- `src/lib/auth-hint.ts`: add `getTierHint(): "free" | "pro" | null` and `setTierHint(tier: "free" | "pro" | null): void`. Same localStorage idiom, new key `tubemine:tier-hint`. Same try/catch pattern, same SSR-safety (return `null` on server).
- No new files in `src/lib/` beyond the extension.
- No new API routes. Tier is read directly via the user-scoped Supabase client (`createClient` from `@/lib/supabase/client`), querying `from('profiles').select('tier').eq('user_id', user.id).maybeSingle()`. The existing RLS policy `"users read own profile"` on `public.profiles` (migration `00_init.sql:18`) makes this safe.

### 2.2 Out of scope (do NOT touch)

- `/[locale]/(app)/**` (dashboard, profile, history), TUB-28 territory, different caching path
- `/api/**` (all backend routes)
- Polar webhook handlers
- Supabase RLS policies (verified read-permitted, no change required)
- `src/components/site-header*.tsx` (just shipped via TUB-30 PR #5, locked)
- Most of `src/lib/auth-hint.ts` (extend ONLY by adding tier helpers; do not change existing binary auth-hint API)
- `src/lib/supabase/client.ts` (reuse)
- `src/lib/supabase/server.ts` (still used by API and app routes, not removed; just not imported by `/pricing` or `/` after migration)
- `src/lib/quota.ts` (server-only, marked `import "server-only"`, still used by API + app routes, do not modify)
- `src/components/landing-faq.tsx`, `src/components/tubemine.tsx`, `src/components/pricing-intent-redirect.tsx` body refactor (the latter changes only its props interface, not its useEffect logic)
- TUB-1 visual port section components on the landing page
- `README`, `package.json`, dependency list (no new packages)
- `/[locale]/docs`, `/[locale]/changelog`, `/[locale]/privacy`, `/[locale]/terms`, `/[locale]/oauth-intro` (already static)

### 2.3 Justification for keeping `/[locale]/login` dynamic

`src/app/[locale]/login/page.tsx` remains dynamic. Justification recorded in Linear TUB-32 closing comment:

1. Low-traffic page (auth gate, not a marketing surface)
2. Server-side `safe(next)` redirect for already-signed-in users is more reliable than the client equivalent (avoids brief render of login UI for users with active sessions)
3. OAuth callback endpoint and post-OAuth query routing (`?intent=signup&plan=pro`) depend on synchronous server-side parsing
4. Migration win would be marginal: redirecting to `/dashboard` server-side prevents the static page from ever rendering for signed-in users, which is the correct UX; client-only equivalent introduces a flash

Build manifest will continue to show this route as a function. This is an intentional, documented exception.

## 3. Architecture

### 3.1 Pattern (proven from TUB-30, extended for tier)

The TUB-30 `SiteHeader` -> `SiteHeaderClient` split established the public-page lazy-auth pattern. This work extends the same pattern to two additional routes, plus one new ingredient: client-side tier resolution via Supabase row-level access.

```
┌─ Server page (Static after migration) ─────────────────────────┐
│ - imports: NextLink, getTranslations, setRequestLocale,        │
│   IntlLink, LandingFaq, NEW client island                      │
│ - NO createClient, NO getUserQuota, NO force-dynamic           │
│ - renders skeleton/anon UI by default                          │
│ - reserves CLS-safe space for tier-conditional zones           │
│ - mounts client island and passes static props (translations)  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ Client island ("use client") ─────────────────────────────────┐
│ on mount (synchronous, 0-1ms):                                 │
│   hint = getAuthHint()           ← localStorage                │
│   tierHint = getTierHint()       ← localStorage                │
│   setState({ signedIn: hint === "signed-in", tier: tierHint }) │
│                                                                │
│ async useEffect (50-200ms):                                    │
│   sb = createClient()                                          │
│   { user } = await sb.auth.getUser()                           │
│   if (user):                                                   │
│     { data } = await sb.from("profiles")                       │
│       .select("tier").eq("user_id", user.id).maybeSingle()     │
│     tier = data?.tier === "pro" ? "pro" : "free"               │
│     setState({ signedIn: true, tier })                         │
│     setAuthHint("signed-in"); setTierHint(tier)                │
│   else:                                                        │
│     setState({ signedIn: false, tier: "anonymous" })           │
│     setAuthHint("anonymous"); setTierHint(null)                │
│                                                                │
│ onAuthStateChange listener:                                    │
│   on session change, re-run the resolve flow                   │
│   (handles sign-in / sign-out across tabs)                     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 `auth-hint.ts` extension (additive only)

Current file (`src/lib/auth-hint.ts`) exposes:

```ts
export type AuthState = "signed-in" | "anonymous"
export function getAuthHint(): AuthState | null
export function setAuthHint(state: AuthState): void
export function clearAuthHint(): void
```

After this work, it ADDITIONALLY exposes:

```ts
export type TierHint = "free" | "pro"
export function getTierHint(): TierHint | null
export function setTierHint(tier: TierHint | null): void  // null clears
export function clearTierHint(): void
```

Storage key: `tubemine:tier-hint`. Same try/catch SSR-safe pattern. No change to existing API surface. The TUB-30-shipped consumer (`site-header-client.tsx`) does NOT need to consume the tier hint and remains untouched.

### 3.3 `PricingTierAware` client island

File: `src/components/pricing-tier-aware.tsx`

Responsibilities:

1. Run the resolve flow (sync hint, async supabase fetch, listener subscribe)
2. Render the Free-card CTA footer (3 variants: anon, free, pro)
3. Render the Pro-card CTA footer (3 variants: anon, free, pro)
4. Render `PricingIntentRedirect` with client-resolved signedIn + tier
5. Expose tier state via React context to nested CTAs

Initial render (before hydration): the SERVER renders the anonymous variants in the CTA footers. That is the highest-traffic state and matches the lowest-friction default. Client hydration then SWAPS the variant in place when state resolves to signed-in. CLS reserved via `min-height: 88px` on the `.price-foot` div so the swap does not shift the comparison table below.

Public API:

```tsx
<PricingTierAware
  intent={sp.intent ?? null}           // forwarded to PricingIntentRedirect
  freeAnonCta={<IntlLink href="/login?intent=signup" ...>...</IntlLink>}
  freeFreeCta={<><IntlLink href="/dashboard" ...>...</IntlLink><p>...</p></>}
  freeProCta={<><IntlLink href="/dashboard" ...>...</IntlLink><p>...</p></>}
  proAnonCta={<><IntlLink ...>...</IntlLink><p>...</p></>}
  proFreeCta={<><form action="/api/checkout" ...><button>...</button></form><p>...</p></>}
  proProCta={<><NextLink href="/api/portal" ...>...</NextLink><p>...</p></>}
>
  ...children: the static layout (hero, comparison table, FAQ, footer)
</PricingTierAware>
```

This shape keeps i18n translations in the server scope (where `getTranslations` already runs) and lets the server stamp out the static markup; the client only swaps which slot is visible.

Alternative considered and REJECTED: render the static page entirely server-side with all three variants present and toggle visibility via CSS classes set by a tiny `<script>` that reads localStorage before hydration. Rejected because (a) it ships triple the CTA markup on every render, (b) requires inline non-React JS to avoid hydration mismatch, (c) cross-tab sync via `onAuthStateChange` still needs the React island anyway.

### 3.4 `PricingIntentRedirect` refactor

Current contract (`src/components/pricing-intent-redirect.tsx`):

```tsx
useEffect(() => {
  if (intent === "signup" && signedIn && tier !== "pro") {
    window.location.assign("/api/checkout")
  }
}, [intent, signedIn, tier])
```

After refactor: same useEffect, but `signedIn` and `tier` are consumed from the `PricingTierAware` client context (not from server props). The component mounts INSIDE `PricingTierAware` and reads context, so its effect re-fires when client auth resolution completes. This preserves the revenue path while allowing the page to render statically.

The timing change: today the effect fires once on server-rendered values (instant). After refactor, it fires once with initial (cached hint or anon) values, then re-fires after async auth resolves (typically 100-300ms). The redirect to `/api/checkout` still happens within the same page load, just shifted ~300ms later. For the rare-but-real flow `OAuth callback -> /pricing?intent=signup&plan=pro -> /api/checkout`, the visible behaviour is: brief pricing page render, then checkout redirect. Functionally equivalent to today's "server resolves -> hits same redirect" path.

### 3.5 `LandingAuthGate` client island

File: `src/components/landing-auth-gate.tsx`

Responsibilities:

1. Run the resolve flow
2. On signed-in resolved (either from cached hint instantly, or from async supabase fetch), call `router.replace("/{locale}/dashboard")`
3. While anonymous (default): render children (the landing page content) and `<TubeMine tier="anonymous">`
4. While signed-in pending or resolving: render `null` (the redirect is in flight)

Default behaviour for cold load with no hint: render landing content for ~150ms while supabase resolves, then redirect if signed-in. This is the worst case for a returning signed-in user who lost localStorage. Mitigated by the hint mechanism: once any session is ever established on the device, the hint persists and the redirect is instant on subsequent visits.

Note on `<TubeMine>` tier: today the server passes a real tier ("free" or "pro") when signed-in. After migration, signed-in users get redirected to `/dashboard` before `<TubeMine>` matters, so the only `<TubeMine>` ever rendered is the anonymous one. Tier is hard-coded to `"anonymous"` for landing. The signed-in `<TubeMine>` lives at `/dashboard`. If the redirect is ever bypassed (e.g. user explicitly navigates back to `/`), they re-experience the redirect on next mount.

### 3.6 Public API of new files

```
src/components/pricing-tier-aware.tsx
  export function PricingTierAware(props): JSX.Element

src/components/landing-auth-gate.tsx
  export function LandingAuthGate({ children }: { children: ReactNode }): JSX.Element | null

src/lib/auth-hint.ts (extended)
  // existing exports unchanged
  export type TierHint = "free" | "pro"
  export function getTierHint(): TierHint | null
  export function setTierHint(tier: TierHint | null): void
  export function clearTierHint(): void
```

## 4. Data flow

### 4.1 `/[locale]/pricing` after migration

Cold visit, anonymous user, no hint:

1. Server renders static page in <50ms with anonymous variants pre-stamped in CTA slots
2. Client mounts, `getAuthHint()` returns null, `getTierHint()` returns null
3. `setState({ signedIn: false, tier: "anonymous" })`, no UI change (matches server)
4. Async `sb.auth.getUser()` returns null
5. `setAuthHint("anonymous"); setTierHint(null)`
6. No redirect, no state swap; user sees the page

Cold visit, signed-in free user, no hint:

1. Server renders static page with anonymous variants
2. Client mounts, both hints null, state stays anonymous
3. Async `sb.auth.getUser()` returns user
4. Async `sb.from("profiles").select("tier")` returns `{ tier: "free" }`
5. `setState({ signedIn: true, tier: "free" })`
6. CTA slots swap from anon to free variant (`min-height` reserves prevent table shift)
7. `setAuthHint("signed-in"); setTierHint("free")`

Warm visit, signed-in free user, hint present:

1. Server renders static page with anonymous variants (server has no knowledge of hint)
2. Client mounts, `getAuthHint() === "signed-in"`, `getTierHint() === "free"`
3. Sync `setState({ signedIn: true, tier: "free" })`, CTA slots swap in same tick (no async wait)
4. Async fetch confirms (no UI change unless tier actually drifted)

Post-OAuth landing flow `/login?intent=signup&plan=pro` -> callback -> `/pricing?intent=signup`:

1. Server renders static `/pricing` page (cannot know `?intent`-resolved-to-checkout-redirect intent at server because page is static)
   - Note: `searchParams.intent` is still readable at server, but since the page is static, `searchParams` are forwarded to the client via the `intent` prop on `PricingTierAware`. Static prerender + searchParams = fine in Next.js 16 (the prerender does not bake searchParams; they are deserialized client-side from the URL by the framework when the page hydrates).
2. Client mounts, hint says signed-in (set during OAuth handoff), or hint is missing
3. `PricingIntentRedirect` mounts inside `PricingTierAware`, reads context
4. Once async resolves to `signedIn=true && tier="free"`, `useEffect` fires `window.location.assign("/api/checkout")`
5. User lands at `/api/checkout` and proceeds to Polar

Timing: server render <50ms, client resolve ~100-300ms, then redirect. Total: same order of magnitude as today's server-side `loadAuthState` path (~250-400ms). Net result: slightly slower for this specific OAuth-handoff flow, MUCH faster for all other (cold/warm anonymous + warm signed-in) visits.

### 4.2 Pricing static + searchParams interaction

A static route can still receive `searchParams` in Next.js App Router. The server function signature today is:

```ts
export default async function PricingPage({ params, searchParams }) {
  const sp = await searchParams
  ...
  <PricingIntentRedirect intent={sp.intent ?? null} ... />
}
```

After migration, this still works. The page is statically prerendered for the empty-searchParams variant (which is the cache key). When the user arrives with `?intent=signup`, the prerendered HTML is served, then `searchParams` are made available to the client during hydration. Next.js does this by serializing the URL's query into the React payload at request time without re-rendering the page. The `intent` prop forwarded to `PricingTierAware` is the source of truth for the client island.

Verification step (in plan phase): build locally and inspect that `/pricing?intent=signup` returns the prerendered HTML body with searchParams accessible via the URL.

### 4.3 `/[locale]/page.tsx` (landing) after migration

Cold visit, anonymous user, no hint:

1. Server renders static landing page in <50ms with anonymous content (TubeMine tier="anonymous", DemoSampleResult visible)
2. Client mounts in `LandingAuthGate`, hint null
3. Async `sb.auth.getUser()` returns null
4. `setAuthHint("anonymous")`, no redirect, no UI change

Cold visit, signed-in user, no hint:

1. Server renders static anonymous landing
2. Client mounts, hint null
3. Async `sb.auth.getUser()` returns user (~100-200ms)
4. `setAuthHint("signed-in"); setTierHint(<tier>)`
5. `router.replace("/{locale}/dashboard")` fires

The brief flash (~150ms) is the documented worst case. Acceptable because (a) it's the cold-load edge case, (b) any returning signed-in user gets the instant-hint path on subsequent visits, (c) the TUB-30 redirect-via-server today blocks rendering entirely on every visit while the auth check runs (~300ms), so the cumulative UX impact is comparable.

Warm visit, signed-in user, hint says signed-in:

1. Server renders static landing
2. Client mounts in `LandingAuthGate`, hint sync says signed-in
3. `useLayoutEffect` (or pre-paint effect) calls `router.replace("/{locale}/dashboard")` immediately on mount
4. User sees landing for ~16-32ms (one paint), then is redirected
5. Async supabase confirms in background; if stale (user signed out elsewhere), the dashboard route's own gate handles the contradiction (already handled by `(app)/layout.tsx`'s auth check, which is dynamic and authoritative)

The "hint says signed-in but supabase says anonymous" race is benign: dashboard route will redirect back to `/login` if session is invalid. The user experiences `/  -> /dashboard -> /login`. Today's flow for the same race: `/` server-side redirects to `/dashboard`, dashboard redirects to `/login`. Same sequence, same UX.

## 5. Error handling

| Failure | Behaviour | Why |
|---|---|---|
| `createClient()` throws (missing env vars) | Render anonymous variant; do not call supabase | Matches today's behaviour: `loadAuthState` returns `anonymous` when env is missing |
| `sb.auth.getUser()` returns error | Catch, render anonymous variant, do not update hint | Network or supabase outage; default to safe state |
| `sb.from("profiles").select("tier")` returns error | Catch, set tier to `"free"` for signed-in users (optimistic), set hint accordingly | RLS misconfig or DB outage; "free" is the lower-privilege optimistic default. The user's actual access is still gated server-side by `/api/checkout`, `/api/portal`, and `(app)/*` layouts, so misreading tier here only affects which CTA renders, not what the user can do |
| `localStorage.getItem` throws (private browsing, quota) | `getAuthHint`/`getTierHint` returns null; fall through to async resolve | Existing `auth-hint.ts` behaviour |
| `localStorage.setItem` throws | Silently ignore; state still in React | Existing `auth-hint.ts` behaviour |
| User signs out in another tab | `onAuthStateChange` fires with null session; client island re-resolves to anonymous, clears hint | Cross-tab sync (TUB-30 pattern) |

## 6. Testing

### 6.1 Tier 1 (automated, executed in plan phase by Chrome MCP)

Per `~/vault/references/tubemine-public-page-nav-perf-2026-05-21.md`, section "Verification methodology":

For each fixed route after deploy READY:

1. Hard-reload prod URL
2. Run the 5-transition Performance API loop measuring TTFB + total time
3. Assert: average TTFB <120ms (within static-baseline band)
4. Assert: build manifest from `pnpm build` output shows the route in the static-route list (full-block, not function marker)

Specific assertions per route:

**`/pricing` (PR 1):**
- Anonymous visit: page renders with anon CTAs (`Get started for free` text)
- Sign in as Free test account, hard-reload `/en/pricing`: page renders with `Open dashboard` on Free card AND `Start trial` on Pro card
- (Pro variant: manual Tier 2 check, see below)
- `/en/pricing?intent=signup` while signed-in: redirects to `/api/checkout` within 500ms of page load
- Build manifest shows `/[locale]/pricing` as static

**`/` landing (PR 2):**
- Anonymous visit: renders landing hero, TubeMine extractor (anon tier), DemoSampleResult visible
- Sign in, navigate to `/en`: redirects to `/en/dashboard` within 500ms
- Build manifest shows `/[locale]` as static

### 6.2 Tier 2 (manual, documented for user)

These checks require account states the agent cannot create:

1. **Pro user on `/pricing`:** user manually upgrades a test account to Pro tier in Supabase, then hard-reloads `/en/pricing`. Expected: Free card shows `Open dashboard` button + Pro-note; Pro card shows `Manage subscription` button (linking to `/api/portal`).
2. **`Start trial` click as Free user on `/pricing`:** click button, verify redirect to Polar checkout. Verify Polar session is created for the right user.
3. **Cross-tab sign-out during `/pricing` view:** open `/pricing` in tab A while signed in. Sign out in tab B. Tab A's CTAs swap back to anon variant within ~1s via `onAuthStateChange`.

These are deferred to the user with explicit instructions in the Linear closing comment.

### 6.3 Regression sentinels

Run these after both PRs land:

- `/docs`, `/changelog`, `/privacy`, `/terms`, `/oauth-intro` still render as static, still navigate fast (TUB-30 work unchanged)
- `/(app)/dashboard`, `/(app)/profile`, `/(app)/history` still gated server-side by `createClient` in `(app)/layout.tsx` (unchanged)
- `/api/checkout`, `/api/portal`, `/api/export`, `/api/analyses/*` still respond correctly (unchanged)

## 7. Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| `PricingIntentRedirect` race condition: user lands at `/pricing?intent=signup`, client tier resolution takes too long, user clicks something else, redirect never fires | Medium (revenue path) | Plan-phase TDD test simulating the flow; visual smoke test on prod with real Google OAuth account before merge |
| Pro user sees `Start trial` button briefly while client tier resolves | Low (cosmetic) | `getTierHint()` returns `"pro"` for warm visits; cold visits get ~200ms of `Start trial` then swap. Documented as acceptable for a non-critical visual transition |
| Tier hint becomes stale across sessions (user upgrades on device A, opens device B with old `free` hint) | Low | `onAuthStateChange` listener triggers re-resolve on next session event; worst case user reloads page and hint refreshes after async fetch |
| RLS policy change in future migration breaks client-side `select tier` | Medium | Plan-phase verification step adds a comment in `pricing-tier-aware.tsx` referencing the RLS policy by name, so future migration authors notice the dependency |
| Hydration mismatch warning if server renders anon variant but client immediately swaps based on hint | Medium | Use `suppressHydrationWarning` on the variant container (proven from `site-header-client.tsx`); render anon by default at server, swap after mount in `useEffect` (post-hydration), never inline. CLS-safe min-height prevents layout damage |
| Searchparam handling breaks when page is static | Medium | Plan-phase build-and-curl test: `pnpm build && pnpm start` locally, curl `/en/pricing?intent=signup`, verify the prerendered HTML is served and that `intent` reaches `PricingTierAware` via client deserialization |
| Landing page redirect flash for cold signed-in visits | Low | Documented in spec § 4.3; mitigated by hint mechanism on warm visits. Cold flash is bounded to ~150ms |
| /api/checkout backend assumes a known signed-in user; if client tier resolution decides wrong tier, checkout might fail or double-charge | Low | `/api/checkout` is the source of truth for purchase; it reads user's tier from server-side `getUserQuota` independently. Client-side tier hint here is presentational only |

## 8. File-level change list

### 8.1 PR 1: `/pricing` migration

**Modified:**
- `src/app/[locale]/pricing/page.tsx`:
  - Remove `import { createClient } from "@/lib/supabase/server"` (line 6)
  - Remove `import { getUserQuota } from "@/lib/quota"` (line 7)
  - Remove `type AuthTier`, `type AuthState`, `async function loadAuthState` block (lines 12-36)
  - Remove `export const dynamic = "force-dynamic"` (line 38)
  - Remove `const state = await loadAuthState()` call (line 81)
  - Replace tier-conditional JSX in `.price-foot` divs (lines 182-215 for Free card, 254-285 for Pro card) with a single new `<PricingTierAware ...>...</PricingTierAware>` wrapper that contains slots for all variants
  - Remove direct render of `<PricingIntentRedirect intent={...} signedIn={...} tier={...} />` at line 130 (moved inside `PricingTierAware`)
  - Keep all other rendering, FAQ, comparison table, footer unchanged

- `src/components/pricing-intent-redirect.tsx`:
  - Change props from `intent, signedIn, tier` to `intent` only
  - Add internal `useContext(PricingTierContext)` to read signedIn + tier from sibling context

- `src/lib/auth-hint.ts`:
  - Add `TierHint` type, `getTierHint`, `setTierHint`, `clearTierHint` functions

**New:**
- `src/components/pricing-tier-aware.tsx`:
  - `"use client"` directive
  - `PricingTierContext` with `signedIn: boolean, tier: "anonymous" | "free" | "pro"`
  - `PricingTierAware` component that runs the resolve flow and provides context
  - Internal CTA-slot rendering based on context value

### 8.2 PR 2: `/` landing migration

**Modified:**
- `src/app/[locale]/page.tsx`:
  - Remove `import { createClient } from "@/lib/supabase/server"` (line 5)
  - Remove `import { getUserQuota } from "@/lib/quota"` (line 6)
  - Remove `import { redirect } from "next/navigation"` (line 1) if no other use remains
  - Remove `type HomeAuthState`, `async function resolveHomeAuthState` (lines 15-35)
  - Remove `export const dynamic = "force-dynamic"` (line 13)
  - Remove `const { tier, isAnonymous } = await resolveHomeAuthState()` (line 58)
  - Remove `if (!isAnonymous) redirect(...)` (lines 61-63)
  - Wrap the entire `<main>...</main>` body in `<LandingAuthGate>...</LandingAuthGate>`
  - Replace `<TubeMine tier={tier} />` with `<TubeMine tier="anonymous" />` (signed-in users never see this because the gate redirects them)
  - Replace `{isAnonymous ? <DemoSampleResult ... /> : null}` and `{isAnonymous ? <div className="demo-sample-strip">...</div> : null}` with unconditional render (gate ensures only anonymous users see this code path)
  - Replace `<IntlLink href={isAnonymous ? "/login?intent=signup" : "/dashboard"} ...>` and the conditional text with unconditional anon variant (same reason)

**New:**
- `src/components/landing-auth-gate.tsx`:
  - `"use client"` directive
  - Hook into `useRouter` from `@/i18n/navigation`
  - Hook into `useLocale` from `next-intl`
  - `useLayoutEffect` to check `getAuthHint()` synchronously and call `router.replace` if signed-in (for warm hint)
  - `useEffect` to do async supabase resolve; redirect if signed-in
  - Render `children` (the landing content) when state is anonymous, render `null` when redirecting

## 9. Migration safety

### 9.1 Ordering

PRs ship sequentially, NOT concurrently:

1. **PR 1 (`/pricing`)** ships, deploys to prod, verifies via Tier 1 + Tier 2 manual.
2. Wait for at least one Polar checkout to complete from a real user OR document the 24h post-merge observation window in Linear before starting PR 2.
3. **PR 2 (`/landing`)** ships, deploys to prod, verifies via Tier 1.

The /pricing PR has the higher-risk revenue path. We want to land it cleanly and observe before stacking another change on top.

### 9.2 Rollback

Each PR is one commit on `main`. Rollback = `git revert <sha>` + push. The `auth-hint.ts` extension is additive only; revert is safe even if a downstream consumer was added (it would just lose the helper functions).

Concrete rollback signals (in priority order):

1. Sentry error rate on `/pricing` or `/` rises by >2x baseline within 1 hour of deploy
2. Polar checkout success rate drops by >10% in the first 24h
3. User report of "I see the wrong CTA / I cannot upgrade / I cannot manage subscription"

Tier 2 manual checks at deploy time are designed to catch (3) before users do.

### 9.3 No-database-migration guarantee

This work touches ZERO database migrations. Existing RLS policies (`00_init.sql` lines 18, 47, 85) already permit users to read own profile, usage, subscription. We rely on this; we do not change it.

### 9.4 No-API-change guarantee

This work touches ZERO server API routes. `/api/checkout`, `/api/portal`, `/api/export`, `/api/analyses/*`, `/auth/callback` all remain unchanged. Client-side calls to these endpoints continue to work because they consume HTTP cookies (set by supabase session), not React props.

## 10. Workflow

### 10.1 Commit strategy

Per shipping convention used in TUB-30 and TUB-31, direct-to-main commits, not feature branches. Each PR = one commit on main. PR title format `perf(tub-32): <route> static migration via lazy auth hydration`.

### 10.2 Build verification gate (before each commit)

Before pushing a commit, run `pnpm build` locally. Inspect the route table in the output:

- For PR 1: assert `/[locale]/pricing` appears under the static-route block, NOT the function block
- For PR 2: assert `/[locale]` (the root locale page) appears under the static-route block, NOT the function block

If the route still shows as a function, the fix is incomplete. Diagnose: most likely a residual `createClient` or `cookies()` import. Re-grep.

### 10.3 Verify-on-prod gate (after each push)

Per `~/vault/feedback/qa-verify-on-prod-before-close.md`:

1. Push to main
2. Wait for Vercel deploy to reach READY (poll via `mcp__vercel__list_deployments`)
3. Hard-reload prod URL via Chrome MCP `navigate`
4. Run JS assertion via `javascript_tool` proving the symptom is gone:
   - Anonymous variant rendered for incognito visit
   - Signed-in variant rendered after sign-in flow
   - Build manifest assertion (separately, from `pnpm build` local output)
5. Take screenshot for visual sanity
6. Only THEN mark the Linear sub-task complete

### 10.4 Linear tracking

Create issue TUB-32 with this spec linked. Move to In Progress immediately after spec phase clears.

After PR 1 ships + verifies: post Linear comment with commit SHA + Tier 1 assertion data + Tier 2 manual check status.

After PR 2 ships + verifies: post Linear comment with commit SHA + Tier 1 assertion data. Move issue to Done with the closing comment listing:
- Both commit SHAs
- Routes audited (full list from § 2.1, § 2.2)
- Before/after TTFB per fixed route
- Justification for keeping `/login` dynamic
- Build manifest excerpt showing static markers
- Any subtleties surfaced during implementation

### 10.5 Vault note hand-off

Append session summary to `~/vault/daily/2026-05-21.md` (append mode) with:
- Routes fixed (commit SHAs + before/after TTFB)
- Linear issue final status
- Subtleties (e.g. if PricingIntentRedirect required adjustment beyond what this spec anticipates)

## 11. Hard constraints (must be enforced through implementation)

1. **No em-dash anywhere.** All outputs (source files, commits, PR descriptions, Linear comments, vault notes) use `,` `.` `()` `:` `-`. Banned codepoints: U+2014 and U+2013.
2. **No new dependencies.** Reuse `auth-hint.ts` (extending only), `supabase/client.ts`, `next-intl`, `@/i18n/navigation`. No new packages.
3. **No new API routes.** Tier resolution via direct supabase query.
4. **One PR per route fixed.** PR 1 = `/pricing`. PR 2 = `/landing`. Each merges and verifies independently.
5. **Build manifest assertion before each commit.** `pnpm build` must show static marker for the route being migrated, otherwise the fix is incomplete.
6. **Verify-on-prod after each push.** Chrome MCP DOM assertion is the gate, not deploy READY.
7. **PricingIntentRedirect is the revenue path.** If the client-resolution timing breaks the post-OAuth checkout flow in a way the manual smoke test detects, DO NOT proceed; fix or revert.

## 12. Open items deferred to plan phase

These are decisions the plan phase will resolve:

1. Exact JSX shape of `<PricingTierAware>` props (named slot props vs render-prop pattern). Spec gives a named-slot example; plan will commit.
2. Whether the tier hint refresh on `onAuthStateChange` should also re-query `from("profiles")` or trust the cached value until next cold reload. Spec recommends re-query for correctness; plan will write the code.
3. Whether `LandingAuthGate` uses `useLayoutEffect` (synchronous, pre-paint) or `useEffect` (post-paint) for the hint-based redirect. `useLayoutEffect` minimizes flash but triggers React's SSR warning. Plan will resolve via a `typeof window !== "undefined"` guard or framework-specific helper.
4. Whether `<TubeMine tier="anonymous">` on the landing page needs any prop-rename or type adjustment to make the literal-string-anonymous-only contract explicit. Plan will inspect `<TubeMine>` props more carefully.
