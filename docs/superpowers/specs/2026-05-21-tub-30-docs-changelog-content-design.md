# TUB-30 — Docs + Changelog content sprint (design spec)

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

## 4. Page outline — Docs

File: `src/app/[locale]/docs/page.tsx`

8 numbered sections, all bilingual (EN + RU keys in `messages/{en,ru}.json` under namespace `docs.*`).

### 4.1 Section 01 — Overview

Source: `README.md` "What it does" paragraph (lines 27-31).

Content shape:

- `p1` opening sentence describing the core promise (paste URL, get sentiment + top words + emoji insights).
- `p2` who it is for (creators, marketing analysts, ML researchers, indie devs).

No marketing superlatives. Mirror the README's neutral instructional tone.

### 4.2 Section 02 — Quick start (anonymous flow)

Source: README "How it works" steps 1-3 (lines 70-75), pricing comparison row `row_monthly_anon` ("1,000 / video"), comparison row `row_export_anon` ("CSV"), comparison row `row_saved_anon` ("Single session").

Content shape:

- `p1` what an anonymous visitor can do without signing in.
- `b1` paste a public YouTube URL on the home page.
- `b2` confirm preview (title, channel, view count, like count, comment count).
- `b3` click Analyze; download CSV.
- `callout` the 1,000 comments per IP per video limit and the single-session retention (results live until you close the tab).

No claims about anonymous-tier sentiment beyond what the pricing comparison table shows ("Total count only" per `compare.row_sentiment_dir_anon`).

### 4.3 Section 03 — Sign in (Free flow)

Source: README plans table (lines 56-65) Free column, pricing comparison `row_monthly_free` ("5,000 / month"), `row_saved_free` ("Last 10"), `row_export_free` ("CSV"), `compare.row_sentiment_dir_free` ("Direction (qualitative)").

Content shape:

- `p1` what changes after Google sign-in: 5,000 comments per month, last 10 analyses saved, qualitative sentiment label, CSV download.
- `b1` Google sign-in via `/login`.
- `b2` per-month quota (5,000 comments).
- `b3` history of the last 10 analyses at `/history`.
- `b4` CSV format same as anonymous.

No fabricated experience claims ("most users find" etc).

### 4.4 Section 04 — Pro flow

Source: README plans table Pro column, pricing `pricing.pro.price` ($19) + `pricing.pro.unit` (/month) + `pricing.pro.b4` (3-day trial), `pricing.faq.a5` (cancel anytime, 7-day refund window, no trial-and-refund stacking), comparison `row_monthly_pro` ("100,000 / month"), `row_saved_pro` ("Last 100"), `row_export_pro` ("CSV, JSON, Excel"), `compare.row_sentiment_exact_pro` ("Yes").

Content shape:

- `p1` what Pro adds: 100,000 comments per month, exact sentiment percentages, all-ranked top words and emoji, JSON + Excel formats, last 100 analyses retention.
- `b1` price and billing cadence ($19/month, 3-day free trial before first charge).
- `b2` 7-day refund window after first charge (taken verbatim from the pricing FAQ to avoid drift).
- `b3` cancel anytime via Polar customer portal.
- `b4` 100,000 comments per month, 100 saved analyses, additional output formats.
- `p2` link to `/pricing` for full plan comparison. This anchors the existing pricing FAQ at `/pricing#faq` as the canonical FAQ source (no FAQ duplication in this sprint).

### 4.5 Section 05 — Output formats (CSV, JSON, Excel)

Source: README "How it works" step 3 (lines 73-74) for Papa Parse columns `author, text, likes, replies, publishedAt`. ExcelJS server-side mentioned in README "Stack" line 88. TUB-23 Done in Linear for the formula-injection sanitization (CSV + XLSX).

Content shape:

- `p1` formats available per tier.
- `csv_text` CSV columns and which tiers get it (Anonymous + Free + Pro).
- `json_text` JSON shape for Pro (route `/api/export` returns the same fields as CSV plus the full sentiment, top words, top emoji data per tier).
- `xlsx_text` Excel format for Pro, generated server-side via ExcelJS.
- `p2_security` cells starting with `=`, `+`, `-`, `@` are sanitized (tab-prefix) in CSV and XLSX so opening the file in Excel or Sheets cannot execute formula injection. This is the published behavior shipped on 2026-05-21 (TUB-23).

No fake sample CSV row in code blocks (would be invented data). Instead, link the README "How it works" section for the column list.

### 4.6 Section 06 — Limits and quotas

Source: README plans table all rows, README "Quota enforcement" sentence (line 75), README "Stack" Vercel KV + Supabase Postgres references.

Content shape:

- `p1` how quotas are tracked per tier.
- `ip_text` Anonymous: 1,000 comments per IP per video, monthly budget per IP via Vercel KV (Upstash Redis).
- `user_text` Free and Pro: per-user budget via Supabase Postgres, race-free via the `bump_usage` RPC. Resets monthly on calendar month boundary.
- `yt_text` shared YouTube Data API v3 quota (TubeMine uses its own daily quota; no user API key needed per README features bullet line 41).

No invented numbers about API daily quota size (the actual YouTube API daily limit is 10,000 units, but that is operational infrastructure, not user-facing — out of scope for this section).

### 4.7 Section 07 — Troubleshooting

Source: verbatim API error strings from the codebase:

- `src/app/api/preview/route.ts:39` — "Video not found" (HTTP 404)
- `src/app/api/extract/route.ts:203` — "Comments are disabled for this video by the uploader" (HTTP 403 with YouTube API reason `commentsDisabled`)
- `src/app/api/extract/route.ts:211` — "TubeMine has hit its YouTube API daily quota. Please try again tomorrow." (HTTP 403 with YouTube API reason `quotaExceeded`)
- `src/app/api/extract/route.ts:139` — "Monthly budget exhausted" (HTTP 429, signed-in user hit per-account cap)
- `messages/en.json` `extractor.errors.url_invalid_youtube` — "That does not look like a YouTube video URL"
- `messages/en.json` `extractor.errors.url_required` — "Paste a YouTube URL"

Content shape:

- `p1` what to do when extract or preview fails.
- `err1_q` "Video not found" — `err1_a` URL is wrong, video is private, or video was removed; try a public URL.
- `err2_q` "Comments are disabled for this video" — `err2_a` the uploader has disabled comments at the YouTube level; nothing TubeMine can do.
- `err3_q` "TubeMine has hit its YouTube API daily quota" — `err3_a` daily quota refresh happens at midnight Pacific Time per YouTube Data API. Try again then.
- `err4_q` "Monthly budget exhausted" — `err4_a` your account has hit the monthly cap (5,000 Free, 100,000 Pro). Quota resets on the 1st of the next calendar month, visible in `/profile`.
- `p_contact` link to `mailto:hello@tubemine.app` (existing `SUPPORT_EMAIL` constant pattern from privacy / terms pages).

Note: "midnight Pacific Time" is a documented YouTube Data API behavior, not a TubeMine claim. It is verifiable on the YouTube Data API public docs and matches the wording in our `extract/route.ts:211` user-facing message ("try again tomorrow"). If the brainstorm-Phase-2 review pushes back on quoting this specific time zone, we soften to "the quota resets daily on YouTube's schedule" — not a load-bearing detail.

### 4.8 Section 08 — Open source

Source: README Contributing + License sections (lines 162-173), GitHub repo URL `https://github.com/RakhimovY/tubemine` (already a constant on multiple pages).

Content shape:

- `p1` TubeMine is MIT-licensed open source. Fork, self-host, contribute.
- `link_github` GitHub repo link.
- `p2` how to contribute (fork → branch → PR), pointing at the README Contributing section.

## 5. Page outline — Changelog

File: `src/app/[locale]/changelog/page.tsx`

5 numbered sections, each representing one release date, newest first. Body is English-only. Chrome (hero, TOC, footer) is bilingual.

### 5.1 RU disclaimer banner

The existing `legal_disclaimer_ru_changelog` key in `messages/{en,ru}.json` already gates a yellow banner via the stub's `{locale === "ru" ? ... : null}` block. The new implementation keeps the banner, but moves it inside the `.legal-page` scope so it sits above the hero. Banner content (RU): "Журнал изменений ведётся на английском." (existing string, not changed).

In English locale the banner does not render.

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

#### 5.2.1 Release `01 — 2026-05-21`

Verifiable sources: TUB-8, TUB-11 hotfixes, TUB-12, TUB-13, TUB-16..27 (Linear Done). Commits `ee9fc16`, `7e172e0`, `f7f288e`, `4b3fbe5`, `fefeb02`, `55b0460`, `552e7cc`, `f5a89b3`, `ffe3ff2`, `2d21bc0`, `21091b7`, `59cd134`, `5eb799d`, `856dfce`, `ab2e3e8`, `c8d00d4`, `cdc17c3`, `ddcb2a6`, `5e7aac9`.

- Added: Inbound `support@tubemine.tech` email forwarding to inbox (TUB-8). Shared signed-in AppShell layout removes flicker between Dashboard, History, Profile (TUB-13 M23). Localized export bar, analytics, and extractor strings; loading skeletons across signed-in pages (TUB-13 M14, M19-M22, M24).
- Changed: GitHub README full refresh, primary URL migrated to `tubemine.tech` (TUB-12). Header swaps "Features" link for "Dashboard" when signed in (`ee9fc16`).
- Fixed: Pro sentiment label localized for Russian locale (TUB-21). Profile plan card no longer renders raw ICU `{cap, number}` placeholder (TUB-17). Dashboard cards now gap correctly (TUB-19) and breadcrumb updates per route (TUB-18). Recent Analyses and History rows now persist real video title, channel, and thumbnail instead of placeholders (TUB-20). Russian profile no longer doubles the word "использовано" (TUB-22). Extract and "Try another URL" buttons match the design system instead of low-contrast shadcn primitives (TUB-25). Dashboard quota info no longer renders three times for Pro users (TUB-26). Quick Analyze preview thumbnail respects 180px width cap via inline style (TUB-27).
- Security: CSV and XLSX exports sanitize formula-injection vectors (`=`, `+`, `-`, `@`, plus full-width Unicode variants) per OWASP guidance. Affects every export across Anonymous, Free, and Pro tiers (TUB-23, P0).

#### 5.2.2 Release `02 — 2026-05-20`

Verifiable sources: TUB-1 (visual port), TUB-11 (branding Phase 1), TUB-7 (FAQ refund / trial coexistence). Commits `534e15f`..`80b0a21`, `5e7aac9`.

- Added: Full v3 visual port of the landing, pricing, dashboard, profile, history, login, OAuth intro, privacy, and terms pages, replacing the minimal V1 chrome with the production design system (TUB-1, 9 pages). Branding: TubeMine logo, favicon, PWA icons, OpenGraph image (TUB-11 Phase 1).
- Changed: Pricing FAQ refund and 3-day trial wording clarified to avoid the "3-day trial plus 7-day refund" cognitive collision (TUB-7).
- Fixed: Privacy and Terms bullet text no longer wraps per-word (`9101ea5`). OAuth redirect now hard-pins to `NEXT_PUBLIC_ORIGIN` (`be79dd3`).

#### 5.2.3 Release `03 — 2026-05-19`

Verifiable sources: Phase H + Phase J git tags (`32423b5`, `f381746`, `860e277`, `73d68b3`, `030147d`, `6eacfe3`, `165b759`, `6f46952`). Pricing FAQ `a5` cancel-anytime detail.

- Added: 3-day free Pro trial (no card charged until day 4). Tier-aware Recent Analyses rows on the dashboard (qualitative label for Free, exact percentages for Pro). JSON and Excel exports for Pro. History retention bumped to 100 entries for Pro. Russian sentiment labels (positive / neutral / negative). Google OAuth profile metadata (email, name, avatar) copied into the profile record.
- Changed: Landing hero shows only for anonymous visitors; signed-in visitors land directly on the dashboard.

#### 5.2.4 Release `04 — 2026-05-17`

Verifiable sources: Phase 1.5 and Phase 2 git tags (`217b793`, `93644e0`). README roadmap line 156.

- Added: Sentiment analysis on every comment (positive, neutral, negative direction). Top words and emoji frequency rankings. CSV download for Anonymous and Free tiers with quota gating. Google OAuth sign-in. Pricing page with Free vs Pro comparison.

#### 5.2.5 Release `05 — 2026-05-15`

Verifiable sources: initial scaffold commits (`9e91f3a`, `7957565`, `2860ebb`, `1a182d9`, `6e47459`). README roadmap line 155.

- Added: First public release (Phase 0). YouTube URL preview shows title, channel, view, like, and comment counts. Anonymous comment analysis with monthly per-IP budget enforced via Vercel KV. CSV download client-side via Papa Parse. MIT license.

### 5.3 Trim policy

The changelog grows over time. For this sprint we ship 5 release sections. Future sprints add new entries at the top; trimming policy is out of scope for this sprint (no auto-archive, no separate `/changelog/archive` route).

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
docs.sections.troubleshoot.p_contact_prefix
docs.sections.troubleshoot.p_contact_tail

docs.sections.opensource.toc_label
docs.sections.opensource.title
docs.sections.opensource.p1_prefix
docs.sections.opensource.p1_link_github
docs.sections.opensource.p1_tail
docs.sections.opensource.p2
```

Total: 1 meta block + 1 hero block + 1 toc block + 8 sections, approximately 70 leaf keys.

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

These JSX comments do not render to the user, do not cost bytes after compile, and give any future editor a verifiable audit trail back to the primary source. They are mandatory for every section body in both pages.

## 9. Hard anti-fabrication contract

This sprint enforces the following non-negotiable rules. Any violation fails the spec / plan / commit review.

### 9.1 Em-dash and en-dash ban

The Unicode characters U+2014 (em-dash, `—`) and U+2013 (en-dash, `–`) appear zero times in:

- `src/app/[locale]/docs/page.tsx`
- `src/app/[locale]/changelog/page.tsx`
- the new `docs.*` and `changelog.*` keys in `messages/en.json` and `messages/ru.json`

Use `,` `.` `()` `:` `-` instead.

Verification gate before every commit: `grep -rnP '[\x{2014}\x{2013}]' src/app/\[locale\]/docs/ src/app/\[locale\]/changelog/ messages/{en,ru}.json` returns zero hits. The grep targets only the diff scope; pre-existing dashes in unrelated files are not touched.

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

Commit message draft: `docs(content): ship /docs page with 8 sections (TUB-30)`

Files touched:

- `src/app/[locale]/docs/page.tsx` (full rewrite, replaces the 19-line stub)
- `messages/en.json` (add `docs.*` keys)
- `messages/ru.json` (add `docs.*` keys, RU translations)

Verify-on-prod gate:

1. Wait Vercel production deploy READY (poll `mcp__vercel__list_deployments` for `projectId: prj_*` matching tubemine).
2. Navigate Chrome MCP to `https://tubemine.tech/en/docs` and `https://tubemine.tech/ru/docs`.
3. Assertions:
   - DOM contains visible H1 with `docs.hero.title` per locale.
   - DOM contains 8 numbered `<section>` blocks.
   - `Array.from(document.body.textContent).filter(c => c.charCodeAt(0) === 0x2014 || c.charCodeAt(0) === 0x2013).length === 0`.
   - No raw ICU `{token}` substrings in rendered text.
4. Screenshot desktop + mobile.

### 10.2 PR 2: Changelog page

Single commit on `main`. Only ships after PR 1's verify-on-prod gate passes.

Commit message draft: `docs(content): ship /changelog page with 5 release sections (TUB-30)`

Files touched:

- `src/app/[locale]/changelog/page.tsx` (full rewrite, replaces the 23-line stub)
- `messages/en.json` (add `changelog.*` chrome keys)
- `messages/ru.json` (add `changelog.*` chrome keys, RU translations; `legal_disclaimer_ru_changelog` already exists and is not modified)

Verify-on-prod gate: same protocol as PR 1, applied to `/en/changelog` and `/ru/changelog`. Extra assertions:

- RU page DOM contains the yellow disclaimer banner above the hero.
- EN page DOM does NOT contain the banner.
- All 5 release date headings render: 2026-05-21, 2026-05-20, 2026-05-19, 2026-05-17, 2026-05-15.
- Each release section contains at least one of: "Added" / "Changed" / "Fixed" / "Security" h3 heading.

### 10.3 Linear TUB-30 lifecycle

Created in Linear team Tubemine after spec is committed. Title: "Docs + Changelog content sprint". Description: link to this spec file path. Priority: 3 (Medium). State: In Progress immediately.

After both PRs are pushed and both verify-on-prod gates pass: move TUB-30 to Done with a comment listing the two commit SHAs and a one-line summary.

## 11. Acceptance criteria

The sprint is Done when ALL of the following are true:

1. PR 1 and PR 2 are both committed and pushed to `main`.
2. Both Vercel production deploys reach state READY.
3. `https://tubemine.tech/en/docs`, `/ru/docs`, `/en/changelog`, `/ru/changelog` all render without error.
4. JS DOM em-dash + en-dash count is 0 on all 4 URLs.
5. JS DOM raw ICU `{token}` count is 0 on all 4 URLs.
6. Footer "Docs" and "Changelog" links from any other page navigate correctly to the new pages (smoke test by clicking from `/en` landing and `/ru/pricing`).
7. Linear TUB-30 is in Done state with both commit SHAs listed in a comment.
8. `~/vault/daily/2026-05-21.md` has a session-end summary appended with: commit SHAs, verify-on-prod PASS/FAIL per URL, TC-CONTENT audit results, TUB-30 status, any claims that had to be omitted due to inability to verify, any deferred follow-ups.

## 12. Open questions deferred to Phase 2 review

None at draft time. The Phase 2 5x parallel review will surface any completeness, consistency, buildability, edge-case, or YAGNI issues. Reviewer perspectives are pre-defined by the turbo-pipeline contract; they are not re-decided here.

## 13. Hand-off

After this spec passes the 5x parallel review and `writing-plans` skill completes, the implementation phase begins. No new design decisions are made during plan-writing or implementation — any spec-level question that surfaces during plan-writing returns control here for an amendment.
