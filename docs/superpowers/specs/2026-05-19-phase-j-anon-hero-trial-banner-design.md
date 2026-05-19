# Phase J design, anon-only hero + 3-day trial + trial banner + RU sentiment labels

**Date:** 2026-05-19
**Predecessor:** Phase H code-gap shipped (commit `32423b5`)
**Scope:** 4 backend code deliverables that close the gap between Phase H/I design intent and production code.
**Out of scope:** Track A HTML-bundle integration sprint, Polar webhook signature changes, RLS policy changes, BYOK/API tier, full pricing-table redesign.

## Goals

1. Signed-in users on `/` see only the extractor, not the marketing hero (clutter for returning users; bookmark friendliness).
2. Pro free trial is 3 days, not 7 (matches founder's pricing-strategy decision; lower cancellation window for paywall psychology).
3. Trialing users see a countdown banner on Dashboard with a Manage CTA (transparency, reduces "did I actually trial?" support friction).
4. Russian users see sentiment qualitative labels in Russian, not English fallback (parity with the rest of RU UI).

## Non-goals

- Polar product config change (manual, gated by AskUserQuestion).
- Full pricing table revamp (Phase H Track A integration sprint, separate work).
- Webhook handler logic changes (already supports `trialing` status).
- New DB columns (current `subscriptions` schema covers trial state).
- BYOK API key support.
- Server-rendered EN sentiment label changes (already shipped Phase H).
- Curiosity-gap copy on the trial banner (information-only banner, not a paywall surface).

## Deviations from initial brief (locked decisions)

Three points where the brief's premise was inaccurate after code inspection, locked here:

1. **No "Start 7-day free trial" copy exists in production.** The Phase H design HTML bundle had it, but Track A (HTML to Next.js integration) never shipped. The current Pro CTA is `<UpgradeButton>` with hard-coded label "Upgrade to Pro" in `src/app/[locale]/dashboard/upgrade-button.tsx`. Phase J ADDS the "Start 3-day free trial" label, it does NOT replace a 7-day label.
2. **No `trial_ends_at` migration needed.** `subscriptions.status` is `text not null` (no CHECK), accepting "trialing" without schema change. `subscriptions.current_period_end timestamptz` already carries the trial-end timestamp during a trialing subscription (Polar's behavior). The trial banner reads these two existing columns; no migration.
3. **`qualitativeSummary` has 7 outcomes, not 5.** Brief listed Mostly positive / Leans positive / Mixed / Leans negative / Mostly negative. Actual code adds "Polarized audience" (when pos and neg both at least 0.3) and "Mostly neutral" (fallback). Phase J translates all 7. New i18n namespace `sentiment_label.*` has 7 keys per locale, 14 entries total.

## Architecture

### Tier and auth resolution on `/`

`src/app/[locale]/page.tsx` currently calls `resolveTier()` which returns `"anonymous" | "free" | "pro"`. The component then renders `<Hero />` unconditionally and `<TubeMine tier={tier} />`.

After Phase J, the function signature stays the same (returns tier), but the page also derives `isAnonymous` from the same Supabase call. To avoid double `supabase.auth.getUser()` and double `getUserQuota()` per request, the resolver returns a small record:

```ts
type HomeAuthState = { tier: ExtractTier; isAnonymous: boolean }

async function resolveHomeAuthState(): Promise<HomeAuthState> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { tier: "anonymous", isAnonymous: true }
  }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { tier: "anonymous", isAnonymous: true }
    const quota = await getUserQuota(user.id)
    return { tier: quota.tier, isAnonymous: false }
  } catch {
    return { tier: "anonymous", isAnonymous: true }
  }
}
```

The page then renders:

```tsx
const { tier, isAnonymous } = await resolveHomeAuthState()
return (
  <div className="flex flex-1 flex-col">
    {isAnonymous && <Hero />}
    <main className={isAnonymous ? "... -mt-20 ..." : "... pt-24 sm:pt-28 ..."}>
      <TubeMine tier={tier} />
    </main>
    <Footer />
  </div>
)
```

Footer stays for everyone (single source-link, low chrome). Negative top margin on `main` is anon-only; signed-in path gets a normal top padding so the extractor sits below the global nav without the Hero offset.

### Trial state surfacing

`subscriptions` table fields used:

- `status text` (values seen in handlers: "active", "trialing", "canceled", "revoked", "past_due")
- `current_period_end timestamptz` (during trialing, this is the trial-end moment per Polar)

RLS policy "users read own subscription" already allows the signed-in user to SELECT their own row via `createClient`. No service role escalation needed in the dashboard server component.

`<TrialBanner userId={user.id} />` server component, full structure:

```tsx
import "server-only"
import NextLink from "next/link"
import { Sparkles, ArrowUpRight } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

type TrialState =
  | { kind: "active"; daysLeft: number }
  | { kind: "today" }
  | null

async function loadTrialState(userId: string): Promise<TrialState> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle()
  if (!data || data.status !== "trialing" || !data.current_period_end) return null
  const endsAt = Date.parse(data.current_period_end)
  if (Number.isNaN(endsAt) || endsAt <= Date.now()) return null
  const msRemaining = endsAt - Date.now()
  if (msRemaining <= 86_400_000) return { kind: "today" }
  const daysLeft = Math.ceil(msRemaining / 86_400_000)
  return { kind: "active", daysLeft }
}

export async function TrialBanner({ userId }: { userId: string }) {
  const state = await loadTrialState(userId)
  if (!state) return null
  const t = await getTranslations("dashboard")
  const text =
    state.kind === "today"
      ? t("trial_banner_today")
      : t("trial_banner_text", { days: state.daysLeft })
  return (
    <Card className="border-amber-500/30 bg-amber-500/[0.04]">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <Sparkles className="size-5 text-amber-600" />
          <p className="text-sm">{text}</p>
        </div>
        <NextLink href="/api/portal" className={buttonVariants({ variant: "outline", size: "sm" })}>
          {t("trial_manage_cta")} <ArrowUpRight className="size-3.5" />
        </NextLink>
      </CardContent>
    </Card>
  )
}
```

Render contract: returns `null` when there is nothing to show (no row, non-trialing, missing date, expired date). The "today" branch fires when less than 24h remain, replacing the misleading "1 day left" copy with explicit "Trial ends today" wording.

### Sentiment label localization

`qualitativeSummary()` returns an enum key, not a translated string. Consumers translate via next-intl.

```ts
export type SentimentLabelKey =
  | "mostly_positive"
  | "leans_positive"
  | "mixed"
  | "leans_negative"
  | "mostly_negative"
  | "polarized"
  | "mostly_neutral"

export function qualitativeSummary(dist: SentimentDistribution): SentimentLabelKey {
  const { positive: pos, negative: neg, neutral: neu } = dist
  if (neu >= 0.99) return "mixed"
  if (pos >= 0.3 && neg >= 0.3) return "polarized"
  if (pos >= 0.6) return "mostly_positive"
  if (neg >= 0.6) return "mostly_negative"
  if (pos > neg) return "leans_positive"
  if (neg > pos) return "leans_negative"
  return "mostly_neutral"
}
```

Tie-break ordering and thresholds preserved 1:1 from the existing implementation. Only the return type changes.

Consumers:

- `src/components/recent-analyses.tsx` (server): `const t = await getTranslations("sentiment_label")` then `t(qualitativeSummary(dist))`.
- `src/components/sentiment.tsx` (client): `const t = useTranslations("sentiment_label")` then `t(qualitativeSummary(dist))`. The existing `const summary = qualitativeSummary(dist)` becomes `const summary = t(qualitativeSummary(dist))`.
- `src/app/[locale]/history/history-client.tsx` (client): same as sentiment.tsx.

`proSentimentLabel()` stays unchanged because it returns `{pct}% positive` style, which is locale-agnostic enough for now (Phase J keeps the percent format; full RU pluralization is out of scope).

## Components

### `src/components/trial-banner.tsx` (new)

Server component. Renders nothing when the user is not trialing. Full structure shown in Architecture section above.

i18n keys (under `dashboard.*` namespace, matches existing Dashboard convention):

- `dashboard.trial_banner_text` (fires when 1+ full day remains)
  - EN: `"Trial: {days, plural, one {# day} other {# days}} left, then $19/mo."`
  - RU: `"Триал: осталось {days, plural, one {# день} few {# дня} many {# дней} other {# дней}}, потом $19/мес."`
- `dashboard.trial_banner_today` (fires when less than 24h remain)
  - EN: `"Trial ends today, then $19/mo."`
  - RU: `"Триал заканчивается сегодня, потом $19/мес."`
- `dashboard.trial_manage_cta`
  - EN: `"Manage subscription"`
  - RU: `"Управлять подпиской"`

Russian pluralization uses ICU plural per next-intl docs. For 3-day trial only `one` and `few` are reachable today; `many` and `other` kept for resilience if trial length changes in the future.

Mount point: `src/app/[locale]/dashboard/page.tsx`, between the `showWelcome` notice (if any) and the Plan card. Rendered as `<TrialBanner userId={user.id} />`. Component returns `null` when not trialing, so the slot collapses silently.

### `src/components/upgrade-button.tsx` (modified)

Add a REQUIRED `label` prop. Both existing callers (pricing page Pro CTA, dashboard Free upgrade panel) pass the localized trial CTA. Making the prop required avoids dead-code fallback strings.

```tsx
export function UpgradeButton({ fullWidth = false, label }: { fullWidth?: boolean; label: string }) {
  // existing useState + onUpgrade logic unchanged
  return (
    <Button
      onClick={onUpgrade}
      disabled={loading}
      size={fullWidth ? "default" : "sm"}
      className={fullWidth ? "w-full" : undefined}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : label}
    </Button>
  )
}
```

Pricing page Pro CTA (when signed-in Free) passes `label={t("pricing.start_trial_cta")}`. Dashboard Free upgrade panel passes the same. Anon Pro CTA on pricing page stays "Sign in to upgrade" (no change, that path does not render UpgradeButton).

i18n key `pricing.start_trial_cta`:

- EN: `"Start 3-day free trial"`
- RU: `"Начать 3-дневный пробный период"`

Optional sub-note under the CTA on the pricing page (NOT inside the button, but a `<p className="text-xs ...">` directly beneath the CTA in the Pro card):

- `pricing.trial_subnote`
  - EN: `"$19/mo after. Cancel anytime."`
  - RU: `"После $19/мес. Отмена в любой момент."`

Sub-note renders only when the CTA is the trial CTA (signed-in Free state). For Pro and anon states, no sub-note.

## Data flow

```
Polar Pro product (trial_period_days = 3, set in Polar dashboard)
  ─> User clicks "Start 3-day free trial" on /pricing
  ─> /api/checkout creates Polar Checkout session
  ─> User completes card on file
  ─> Polar emits subscription.created (status=trialing, current_period_end=now+3d)
  ─> /api/polar/webhook -> handleSubscriptionActive -> profiles.tier=pro,
        subscriptions.{status:"trialing", current_period_end:trial-end}
  ─> User lands on /dashboard
  ─> Dashboard reads (a) profiles.tier=pro via getUserQuota -> Pro plan card
                     (b) subscriptions.status=trialing -> TrialBanner shows 3-day countdown

  ... 3 days later ...

  ─> Polar charges card automatically; emits subscription.updated (status=active)
  ─> Webhook keeps tier=pro, subscriptions.status=active
  ─> TrialBanner reads status=active -> returns null -> slot collapses

  ─OR-

  ─> User cancels in trial via /api/portal
  ─> Polar emits subscription.canceled then subscription.revoked
  ─> Webhook downgrades tier=free, subscriptions.status=revoked
  ─> TrialBanner returns null -> Plan card flips back to Free
```

## i18n key inventory

Phase J adds 12 keys per locale (24 total across EN and RU).

| Key | EN | RU |
|---|---|---|
| `dashboard.trial_banner_text` | `Trial: {days, plural, one {# day} other {# days}} left, then $19/mo.` | `Триал: осталось {days, plural, one {# день} few {# дня} many {# дней} other {# дней}}, потом $19/мес.` |
| `dashboard.trial_banner_today` | `Trial ends today, then $19/mo.` | `Триал заканчивается сегодня, потом $19/мес.` |
| `dashboard.trial_manage_cta` | `Manage subscription` | `Управлять подпиской` |
| `pricing.start_trial_cta` | `Start 3-day free trial` | `Начать 3-дневный пробный период` |
| `pricing.trial_subnote` | `$19/mo after. Cancel anytime.` | `После $19/мес. Отмена в любой момент.` |
| `sentiment_label.mostly_positive` | `Mostly positive` | `В основном позитив` |
| `sentiment_label.leans_positive` | `Leans positive` | `Скорее позитив` |
| `sentiment_label.mixed` | `Mixed` | `Смешанные` |
| `sentiment_label.leans_negative` | `Leans negative` | `Скорее негатив` |
| `sentiment_label.mostly_negative` | `Mostly negative` | `В основном негатив` |
| `sentiment_label.polarized` | `Polarized audience` | `Поляризованная аудитория` |
| `sentiment_label.mostly_neutral` | `Mostly neutral` | `В основном нейтрально` |

Parity script `node scripts/check-message-parity.mjs` must pass.

## Polar dashboard configuration (manual, gated)

Before any code is pushed, the user must:

1. Open https://polar.sh/dashboard, select the TubeMine org.
2. Products, select Pro $19/mo.
3. Edit, set `trial_period_days = 3`.
4. Save.
5. Confirm to the AI agent "done" via AskUserQuestion.

The agent halts code-side work until this confirmation lands. The agent does NOT call any Polar API; this is a manual operator change.

## Edge cases

1. **Anonymous on `/`** seeing the hero is current behavior. Phase J preserves it.
2. **Signed-in Free on `/`** sees only extractor. The `<TubeMine tier="free" />` extractor still renders the curiosity-gap analytics CTAs from Phase G.
3. **Signed-in Pro on `/`** sees only extractor.
4. **Trialing user on `/`** is treated as Pro because the webhook sets `profiles.tier = "pro"` on `subscription.created` (per `src/lib/subscription.ts:101-142`). `getUserQuota` therefore returns `tier: "pro"`. Hero is hidden, Pro-tier `<TubeMine />` widgets render.
5. **Dashboard with no `subscriptions` row** (Free user who never started a trial): TrialBanner returns null. Plan card shows Free.
6. **Dashboard with `subscriptions.status="active"`** (paid Pro, no trial): TrialBanner returns null. Plan card shows Pro.
7. **Dashboard with `subscriptions.status="trialing"` but `current_period_end` already past** (race during cron downgrade): TrialBanner returns null defensively. Plan card may briefly show Pro until webhook updates flow.
8. **Dashboard with `subscriptions.status="trialing"` and `current_period_end` null** (malformed Polar payload): TrialBanner returns null.
9. **Dashboard with `subscriptions.status="canceled"` mid-trial**: Polar still treats as active until `current_period_end`. Webhook keeps tier=pro. TrialBanner checks `status === "trialing"`, so a `canceled` status returns null (banner hides; users see the regular Plan card and Manage CTA).
10. **`Date.parse(current_period_end)` returns NaN**: TrialBanner returns null.
11. **At or less than 24h remaining** (e.g. 24h-on-the-dot, 2 hours left): `loadTrialState` returns `{ kind: "today" }` (threshold is `msRemaining <= 86_400_000`) and the banner shows "Trial ends today, then $19/mo." instead of the misleading "1 day left". When the trial has actually expired, `endsAt <= Date.now()` short-circuits to null before this branch. "1 day left" copy is reachable only when `msRemaining` is strictly greater than 24h but less than or equal to 48h.
12. **RU plural at day 1**: `plural, one {# день}` resolves to "1 день". At days 2-4: "2 дня". At days 5+: "5 дней". next-intl uses Intl.PluralRules. Today's 3-day trial reaches only `one` and `few`; `many`/`other` are kept future-proofed.
13. **EN plural at day 1**: "1 day left". At day 2+: "N days left".
14. **Sentiment label key collision in RU**: `mostly_positive` and `leans_positive` use different Russian wording ("В основном позитив" vs "Скорее позитив") to preserve the gradient distinction. Similarly negative.
15. **`qualitativeSummary` callers using the old string-returning version**: callers updated atomically in the same commit. No callers outside the three components above (`sentiment.tsx`, `recent-analyses.tsx`, `history-client.tsx`) per `grep -rn 'qualitativeSummary' src`.
16. **Anonymous user clicks "Start 3-day free trial" on /pricing**: NOT a path. Anon state on the Pro card is "Sign in to upgrade" link (unchanged from current).
17. **Already-trialing user when Polar dashboard config flips 7 to 3**: per Polar docs, existing subscription contracts honor their original trial length. The new 3-day config applies only to NEW trials started after the dashboard save. No user-facing inconsistency expected because there are no current 7-day trial users (no trial CTA was live).
18. **Multi-tab race**: User opens Dashboard in two tabs while trial expires. Both tabs server-render on next refresh; the banner correctly disappears.
19. **`/api/portal` returns 401 for non-Pro user**: not a Phase J concern (existing behavior). Trial users have profiles.tier=pro so the portal works.
20. **Curl-test of `/` from a signed-in browser cookie**: GET response will not contain the hero `<header>`. Verifiable via `curl -H "Cookie: sb-...=..." | grep -c hero_title_a` returning 0.
21. **SEO: Bot crawlers** (Googlebot, Bingbot, etc) on `/`: bots are anonymous (no cookie), so they see the hero. Existing SEO content preserved. Pages stay `dynamic = "force-dynamic"`.
22. **Server-component `getTranslations` mid-render error**: returns the key string back to the caller (next-intl default). Visible degraded but does not throw.
23. **Sentiment label NOT in trial-banner copy**: TrialBanner and sentiment-label namespaces are independent.
24. **`subscriptions.status="past_due"`**: TrialBanner returns null (status !== "trialing"). Existing payment-failure UI is out of scope.
25. **Pre-webhook arrival**: user completes Polar checkout and lands on `/dashboard` before the `subscription.created` webhook fires (typical Polar latency 1-30s, often under 2s). `profiles.tier` is still `"free"`, `subscriptions` row is absent. Plan card briefly shows Free, TrialBanner returns null, the "Start 3-day free trial" upgrade CTA is still visible. Accepted trade-off because Polar webhooks land in seconds and a manual refresh resolves the rare slow case. No additional mitigation in Phase J; if support tickets surface, revisit with a polling endpoint in a follow-up sprint.
26. **Mid-trial cancellation**: when user clicks Cancel in the Polar customer portal during the trial, webhook flips `subscriptions.status` to `"canceled"` immediately, but `profiles.tier` stays `"pro"` (revoked event fires later at `current_period_end`). TrialBanner returns null per its `status !== "trialing"` guard. Plan card shows Pro with the existing "Manage subscription" CTA. User has no in-app indicator of "trial canceled, ends on {date}", but the Polar customer portal shows them this information. Accepted trade-off; revisit only if support tickets surface.
27. **Multi-tab open during trial expiry**: tab A and tab B both rendered server-side while trialing. Trial ends. Tab A is refreshed and shows "Trial ended" UI (banner gone). Tab B is left open and continues to show stale "X days left" banner until reload. Since TrialBanner is a server component, no client tick removes it. Accepted trade-off; adding a client-island timer adds 30+ lines of hydration + interactivity for a low-incidence UX nit.
28. **FAQ "What about refunds?" 7-day reference on `/pricing`**: out of scope of Phase J. The 7-day refund window is a separate policy from the 3-day trial; coexisting numbers may briefly confuse, but rewriting the FAQ is policy work, not trial work. Defer to a follow-up sprint.

## Tests

vitest (`pnpm test`). Add:

1. `src/components/__tests__/trial-banner.test.tsx`, 7 cases:
   - returns null when no `subscriptions` row.
   - returns null when status is "active".
   - returns null when status is "canceled" (mid-trial cancel).
   - returns null when status is "trialing" but `current_period_end` is null.
   - returns null when status is "trialing" but `current_period_end` is in the past.
   - renders days copy with `daysLeft = 3` when status is "trialing" and `current_period_end` is now + 72h.
   - renders today copy when status is "trialing" and `current_period_end` is now + 12h (less than 24h remain).

2. `src/lib/__tests__/sentiment-summary.test.ts` (extend or add):
   - Each of the 7 outcomes maps to its expected key:
     - `{ pos: 0.7, neu: 0.2, neg: 0.1 } -> "mostly_positive"`
     - `{ pos: 0.5, neu: 0.3, neg: 0.2 } -> "leans_positive"`
     - `{ pos: 0, neu: 1, neg: 0 } -> "mixed"` (neu >= 0.99 branch)
     - `{ pos: 0.2, neu: 0.3, neg: 0.5 } -> "leans_negative"`
     - `{ pos: 0.05, neu: 0.25, neg: 0.7 } -> "mostly_negative"`
     - `{ pos: 0.4, neu: 0.2, neg: 0.4 } -> "polarized"` (pos >= 0.3 && neg >= 0.3)
     - `{ pos: 0.25, neu: 0.5, neg: 0.25 } -> "mostly_neutral"` (pos === neg, both < 0.3, neu < 0.99)
   - Tie-break order preserved: when `pos > neg` strictly, `leans_positive` wins over `mostly_neutral`. Test:
     `{ pos: 0.2, neu: 0.5, neg: 0.1 } -> "leans_positive"` (strict pos > neg, neu < 0.99).

Mocks: trial-banner test mocks `@/lib/supabase/server.createClient` to return a stub with `from().select().eq().maybeSingle()` returning the desired row.

No `/api/extract` or `/api/export` test changes.

## Verification gates (pre-push)

- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm lint` clean
- [ ] `pnpm test` passes, with all new trial-banner and sentiment-label tests green
- [ ] `node scripts/check-message-parity.mjs` clean (24 new keys EN+RU)
- [ ] `pnpm build` succeeds, no client-bundle bloat
- [ ] No em-dash (U+2014) or en-dash (U+2013) in any changed `src/`, `messages/`, or `docs/superpowers/` file
- [ ] No Polar-banned verbs (extract / scrape / bulk / pull data / Priority) in new UI strings
- [ ] Local `next dev` smoke at desktop width:
  - Anon on `/` shows hero + extractor.
  - Signed-in (any tier) on `/` shows ONLY extractor (no hero).
  - Dashboard for non-trialing user shows no banner.
  - Dashboard for trialing test user (manually inserted `subscriptions` row in dev Supabase) shows banner with correct day count.
  - RU locale: sentiment label on a sample Free analysis shows Russian.
- [ ] AskUserQuestion gate 1: confirm Polar `trial_period_days = 3` saved in dashboard before push.
- [ ] AskUserQuestion gate 2: confirm commit SHA + diff summary before `git push`.

## Files changed (planned)

| File | Change | Lines (est) |
|---|---|---|
| `src/app/[locale]/page.tsx` | resolveHomeAuthState() helper, conditional Hero render | +20/-10 |
| `src/components/trial-banner.tsx` | new server component, two-branch render | +80 |
| `src/components/__tests__/trial-banner.test.tsx` | new test file, 7 cases | +140 |
| `src/app/[locale]/dashboard/page.tsx` | mount TrialBanner above Plan card | +3 |
| `src/app/[locale]/dashboard/upgrade-button.tsx` | require label prop, drop dead default | +3/-2 |
| `src/app/[locale]/pricing/page.tsx` | pass localized trial CTA label + subnote | +12/-2 |
| `src/lib/sentiment-summary.ts` | qualitativeSummary returns key, not string | +8/-7 |
| `src/lib/__tests__/sentiment-summary.test.ts` | extend (or add), 7+1 cases | +35 |
| `src/components/sentiment.tsx` | useTranslations on label | +3/-1 |
| `src/components/recent-analyses.tsx` | getTranslations on label | +3/-1 |
| `src/app/[locale]/history/history-client.tsx` | useTranslations on label | +3/-1 |
| `messages/en.json` | 12 new keys | +13 |
| `messages/ru.json` | 12 new keys | +13 |

Total estimate: 13 files, ~336 lines added, ~24 lines removed.

## Locked decisions

1. **Hero gate on `/` is server-side**, not client-side cookie check. Reason: avoids hydration flash, keeps page server-rendered, Googlebot still sees the hero.
2. **Trial banner above Plan card**, not inline as a Plan card status. Reason: visually distinct (amber tint) so the user perceives it as a transient state, not as the new normal.
3. **Trial banner uses `subscriptions` table, not a new `profiles.trial_ends_at`**. Reason: zero migration risk, single source of truth already populated by webhook.
4. **Sentiment labels switch to keys**, not parameterized strings. Reason: cleaner separation, future-proof for adding more locales.
5. **`qualitativeSummary` keeps all 7 outcomes**, including Polarized and Mostly neutral. Reason: dropping outcomes would lose signal; translating all 7 is cheap (4 extra strings).
6. **No new `trialing` tier surfaced** in `getUserQuota`. Trialing users keep `tier: "pro"` for quota and entitlements. Trial state is a separate, orthogonal flag read from `subscriptions`.
7. **Trial CTA label is hard-coded length** (3 days) in EN and RU. If product changes to 5 or 7 in the future, copy update is a separate PR. Reason: avoids over-parameterization for a number that rarely changes.
8. **Trial subnote is OPT-IN per call-site**, not forced everywhere. Pricing page Pro card gets it; dashboard Free upgrade panel does not (already has surrounding context). Reason: avoid duplication.
9. **`upgrade-button.tsx` `label` prop is REQUIRED**, no default. Reason: both existing call sites pass a localized label, so a fallback would be dead code that obscures translation gaps. Future call sites are forced to provide a localized string.
10. **Trial banner does NOT render for status "canceled" mid-trial**. Reason: once the user clicks Cancel, the "Trial X days left, then $19/mo" copy is misleading (no charge will happen). The default Plan card + Manage CTA is the correct UI for that state.
11. **Separate "today" branch when `msRemaining <= 86_400_000`** (inclusive 24h boundary), not a `Math.max(1, ...)` clamp. Reason: clamping made "1 day left" appear at 2h-remaining, inviting "I thought I had a day" support tickets after a same-day charge. Inclusive boundary means "1 day left" shows only on the second-to-last day; the final 24h always render "today". Two branches plus one extra i18n key is worth the clarity.
12. **No analytics events** added for trial banner views or trial CTA clicks. Reason: Phase J scope is plumbing; add analytics in a follow-up if conversion data is needed.
13. **No webhook handler changes.** `handleSubscriptionActive` already supports `subscription.created` with `status: "trialing"` (sets tier=pro). `handleSubscriptionUpdated` also routes `trialing` to tier=pro. Verified in `src/lib/subscription.ts:101-142`.
14. **No new `dynamic = "force-dynamic"` declarations**. `/`, `/dashboard`, and `/pricing` all already have it.
15. **Polar dashboard config is a manual operator step**, not automated. Reason: Polar's API for product config is unstable and not worth wiring for a one-time toggle.
16. **`<TrialBanner>` is a server component**, not client. Reason: it reads DB state, never re-fetches client-side, no interactivity beyond the Manage link.
17. **`getTranslations("sentiment_label")` is loaded in `recent-analyses.tsx`** as a separate call from existing `getTranslations("dashboard")`. Reason: namespace isolation; next-intl supports multiple namespace handles per render.
18. **`pricing.trial_subnote` is plain text**, not interpolated. Reason: simplifies translation; "$19" stays literal.
19. **No new env vars**. Phase J uses existing Supabase + Polar wiring.
20. **No changes to `vercel.json`, `next.config.ts`, or middleware**. Pure src-tree change.

## Open follow-ups (Phase J+1 or later)

- Track A HTML to Next.js integration sprint (8-12h, separate scope).
- Analytics events for trial-banner views and trial-CTA clicks.
- Full RU pluralization on `proSentimentLabel` percent strings.
- Trial countdown email (T-1 day reminder via Resend).
- Pricing page redesign (drop the FAQ "What about refunds?" 7-day reference since refund window is unrelated to trial length but the same number is confusing).
- Admin tool to extend a user's trial manually (CS support).

## Risk surface (90-day)

Small. Reasoning:

- Hero gate is a single boolean conditional, server-side, behind existing auth check.
- Trial banner is presentation-only and reads from a row the dashboard would render anyway via `getUserQuota`. Adds one more `select status, current_period_end` query (a few ms). RLS already covers reads.
- Sentiment label refactor changes only the return type of one pure function. The 3 consumers update in lockstep. No new external API surface.
- Polar config change is manual and reversible (operator can set back to 7 days in one click).
- The biggest unknown is RU translation quality for the 7 sentiment labels and 1 trial banner. Translations chosen are direct and idiomatic; a future native speaker review can refine without code change.

## Sources

- Phase H code-gap shipped, `projects/yt-comments/launch/2026-05-19/phase-h-backend-shipped.md` in vault.
- Phase H card cleanup + history tail design, `projects/yt-comments/launch/2026-05-19/phase-h-card-cleanup-and-history-tail.md` in vault.
- Runbook, `playbooks/saas-roadmap/12-production-shipping-runbook.md` in vault, sections 2 (auth + DB), 4 (E2E verification), 6 (deployment).
- OAuth quota pattern reference, `references/saas-quota-scaling-oauth-pattern.md` in vault.
- Existing code: `src/app/[locale]/page.tsx`, `src/lib/quota.ts`, `src/lib/sentiment-summary.ts`, `src/components/sentiment.tsx`, `src/components/recent-analyses.tsx`, `src/app/[locale]/history/history-client.tsx`, `src/app/api/polar/webhook/route.ts`, `src/lib/subscription.ts`, `src/app/[locale]/dashboard/page.tsx`, `src/app/[locale]/dashboard/upgrade-button.tsx`, `src/app/[locale]/pricing/page.tsx`, `supabase/migrations/00_init.sql`.
