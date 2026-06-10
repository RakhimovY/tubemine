# Components

Per-component spec. Each entry says what HTML section to lift markup from,
what props the React component should expose, what states to support, and
what (if any) state management is needed.

For visual detail (exact spacing, radii, hover behavior), refer to the
matching HTML in `refs/` and the design system page at
`refs/design-system.html`.

---

## UI primitives (`src/components/ui/`)

These are shadcn base-nova primitives, restyled with our tokens. Each must
implement the **7 required states** demonstrated in `refs/design-system.html`:
**default, hover, focus-visible, active, disabled, loading, error.**

### `button.tsx`

Variants: `primary | secondary | ghost | destructive | icon`.
Sizes: `sm | md | lg`.

```tsx
type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;          // replaces label with spinner, sets aria-busy
  disabled?: boolean;
  asChild?: boolean;          // Radix/Base-UI Slot pattern for <a> children
  children: React.ReactNode;
};
```

Critical:
- Mobile `min-height: 44px`, desktop `min-height: 36px`.
- Loading state must set `aria-busy="true"` and disable pointer events.
- Destructive variant uses **rose-tinted focus ring**
  (`box-shadow: 0 0 0 3px rgba(251,113,133,0.25)`), not the white one.
- Icon variant requires `aria-label` (TS warn if missing).

### `input.tsx`

Variants: `default | with-icon-prefix`.

```tsx
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: string;            // renders `field-help is-error` below
  hint?: string;             // renders `field-help` below
  icon?: React.ReactNode;    // prefix icon slot
  loading?: boolean;         // trailing spinner inside input
};
```

Label must always be visible (`<Field><Label>...<Input/></Field>`). Never
use placeholder as the label.

### `card.tsx`

Variants: `default | raised | highlighted`.

```tsx
type CardProps = {
  variant?: 'default' | 'raised' | 'highlighted';
  interactive?: boolean;     // adds hover/active states, requires role+tabindex
  loading?: boolean;         // shimmer skeleton
  error?: boolean;           // rose border
};
```

### `badge.tsx`

Variants: `default | secondary | outline`. Non-interactive by default; if
clickable, switch to `<Button size="sm" variant="secondary" />`.

### `progress.tsx`

Variants: `primary | destructive`.

```tsx
type ProgressProps = {
  value?: number;            // 0-100; omit for indeterminate
  variant?: 'primary' | 'destructive';
  label?: string;            // left side of header
  pct?: string;              // right side of header
};
```

When `value` is undefined, render the indeterminate sliver animation.

### `accordion.tsx`

Use Base UI's `Accordion` primitive. **Single-open** for FAQ. Caret rotates
180° on open. Content height animates via `max-height: 0 → 360px` at
`duration-normal` (200ms).

### `toast.tsx`

Sonner-based via shadcn. Variants: `success | error | warning | info`.
Left-edge accent stripe + colored icon chip. Color never the only signal
(also icon + label). Auto-dismiss for `success`/`info` only.

---

## App-level chrome

### `site-header.tsx`

Sticky, backdrop-blurred public nav. Used on landing, pricing, privacy,
terms.

```tsx
type SiteHeaderProps = {
  activeRoute?: 'features' | 'pricing' | 'docs' | 'changelog';
  user?: { email: string; tier: 'free' | 'pro' } | null;
};
```

Right-side renders based on `user`:
- `null` → `[GitHub] [Sign in] [Get started]`
- Free/Pro → `[GitHub] [Dashboard] [Avatar]`

Adds `is-scrolled` class when `window.scrollY > 8` (client island).

### `site-footer.tsx`

4-column public footer: Product, Resources, Legal, Social. Plus brand block
on the left.

### `slim-footer.tsx`

3-link slim footer for login only: `© 2026 TubeMine` + Privacy + Terms +
Contact.

### `app-shell.tsx`

Authenticated app layout. Topbar + left sidebar + main content area.

```tsx
type AppShellProps = {
  user: { email: string; initials: string; tier: 'free' | 'pro' };
  activeNav: 'home' | 'history' | 'profile';
  crumb?: string;            // shown after the brand, e.g. "/ profile"
  children: React.ReactNode;
};
```

Includes mobile drawer behavior (hamburger toggles sidebar via class + scrim).

### `side-nav.tsx`

Left rail. Two grouped sections: **Workspace** (Home, History, Profile),
**More** (GitHub, Docs). `Sign out` sits at the bottom.

---

## Landing components

### `hero.tsx`

Centered hero. H1 + sub + dual CTA. Source: `refs/landing.html` section 1.

### `trust-row.tsx`

Mono-font strip below the hero. Now lists supported AI clients:
`Works in Claude · Codex · Cursor · ChatGPT · Gemini · Hermes · OpenClaw`.

### `live-demo.tsx`

The conversion-driver block. Pre-filled URL input + Analyze button. Results
are pre-revealed on page load.

```tsx
type LiveDemoProps = {
  initialUrl?: string;
  capped?: boolean;          // from ?demo=capped
};
```

State: `loading`, `result`. On submit:
1. Animate progress bars from 0 to their final width.
2. Show `<SentimentBar>`, `<TopWords>`, `<EmojiFrequency>`, comments table.

Cap-hit state swaps the result block for a `<CsvGate>`-style card with
"Sign up free for 5x more" → `/login`.

### `dashboard-preview.tsx`

The "trust accelerant" mockup in section 5 of landing. **Build with the same
primitives as the real dashboard.** Apply a 3D skew on desktop:

```css
transform: perspective(1800px) rotateY(-9deg) rotateX(4deg);
```

Mobile: no skew, flat. `prefers-reduced-motion`: no skew.

### `feature-block.tsx`

Alternating text-left + visual-right block, used 3x on landing.

```tsx
type FeatureBlockProps = {
  eyebrow: string;           // "01 · Sentiment"
  title: string;
  body: string;
  reverse?: boolean;         // visual on left
  children: React.ReactNode; // the visual (a widget mini-card)
};
```

### `faq-accordion.tsx`

Single-open accordion. First item open by default. Used on landing + pricing.

```tsx
type FaqAccordionProps = {
  items: { question: string; answer: React.ReactNode }[];
};
```

### `final-cta.tsx`

Closing CTA section. Big H2 + sub + single primary button. Used on landing
+ pricing.

---

## Pricing components

### `pricing-card.tsx`

```tsx
type PricingCardProps = {
  plan: 'free' | 'pro';
  user: { tier: 'free' | 'pro' } | null;
  // auth-aware CTA + price-note rendered internally
};
```

CTA matrix:
| Auth | Free card | Pro card |
|---|---|---|
| null (anon) | Start free → /login?intent=signup | Sign in to upgrade → /login?intent=signup&plan=pro |
| Free | Open dashboard → /dashboard | Upgrade to Pro → /api/checkout |
| Pro | Open dashboard → /dashboard | Manage subscription → /api/portal |

### `trust-line.tsx`

The literal `Trusted by 1 paying customer` line below the pricing grid. Do
not parametrize the number to avoid accidental inflation. Hardcode it,
update when it grows.

---

## Dashboard components

### `usage-card.tsx`

```tsx
type UsageCardProps = {
  tier: 'free' | 'pro';
  used: number;
  cap: number;               // 5000 for signed-in free, 100000 for pro, 1000 for anonymous
  resetDate: Date;
};
```

Renders two visual states automatically based on `used / cap`:
- `< 1.0` → primary progress, "X / cap used" header
- `>= 1.0` → destructive progress, rose-tinted card, inline error + upgrade
  CTA. **Only applicable for Free.** Pro can never hit the cap in this UI;
  if Pro ever does, treat as a backend bug and surface a generic error.

### `welcome-pulse.tsx`

```tsx
type WelcomePulseProps = {
  tier: 'free' | 'pro';
  onDismiss?: () => void;
};
```

Auto-dismisses after 5 seconds. Manual dismiss button. Animated pulse ring
on the icon (defined in globals.css as `@keyframes pulse-ring`).

Rendered only when `?welcome=true` is in the URL. Strip the param after
mount to prevent re-trigger on back-nav.

### `quick-analyze.tsx`

Same component family as `<LiveDemo>` but tied to the authenticated user's
quota. On submit:
- If `quotaUsed >= quotaCap`, render inline cap-hit error → `/pricing`.
- Otherwise POST to the existing analyze endpoint.

```tsx
type QuickAnalyzeProps = {
  defaultUrl?: string;
  capReached: boolean;
};
```

### `history-row.tsx`

One row in the recent analyses list.

```tsx
type HistoryRowProps = {
  analysis: {
    id: string;
    title: string;
    channel: string;
    timestamp: string;       // "2h ago"
    commentCount: number;
    sentimentSummary: { label: string; tone: 'pos' | 'neu' | 'neg' };
    csvUrl: string;          // /api/analysis/{id}.csv
  };
};
```

The CSV button label is **"Save CSV"**, not "Re-export CSV" or "Download CSV"
(brand voice rule).

### `empty-state.tsx`

Generic empty state. Used in dashboard recent-analyses when 0 items.

```tsx
type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  body: string;
  cta?: { label: string; href: string };
};
```

### `upgrade-card.tsx`

Free-tier-only card pinned at the bottom of dashboard + profile.

```tsx
type UpgradeCardProps = {
  variant?: 'dashboard' | 'profile';
};
```

CTA always points to `/api/checkout` (existing Polar endpoint).

### `manage-subscription-card.tsx`

Pro-tier-only card. CTA → `/api/portal`.

---

## Profile components

### `profile-section.tsx`

Two-column settings row wrapper.

```tsx
type ProfileSectionProps = {
  title: string;
  description: string;
  danger?: boolean;          // rose tint
  children: React.ReactNode; // the body card
};
```

### `account-fields.tsx`

Renders: avatar, email, joined date, account ID (with click-to-copy).

```tsx
type AccountFieldsProps = {
  user: {
    name: string;
    email: string;
    avatarInitials: string;
    joinedAt: Date;
    accountId: string;       // "user_933a72264c7eec62"
  };
};
```

Copy button uses `navigator.clipboard.writeText` with a textarea fallback
(see `refs/profile.html` for the fallback).

### `plan-card.tsx`

Renders inside the Plan section.

```tsx
type PlanCardProps = {
  tier: 'free' | 'pro';
  used: number;
  cap: number;
  renewsAt: Date | null;
  canceled: boolean;         // when true, replaces "renews" with "ends"
};
```

### `billing-card.tsx`

Renders inside the Billing section. **Only mount when `tier === 'pro'`.**
CTA → `/api/portal`.

### `danger-zone.tsx`

Two rows: Sign out (destructive button → `signOut()`), Delete account
(email-only, no in-product button in v3).

---

## CSV gate

### `csv-gate.tsx`

Anonymous-friendly: when an unauthenticated visitor finishes a landing demo
analysis and clicks save, they hit this gate.

```tsx
type CsvGateProps = {
  analysisId: string;
  onClose?: () => void;
};
```

Renders a dialog/sheet with:
1. Copy: "Sign in to save this analysis as CSV."
2. Google sign-in button (same component as login page).
3. Cancel link.

Implementation can also be inline (no modal) on small screens; refs use the
inline pattern under the comments table.

---

## Reusable upgrade

### `upgrade-button.tsx`

Single source of truth for Free → Pro upgrade buttons.

```tsx
type UpgradeButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  label?: string;            // default "Upgrade to Pro"
  fullWidth?: boolean;
};
```

Always points to `/api/checkout`. Centralizing this makes it easy to swap
out for Polar's React SDK component when we adopt it.

---

## Analytics widgets (preserve labels)

> **These widgets are now part of the shared result block** (`TubeMineRB`,
> `refs/result-block.js`). The tier-gating, counts, and copy in the README's
> "The result block" table are authoritative. The prop sketches below are the
> per-widget contracts; port them under `src/components/result-block/`. Labels
> are **Sentiment**, **Top words**, **Emoji** (note: "Emoji", not "Emoji
> Frequency").

These three widgets ship in v2 already. **Visual refresh only; preserve
data shape, API contracts, and labels.**

### `analytics/sentiment-bar.tsx`

Stacked horizontal bar (positive / neutral / negative). Tag: "β · Russian"
when the analyzed video's primary language is Russian (currently the only
non-English supported language, in experimental beta).

```tsx
type SentimentBarProps = {
  positive: number;          // 0..1
  neutral: number;           // 0..1
  negative: number;          // 0..1
  experimental?: boolean;    // shows β tag
  language?: string;
};
```

### `analytics/top-words.tsx`

Horizontal bar list, top N words (default 8). Each row: word, animated bar,
count.

```tsx
type TopWordsProps = {
  items: { word: string; count: number }[];
  max?: number;              // default 8
};
```

### `analytics/emoji-frequency.tsx`

Grid of top 10 emoji with percent share.

```tsx
type EmojiFrequencyProps = {
  items: { emoji: string; pct: number }[]; // pct in 0..100
};
```

---

## URL params consumed by the prototype

These are documented for completeness. In production, only `?welcome=true` is
emitted (by `/api/checkout`'s return URL). The rest exist only in the design
preview.

| Param | Page | Effect |
|---|---|---|
| `?welcome=true` | `/dashboard` | Show welcome pulse, set tier=pro |
| `?tier=pro \| free` | `/dashboard`, `/profile` | Force tier visual state |
| `?quota=capped` | `/dashboard` | Force cap-hit usage card |
| `?recent=empty` | `/dashboard` | Empty recent analyses |
| `?canceled=true` | `/profile` | Show cancellation toast + "ends Jun 18" |
| `?demo=capped` | `/` | Swap live demo for anonymous cap-hit card |
| `?intent=signup` | `/login` | Currently informational, same UI |

The new pages add `data-*` attributes on `<body>` (not query params) for the
design preview: `data-mcp="connected|none"` (MCP page), `data-onboarding`,
`data-trial`, `data-recent`, `data-quota`, plus the locale switcher state.
These are review-only toggles, drive them from real app state in production.

The dev should keep the production set minimal (just `?welcome=true`) and
delete the design preview panel before shipping.

---

## New components (v3 MCP + i18n + result-block pass)

### `result-block/*` (port of `TubeMineRB`)

The shared module in `refs/result-block.js`. Port to React, **preserve the
tier-gating, counts, and copy exactly** (see README "The result block").

```tsx
type Tier = 'anon' | 'free' | 'pro';

type ResultBlockProps = {
  tier: Tier;
  data: AnalysisData;          // video, sentiment, words[], emoji[], comments[]
  ruHeavy?: boolean;           // shows the β RU experimental pill on Sentiment
  signInHref?: string;
  upgradeHref?: string;
};
```

- `ResultBlock` = header (`<b>N</b> comments analyzed` + title + channel +
  Save buttons) over the 3-widget row over `CommentsTable`.
- `SentimentWidget`, `TopWordsWidget`, `EmojiWidget` each render their
  anon/free/pro variant internally. Pro Top words is **collapsible**
  ("Show all (1,284)" ↔ "Hide", caret rotates 180deg).
- `CommentsTable` has populated + empty states (empty = "No comments to
  analyze", comments off / none posted).
- `ResultSkeleton` = the loading state (`renderLoading`).
- A showcase variant (no gating CTAs) renders a single widget for landing
  feature blocks (`renderWidget`).

Save buttons by tier: anon "Save CSV" (gated → sign in), free "Save CSV",
pro "Save CSV" + "Save JSON" + "Save Excel".

### `mcp/mcp-docs.tsx`

Numbered-section setup guide, shared by the public `/mcp` route and the
in-app settings route. Sections: What is TubeMine MCP, per-client setup
client setup (Claude Code, ChatGPT Developer Mode, Cursor, Codex, Gemini CLI,
Claude Desktop, Hermes, OpenClaw), Authentication, Usage and limits,
Troubleshooting. Uses the same `LegalPage` TOC layout as privacy/terms.

### `mcp/connect-card.tsx`

Per-client tile linking into the relevant setup section / OAuth authorize.

### `mcp/codeblock.tsx`

```tsx
type CodeblockProps = {
  label: string;               // "terminal", "server url", "claude_desktop_config.json"
  code: string;                // raw text used for the copy button (data-copy)
  children: React.ReactNode;   // syntax-highlighted markup (tok-cmd/flag/key/str)
};
```

Copy button writes `code` to clipboard. Server URL is always
`https://tubemine.tech/api/mcp`.

### `mcp/api-key-card.tsx`

Masked key + reveal toggle + copy + rotate. Subtitle "for clients without
OAuth". Confirm rotate/revoke endpoints with backend.

### `mcp/connected-clients.tsx`

```tsx
type ConnectedClient = {
  client: string;
  auth: 'oauth' | 'key';
  connectedAt: string;         // "Jun 6, 2026"
  lastUsed: string;            // "3 min ago"
};

type ConnectedClientsProps = { clients: ConnectedClient[] };
```

Table columns: Client / Auth method (`OAuth` or `API key` tag) / Connected /
Last used / Revoke. Stacks into labelled blocks on mobile (`data-label`).
Empty state ("No AI clients connected yet.") when `clients.length === 0`.
Driven in the refs by `data-mcp="connected" | "none"`.

### `mcp/status-pill.tsx`

`connected` (success dot) vs `not connected` (tertiary dot).

### `history/history-filter-bar.tsx`

Search input + filter controls above the history list.

### `history/analysis-detail.tsx`

In-page saved-analysis view that keeps the topbar + sidebar and mounts
`ResultBlock` at the user's tier. Confirm whether this becomes a real
`/history/[id]` route.

### `oauth-consent.tsx`

"One quick step before Google" interstitial. Explains read-only YouTube
access uses the user's **own** Google quota (10,000 calls/day, free). In the
refs the continue button is **disabled** with a "coming soon" banner.

```tsx
type OAuthConsentProps = { continueEnabled?: boolean };
```

### `coming-soon.tsx`

Stub layout for docs + changelog: badge + big title + one line of copy.

```tsx
type ComingSoonProps = { badge: string; title: string; body: React.ReactNode };
```

### `locale-switcher.tsx`

EN / RU `listbox` (trigger shows current code, menu lists code + label +
check). Wire to the app i18n layer.

```tsx
type LocaleSwitcherProps = {
  locale: 'en' | 'ru';
  onChange: (l: 'en' | 'ru') => void;
};
```

### `button.tsx` (variant added)

The result block uses an **`outline`** button variant (Save JSON / Save Excel
for Pro) in addition to the five listed earlier. Add `outline` to the union.
