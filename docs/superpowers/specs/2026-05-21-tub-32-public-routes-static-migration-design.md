# TUB-32: Public routes static-migration sweep (follow-up to TUB-30)

**Date:** 2026-05-21
**Author:** turbo-pipeline
**Status:** draft (round 1 review applied)
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
- Build manifest shows static (`●`) marker for both routes, not function (`ƒ`)
- Zero regression in revenue path: `PricingIntentRedirect` post-OAuth `?intent=signup` flow still lands at `/api/checkout`
- Zero regression in tier-aware UX: anon, free, and effective-pro variants (including revoked-subscription downgrade) all render correctly on `/pricing`

## 2. Scope

### 2.1 In scope (TWO PRs)

**PR 1: `/[locale]/pricing` static migration**

- Remove `export const dynamic = "force-dynamic"` from `src/app/[locale]/pricing/page.tsx`
- Remove `loadAuthState` server helper (delete inline function, `createClient` import, `getUserQuota` import)
- Remove `searchParams` from the page's server signature entirely. Read `?intent=signup` client-side via `useSearchParams()` inside the new client island (Next.js 16 opts a route into dynamic rendering when the server component awaits `searchParams`; we must avoid this to ship static prerender)
- Move all tier-conditional UI into one client component `src/components/pricing-tier-aware.tsx`. That component owns the auth+tier resolution AND renders the tier-conditional CTAs itself (calls `useTranslations("pricing")`)
- Refactor consumption of `PricingIntentRedirect`: keep its existing 3-prop interface (`intent`, `signedIn`, `tier`); render it as a direct child of `PricingTierAware` so it receives client-resolved state through plain props. No new React context.
- Reserve CLS-safe min-height on the CTA footer zones so anon to signed-in swap does not shift the comparison table below

**PR 2: `/[locale]/page.tsx` (landing) static migration**

- Remove `export const dynamic = "force-dynamic"` from `src/app/[locale]/page.tsx`
- Remove `resolveHomeAuthState` server helper (delete inline function + `createClient` + `getUserQuota` imports)
- Remove the server `if (!isAnonymous) redirect(...)` hard redirect
- Replace with a tiny client island `src/components/landing-auth-gate.tsx` that does ONLY a synchronous `getAuthHint()` check on mount and calls `router.replace("/dashboard")` when the hint says signed-in. No async supabase fetch, no `onAuthStateChange` listener, no tier resolution. Justification: (a) the only signed-in path to landing is direct address-bar typing (rare), (b) returning signed-in users have a warm localStorage hint set by `SiteHeaderClient` on every page, (c) cold-load signed-in visitors without a hint accept the trade of seeing the landing (Linear, Vercel, and other SaaS commonly show their landing to signed-in users; missing the redirect on a rare path is preferable to a 500-2000ms supabase round-trip on every cold visit)
- Render `<TubeMine tier="anonymous">` unconditionally inside `LandingAuthGate`. Signed-in users with a warm hint never see this rendered; signed-in users without a hint see the anonymous extractor (acceptable, same UX as a brand-new signup), and can use the header link to navigate to dashboard
- Render `<DemoSampleResult>` and the demo sample strip unconditionally (gate ensures the typical signed-in user is redirected away before this code path is rendered)
- Remove all `isAnonymous` server-side conditionals from the page; the only state ever rendered is the anonymous variant

**Shared infrastructure: no new shared module**

- `src/lib/auth-hint.ts` is NOT extended in this work. Tier is resolved fresh on each `/pricing` visit via supabase (no localStorage caching of tier).
- No new API routes. Tier is read directly via the user-scoped Supabase client (`createClient` from `@/lib/supabase/client`), querying `from('profiles').select('tier').eq('user_id', user.id).maybeSingle()` AND `from('subscriptions').select('status').eq('user_id', user.id).maybeSingle()` in parallel. Both queries pass under existing "users read own" RLS policies (`supabase/migrations/00_init.sql` lines 18 + 85).
- The same `effectiveTier` revocation rule used in `src/lib/quota.ts:35-54` is applied on the client: `profile.tier === "pro" && subscription.status === "revoked"` -> effective "free".

### 2.2 Out of scope (do NOT touch)

- `/[locale]/(app)/**` (dashboard, profile, history), TUB-28 territory, different caching path
- `/api/**` (all backend routes)
- Polar webhook handlers
- Supabase RLS policies (verified read-permitted, no change required)
- `src/components/site-header*.tsx` (just shipped via TUB-30 PR #5, locked)
- `src/lib/auth-hint.ts` (no extension this round; sentinel imports remain as-is)
- `src/lib/supabase/client.ts` (reuse)
- `src/lib/supabase/server.ts` (still used by API and app routes, not removed; just not imported by `/pricing` or `/` after migration)
- `src/lib/quota.ts` (server-only, marked `import "server-only"`, still used by API + app routes, do not modify)
- `src/components/landing-faq.tsx`, `src/components/tubemine.tsx`, `src/components/pricing-intent-redirect.tsx` body (the latter keeps its existing 3-prop interface and its existing useEffect logic; only its parent changes)
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

The TUB-30 `SiteHeader` to `SiteHeaderClient` split established the public-page lazy-auth pattern. This work extends the same pattern to two routes, plus one new ingredient: client-side tier resolution via direct Supabase row-self-read.

#### `/pricing` data flow

```
┌─ Server page (Static after migration) ─────────────────────────┐
│ - imports: NextLink, getTranslations, setRequestLocale,        │
│   IntlLink, LandingFaq, PricingTierAware                       │
│ - NO createClient, NO getUserQuota, NO force-dynamic, NO       │
│   searchParams in signature                                    │
│ - renders static layout (hero, comparison table, FAQ, footer)  │
│ - mounts <PricingTierAware /> at the CTA-zone location;        │
│   that island renders the CTAs internally                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ PricingTierAware ("use client") ──────────────────────────────┐
│ const t = useTranslations("pricing")                           │
│ const searchParams = useSearchParams()                         │
│ const intent = searchParams.get("intent")                      │
│                                                                │
│ const [state, setState] = useState({                           │
│   signedIn: getAuthHint() === "signed-in",                     │
│   tier: getAuthHint() === "signed-in" ? "free" : "anonymous"   │
│ })                                                             │
│ // Initial state: optimistic 'free' for warm-hint signed-in    │
│ // visitors so they don't see a Start-trial->Open-dashboard    │
│ // re-swap. Cold visitors render anonymous (lowest friction).  │
│                                                                │
│ useEffect(() => {                                              │
│   const sb = createClient()                                    │
│   const { data: { user }, error } = await sb.auth.getUser()    │
│   if (error || !user) {                                        │
│     setState({ signedIn: false, tier: "anonymous" })           │
│     setAuthHint("anonymous")                                   │
│     return                                                     │
│   }                                                            │
│   const [profileQ, subQ] = await Promise.all([                 │
│     sb.from("profiles").select("tier")                         │
│       .eq("user_id", user.id).maybeSingle(),                   │
│     sb.from("subscriptions").select("status")                  │
│       .eq("user_id", user.id).maybeSingle(),                   │
│   ])                                                           │
│   const rawTier = profileQ.data?.tier === "pro" ? "pro" : "free"│
│   const isRevoked = rawTier === "pro" &&                       │
│     subQ.data?.status === "revoked"                            │
│   const effective = isRevoked ? "free" : rawTier               │
│   setState({ signedIn: true, tier: effective })                │
│   setAuthHint("signed-in")                                     │
│ }, [])                                                         │
│                                                                │
│ sb.auth.onAuthStateChange listener:                            │
│   on session change, re-run the resolve flow                   │
│                                                                │
│ Render:                                                        │
│   <PricingIntentRedirect intent={intent}                       │
│     signedIn={state.signedIn} tier={state.tier} />             │
│   <FreeCardCta tier={state.tier} t={t} />                      │
│   <ProCardCta tier={state.tier} t={t} />                       │
└─────────────────────────────────────────────────────────────────┘
```

#### `/` landing data flow

```
┌─ Server page (Static after migration) ─────────────────────────┐
│ - imports: NextLink, getTranslations, setRequestLocale,        │
│   IntlLink, LandingFaq, LandingSmoothScroll, LandingAuthGate,  │
│   TubeMine                                                     │
│ - NO createClient, NO getUserQuota, NO force-dynamic, NO       │
│   redirect import (unless used elsewhere on the page)          │
│ - renders the static anonymous landing inside the gate         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ LandingAuthGate ("use client") ───────────────────────────────┐
│ const router = useRouter()  // from @/i18n/navigation          │
│ const [redirecting, setRedirecting] = useState(false)          │
│                                                                │
│ useEffect(() => {                                              │
│   const hint = getAuthHint()                                   │
│   if (hint === "signed-in") {                                  │
│     setRedirecting(true)                                       │
│     router.replace("/dashboard") // next-intl auto-locale      │
│   }                                                            │
│ }, [router])                                                   │
│                                                                │
│ if (redirecting) return null                                   │
│ return <>{children}</>                                         │
└─────────────────────────────────────────────────────────────────┘
```

`LandingAuthGate` is 15 LOC. It does NOT call supabase. It does NOT subscribe to `onAuthStateChange`. The only signal is the localStorage hint set by `SiteHeaderClient` on every page (per TUB-30 contract).

### 3.2 `PricingTierAware` component

File: `src/components/pricing-tier-aware.tsx`

Responsibilities:

1. Run the resolve flow (sync hint, async supabase fetch with both profile + subscription rows, listener subscribe)
2. Render the Free-card and Pro-card CTA footers internally, using `useTranslations("pricing")` and conditional logic. No slot props.
3. Render `PricingIntentRedirect` as a direct child with plain props (`intent`, `signedIn`, `tier`). No context.
4. Read `?intent=signup` via `useSearchParams()` from `next/navigation` (NOT next-intl's; this is for query params only).

Public API:

```tsx
<PricingTierAware />
```

Zero props. The component does its own translation lookup and reads URL state via `useSearchParams()`. The server page mounts it at the two CTA locations (or once, with both card footers rendered internally), positioned via existing CSS layout.

Mounting strategy: rather than two separate `<PricingTierAware>` instances (one per card, each running its own resolve flow), mount ONE instance that renders BOTH card footers from a single state. The server page provides slot containers `<div className="price-foot" />` for each card; `PricingTierAware` portals or directly renders into them. Simplest implementation: the server page passes the entire `<article className="price-card">` structure through `PricingTierAware`'s `children` prop using a small render-helper that returns Free card + Pro card. After plan-phase analysis of CSS dependencies, we may settle on either:

- (a) `PricingTierAware` renders the entire pricing grid section (both `<article>` cards) internally, with the server only mounting `<PricingTierAware />` at that location; OR
- (b) Two sibling instances (`<PricingTierAware variant="free-card" />` and `<PricingTierAware variant="pro-card" />`) that share state via a tiny module-level zustand-like store (without adding zustand: a plain React context exposed by a third `<PricingTierProvider>` wrapper).

The spec recommends (a) for simplicity (one resolve flow, one listener, one state owner). Plan phase commits.

CLS prevention: reserve `min-height: 88px` on each `.price-foot` div so the variant swap on hydration does not shift the comparison table below.

### 3.3 `PricingIntentRedirect` (unchanged interface)

File: `src/components/pricing-intent-redirect.tsx`

Existing 3-prop interface is preserved:

```tsx
useEffect(() => {
  if (intent === "signup" && signedIn && tier !== "pro") {
    window.location.assign("/api/checkout")
  }
}, [intent, signedIn, tier])
```

Mounted as a direct child of `PricingTierAware`, receiving `signedIn` and `tier` from `PricingTierAware`'s state. When state updates after async resolve, the `useEffect` re-fires and dispatches the checkout redirect.

Timing change vs today: today the effect fires once on server-rendered values (instant). After refactor, it fires once with initial values (anonymous on cold, optimistic free on warm-hint), then re-fires after async resolve completes (typically 100-300ms; up to 1500ms on a slow network). The redirect to `/api/checkout` still happens within the same page load.

### 3.4 `LandingAuthGate` component

File: `src/components/landing-auth-gate.tsx`

Responsibilities:

1. On mount, read `getAuthHint()` synchronously
2. If hint says signed-in, call `router.replace("/dashboard")` (locale auto-resolved by next-intl)
3. While redirecting, render `null` to avoid the landing flashing into view for the warm-hint signed-in case
4. Otherwise render `children`

No async supabase calls. No listener subscriptions. No tier resolution.

Public API:

```tsx
<LandingAuthGate>{children}</LandingAuthGate>
```

### 3.5 Public API of new files

```
src/components/pricing-tier-aware.tsx
  export function PricingTierAware(): JSX.Element

src/components/landing-auth-gate.tsx
  export function LandingAuthGate({ children }: { children: ReactNode }): JSX.Element | null

src/lib/auth-hint.ts
  // UNCHANGED. No new exports this round.
```

## 4. Data flow walkthroughs

### 4.1 `/[locale]/pricing` after migration

Cold visit, anonymous user, no hint:

1. Server renders static page in <50ms with `<PricingTierAware />` placeholder slot
2. `PricingTierAware` mounts, `getAuthHint()` returns null, initial state `{ signedIn: false, tier: "anonymous" }`
3. CTAs render anonymous variants (Free card: `Get started for free` to `/login?intent=signup`; Pro card: `Get started for free, then upgrade` to `/login?intent=signup&plan=pro`)
4. Async `sb.auth.getUser()` returns `{ user: null }`
5. State unchanged; `setAuthHint("anonymous")`
6. `PricingIntentRedirect` useEffect fires with `signedIn=false`; no redirect

Cold visit, signed-in free user, no hint:

1. Server renders static page; PricingTierAware mounts with hint=null, initial state anonymous
2. CTAs render anonymous variants briefly (~100-300ms)
3. Async `sb.auth.getUser()` returns user
4. Parallel `sb.from("profiles").select("tier")` returns `{ tier: "free" }`, `sb.from("subscriptions").select("status")` returns `{ status: null }` (no row) or `{ status: "active" }` (legacy)
5. Effective tier = "free"; state becomes `{ signedIn: true, tier: "free" }`
6. CTAs swap to free variants (Free: `Open dashboard`; Pro: `Start trial` to `/api/checkout`)
7. `setAuthHint("signed-in")`

Warm visit, signed-in free user, hint=signed-in:

1. Server renders static page; PricingTierAware mounts with hint=signed-in, initial state `{ signedIn: true, tier: "free" }` (optimistic)
2. CTAs render free variants immediately on first paint (no async-induced flash)
3. Async confirms state in background; no UI change unless tier actually drifted (e.g. user just upgraded; correction takes 100-300ms, only the Pro card's Free-variant -> Pro-variant swap is visible)

Warm visit, signed-in Pro user, hint=signed-in:

1. Server renders static page; PricingTierAware mounts with hint=signed-in, initial state `{ signedIn: true, tier: "free" }` (optimistic default)
2. CTAs render free variants on first paint
3. Async resolves tier="pro"; state becomes `{ signedIn: true, tier: "pro" }`
4. Pro card swaps to `Manage subscription` (linking to `/api/portal`); Free card stays as `Open dashboard`
5. The brief Pro-variant -> Free-variant -> Pro-variant flash is the documented cost of not caching tier in localStorage. The full async path completes in 100-500ms on Vercel + Supabase warm caches.

Pro user with revoked subscription:

1. Async resolves `profile.tier="pro"`, `subscription.status="revoked"`; effective tier = "free"
2. State becomes `{ signedIn: true, tier: "free" }`
3. CTAs render `Open dashboard` (Free card) + `Start trial` to `/api/checkout` (Pro card)
4. User re-subscribes through the correct flow (matches today's server-resolved behaviour)

Post-OAuth landing flow `/login?intent=signup&plan=pro` -> callback -> `/pricing?intent=signup`:

1. Server renders static `/pricing` (cache-keyed without searchParams)
2. PricingTierAware mounts, reads `useSearchParams().get("intent")` -> `"signup"`
3. Hint should be set during the OAuth handoff (the auth callback's redirect causes Supabase JS to fire on the receiving page; `SiteHeaderClient` runs on the same response and sets the hint). If not, the optimistic-from-hint path is skipped, initial state is anonymous, `PricingIntentRedirect` useEffect fires with `signedIn=false` (no-op)
4. Async resolve completes within 100-500ms, sets state to `{ signedIn: true, tier: "free" }`
5. `PricingIntentRedirect` useEffect re-fires with `signedIn=true, tier="free", intent="signup"`; calls `window.location.assign("/api/checkout")`
6. User lands at `/api/checkout` and proceeds to Polar

Race window: user lands on `/pricing?intent=signup`, sees the page for 100-500ms, may click something during that window. Mitigation: render a small inline notice element when `intent === "signup"` AND state is still resolving: `"Setting up your checkout..."` styled as a non-intrusive banner. The notice is removed once the redirect fires or state resolves to anonymous (race did not match expected post-OAuth state).

### 4.2 `/[locale]/page.tsx` landing after migration

Cold visit, anonymous user, no hint:

1. Server renders static landing page in <50ms with `<LandingAuthGate><main>...</main></LandingAuthGate>`
2. `LandingAuthGate` mounts, `getAuthHint()` returns null
3. Gate renders `children` (the landing content) immediately; no redirect

Cold visit, signed-in user, no hint:

1. Server renders static anonymous landing
2. `LandingAuthGate` mounts, `getAuthHint()` returns null
3. No redirect fires; the signed-in user sees the anonymous landing page
4. User navigates to `/dashboard` via the header (or stays on landing if they explicitly wanted to)
5. Side-effect: `SiteHeaderClient` running on this page resolves the signed-in state and sets `setAuthHint("signed-in")` for future visits

This is the spec's deliberate trade: rare cold-load signed-in visitors lose the auto-redirect in exchange for eliminating the 500-2000ms supabase round-trip from every single landing visit (overwhelmingly anonymous traffic).

Warm visit, signed-in user, hint=signed-in:

1. Server renders static anonymous landing
2. `LandingAuthGate` mounts, `getAuthHint()` returns "signed-in"
3. State `redirecting=true`, gate renders `null`
4. `router.replace("/dashboard")` fires same tick
5. User sees a blank page for ~16-50ms then dashboard loads

Anonymous user with stale hint=signed-in (e.g. signed out elsewhere, hint not yet cleared):

1. Gate redirects to `/dashboard`
2. `(app)/layout.tsx` server-side auth check returns no user
3. `(app)/layout.tsx` redirects to `/login`
4. End state: user is at `/login` (correct), with one extra hop vs today's behaviour
5. `SiteHeaderClient` on /dashboard or /login refreshes the hint to "anonymous"

This is the same chain as today's flow when the server cookie is stale and the redirect chain catches up.

### 4.3 Static prerender of `/pricing` and searchParams

Next.js 16 App Router opts a route into per-request dynamic rendering when its server component reads from any "dynamic API" (cookies, headers, searchParams). Removing the `searchParams` prop from the page signature is therefore mandatory.

`PricingPage` server signature after migration:

```ts
export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  ...
}
```

No `searchParams` destructure. `?intent=signup` is read inside `PricingTierAware` via `useSearchParams()`. Since `useSearchParams` is a Suspense-aware client hook, it returns null during static prerender and resolves on hydration; React's documentation requires that components using it be wrapped in `<Suspense>`. `PricingTierAware` is mounted by the server page; the server wraps it in `<Suspense fallback={null}>` so the prerender succeeds.

Verification step in plan phase: build locally and inspect the route table from `pnpm build` output. The route must appear as `●` (static) for `/[locale]/pricing`. If it appears as `ƒ`, diagnose: `useSearchParams` not wrapped in Suspense, lingering `searchParams` in signature, or some other dynamic-API usage.

## 5. Error handling

| Failure | Behaviour | Why |
|---|---|---|
| `createClient()` throws (missing env vars) | Render anonymous variant; do not call supabase | Matches today's behaviour: `loadAuthState` returns `anonymous` when env is missing |
| `sb.auth.getUser()` returns error AND prior hint says signed-in | Catch, set state to anonymous, call `setAuthHint("anonymous")` to clear the stale hint | Recovery: a session that fails to validate should not strand the UI in a fake-signed-in state. Common case: refresh token expired |
| `sb.auth.getUser()` returns error AND prior hint says null or anonymous | Catch, keep anonymous state | Best-effort default |
| `sb.from("profiles").select("tier")` returns error | Catch, set tier to "free" for signed-in users (optimistic) | RLS misconfig or DB outage; "free" is the lower-privilege optimistic default. The user's actual access is gated server-side by `/api/checkout` (which short-circuits Pro users to `/api/portal`), `/api/portal` (which requires real subscription), and `(app)/*` layouts, so misreading tier here only affects which CTA renders, not what the user can do |
| `sb.from("subscriptions").select("status")` returns error | Catch, treat as `{ status: null }` (no override) | Identical behaviour to a user with no subscription row, which is the normal case for free users |
| `router.replace("/dashboard")` throws or hangs | Caller does not await; failure is silent. User stays on landing | next-intl's router uses Next.js's router under the hood; navigation failure is exceptional and acceptable to log-and-continue |
| `sb.auth.onAuthStateChange` returns `undefined` (no subscription) | Defensive null-check; skip listener setup | Defensive: existing TUB-30 site-header-client.tsx applies the same guard at line 142 |
| `localStorage.getItem` throws (private browsing, quota) | `getAuthHint` returns null; fall through to async resolve | Existing `auth-hint.ts` behaviour |
| `localStorage.setItem` throws | Silently ignore; state still in React | Existing `auth-hint.ts` behaviour |
| User signs out in another tab | `onAuthStateChange` fires with null session; `PricingTierAware` re-resolves to anonymous, calls `setAuthHint("anonymous")` | Cross-tab sync (TUB-30 pattern). Landing's `LandingAuthGate` does NOT subscribe to this; warm-hint state remains "signed-in" until next page load. Acceptable: landing has no UI that depends on auth state |
| User clicks a link during `PricingIntentRedirect` race window (intent=signup, async not yet resolved) | User navigates away; redirect never fires. `?intent=signup` is preserved in browser history; if they come back to `/pricing?intent=signup` later, the redirect re-fires after async resolve | Bounded loss: rare, recoverable, low-priority. The inline notice during the resolve window reduces accidental clicks |

## 6. Testing

### 6.1 Tier 1 (automated, run after each prod deploy)

Per `~/vault/references/tubemine-public-page-nav-perf-2026-05-21.md`, section "Verification methodology":

For each fixed route after deploy READY:

1. Hard-reload prod URL via Chrome MCP `navigate`
2. Run the 5-transition Performance API loop measuring TTFB + total time
3. Assert: average TTFB <120ms (within static-baseline band)
4. Assert: build manifest from `pnpm build` output (local run, captured in PR description) shows the route as `●` (static), not `ƒ` (function)
5. Crawler check: `curl -A "Googlebot" https://tubemine.tech/en/pricing` returns the prerendered HTML body. Assertion: response body contains `href="/login?intent=signup"` AND the anonymous CTA copy AND the comparison table HTML (verifying that bots see real content, not a JS-only skeleton)

Specific assertions per route:

**`/pricing` (PR 1):**
- Anonymous visit (incognito): page renders with anon CTAs (`Get started for free` on Free card, `Get started for free, then upgrade` on Pro card)
- Sign in as Free test account, hard-reload `/en/pricing`: page renders with `Open dashboard` on Free card AND `Start trial` on Pro card. Verify within 500ms of page-render-complete
- `/en/pricing?intent=signup` while signed-in: redirects to `/api/checkout` within 1500ms of page load. Inline notice `"Setting up your checkout..."` visible during the resolve window
- (Pro variant: manual Tier 2 check, see below)
- Build manifest excerpt: `●  /[locale]/pricing`
- Googlebot fetch: anonymous CTAs visible in HTML

**`/` landing (PR 2):**
- Anonymous visit: renders landing hero, TubeMine extractor (anon tier), DemoSampleResult visible
- Sign in via header link, navigate back to `/en`: redirects to `/en/dashboard` within 500ms (warm-hint path)
- Cold incognito + manually-set `localStorage.setItem("tubemine:auth-hint", "signed-in")` + reload `/en`: redirects to `/en/dashboard` within 500ms (validates the hint-only redirect mechanism without needing a real signed-in cookie)
- Build manifest excerpt: `●  /[locale]`
- Googlebot fetch: landing content visible in HTML

### 6.2 Tier 2 (manual, documented for user)

These checks require account states the agent cannot create:

1. **Pro user on `/pricing`:** user manually upgrades a test account to Pro tier in Supabase, then hard-reloads `/en/pricing`. Expected: Free card shows `Open dashboard` button + Pro-note; Pro card shows `Manage subscription` button (linking to `/api/portal`).
2. **Revoked-subscription Pro user on `/pricing`:** user manually flips `subscriptions.status` to `"revoked"` for a Pro test account while keeping `profiles.tier = "pro"`. Hard-reload `/en/pricing`. Expected: page renders Free variant CTAs (`Open dashboard` + `Start trial`), matching today's server-resolved behaviour. This verifies the client tier resolver applies the revocation override.
3. **`Start trial` click as Free user on `/pricing`:** click button, verify redirect to Polar checkout. Verify Polar session is created for the right user.
4. **`Start trial` click as Pro user on `/pricing`:** verify `/api/checkout` short-circuits and redirects to `/api/portal` or returns a sensible error (not a double-charge). If `/api/checkout` does NOT short-circuit, file a follow-up to add this check; the spec's optimistic-tier strategy depends on this backend behaviour.
5. **Cross-tab sign-out during `/pricing` view:** open `/pricing` in tab A while signed in. Sign out in tab B. Tab A's CTAs swap back to anon variant within ~1s via `onAuthStateChange`.

These are deferred to the user with explicit instructions in the Linear closing comment.

### 6.3 Regression sentinels

Run these after both PRs land:

- `/docs`, `/changelog`, `/privacy`, `/terms`, `/oauth-intro` still render as static, still navigate fast (TUB-30 work unchanged)
- `/(app)/dashboard`, `/(app)/profile`, `/(app)/history` still gated server-side by `createClient` in `(app)/layout.tsx` (unchanged)
- `/api/checkout`, `/api/portal`, `/api/export`, `/api/analyses/*` still respond correctly (unchanged)

## 7. Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| `PricingIntentRedirect` race: user clicks elsewhere during 100-500ms resolve window, OAuth `?intent=signup` flow silently drops | Medium (revenue) | Inline `"Setting up your checkout..."` notice during the resolve window. Preserve `?intent=signup` in URL history so a retry happens automatically on back-navigation. The window is bounded to async resolve time (typically <500ms); accepting this trade for static prerender of every other visit |
| Pro user sees `Start trial` button for 100-500ms on cold visit before swap | Low (cosmetic) | Optimistic-from-hint logic shortens the warm path. Cold path is a one-time-per-device transient; accepted |
| Tier upgrade-in-flight cross-device: user upgrades on device A, opens `/pricing` on device B with stale state, clicks `Start trial`, hits `/api/checkout` for an already-Pro user | Medium | Tier 2 check #4 verifies `/api/checkout` short-circuits Pro users. If verification fails, file backend follow-up before relying on optimistic UI |
| Revoked-subscription Pro user sees wrong CTA | High if not handled | Client resolver checks `subscriptions.status === "revoked"` in parallel with `profiles.tier` and applies the same downgrade rule as server `effectiveTier`. Tier 2 check #2 validates |
| RLS policy change in future migration breaks client-side `select tier` or `select status` | Medium | Add a comment in `pricing-tier-aware.tsx` referencing the RLS policy names by their file location, so future migration authors notice the dependency |
| Hydration mismatch warning if server renders anonymous container but client immediately renders signed-in variants based on hint | Medium | Use `suppressHydrationWarning` on the variant containers (proven from `site-header-client.tsx`). Initial render of `PricingTierAware` uses cached-hint state synchronously, but the SERVER does not render the inner CTA variants (`<PricingTierAware />` is a client component; its first render is on the client). No SSR markup mismatch is possible because there is no SSR for the island. CLS min-height prevents layout damage during the swap |
| `await searchParams` re-introduced in future edits breaks static prerender | High | Build-time gate: `pnpm build` route-table assertion in PR description. If a future edit adds `searchParams` to the page signature, build manifest shows `ƒ` and the PR is rejected |
| Landing page cold-load signed-in flash | Out of scope after design change | `LandingAuthGate` no longer does async supabase; it relies only on hint. Returning signed-in users (overwhelming majority) get instant redirect. Cold signed-in users see landing (acceptable trade) |
| /api/checkout / /api/portal contract assumes a known user; if client resolver returns wrong tier, button click triggers wrong backend path | Low | Both backend endpoints re-validate the session and tier server-side independent of any client claim. Misreading on the client only affects which button shows, not what executes when clicked |
| `useSearchParams` requires Suspense wrapper or build fails | Medium | Plan phase wraps `<PricingTierAware />` in `<Suspense fallback={null}>` in the server page. Build verification confirms |
| `router.replace("/dashboard")` does not trigger locale prefixing | Low | next-intl's `useRouter` from `@/i18n/navigation` auto-prefixes the active locale, verified by `site-header-client.tsx:421-424` which uses the same idiom. No code change needed |

## 8. File-level change list

### 8.1 PR 1: `/pricing` migration

**Modified: `src/app/[locale]/pricing/page.tsx`**

- Remove `import { createClient } from "@/lib/supabase/server"` (line 6)
- Remove `import { getUserQuota } from "@/lib/quota"` (line 7)
- Remove `type AuthTier`, `type AuthState`, `async function loadAuthState` block (lines 12-36)
- Remove `export const dynamic = "force-dynamic"` (line 38)
- Remove `searchParams` from the page's destructured props (line 71 area) and remove the `const sp = await searchParams` call (line 77)
- Remove `const state = await loadAuthState()` call (line 81)
- Remove `<PricingIntentRedirect intent={...} signedIn={...} tier={...} />` direct render (lines 130-134); it moves inside `PricingTierAware`
- Remove the tier-conditional JSX from both `.price-foot` divs (lines 182-215 Free, 254-285 Pro); replace each with `<PricingTierAware />` mount or the agreed-upon mounting strategy from §3.2
- Add `import { Suspense } from "react"` if not already present
- Add `import { PricingTierAware } from "@/components/pricing-tier-aware"`
- Wrap the `PricingTierAware` mount in `<Suspense fallback={null}><PricingTierAware /></Suspense>` (required for `useSearchParams`)
- Keep all other rendering, FAQ, comparison table, footer unchanged

**Modified: `src/components/pricing-intent-redirect.tsx`**

- No interface change. Existing 3 props (`intent`, `signedIn`, `tier`) preserved.
- Only the parent changes (from `PricingPage` server to `PricingTierAware` client).
- Note: the docstring comment refers to "pricing/page.tsx detects ?intent=signup AND signedIn AND tier !== pro". Update to "PricingTierAware detects..."

**New: `src/components/pricing-tier-aware.tsx`**

- `"use client"` directive
- Imports: React (`useState`, `useEffect`), `useSearchParams` from `next/navigation`, `useTranslations` from `next-intl`, `IntlLink` from `@/i18n/navigation`, `NextLink` from `next/link`, `createClient` from `@/lib/supabase/client`, `getAuthHint`, `setAuthHint` from `@/lib/auth-hint`, `PricingIntentRedirect` from `@/components/pricing-intent-redirect`
- Single component: runs resolve flow, renders both `.price-foot` slots' contents
- Auth + tier resolution per §3.1 pseudocode
- `useEffect` for async resolve on mount and an `onAuthStateChange` listener (defensive on missing subscription)
- Renders three sub-elements:
  1. `<PricingIntentRedirect intent={intent} signedIn={state.signedIn} tier={state.tier} />`
  2. The Free-card CTA footer (3 variants by `state.tier`)
  3. The Pro-card CTA footer (3 variants by `state.tier`)
- Each variant uses the SAME `t("free.cta_anon")` etc. keys as the current server component

### 8.2 PR 2: `/` landing migration

**Modified: `src/app/[locale]/page.tsx`**

- Remove `import { createClient } from "@/lib/supabase/server"` (line 5)
- Remove `import { getUserQuota } from "@/lib/quota"` (line 6)
- Remove `import { redirect } from "next/navigation"` (line 1) if no other use remains
- Remove `type HomeAuthState`, `async function resolveHomeAuthState` (lines 15-35)
- Remove `export const dynamic = "force-dynamic"` (line 13)
- Remove `const { tier, isAnonymous } = await resolveHomeAuthState()` (line 58)
- Remove `if (!isAnonymous) redirect(...)` (lines 61-63)
- Add `import { LandingAuthGate } from "@/components/landing-auth-gate"`
- Wrap the entire `<><LandingSmoothScroll /><main>...</main><LandingFooter ... /></>` body in `<LandingAuthGate>...</LandingAuthGate>`
- Replace `<TubeMine tier={tier} />` with `<TubeMine tier="anonymous" />` (line ~180)
- Remove `{isAnonymous ? <DemoSampleResult ... /> : null}` conditionals and the demo-sample-strip `isAnonymous ? <div> : null` block; render their contents unconditionally
- Remove `<IntlLink href={isAnonymous ? "/login?intent=signup" : "/dashboard"} ...>` conditional and replace with the anonymous variant unconditionally (the link to `/login?intent=signup` plus `t("dashboard.cta_signup")` text)

**New: `src/components/landing-auth-gate.tsx`**

- `"use client"` directive
- Imports: React (`useState`, `useEffect`), `useRouter` from `@/i18n/navigation`, `getAuthHint` from `@/lib/auth-hint`
- Per §3.4: ~15 LOC, hint-only check, sync redirect

## 9. Migration safety

### 9.1 Ordering

PRs ship sequentially, NOT concurrently:

1. **PR 1 (`/pricing`)** ships, deploys to prod, verifies via Tier 1 + Tier 2 manual.
2. Wait for at least one Polar checkout to complete from a real user OR document the 24h post-merge observation window in Linear before starting PR 2.
3. **PR 2 (`/landing`)** ships, deploys to prod, verifies via Tier 1.

The /pricing PR has the higher-risk revenue path. We want to land it cleanly and observe before stacking another change on top.

### 9.2 Rollback

Each PR is one commit on `main`. Rollback = `git revert <sha>` + push.

Concrete rollback signals (in priority order):

1. Sentry error rate on `/pricing` or `/` rises by >2x baseline within 1 hour of deploy
2. Polar checkout success rate drops by >10% in the first 24h
3. User report of "I see the wrong CTA / I cannot upgrade / I cannot manage subscription"

Tier 2 manual checks at deploy time are designed to catch (3) before users do.

### 9.3 No-database-migration guarantee

This work touches ZERO database migrations. Existing RLS policies (`00_init.sql` lines 18 for profiles, 47 for usage, 85 for subscriptions) already permit users to read own rows. We rely on this; we do not change it. We DO query subscriptions from the client for the first time in this codebase; line 85's policy authorises it.

### 9.4 No-API-change guarantee

This work touches ZERO server API routes. `/api/checkout`, `/api/portal`, `/api/export`, `/api/analyses/*`, `/auth/callback` all remain unchanged. Tier 2 check #4 verifies that `/api/checkout` already short-circuits Pro users (the spec ASSUMES this; if it does not hold, a backend follow-up is filed before relying on optimistic-tier UI).

## 10. Workflow

### 10.1 Commit strategy

Per shipping convention used in TUB-30 and TUB-31, direct-to-main commits, not feature branches. Each PR = one commit on main. PR title format `perf(tub-32): <route> static migration via lazy auth hydration`.

### 10.2 Build verification gate (before each commit)

Before pushing a commit, run `pnpm build` locally. Inspect the route table in the output:

- For PR 1: assert `/[locale]/pricing` appears as `●` (static), NOT `ƒ` (function)
- For PR 2: assert `/[locale]` (the root locale page) appears as `●`, NOT `ƒ`

If the route still shows as a function, the fix is incomplete. Diagnose: most likely a residual `createClient`, `cookies()`, `headers()`, or `searchParams` usage. Re-grep.

### 10.3 Verify-on-prod gate (after each push)

Per `~/vault/feedback/qa-verify-on-prod-before-close.md`:

1. Push to main
2. Wait for Vercel deploy to reach READY (poll via `mcp__vercel__list_deployments`)
3. Hard-reload prod URL via Chrome MCP `navigate`
4. Run JS assertion via `javascript_tool` proving the symptom is gone:
   - Anonymous variant rendered for incognito visit
   - Signed-in variant rendered after sign-in flow
   - Build manifest assertion (separately, from `pnpm build` local output captured in PR description)
   - Googlebot fetch (curl -A "Googlebot") returns the static body with anonymous CTAs visible
5. Take screenshot for visual sanity
6. Only THEN mark the Linear sub-task complete

### 10.4 Linear tracking

Create issue TUB-32 with this spec linked. Move to In Progress immediately after spec phase clears.

After PR 1 ships + verifies: post Linear comment with commit SHA + Tier 1 assertion data + Tier 2 manual check status.

After PR 2 ships + verifies: post Linear comment with commit SHA + Tier 1 assertion data. Move issue to Done with the closing comment listing:
- Both commit SHAs
- Routes audited (full list from §2.1, §2.2)
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
2. **No new dependencies.** Reuse `auth-hint.ts` (read-only this round), `supabase/client.ts`, `next-intl`, `@/i18n/navigation`, `next/navigation`. No new packages.
3. **No new API routes.** Tier resolution via direct supabase query under existing RLS.
4. **One PR per route fixed.** PR 1 = `/pricing`. PR 2 = `/landing`. Each merges and verifies independently.
5. **Build manifest assertion before each commit.** `pnpm build` must show static marker (`●`) for the route being migrated, otherwise the fix is incomplete.
6. **Verify-on-prod after each push.** Chrome MCP DOM assertion is the gate, not deploy READY.
7. **PricingIntentRedirect is the revenue path.** If the client-resolution timing breaks the post-OAuth checkout flow in a way the manual smoke test detects, DO NOT proceed; fix or revert.
8. **`useSearchParams` requires Suspense.** Server page must wrap `<PricingTierAware />` in `<Suspense fallback={null}>`. Build verification confirms.

## 12. Open items deferred to plan phase

These are tactical decisions the plan phase will resolve:

1. **`PricingTierAware` mounting strategy:** option (a) one instance owning both `.price-foot` slots, vs option (b) two instances sharing state via a small Provider wrapper. Spec recommends (a); plan phase commits after inspecting CSS dependencies.
2. **Listener cleanup on unmount:** standard React `useEffect` return + `subscription.unsubscribe()` per TUB-30 pattern in `site-header-client.tsx:140-143`. Plan phase implements verbatim.
3. **Optimistic-from-hint initial state for `PricingTierAware`:** spec specifies `{ signedIn: true, tier: "free" }` for warm-hint case. Plan phase confirms this is the right optimistic default (alternative: optimistic "pro" if user was previously pro). Spec recommends "free" as the lower-friction default.
