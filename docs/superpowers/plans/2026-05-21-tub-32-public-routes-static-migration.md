# TUB-32 Public Routes Static Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `/[locale]/pricing` and `/[locale]/page.tsx` from `force-dynamic` to static prerender using the TUB-30 lazy-auth-hydration pattern, eliminating ~300ms server TTFB per navigation. Keep `/[locale]/login` dynamic.

**Architecture:** Per spec `docs/superpowers/specs/2026-05-21-tub-32-public-routes-static-migration-design.md`. Two sequential PRs. PR 1 introduces `PricingTierAware` client island (replaces server `loadAuthState`); PR 2 introduces `LandingAuthGate` (replaces server hard-redirect). Both rely on existing `auth-hint.ts` (TUB-30 shipped) and direct Supabase row-self-read under RLS policies at `supabase/migrations/00_init.sql:18,85`.

**Tech Stack:** Next.js 16 App Router, React 19, next-intl 4.x, `@supabase/ssr` (browser client), TypeScript. No new dependencies.

---

## Spec Coverage Map (self-review)

| Spec section | Plan task(s) |
|---|---|
| §2.1 PR 1: pricing migration | Tasks 1-10 |
| §2.1 PR 2: landing migration | Tasks 11-17 |
| §2.3 `/login` kept dynamic | No code; documented in Task 18 Linear comment |
| §3.1 client tier resolution + requestId counter | Task 5 |
| §3.2 mounting strategy (pricing-grid only) | Task 3 |
| §3.3 PricingIntentRedirect + history.replaceState | Task 7 |
| §3.4 LandingAuthGate hint-only | Task 12 |
| §4.2 useSearchParams in Suspense | Task 3 |
| §5 error handling rows | Tasks 5, 7, 12 (implementation) |
| §6.1 Tier 1 verification | Tasks 9, 10, 16, 17 |
| §6.2 Tier 2 (manual, user) | Task 18 Linear comment |
| §8.1 file-level changes pricing | Tasks 1-7 |
| §8.2 file-level changes landing | Tasks 11-14 |
| §10.2 build manifest gate | Tasks 4, 8, 15 |
| §10.3 verify-on-prod | Tasks 10, 17 |
| §10.4 Linear tracking | Tasks 0, 18 |

---

## Task 0: Linear setup and baseline measurement

**Files:** none (admin work)

- [ ] **Step 1: Create Linear issue TUB-32**

Use `mcp__claude_ai_Linear__save_issue` with:
- title: `Public routes static-migration sweep (incl /pricing) [TUB-30 follow-up]`
- description: link to spec at `docs/superpowers/specs/2026-05-21-tub-32-public-routes-static-migration-design.md`. Include scope summary: "Migrate /pricing and / from force-dynamic to static using TUB-30 lazy-auth pattern. /login intentionally kept dynamic. 2 PRs."
- priority: 2 (High)
- state: In Progress immediately
- team: TUB (TubeMine)

- [ ] **Step 2: Capture baseline Chrome MCP measurement**

Navigate to `https://tubemine.tech/en/docs` then run the 5-transition script from `~/vault/references/tubemine-public-page-nav-perf-2026-05-21.md` § "Verification methodology" via `mcp__claude-in-chrome__javascript_tool`. Save the resulting `console.table(samples)` output. Expected: average TTFB ~270-360ms on /pricing transitions, ~190ms on /docs <-> /changelog (TUB-30 baseline). Store in a scratch file or paste into Linear issue description.

---

## PR 1: `/pricing` static migration (Tasks 1-10)

### Task 1: Add CLS-safe min-height for `.price-foot`

**Files:**
- Modify: `src/app/globals.css:1091-1095`

- [ ] **Step 1: Add min-height rule**

Find the existing `.tm-design .pricing-page .price-foot` block at globals.css:1091 and append `min-height: 88px;` (per spec §3.2) so the variant swap on hydration does not shift the comparison table below. Updated rule:

```css
.tm-design .pricing-page .price-foot {
  margin-top: auto;
  display: grid;
  gap: var(--space-4);
  min-height: 88px;
}
```

- [ ] **Step 2: Verify build still passes**

Run: `pnpm build`
Expected: build succeeds. `/[locale]/pricing` still shows `ƒ` (function) at this stage, expected.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "$(cat <<'EOF'
style(tub-32): reserve min-height on .price-foot for CLS-safe variant swap

Prepares for client-island CTA swap (next step). 88px (per spec § 3.2)
accommodates the tallest variant (signed-in free with note paragraph)
so swapping between anonymous, free, and pro variants does not shift
the comparison table below.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Scaffold `PricingTierAware` skeleton (anonymous-only render)

**Files:**
- Create: `src/components/pricing-tier-aware.tsx`

- [ ] **Step 1: Create the component file with anonymous-only state**

Write the complete file. This first version renders only the anonymous variants. Async tier resolution + supabase imports + requestId counter + useEffect are added in Task 5. Helper components call `useTranslations("pricing")` themselves so the parent does not need to pass `t` as a prop (avoids next-intl `t` generic-typeof typing pitfalls).

```tsx
"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Link as IntlLink } from "@/i18n/navigation"
import { PricingIntentRedirect } from "@/components/pricing-intent-redirect"

type Tier = "anonymous" | "free" | "pro"

type State = {
  signedIn: boolean
  tier: Tier
  resolved: boolean
}

const INITIAL_STATE: State = {
  signedIn: false,
  tier: "anonymous",
  resolved: false,
}

export function PricingTierAware() {
  const t = useTranslations("pricing")
  const searchParams = useSearchParams()
  const intent = searchParams?.get("intent") ?? null

  // Task 5 will swap this for [state, setState] = useState(...) with a
  // useRef + useEffect resolver. For now state is fixed anonymous.
  const [state] = useState<State>(INITIAL_STATE)

  return (
    <div className="pricing-grid">
      {/* FREE */}
      <article className="price-card" aria-labelledby="plan-free">
        <div className="price-head">
          <span className="price-name" id="plan-free">{t("free.name")}</span>
          <span className="badge badge--outline">{t("free.badge")}</span>
        </div>
        <div className="price-num">
          <span className="currency">{t("free.currency")}</span>
          {t("free.price")}
          <span className="unit">{t("free.unit")}</span>
        </div>
        <ul className="price-list">
          {[t("free.b1"), t("free.b2"), t("free.b3"), t("free.b4"), t("free.b5")].map((b, i) => (
            <li key={i}>
              <span className="price-check"><CheckIcon /></span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="price-foot" suppressHydrationWarning>
          <FreeCardCta tier={state.tier} />
        </div>
      </article>

      {/* PRO */}
      <article className="price-card is-popular" aria-labelledby="plan-pro">
        <div className="price-head">
          <span className="price-name" id="plan-pro">{t("pro.name")}</span>
          <span className="badge badge--default">
            <span className="badge-dot" />
            {t("pro.badge")}
          </span>
        </div>
        <div className="price-num">
          <span className="currency">{t("pro.currency")}</span>
          {t("pro.price")}
          <span className="unit">{t("pro.unit")}</span>
        </div>
        <ul className="price-list">
          {[t("pro.b1"), t("pro.b2"), t("pro.b3"), t("pro.b4"), t("pro.b5")].map((b, i) => (
            <li key={i}>
              <span className="price-check"><CheckIcon /></span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="price-foot" suppressHydrationWarning>
          <ProCardCta tier={state.tier} />
        </div>
      </article>

      {state.resolved && (
        <PricingIntentRedirect
          intent={intent}
          signedIn={state.signedIn}
          tier={state.tier}
        />
      )}
    </div>
  )
}

function FreeCardCta({ tier }: { tier: Tier }) {
  const t = useTranslations("pricing")
  if (tier === "anonymous") {
    return (
      <IntlLink href="/login?intent=signup" className="btn btn--primary" style={{ gap: 10 }}>
        <GoogleIcon />
        {t("free.cta_anon")}
      </IntlLink>
    )
  }
  if (tier === "free") {
    return (
      <>
        <IntlLink href="/dashboard" className="btn btn--secondary">{t("free.cta_free")}</IntlLink>
        <p className="price-note">{t("free.note_free")}</p>
      </>
    )
  }
  return (
    <>
      <IntlLink href="/dashboard" className="btn btn--secondary">{t("free.cta_pro")}</IntlLink>
      <p className="price-note">{t("free.note_pro")}</p>
    </>
  )
}

function ProCardCta({ tier }: { tier: Tier }) {
  const t = useTranslations("pricing")
  if (tier === "anonymous") {
    return (
      <>
        <IntlLink href="/login?intent=signup&plan=pro" className="btn btn--primary">
          {t("pro.cta_anon")}
        </IntlLink>
        <p className="price-note">{t("pro.note_anon")}</p>
      </>
    )
  }
  if (tier === "free") {
    return (
      <>
        <form action="/api/checkout" method="POST">
          <button type="submit" className="btn btn--primary">
            {t("pro.cta_free")}
            <ArrowRightIcon />
          </button>
        </form>
        <p className="price-note">{t("pro.note_free")}</p>
      </>
    )
  }
  return (
    <>
      <a href="/api/portal" className="btn btn--secondary">{t("pro.cta_pro")}</a>
      <p className="price-note">{t("pro.note_pro")}</p>
    </>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="m4 12 5 5L20 6" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg
      className="icon icon-sm"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M21.6 12.227c0-.708-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.51h3.232c1.891-1.742 2.98-4.305 2.98-7.351Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.964-.895 6.619-2.422l-3.232-2.51c-.895.6-2.04.955-3.387.955-2.605 0-4.81-1.76-5.596-4.123H3.064v2.59A9.997 9.997 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.404 13.9A6.013 6.013 0 0 1 6.09 12c0-.66.114-1.3.314-1.9V7.51H3.064A9.997 9.997 0 0 0 2 12c0 1.614.386 3.14 1.064 4.49l3.34-2.59Z" fill="#FBBC05" />
      <path d="M12 5.977c1.468 0 2.787.505 3.824 1.498l2.868-2.868C16.96 2.99 14.695 2 12 2A9.997 9.997 0 0 0 3.064 7.51l3.34 2.59C7.19 7.737 9.395 5.977 12 5.977Z" fill="#EA4335" />
    </svg>
  )
}
```

No unused-import suppression block needed. Each helper uses `useTranslations` directly.

- [ ] **Step 2: Run typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean (no type errors). The component takes zero props and uses `useTranslations<"pricing">` typing.

- [ ] **Step 3: Commit (work-in-progress, not pushed yet)**

```bash
git add src/components/pricing-tier-aware.tsx
git commit -m "$(cat <<'EOF'
feat(tub-32): scaffold PricingTierAware client island (anon-only render)

First step of /pricing static migration. Renders the full pricing-grid
with anonymous-default CTAs. Async tier resolution + requestId counter
arrive in the next commit. Not yet wired into the page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire `PricingTierAware` into pricing/page.tsx (server-side cleanup)

**Files:**
- Modify: `src/app/[locale]/pricing/page.tsx`

- [ ] **Step 1: Read current file to verify line numbers**

Use the Read tool on `src/app/[locale]/pricing/page.tsx` (range 1-90) to confirm the imports + signature + `loadAuthState` block still occupy the lines referenced below. If lines drifted (other commits between spec and execution), adjust the deletions accordingly. The plan's line refs are based on commit `fc8e104` (TUB-30 ship).

- [ ] **Step 2: Remove server auth imports and helpers**

Remove these lines:
- Import block: `import { createClient } from "@/lib/supabase/server"` and `import { getUserQuota } from "@/lib/quota"` (currently lines 6-7)
- Import: `import { PricingIntentRedirect } from "@/components/pricing-intent-redirect"` (currently line 5)
- The `type AuthTier`, `type AuthState`, and `async function loadAuthState() { ... }` block (currently lines 12-36)
- The `export const dynamic = "force-dynamic"` directive (currently line 38)
- The `searchParams` field from the page's destructured props (currently in the type signature near line 73)
- The `const sp = await searchParams` call (currently line 77)
- The `const state = await loadAuthState()` call (currently line 81)

Add these imports at the top of the file:

```tsx
import { Suspense } from "react"
import { PricingTierAware } from "@/components/pricing-tier-aware"
```

- [ ] **Step 3: Delete the direct `<PricingIntentRedirect ... />` mount**

In the current page body (around lines 129-134) the page renders:
```tsx
{/* Client island: post-OAuth ?intent=signup&plan=pro -> /api/checkout */}
<PricingIntentRedirect
  intent={sp.intent ?? null}
  signedIn={state.signedIn}
  tier={state.tier}
/>
```

Delete this block entirely (including the comment). The `PricingIntentRedirect` mount moves inside `PricingTierAware` (see Task 5).

- [ ] **Step 4: Replace the pricing-grid block with the Suspense-wrapped client island**

In the current page body (around lines 147-287), the page contains:
```tsx
<section className="pricing-section">
  <div className="container">
    <div className="pricing-grid">
      {/* FREE article + PRO article, lines 149-287 */}
    </div>

    {/* ===== Comparison ===== */}
    <div className="compare-wrap">
      {/* lines 289-571 - PRESERVE VERBATIM */}
    </div>

    {/* trust-line */}
    <p className="trust-line">
      {/* lines 573-593 - PRESERVE VERBATIM */}
    </p>
  </div>
</section>
```

Replace ONLY the `<div className="pricing-grid">...</div>` block with the Suspense + PricingTierAware mount:

```tsx
<Suspense fallback={null}>
  <PricingTierAware />
</Suspense>
```

The `<div className="compare-wrap">...</div>` and `<p className="trust-line">...</p>` blocks stay untouched (PRESERVE existing JSX). The result is:

Structure illustration (note: the `<div className="compare-wrap">` and `<p className="trust-line">` blocks below are PRESERVED FROM THE EXISTING SOURCE; do not retype their children):

```
<section className="pricing-section">
  <div className="container">
    <Suspense fallback={null}>
      <PricingTierAware />
    </Suspense>

    [PRESERVE: <div className="compare-wrap">...</div> from current page.tsx lines 289-571, no edits]
    [PRESERVE: <p className="trust-line">...</p> from current page.tsx lines 573-593, no edits]
  </div>
</section>
```

Operationally, this step is implemented by replacing ONLY the `<div className="pricing-grid">...</div>` block (lines 149-287) with `<Suspense fallback={null}><PricingTierAware /></Suspense>`. The `<div className="compare-wrap">...</div>` and `<p className="trust-line">...</p>` blocks are NOT touched.

The other sections (hero at lines 137-144, FAQ section at lines 597-617, final CTA at lines 619-637, and `<PricingFooter tLanding={tLanding} />` at line 641) stay unchanged.

- [ ] **Step 5: Update the page signature (drop `searchParams` from props)**

The current signature destructures `{ params, searchParams }`. After this task, the body no longer needs `searchParams` (the new client island reads `useSearchParams()`). Update the signature to:

The final signature is:

```tsx
export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("pricing")
  const tLanding = await getTranslations("landing")

  // PRESERVE: existing faqItems array (current page.tsx lines 83-125),
  // do NOT modify; the body of the function continues unchanged from
  // this point except for the section-restructure done in Step 4.
  ...
}
```

Do NOT delete or modify the `faqItems` declaration; only the function-parameter destructure changes (drop `searchParams`).

Also delete the `const sp = await searchParams` line near current line 77 if it survived the previous step.

- [ ] **Step 6: Grep-guard for leftover references**

Run:
```bash
grep -n "\bsp\b\|searchParams\|loadAuthState\|createClient\|getUserQuota\|force-dynamic" src/app/[locale]/pricing/page.tsx
```

Expected: ZERO matches. If any survive, the deletion is incomplete.

- [ ] **Step 7: Run typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean. If `TubeMine`-related types fail (it isn't used here but the import line may have changed), check `src/components/tubemine.tsx` for the prop signature.

- [ ] **Step 8: Run build and inspect route table**

Note: the project's `pnpm build` script runs `vitest run` and `check-message-parity` BEFORE `next build`. Test failures will block the build. If unrelated tests fail due to environment, run `pnpm exec next build` directly to isolate the route-table step.

Run: `pnpm build 2>&1 | grep -E "^[●ƒ]" | head -30`
Expected: `/[locale]/pricing` appears with `●` (static) marker, NOT `ƒ`. If it shows `ƒ`, run `grep -n "searchParams\|createClient\|cookies()\|headers()" src/app/[locale]/pricing/page.tsx` to find the dynamic API still in use.

- [ ] **Step 9: Commit (still local, anon-only render)**

```bash
git add src/app/[locale]/pricing/page.tsx
git commit -m "$(cat <<'EOF'
refactor(tub-32): wire PricingTierAware into /pricing, drop force-dynamic

Removes server-side loadAuthState helper and force-dynamic directive.
The pricing-grid block becomes a Suspense-wrapped client island
(PricingTierAware); the surrounding section, comparison table, and
trust line stay in server scope. Build manifest now emits the route
as static. CTAs currently render anonymous-only; async tier
resolution arrives in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Verify static prerender locally

**Files:** none (verification only)

- [ ] **Step 1: Run production build**

Run: `pnpm build 2>&1 | grep -E "^[●ƒ]" | head -30`
Expected:
```
● /[locale]/pricing
ƒ /[locale]
```
(/pricing must be `●`; landing still shows `ƒ` because PR 2 has not started yet. Only assert /pricing this round.)

- [ ] **Step 2: Start production server with port readiness check and curl the route**

Run:
```bash
pnpm start &
SERVER_PID=$!
until curl -fs http://localhost:3000/en/pricing >/dev/null 2>&1; do sleep 1; done
```

Then:
```bash
curl -s -A "Googlebot" http://localhost:3000/en/pricing | head -200
```

Expected: the response body contains `Get started for free` (or the equivalent anon CTA copy from messages/en.json `pricing.free.cta_anon`) AND `href="/en/login?intent=signup"` (locale-prefixed anon link), confirming the prerendered HTML carries the anonymous variant.

Cleanup:
```bash
kill $SERVER_PID 2>/dev/null; pkill -f "next start" 2>/dev/null; true
```

- [ ] **Step 3: No commit (verification step)**

---

### Task 5: Add async tier resolution to `PricingTierAware`

**Files:**
- Modify: `src/components/pricing-tier-aware.tsx`

- [ ] **Step 1: Add new imports**

Update the top of `src/components/pricing-tier-aware.tsx` to add the imports Task 5 needs (Task 2 only imported what it used):

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Link as IntlLink } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/client"
import { setAuthHint } from "@/lib/auth-hint"
import { PricingIntentRedirect } from "@/components/pricing-intent-redirect"
```

(Only `useEffect`, `useRef`, `createClient`, `setAuthHint` are new vs Task 2.)

- [ ] **Step 2: Replace the placeholder useState with stateful resolve flow**

Replace the existing Task 2 stub:

```tsx
const [state] = useState<State>(INITIAL_STATE)
```

With the full resolver:

```tsx
const [state, setState] = useState<State>(INITIAL_STATE)
const requestIdRef = useRef(0)

useEffect(() => {
  const sb = (() => {
    try {
      return createClient()
    } catch {
      return null
    }
  })()
  if (!sb) {
    setState({ signedIn: false, tier: "anonymous", resolved: true })
    return
  }

  async function resolve(): Promise<void> {
    const myId = ++requestIdRef.current
    const { data: { user }, error } = await sb!.auth.getUser()
    if (myId !== requestIdRef.current) return

    if (error || !user) {
      setState({ signedIn: false, tier: "anonymous", resolved: true })
      setAuthHint("anonymous")
      return
    }

    const [profileQ, subQ] = await Promise.all([
      sb!.from("profiles").select("tier").eq("user_id", user.id).maybeSingle(),
      sb!.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle(),
    ])
    if (myId !== requestIdRef.current) return

    const rawTier: "free" | "pro" = profileQ.data?.tier === "pro" ? "pro" : "free"
    const isRevoked = rawTier === "pro" && subQ.data?.status === "revoked"
    const effective: "free" | "pro" = isRevoked ? "free" : rawTier
    setState({ signedIn: true, tier: effective, resolved: true })
    setAuthHint("signed-in")
  }

  // Subscribe BEFORE starting the IIFE so INITIAL_SESSION (fired
  // synchronously by Supabase on subscribe) is captured by the
  // requestId counter mechanism. Per spec § 3.1.
  const { data: sub } = sb.auth.onAuthStateChange((_event, _session) => {
    void resolve()
  })

  void resolve()

  return () => {
    sub?.subscription?.unsubscribe()
  }
}, [])
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean. If `createClient()` return type is `null`-unioned, the `sb!.` non-null assertions inside the resolver are required.

- [ ] **Step 4: Run build and confirm static still holds**

Run: `pnpm build 2>&1 | grep "pricing"`
Expected: `●  /[locale]/pricing` still present. If now showing `ƒ`, the resolver introduced a Server Component dynamic API by mistake. Triage: confirm the component still starts with `"use client"`.

- [ ] **Step 5: Commit**

```bash
git add src/components/pricing-tier-aware.tsx
git commit -m "$(cat <<'EOF'
feat(tub-32): add async tier resolution to PricingTierAware

Resolves auth + tier on mount via supabase.auth.getUser plus parallel
SELECT on profiles.tier and subscriptions.status (RLS row-self-read).
Applies the same revocation override as server-side effectiveTier in
src/lib/quota.ts. Subscribes onAuthStateChange to handle cross-tab
sign-in/out. requestId counter (useRef) protects against the cold
supabase-js hydration race where INITIAL_SESSION arrives after the
manual getUser resolved with stale anonymous.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Local sign-in smoke test for PricingTierAware

**Files:** none (verification only)

- [ ] **Step 1: Restart dev server in fresh state**

Run: `pnpm dev` in one terminal. Wait for "Ready".

- [ ] **Step 2: Sign in via OAuth using Chrome MCP**

Use `mcp__claude-in-chrome__navigate` to load `http://localhost:3000/en/login`. Click "Continue with Google" (or skip if user already signed in via dev session cookies). Once signed-in, navigate to `http://localhost:3000/en/pricing`.

- [ ] **Step 3: Assert client-resolved CTAs and no i18n missing-message warnings**

Run via `mcp__claude-in-chrome__javascript_tool` (in localhost tab):

```javascript
// Wait for tier resolve to complete
await new Promise((r) => setTimeout(r, 2000));
const freeCta = document.querySelector('article[aria-labelledby="plan-free"] .price-foot .btn');
const proCta = document.querySelector('article[aria-labelledby="plan-pro"] .price-foot .btn, article[aria-labelledby="plan-pro"] .price-foot button[type="submit"]');
return {
  freeCtaText: freeCta?.textContent?.trim(),
  proCtaText: proCta?.textContent?.trim(),
  freeCtaHref: freeCta?.getAttribute('href') || null,
};
```

Expected for a free-tier signed-in user: `freeCtaText` includes "Open dashboard" (or the localized Free tier CTA), `proCtaText` includes "Start trial" or "Upgrade", `freeCtaHref` is `/en/dashboard`.

If anonymous variant still shows after 2s, the resolver did not run. Open browser console, check for errors related to `createClient` or RLS denials.

Then read console messages to confirm next-intl has all required namespaces forwarded to the client (spec § 12 item 2):

```javascript
// via mcp__claude-in-chrome__read_console_messages
// search for MISSING_MESSAGE
```

Use `mcp__claude-in-chrome__read_console_messages` with `pattern: "MISSING_MESSAGE"`. Expected: zero matches. If any appear referencing the `pricing` namespace, NextIntlClientProvider is not forwarding the namespace; verify `src/app/[locale]/layout.tsx:122` is configured to provide messages to client consumers.

- [ ] **Step 4: Test `?intent=signup` redirect path locally (Tier 1 revenue assertion)**

Spec § 6.1 requires the post-OAuth checkout-redirect path to be exercised as a Tier 1 (automated) assertion, not deferred to manual Tier 2. Still in the localhost tab with a signed-in Free session:

```javascript
// In Chrome MCP tab, navigate to /en/pricing?intent=signup
// then poll for the redirect to fire
```

Use `mcp__claude-in-chrome__navigate` to `http://localhost:3000/en/pricing?intent=signup`, then wait up to 3 seconds and read the current URL:

```javascript
await new Promise(r => setTimeout(r, 3000));
return {
  currentPath: location.pathname,
  redirectedToCheckout: location.pathname === '/api/checkout' || location.pathname.startsWith('/api/checkout'),
};
```

PASS criterion: `redirectedToCheckout: true`. If the path is still `/en/pricing`, the resolver completed but the redirect didn't fire. Check `PricingIntentRedirect`'s `useEffect` deps and the `state.resolved` gate.

Note: a signed-in Pro session should NOT redirect (the `tier !== "pro"` check in `PricingIntentRedirect` suppresses it). If testing as Pro, expect `redirectedToCheckout: false` and the Pro card showing Manage subscription.

- [ ] **Step 5: Stop dev server**

`Ctrl+C` in the dev terminal, or `pkill -f "next dev"`.

- [ ] **Step 6: No commit (verification step)**

---

### Task 7: Update `PricingIntentRedirect` to strip `?intent=signup` before redirect

**Files:**
- Modify: `src/components/pricing-intent-redirect.tsx`

- [ ] **Step 1: Update the component body**

Replace the entire file with:

```tsx
"use client"

import { useEffect } from "react"

/**
 * Client island that runs the post-OAuth checkout redirect.
 * PricingTierAware mounts this child only when client auth has
 * resolved (state.resolved === true), so signedIn + tier are the
 * final values, not the optimistic-anonymous initial state.
 *
 * Before navigating to /api/checkout, this strips ?intent=signup
 * from the current history entry via history.replaceState so the
 * back-button from Polar (or from /api/checkout if it errors)
 * lands on /pricing without ?intent, preventing a redirect loop.
 */
export function PricingIntentRedirect({
  intent,
  signedIn,
  tier,
}: {
  intent: string | null
  signedIn: boolean
  tier: "anonymous" | "free" | "pro"
}) {
  useEffect(() => {
    if (intent === "signup" && signedIn && tier !== "pro") {
      window.history.replaceState(null, "", window.location.pathname)
      window.location.assign("/api/checkout")
    }
  }, [intent, signedIn, tier])
  return null
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/pricing-intent-redirect.tsx
git commit -m "$(cat <<'EOF'
fix(tub-32): strip ?intent=signup before /api/checkout redirect

Prevents back-button loop where the user returning from Polar (or
from /api/checkout if it errors out) lands on /pricing?intent=signup
and triggers the redirect again. history.replaceState runs ONLY when
the redirect actually fires, so the pre-redirect race window (user
clicks a link before resolve completes) still preserves intent in
history for back-navigation retry per spec § 3.3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Pre-push verification (build, lint, typecheck)

**Files:** none

- [ ] **Step 1: Run lint**

Run: `pnpm lint`
Expected: clean (no errors). If there are warnings about unused imports, fix them.

- [ ] **Step 2: Run typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run build and capture route table**

Note: `pnpm build` runs `vitest run` and `check-message-parity` before `next build`. This single command verifies tests + i18n parity + build manifest in one pass.

Run: `pnpm build 2>&1 | tee /tmp/tub-32-pr1-build.log`

After completion, extract route-table excerpt:
```bash
grep -E "^[●ƒ]" /tmp/tub-32-pr1-build.log | head -30
```

Expected output includes:
```
● /[locale]/pricing
```

Vitest output should also show all tests passing. Save the full log for PR description.

---

### Task 9: Push PR 1 and verify-on-prod

**Files:** none (deployment + verification)

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: Wait for Vercel deploy READY**

Use `mcp__vercel__list_deployments` for the `yt-comments` project; poll until the latest deployment shows `state: "READY"`. Expected wait: 90-180s.

- [ ] **Step 3: Hard-reload prod /pricing in Chrome MCP (anonymous)**

Open a new incognito context via `mcp__claude-in-chrome__tabs_create_mcp` and navigate to `https://tubemine.tech/en/pricing`.

Run via `mcp__claude-in-chrome__javascript_tool`:

```javascript
const freeCta = document.querySelector('article[aria-labelledby="plan-free"] .price-foot a');
const proCta = document.querySelector('article[aria-labelledby="plan-pro"] .price-foot a');
return {
  freeCtaText: freeCta?.textContent?.trim() ?? null,
  freeCtaHref: freeCta?.getAttribute('href') ?? null,
  proCtaText: proCta?.textContent?.trim() ?? null,
  proCtaHref: proCta?.getAttribute('href') ?? null,
};
```

Expected: free CTA href ends with `/login?intent=signup` (or `/en/login?intent=signup` with locale), pro CTA href ends with `/login?intent=signup&plan=pro`. Both CTA labels match the anonymous variant copy.

- [ ] **Step 4: Run the 5-transition perf measurement**

Run via `mcp__claude-in-chrome__javascript_tool` on the prod /pricing tab the script from `~/vault/references/tubemine-public-page-nav-perf-2026-05-21.md` "Verification methodology". Save the resulting `samples` table.

Target assertions:
- Average TTFB < 120ms
- Total transition < 800ms

If TTFB still > 200ms, check that the deployment actually picked up the new build (compare `mcp__vercel__list_deployments` commit hash with `git log -1 --format=%H` on main).

- [ ] **Step 5: SEO bot check**

Run from local terminal:
```bash
curl -s -A "Googlebot" https://tubemine.tech/en/pricing | grep -E 'href="/(en/)?login\?intent=signup"' | head -3
```

Expected: returns at least one match (the anonymous CTA href is present in the prerendered body).

- [ ] **Step 6: Take screenshot**

Use `mcp__claude-in-chrome__take_screenshot` on the prod /pricing tab, save into `/tmp/tub-32-pr1-anon-screenshot.png` via the tool's output handling. The screenshot accompanies the Linear update.

- [ ] **Step 7: Verify signed-in path (manual via real test account)**

This step requires a real signed-in browser session on prod. Either: (a) use existing Chrome MCP browser already signed in to test account, navigate to `https://tubemine.tech/en/pricing`, repeat the DOM assertion; OR (b) document as user-Tier-2 check if no test account is available in the current session.

For (a), the DOM assertion expects:
- Free tier CTA `Open dashboard` linking to `/en/dashboard`
- Pro card CTA `Start trial` (form submit to `/api/checkout`)

- [ ] **Step 8: No commit (deployment + verification only)**

---

### Task 10: Post Linear update for PR 1

**Files:** none

- [ ] **Step 1: Post update comment to TUB-32**

Use `mcp__claude_ai_Linear__save_comment` on the TUB-32 issue with body:

```
PR 1 (/pricing static migration) shipped on commit <SHA>.

Verify-on-prod assertions PASS:
- /en/pricing renders anonymous CTAs in prerendered HTML (Googlebot fetch OK)
- /en/pricing average TTFB: <Xms> (target <120ms)
- Average total transition: <Yms> (target <800ms)
- Build manifest: ● /[locale]/pricing (static)
- DOM assertion for incognito-anonymous: PASS
- Signed-in free user test (if executed in this session): <PASS / deferred to manual>

Tier 2 manual checks deferred to user:
1. Pro user on /pricing: verify Manage subscription CTA + /api/portal link
2. Revoked-subscription Pro: verify downgrade-to-free CTAs apply
3. Start trial click as Free: verify Polar checkout flow
4. Verify /api/checkout short-circuits Pro users (does not double-charge)
5. Cross-tab sign-out on /pricing: verify CTAs swap to anon within ~1s

Next: PR 2 (landing migration). Observation window 24h before starting.
```

Replace `<SHA>`, `<Xms>`, `<Yms>` with the actual measured values from Task 9.

- [ ] **Step 2: No code commit**

---

## PR 2: `/[locale]/page.tsx` (landing) static migration (Tasks 11-17)

Start PR 2 only after observation window per spec § 9.1 (at least 24h post-PR1-merge OR after one real Polar checkout confirms revenue path intact). The plan-execution loop may pause here at the user's discretion; resume by continuing with Task 11.

### Task 11: Add `.landing-redirect-indicator` CSS

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Append the rule**

Add at the end of `src/app/globals.css`:

```css
/* TUB-32: shown by LandingAuthGate while the warm-hint redirect to
   /dashboard is in flight. Replaces a bare null render so screen
   readers can announce the state change. */
.landing-redirect-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  background: var(--color-background, #0a0a0c);
}
.landing-redirect-indicator .brand-mark {
  width: 32px;
  height: 32px;
  opacity: 0.5;
}
```

If the project already has a `.brand-mark` rule (it does, used by SiteHeader), the local override here adjusts only inside the indicator.

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "$(cat <<'EOF'
style(tub-32): add .landing-redirect-indicator CSS for LandingAuthGate

Renders a centered brand-mark while warm-hint signed-in users are
being redirected to /dashboard. Replaces a bare null render so screen
readers + sighted users see a non-broken state during the 16-50ms
client-navigation window.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Create `LandingAuthGate` component

**Files:**
- Create: `src/components/landing-auth-gate.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "@/i18n/navigation"
import { getAuthHint } from "@/lib/auth-hint"

/**
 * Client island that runs a hint-only redirect for signed-in
 * visitors landing on /[locale]/. No async supabase fetch, no
 * onAuthStateChange listener: the only signal is the localStorage
 * hint set by SiteHeaderClient on every page (TUB-30 contract).
 *
 * Cold-load signed-in visitors with no hint see the anonymous
 * landing. Acceptable trade per spec § 3.4: eliminates the
 * 500-2000ms supabase round-trip on every landing visit (the
 * overwhelming majority of which is anonymous marketing traffic).
 */
export function LandingAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    const hint = getAuthHint()
    if (hint === "signed-in") {
      setRedirecting(true)
      router.replace("/dashboard")
    }
  }, [router])

  if (redirecting) {
    return (
      <div
        className="landing-redirect-indicator"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="brand-mark" aria-hidden="true" />
      </div>
    )
  }
  return <>{children}</>
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing-auth-gate.tsx
git commit -m "$(cat <<'EOF'
feat(tub-32): add LandingAuthGate hint-only client redirect

Reads getAuthHint() synchronously on mount; if hint=signed-in, calls
router.replace('/dashboard') (next-intl auto-prefixes locale). No
async supabase fetch, no listener: hint is set by SiteHeaderClient
on every page so warm-hint signed-in visitors redirect instantly.
Cold-load signed-in visits without a hint see the anonymous landing
(accepted trade per spec § 3.4).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Wire `LandingAuthGate` into `/[locale]/page.tsx`

**Files:**
- Modify: `src/app/[locale]/page.tsx`

- [ ] **Step 1: Read current file and grep for edit targets**

Use the Read tool on `src/app/[locale]/page.tsx` (range 1-220) to confirm imports, dynamic directive, helper function, redirect call, and JSX edit sites occupy the lines referenced below.

Grep for edit sites to surface exact line numbers (more reliable than relying on the plan's pre-execution line refs):

```bash
grep -n "redirect\|isAnonymous\|tier={tier}\|cta_signup\|cta_dashboard" src/app/[locale]/page.tsx
```

Take note of the line numbers reported for: `redirect` import + call, `isAnonymous` ternaries, `tier={tier}` prop pass to TubeMine, and the `cta_signup` / `cta_dashboard` conditional. If `redirect` is referenced anywhere beyond the to-be-deleted `if (!isAnonymous) redirect(...)` block, do NOT remove its import.

Also check the TubeMine prop type so Step 4's `tier="anonymous"` literal typechecks:
```bash
grep -n "ExtractTier\|tier:" src/components/tubemine.tsx | head -5
```

Expected: `ExtractTier = "anonymous" | "free" | "pro"` (or equivalent union including `"anonymous"`). If the literal `"anonymous"` is not in the union, the prop pass will fail typecheck; in that case import the type alias and cast explicitly.

- [ ] **Step 2: Remove server auth imports, helpers, and dynamic directive**

Remove from `src/app/[locale]/page.tsx`:
- Line 1: `import { redirect } from "next/navigation"`. If the import is a multi-name form like `import { redirect, notFound } from "next/navigation"`, remove ONLY the `redirect` symbol from the named-imports list and keep siblings. Only remove the entire line if `redirect` is the sole named import. Do not remove if Step 1's grep showed `redirect` is used elsewhere in the file.
- Line 5: `import { createClient } from "@/lib/supabase/server"`
- Line 6: `import { getUserQuota } from "@/lib/quota"`
- Line 13: `export const dynamic = "force-dynamic"`
- Lines 15-35: `type HomeAuthState` and `resolveHomeAuthState` function
- Line 58: `const { tier, isAnonymous } = await resolveHomeAuthState()`
- Lines 61-63: the `if (!isAnonymous) redirect(...)` block

Add:
```tsx
import { LandingAuthGate } from "@/components/landing-auth-gate"
```

In the TubeMine import line (currently line 4), if it imports `{ TubeMine, type ExtractTier }`, change to `{ TubeMine }` (drop the unused type alias). If the import is differently shaped, leave structure intact; only remove `ExtractTier` if present.

- [ ] **Step 3: Wrap the body in `<LandingAuthGate>`**

Change the page's `return (...)` from:

```tsx
return (
  <>
    <LandingSmoothScroll />
    <main>...</main>
    <LandingFooter t={t} />
  </>
)
```

To:

```tsx
return (
  <LandingAuthGate>
    <LandingSmoothScroll />
    <main>...</main>
    <LandingFooter t={t} />
  </LandingAuthGate>
)
```

- [ ] **Step 4: Replace `<TubeMine tier={tier} />` with anonymous variant**

Find `<TubeMine tier={tier} />` (around current line 180) and change to:
```tsx
<TubeMine tier="anonymous" />
```

- [ ] **Step 5: Unwrap the `isAnonymous ? ... : null` demo-sample-strip**

Find:
```tsx
{isAnonymous ? (
  <div className="demo-sample-strip" role="note" style={{ marginTop: "var(--space-7)" }}>
    ...
  </div>
) : null}
```

Replace with just the `<div className="demo-sample-strip" ...>...</div>` block (drop the conditional wrapper).

- [ ] **Step 6: Unwrap the `isAnonymous ? ... : null` DemoSampleResult**

Find the second `{isAnonymous ? <DemoSampleResult ... /> : null}` block and drop the conditional, leaving only the `<DemoSampleResult ... />` JSX with all its props.

- [ ] **Step 7: Replace conditional IntlLink in trust-accelerant section**

Find:
```tsx
<IntlLink
  href={isAnonymous ? "/login?intent=signup" : "/dashboard"}
  className="btn btn--primary"
>
  {isAnonymous
    ? t("dashboard.cta_signup")
    : t("dashboard.cta_dashboard")}
</IntlLink>
```

Replace with:
```tsx
<IntlLink href="/login?intent=signup" className="btn btn--primary">
  {t("dashboard.cta_signup")}
</IntlLink>
```

The page no longer references `tier` or `isAnonymous` after these edits.

- [ ] **Step 8: Run typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean. If `tier` or `isAnonymous` is referenced anywhere else, grep and fix:
```bash
grep -n "isAnonymous\|tier" src/app/[locale]/page.tsx
```

- [ ] **Step 9: Run build**

Run: `pnpm build 2>&1 | grep -E "^[●ƒ]" | head -20`
Expected: both `● /[locale]/pricing` AND `● /[locale]` appear. The landing route is now static.

If `/[locale]` still shows `ƒ`, grep:
```bash
grep -n "searchParams\|createClient\|cookies()\|headers()\|redirect" src/app/[locale]/page.tsx
```

- [ ] **Step 10: Commit**

```bash
git add src/app/[locale]/page.tsx
git commit -m "$(cat <<'EOF'
refactor(tub-32): wire LandingAuthGate into landing, drop force-dynamic

Removes resolveHomeAuthState helper and force-dynamic directive.
Server hard-redirect for signed-in users replaced by client-side
LandingAuthGate (hint-only). TubeMine rendered with anonymous tier
unconditionally; signed-in users get redirected before this code
runs (warm hint) or accept seeing the landing on cold visits
(documented trade per spec § 4.3). Build manifest now emits
/[locale] as static.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Local verification of landing migration

**Files:** none

- [ ] **Step 1: Run production build and capture manifest**

Run: `pnpm build 2>&1 | tee /tmp/tub-32-pr2-build.log | grep -E "^[●ƒ]" | head -30`
Expected:
```
● /[locale]
● /[locale]/pricing
```

- [ ] **Step 2: Start production server with port readiness check and curl landing**

Run:
```bash
pnpm start &
SERVER_PID=$!
until curl -fs http://localhost:3000/en >/dev/null 2>&1; do sleep 1; done
curl -s -A "Googlebot" http://localhost:3000/en | head -200 | grep -E "TubeMine|hero-title"
```

Expected: hero title + anonymous CTA href visible in the raw HTML body.

Cleanup:
```bash
kill $SERVER_PID 2>/dev/null; pkill -f "next start" 2>/dev/null; true
```

- [ ] **Step 3: Simulate warm-hint redirect locally via Chrome MCP**

Restart dev server: `pnpm dev` in one terminal.

Navigate to `http://localhost:3000/en` via `mcp__claude-in-chrome__navigate`.

Inject the signed-in hint via `mcp__claude-in-chrome__javascript_tool`:

```javascript
localStorage.setItem("tubemine:auth-hint", "signed-in");
location.reload();
return "reloaded";
```

After reload, assert via the same tool:

```javascript
await new Promise(r => setTimeout(r, 600));
return {
  url: location.pathname,
  isOnLandingStill: location.pathname === '/en' || location.pathname === '/',
  indicatorVisible: !!document.querySelector('.landing-redirect-indicator'),
};
```

Expected: `url` is NOT `/en` and NOT `/` (the gate moved off the landing). It will be either `/en/dashboard` (if the test session has a valid Supabase cookie that `(app)/layout.tsx` accepts) OR `/en/login` (if (app) layout rejects the unauthenticated session and redirects further). PASS criterion: `isOnLandingStill === false`. The indicator may have already been replaced by the dashboard or login page by the time the assertion runs.

Clean up: `localStorage.removeItem("tubemine:auth-hint")` + reload.

Stop dev server: `Ctrl+C`.

- [ ] **Step 4: No commit**

---

### Task 15: Pre-push verification (lint, typecheck, build)

**Files:** none

- [ ] **Step 1: Lint + typecheck**

Run: `pnpm lint && pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Final build excerpt for PR description**

Run: `pnpm build 2>&1 | tee /tmp/tub-32-pr2-final-build.log | grep -E "^[●ƒ]" | head -30`
Save the excerpt for the PR body.

---

### Task 16: Push PR 2 and verify-on-prod

**Files:** none

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Wait for Vercel READY**

Poll `mcp__vercel__list_deployments` until latest is READY.

- [ ] **Step 3: Anonymous-visit DOM assertion**

Navigate (incognito tab) to `https://tubemine.tech/en` via Chrome MCP. Run:

```javascript
return {
  hasTubeMine: !!document.querySelector('[data-component="tubemine"], .demo-wrap'),
  hasDemoSample: !!document.querySelector('.demo-result'),
  hasLandingIndicator: !!document.querySelector('.landing-redirect-indicator'),
  url: location.pathname,
};
```

Expected: `hasTubeMine: true`, `hasDemoSample: true`, `hasLandingIndicator: false`, `url: "/en"`.

- [ ] **Step 4: Warm-hint redirect on prod**

Still in incognito tab, simulate a signed-in hint and reload:

```javascript
localStorage.setItem("tubemine:auth-hint", "signed-in");
location.reload();
return "reloaded";
```

After reload:

```javascript
await new Promise(r => setTimeout(r, 800));
return {
  url: location.pathname,
  isOnLandingStill: location.pathname === '/en' || location.pathname === '/',
};
```

PASS criterion: `isOnLandingStill === false`. The exact destination is `/en/dashboard` (if a real session existed; rare in incognito) OR `/en/login` (the typical incognito case where `(app)/layout.tsx` redirects unauthenticated). Confirms the gate fired off the landing.

Cleanup: `localStorage.removeItem("tubemine:auth-hint")`.

- [ ] **Step 5: 5-transition perf measurement on landing**

Same script as Task 9 step 4 but transitioning between `/en` and `/en/docs`. Target: average TTFB < 120ms.

- [ ] **Step 6: SEO bot check**

Run from terminal:
```bash
curl -s -A "Googlebot" https://tubemine.tech/en | grep -E "hero-title|Get started" | head -3
```

Expected: hero + anon CTA visible in raw HTML.

- [ ] **Step 7: Screenshot**

`mcp__claude-in-chrome__take_screenshot` on prod /en, save reference.

---

### Task 17: Regression sentinel sweep

**Files:** none

- [ ] **Step 1: Verify TUB-30 routes still fast**

Navigate to `https://tubemine.tech/en/docs` then to `/en/changelog`. Run the 5-transition script. Average TTFB should still be < 200ms (TUB-30 baseline). If regressed, investigate before closing TUB-32.

- [ ] **Step 2: Verify (app) routes still work**

Open `https://tubemine.tech/en/dashboard` in a signed-in browser session. Confirm page renders normally (no regression from TUB-32 changes; (app) layout is unchanged but verify).

If no signed-in session is available, document as deferred manual check.

- [ ] **Step 3: Verify /login still functional**

Navigate to `https://tubemine.tech/en/login`. Confirm it loads, OAuth button is present. Sign in flow is not exercised in this verification (would require disposing of test session).

- [ ] **Step 4: No commit**

---

### Task 18: Close Linear issue with summary

**Files:** none

- [ ] **Step 1: Post closing comment via `mcp__claude_ai_Linear__save_comment`**

```
TUB-32 done. Both PRs shipped and verified.

PR 1 (/pricing): commit <SHA1>
PR 2 (/landing): commit <SHA2>

Routes audited:
- /[locale]/page.tsx (LANDING): migrated to static via LandingAuthGate
- /[locale]/pricing: migrated to static via PricingTierAware
- /[locale]/login: intentionally kept dynamic. Justifications:
  1. Low-traffic auth gate
  2. Server-side safe(next) redirect is more reliable than client equivalent
  3. OAuth callback + ?intent query routing depends on synchronous server parsing
  4. Migration win marginal vs implementation cost
- /[locale]/docs, /changelog, /privacy, /terms, /oauth-intro: already static (TUB-30 territory)
- /(app)/dashboard, /profile, /history: out of scope (TUB-28 territory)

Build manifest after PR 2:
● /[locale]
● /[locale]/pricing
● /[locale]/changelog
● /[locale]/docs
● /[locale]/privacy
● /[locale]/terms
ƒ /[locale]/login  (intentional)

Before/after TTFB (Chrome MCP, 5-sample averages):
- /pricing: baseline 274-359ms TTFB -> after <Xms> (-Y%)
- /landing: baseline N/A (force-dynamic) -> after <Zms>
- /docs -> /changelog: unchanged TUB-30 baseline

Tier 2 manual checks deferred to user (revenue-path verification):
1. Pro tier user on /pricing: Manage subscription CTA + /api/portal link
2. Revoked-Pro user: free CTAs apply via subscription.status revocation override
3. Start trial as Free: Polar checkout completes
4. Start trial as Pro: /api/checkout short-circuits (no double-charge)
5. Cross-tab sign-out: CTAs swap to anon within ~1s

Subtleties surfaced during implementation:
[REPLACE WITH bullet list of any surprises during execution. Remove this line if none.]
```

Mark TUB-32 status: Done.

- [ ] **Step 2: Append session summary to ~/vault/daily/2026-05-21.md**

Use `mcp__obsidian__write_note` with mode: append:

```markdown

## Session Summary (HH:MM): TUB-32 public routes static-migration sweep

- **Goal:** migrate /pricing and /landing to static prerender; keep /login dynamic
- **Progress:** 2 PRs shipped via direct commits to main (per project workflow). Both verified on prod with Tier 1 assertions.
- **Decisions:**
  - PricingTierAware client island owns pricing-grid only (comparison table stays in server scope for SEO + bundle)
  - LandingAuthGate is hint-only (no async supabase); accepts cold-load signed-in flash trade for ~300ms TTFB win on every visit
  - requestId counter pattern (useRef) protects against cold supabase-js INITIAL_SESSION race
  - PricingIntentRedirect now strips ?intent=signup via history.replaceState before /api/checkout assign to prevent back-button loop
  - /login intentionally kept dynamic (4 reasons documented in Linear)
- **Files (code):**
  - src/components/pricing-tier-aware.tsx (new)
  - src/components/landing-auth-gate.tsx (new)
  - src/components/pricing-intent-redirect.tsx (added replaceState)
  - src/app/[locale]/pricing/page.tsx (removed loadAuthState, force-dynamic, searchParams)
  - src/app/[locale]/page.tsx (removed resolveHomeAuthState, force-dynamic, hard redirect)
  - src/app/globals.css (added .price-foot min-height + .landing-redirect-indicator)
- **Linear:** TUB-32 Done. Comment includes both commit SHAs, build manifest excerpt, deferred Tier 2 checks.
- **Next:** TUB-28 perf work continues separately (app-shell). No follow-up tasks for TUB-32.
```

Replace `HH:MM`, `<Xms>`, `<Yms>`, `<Zms>` with actuals before saving.

- [ ] **Step 3: No code commit**

---

## Final Self-Review Notes

- Every code task includes the actual code to write or modify, not a "TBD" placeholder.
- The `requestId` counter pattern is shown verbatim in Task 5 step 1.
- The `history.replaceState` call appears in Task 7 step 1.
- The build-manifest gate appears in Tasks 3 step 4, 5 step 4, 8 step 3, 13 step 5, 14 step 1, 15 step 2; if any of these fails, the implementation is incomplete.
- The em-dash constraint applies to commit messages and Linear comments above; verify no U+2014 or U+2013 character slipped in (use `git log -p` after committing to grep). Plan body itself has been authored without em-dashes.
- `/login` dynamic justification is in the Linear comment template (Task 18), matching spec §2.3.
