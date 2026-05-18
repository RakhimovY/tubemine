# TubeMine UX Redesign v3, PRD for Claude Design Handoff

> **AI brief.** You are Claude Design. Generate a complete design system, page mockups, interactive prototypes, and a handoff bundle for Claude Code. Apply DESIGN.md tokens (already attached). Match the structural inspiration of leadline.dev (dark-only, real dashboard shown on landing, calm tech tone) but with TubeMine brand and content. Mobile-first because 75% of current traffic is mobile.

---

## 0. Product reality, one paragraph

TubeMine is a hosted SaaS for understanding the audience under any YouTube video. Paste a URL, get sentiment, top words, emoji frequency, and a CSV. Public OSS MIT, live at https://tubemine.vercel.app, currently 1 paying customer at $19/mo, 90 visitors over 7 days, 75% mobile. Phase 0 to 2 shipped. Next milestone: redesign that signals trust as much as Leadline does. Stack stays: Next.js 16, Tailwind v4, shadcn base-nova on Base UI primitives, Supabase Auth, Polar billing.

---

## 1. Existing features to preserve (do not redesign away)

These work today and must stay functional in the new design:

1. **Paste URL → preview → extract** flow on the landing page (anonymous-friendly, no signup required to try)
2. **Three analytics widgets** rendered on extract success:
   - Sentiment (positive / neutral / negative stacked bar, EN + RU lexicon-based, "Experimental for Russian" tag when RU share is high)
   - Top Words (frequency-based horizontal bars, multi-language stopwords stripped)
   - Emoji Frequency (top 10 with percent share, ZWJ-aware)
3. **Results table** of comments (author, text, sentiment, likes, replies, when), sortable
4. **CSV export** gated behind sign-in (anonymous sees "Sign in to export CSV" CTA, signed-in users get the download button)
5. **Google OAuth sign-in** via Supabase Auth (single button, no magic-link)
6. **Quota system** (anonymous: 1,000 comments/month per IP, free auth: 5,000/month, Pro: 100,000/month)
7. **Polar subscription** ($19/mo Pro), with customer portal for self-service cancel
8. **Vercel Analytics events** fire on: `paste_attempted`, `preview_loaded`, `extract_completed`, `extract_failed`, `csv_downloaded`

Internal API routes (already shipped, do not change shape, only the UI around them):
- `POST /api/preview` → video metadata
- `POST /api/extract` → comments + sentiment
- `GET /api/extract` → current quota status
- `POST /api/checkout` → Polar checkout URL (returns `{ url }`)
- `GET /api/portal` → 307 redirect to Polar customer portal
- `POST /api/polar/webhook` → handler (Polar fires here, no UI)
- `GET /auth/callback` → Supabase OAuth callback
- `GET /logout` → sign out

---

## 2. Brand and design direction

### Inspiration

leadline.dev sets the bar. Specifically these patterns:

- Single full-bleed dark hero, one H1 plus one sub, one CTA, nothing else
- Trust badge under the hero ("Trusted by 600+ founders" equivalent for us → "Built on the official YouTube Data API v3" until we have user-count credibility)
- A **real product screenshot** shown ~50% of the page width, slightly skewed in 3D, as the third section. This is the trust accelerant
- Feature blocks alternate text-left / visual-right, then text-right / visual-left
- Small inline cards in feature blocks ("Set priority" / "Change status" two-card pattern from the Leadline screenshot the user shared) demonstrate the actual interaction
- Pricing block at the bottom, two cards, "Most popular" badge on the paid one
- FAQ accordion immediately under pricing
- Final hero-repeat CTA before the footer
- Footer with four columns + horizontal rule + copyright row

### Tokens

Use the attached DESIGN.md verbatim. Specifically:

- `color.surface.base=#000000` (page background)
- `color.surface.raised=#0f0f11` (cards)
- `color.text.primary=#f5f5f7`
- `color.text.secondary=#b9b9c0`
- Font: SF Pro Display stack with Inter fallback
- Type scale 12 / 13 / 14 / 15 / 16 / 17 / 18 / 21 px
- Radii: 6 / 8 / 14 / 9999
- Motion: 140 / 150 / 200 ms

**Brand differentiator from Leadline:** add a single warm accent for our two analytics highlights:
- Sentiment positive: muted emerald (~#34d399 at 80% opacity)
- Sentiment negative: muted rose (~#fb7185 at 80% opacity)
- Sentiment neutral: `color.text.secondary`
- Top words bars: graphite gradient (no color, weight signals via length only)
- Emoji bars: same

No other colors. The product is monochrome with two accent colors only on the sentiment widget. Discipline matters.

### Voice and copy rules (Polar TOS)

The word **extract** is reserved for internal code and feature descriptions, never the hero or the primary CTA. Landing primary verbs:

- ✅ "Analyze", "Understand", "See", "Explore"
- ❌ "Extract", "Download", "Pull", "Scrape", "Bulk export", "Archive"

Reason: Polar auto-rejects products framed as content downloaders. Reference: `references/polar-use-case-rejection-rework.md` in our vault.

Tone: technical but warm. Like a senior IC explaining to a junior. No "revolutionary", "game-changing", "amazing".

---

## 3. Information architecture

### Public routes

| Route | Auth | Purpose |
|---|---|---|
| `/` | Public | Landing v3 (marketing + live demo embedded) |
| `/pricing` | Public, auth-aware CTAs | Pricing page with FAQ |
| `/privacy` | Public | Privacy Policy (new, needs template) |
| `/terms` | Public | Terms of Service (new, needs template) |
| `/login` | Public | Google OAuth single button |

### Auth routes

| Route | Auth | Purpose |
|---|---|---|
| `/dashboard` | Required | Plan, usage, quick extract, recent history, manage subscription |
| `/profile` | Required, new | Account settings, billing, sign out |

### Existing redirects to keep

- After OAuth signin → `/dashboard?welcome=true`
- After Polar checkout success → `/dashboard?welcome=true`
- Cancel checkout → `/pricing`
- Unauthenticated `/dashboard` → `/login?redirect=/dashboard`

---

## 4. Page specs

### 4.1 Landing (`/`)

Order of sections, top to bottom:

1. **Top nav (sticky):** Logo + "TubeMine" wordmark / nav links (Pricing, Docs placeholder, GitHub) / right side: "Sign in" (anon) OR avatar dropdown (auth)
2. **Hero:** H1 "Understand any YouTube video's audience." Sub: "Sentiment, top words, and the emojis your audience leans on, in seconds. Free up to 1,000 comments per month." Single CTA: "Analyze a video" (scrolls to live demo block, no auth required)
3. **Trust badge row:** small monospace text "Built on the official YouTube Data API v3" + "Free 1,000 comments/month, no signup" + GitHub stars count
4. **Live demo block:** the actual `<TubeMine />` component (paste URL → preview → 3 widget cards + table). Visitor can try TubeMine on real videos without signing up. This is the conversion driver.
5. **"Real dashboard preview" block:** Leadline-style 3D-skewed screenshot of `/dashboard` rendered at ~50% page width. Beside it: "Sign in and TubeMine remembers your quota, history, and exports." 
6. **Feature highlights** (alternating text-left / visual-right pattern, three blocks):
   - "See audience tone in seconds" + Sentiment widget mini-card
   - "Find the words people actually use" + Top Words widget mini-card
   - "Spot the emoji of the moment" + Emoji widget mini-card
7. **Pricing teaser:** two cards (Free, Pro) condensed, link to `/pricing` for full FAQ
8. **FAQ accordion:** 6 questions (commented in section 8 below)
9. **Final CTA:** repeat hero with "Try TubeMine now" button
10. **Footer:** 4 columns (Product / Resources / Legal / Social), horizontal rule, copyright row

Mobile: hero text smaller, single column, demo card full width, dashboard preview screenshot drops below the demo block (vertical stack), feature highlights stack vertically with image-above-text, pricing cards 1-column, footer accordion.

### 4.2 Dashboard (`/dashboard`)

The first thing an authenticated user sees. Money page.

Sections, top to bottom:

1. **Header strip:** "Welcome back" + user email + tier badge (Free / Pro). If `?welcome=true` is in URL, show "You are on Pro. Thanks." pulse card for ~5 seconds
2. **Usage card:** monthly quota progress bar (X of Y comments used), "Resets [date]", remaining count. Bar color: primary when under 80%, destructive when 100%
3. **Quick extract widget:** identical to the landing demo's `<TubeMine />` component but pre-authenticated (usage counts against this user's quota). After successful extract, results render below with the three widgets
4. **Recent extractions list:** last 10 extractions, each row: video title (truncated) / channel / extracted count / sentiment summary (one of "positive lean", "neutral", "negative lean") / "Re-export CSV" button. Empty state if no extractions: "Your extractions will appear here. Try one above."
5. **Upgrade card** (Free tier only): "Need more? Pro = 100,000 comments/month for $19." + Upgrade button (calls `/api/checkout`)
6. **Manage subscription card** (Pro tier only): link to `/api/portal`

Mobile: usage card and quick extract widget stack first. Sidebar nav is hamburger on mobile, persistent left rail on desktop (Leadline pattern).

### 4.3 Profile (`/profile`), new

1. **Header:** "Profile"
2. **Account section:** email (read-only, from Google OAuth), joined date, account ID (small monospace)
3. **Plan section:** current tier badge, monthly cap, monthly usage so far, next billing date if Pro
4. **Billing section** (Pro only): "Manage subscription" → `/api/portal`. "Cancel" guidance line
5. **Sign out button** (destructive variant, bottom)
6. **Delete account** (last line): "To delete your account, email us at hello@tubemine.app. We will purge your data within 7 days." (no in-app delete in v3, deferred)

### 4.4 Pricing (`/pricing`), refresh

Keep existing structure but polish to match landing aesthetic. Two cards (Free $0 forever, Pro $19/mo with "Most popular" badge). Auth-aware CTA:
- Anonymous: "Sign in to upgrade" / "Start free"
- Free signed-in: "Open dashboard" / Upgrade button
- Pro signed-in: "Manage subscription" / "Open dashboard"

FAQ section under pricing cards (4 cards in 2-column grid).

### 4.5 Privacy (`/privacy`), new

Standard SaaS Privacy Policy template, edited for our case:
- Data we collect (Google OAuth: email + name; usage: timestamps and comment counts)
- We never sell data
- YouTube API: we hit `youtube.googleapis.com` server-side with our key, your IP is not sent to Google for extraction
- Cookies: Supabase Auth session cookie only, no third-party tracking
- Contact: hello@tubemine.app

### 4.6 Terms (`/terms`), new

Standard ToS:
- TubeMine is provided as-is, no warranty
- We use the YouTube Data API v3 under Google's terms (link)
- Comments are public data; user is responsible for downstream use
- We can suspend abusive accounts
- Pricing changes with 30-day notice
- Governing law: Kazakhstan (founder's country)
- Contact: hello@tubemine.app

### 4.7 Login (`/login`)

Single Google sign-in button on dark surface. Small text below: "By signing in you agree to our Terms and Privacy Policy." Two links to `/terms` and `/privacy`.

After redirect from Google → `/auth/callback` → `/dashboard?welcome=true`.

---

## 5. Component inventory

These are the components Claude Design should generate. Each must define: default / hover / focus-visible / active / disabled / loading / error states.

### Layout

- **TopNav** — sticky, auth-aware, mobile hamburger
- **Footer** — 4 columns + copyright

### Primitives (extend shadcn base-nova)

- **Button** — variants: primary, secondary, ghost, destructive, link, icon
- **Input** — text, url, with icon-prefix variant
- **Card** — default, raised, highlighted (for "Most popular" pricing)
- **Badge** — default, secondary, outline (for tier indicators)
- **Toast** — success, error, warning, info (Sonner-driven)
- **Progress bar** — primary color, destructive color when full
- **Avatar** — with dropdown menu (sign out, profile)
- **Accordion** — for FAQ

### Composed

- **HeroBlock** — H1 + sub + single CTA, optional badge above
- **TrustBadgeRow** — three monospace tags inline
- **LiveDemoCard** — wraps the existing `<TubeMine />` component, no design changes inside
- **DashboardPreviewCard** — 3D-skewed screenshot with caption beside
- **FeatureHighlightBlock** — alternating layout, accepts image + title + body
- **PricingCard** — name + price + features list + CTA
- **FAQAccordion** — list of Q&A, single-expand behavior
- **UsageProgressCard** — tier badge + progress bar + "resets on" text
- **ExtractionHistoryRow** — used in dashboard list
- **CsvGate** — conditional component (anonymous vs signed-in)
- **UpgradeButton** — calls `/api/checkout`, handles loading + error
- **PortalLink** — link to `/api/portal` (just an `<a href>`)

### Existing widgets (do not redesign, only refresh visuals to match new tokens)

- **SentimentPanel** — stacked bar with positive / neutral / negative segments, percentages, "Experimental for Russian" tag conditional
- **TopWordsPanel** — horizontal bars list, monospace word + bar + count
- **EmojiPanel** — vertical list of top 10 emojis + percent share

---

## 6. User flow matrix

### Flow 1: Anonymous first-time → see analytics

1. Land on `/`
2. Hero CTA "Analyze a video" → smooth scroll to live demo block
3. Paste URL, click "Analyze"
4. Preview card appears (thumb + meta)
5. Click "Analyze N comments"
6. Loading state (button spinner + skeleton results)
7. Results render: Top Words, Sentiment, Emoji, then the table
8. CTA bar above table: "Sign in to export CSV" (anonymous) → goes to `/login?redirect=/`
9. Toast on success: silent (UX should not interrupt)

### Flow 2: Anonymous → sign in → first dashboard

1. Click "Sign in" in nav or on CSV gate
2. `/login` page
3. Click "Sign in with Google"
4. Google consent screen (now shows "TubeMine" not Supabase subdomain after recent fix)
5. Redirect → `/auth/callback` → `/dashboard?welcome=true`
6. Dashboard shows welcome pulse card (5 sec) + Free tier badge + empty extractions list

### Flow 3: Free → upgrade to Pro

1. From dashboard, click "Upgrade to Pro" or from pricing page "Sign in to upgrade"
2. Frontend POST `/api/checkout` → returns `{ url }`
3. Redirect to Polar-hosted checkout
4. Enter card → Submit
5. Polar redirects → `/dashboard?welcome=true`
6. Welcome card now shows "You are on Pro. 100,000 comments/month."
7. Tier badge flips to Pro

### Flow 4: Free → cap hit

1. On `/dashboard` or `/` live demo, click "Analyze"
2. API returns 402-style error with quota info
3. Inline error in extract widget: "Monthly cap reached." + Upgrade button
4. Toast: "5,000 / 5,000 comments used this month. Upgrade for 100k."
5. Click Upgrade → flow 3

### Flow 5: Anonymous → cap hit

1. On `/`, repeat extracts until 1,000-comment IP-based monthly cap hit
2. Inline error: "1,000 / 1,000 comments used from this network this month."
3. CTA: "Sign up free for 5,000/month" → `/login`
4. Email capture optional fallback (defer to v4)

### Flow 6: Pro → cancel

1. On `/profile` or `/dashboard`, click "Manage subscription"
2. 307 redirect to Polar customer portal
3. Click Cancel in Polar UI
4. Polar fires `subscription.canceled` webhook → backend sets `cancel_at_period_end=true`
5. User still on Pro until period end
6. Toast on return: "Subscription will end on [date]. You keep Pro access until then."

### Flow 7: Pro → revoked (period end)

1. Polar fires `subscription.revoked` at period_end
2. Backend sets `profile.tier='free'`
3. Next login: dashboard shows Free badge, recent extractions still visible
4. No notification (user already knew, see flow 6)

---

## 7. Edge cases and toast matrix

| Scenario | Surface | Copy |
|---|---|---|
| Invalid YouTube URL | Inline form error | "That doesn't look like a YouTube video URL." |
| Comments disabled on video | Toast warning | "Comments are turned off for this video." |
| Anonymous monthly cap hit (1k) | Inline error in widget | "1,000 / 1,000 used this month. Sign up free for 5x more." |
| Free signed-in cap hit (5k) | Inline + Upgrade button | "5,000 / 5,000 used. Upgrade for 100k." |
| Pro cap hit (100k) | Inline error | "100,000 / 100,000 used this month. Contact hello@ for higher limits." (we will manually raise) |
| YouTube API 5xx | Toast error | "YouTube API is having trouble. Try again in a minute." |
| Network error | Toast error | "Network hiccup. Try again." |
| Auth failed | Toast error | "Sign-in failed. Try again or use a different Google account." |
| Checkout failed | Toast error | "Couldn't start checkout. Try again or contact hello@." |
| Webhook delay (paid but tier not flipped within 30s) | Banner on dashboard | "Payment processing. Refresh in a moment to see your Pro plan." |
| Extract success | Inline silent (just render results) | (none) |
| CSV download success | Inline silent | (none) |
| Pro purchase success | Pulse card on dashboard | "You are on Pro. 100,000 comments/month." |
| Subscription cancelled | Toast on return | "Subscription will end on [date]. Pro stays active until then." |

All toasts are Sonner-driven (already wired in code, `import { toast } from "sonner"`).

---

## 8. FAQ content (use these copy-pasteable on landing and pricing)

1. **What counts as a comment?** Every top-level comment or reply we return for a video counts as one. The counter increments only on successful analysis.
2. **Do I need a YouTube API key?** No. TubeMine uses a shared server-side key. You just paste a URL.
3. **Is this legal? What about YouTube ToS?** Yes. We use the official YouTube Data API v3 under Google's terms. We do not scrape.
4. **Can I cancel anytime?** Yes. From the customer portal. You keep Pro access until the billing period ends, then drop to Free automatically.
5. **What languages does sentiment support?** English fully, Russian experimentally. We label Russian results as "experimental" when Russian comments are a large share.
6. **Do you store the comments?** Only the count for quota purposes. We never store comment text. The CSV is generated and downloaded; nothing persists on our side.

---

## 9. Mobile-first specifics

75% of current traffic is on mobile (iOS 56%, Android 19%). Every page must work brilliantly at 360 / 414 / 768 widths.

- Tap targets ≥ 44 × 44 px
- Single column layouts on < 640 px
- Sticky nav collapses to logo + hamburger
- Pricing cards stack
- FAQ accordion behavior identical to desktop
- Live demo card paste-area auto-focuses on tap (good for thumb workflow)
- Toast notifications appear at the bottom on mobile, top on desktop (Sonner default)
- Skip horizontal scroll anywhere
- Forms use `inputMode="url"` for the YouTube paste field (already wired in code)

---

## 10. Accessibility

Target WCAG 2.2 AA. From DESIGN.md:

- Keyboard-first interactions required
- Focus-visible rules required
- Contrast constraints required
- Every component documents keyboard, pointer, and touch behavior

Specifics:
- All interactive elements reachable by Tab
- Focus rings always visible, never `outline: none` without replacement
- Color contrast 4.5:1 for body text on dark surface
- Toast notifications announce to screen readers (Sonner handles this; verify)
- Form labels associated with inputs (existing code uses react-hook-form, has labels)
- Skip-to-content link (new addition, currently missing)

---

## 11. Out of scope for this generation

These are NOT to be generated by Claude Design. Listed so you do not include them and so we remember they exist:

- OAuth-based YouTube extraction (Iteration 2, triggered at $200 MRR; the per-user quota infrastructure)
- Theme clustering / topic modeling widget (Phase 3+)
- Reddit comments support (Phase 5+)
- Public developer API endpoint
- Team / multi-seat accounts (never, per PRD §5)
- Mobile apps
- Onboarding tour overlay (use tooltips later, not now)
- In-app account deletion (manual via email for v3)
- Blog / content marketing pages (placeholder route only)
- Internationalization (`/ru`, `/kz`, etc.) — landing copy stays English, separate effort

---

## 12. Deliverables expected from Claude Design

When this prompt is processed, output should include:

1. **Design system page** with all tokens applied to actual components (button, input, card, badge, etc.)
2. **Page mockups, both desktop and mobile variants**:
   - Landing (`/`)
   - Dashboard (`/dashboard`)
   - Profile (`/profile`)
   - Pricing (`/pricing`)
   - Privacy (`/privacy`)
   - Terms (`/terms`)
   - Login (`/login`)
3. **Component library** (all reusable components from section 5)
4. **Interactive prototype** demonstrating user flows 1 to 7 in section 6
5. **Handoff bundle for Claude Code** with React + Tailwind v4 + shadcn base-nova ready code, mappable to our existing file structure at `/Users/rakhimovy/projects/yt-comments/src/`

---

## 13. Source-of-truth reference files in our codebase

For accurate "preserve" decisions, your handoff bundle should respect:

- `src/app/page.tsx` — current landing (Hero + TubeMine component + minimal footer)
- `src/app/dashboard/page.tsx` — current dashboard (plan, usage progress, upgrade or manage links)
- `src/app/pricing/page.tsx` — current pricing (two cards, FAQ, auth-aware CTAs)
- `src/app/login/login-form.tsx` — single Google OAuth button (do not redesign the auth flow itself)
- `src/components/tubemine.tsx` — extract widget orchestrator
- `src/components/sentiment.tsx`, `src/components/top-words.tsx`, `src/components/emoji-frequency.tsx` — three analytics widgets to preserve and visually refresh
- `src/components/csv-gate.tsx` — anonymous vs signed-in CTA switch
- `src/components/site-header.tsx` — current top nav (full redesign welcome)
- `src/lib/quota.ts` — quota constants (FREE_MONTHLY_CAP = 5000, PRO_MONTHLY_CAP = 100000)

---

## 14. The single most important request

Show our **actual dashboard** on the landing page, in the way Leadline shows their actual leads inbox + activity charts. This is the difference between "this looks like a SaaS" and "I trust this enough to sign in." Make sure the dashboard mockup on the landing is faithful enough to the real dashboard that a visitor sees it and understands what they would get after signing in. Do not generate a generic "dashboard-like illustration", generate the real thing.

Generate the handoff bundle.
