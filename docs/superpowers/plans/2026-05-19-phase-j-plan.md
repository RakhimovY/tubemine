# Phase J Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 4 backend deliverables locked by spec `docs/superpowers/specs/2026-05-19-phase-j-anon-hero-trial-banner-design.md`: anon-only marketing hero on `/`, Polar trial reduced from 7 to 3 days with new CTA copy, trial-state countdown banner on Dashboard, and Russian-localized qualitative sentiment labels.

**Architecture:** Server-side conditional render gates the hero on `/`. The TrialBanner is a server component reading the existing `subscriptions` row (no migration). Sentiment qualitative labels switch from English strings to a 7-key enum that downstream consumers translate via next-intl. UpgradeButton signature is tightened to require a label so each call site supplies localized copy.

**Tech Stack:** Next.js 16 App Router, React 19 server/client components, next-intl (ICU plural support), Supabase (server-only `createClient`), Polar (subscription webhook, dashboard config), vitest with node environment.

---

## Task ordering rationale

1. Polar dashboard config is the only manual external change. Get it out of the way first so when code lands, the production trial product matches.
2. Sentiment refactor is an atomic library change. Doing it first lets the rest of the work proceed without an intermediate broken state.
3. Anon hero gate is independent of trial work; small surface.
4. Trial CTA pieces (i18n keys + UpgradeButton signature + subnote) are atomic.
5. TrialBanner: tests first (TDD failing), then implementation (tests pass), then mount. Three tasks because the test file is non-trivial and worth its own commit checkpoint.
6. Verification gates and push gate at the end.

## File map

Files created or modified, with one-line responsibility:

| Path | Responsibility | Status |
|---|---|---|
| `src/lib/sentiment-summary.ts` | qualitativeSummary returns 7-key enum; deriveDistribution / proSentimentLabel unchanged | modify |
| `src/lib/__tests__/sentiment-summary.test.ts` | unit tests for 7 outcome keys + tie-break | create |
| `src/components/sentiment.tsx` | Free-tier label rendered via `useTranslations("sentiment_label")` | modify |
| `src/components/recent-analyses.tsx` | Free-tier label rendered via `getTranslations("sentiment_label")` | modify |
| `src/app/[locale]/history/history-client.tsx` | Free-tier label rendered via `useTranslations("sentiment_label")` | modify |
| `src/app/[locale]/page.tsx` | resolveHomeAuthState helper + conditional Hero | modify |
| `src/app/[locale]/dashboard/upgrade-button.tsx` | required `label` prop | modify |
| `src/app/[locale]/dashboard/page.tsx` | UpgradeButton localized label, mount TrialBanner | modify |
| `src/app/[locale]/pricing/page.tsx` | UpgradeButton localized label + subnote `<p>` | modify |
| `src/components/trial-banner.tsx` | server component, exports `loadTrialState` + `TrialBanner` | create |
| `src/components/__tests__/trial-banner.test.ts` | unit tests for `loadTrialState` (7 cases) | create |
| `messages/en.json` | 12 new keys | modify |
| `messages/ru.json` | 12 new keys | modify |

Total: 13 files (2 created in `src`, 2 created in `__tests__`, 9 modified).

## Hard rule reminders

- No em-dash (U+2014) or en-dash (U+2013) in any new content.
- No Polar-banned verbs (scrape / bulk / pull data / Priority) in new UI strings. `extract` is intentionally permitted because it is the canonical product verb.
- Commits stay on `main`. Atomic, focused commits per task.
- `pnpm test` is the test command. `pnpm lint`, `pnpm build`, `npx tsc --noEmit` exist too; vitest runs only `.test.ts` files (NOT `.test.tsx`).

## Spec deviations called out

The spec file says trial-banner tests live at `src/components/__tests__/trial-banner.test.tsx` (Files Changed table). The plan creates `src/components/__tests__/trial-banner.test.ts` (no `x`) because `vitest.config.ts` has `include: ["src/**/*.test.ts"]` and would silently skip `.tsx`. The function-under-test is `loadTrialState` (pure helper that returns a discriminated union), so JSX in tests is not needed. The React render path is verified by the local smoke step in Task 7.

---

## Task 1: Polar dashboard config (manual gate)

**Files:** none (operator-driven change in https://polar.sh/dashboard)

**Why first:** This is the only external prerequisite. If the user has not flipped the trial config to 3 days, all subsequent UI promising a "3-day free trial" would mislead the first sign-up.

- [ ] **Step 1: Gate via AskUserQuestion**

Ask the user to perform the Polar dashboard change:

```
Question: "Set Polar Pro product trial_period_days = 3 in the dashboard now. Confirm when saved."
Header: "Polar config"
Options:
  - "Saved, trial = 3 days" — User has saved trial_period_days = 3 in the Polar dashboard. Proceed with code work.
  - "Need help locating the field" — Provide the path: https://polar.sh/dashboard, select TubeMine org, Products, select Pro $19/mo, Edit, scroll to Trial, set 3, Save.
  - "Skip for now, ship code first" — Defer the Polar change. Code will still land safely; first NEW trial after the dashboard save uses 3 days. Existing trials (none today) honor their original length.
```

- [ ] **Step 2: Record outcome**

Once the user answers "Saved, trial = 3 days", proceed. If they choose "Need help locating", repeat the guidance until they confirm. If they choose "Skip", note in the post-ship report that Polar was not flipped yet.

- [ ] **Step 3: No commit**

This task has no code change. Move to Task 2.

---

## Task 2: Sentiment label refactor (atomic TDD)

**Files:**
- Modify: `src/lib/sentiment-summary.ts`
- Create: `src/lib/__tests__/sentiment-summary.test.ts`
- Modify: `src/components/sentiment.tsx`
- Modify: `src/components/recent-analyses.tsx`
- Modify: `src/app/[locale]/history/history-client.tsx`
- Modify: `messages/en.json`
- Modify: `messages/ru.json`

**Why atomic:** TypeScript will not compile a function that changes return type unless every consumer is updated in the same commit. Splitting this task would leave the repo in a broken state between commits.

- [ ] **Step 1: Write the failing test file**

Create `src/lib/__tests__/sentiment-summary.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  deriveDistribution,
  qualitativeSummary,
  proSentimentLabel,
  type SentimentDistribution,
} from "@/lib/sentiment-summary"

describe("deriveDistribution", () => {
  it("returns null when aggregate is null", () => {
    expect(deriveDistribution(null)).toBeNull()
  })

  it("returns null when totals sum to zero", () => {
    expect(deriveDistribution({ positive: 0, neutral: 0, negative: 0 })).toBeNull()
  })

  it("normalizes counts to 0-1", () => {
    const dist = deriveDistribution({ positive: 60, neutral: 30, negative: 10 })
    expect(dist).toEqual({ positive: 0.6, neutral: 0.3, negative: 0.1 })
  })
})

describe("qualitativeSummary returns SentimentLabelKey", () => {
  const cases: Array<[string, SentimentDistribution, string]> = [
    ["mostly_positive", { positive: 0.7, neutral: 0.2, negative: 0.1 }, "mostly_positive"],
    ["leans_positive", { positive: 0.5, neutral: 0.3, negative: 0.2 }, "leans_positive"],
    ["mixed", { positive: 0, neutral: 1, negative: 0 }, "mixed"],
    ["leans_negative", { positive: 0.2, neutral: 0.3, negative: 0.5 }, "leans_negative"],
    ["mostly_negative", { positive: 0.05, neutral: 0.25, negative: 0.7 }, "mostly_negative"],
    ["polarized", { positive: 0.4, neutral: 0.2, negative: 0.4 }, "polarized"],
    ["mostly_neutral", { positive: 0.25, neutral: 0.5, negative: 0.25 }, "mostly_neutral"],
  ]
  for (const [name, dist, expected] of cases) {
    it(`maps ${name} input to "${expected}" key`, () => {
      expect(qualitativeSummary(dist)).toBe(expected)
    })
  }

  it("tie-break: strict pos > neg returns leans_positive over mostly_neutral", () => {
    expect(qualitativeSummary({ positive: 0.2, neutral: 0.7, negative: 0.1 })).toBe("leans_positive")
  })
})

describe("proSentimentLabel", () => {
  it("returns argmax with percent", () => {
    expect(proSentimentLabel({ positive: 0.68, neutral: 0.2, negative: 0.12 })).toBe("68% positive")
  })

  it("tie-break order positive > neutral > negative", () => {
    expect(proSentimentLabel({ positive: 0.4, neutral: 0.4, negative: 0.2 })).toBe("40% positive")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/lib/__tests__/sentiment-summary.test.ts
```

Expected: cases assert string equality against the new key names (e.g. expect `"mostly_positive"`), but the current function returns the English label `"Mostly positive"`. Tests fail with mismatches like `expected "mostly_positive" but got "Mostly positive"`.

- [ ] **Step 3: Refactor `qualitativeSummary` to return the key**

Edit `src/lib/sentiment-summary.ts`. Replace the function and add the exported type:

```ts
export type SentimentLabelKey =
  | "mostly_positive"
  | "leans_positive"
  | "mixed"
  | "leans_negative"
  | "mostly_negative"
  | "polarized"
  | "mostly_neutral"

/**
 * Coarse qualitative label key for a distribution. Consumers translate via
 * next-intl `t("sentiment_label." + key)`. Shown on Free-tier surfaces where
 * the exact percent is paywalled.
 */
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

Leave `deriveDistribution` and `proSentimentLabel` unchanged.

- [ ] **Step 4: Run tests; sentiment tests pass, but typecheck fails**

```bash
pnpm vitest run src/lib/__tests__/sentiment-summary.test.ts
```

Expected: all 11 cases pass.

```bash
npx tsc --noEmit
```

Expected: failures in 3 consumer files because they still treat `qualitativeSummary(...)` as a translated string suitable for rendering. Examples: `recent-analyses.tsx:66`, `sentiment.tsx:90`, `history-client.tsx:96`.

- [ ] **Step 5: Add 7 sentiment_label keys to `messages/en.json`**

Insert a new top-level `sentiment_label` namespace BEFORE the `footer` key (alphabetical-ish, matching existing order). Final state of the namespace:

```json
  "sentiment_label": {
    "mostly_positive": "Mostly positive",
    "leans_positive": "Leans positive",
    "mixed": "Mixed",
    "leans_negative": "Leans negative",
    "mostly_negative": "Mostly negative",
    "polarized": "Polarized audience",
    "mostly_neutral": "Mostly neutral"
  },
```

- [ ] **Step 6: Add 7 sentiment_label keys to `messages/ru.json`**

Mirror the namespace structure:

```json
  "sentiment_label": {
    "mostly_positive": "В основном позитив",
    "leans_positive": "Скорее позитив",
    "mixed": "Смешанные",
    "leans_negative": "Скорее негатив",
    "mostly_negative": "В основном негатив",
    "polarized": "Поляризованная аудитория",
    "mostly_neutral": "В основном нейтрально"
  },
```

- [ ] **Step 7: Update `src/components/recent-analyses.tsx` (server component)**

Add a translator handle. Current:

```ts
import { getTranslations } from "next-intl/server"
// ...
const t = await getTranslations("dashboard")
```

Change to:

```ts
import { getTranslations } from "next-intl/server"
// ...
const t = await getTranslations("dashboard")
const tLabel = await getTranslations("sentiment_label")
```

In the JSX, line 66 currently reads:

```tsx
{tier === "free" ? qualitativeSummary(dist) : proSentimentLabel(dist)}
```

Change to:

```tsx
{tier === "free" ? tLabel(qualitativeSummary(dist)) : proSentimentLabel(dist)}
```

- [ ] **Step 8: Update `src/components/sentiment.tsx` (client component)**

Top of file, add the next-intl import:

```ts
import { useTranslations } from "next-intl"
```

Inside the `SentimentPanel` function body, before the existing `const summary = qualitativeSummary(dist)`:

```ts
const tLabel = useTranslations("sentiment_label")
```

Then replace the existing line:

```ts
const summary = qualitativeSummary(dist)
```

with:

```ts
const summary = tLabel(qualitativeSummary(dist))
```

- [ ] **Step 9: Update `src/app/[locale]/history/history-client.tsx` (client component)**

Add the third translator. Current head:

```ts
const t = useTranslations("history")
const tCommon = useTranslations("common")
```

Add immediately after:

```ts
const tLabel = useTranslations("sentiment_label")
```

In the JSX (line 96), change:

```tsx
{tier === "free" ? qualitativeSummary(dist) : proSentimentLabel(dist)}
```

to:

```tsx
{tier === "free" ? tLabel(qualitativeSummary(dist)) : proSentimentLabel(dist)}
```

- [ ] **Step 10: Verify typecheck + tests pass**

```bash
npx tsc --noEmit
```

Expected: clean.

```bash
pnpm test
```

Expected: all tests pass, including the new 11 sentiment-summary cases.

```bash
node scripts/check-message-parity.mjs
```

Expected: `messages/en.json and messages/ru.json have key parity.`

- [ ] **Step 11: Commit**

```bash
git add src/lib/sentiment-summary.ts \
        src/lib/__tests__/sentiment-summary.test.ts \
        src/components/sentiment.tsx \
        src/components/recent-analyses.tsx \
        src/app/[locale]/history/history-client.tsx \
        messages/en.json \
        messages/ru.json
git commit -m "$(cat <<'EOF'
feat(i18n): qualitativeSummary returns SentimentLabelKey, RU translations

7-key enum return type lets consumers translate via next-intl. EN
keeps the existing wording; RU adds idiomatic equivalents for all
7 outcomes including polarized + mostly_neutral. Three consumers
(sentiment.tsx, recent-analyses.tsx, history-client.tsx) updated
atomically. 11 vitest cases verify the 7 outcomes + tie-break.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Anon-only marketing hero on `/`

**Files:**
- Modify: `src/app/[locale]/page.tsx`

**Why:** Signed-in users get extractor-first UX, anon visitors still see the marketing hero. Server-side conditional render avoids hydration flash.

- [ ] **Step 1: Refactor `resolveTier` to `resolveHomeAuthState`**

Open `src/app/[locale]/page.tsx`. Replace lines 11-29 (the existing `resolveTier` function) with:

```ts
type HomeAuthState = { tier: ExtractTier; isAnonymous: boolean }

async function resolveHomeAuthState(): Promise<HomeAuthState> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { tier: "anonymous", isAnonymous: true }
  }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { tier: "anonymous", isAnonymous: true }
    const quota = await getUserQuota(user.id)
    return { tier: quota.tier, isAnonymous: false }
  } catch {
    return { tier: "anonymous", isAnonymous: true }
  }
}
```

- [ ] **Step 2: Update `HomePage` to consume the new helper and gate the Hero**

In the same file, replace the body of `HomePage` (lines 31-48). Current:

```tsx
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const tier = await resolveTier()
  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      <main className="relative z-10 -mt-20 flex flex-1 flex-col items-center sm:-mt-28">
        <TubeMine tier={tier} />
      </main>
      <Footer />
    </div>
  )
}
```

Replace with:

```tsx
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const { tier, isAnonymous } = await resolveHomeAuthState()
  return (
    <div className="flex flex-1 flex-col">
      {isAnonymous && <Hero />}
      <main
        className={
          isAnonymous
            ? "relative z-10 -mt-20 flex flex-1 flex-col items-center sm:-mt-28"
            : "relative z-10 flex flex-1 flex-col items-center pt-24 sm:pt-28"
        }
      >
        <TubeMine tier={tier} />
      </main>
      <Footer />
    </div>
  )
}
```

- [ ] **Step 3: Verify typecheck + build are clean**

```bash
npx tsc --noEmit
```

Expected: clean.

```bash
pnpm build
```

Expected: build succeeds.

- [ ] **Step 4: Local smoke (manual)**

Run `pnpm dev` and in two browsers (or normal + incognito):
1. Anonymous on `http://localhost:3000/` shows the marketing hero (badge, H1, subtitle) above the extractor.
2. Signed-in user on `http://localhost:3000/` shows ONLY the extractor (no hero, no badge).

If both check out, kill `pnpm dev`.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/page.tsx
git commit -m "$(cat <<'EOF'
feat(home): anon-only marketing hero on /

Signed-in users (Free, Pro, trialing) see only the extractor.
Anonymous visitors keep the full marketing hero. Server-side
conditional render avoids hydration flash; Googlebot still
sees the hero because bots are anonymous.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 3-day trial CTA + UpgradeButton required label + pricing subnote

**Files:**
- Modify: `src/app/[locale]/dashboard/upgrade-button.tsx`
- Modify: `src/app/[locale]/dashboard/page.tsx`
- Modify: `src/app/[locale]/pricing/page.tsx`
- Modify: `messages/en.json`
- Modify: `messages/ru.json`

**Why atomic:** Making `label` required + updating both call sites + adding the new i18n keys must land in one commit, otherwise TypeScript or runtime breaks between commits.

- [ ] **Step 1: Add pricing trial keys to `messages/en.json`**

Find the existing `"pricing"` namespace (lines 40-45). Add two keys:

```json
  "pricing": {
    "title": "Pricing",
    "free_plan": "Free",
    "pro_plan": "Pro",
    "manage_subscription": "Manage subscription",
    "start_trial_cta": "Start 3-day free trial",
    "trial_subnote": "$19/mo after. Cancel anytime."
  },
```

- [ ] **Step 2: Add pricing trial keys to `messages/ru.json`**

Mirror:

```json
  "pricing": {
    "title": "Цены",
    "free_plan": "Бесплатно",
    "pro_plan": "Pro",
    "manage_subscription": "Управление подпиской",
    "start_trial_cta": "Начать 3-дневный пробный период",
    "trial_subnote": "После $19/мес. Отмена в любой момент."
  },
```

- [ ] **Step 3: Make `UpgradeButton.label` required**

Open `src/app/[locale]/dashboard/upgrade-button.tsx`. Replace the function signature and the button body:

```tsx
export function UpgradeButton({
  fullWidth = false,
  label,
}: {
  fullWidth?: boolean
  label: string
}) {
  const [loading, setLoading] = useState(false)

  async function onUpgrade() {
    setLoading(true)
    try {
      const res = await fetch("/api/checkout", { method: "POST" })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Could not start checkout.")
        return
      }
      window.location.href = data.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

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

- [ ] **Step 4: Update dashboard call site**

Open `src/app/[locale]/dashboard/page.tsx`. The new key `start_trial_cta` lives under the `pricing.*` namespace, but the existing dashboard `t` handle is bound to `dashboard.*`. Add a second translator handle for the pricing namespace.

a) After the existing line `const t = await getTranslations("dashboard")` (line 53), insert:

```ts
const tPricing = await getTranslations("pricing")
```

b) Change `<UpgradeButton />` (line 129) to:

```tsx
<UpgradeButton label={tPricing("start_trial_cta")} />
```

`getTranslations` is already imported on line 2 of this file, so no import line change is needed.

- [ ] **Step 5: Update pricing page call site + add subnote**

Open `src/app/[locale]/pricing/page.tsx`. Currently the Pro card CTA for signed-in Free users is `<UpgradeButton fullWidth />` (line 139).

First, add a translator. Near the top of `PricingPage` (after `setRequestLocale(locale)`), add:

```ts
const t = await getTranslations("pricing")
```

Then change line 139 from `<UpgradeButton fullWidth />` to:

```tsx
<>
  <UpgradeButton fullWidth label={t("start_trial_cta")} />
  <p className="mt-2 text-center text-xs text-muted-foreground">
    {t("trial_subnote")}
  </p>
</>
```

The fragment wraps two siblings (button + subnote) so they replace the single `<UpgradeButton />` in the JSX-conditional branch cleanly. The subnote renders only for signed-in Free state (the other branches render different CTAs and do not get the subnote).

Add the `getTranslations` import at the top of the file:

```ts
import { getTranslations, setRequestLocale } from "next-intl/server"
```

(currently only `setRequestLocale` is imported on line 2).

- [ ] **Step 6: Verify typecheck + lint + parity**

```bash
npx tsc --noEmit
```

Expected: clean. If any other `<UpgradeButton />` call sites exist, they will fail compilation here. Confirm with:

```bash
grep -rn 'UpgradeButton' src --include='*.tsx'
```

Expected: only the 3 files just touched + the component definition itself appear. If any other consumer exists, add a `label` prop to it before continuing.

```bash
pnpm lint
```

Expected: clean.

```bash
node scripts/check-message-parity.mjs
```

Expected: clean.

- [ ] **Step 7: Local smoke (manual)**

Run `pnpm dev`. Sign in as a Free user, visit `/pricing` and `/dashboard`. Expected:
1. Pricing page Pro card CTA reads "Start 3-day free trial".
2. Below the button, the subnote reads "$19/mo after. Cancel anytime.".
3. Dashboard "Need more?" panel CTA reads "Start 3-day free trial".

If RU locale is reachable (`/ru/pricing`), confirm Russian copy renders.

- [ ] **Step 8: Commit**

```bash
git add src/app/[locale]/dashboard/upgrade-button.tsx \
        src/app/[locale]/dashboard/page.tsx \
        src/app/[locale]/pricing/page.tsx \
        messages/en.json \
        messages/ru.json
git commit -m "$(cat <<'EOF'
feat(pricing): 3-day free trial CTA + required label on UpgradeButton

UpgradeButton.label is now required (drops dead default). Pricing
page Pro CTA for signed-in Free users reads "Start 3-day free
trial" with a "$19/mo after. Cancel anytime." subnote underneath.
Dashboard Free upgrade panel uses the same localized CTA. EN+RU
keys added to messages/{en,ru}.json.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: TrialBanner — failing tests (TDD)

**Files:**
- Create: `src/components/__tests__/trial-banner.test.ts`

**Why test-first:** The `loadTrialState` function has 7 distinct branches (no row, non-trialing, missing date, expired date, today branch, days branch, canceled). Tests pin the contract before the implementation.

- [ ] **Step 1: Create the test file**

Create `src/components/__tests__/trial-banner.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest"

// Mock the Supabase server client before the SUT imports it.
const maybeSingleMock = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: maybeSingleMock,
        }),
      }),
    }),
  })),
}))

import { loadTrialState } from "@/components/trial-banner"

beforeEach(() => {
  maybeSingleMock.mockReset()
})

describe("loadTrialState", () => {
  it("returns null when no subscriptions row exists", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null })
    expect(await loadTrialState("user-1")).toBeNull()
  })

  it("returns null when status is 'active'", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        status: "active",
        current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      },
    })
    expect(await loadTrialState("user-1")).toBeNull()
  })

  it("returns null when status is 'canceled' (mid-trial cancel)", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        status: "canceled",
        current_period_end: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      },
    })
    expect(await loadTrialState("user-1")).toBeNull()
  })

  it("returns null when status is 'trialing' but current_period_end is null", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { status: "trialing", current_period_end: null },
    })
    expect(await loadTrialState("user-1")).toBeNull()
  })

  it("returns null when status is 'trialing' but current_period_end is in the past", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        status: "trialing",
        current_period_end: new Date(Date.now() - 1000).toISOString(),
      },
    })
    expect(await loadTrialState("user-1")).toBeNull()
  })

  it("returns days branch with daysLeft = 3 when 72h remain", async () => {
    const endsAt = new Date(Date.now() + 3 * 86_400_000 + 1000).toISOString()
    maybeSingleMock.mockResolvedValueOnce({
      data: { status: "trialing", current_period_end: endsAt },
    })
    const state = await loadTrialState("user-1")
    expect(state).toEqual({ kind: "active", daysLeft: 3 })
  })

  it("returns today branch when less than 24h remain", async () => {
    const endsAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    maybeSingleMock.mockResolvedValueOnce({
      data: { status: "trialing", current_period_end: endsAt },
    })
    const state = await loadTrialState("user-1")
    expect(state).toEqual({ kind: "today" })
  })
})
```

- [ ] **Step 2: Run the tests; verify they fail**

```bash
pnpm vitest run src/components/__tests__/trial-banner.test.ts
```

Expected: ALL 7 tests fail at import time with `Cannot find module '@/components/trial-banner'` or similar. The SUT does not exist yet.

---

## Task 6: TrialBanner — implementation (make tests pass)

**Files:**
- Create: `src/components/trial-banner.tsx`

- [ ] **Step 1: Create the component file**

Create `src/components/trial-banner.tsx`:

```tsx
import "server-only"
import NextLink from "next/link"
import { Sparkles, ArrowUpRight } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export type TrialState =
  | { kind: "active"; daysLeft: number }
  | { kind: "today" }
  | null

export async function loadTrialState(userId: string): Promise<TrialState> {
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
        <NextLink
          href="/api/portal"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {t("trial_manage_cta")} <ArrowUpRight className="size-3.5" />
        </NextLink>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Run the tests; verify they pass**

```bash
pnpm vitest run src/components/__tests__/trial-banner.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 3: Verify typecheck (the component imports compile)**

```bash
npx tsc --noEmit
```

Expected: clean. The component does not yet have a consumer; the i18n keys referenced (`trial_banner_today`, `trial_banner_text`, `trial_manage_cta`) do not exist in `messages/*.json` yet, but next-intl falls back to the key string at runtime so this does not fail compilation.

- [ ] **Step 4: Commit tests + implementation together**

Since the test file was created in Task 5 without a commit (the tests would have been failing imports), commit both files now:

```bash
git add src/components/trial-banner.tsx \
        src/components/__tests__/trial-banner.test.ts
git commit -m "$(cat <<'EOF'
feat(dashboard): TrialBanner server component with today/days branches

Reads subscriptions(status, current_period_end) via user-scoped
createClient (RLS-protected). Returns null when not trialing,
missing date, or expired. Returns today branch when <= 24h remain
(inclusive boundary to avoid "1 day left" at 2h remaining).
Returns days branch with Math.ceil days otherwise. 7 vitest
cases cover the contract.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Mount TrialBanner in dashboard + add dashboard.trial_* i18n keys

**Files:**
- Modify: `src/app/[locale]/dashboard/page.tsx`
- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Add dashboard.trial_* keys to `messages/en.json`**

Find the existing `"dashboard"` namespace. Append three keys (after `last_100_saved`):

```json
  "dashboard": {
    "title": "Dashboard",
    "recent_analyses_heading": "Recent analyses",
    "view_all": "View all",
    "empty": "No saved analyses yet. Analyze a video to see it here.",
    "last_100_saved": "Last 100 analyses saved",
    "trial_banner_text": "Trial: {days, plural, one {# day} other {# days}} left, then $19/mo.",
    "trial_banner_today": "Trial ends today, then $19/mo.",
    "trial_manage_cta": "Manage subscription"
  },
```

- [ ] **Step 2: Add dashboard.trial_* keys to `messages/ru.json`**

Mirror:

```json
  "dashboard": {
    "title": "Панель управления",
    "recent_analyses_heading": "Последние анализы",
    "view_all": "Смотреть все",
    "empty": "Ещё нет сохранённых анализов. Проанализируйте видео, чтобы оно появилось здесь.",
    "last_100_saved": "Сохраняются последние 100 анализов",
    "trial_banner_text": "Триал: осталось {days, plural, one {# день} few {# дня} many {# дней} other {# дней}}, потом $19/мес.",
    "trial_banner_today": "Триал заканчивается сегодня, потом $19/мес.",
    "trial_manage_cta": "Управлять подпиской"
  },
```

- [ ] **Step 3: Mount `<TrialBanner>` in dashboard page**

Open `src/app/[locale]/dashboard/page.tsx`.

a) Add the import near the top of the imports block (alongside `RecentAnalyses`):

```ts
import { TrialBanner } from "@/components/trial-banner"
```

b) Locate the closing `</header>` tag (currently line 60). Immediately after it, insert a new JSX element on its own line:

```tsx
      <TrialBanner userId={user.id} />
```

(Use 6-space indentation to match the surrounding JSX.) Do not modify the welcome-card block (`{showWelcome && quota.tier === "pro" && (...)}`) that follows. The full sequence after edit reads:

```tsx
<header className="flex flex-col gap-2">
  <p className="text-sm text-muted-foreground">{user.email}</p>
  <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
</header>

<TrialBanner userId={user.id} />

{showWelcome && quota.tier === "pro" && (
  <Card className="border-primary/30 bg-primary/5">
    {/* ... existing welcome card JSX ... */}
  </Card>
)}
```

The `<TrialBanner>` renders nothing (null return) when the user is not trialing, so the layout collapses cleanly. When trialing, it renders the amber-tinted Card above the welcome card and Plan card.

- [ ] **Step 4: Verify tests, parity, typecheck**

```bash
pnpm test
```

Expected: all tests pass.

```bash
node scripts/check-message-parity.mjs
```

Expected: clean (12 new keys total across the session balanced EN/RU).

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Local smoke (manual)**

Run `pnpm dev`. Two paths:

A) Without a trialing user: visit `/dashboard` as a Free user, confirm no banner appears.

B) With a trialing user: temporarily insert (via Supabase Studio SQL editor on the DEV project) a row in `public.subscriptions` for your test user:

```sql
insert into public.subscriptions (user_id, polar_subscription_id, polar_customer_id, status, current_period_end)
values ('<DEV_USER_UUID>', 'test_sub_dev', 'test_cust_dev', 'trialing', now() + interval '2 days')
on conflict (user_id) do update
  set status = 'trialing',
      current_period_end = excluded.current_period_end;
```

Visit `/dashboard`, confirm the amber banner shows "Trial: 2 days left, then $19/mo." and the "Manage subscription" button links to `/api/portal`. Switch to `/ru/dashboard`, confirm Russian renders ("Триал: осталось 2 дня, потом $19/мес.").

Cleanup the test row after smoke:

```sql
delete from public.subscriptions where polar_subscription_id = 'test_sub_dev';
```

- [ ] **Step 6: Commit**

```bash
git add src/app/[locale]/dashboard/page.tsx \
        messages/en.json \
        messages/ru.json
git commit -m "$(cat <<'EOF'
feat(dashboard): mount TrialBanner above welcome card

Banner renders only for trialing users; no-op when no subscription
or non-trialing. EN+RU i18n keys for the two render branches
(today, days) plus the manage CTA.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Run verification gates

**Files:** none

**Why:** Final sanity sweep before asking the user to gate the push.

- [ ] **Step 1: TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Lint**

```bash
pnpm lint
```

Expected: zero errors. Treat unused-import warnings as errors and fix inline.

- [ ] **Step 3: Tests**

```bash
pnpm test
```

Expected: previous test count + 18 new (11 sentiment-summary + 7 trial-banner) all green. No regressions.

- [ ] **Step 4: Message parity**

```bash
node scripts/check-message-parity.mjs
```

Expected: `messages/en.json and messages/ru.json have key parity.`

- [ ] **Step 5: Build**

```bash
pnpm build
```

Expected: build succeeds, no client-bundle bloat warnings, no missing-translation errors.

- [ ] **Step 6: Em-dash sweep**

```bash
# Search for em-dash (U+2014) and en-dash (U+2013) by UTF-8 byte pattern.
grep -rlE $'\xe2\x80\x94|\xe2\x80\x93' src messages 2>/dev/null || echo "(clean)"
```

Expected: `(clean)`. If anything matches, fix before push.

- [ ] **Step 7: Polar-banned verbs sweep on new strings**

```bash
grep -niE 'scrape|bulk|pull data|priority' messages/en.json messages/ru.json
```

Expected: no matches on NEW strings. Pre-existing matches (e.g. legacy refund copy) are out of scope. Note: `extract` is NOT in this grep because TubeMine's product copy uses "extract" as the canonical verb (extractor is the main feature surface), so it is acceptable here despite appearing in the spec's general banned-verb list.

- [ ] **Step 8: Commit gate complete**

No code change in Task 8. If any check above failed, fix it and re-run before continuing.

---

## Task 9: Push gate (AskUserQuestion + git push)

**Files:** none

- [ ] **Step 1: Collect the diff summary**

```bash
git fetch origin main
git log --oneline origin/main..HEAD
git diff --stat origin/main..HEAD
```

Capture: list of commits this session, total files changed, total lines added/removed. If the local branch is not ahead of `origin/main`, the first two commands print nothing; that means nothing new to push, so report and stop.

- [ ] **Step 2: AskUserQuestion gate**

Present:

```
Question: "Phase J commits ready for push to origin/main. Summary: <N commits, <SHAs>, <files changed>, <lines added/removed>. Polar trial = 3 days confirmed in dashboard (Task 1). Verification gates all green (Task 8). Push now?"
Header: "Push gate"
Options:
  - "Push to main" — git push origin main, watch Vercel deploy READY.
  - "Hold, review diff first" — User wants to inspect the diff before push. Run git diff origin/main..HEAD to display, wait for second confirmation.
  - "Roll back, do not push" — Hard stop. User has identified an issue. Do not push. Report what needs to change.
```

- [ ] **Step 3: Push (only on "Push to main")**

```bash
git push origin main
```

Expected: push succeeds. Vercel auto-deploys.

- [ ] **Step 4: Watch the Vercel deploy**

Use `mcp__vercel__list_deployments` (or the dashboard) to find the new deployment ID. Wait for state `READY`.

- [ ] **Step 5: Post-push smoke (zero-money)**

Curl prod anonymous home, confirm hero is rendered:

```bash
curl -s https://tubemine.tech/ | grep -c 'hero_subtitle\|Understand any'
```

Expected: >= 1.

Curl prod signed-in flow is skipped (Vercel CDN strips X-Forwarded-For, see runbook 6.12). Defer signed-in visual smoke to a separate session with real cookies.

- [ ] **Step 6: Done**

No commit at this step. Continue with the reporting pass below.

---

## Reporting (after push)

Append to vault and update status tracker.

- [ ] **Step 1: Write launch note to vault**

Using `mcp__obsidian__write_note`:

Path: `projects/yt-comments/launch/2026-05-19/phase-j-anon-hero-and-trial.md`

Frontmatter:

```yaml
---
title: Phase J shipped, anon-only hero + 3-day trial + trial banner + RU sentiment labels
description: Phase J backend shipped 2026-05-19. 4 deliverables. <N> commits, <SHAs>. Vercel deploy <id>.
tags: [yt-comments, tubemine, phase-j, launch, paywall]
aliases: [phase J backend, trial banner ship, anon hero gate]
created: 2026-05-19
updated: 2026-05-19
status: active
---
```

Body sections: What shipped (table by surface and tier), Backend changes, Frontend changes, Messaging (12 new keys), Tests (18 new), Decisions locked, Open follow-ups, Sources.

- [ ] **Step 2: Append items 18, 19, 20 to `projects/yt-comments/status-tracker.md`**

Items:

- 18. Phase J: anon-only hero on `/` for signed-in users. Commit `<sha>`.
- 19. Phase J: Polar trial 7 to 3 days + new CTA copy + TrialBanner in Dashboard. Commit `<sha>`.
- 20. Phase J: RU qualitative sentiment labels (7 outcomes) via sentiment_label.* namespace. Commit `<sha>`.

Use `mcp__obsidian__write_note` with `mode: append`.

- [ ] **Step 3: Done**

Phase J complete. Report back to the parent coordinator with: commit SHAs, Vercel deploy ID, 5-bullet summary, open follow-ups, 90-day risk surface (small per spec).

---

## Self-review checklist (executed by plan author)

1. **Spec coverage:**
   - Spec Task 1 (anon-only hero) → Plan Task 3. Covered.
   - Spec Task 2 (Polar trial + UI copy) → Plan Tasks 1 (manual gate) + 4 (CTA + UpgradeButton + subnote + dashboard caller). Covered.
   - Spec Task 3 (TrialBanner) → Plan Tasks 5 (tests), 6 (component), 7 (mount + i18n keys). Covered.
   - Spec Task 4 (RU sentiment labels) → Plan Task 2. Covered.
   - Spec verification gates → Plan Task 8. Covered.
   - Spec push gate → Plan Task 9. Covered.
   - Spec reporting → Plan Reporting section. Covered.

2. **Placeholder scan:**
   - No "TBD", "TODO", "implement later".
   - All code blocks contain literal code, not skeleton.
   - All commands are exact.

3. **Type consistency:**
   - `SentimentLabelKey` defined once in Task 2 Step 3, referenced in Task 2 Step 1 (test imports type from same module). Consistent.
   - `TrialState` discriminated-union defined in Task 6 Step 1, asserted in Task 5 Step 1 tests with `kind: "active" | "today"` literals. Consistent.
   - `loadTrialState` signature `(userId: string) => Promise<TrialState>` consistent across tests and implementation.
   - `<UpgradeButton>` `label: string` required prop consistent across both call sites (dashboard + pricing).
   - `<TrialBanner>` `userId: string` prop consistent between component and consumer.

4. **File path checks:**
   - All `Modify` paths exist in the repo (verified during context exploration).
   - All `Create` paths use directories that exist (`src/lib/__tests__/`, `src/components/__tests__/`, `src/components/`).

Plan ready for execution.
