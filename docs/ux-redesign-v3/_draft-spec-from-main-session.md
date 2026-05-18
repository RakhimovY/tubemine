# SPEC: TubeMine v3 — Backend persistence + i18n + design fixes

> Builds on `PRD.md` (Claude Design handoff). This SPEC captures **what changed since PRD** and **what must be added** before integration. PRD remains the source of truth for brand, tokens, IA. SPEC overrides PRD where they conflict (noted inline).

**Status:** Draft v1. Author: main session, 2026-05-18. Pending user review before PLAN phase.

---

## 0. Why this SPEC exists

PRD locked the design direction. Claude Design generated all 9 page HTMLs + handoff bundle. Mid-review the following gaps surfaced:

1. **Factual mismatches**: Several FAQ claims and feature promises on Landing/Dashboard don't reflect the real codebase (no `analyses` table, no raw-comment cache, no history page, no `/api/analyses` endpoint).
2. **Missing i18n**: 63% of TubeMine traffic in the last 7d came from Threads RU (Vercel Analytics). App is 100% English UI. No language switcher exists.
3. **Phantom links**: Footer `Resources` column shows `API` and `Status` links that go nowhere. Header shows `Docs` and `Changelog` for pages that don't exist.
4. **Layout glitches**: Profile Account section renders in row layout (header left + fields right) rather than column.
5. **Socials missing**: Footer `SOCIAL` column is unpopulated in current generation. We have 7 active channels + GitHub repo.
6. **Pricing route question**: Should `/pricing` remain standalone or redirect to landing `#pricing` section?

This SPEC defines the corrective scope. PLAN will split it into parallel tracks.

---

## 1. Goals

1. Every promise on the marketed UI must reflect the real backend behavior. No fabricated features.
2. TubeMine is bilingual (EN + RU) with proper i18n infrastructure that scales beyond two locales.
3. Mobile (375px viewport) zero overflows, zero broken targets, across all pages.
4. Footer + header have zero phantom links. Every link either resolves to a real page or is external + truthful.
5. After redesign integration, the existing TubeMine functionality (extract, sentiment, top-words, emoji, CSV gate, Google OAuth, Polar checkout, customer portal) keeps working without regression.

## 2. Non-goals (explicit out-of-scope)

- Trial functionality (with or without card). Out per user decision 2026-05-18.
- ML-based sentiment models (we stay lexicon-based).
- YouTube subtitles/transcript features.
- Bulk video analysis (one URL at a time).
- Comment-author tracking beyond what `Comment` type already exposes.
- Public REST API for third-party integration (we use API only internally).
- Stripe Identity / KYC redesign (already shipped, separate concern).
- Spanish / Portuguese / German UI translation (English + Russian only for now; other languages are sentiment-roadmap not UI-roadmap).
- Translating Privacy + Terms to RU in this sprint (legal text requires lawyer review — ships EN-only with disclaimer in RU locale until reviewed).

---

## 3. Track A — UI / Claude Design fixes

These ship via one batched Claude Design prompt and end up in the generated HTMLs + handoff bundle. Each item maps to a concrete file the bundle exports.

### 3.1 FAQ block on Landing (full rewrite)

Replace current 6 Q&A with **8 truthful Q&A** in anxiety-first → capability → billing order. Source-of-truth wording (apply to EN locale; RU locale gets equivalent rewrite):

| # | Question | Answer |
|---|---|---|
| 1 | Is this legal? | Yes. TubeMine only analyzes public comments via the official YouTube Data API v3, the same data anyone can see by scrolling a video page. No scraping, no private data. See terms for details. |
| 2 | Do I need a YouTube API key? | No. TubeMine uses our own API quota with the official YouTube Data API v3. Paste a public video URL and we handle the rest. |
| 3 | Do you store my comments? | We store the analysis results (sentiment percentages, top words, emoji counts) for 30 days so you can revisit them from your dashboard. Raw comment text is processed in memory and never persisted. We never sell or share data with third parties. See privacy for details. |
| 4 | What happens when I hit my monthly cap? | Anonymous: 1,000 comments/month per IP. Signed-in Free: 5,000/month. Pro: 100,000/month. When you hit the cap you see an upgrade prompt. Quota resets on the 1st of each month UTC. |
| 5 | What counts as a comment? | Top-level comments and replies both count toward your monthly quota. A thread with one parent comment and three replies counts as four comments. |
| 6 | What languages does sentiment support? | TubeMine uses a lexicon-based scorer for English and Russian. Both languages get equal treatment with negation handling. Comments in other languages get classified as 'unknown' and excluded from aggregates. Spanish, Portuguese, German are on the roadmap. |
| 7 | Can I cancel anytime? | Yes. Pro is month-to-month with no minimum term. Cancel anytime from your profile via Polar's customer portal. Billing is handled by Polar; downgrades are prorated. |
| 8 | Can I export the analysis? | Yes. CSV export is available after sign-in. Free and Pro both get CSV downloads with all sentiment, top words, and emoji frequency data. |

Contact footer: `Still have a question? hello@tubemine.tech`

**Override note vs PRD**: PRD §1 bullet 2 mentions "'Experimental for Russian' tag". That tag stays on the sentiment widget UI (because RU share is information for the user), but the FAQ language must NOT say RU is "experimental beta". Reality: RU lexicon is first-class (`src/lib/sentiment/lexicon-ru.ts`), equal treatment to EN.

### 3.2 Footer cleanup (Landing + every page that uses Footer)

Footer columns:

| Column | Items |
|---|---|
| Product | Features (anchor to landing), Pricing (`/pricing`), Dashboard (`/dashboard`, signed-in only — link visible to all but redirects to login if anonymous), Changelog (`/changelog`) |
| Resources | Docs (`/docs`), GitHub (external https://github.com/RakhimovY/tubemine) |
| Legal | Privacy (`/privacy`), Terms (`/terms`), License · MIT (external link to repo LICENSE) |
| Social | **All 8 below, iconified, opens in new tab** |

Remove from Resources: `API`, `Status` (no public API exists; Vercel handles status — no separate page).

**Socials list** (use lucide-react icons or equivalent; icon-only with aria-label):

| Platform | URL | aria-label |
|---|---|---|
| GitHub | https://github.com/RakhimovY/tubemine | TubeMine GitHub repository |
| Threads | https://www.threads.com/@ai.yerke_ | Founder on Threads (RU) |
| X / Twitter | https://x.com/yerkeRakhimov | Founder on X (EN) |
| LinkedIn | https://www.linkedin.com/in/rakhimov-yerkebulan/ | Founder on LinkedIn |
| dev.to | https://dev.to/yerkerakhimov | Founder on dev.to |
| Reddit | https://www.reddit.com/user/ErkeshaA/ | Founder on Reddit |
| Instagram | https://www.instagram.com/ai.yerke_/ | Founder on Instagram (RU) |
| Telegram | https://t.me/ai_yerke | Founder on Telegram (RU) |

All 8 visible regardless of UI locale (founder is bilingual; users may follow author's RU-language content even with EN UI).

### 3.3 New page: `TubeMine Docs.html`

Single-page user docs at `/docs`. Sections:

1. **Quick start** — paste URL, click analyze, read results
2. **What each widget shows** — sentiment (lexicon + negation), top words (frequency + stopwords), emoji (top 10 with percent share)
3. **Quota system** — anonymous 1k, free 5k, Pro 100k, monthly UTC reset
4. **Sign-in and history** — Google OAuth, saved analyses (30-day retention), /history navigation
5. **CSV export** — what fields are exported, sample row
6. **Languages** — EN + RU first-class, others classified `unknown`
7. **Privacy summary** — what we store (results 30 days, raw text never), inline link to /privacy

Layout: sticky left-rail TOC on desktop, collapsible accordion on mobile. Brand voice + tokens consistent with rest of site.

### 3.4 New page: `TubeMine Changelog.html`

Release notes at `/changelog`. Dated entries, most recent on top. Tag chips: `NEW`, `FIXED`, `IMPROVED`, `BREAKING`.

Initial entries (real history):

- **2026-05-18** — `NEW` Bilingual UI (EN + RU). `NEW` Saved analyses with 30-day retention. `NEW` /history page. `IMPROVED` Mobile layout across all pages. `FIXED` Polar webhook UUID validation.
- **2026-05-17** — `NEW` Google OAuth (replaced magic link). `NEW` Sentiment + emoji frequency widgets. `IMPROVED` Pricing copy.
- **2026-05-16** — `NEW` Pro tier $19/mo via Polar. `NEW` CSV export gated by sign-in.
- **2026-05-15** — `NEW` Phase 0 launched — paste URL, get analysis.

Same brand voice. Mobile responsive.

### 3.5 Profile Account section layout

Current: `.settings-head` (h2 + p description) renders as flex-row with `.settings-body` (key/value rows) — header left, fields right. Awkward and asymmetric.

Fix: change to flex-column (header stacked on top, fields below). Apply same column pattern to Plan / Billing / Danger zone sections for consistency. PRD §6.6 Profile layout updated to reflect this.

### 3.6 Pricing page strategy

`/pricing` stays as a standalone route. Implementation pattern:

- Extract `<PricingBlock />` as shared component
- `app/page.tsx` (Landing) uses `<PricingBlock />` as pricing section
- `app/pricing/page.tsx` uses `<PricingBlock />` as the page body
- `/pricing` adds: pricing-specific FAQ section (refund policy, currency, taxes), `Manage subscription` button visible to signed-in users
- Polar `cancel_url` continues to point at `/pricing`

Header nav `Pricing` link points to `/pricing` (not `/#pricing` anchor) — preserves direct shareability.

### 3.7 Header phantom-link resolution

Header nav: `Features`, `Pricing`, `Docs`, `Changelog`. All four now resolve to real pages:

- Features → `/#features` anchor on landing
- Pricing → `/pricing`
- Docs → `/docs` (created in §3.3)
- Changelog → `/changelog` (created in §3.4)

Header hover behavior: **do not change** (user explicit decision 2026-05-18 — current per-link hover is acceptable).

### 3.8 Section 03 ("Sign in") on Landing

Current copy promises history that didn't exist. With backend persistence shipping in Track B, the existing copy is now truthful. Keep:

- Headline: "Sign in and TubeMine remembers your quota, history, and saves."
- Bullets: Quota meter, Searchable history, CSV results, Free forever.

No copy change needed once Track B ships.

### 3.9 Dashboard sidebar `History`

Current decision: keep `History` nav item (overrides earlier remove decision once Track B is committed). Add a real `/history` page route (spec'd in Track B).

### 3.10 Mobile audit

Full 375px viewport pass across all generated pages (Design System, Landing, Dashboard, Pricing, Profile, Privacy, Terms, Login, Docs, Changelog, Flows). For every page:

- Zero horizontal scroll
- All tap targets ≥44×44px
- Body text ≥14px, headings scale down proportionally
- Multi-column layouts stack to single column at <768px
- Sidebar nav collapses to bottom-tab nav or hamburger menu
- Dashboard widgets stack vertically
- Pricing cards stack
- FAQ accordion remains tappable
- Forms full-width
- Footer columns wrap to single column

Refs/ folder must re-export the mobile-fixed versions.

---

## 4. Track B — Backend persistence (new dev sprint)

### 4.1 Database schema

New table `public.analyses`:

```sql
create table public.analyses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  video_id        text not null,
  video_title     text,
  channel_name    text,
  thumbnail_url   text,
  comment_count   int  not null,
  sentiment       jsonb,                       -- { positive, neutral, negative, score, languages, ruShare, ... }
  top_words       jsonb,                       -- [{ token, count }, ...] up to top 50
  emoji_frequency jsonb,                       -- [{ emoji, count, percent }, ...] up to top 20
  processed_at    timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '30 days')
);

create index analyses_user_id_processed_at on public.analyses (user_id, processed_at desc);
create index analyses_expires_at on public.analyses (expires_at);

alter table public.analyses enable row level security;

create policy "users read own analyses"
  on public.analyses for select
  using (auth.uid() = user_id);

create policy "users delete own analyses"
  on public.analyses for delete
  using (auth.uid() = user_id);
```

Raw comment text NEVER stored (only aggregates). FAQ Q3 is now truthful.

### 4.2 API endpoints

**Modified** `POST /api/extract`:
- After successful extract for signed-in user, insert row into `analyses` (best-effort; if insert fails, don't fail the extract response — log warn and return data)
- For anonymous users, do not persist (anonymity preserved)

**New** `GET /api/analyses?cursor=<id>&limit=20`:
- Returns user's saved analyses paginated, most recent first
- Cursor-based pagination via `processed_at < cursor.processed_at OR (processed_at = cursor.processed_at AND id < cursor.id)`
- Returns `{ items, nextCursor }`

**New** `GET /api/analyses/:id`:
- Returns single analysis for re-render on /history detail or dashboard tile
- Returns 404 if not owner

**New** `DELETE /api/analyses/:id`:
- Soft-delete or hard-delete (hard for simplicity in Phase 0; soft if storage retention regulation tightens)
- 30-day TTL via expires_at column

### 4.3 Retention cron

Daily Vercel cron (Vercel Cron Jobs) at `0 3 * * *` UTC:

- `DELETE FROM public.analyses WHERE expires_at < now()`
- Implemented via `POST /api/internal/cron/purge-analyses` with `CRON_SECRET` env var validation
- Returns count of purged rows for observability

### 4.4 `/history` page UI

Route `app/history/page.tsx`:

- Header with search input (filters by video_title or channel_name, client-side initially)
- Filters: date range (last 7d / 30d / all), sentiment (positive/neutral/negative dominant)
- Grid of analysis cards: thumbnail, video_title, channel, comment_count, sentiment dominant chip, processed_at (relative), "Re-analyze" + "View" + "Delete" actions
- Empty state: "No saved analyses yet. Analyze a video to see it here."
- Loading skeleton, error state
- Pagination via cursor (load more button or infinite scroll)
- Requires auth (redirect to /login if anonymous)

### 4.5 Dashboard "Recent analyses" widget

Reads from `GET /api/analyses?limit=5`. Shows latest 5 with mini-card layout (thumbnail, title, processed_at, sentiment chip). "View all →" link to `/history`. Loading state shown while data fetches.

### 4.6 Privacy + Terms updates

- Privacy page: add explicit storage clause — "We store the aggregated analysis results (sentiment percentages, top words, emoji frequencies) for 30 days, associated with your account. Raw comment text is processed in memory and never written to disk. After 30 days, analysis results are automatically purged. You can delete any saved analysis at any time from your `/history` page."
- Terms: add retention clause, deletion-on-request clause, GDPR-equivalent right-to-deletion clause.

---

## 5. Track B — i18n infrastructure

### 5.1 Locales

- `en` (English) — default fallback
- `ru` (Russian)

Other languages out-of-scope. Spanish/Portuguese/German are sentiment lexicon roadmap, not UI locale roadmap.

### 5.2 URL strategy (research-driven decision)

**Research task** (deliverable in PLAN phase): Compare Next.js i18n routing patterns for SaaS:

1. Sub-path routing: `/en/...` + `/ru/...` (Next.js native, hreflang, SEO-optimal)
2. Sub-domain: `en.tubemine.tech` + `ru.tubemine.tech` (DNS complexity, SEO good)
3. Query param: `?lang=ru` (simplest, weak SEO, fragile cache keys)
4. Cookie-only: single URL, locale via cookie (worst SEO, share-friendly but Google penalizes duplicate content)

Compare against SaaS i18n best practices (Linear, Vercel, Stripe, Polar, similar tooling SaaS in 2025-2026). Recommended approach feeds into PLAN.

**Initial leaning**: sub-path `/en/...` `/ru/...` with hreflang tags, but PLAN must confirm with research citations.

### 5.3 Default locale + persistence

- First-visit: detect `Accept-Language` header. If `ru-*` → serve `/ru/...`. Otherwise serve `/en/...`.
- After manual switch via UI: persist choice in cookie (1 year). Override `Accept-Language` for subsequent visits.
- Localized 404 / error pages.

### 5.4 Language switcher UI

Placement: header, right of nav links, before `Sign in / Get started` buttons. Format: text dropdown showing current locale (`EN ▾`) with options `EN`, `RU`. Mobile: inside hamburger menu.

### 5.5 What gets translated

Bilingual EN+RU:
- Landing (hero, all sections, FAQ, CTAs)
- Dashboard (sidebar, widgets, empty states, errors)
- Pricing page (copy + pricing FAQ)
- Profile page (Account / Plan / Billing / Danger zone labels and descriptions)
- /history page (filter labels, empty state, action menus)
- /docs page (all content)
- /changelog page (entry tags + dates; entry bodies bilingual where applicable)
- Login page (Google OAuth CTA, legal blurb)
- Error pages (404, 500, generic error)
- Toast messages (success, error, info)
- Form validation errors
- Email subjects + bodies (welcome email, etc.)

EN-only with RU-locale disclaimer ("Russian version coming after legal review"):
- Privacy
- Terms

### 5.6 Typography considerations for Cyrillic

- SF Pro Display supports Cyrillic natively (used by macOS / iOS). Already in DESIGN.md font stack.
- Inter fallback supports Cyrillic.
- Verify all custom decorative weights/sizes look balanced in Cyrillic (taller letters, longer words on average).
- Adjust `letter-spacing` or `font-size` for hero H1 if needed in RU.

### 5.7 SEO

- `hreflang` tags in `<head>`: `<link rel="alternate" hreflang="en" href="https://tubemine.tech/en/..." />` + ru equivalent
- `<html lang="en">` / `<html lang="ru">` per locale
- Sitemap: separate entries for each locale URL
- Open Graph `og:locale` tag

### 5.8 Library choice

`next-intl` is the de-facto standard for Next.js 16 App Router i18n. Use unless research reveals strong reason otherwise.

---

## 6. Constraints

- Stack unchanged: Next.js 16, Tailwind v4, shadcn base-nova, Supabase Auth, Polar billing.
- Maintain existing API contracts (do not change `/api/extract` response shape — only add `analyses` insert as side effect).
- Maintain Polar webhook integration (no schema changes that break `subscription.ts`).
- Maintain Vercel Analytics events (do not rename `paste_attempted`, etc).
- Service role pattern for all DB writes (RLS-enforced reads).
- Mobile-first (PRD §10).
- WCAG 2.2 AA compliance from DESIGN.md.
- No em-dash in any user-facing text (founder style rule).

---

## 7. Success criteria

Track A (UI) ship-readiness:

- [ ] FAQ has 8 truthful Q&A in correct order
- [ ] Footer has 8 socials + cleaned columns
- [ ] /docs and /changelog pages exist
- [ ] Profile Account section is column layout
- [ ] Header + footer have zero phantom links
- [ ] All 11 generated pages pass 375px viewport audit
- [ ] Handoff bundle README updated for new pages

Track B (Backend persistence) ship-readiness:

- [ ] `analyses` table migration applied to prod
- [ ] `POST /api/extract` saves rows for signed-in users
- [ ] `GET /api/analyses` paginated endpoint live
- [ ] `DELETE /api/analyses/:id` live
- [ ] Daily cron purges expired rows
- [ ] /history page renders real persisted data
- [ ] Privacy + Terms updated to reflect retention
- [ ] E2E test: sign in → analyze 2 videos → verify both appear on /history → delete one → verify removal

Track B (i18n) ship-readiness:

- [ ] `next-intl` (or chosen library) configured for `en` + `ru`
- [ ] Browser detection works on first visit
- [ ] Manual switch persists across sessions
- [ ] Language switcher in header (desktop + mobile)
- [ ] All non-legal pages translated to RU
- [ ] Privacy + Terms show EN with RU-locale disclaimer
- [ ] hreflang tags rendered correctly
- [ ] Sitemap includes both locales

Integration ship-readiness:

- [ ] No regression in existing extract/CSV/checkout flows
- [ ] Polar webhook still updates subscriptions correctly
- [ ] Google OAuth still works for sign-in
- [ ] Vercel Analytics events still fire
- [ ] Mobile UX verified on real device (iPhone Safari + Android Chrome)
- [ ] Lighthouse score ≥85 on Landing for both locales

---

## 8. Acceptance tests

### Track A
1. Open `/` in incognito → scroll to FAQ → see 8 Q&A in order specified in §3.1
2. Open footer → click each social link → opens correct profile in new tab
3. Open `/docs` and `/changelog` → both render, brand-consistent, mobile-responsive
4. Open `/profile` on mobile 375px → Account section header above fields (column)
5. Click `Pricing` header link → navigates to `/pricing` route (not anchor)

### Track B (Backend)
1. Sign in as test user → extract analysis on video A → POST returns 200 → SELECT from `analyses` shows new row with correct `user_id`
2. Anonymous user → extract analysis on video B → POST returns 200 → no row inserted
3. `GET /api/analyses?limit=20` for signed-in user → returns paginated list, ordered by `processed_at desc`
4. `DELETE /api/analyses/:id` → row deleted, GET shows row gone
5. Insert test row with `expires_at = now() - interval '1 day'` → run cron endpoint → row purged
6. Visit `/history` signed-in → see saved analyses card grid

### Track B (i18n)
1. Visit `/` with `Accept-Language: ru-RU` → redirected to `/ru/`, content in Russian
2. Visit `/` with `Accept-Language: en-US` → served `/en/` (or `/` depending on routing choice), English
3. Switch locale via header dropdown → URL changes, content swaps, cookie set
4. Reload page → previous locale preserved via cookie
5. Visit `/ru/privacy` → see RU disclaimer + English Privacy text (no full RU translation yet)
6. Inspect `<head>` → `hreflang` tags present for both locales

---

## 9. Open questions / research items

1. **i18n URL strategy**: sub-path vs sub-domain vs query param. Research SaaS best practices (Linear, Vercel, Stripe, Polar, GitHub, Twilio docs i18n approach). Recommend in PLAN with citations.
2. **Privacy + Terms RU translation**: Lawyer review? Template-based translation? Defer entirely? Decide in PLAN with timeline.
3. **Retention edge case**: What if user has Pro for 1 year — should retention extend beyond 30 days for Pro? Decide in PLAN. Initial leaning: 30 days for all tiers, paid feature gating creates churn risk.
4. **History deletion**: Soft-delete vs hard-delete? GDPR right-to-erasure favors hard delete. Decide in PLAN.
5. **Dashboard "Recent analyses" widget**: How does it behave for anonymous users on dashboard (if dashboard is even accessible to anonymous)? Confirm dashboard is signed-in-only.

---

## 10. Tracks summary

| Track | What | Where | Async? |
|---|---|---|---|
| **A. Claude Design** | UI fixes per §3 (FAQ, footer, Docs+Changelog, Profile, mobile audit) | Claude Design web UI via Chrome MCP | Yes (~15-30 min generation) |
| **B1. Backend persistence** | DB migration + APIs + /history + cron + Privacy/Terms text per §4 | `~/projects/yt-comments`, spawned turbo-pipeline session | Yes (~1 week dev) |
| **B2. i18n infrastructure** | next-intl setup + translations + switcher + hreflang per §5 | `~/projects/yt-comments`, same spawned session (sequenced after B1) | Yes (~3-5 days dev) |
| **C. Integration** | Apply Claude Design HTMLs to Next.js components, merge with Track B work, deploy | After A + B complete | Sync, ~2-3 days |

Track A and Track B can run truly parallel. Track C waits for both.

---

## 11. Related docs

- [`PRD.md`](./PRD.md) — original design brief, brand, IA, page-by-page specs
- [`/Users/rakhimovy/vault/playbooks/saas-roadmap/12-production-shipping-runbook.md`](../../../../vault/playbooks/saas-roadmap/12-production-shipping-runbook.md) — pre-flight checklist for SaaS launches
- [`/Users/rakhimovy/vault/me/social-accounts.md`](../../../../vault/me/social-accounts.md) — canonical socials list for footer
- [`/Users/rakhimovy/vault/feedback/no-em-dash.md`](../../../../vault/feedback/no-em-dash.md) — text style rule applied to all generated copy

---

**Next phase**: PLAN.md derived from this SPEC. Includes i18n URL strategy research, file-by-file change list, test plan, dependency ordering.
