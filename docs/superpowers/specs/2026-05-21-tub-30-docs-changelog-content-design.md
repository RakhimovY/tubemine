# TUB-31: Docs + Changelog content sprint (design spec)

Status: draft (turbo-pipeline Phase 1 output, pre-review)
Date: 2026-05-21
Sprint scope: fill two stub pages (`/docs`, `/changelog`) with source-attributed user-facing content. Two locales (EN + RU). No new product surface area.

## 1. Goal and non-goals

### Goal

Replace the two stub pages at `src/app/[locale]/docs/page.tsx` and `src/app/[locale]/changelog/page.tsx` with production-grade content:

- `/docs` is user-facing instructional content: what TubeMine does, how to use it across Anonymous, Free, and Pro tiers, output formats, limits, troubleshooting, open-source pointer.
- `/changelog` is public release notes grouped by date, EN-only body with the existing RU disclaimer banner, covering all releases since the Phase 0 launch on 2026-05-15.

Both pages are bilingual at the chrome level (hero title, TOC heading, "Last updated"). The docs body is fully bilingual. The changelog body stays English-only, per the existing `legal_disclaimer_ru_changelog` design decision already shipped in the stub.

### Non-goals

The following are explicitly out of scope for this sprint:

- New product features, pricing changes, quota changes
- Changes to `site-header*.tsx` (locked, recently edited in `ee9fc16`)
- Changes to `(app)/**` routes (locked by a parallel turbo working on INP perf)
- Changes to `/pricing`, `/privacy`, `/terms` pages (no edits, no new keys in their namespaces)
- Changes to any `src/app/api/**` route, Supabase code, Polar code, Stripe code
- Blog posts (separate content type)
- API reference docs (no public API exists yet)
- SEO meta optimization beyond standard `generateMetadata`
- Sitemap.xml updates
- Non-content i18n debt outside this sprint

## 2. Authoritative sources

Every factual claim in the rendered output must trace to one of these primary sources. Brainstorming verified each exists.

| Source | What it provides |
|--------|-----------------|
| `README.md` | What it does, features list, plans table, how it works, stack, roadmap, contributing |
| `src/app/[locale]/pricing/page.tsx` and `pricing.*` keys in `messages/{en,ru}.json` | Per-tier quota numbers, formats, retention, $19/month, 3-day trial, 7-day refund |
| `src/app/api/extract/route.ts` lines 89-217 | Error strings used in Troubleshooting section |
| `src/app/api/preview/route.ts` lines 15-39 | Preview error strings |
| `messages/{en,ru}.json` extractor namespace | Toast error labels |
| `git log --since="2026-04-15"` | Changelog dates and content |
| Linear team Tubemine "Done" issues TUB-1, TUB-7, TUB-8, TUB-11, TUB-12, TUB-13, TUB-16..27 | Changelog detail and TUB ID references |
| README Roadmap section lines 154-159 | Phase 0 / Phase 1 / Phase 2+TUB-1 / TUB-11 release dates |

Anything that cannot be traced to one of these sources is excluded from this sprint. No invented experience claims ("we tested on", "we learned that"), no marketing superlatives ("revolutionary", "industry-leading"), no future promises beyond what the README roadmap states.

## 3. Architecture

### Shared scaffold (both pages)

Both pages follow the existing render shape from `src/app/[locale]/privacy/page.tsx` and `src/app/[locale]/terms/page.tsx`: define a const `sections` array (each element has `{ id, num, tocLabel, title, body }`), then iterate the array twice in the JSX, once to render the sticky TOC `<ol>` (reading `id` + `tocLabel`) and once to render the body `<article class="legal-article">` (reading `num` + `title` + `body`). This is the dual-iteration pattern that section 5.3's "TOC regenerates automatically" relies on.

Both pages reuse the existing `.legal-page` CSS scope from `src/app/globals.css`, already shipped to power `/privacy` and `/terms`. The scaffold provides:

- `.legal-hero` (badge + title + subtitle + "Last updated" line)
- `.legal-body` two-column grid (`.legal-grid`)
- `.toc aside` (sticky TOC sidebar with `ol` of section anchors)
- `.legal-article` (numbered `<section>` blocks with `<h2><span class="num">NN</span> Title</h2>`)
- Mobile-responsive (the `.legal-grid` collapses to single column on mobile per existing CSS rules)

The `LegalToc` client component from `src/components/legal-toc.tsx` provides IntersectionObserver-driven active-section highlight in the sticky TOC plus smooth-scroll on anchor click with an 80px sticky-nav offset. Both new pages import it verbatim.

Both pages declare `export const dynamic = "force-dynamic"` and `export async function generateMetadata` matching the privacy / terms pattern.

Footer is the legal footer pattern: navigation links to `/`, `/#features`, `/pricing`, `/dashboard`, `/changelog`, `/docs`, `/privacy`, `/terms`, MIT license link, GitHub link, plus the same 8-icon social row already shared between privacy and terms. The footer is duplicated inline in each page file (matches existing convention; refactoring to a shared component is out of scope).

### `LAST_UPDATED`

Both pages declare a `const LAST_UPDATED = "May 21, 2026"` matching the privacy / terms convention. The constant renders verbatim in both locales (locale-aware date formatting is out of scope; existing privacy and terms already use this English-style date in RU too).

Multi-session rule: if PR 2's verify-on-prod passes on a calendar date later than PR 1's, bump `LAST_UPDATED` in BOTH pages to PR 2's ship date (single shared value across docs + changelog). This keeps the two pages from drifting and avoids the "Last updated" string lying to users when the sprint spans midnight.

## 4. Page outline: Docs

File: `src/app/[locale]/docs/page.tsx`

8 numbered sections, all bilingual (EN + RU keys in `messages/{en,ru}.json` under namespace `docs.*`).

### 4.1 Section 01: Overview

Source: `README.md` "What it does" paragraph (lines 27-31).

Content shape:

- `p1` opening sentence describing the core promise (paste URL, get sentiment + top words + emoji insights).
- `p2` who it is for (creators, marketing analysts, ML researchers, indie devs).

No marketing superlatives. Mirror the README's neutral instructional tone.

### 4.2 Section 02: Quick start (anonymous flow)

Source: README "How it works" steps 1-3 (lines 70-75), pricing comparison row `row_monthly_anon` (verbatim cell value `"1,000"`; the per-video semantic comes from the row label `compare.row_monthly` which composes to "1,000 monthly comments per video" at render), comparison row `row_export_anon` (`"CSV"`), comparison row `row_saved_anon` (`"Single session"`).

Content shape:

- `p1` what an anonymous visitor can do without signing in.
- `b1` paste a public YouTube URL on the home page.
- `b2` confirm preview (title, channel, view count, like count, comment count).
- `b3` click Analyze; download CSV.
- `callout` the 1,000 comments per IP per video limit and the single-session retention (results live until you close the tab).

No claims about anonymous-tier sentiment beyond what the pricing comparison table shows ("Total count only" per `compare.row_sentiment_dir_anon`).

### 4.3 Section 03: Sign in (Free flow)

Source: README plans table (lines 56-65) Free column, pricing comparison `row_monthly_free` (verbatim `"5,000"`), `row_saved_free` (`"Last 10"`), `row_export_free` (`"CSV"`), `compare.row_sentiment_dir_free` (`"Qualitative bar (no %)"`).

Content shape:

- `p1` what changes after Google sign-in: 5,000 comments per month, last 10 analyses saved, qualitative sentiment label, CSV download.
- `b1` Google sign-in via `/login`.
- `b2` per-month quota (5,000 comments).
- `b3` history of the last 10 analyses at `/history`.
- `b4` CSV format same as anonymous.

No fabricated experience claims ("most users find" etc).

### 4.4 Section 04: Pro flow

Source: README plans table Pro column, pricing `pricing.pro.price` (verbatim `"19"`) + `pricing.pro.unit` (verbatim `"/ month"` with leading space) + `pricing.faq.a5` (cancel anytime, 7-day refund window, no trial-and-refund stacking, 3-day free trial), comparison `row_monthly_pro` (verbatim `"100,000"` in EN, `"100 000"` with ASCII space (U+0020) in RU per § 6.3), `row_saved_pro` (`"Last 100"`), `row_export_pro` (verbatim `"CSV, JSON, Excel (API coming soon)"`), `compare.row_sentiment_dir_pro` (`"Exact % and trend"`).

The 3-day trial wording is sourced ONLY from `pricing.faq.a5` (not from `pricing.pro.b4`; round 2 review caught that `pricing.pro.b4` is actually the export-formats bullet).

Note on the "API coming soon" qualifier: this refers to a planned public REST API for external developers, NOT the file downloads. JSON and Excel exports are downloadable from `/dashboard` and `/history` today via `src/app/api/export/route.ts`. The clarification is folded into the `json_text` and `xlsx_text` strings in § 4.5 (no separate `p3_api_note` key).

Content shape:

- `p1` what Pro adds: 100,000 comments per month, exact sentiment percentages, all-ranked top words and emoji, JSON + Excel formats, last 100 analyses retention.
- `b1` price and billing cadence ($19/month, 3-day free trial before first charge).
- `b2` 7-day refund window after first charge (taken verbatim from the pricing FAQ to avoid drift).
- `b3` cancel anytime via Polar customer portal.
- `b4` 100,000 comments per month, 100 saved analyses, additional output formats.
- `p2` link to `/pricing#faq` for the canonical FAQ (anchor `#faq` jumps straight to the pricing FAQ section). No FAQ duplication in this sprint.

### 4.5 Section 05: Output formats (CSV, JSON, Excel)

Source: README "How it works" step 3 (lines 73-74) for Papa Parse columns `author, text, likes, replies, publishedAt`. ExcelJS server-side mentioned in README "Stack" line 88. TUB-23 Done in Linear for the formula-injection sanitization (CSV + XLSX).

Content shape (every bullet is rendered as `<strong>{csv_strong}</strong> {csv_text}` etc., matching the `b1_strong`/`b1_text` pattern shipped on privacy and terms):

- `p1` formats available per tier.
- `csv_strong` + `csv_text` CSV columns (`author, text, likes, replies, publishedAt`) and which tiers get it (Anonymous + Free + Pro). Downloaded client-side via Papa Parse.
- `json_strong` + `json_text` JSON download for Pro from `/dashboard` and `/history`. Same record schema as CSV plus the analysis aggregates (sentiment percentages, top words, top emoji). Route: `src/app/api/export/route.ts`. The "API coming soon" qualifier on the pricing comparison cell refers to a planned public REST API for external developers; the JSON file download itself works today.
- `xlsx_strong` + `xlsx_text` Excel download for Pro, generated server-side via ExcelJS. Same route as JSON.
- `p2_security` cells starting with `=`, `+`, `-`, `@` (and full-width Unicode variants) are sanitized in CSV and XLSX so opening the file in Excel or Sheets cannot execute formula injection. Shipped on 2026-05-21 (TUB-23).

No fake sample CSV row in code blocks (would be invented data). Instead, link the README "How it works" section for the column list.

### 4.6 Section 06: Limits and quotas

Source: README plans table all rows, README "Quota enforcement" sentence (line 75), README "Stack" Vercel KV + Supabase Postgres references.

Content shape (neutral user-facing language; do not name infrastructure components like Vercel KV, Upstash, Supabase, or `bump_usage`):

- `p1` how quotas are tracked per tier.
- `ip_strong` + `ip_text` Anonymous: 1,000 comments per IP per video. Monthly per-IP budget; resets on the 1st of the next calendar month.
- `user_strong` + `user_text` Free and Pro: per-account monthly budget tied to your Google sign-in. Resets on the 1st of the next calendar month. Current usage and reset date visible at `/profile`.
- `yt_strong` + `yt_text` Shared YouTube Data API quota: TubeMine uses its own quota with the official YouTube Data API v3, so you never need your own API key.

The actual YouTube API daily limit is operational infrastructure and stays out of user-facing scope. § 4.7 handles user-facing recovery wording when that quota is hit.

### 4.7 Section 07: Troubleshooting

Source: verbatim API error strings from the codebase. Status codes and paths verified against `src/app/api/extract/route.ts` and `src/app/api/preview/route.ts` after round 1 review caught earlier errors:

- `src/app/api/preview/route.ts:39` returns `"Video not found"` (HTTP 404)
- `src/app/api/extract/route.ts:203-204` returns `"Comments are disabled for this video by the uploader"` (HTTP **400**; YouTube API reason `commentsDisabled`)
- `src/app/api/extract/route.ts:210-213` returns `"TubeMine has hit its YouTube API daily quota. Please try again tomorrow."` (HTTP **503**; YouTube API reason `quotaExceeded`)
- `src/app/api/extract/route.ts:114-128` returns one of two signed-in error strings (HTTP **402**, JSON `code: "quota_exceeded"`):
  - Pro user past cap: `"Monthly Pro cap reached. Resets on the 1st."`
  - Free user past cap: `"Free tier cap reached. Upgrade for 100,000 comments/month."`
- `src/app/api/extract/route.ts:137-145` returns `"Monthly budget exhausted"` (HTTP **429**) for the anonymous / IP path past cap. This is NOT the signed-in path (the signed-in cap returns the 402 above).
- `messages/en.json` `extractor.errors.url_invalid_youtube` returns `"That does not look like a YouTube video URL"`
- `messages/en.json` `extractor.errors.url_required` returns `"Paste a YouTube URL"`

Content shape:

- `p1` what to do when extract or preview fails.
- `err1_q` quotes verbatim `"Video not found"`. `err1_a` URL is wrong, the video is private, or the video was removed; try a public URL.
- `err2_q` quotes verbatim `"Comments are disabled for this video by the uploader"`. `err2_a` the uploader has disabled comments at the YouTube level; nothing TubeMine can do.
- `err3_q` quotes verbatim `"TubeMine has hit its YouTube API daily quota. Please try again tomorrow."`. `err3_a` quota refresh happens daily on YouTube's schedule (we avoid quoting a specific time zone). Try again the next day.
- `err4_q` quotes both signed-in strings inline (`"Monthly Pro cap reached. Resets on the 1st."` and `"Free tier cap reached. Upgrade for 100,000 comments/month."`). `err4_a` your account has hit the monthly cap (5,000 Free, 100,000 Pro). Quota resets on the 1st of the next calendar month, visible in `/profile`.
- `err5_q` quotes verbatim `"Monthly budget exhausted"` (anonymous variant). `err5_a` signing in upgrades anonymous visitors to the per-account budget (5,000 Free, 100,000 Pro).
- `p_contact_prefix` "If none of these match what you see, email" + `p_contact_link` `hello@tubemine.app` (existing `SUPPORT_EMAIL` constant) + `p_contact_tail` ".".

### 4.7.1 RU translation rule for quoted error strings

The English error strings above are returned by the API verbatim regardless of locale (the routes do not localize their JSON error payload). On `/ru/docs`, the quoted strings (`err*_q` values) MUST stay in English so the troubleshooting entries match what a Russian-speaking user actually sees in the toast / DOM. The surrounding prose (`err*_a`, `p1`, `p_contact_*`) IS translated to Russian. RU translators preserve the EN quoted strings inside the RU prose. The plan must call this out to the implementer.

### 4.8 Section 08: Open source

Source: README Contributing + License sections (lines 162-173), GitHub repo URL `https://github.com/RakhimovY/tubemine` (already a constant on multiple pages).

Content shape:

- `p1` TubeMine is MIT-licensed open source. Fork, self-host, contribute.
- `link_github` GitHub repo link.
- `p2` how to contribute (fork → branch → PR), pointing at the README Contributing section.

## 5. Page outline: Changelog

File: `src/app/[locale]/changelog/page.tsx`

5 numbered sections, each representing one release date, newest first. Body is English-only. Chrome (hero, TOC, footer) is bilingual.

### 5.1 RU disclaimer banner

The existing `legal_disclaimer_ru_changelog` key in `messages/{en,ru}.json` already gates a yellow banner via the stub's `{locale === "ru" ? ... : null}` block. The new implementation keeps the banner, but moves it inside the `.legal-page` scope so it sits above the hero. Banner content (RU): "Журнал изменений ведётся на английском." (existing string, not changed).

Accessibility: the banner element MUST carry `role="note"` so that Russian screen-reader users hear it explicitly announce why the body that follows is in English. Existing stub markup (yellow `border-l-4 border-yellow-500`) is copied verbatim; only the parent wrapper and the new `role` attribute change.

In English locale the banner does not render.

### 5.1.1 Body language attribute

The `.legal-article` wrapper on the changelog page MUST carry `lang="en" dir="ltr"` regardless of route locale. This tells screen readers that the release entries that follow are English text, even on `/ru/changelog` where the parent `<html lang="ru">` would otherwise force Russian phonetics. Both locales render the attribute (it is a no-op on `/en/changelog`).

### 5.2 Release entries

Each release section has the structure:

```
<section id="r-2026-05-21">
  <h2><span class="num">NN</span> 2026-05-21</h2>
  <h3>Added</h3>
  <ul><li>...</li></ul>
  <h3>Changed</h3>
  <ul><li>...</li></ul>
  <h3>Fixed</h3>
  <ul><li>...</li></ul>
  <h3>Security</h3>
  <ul><li>...</li></ul>
</section>
```

The h3 subsections (Added / Changed / Fixed / Security) follow Keep-a-Changelog conventions. Each release renders only the subsections that have entries for that date.

#### 5.2.1 Release `01: 2026-05-21`

Verifiable sources: TUB-8, TUB-11 hotfixes, TUB-12, TUB-13, TUB-16..27 (Linear Done). Commits `ee9fc16`, `7e172e0`, `f7f288e`, `4b3fbe5`, `fefeb02`, `55b0460`, `552e7cc`, `f5a89b3`, `ffe3ff2`, `2d21bc0`, `21091b7`, `59cd134`, `5eb799d`, `856dfce`, `ab2e3e8`, `c8d00d4`, `cdc17c3`, `ddcb2a6`, `5e7aac9`.

- Added: Inbound `support@tubemine.tech` email forwarding to inbox (TUB-8). Shared signed-in AppShell layout removes flicker between Dashboard, History, Profile (TUB-13 M23). Localized export bar, analytics, and extractor strings; loading skeletons across signed-in pages (TUB-13 M14, M19-M22, M24).
- Changed: GitHub README full refresh, primary URL migrated to `tubemine.tech` (TUB-12). Header swaps "Features" link for "Dashboard" when signed in (`ee9fc16`).
- Fixed: Pro sentiment label localized for Russian locale (TUB-21). Profile plan card no longer renders raw ICU `{cap, number}` placeholder (TUB-17). Dashboard cards now gap correctly (TUB-19) and breadcrumb updates per route (TUB-18). Recent Analyses and History rows now persist real video title, channel, and thumbnail instead of placeholders (TUB-20). Russian profile no longer doubles the word "использовано" (TUB-22). Extract and "Try another URL" buttons match the design system instead of low-contrast shadcn primitives (TUB-25). Dashboard quota info no longer renders three times for Pro users (TUB-26). Quick Analyze preview thumbnail respects 180px width cap via inline style (TUB-27).
- Security: CSV and XLSX exports sanitize formula-injection vectors (`=`, `+`, `-`, `@`, plus full-width Unicode variants) per OWASP guidance. Affects every export across Anonymous, Free, and Pro tiers (TUB-23, P0).

#### 5.2.2 Release `02: 2026-05-20`

Verifiable sources: TUB-1 (visual port), TUB-11 (branding Phase 1), TUB-7 (FAQ refund / trial coexistence). Commits `534e15f`..`80b0a21`, `5e7aac9`.

- Added: Full v3 visual port of the landing, pricing, dashboard, profile, history, login, OAuth intro, privacy, and terms pages, replacing the minimal V1 chrome with the production design system (TUB-1, 9 pages). Branding: TubeMine logo, favicon, PWA icons, OpenGraph image (TUB-11 Phase 1).
- Changed: Pricing FAQ refund and 3-day trial wording clarified to avoid the "3-day trial plus 7-day refund" cognitive collision (TUB-7).
- Fixed: Privacy and Terms bullet text no longer wraps per-word (`9101ea5`). OAuth redirect now hard-pins to `NEXT_PUBLIC_ORIGIN` (`be79dd3`).

#### 5.2.3 Release `03: 2026-05-19`

Verifiable sources: Phase H + Phase J git tags (`32423b5`, `f381746`, `860e277`, `73d68b3`, `030147d`, `6eacfe3`, `165b759`, `6f46952`). Pricing FAQ `a5` cancel-anytime detail.

- Added: 3-day free Pro trial (no card charged until day 4). Tier-aware Recent Analyses rows on the dashboard (qualitative label for Free, exact percentages for Pro). JSON and Excel exports for Pro. History retention bumped to 100 entries for Pro. Russian sentiment labels (positive / neutral / negative). Google OAuth profile metadata (email, name, avatar) copied into the profile record.
- Changed: Landing hero shows only for anonymous visitors; signed-in visitors land directly on the dashboard.

#### 5.2.4 Release `04: 2026-05-17`

Verifiable sources: Phase 1.5 and Phase 2 git tags (`217b793`, `93644e0`). README roadmap line 156.

- Added: Sentiment analysis on every comment (positive, neutral, negative direction). Top words and emoji frequency rankings. CSV download for Anonymous and Free tiers with quota gating. Google OAuth sign-in. Pricing page with Free vs Pro comparison.

#### 5.2.5 Release `05: 2026-05-15`

Verifiable sources: initial scaffold commits (`9e91f3a`, `7957565`, `2860ebb`, `1a182d9`, `6e47459`). README roadmap line 155.

- Added: First public release (Phase 0). YouTube URL preview shows title, channel, view, like, and comment counts. Anonymous comment analysis with monthly per-IP budget enforced via Vercel KV. CSV download client-side via Papa Parse. MIT license.

### 5.3 Trim policy and additive maintenance pattern

The changelog grows over time. For this sprint we ship 5 release sections. Future sprints follow the additive pattern:

- **Prepend (or mid-array insert) by date.** Newest at the top; backfilled retroactive entries land at the correct chronological position. After insert, `num` re-cascades across the affected slice. The `num` is purely presentational ordering, so renumbering is safe.
- **Anchor IDs use `r-YYYY-MM-DD`**, never `r-NN`. External bookmarks remain stable through num cascades.
- **TOC regenerates automatically** via the dual-iteration pattern declared in § 3; no manual TOC edit needed.

Trimming policy (older entries dropped, archived, or paginated) is out of scope for this sprint. Revisit when the array exceeds 20 entries.

## 6. i18n key namespace

All keys are added; none are modified. The pricing, privacy, terms, landing, extractor, sentiment_label, common, footer, dashboard, history, profile, login, oauth_intro, analytics, auth namespaces are not touched.

### 6.1 Docs keys (full, EN + RU mirror)

```
docs.meta.title
docs.meta.description

docs.hero.badge
docs.hero.title
docs.hero.sub
docs.hero.updated_label

docs.toc.aria
docs.toc.heading

docs.sections.overview.toc_label
docs.sections.overview.title
docs.sections.overview.p1
docs.sections.overview.p2

docs.sections.quickstart.toc_label
docs.sections.quickstart.title
docs.sections.quickstart.p1
docs.sections.quickstart.b1_strong
docs.sections.quickstart.b1_text
docs.sections.quickstart.b2_strong
docs.sections.quickstart.b2_text
docs.sections.quickstart.b3_strong
docs.sections.quickstart.b3_text
docs.sections.quickstart.callout_strong
docs.sections.quickstart.callout_text

docs.sections.signin.toc_label
docs.sections.signin.title
docs.sections.signin.p1
docs.sections.signin.b1_strong
docs.sections.signin.b1_text
docs.sections.signin.b2_strong
docs.sections.signin.b2_text
docs.sections.signin.b3_strong
docs.sections.signin.b3_text
docs.sections.signin.b4_strong
docs.sections.signin.b4_text

docs.sections.pro.toc_label
docs.sections.pro.title
docs.sections.pro.p1
docs.sections.pro.b1_strong
docs.sections.pro.b1_text
docs.sections.pro.b2_strong
docs.sections.pro.b2_text
docs.sections.pro.b3_strong
docs.sections.pro.b3_text
docs.sections.pro.b4_strong
docs.sections.pro.b4_text
docs.sections.pro.p2_prefix
docs.sections.pro.p2_link_pricing
docs.sections.pro.p2_tail

docs.sections.formats.toc_label
docs.sections.formats.title
docs.sections.formats.p1
docs.sections.formats.csv_strong
docs.sections.formats.csv_text
docs.sections.formats.json_strong
docs.sections.formats.json_text
docs.sections.formats.xlsx_strong
docs.sections.formats.xlsx_text
docs.sections.formats.p2_security
# The "API coming soon" qualifier from pricing is addressed inside json_text/xlsx_text strings; no separate key. (Round 2 YAGNI fix.)

docs.sections.limits.toc_label
docs.sections.limits.title
docs.sections.limits.p1
docs.sections.limits.ip_strong
docs.sections.limits.ip_text
docs.sections.limits.user_strong
docs.sections.limits.user_text
docs.sections.limits.yt_strong
docs.sections.limits.yt_text

docs.sections.troubleshoot.toc_label
docs.sections.troubleshoot.title
docs.sections.troubleshoot.p1
docs.sections.troubleshoot.err1_q
docs.sections.troubleshoot.err1_a
docs.sections.troubleshoot.err2_q
docs.sections.troubleshoot.err2_a
docs.sections.troubleshoot.err3_q
docs.sections.troubleshoot.err3_a
docs.sections.troubleshoot.err4_q
docs.sections.troubleshoot.err4_a
docs.sections.troubleshoot.err5_q
docs.sections.troubleshoot.err5_a
docs.sections.troubleshoot.p_contact_prefix
docs.sections.troubleshoot.p_contact_link
docs.sections.troubleshoot.p_contact_tail
# err*_q values are English-quoted error strings; they MUST NOT be translated in messages/ru.json. See § 4.7.1.
# p_contact_link is the visible link text (e.g., "hello@tubemine.app"); href uses the SUPPORT_EMAIL constant.

docs.sections.opensource.toc_label
docs.sections.opensource.title
docs.sections.opensource.p1_prefix
docs.sections.opensource.p1_link_github
docs.sections.opensource.p1_tail
docs.sections.opensource.p2
```

Total: 1 meta block + 1 hero block + 1 toc block + 8 sections. Counting the enumerated leaves (excluding `#`-prefixed inline comments): 89 leaf keys for `docs.*`.

### 6.2 Changelog keys (chrome-only)

```
changelog.meta.title
changelog.meta.description

changelog.hero.badge
changelog.hero.title
changelog.hero.sub
changelog.hero.updated_label

changelog.toc.aria
changelog.toc.heading
```

No release-entry keys: release bodies are inline JSX in English. Approximately 8 leaf keys.

The existing `legal_disclaimer_ru_changelog` key is reused as-is (already shipped in both locales).

### 6.3 RU translation conventions

Follow the RU style already shipped on `/ru/privacy` and `/ru/terms` (idiomatic, not word-for-word). Three sprint-specific rules:

1. **Numbers mirror the shipped RU pricing convention.** RU values MUST be byte-equal to the shipped `pricing.compare.row_monthly_*` cells in `messages/ru.json`. The shipped character between the thousand-groups is U+0020 (plain ASCII space, `0x20`) NOT U+00A0 NBSP NOR U+2009 thin space (verified via `jq -r '.pricing.compare.row_monthly_anon' messages/ru.json | xxd` which prints `31 20 30 30 30`). EN keeps comma `"1,000"`, `"5,000"`, `"100,000"`. The implementer should copy values directly from `messages/ru.json` to avoid typo-introducing a different space codepoint. Round 2 review caught round 1's inverted rule; this is the correct rule.
2. **Latin-stay strings:** `TubeMine`, `CSV`, `JSON`, `Excel`, `XLSX`, `Pro`, `Free`, `Polar`, `$19` all stay latin in RU (matching the shipped `/ru/pricing`).
3. **Quoted English error strings (§ 4.7.1):** every `err*_q` value in `messages/ru.json` MUST be byte-equal to the EN value.

## 7. Component boundaries

No new components. No refactor of existing components. The implementation is two server-component page files plus key additions to `messages/{en,ru}.json`.

Both pages import:

```ts
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link as IntlLink } from "@/i18n/navigation"
import { LegalToc } from "@/components/legal-toc"
```

Footer pattern is inlined per existing convention. SOCIALS array is duplicated (verbatim copy from `terms/page.tsx`). Future refactor to a shared footer component is out of scope.

## 8. Source attribution model

Every section body in the page component file carries a leading JSX comment with a verifiable pointer to its primary source. Example:

```tsx
{
  id: "quickstart",
  num: "02",
  tocLabel: t("sections.quickstart.toc_label"),
  title: t("sections.quickstart.title"),
  body: (
    <>
      {/* SRC: README.md "How it works" steps 1-3 (lines 70-75) + pricing.compare.row_monthly_anon */}
      <p>{t("sections.quickstart.p1")}</p>
      ...
    </>
  ),
},
```

These JSX comments do not render to the user, do not cost bytes after compile, and give any future editor a verifiable audit trail back to the primary source.

**Status:** convention (strongly preferred, not gate-enforced). The plan will include them; the verify-on-prod gate does NOT block on their absence. Future editors who add a new section without an SRC comment are not blocking deploy, but they are owing the project an audit trail that the code review will surface. This downgrade from "mandatory" follows round 1 YAGNI review feedback while keeping the audit-trail benefit.

## 9. Hard anti-fabrication contract

This sprint enforces the following non-negotiable rules. Any violation fails the spec / plan / commit review.

### 9.1 Em-dash and en-dash ban

The Unicode characters U+2014 (em-dash, `:`) and U+2013 (en-dash, `-`) appear zero times in:

- `src/app/[locale]/docs/page.tsx`
- `src/app/[locale]/changelog/page.tsx`
- the new `docs.*` and `changelog.*` keys in `messages/en.json` and `messages/ru.json`

Use `,` `.` `()` `:` `-` instead.

Verification gate before every commit: the grep targets ONLY the diff hunk introduced by this sprint, not the whole files. Use:

```bash
git diff --staged -- src/app/\[locale\]/docs/ src/app/\[locale\]/changelog/ messages/en.json messages/ru.json \
  | grep -nP '^\+.*[\x{2014}\x{2013}]'
```

The gate passes if the command exits non-zero (no matches). This scoping matters because `messages/en.json` and `messages/ru.json` are large shared files; a pre-existing dash in an unrelated key from a prior sprint would fail a whole-file grep and falsely block the commit.

### 9.2 No fabricated experience claims

Forbidden phrases in any new key value or any new prose in either page (EN and RU):

- "we tested on X comments"
- "we learned that"
- "our research shows"
- "users tell us"
- "in practice"
- "in production"
- "we have seen"

The page is instructional, not anecdotal. Use neutral instructional tone matching `/privacy` and `/terms`.

### 9.3 No future-promise inflation

Roadmap mentions are limited to what README line 158-159 already states:

- "OAuth verification submission"
- "Per-user 10k / day YouTube quota migration"

No invented "coming soon" features (no team plan promise, no API access promise, no Slack-integration promise, etc.). If a feature is not in README's roadmap or already shipped, it is out of scope for this sprint.

### 9.4 Comparative claims direction-verified

Any comparative claim ("more", "less", "faster", "cheaper", "saved") in either page must be either:

- A direct quote from the pricing comparison table (`compare.row_saved_*` etc.), or
- Direction-verified by computation (target value minus alternative).

Example: claiming "Pro saves 20x more analyses than Free" requires checking `100 / 10 = 10`, not `20`. The actual phrasing should match the pricing table verbatim ("Last 100" vs "Last 10") to avoid arithmetic drift.

### 9.5 No AI-voice patterns

Forbidden in any new prose (EN and RU):

- Aphorisms ("Code is poetry", "Less is more", etc.)
- Contrast fragments ("Not X. Y." constructions)
- AI-poetic metaphors ("a symphony of data", etc.)
- Throat-clearing phrases ("It's worth noting that", "Importantly, ...", "In essence")
- Banned word list per `~/vault/feedback/human-voice-anti-ai-patterns.md` (the brainstorm Phase-2 reviewer will pull the full list)

The tone matches the existing `/privacy` and `/terms` pages: clear, neutral, instructional, factual.

## 10. Implementation outline

### 10.1 PR 1: Docs page

Single commit on `main` (per anti-fabrication contract: spec → plan → review → single PR per page).

Commit message draft: `docs(content): ship /docs page with 8 sections (TUB-31)`

Files touched:

- `src/app/[locale]/docs/page.tsx` (full rewrite, replaces the 19-line stub)
- `messages/en.json` (add `docs.*` keys)
- `messages/ru.json` (add `docs.*` keys, RU translations)

Verify-on-prod gate:

1. Wait Vercel production deploy READY (poll `mcp__vercel__list_deployments` for `projectId: prj_*` matching tubemine).
2. Navigate Chrome MCP to `https://tubemine.tech/en/docs` and `https://tubemine.tech/ru/docs`.
3. Assertions (all scope-restricted to the page content, not the shared chrome):
   - DOM contains visible H1 with `docs.hero.title` per locale.
   - DOM contains 8 numbered `<section>` blocks under `article.legal-article`.
   - Em-dash + en-dash count in the article body equals 0: `Array.from(document.querySelector('article.legal-article').textContent).filter(c => c.charCodeAt(0) === 0x2014 || c.charCodeAt(0) === 0x2013).length === 0`. Scoping to `article.legal-article` (instead of `document.body`) prevents the shared SiteHeader / footer from blocking the gate on pre-existing chrome dashes.
   - No raw ICU `{token}` substrings inside `article.legal-article`.
4. Screenshot desktop (1280x800) + mobile (375x812) for both locales. Save screenshots into the vault session path declared in § 11 item 9 (`projects/yt-comments/sessions/2026-05-21/tub-31-docs-changelog/screenshots/`) so a future audit can retrieve them.

### 10.1.1 Vercel deploy poll + Chrome MCP retry

- Poll `mcp__vercel__list_deployments` (filter by `target: "production"` and `meta.githubCommitSha` matching the just-pushed SHA) until `readyState === "READY"`. Default cadence: 10s interval, 600s ceiling. Beyond 600s, fail the gate and check the Vercel dashboard.
- Chrome MCP navigate / screenshot calls retry up to 3 times with 30s backoff on transient failure (network blip, process restart). On persistent failure, fall back to `curl` plus a manual visual check rather than blocking the gate indefinitely.

### 10.2 PR 2: Changelog page

Single commit on `main`. Only ships after PR 1's verify-on-prod gate passes.

Commit message draft: `docs(content): ship /changelog page with 5 release sections (TUB-31)`

Files touched:

- `src/app/[locale]/changelog/page.tsx` (full rewrite, replaces the 23-line stub)
- `messages/en.json` (add `changelog.*` chrome keys)
- `messages/ru.json` (add `changelog.*` chrome keys, RU translations; `legal_disclaimer_ru_changelog` already exists and is not modified)

Verify-on-prod gate: same protocol as PR 1, applied to `/en/changelog` and `/ru/changelog`. Em-dash assertion scoped to `article.legal-article`. Extra assertions:

- RU page DOM contains the yellow disclaimer banner above the hero, with `role="note"`.
- EN page DOM does NOT contain the banner.
- `article.legal-article` carries `lang="en" dir="ltr"` on both locales.
- All 5 release date headings render: 2026-05-21, 2026-05-20, 2026-05-19, 2026-05-17, 2026-05-15.
- Each release section contains at least one of: "Added" / "Changed" / "Fixed" / "Security" h3 heading.

### 10.3 Linear TUB-31 lifecycle

Created in Linear team Tubemine after spec is committed. The original user prompt referenced "TUB-30" but Linear auto-assigned **TUB-31** (TUB-30 was claimed by an earlier issue earlier the same morning). The spec filename (`2026-05-21-tub-30-docs-changelog-content-design.md`) keeps the TUB-30 historical slug for git-history continuity; in-spec references and the Linear issue itself are TUB-31. Title: "Docs + Changelog content sprint". Description: link to this spec file path. Priority: 3 (Medium). State: In Progress immediately.

After both PRs are pushed and both verify-on-prod gates pass: move TUB-31 to Done with a comment listing the two commit SHAs and a one-line summary.

### 10.4 Hotfix-forward protocol for partial verify-on-prod failure

If a single PR passes one locale but fails another (or fails a structural acceptance check like § 11 item 7), respond hotfix-forward, never revert. Matches the existing TubeMine convention (commits `ddcb2a6`, `cdc17c3` from TUB-11). Two failure modes:

- **Translation-key failure** (untranslated quoted error string, em-dash in a value): hotfix touches only the failing locale's keys.
- **Structural JSX failure** (missing `role="note"`, missing `lang="en"`): hotfix touches the shared page component file and re-deploys both locales.

Do NOT use `git revert` on either PR; reverting would strip the working portion of the page from production while users still need it.

## 11. Acceptance criteria

The sprint is Done when ALL of the following are true:

1. PR 1 and PR 2 are both committed and pushed to `main`.
2. Both Vercel production deploys reach state READY.
3. `https://tubemine.tech/en/docs`, `/ru/docs`, `/en/changelog`, `/ru/changelog` all render without error.
4. JS DOM em-dash + en-dash count inside `article.legal-article` is 0 on all 4 URLs (chrome em-dashes outside this selector are NOT in scope for this gate).
5. JS DOM raw ICU `{token}` count inside `article.legal-article` is 0 on all 4 URLs.
6. Footer "Docs" and "Changelog" links from any other page navigate correctly to the new pages (smoke test by clicking from `/en` landing and `/ru/pricing`).
7. RU changelog DOM contains the disclaimer banner with `role="note"` above the hero; `article.legal-article` carries `lang="en" dir="ltr"`.
8. Linear TUB-31 is in Done state with both commit SHAs listed in a comment.
9. `~/vault/daily/2026-05-21.md` has a session-end summary appended (commit SHAs, verify-on-prod PASS/FAIL per URL, TUB-31 status, any deferred follow-ups). Detailed TC-CONTENT audit + omitted-claim transparency notes go into a separate vault note `projects/yt-comments/sessions/2026-05-21/tub-31-docs-changelog/` to keep the daily note scannable.

### 11.1 What the gate checks vs. what the review loop checks

§ 9.1 (em-dash + en-dash) is mechanically gated by acceptance items 4 + 5. The other anti-fabrication sub-rules (§ 9.2 / § 9.3 / § 9.4 / § 9.5) are content-quality rules enforced by the spec + plan review loops BEFORE commit, not re-checked at acceptance. Same for the structural counts that are NOT gate-checked: troubleshoot `err1..err5` entry count, changelog Added/Changed/Fixed/Security subsection presence per release. If any of these slip past review, treat as hotfix-forward (§ 10.4), not as an acceptance regression.

## 12. Open questions deferred to Phase 2 review

None at draft time. The Phase 2 5x parallel review will surface any completeness, consistency, buildability, edge-case, or YAGNI issues. Reviewer perspectives are pre-defined by the turbo-pipeline contract; they are not re-decided here.

## 13. Spec review log (rounds 1+2)

Round 1 surfaced 27 issues across the 5 perspectives. Round 2 surfaced 15. Detailed per-fix log (which review flagged what, and which file lines changed) lives in the vault session note `projects/yt-comments/sessions/2026-05-21/tub-31-docs-changelog/spec-review-log.md` to keep this spec focused on what to build.

### 13.1 Round 2 corrections of round 1 errors (load-bearing for implementer)

- **RU number formatting** (§ 6.3) was inverted in round 1: spec said "RU mirrors EN comma format" but shipped `messages/ru.json` actually uses ASCII space (U+0020), e.g. `"1 000"`. Round 2 reversed the rule; round 3 nailed the codepoint as U+0020 plain ASCII (not thin-space U+2009 nor NBSP U+00A0). **Implementer: follow § 6.3 verbatim. RU values byte-equal to messages/ru.json, EN comma.**
- **`pricing.pro.b4` citation** (§ 4.4) was wrong: round 1 said b4 contained the 3-day trial; the actual b4 contains the export-formats bullet. The 3-day trial wording is in `pricing.faq.a5` only.
- **`pricing.pro.unit` quote** (§ 4.4): correct verbatim is `"/ month"` (with leading space), not `"/month"`.
- **`p3_api_note` key removed** (§ 4.5 / § 6.1): round 1 added it; round 2 YAGNI feedback collapsed the qualifier into the `json_text` and `xlsx_text` strings instead.
- **`p_contact_link` key added** (§ 6.1): round 1 referenced it in § 4.7 narrative but forgot to enumerate it.

### 13.2 Pushed back across both rounds

- **Round 1 YAGNI #2 (merge 05-19 + 05-17 changelog entries):** kept 5 separate sections. The 2026-05-17 release shipped sentiment + pricing + CSV gating; the 2026-05-19 release shipped trial + tiered exports + RU sentiment labels. Meaningfully different user-impact events.
- **Round 1 Completeness #5 (acceptance coverage of § 9.2-9.5):** § 11.1 documents the gating scope honestly. § 9.2-9.5 are review-loop-gated, not acceptance-gated.
- **Round 2 YAGNI #1 (delete § 10.4 hotfix protocol):** kept (compressed to 8 lines). Documents a real failure mode (don't revert) that has bitten TUB-11 already.
- **Round 2 YAGNI #2 (delete § 11.1):** kept (compressed to 1 paragraph). Documents the gate-vs-review split for future readers.

## 14. Hand-off

After this spec passes the 5x parallel review (further rounds run until 0 issues or 5 rounds, per turbo-pipeline) and `writing-plans` skill completes, the implementation phase begins. No new design decisions are made during plan-writing or implementation. Any spec-level question that surfaces during plan-writing returns control here for an amendment.
