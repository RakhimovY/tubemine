# Handoff: TubeMine v3 UX redesign

## Overview

A complete v3 UX redesign for **TubeMine**, a YouTube comment analytics SaaS.
Dark-only theme, mobile-first (75% of traffic is mobile), monochrome design
system with two scoped accent colors for the Sentiment widget and a small
semantic palette for success / danger / warning.

This bundle covers the **full public + signed-in product surface**, plus the
two new surfaces added since the previous handoff:

- **Marketing site**: landing, pricing, privacy, terms, plus "coming soon"
  stubs for docs and changelog
- **Auth**: login (Google OAuth only) and a new OAuth consent interstitial
- **Signed-in app**: dashboard, history, profile
- **MCP (new in this pass)**: a public "MCP setup" docs page and an in-app
  "AI Assistant access" settings screen (API keys + connected clients)
- **Shared analysis result block (rebuilt)**: one JS module renders the
  Sentiment / Top words / Emoji widgets + comments table across landing,
  dashboard, and history, gated by tier
- **Internationalization (new)**: EN / RU locale switcher in the chrome

Plus the design system reference and a clickable prototype index (Flows).

## About the design files

Everything inside `refs/` is a **design reference**: standalone HTML/CSS/JS
files that show the intended look, structure, and interaction model. They are
**not production code to copy directly.**

The task is to **recreate these designs inside the existing Next.js codebase**
using its established stack (Tailwind v4, shadcn base-nova on Base UI
primitives, Supabase Auth, Polar SDK), not to ship the HTML.

The HTML files do contain real CSS variables, real component markup, and real
JS interactions. Use them as the source of truth for **colors, spacing, type,
component states, and copy**. Translate visual structure into Tailwind utility
classes and React components.

**Note on filenames + links.** The refs keep their original
`TubeMine <Page>.html` filenames so that every inter-page link inside the
bundle resolves when you open them locally. Open `refs/TubeMine Flows.html`
first; it links out to every other page.

**Shared module.** `refs/result-block.css` and `refs/result-block.js` are a
real shared module (`window.TubeMineRB`), not a per-page mockup. Landing,
dashboard, and history all mount it. See "The result block" below.

## Fidelity

**High-fidelity.** Pixel-perfect mockups with final colors, typography,
spacing, shadows, motion, and interactions. Recreate the UI pixel-perfectly
using the codebase's existing libraries and patterns.

## Stack constraints (do not change)

- **Next.js** App Router
- **Tailwind v4** (token-driven via `@theme`)
- **shadcn base-nova** preset on **Base UI** primitives
- **Supabase Auth** (already wired, do not re-implement)
- **Polar SDK** for checkout + customer portal (already wired)
- **Vercel Analytics** (the only allowed analytics in the codebase)
- TypeScript strict, server components by default, client components only where needed

This bundle ships **UI shells only**. No backend logic, no database queries,
no API routes. Existing `/api/checkout`, `/api/portal`, `/api/auth/google`,
`/api/analysis/*.csv`, and the new `/api/mcp` endpoints stay wired as they are.

## Domains

- App + marketing: **tubemine.vercel.app** (footer shows `v3.0 · tubemine.vercel.app`)
- MCP server endpoint: **`https://tubemine.tech/api/mcp`** (used verbatim in
  every setup snippet, do not rewrite to the vercel domain)
- Repo: **`https://github.com/RakhimovY/tubemine`** (MIT). All GitHub /
  Changelog / License links point here.
- Support: **hello@tubemine.app** (one human reads every message)

## Voice and copy rules (binding across all UI)

These are brand rules. Apply to every component, page, label, toast, and helper.

- **Never** use the verbs `extract`, `download`, or `scrape` in product or
  marketing copy. Use **analyze**, **understand**, **see**, and **save**
  instead. The CSV button is always **"Save CSV"** (also "Save JSON", "Save
  Excel" for Pro).
- **Never** use em-dashes (`—`) or en-dashes (`–`) in any rendered text. Use
  commas, periods, parentheses, colons, or plain hyphens.
- The product is **TubeMine**, not affiliated with YouTube or Google. Footer
  carries this disclaimer.
- Analytics widget labels are **Sentiment**, **Top words**, and **Emoji**.
  Preserve these exact labels (visual refresh only).
- MCP tool names are fixed (see below); do not rename them in copy.

## File to route mapping

Each design reference maps to one App Router route (or is a dev-facing doc).

| Design ref | Target route file | Status |
|---|---|---|
| `TubeMine Landing.html` | `src/app/page.tsx` | refresh existing |
| `TubeMine Pricing.html` | `src/app/pricing/page.tsx` | refresh existing |
| `TubeMine Privacy.html` | `src/app/privacy/page.tsx` | existing |
| `TubeMine Terms.html` | `src/app/terms/page.tsx` | existing |
| `TubeMine Docs.html` | `src/app/docs/page.tsx` | **new stub** ("coming soon") |
| `TubeMine Changelog.html` | `src/app/changelog/page.tsx` | **new stub** ("coming soon") |
| `TubeMine Login.html` | `src/app/login/page.tsx` | refresh existing |
| `TubeMine OAuth Intro.html` | `src/app/login/consent/page.tsx` | **new** consent interstitial |
| `TubeMine Dashboard.html` | `src/app/dashboard/page.tsx` | refresh existing |
| `TubeMine History.html` | `src/app/history/page.tsx` | **new route** |
| `TubeMine Profile.html` | `src/app/profile/page.tsx` | existing |
| `TubeMine MCP Docs.html` | `src/app/mcp/page.tsx` | **new** public MCP docs |
| `TubeMine MCP.html` | `src/app/dashboard/mcp/page.tsx` | **new** in-app MCP settings |
| `TubeMine Result Block.html` | (reference only, no route) | the shared widget module |
| `TubeMine Design System.html` | (reference only, no route) | dev-facing doc |
| `TubeMine Flows.html` | (reference only, no route) | clickable prototype index |

> **MCP, two files, one shared header.** `TubeMine MCP Docs.html` is the
> **public** setup guide (anonymous-readable). `TubeMine MCP.html` is the
> **signed-in** settings screen (API key + connected clients) and also embeds
> the same setup sections for convenience. They share the numbered-section
> docs layout used by privacy/terms. Build the docs body once as a shared
> component and render it on both routes.

## The result block (shared module)

`refs/result-block.js` exposes `window.TubeMineRB` with four renderers. In
production this becomes a set of React components, but the **gating logic,
tier counts, and copy must match exactly**.

```ts
TubeMineRB.renderResult(mountEl, tier, data?, opts?)  // full block
TubeMineRB.renderEmpty(mountEl, data?)                // comments disabled / none
TubeMineRB.renderLoading(mountEl)                     // skeleton
TubeMineRB.renderWidget(mountEl, kind, data?, opts?)  // single widget, no CTAs (marketing)
// tier: 'anon' | 'free' | 'pro'
```

The full block = a **header** (`<b>N</b> comments analyzed` + video title +
channel, plus the Save buttons) over a 3-widget row over the comments table.

**Tier gating (must match):**

| Widget | anon | free | pro |
|---|---|---|---|
| **Sentiment** | locked, "Sign in to see the sentiment breakdown" | bar + summary label, CTA: "Upgrade for exact counts & per-segment %" | bar with inline %, full legend with exact counts, coverage footnote |
| **Top words** | top 5, CTA "Sign in for N more words" | top 15, CTA "Upgrade for N more words" | top 18, collapsible "Show all (1,284)" |
| **Emoji** | top 5, CTA "Sign in for N more" | top 15, CTA "Upgrade for N more" | all shown |
| **Save** | "Save CSV" → sign in | "Save CSV" | "Save CSV" + "Save JSON" + "Save Excel" |

- `opts.ruHeavy` adds a `β RU experimental` pill on the Sentiment widget
  (Russian-language detection, experimental beta).
- `renderWidget` is the showcase mode used in landing feature blocks: a single
  product-styled widget card with **no** gating CTAs.
- Default mock data is the "@PixelForge" editing-workflow video (19,422
  comments). Replace with real analysis data; keep the field shapes.

## MCP, API keys, and connected clients (new)

The in-app MCP screen (`TubeMine MCP.html`) is driven by `data-mcp` on
`<body>`:

| `data-mcp` | Renders |
|---|---|
| `connected` | "Connected" status pill + the connected-clients table |
| `none` | "Not connected" pill + empty state ("No AI clients connected yet.") |

Surfaces on that page:
- **Connect cards** for each supported client, split into **OAuth** (one-click:
  Claude Code, ChatGPT, Cursor) and **API key** (Codex, Gemini CLI, Claude
  Desktop, Hermes, OpenClaw).
- **Your API key** card: masked key, reveal, copy, and rotate. "for clients
  without OAuth".
- **Connected clients** table: columns Client / Auth method (`OAuth` or
  `API key`) / Connected / Last used / Revoke. Stacks into labelled blocks on
  mobile. Empty state when none.

The two MCP **tools** exposed by the server (preserve names):
`analyze_youtube_comments` and a second lookup tool. The server URL is always
`https://tubemine.tech/api/mcp`, auth via `Authorization: Bearer YOUR_KEY` or
OAuth where the client supports it. MCP calls **count toward the same monthly
quota** as the web app.

## Internationalization (new)

A locale switcher (`[data-locale-switcher]`) appears in the chrome with **EN**
and **RU** (Русский). It is a `listbox` (trigger + menu, `aria-selected`).
Wire it to the app's i18n layer; the design ships EN copy with RU as the
second supported locale. The Sentiment widget's `β RU experimental` pill is a
separate, content-detection feature, not the UI locale.

## Component inventory

Drop these into `src/components/`. See [`components.md`](./components.md) for
per-component props, states, and which HTML section to copy markup from.

```
src/components/
├── site-header.tsx              ← sticky public nav (anon + signed-in variants)
├── site-footer.tsx              ← 4-column public footer
├── slim-footer.tsx              ← login / consent slim variant
├── brand-mark.tsx               ← logo (square + play triangle)
├── locale-switcher.tsx          ← EN / RU listbox (new)
│
├── hero.tsx                     ← landing hero (now "Connect your AI" MCP-forward CTA)
├── trust-row.tsx                ← landing trust strip
├── live-demo.tsx                ← landing interactive demo (mounts TubeMineRB)
├── dashboard-preview.tsx        ← landing 3D-skewed dashboard mockup
├── feature-block.tsx            ← landing alternating text + widget showcase
├── faq-accordion.tsx            ← landing + pricing FAQ (single-open)
├── final-cta.tsx                ← landing + pricing closing CTA
│
├── pricing-card.tsx             ← Free + Pro card (auth-aware CTAs)
├── trust-line.tsx               ← pricing "1 paying customer" line
│
├── app-shell.tsx                ← dashboard + history + profile + mcp shell
├── side-nav.tsx                 ← left rail (Workspace + More groups)
├── usage-card.tsx               ← quota meter (ok + cap-hit states)
├── welcome-pulse.tsx            ← dashboard ?welcome=true card (Pro)
├── quick-analyze.tsx            ← dashboard URL + Analyze + results (TubeMineRB)
├── upgrade-card.tsx             ← Free → Pro CTA
├── manage-subscription-card.tsx ← Pro → Polar portal
│
├── history/
│   ├── history-filter-bar.tsx   ← search + filters (new)
│   ├── history-row.tsx          ← saved-analysis row (Save CSV)
│   ├── analysis-detail.tsx      ← in-page saved-analysis view (mounts TubeMineRB)
│   └── empty-state.tsx          ← history + dashboard empty variants
│
├── profile-section.tsx          ← two-column settings row wrapper
├── account-fields.tsx           ← avatar + email + joined + id (copy)
├── plan-card.tsx                ← plan section (Free + Pro variants)
├── billing-card.tsx             ← billing section (Pro only)
├── danger-zone.tsx              ← sign-out + delete-by-email
│
├── mcp/
│   ├── mcp-docs.tsx             ← numbered setup sections (shared, both routes)
│   ├── connect-card.tsx         ← per-client connect tile
│   ├── codeblock.tsx            ← labelled code box with copy button + tokens
│   ├── api-key-card.tsx         ← masked key, reveal, copy, rotate
│   ├── connected-clients.tsx    ← table + revoke + empty state
│   └── status-pill.tsx          ← connected / not-connected pill
│
├── oauth-consent.tsx            ← "One quick step before Google" interstitial
├── coming-soon.tsx              ← docs + changelog stub layout
├── legal-page.tsx               ← privacy + terms + MCP docs shared layout
├── upgrade-button.tsx           ← reusable Pro upgrade CTA → /api/checkout
│
├── result-block/                ← port of TubeMineRB (preserve gating + copy)
│   ├── result-block.tsx         ← header + widgets + comments table
│   ├── sentiment-widget.tsx     ← 3 tier variants + β RU pill
│   ├── top-words-widget.tsx     ← 3 tier variants, pro collapsible
│   ├── emoji-widget.tsx         ← 3 tier variants
│   ├── comments-table.tsx       ← populated + empty
│   └── result-skeleton.tsx      ← loading state
│
└── ui/                          ← shadcn base-nova primitives, restyled
    ├── button.tsx               ← primary, secondary, outline, ghost, destructive, icon
    ├── input.tsx                ← default + icon-prefix + error
    ├── badge.tsx                ← default + secondary + outline
    ├── card.tsx                 ← default + raised + highlighted
    ├── progress.tsx             ← primary + destructive
    ├── accordion.tsx            ← single-open, animated max-height
    └── toast.tsx                ← success + error + warning + info
```

## Tokens (drop into `src/app/globals.css`)

The full tokens block is ready to paste in [`globals.css`](./globals.css).
Same values documented in [`tokens.md`](./tokens.md). The monochrome system is
unchanged from the previous handoff (black base, near-white text, two scoped
sentiment accents, three semantic feedback colors).

For Tailwind v4, expose tokens through `@theme`:

```css
@theme {
  --color-surface-base: #000000;
  --color-surface-raised: #0f0f11;
  --color-text-primary: #f5f5f7;
  --color-text-secondary: #b9b9c0;
  /* ... full list in globals.css ... */
}
```

## Auth + tier + connection state

These flags drive most state in the UI:

| State | Source | Affects |
|---|---|---|
| `isSignedIn` | Supabase Auth session | Nav, CSV gates, MCP visibility |
| `tier: 'free' \| 'pro'` | DB record from Polar webhook | Result-block gating, quota cap, upgrade vs manage card |
| `subscriptionCanceled` | Polar webhook → DB | Profile plan card ("ends" vs "renews") |
| `quotaUsed`, `quotaCap` | DB | Usage card progress + cap-hit logic |
| `welcomeParam` | URL `?welcome=true` after checkout | Welcome pulse on dashboard |
| `mcpConnected` | DB (any active client/key) | MCP status pill + table vs empty |
| `locale: 'en' \| 'ru'` | i18n / cookie | Locale switcher selection, copy |

Each prototype page has a **"Design preview"** panel (bottom-right) exposing
these as toggles (User, Tier, Connection, Welcome, Quota, History,
Subscription, etc.) so reviewers can see every state without real data.
**Do not ship the design preview panel to production.** It exists only in the
HTML refs and is controlled by `data-*` attributes on `<body>`.

## Per-page implementation notes

### `src/app/page.tsx` (landing)

- Server component for SEO; client islands for the live demo and FAQ.
- The hero is now **MCP-forward**: primary CTA "Connect your AI" → `/mcp`,
  with a terminal-style mock showing `claude mcp add TubeMine`. Keep the
  "no MCP setup required, open the web app" secondary path to `/dashboard`.
- Live demo and feature-block widgets mount `TubeMineRB` (demo = `anon` tier;
  feature blocks use `renderWidget` showcase mode).
- `?demo=capped` swaps the demo into its cap-hit state.

### `src/app/dashboard/page.tsx`

- Server component reads session + tier + quota.
- `?welcome=true` triggers the welcome pulse (auto-dismiss 5s, client).
- Quick analyze mounts `TubeMineRB.renderLoading` then `renderResult` at the
  user's tier. Cap hit → inline error → `/pricing`.
- Recent analyses use history rows; `<EmptyState>` when empty.

### `src/app/history/page.tsx` (new)

- Header shows one of three sublines: populated ("42 analyses saved, oldest
  May 14, 2026"), empty ("Your saved analyses will appear here"), or loading.
- Filter bar (search + filters) above the list.
- Clicking a row opens the **in-page analysis detail** (keeps topbar +
  sidebar) which mounts `TubeMineRB.renderResult` at the user's tier.

### `src/app/profile/page.tsx`

- Account ID copy button is a client island.
- `?canceled=true` triggers a toast; plan card swaps "renews" for "ends".
- Billing section is Pro-only. Danger zone uses Supabase signOut.

### `src/app/pricing/page.tsx`

- Auth-aware CTAs (anon / free / pro matrix in `components.md`).
- Keep the literal "Trusted by 1 paying customer" line. Do not inflate.

### `src/app/mcp/page.tsx` (public docs) + `src/app/dashboard/mcp/page.tsx` (settings)

- Shared `<McpDocs>` numbered-section body on both. Setup sections cover all
  eight clients: Claude Code, ChatGPT (Developer Mode), Cursor, Codex,
  Gemini CLI, Claude Desktop, Hermes, OpenClaw.
- Settings route adds the API-key card + connected-clients table (auth
  required) above the docs.
- Every code snippet uses `https://tubemine.tech/api/mcp` and a copy button.
- Troubleshooting + "email hello@tubemine.app" close the docs.

### `src/app/login/page.tsx` + `src/app/login/consent/page.tsx`

- Login: single Google OAuth button → existing auth route, slim footer.
- Consent ("One quick step before Google"): explains read-only YouTube access
  uses the user's **own** Google quota (10,000 calls/day, free). In the refs
  the continue button is **disabled with a "coming soon" banner**, confirm
  whether to enable it this pass.

### `src/app/docs/page.tsx` + `src/app/changelog/page.tsx`

- Both are `<ComingSoon>` stubs (badge + title + one line). Changelog points
  to the GitHub repo's release log until v3 ships.

## Interactions and motion

```ts
const ease = 'cubic-bezier(0.2, 0, 0, 1)';
const duration = { instant: '140ms', fast: '150ms', normal: '200ms' };
```

Respect `prefers-reduced-motion` (the refs disable transforms + animations
under it, including the landing dashboard skew).

## Accessibility floor (WCAG 2.2 AA)

- Interactive elements ≥ 44px touch target on mobile.
- Visible `:focus-visible` ring on every interactive element.
- Icon-only buttons carry `aria-label`.
- Status changes use `aria-live="polite"` / `role="status"`; errors
  `role="alert"`.
- Color is never the only carrier of meaning (sentiment, danger, warning all
  pair color + icon + label).

## Files in this bundle

- `README.md` — this file
- `tokens.md` — every design token with hex/px/ms values
- `globals.css` — drop-in CSS for `src/app/globals.css` (Tailwind v4 `@theme`)
- `components.md` — per-component spec sheet
- `refs/` — design references (open `TubeMine Flows.html` first):
  - Marketing: `TubeMine Landing.html`, `TubeMine Pricing.html`,
    `TubeMine Privacy.html`, `TubeMine Terms.html`,
    `TubeMine Docs.html`, `TubeMine Changelog.html`
  - Auth: `TubeMine Login.html`, `TubeMine OAuth Intro.html`
  - App: `TubeMine Dashboard.html`, `TubeMine History.html`,
    `TubeMine Profile.html`
  - MCP: `TubeMine MCP Docs.html`, `TubeMine MCP.html`
  - Shared: `TubeMine Result Block.html`, `result-block.css`, `result-block.js`
  - Dev docs: `TubeMine Design System.html`, `TubeMine Flows.html`
- `screenshots/` — desktop + mobile renders of each page and key states

## Open questions for the dev pass

1. **Sentiment β RU pill**: driven by detected language (only shows on
   Russian-heavy videos)? The refs gate it on `opts.ruHeavy`.
2. **History route**: confirm the saved-analysis detail is an in-page view
   (as designed) vs a dedicated `/history/[id]` route.
3. **OAuth consent**: the continue button is disabled ("coming soon") in the
   refs. Ship it enabled this pass, or keep the interstitial informational?
4. **MCP tools**: confirm the exact two tool names and the second tool's
   contract before wiring copy that references them.
5. **API key card**: confirm rotate/revoke endpoints and key masking format.
6. **Login OAuth start**: the refs reference `/api/auth/google`; confirm this
   matches the real Supabase `signInWithOAuth` flow and adapt as needed.
7. **i18n scope**: is RU shipping this pass, or is the switcher staged for a
   later locale rollout?

---

Designed by the v3 design pass. One human reads every message at
hello@tubemine.app.
