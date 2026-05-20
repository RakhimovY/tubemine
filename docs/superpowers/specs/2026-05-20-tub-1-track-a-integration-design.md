# TUB-1 Track A integration sprint design spec

> Spec input for `Skill(superpowers:writing-plans)` (Phase 3 of turbo-pipeline). Crafted in brainstorming phase. Sister artifact (5-persona flow tree, 60+ nodes) lives in the vault at `projects/yt-comments/launch/2026-05-20/tub-1-track-a-integration.md`.

- **Linear:** TUB-1 (P2 High, 8pt, current state Todo) https://linear.app/qostap/issue/TUB-1
- **Baseline tag:** `pre-tub-1-baseline-2026-05-20` on `main`, pushed to origin (rollback anchor)
- **Branch:** `main` (no feature branch per project convention)
- **Budget:** 14-20h focused work, 25h overrun threshold
- **Production URL:** https://tubemine.tech
- **Repo:** https://github.com/RakhimovY/tubemine (MIT)
- **Audit:** vault `audits/2026-05-20-design-vs-code-audit.md` (M1-M24 catalog)
- **Reference materials:** `/tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/` (DESIGN handoff + 13 HTML refs)

## TL;DR

Resolve 24 mismatches (M1-M24) between current `~/projects/yt-comments` UI and Claude Design `tubemine-v3-ux`. Phased shipping in 7 atomic commits: Phase 0 (CSS token migration), Phase 1 (critical cleanup, 6 quick wins), Phase 2 (Pricing rebuild from scratch), Phase 3 (Profile rebuild from stub), Phase 4 (Landing polish, Variant D + Sample label), Phase 5 (AppShell + SideNav for signed-in pages), Phase 6 (OAuth Intro + Privacy/Terms + i18n debt + Save CSV rename + skeletons). Autonomous push per phase after 7 self-verification checks pass + Vercel deploy smoke + auto-rollback on 5xx.

## Scope

**In scope:**

- All 24 M-ids from `audits/2026-05-20-design-vs-code-audit.md`
- Visual + functional + accessibility parity with handoff HTML refs at desktop 1280 and mobile 375
- EN + RU locale parity (next-intl), `node scripts/check-message-parity.mjs` clean
- 5-persona acceptance: Anonymous, Free signed-in, Trial Pro, Paid Pro, Canceled Pro (each tested on the changed pages)
- 7-check self-verification before every push (tsc, lint, vitest, parity, em-dash, banned-verbs, screenshots) + post-push Vercel deploy smoke
- Autonomous push per phase, auto-rollback on 5xx
- New components per Component Inventory in handoff README (see Phase ownership table below)
- Privacy + Terms extension with Google data handling section (TUB-10 prerequisite)
- `/oauth-intro` static route with Phase E "Coming soon" disabled state
- AppShell + SideNav for signed-in pages

**Out of scope:**

- New Supabase migrations (none required)
- Backend changes to `/api/extract`, `/api/export`, `/api/checkout`, `/api/portal`, `/api/polar/webhook`
- OAuth verification submission (TUB-10, parallel)
- Trial countdown email reminder (TUB-3, separate)
- Trial analytics events (TUB-4, backlog)
- Mobile re-verification at edge widths (TUB-5, backlog)
- Branding/logo work (TUB-11, blocked by TUB-1)
- Switching design system off shadcn base-nova or Tailwind off v4
- Switching auth off Supabase, payments off Polar, deploy off Vercel
- Inflating "Trusted by 1 paying customer" trust line

## Stack constraints (verbatim per DESIGN handoff README, NOT negotiable)

- Next.js 16 App Router. Pages Router NOT supported.
- Tailwind v4 with `@theme` tokens. Tailwind v3 syntax NOT supported.
- shadcn `base-nova` preset on Base UI primitives.
- Supabase Auth via `signInWithOAuth({ provider: "google" })` client helper (already wired, do NOT change to `/api/auth/google` despite README open question #4).
- Polar SDK for `/api/checkout` + `/api/portal` (already wired, do NOT change webhook).
- Vercel Analytics only (NO Sentry, NO GA, NO PostHog).
- TypeScript strict, server components by default, client islands only where needed.
- next-intl for EN/RU localization (already wired at routing level).

## LOCKED decisions (no re-litigation, user pre-locked)

1. **Landing architecture: Variant A.** Real extractor inline for anon on landing; NO separate marketing Live Demo block. Add small Sample label above the extractor explaining anon limits. SKIP Phase K after-click state machine (code already does right thing — anon clicks Analyze, gets real anon-tier response).
2. **CSV button verb: "Save CSV"** everywhere. Per Claude Design brand voice rule (`components.md` line 322). Lucide `<Download>` icon import name is OK; only rendered text counts.
3. **Anonymous CSV unlock: INCLUDED.** ExportBar branch flip (anon renders Save CSV instead of sign-in gate) + comparison table cell change (anon → CSV). Shipped in Phase 1.
4. **Phased shipping, NOT big-bang.** Pricing → Profile → Landing → AppShell → OAuth Intro + Privacy/Terms + polish. One atomic commit per landed page minimum. AUTONOMOUS PUSH PER PHASE after 7 checks pass + Vercel deploy smoke.
5. **No Live Demo block** as separate marketing showcase. Code already does right thing — inline real extractor with Sample label.
6. **Domain: tubemine.tech** everywhere in metadata.
7. **Stay on `main` branch.** No feature branches.
8. **No new dependencies** without user gate. Autonomous-OK only if package is top-5000 weekly downloads on npm AND license MIT/Apache-2/BSD AND <100KB to client bundle.
9. **No new Supabase migrations.** Schema in `00_init/01_analyses/02_profile_metadata` is sufficient.
10. **Effort budget: 14-20h.** Overrun threshold 25h, AskUserQuestion if crossed.

## Persona × state × locale matrix

For acceptance: each non-empty cell of this matrix must work as described on the changed pages. Detailed flow tree in vault launch note section "User flow tree".

| Persona | `isSignedIn` | `tier` (`effectiveTier`) | `subscription.status` | `subscriptionCanceled` flag | Acceptance pages |
|---|---|---|---|---|---|
| P1 Anonymous | false | "anonymous" (synthetic) | n/a | n/a | `/`, `/pricing`, `/login`, `/privacy`, `/terms` |
| P2 Free signed-in | true | "free" | n/a (no row) | false | `/`, `/dashboard`, `/profile`, `/history`, `/pricing` |
| P3 Trial Pro | true | "pro" | "trialing" | false | `/dashboard` (TrialBanner), `/profile` (Pro Plan + Billing) |
| P4 Paid Pro | true | "pro" | "active" | false | `/dashboard` (no banner), `/profile`, `/history` (Last 100), `/api/portal` |
| P5 Canceled Pro | true | "free" (downgraded) | "revoked" | true | `/profile?canceled=true` (toast + "ends" date) |

Each persona × {EN, RU} × {375, 1280} = 20 acceptance cells. Phase log records which cells were smoke-tested per commit.

## CSS tokens migration (Phase 0, BLOCKING for all other phases)

Translate `tokens.md` into `src/app/globals.css` via Tailwind v4 `@theme` block. Required categories (full values in handoff `tokens.md`):

- **Type:** `--font-family-primary`, `--font-family-mono`, font-size scale (xs through 4xl), weights, line-height
- **Surfaces:** `--color-surface-base` `#000`, `--color-surface-raised` `#0f0f11`, `--color-surface-sunken` `#0a0a0c`, `--color-surface-muted` `#fff`
- **Text:** `--color-text-primary` `#f5f5f7`, `--color-text-secondary` `#b9b9c0`, `--color-text-tertiary` `#7a7a82`, `--color-text-inverse` `#0a0a0c`, `--color-text-disabled` `#4a4a52`
- **Borders:** `--border-subtle`, `--border-strong`, `--border-focus`
- **Feedback:** `--color-success` `rgba(52, 211, 153, ...)` + `-soft`, `--color-danger` `rgba(251, 113, 133, ...)` + `-soft`, `--color-warning` `rgba(251, 191, 36, ...)` + `-soft`
- **Sentiment:** `--accent-positive`, `--accent-negative`, `--sentiment-neutral`
- **Spacing:** `--space-1` through `--space-8` = 4/6/8/10/12/16/20/24 px
- **Radius:** `--radius-xs` `6`, `--radius-sm` `8`, `--radius-md` `14`, `--radius-lg` `9999`
- **Shadow:** `--shadow-1`, `--shadow-2`
- **Motion:** `--duration-instant` `140ms`, `--duration-fast` `150ms`, `--duration-normal` `200ms`, `--ease-default` `cubic-bezier(0.2, 0, 0, 1)`
- **Layout:** `--sidebar-w` `240px`, `--header-h` `60px`
- **Touch targets:** mobile 44px min, desktop 36px min

Map token names to Tailwind utility classes via `@theme` block so existing `bg-card`, `text-muted-foreground`, etc. continue working AND new `bg-surface-raised`, `text-text-secondary`, etc. become available.

**Verification gate before continuing to Phase 1:** dev server smoke test on `/`, `/dashboard`, `/pricing`. Existing pages must render with NO visual regression. If regression spotted, pause, AskUserQuestion with screenshot diff.

## 6-phase implementation plan (atomic commit per phase)

### Phase 0: CSS tokens migration (~30-45 min, single commit, BLOCKING)

- Translate `tokens.md` → `src/app/globals.css` via Tailwind v4 `@theme` block
- Verify existing components still render (dev server smoke `/`, `/dashboard`, `/pricing`)
- **Commit message:** `feat(tokens): port v3 design system tokens to Tailwind v4 @theme`
- **M-ids resolved:** none directly, but enables M1-M24
- **Tests added:** 0
- **Components added:** 0

### Phase 1: Critical cleanup (~30 min, single commit)

User-visible improvements shippable independent of full rebuild. 6 fixes batched:

- **M5:** ExportBar anon branch flip → Save CSV button enabled (remove sign-in gate link, `tier === "anonymous"` renders same as Free)
- **M3:** Pricing Pro card → remove "Priority bug fixes" bullet (line 118; leave other 4 for Phase 2 rewrite)
- **M7:** Domain constant `tubemine.vercel.app` → `tubemine.tech` in `layout.tsx` (lines 28, 101) + grep sitemap/robots/README/`.env.example` for other occurrences
- **M12:** Dashboard `h2` "Extract comments" → "Analyze comments" (`dashboard/page.tsx` line 158)
- **M17:** EmojiPanel exact `%` gate by tier — only render `%` span when `tier === "pro"` (anon + free see counts only, `emoji-frequency.tsx` lines 60-62)
- **M15:** Login redirect param unification → adopt `?next=` (login-form already reads it). Update callers: `pricing/page.tsx`, `sentiment.tsx`, `export-bar.tsx`, `top-words.tsx`, `emoji-frequency.tsx` from `?redirect=` → `?next=`

- **Verify:** tsc + lint + tests pass; anon can save CSV in browser; EmojiPanel hides `%` on free; login redirect lands user on intended page after sign-in
- **Commit message:** `fix: pre-rebuild cleanup, anon CSV + emoji % gate + domain + Priority + Extract verb + login redirect`
- **M-ids resolved:** M3, M5, M7, M12, M15, M17 (6 items)
- **Tests added:** 1 test for ExportBar anon CSV branch (snapshot or behavior assertion)
- **Components added:** 0

### Phase 2: Pricing page full rebuild (~3-4h, atomic commit)

Reference: `TubeMine Pricing.html` + `components.md` for `pricing-card.tsx` + `trust-line.tsx`.

Implementation:

- **M1: ComparisonTable component (new).** Mount in `src/components/comparison-table.tsx`. 5 rows × 3 columns (Anonymous / Free / Pro) plus Saved analyses history row. Cell values per Phase G/H/J/K spec:
  - Sentiment direction: "Total count only" / "Qualitative bar" / "Exact % and trend"
  - Sentiment exact %: "No" / "No" / "Yes"
  - Top words shown: "Top 5 + counts" / "Top 15 + counts" / "All ranked + counts"
  - Top emoji shown: "Top 5 + counts" / "Top 15 + counts" / "All ranked + heatmap"
  - Export formats: "CSV" / "CSV" / "CSV, JSON, Excel (API coming soon)"
  - Saved analyses history: "Single session" / "Last 10" / "Last 100"
  - Monthly comments: "1,000 per video" / "5,000 / month" / "100,000 / month"
- Desktop 1280: semantic `<table>` (NOT `role="table"` on a div); mobile 375: `.compare-cards` mode (1 card per row)
- **M2: Free card rewrite to 5 bullets** per Phase G/H spec:
  1. 5,000 comments per month
  2. Sentiment direction (qualitative)
  3. Top 15 words + top 15 emoji
  4. CSV export
  5. Last 10 analyses saved
- **M3: Pro card rewrite to 5 bullets** per Phase H spec + Cancel anytime footer:
  1. 100,000 comments per month
  2. Exact sentiment % + trends
  3. All words and emoji ranked + heatmap
  4. CSV, JSON, Excel export (API coming soon)
  5. Last 100 analyses saved
  Footer line below CTA: "Billed monthly. Cancel anytime via customer portal."
- **M4: FAQ rewrite for Phase K trial-vs-refund coexistence.** Items 3 and 4:
  - Item 3 "Can I cancel anytime?": "Yes. Start a 3-day free trial, no charge during. Cancel any time from the customer portal. If you stay past day 3, you are billed $19/mo. Cancel later, you keep access until the period ends."
  - Item 4 "What about refunds?": "The 3-day trial means no charge if you cancel in time. If you are billed (day 4 onward) and change your mind, email us within 7 days of that first charge and we refund the latest invoice, no questions. The trial window and the refund window do NOT stack, the 3 days are before any charge, the 7 days are after."
- Add Trust line "Trusted by 1 paying customer" below 2-card grid (hardcoded EN, NOT parametrized per README)
- **Auth-aware CTA matrix:**
  - Anon Free: "Start free" → `/login?next=/dashboard`
  - Anon Pro: "Sign in to upgrade" → `/login?next=/pricing&intent=signup&plan=pro`
  - Free Free: "Open dashboard" → `/dashboard`
  - Free Pro: "Upgrade to Pro" → `/api/checkout` (UpgradeButton component)
  - Pro Free: "Open dashboard" → `/dashboard`
  - Pro Pro: "Manage subscription" → `/api/portal`
- Implement `?intent=signup&plan=pro` flow: after sign-in, if these params present in `next`, auto-redirect to `/api/checkout` (extend auth callback logic in `/auth/callback/route.ts` or login-form.tsx post-OAuth)
- All new strings in EN + RU i18n: extend `messages/en.json` + `messages/ru.json` with `pricing.compare_table.*` keys + `pricing.faq.*` keys

- **Verify:** visual parity with `Pricing.html` viewport screenshots at 1280 + 375; EN + RU render correct; all CTAs link to right destinations per matrix; mobile `.compare-cards` readable; FAQ accordion opens/closes; auth callback intent flow works (test signed-out → click "Sign in to upgrade" → sign in → land on `/api/checkout`)
- **Commit message:** `feat(pricing): full Phase F-K design port, comparison table + bullet alignment + FAQ rewrite + auth-aware CTAs`
- **M-ids resolved:** M1, M2, M3 (continuation), M4 (4 items)
- **Tests added:** 5+ (ComparisonTable render snapshot, Free/Pro card bullets text content, FAQ accordion behavior, CTA href matrix per persona, intent=signup flow)
- **Components added:** `comparison-table.tsx`, `trust-line.tsx`, `faq-accordion.tsx` (if not already exists), `upgrade-button.tsx` extension for intent flow

### Phase 3: Profile page full rebuild (~2-3h, atomic commit)

Reference: `TubeMine Profile.html` + `components.md` for `profile-section.tsx`, `account-fields.tsx`, `plan-card.tsx`, `billing-card.tsx`, `danger-zone.tsx`.

Build 4 new components in `src/components/`:

- **`account-fields.tsx`** (client island for clipboard copy): avatar (from `profiles.avatar_url`), email, joined date (from `profiles.created_at` or `auth.users.created_at`), account ID with click-to-copy. Use `navigator.clipboard.writeText` with `textarea` fallback per Profile.html reference
- **`plan-card.tsx`** (server component): tier badge, quota progress bar, renews/ends date (from `subscriptions.current_period_end`). When `subscriptionCanceled === true`, swap "renews Jun 18" for "subscription ends Jun 18"
- **`billing-card.tsx`** (server component, Pro-only): mount only when `tier === "pro"`. CTA → `/api/portal`. Last 4 of card optional (omit if Polar API doesn't expose it, under-promise rule)
- **`danger-zone.tsx`** (client island for Sign out): Sign out destructive button using Supabase `signOut()` helper. Delete account: text-only note "Email hello@tubemine.app to delete your account" (no in-product delete)

Refactor `src/app/[locale]/profile/page.tsx` (remove stub "land here via Track A" line) to compose these 4 sections via `profile-section.tsx` wrapper. Handle `?canceled=true` URL param: show Sonner toast "Subscription canceled. You keep access until the period ends."

- **Verify:** anon visits `/profile` → redirect to `/login?next=/{locale}/profile`. Free signed-in → 3 sections (account, plan, danger zone), NO billing. Pro signed-in → 4 sections (all). Canceled Pro → plan card shows "ends" date instead of "renews". `?canceled=true` triggers toast.
- **Commit message:** `feat(profile): full account/plan/billing/danger sections per design`
- **M-ids resolved:** M6 (1 item)
- **Tests added:** 5+ (anon redirect, Free 3-section render, Pro 4-section render, canceled "ends" copy, clipboard copy interaction)
- **Components added:** `account-fields.tsx`, `plan-card.tsx`, `billing-card.tsx`, `danger-zone.tsx`, `profile-section.tsx` wrapper

### Phase 4: Landing polish + Sample label (~1-1.5h, atomic commit)

Reference: `TubeMine Landing.html` for Phase J Variant D hero + trust row + feature blocks + FAQ accordion + final CTA.

- **M10: Hero subtitle update to Phase J Variant D copy:**
  - EN: "Sentiment, top words, and the emojis your audience leans on, in seconds. Try 1,000 comments instantly, no signup. Sign in for 5,000."
  - RU: "Тональность, ключевые слова и эмодзи, которые использует ваша аудитория, за секунды. Попробуйте 1000 комментариев сразу, без регистрации. Войдите для 5000."
  - Update `messages/en.json` + `messages/ru.json` `landing.hero_subtitle` keys
- **M8: Sample label above extractor** (only renders for anon, hide for signed-in):
  - EN: "Free without sign-in. 1,000 comments per video. Sign in for 5,000/month."
  - RU: "Бесплатно без входа. 1000 комментариев на видео. Войдите для 5000/мес."
  - i18n keys: `landing.sample_label.*`
- Build **TrustRow component** (3 mono-font tags per design, hardcoded EN — OK per spec since these are technical labels):
  - "Built on the YouTube Data API v3"
  - "Free 5,000 comments / month, signed in"
  - "GitHub stars + MIT"
- **FeatureBlocks ×3** (alternating reverse layout): Sentiment, Top Words, Emoji Frequency. Use `feature-block.tsx` component per `components.md` spec (eyebrow, title, body, optional reverse prop, children for visual). Reuse mini-widgets from SentimentPanel / TopWordsPanel / EmojiPanel
- **Final CTA section:** large `h2` + sub + single primary button ("Sign up free" → `/login?next=/dashboard`)
- **FaqAccordion at bottom:** client island, single-open, animated `max-height` per design tokens. 4-6 items per Landing.html FAQ section
- **DashboardPreview** 3D-skewed mockup: BUILD ONLY if Phase 4 elapsed time is under 1h. Otherwise mark as Phase 4+1 follow-up. Per README: "Build with the same primitives as the real dashboard. Apply `transform: perspective(1800px) rotateY(-9deg) rotateX(4deg);` on desktop. Mobile: flat. `prefers-reduced-motion`: no skew."

- **Verify:** anon visits `/` → sees hero + trust row + extractor + Sample label + feature blocks + dashboard preview (if shipped) + final CTA + FAQ. Mobile 375 + desktop 1280 screenshots captured. EN + RU render. Signed-in visits `/` → sees only extractor (Variant D anon-only hero hidden)
- **Commit message:** `feat(landing): Phase J Variant D hero + Sample label + trust row + feature blocks + final CTA + FAQ accordion`
- **M-ids resolved:** M8, M9 (folded into M8 per LOCKED decision 1), M10 (3 items)
- **Tests added:** 3+ (Sample label anon-only render gate, signed-in hero hidden, FAQ accordion behavior)
- **Components added:** `trust-row.tsx`, `feature-block.tsx`, `final-cta.tsx`, `dashboard-preview.tsx` (if time allows)

### Phase 5: AppShell + SideNav for signed-in pages (~2h, atomic commit)

Reference: `components.md` for `app-shell.tsx` + `side-nav.tsx`. Reference HTML: Dashboard.html + Profile.html + History.html for shell structure.

- **`app-shell.tsx`** (server component wrapper): topbar 60px (per token `--header-h`) + left sidebar 240px (per `--sidebar-w`) + main content area. Mobile drawer behavior (hamburger toggles sidebar via class + scrim overlay)
- **`side-nav.tsx`** (client island for current-page highlighting via `usePathname()`): two grouped sections:
  - Workspace: Home (`/dashboard`), History (`/history`), Profile (`/profile`)
  - More: GitHub (external `https://github.com/RakhimovY/tubemine`), Docs (`/docs` if exists)
  - Sign out at bottom (separate from groups), uses Supabase `signOut`
- Apply AppShell to `/dashboard`, `/profile`, `/history` layouts via shared layout file or per-page composition. Public pages (`/`, `/pricing`, `/privacy`, `/terms`, `/login`) keep current minimal layout (SiteHeader + footer, NO AppShell)

- **Verify:** navigation between `/dashboard` ↔ `/history` ↔ `/profile` via sidebar clicks works. Current-page highlighted. Mobile 375 hamburger toggles drawer. Drawer scrim closes on tap outside. Sign out button works
- **Commit message:** `feat(shell): AppShell + SideNav for signed-in pages, mobile drawer behavior`
- **M-ids resolved:** M23 (1 item)
- **Tests added:** 3+ (current-page highlight per route, mobile drawer toggle, sign-out behavior)
- **Components added:** `app-shell.tsx`, `side-nav.tsx`

### Phase 6: OAuth Intro + Privacy/Terms + remaining polish (~2-2.5h, atomic commit)

- **M16:** Add `/oauth-intro` static route (`src/app/[locale]/oauth-intro/page.tsx`). Reference: `TubeMine OAuth Intro.html`. Phase E "Coming soon" disabled state:
  - Card title "One quick step before Google"
  - Amber "Beta, coming soon" banner with helper "Opens after Google verification (estimated Q3 2026)."
  - Disabled "Continue to Google, coming soon" button
  - Link "Use TubeMine shared quota instead (slower at peak times)" → `/dashboard?welcome=true`
  - Back to sign in link → `/login`
  - Trust strip: "youtube.readonly only", "No write access", "Revoke anytime"
- **M18:** Privacy + Terms extended for Google data handling (TUB-10 prerequisite):
  - Section "Google user data we access" listing `youtube.readonly` scope, retention, deletion path
  - Section "Third-party sharing" stating none
  - Contact email `hello@tubemine.app`
- **M11:** Dashboard "Need more?" copy extended per Phase J spec: "Pro is 100,000 comments per month for $19. Last 100 saved analyses, CSV results, exact sentiment percentages, hour-of-day trends."
- **M13:** All "Export CSV" → "Save CSV" rename. Find/replace across `export-bar.tsx` + i18n keys + comparison table cell + any other mentions
- **M14:** ExportBar full i18n. Extract all hardcoded strings (anon button label, free button label, pro 3 button labels) to EN + RU keys
- **M19:** TopWordsPanel + EmojiPanel headings to i18n ("Top words" + "Top emojis" + sub-text)
- **M20:** RecentAnalyses item meta to i18n (channel · `{N}` comments format)
- **M21:** Sentiment Anon copy to i18n
- **M22:** TubeMine main extractor all hardcoded EN strings to i18n. This includes form labels, button labels, error messages, toast messages, table headers. Significant i18n debt cleanup, plan ~45-60 min
- **M24:** Skeleton states for sentiment/top-words/emoji panels per [[references/skeleton-screens-design-rule]]. Render skeleton when `extractLoading === true`, fade to real content when ready

- **Verify:** `/oauth-intro` renders correctly with disabled "Coming soon" button; Privacy + Terms include Google data section; dashboard upgrade card copy reflects Phase J; all "Save CSV" labels consistent across surfaces; RU users see RU everywhere on TubeMine extractor; skeletons appear during async loads
- **Commit message:** `feat(polish): /oauth-intro + Privacy/Terms Google data section + i18n debt + Save CSV rename + skeleton states`
- **M-ids resolved:** M11, M13, M14, M16, M18, M19, M20, M21, M22, M24 (10 items)
- **Tests added:** 5+ (oauth-intro disabled button assert, Save CSV i18n keys per locale, skeleton render gate during async)
- **Components added:** `oauth-intro/page.tsx`, skeleton components for analytics panels

## Acceptance criteria (overall)

End-of-sprint check: when this list is fully green, TUB-1 ships.

- [ ] All 13 design pages have matching production routes (Landing, Pricing, Dashboard, Profile, Login, OAuth Intro, History, Privacy, Terms, Changelog if exists, Docs if exists). Sprint scope adds at minimum: `/profile` (rebuild), `/oauth-intro` (new), `/privacy` + `/terms` (extend)
- [ ] All 24 mismatches from `audits/2026-05-20-design-vs-code-audit.md` resolved (M1 through M24)
- [ ] Anonymous user smoke: lands `/`, sees Hero Variant D, pastes URL, gets anon-tier response, saves CSV, sees Sample label setting expectations
- [ ] Free signed-in smoke: signs in, lands `/dashboard` with AppShell + SideNav, correct tier-aware widgets, correct upgrade CTAs, `/history` shows Last 10
- [ ] Trial Pro smoke: TrialBanner renders with days remaining or "today" copy, Pro tier features active, Manage subscription works
- [ ] Paid Pro smoke: full Pro features, `/history` shows Last 100, all 3 export buttons (CSV + JSON + Excel) work
- [ ] Canceled Pro smoke: `/profile?canceled=true` shows "ends" date + toast, Free tier features active via effectiveTier downgrade
- [ ] EN + RU parity: every UI string in both locales, `node scripts/check-message-parity.mjs` clean
- [ ] Mobile 375 + Desktop 1280 visual parity with handoff HTML refs (screenshots per phase commit)
- [ ] No em-dash, no en-dash anywhere: `grep -rP '[\x{2013}\x{2014}]' src/ messages/ app/ public/` empty
- [ ] No banned verbs in rendered UI strings: `grep -rPi '\b(extract|scrape|bulk|pull\s*data|priority|download)\b' src/components/ messages/ src/app/ | grep -vE '(test|\.md|node_modules)'` empty (icon import names like lucide `Download` are exempt)
- [ ] All 74 existing vitest tests pass + at least 5 new tests per phase = at least 30 new tests by end
- [ ] tsc + lint clean
- [ ] Lighthouse score within 5 points of pre-TUB-1 baseline on Landing + Pricing + Dashboard
- [ ] No regression in `/api/extract`, `/api/export`, `/api/checkout`, `/api/portal`, `/api/polar/webhook` (smoke test each after Phase 6 commit)

## Verification (mandatory before EVERY autonomous push)

Run these 7 checks. If ALL pass, push to `main` immediately. If ANY fail, STOP and AskUserQuestion with error details. NEVER force-push past a failing check.

```bash
cd ~/projects/yt-comments
npx tsc --noEmit                                                                      # check 1: types
pnpm lint                                                                              # check 2: lint
pnpm test                                                                              # check 3: vitest (must pass all)
node scripts/check-message-parity.mjs                                                  # check 4: i18n parity
grep -rP '[\x{2013}\x{2014}]' src/ messages/ app/ public/ || echo "no em/en-dash, OK" # check 5: dash purity
grep -rPi '\b(extract|scrape|bulk|pull\s*data|priority|download)\b' src/components/ messages/ src/app/ | grep -vE '(test|\.md|node_modules)' || echo "no banned verbs in UI, OK" # check 6: banned verbs
# check 7: screenshots (per phase, captured via chrome-devtools at 1280 + 375)
```

**Plus per-phase smoke:**

- Local `next dev` smoke test of the changed page in browser
- Screenshot of changed page at desktop 1280 (via chrome-devtools MCP if available)
- Screenshot of changed page at mobile 375 (via chrome-devtools MCP)
- For dashboard/profile/history changes: signed-in browser session smoke

**Post-push smoke (parallel curls after Vercel deploy READY):**

- `curl -sI https://tubemine.tech` (200 or 307 redirect, not 5xx)
- `curl -sI https://tubemine.tech/pricing` (200)
- `curl -sI https://tubemine.tech/dashboard` (307 redirect to login for anon, OK)
- `curl -s https://tubemine.tech/api/extract` (tier-aware JSON shape with `tier`, `top_words`, `top_emoji` fields, NOT 5xx HTML)
- If ANY smoke check fails: AUTO-ROLLBACK `git revert HEAD --no-edit && git push origin main`. Append rollback entry to launch note with curl output + diagnosis. Move to NEXT phase with different approach
- If 3+ consecutive auto-rollbacks: STOP, AskUserQuestion

## Hard gates (rare, AskUserQuestion only here)

User authorized autonomous push for TUB-1 scope. Baseline tag `pre-tub-1-baseline-2026-05-20` exists for full-rollback safety net. AskUserQuestion ONLY for:

- ANY of 7 self-verification checks fails (tsc / lint / tests / parity / em-dash / banned-verbs / screenshots): never force push past failure
- 3 consecutive auto-rollbacks across phases (systemic issue)
- Backend gap discovered mid-sprint (`/api/extract` response needs new field, `/api/portal` redirect changed): backend changes are out of TUB-1 scope
- Elapsed time exceeds 25h (overrun budget): check scope creep or extend budget
- Supabase migration becomes required (not expected per audit; backend complete)
- Forced to delete existing component file (prefer refactor over delete)
- Global rollback to `pre-tub-1-baseline-2026-05-20` is needed (never force-push to main without explicit user "yes rollback" verbatim)

Dependency add (`pnpm add`) is AUTONOMOUS but ONLY if: (a) top-5000 weekly downloads on npm AND (b) MIT/Apache-2/BSD license AND (c) <100KB to client bundle. Validate via npm registry API before installing. If any condition fails, AskUserQuestion.

## Reporting (mandatory)

After EACH phase commit:

- Append commit SHA + 5-bullet summary to `projects/yt-comments/launch/2026-05-20/tub-1-track-a-integration.md` § Phase log
- Append progress line to `projects/yt-comments/status-tracker.md` Done sequence (items 22, 23, ...)
- Append log entry to `logs/activity.md` via `mcp__obsidian__write_note` mode `append`

After FULL TUB-1 ship (all 6 phases shipped, all acceptance criteria met):

- Mark TUB-1 as Done in Linear: `mcp__claude_ai_Linear__save_issue({id: "TUB-1", state: "Done"})`
- Update TUB-10 to Todo (unblocked, Privacy+Terms shipped, OAuth Intro route exists)
- Final summary in launch note § Final summary: total commits, total LOC delta, components added, M-ids resolved checklist with each marked done, total elapsed time
- Append final entry to `logs/activity.md`
- Final message to user: total time, 5-bullet summary, list of open follow-ups (likely TUB-10 ready, plus any new TUB-12/TUB-13 issues discovered)

## Risks & mitigations

- **R1: Tailwind v4 `@theme` migration breaks existing pages.** *Mitigation:* Phase 0 dedicated to token migration with explicit smoke gate before Phase 1.
- **R2: Comparison table mobile `.compare-cards` mode complex to implement responsively.** *Mitigation:* Reference handoff HTML directly during Phase 2; use CSS container queries if needed; fallback to media queries.
- **R3: i18n debt cleanup (M22 main extractor) expands beyond ~60 min estimate.** *Mitigation:* If Phase 6 elapsed crosses 3h, AskUserQuestion to split into Phase 6a + 6b OR defer some M21/22 strings to follow-up TUB issue.
- **R4: AppShell breaks existing layout cookies / session state.** *Mitigation:* Phase 5 reuses existing auth helpers; signed-out users redirected from AppShell-wrapped pages to `/login?next=` per existing pattern.
- **R5: 3D-skewed DashboardPreview burns time.** *Mitigation:* Time-boxed to <1h in Phase 4; defers to follow-up if over budget.
- **R6: `/api/extract` response shape drift if I accidentally touch it.** *Mitigation:* Hard NO in user prompt + listed in out-of-scope; if any code change touches it, AskUserQuestion immediately.
- **R7: Vercel deploy timing race** (push, deploy READY before smoke can run). *Mitigation:* Use `mcp__vercel__list_deployments` to poll until `status=READY`, max 5 min, before running smoke curls.
- **R8: Server-only `exceljs` import accidentally leaks to client bundle.** *Mitigation:* `import "server-only"` guard; Vitest alias stub at `src/test/server-only-stub.ts` per runbook.
- **R9: `redirect()` TS narrowing trap from next-intl navigation.** *Mitigation:* Explicit `return null` after redirect in auth-gated pages, per runbook addendum.

## References (vault)

- `audits/2026-05-20-design-vs-code-audit.md` (M1-M24 catalog)
- `projects/yt-comments/status-tracker.md` (items 1-21 Done sequence)
- `projects/yt-comments/launch/2026-05-20/tub-1-track-a-integration.md` (this sprint's launch note + 60-node flow tree)
- `projects/yt-comments/launch/2026-05-20/phase-k-anon-csv-and-sample-demo-design.md` (latest design ship)
- `projects/yt-comments/launch/2026-05-19/phase-j-anon-hero-and-trial.md` + `-design.md`
- `projects/yt-comments/launch/2026-05-19/phase-h-backend-shipped.md` + `phase-h-card-cleanup-and-history-tail.md`
- `projects/yt-comments/launch/2026-05-19/phase-g-tier-aware-paywall-backend.md` + `-design.md`
- `references/skeleton-screens-design-rule.md` (Phase I playbook)
- `references/dual-label-body-data-tier-pattern.md` (Phase G/H pattern)
- `references/linear-tubemine-workflow.md` (Linear vs vault routing)
- `feedback/priority-support-marketing-tradeoff.md` (no Priority in marketing rule)
- `feedback/no-em-dash.md` (style rule with replacement table)
- `playbooks/saas-roadmap/12-production-shipping-runbook.md` (pre-flight checklist + runbook lessons)

## References (project repo)

- `~/projects/yt-comments/docs/ux-redesign-v3/` (older Track B docs, reference only)
- `/tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/design_handoff_tubemine_v3/README.md`
- `/tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/design_handoff_tubemine_v3/components.md`
- `/tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/design_handoff_tubemine_v3/tokens.md`
- `/tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/TubeMine *.html` (13 page references)
