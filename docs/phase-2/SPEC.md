# TubeMine Phase 2, Option B Spec

Status: DRAFT v3 (after review cycles 1 and 2)
Owner: Phase 2 spawn session
Last updated: 2026-05-17

## 1. Why Phase 2

Phase 1.5 shipped Google OAuth, Polar billing, `/pricing`, and the first analytics widget (Top Words). Polar prod onboarding rejected "Extract YouTube comments as CSV" framing and only accepted the org after a rewrite to "AI-powered analytics platform". A Polar reviewer can visit the live site post-onboarding at any time. If they see CSV download as the primary CTA, they can still ban the account.

Phase 2 closes that gap by:

1. **Strengthening the analytics story** with two new visible widgets (Sentiment, Emoji Frequency) so the "analytics platform" framing is real, not just marketing copy.
2. **Gating CSV download behind sign-in** so the first thing a Polar reviewer experiences without an account is analytics, not a downloader.
3. **Tightening hero / pricing / metadata copy** to push extraction language down the visual hierarchy without removing the feature.

Strategic constraint: **first revenue ASAP without Polar banning us**. Every Phase 2 decision is evaluated against that.

## 2. User story (analytics-first)

> A creator, marketer, or researcher pastes a YouTube URL on tubemine.vercel.app. Within 10 seconds they see what the audience is talking about: the dominant words, the emotional skew, and the emojis people lean on. They can dig further or, if they need the raw data, sign in (free) and export the CSV.

Previous (Phase 1.5) story: "paste URL, extract comments, download CSV, optional Top Words." Phase 2 reorders: analytics is the product, CSV is a downstream output.

## 3. Feature inventory

### Already shipped (Phase 1.5)

- Anonymous IP-based extract up to 1,000 comments/month
- Google OAuth sign-in via Supabase
- Free tier: 1,000 comments/month (signed in)
- Pro tier: 100,000 comments/month, $19/month, Polar billing
- Top Words widget (EN+RU+ES stopwords, 20 words, frequency bars)
- Comment table (author, text, likes, replies, when)
- CSV download (anonymous + signed in)
- `/pricing` page with FAQ
- `/dashboard` with tier badge, usage progress, upgrade / portal
- OG image, JSON-LD schema, sitemap, robots

### Adding in Phase 2

1. **Sentiment widget** (positive / neutral / negative split, lexicon-based, EN+RU)
2. **Emoji Frequency widget** (top 10 emojis, count + %share)
3. **CSV gating** (anonymous users see "Sign in to export CSV", signed-in users get download as today)
4. **Copy repositioning** (hero, demo card label, pricing language, metadata)
5. **`package.json` description rewrite** (currently leaks extraction language to anyone reading the GitHub repo, including a Polar reviewer)
6. **JSON-LD description rewrite** (currently says "research-ready CSV export" prominently)

### Out of scope (explicit)

- LLM-based sentiment (cost, latency). Lexicon only. Phase 3 candidate.
- Theme clustering / topic modeling. Phase 3.
- Multi-language UI (interface stays English).
- Sentiment in languages other than EN+RU. Spanish reuses Top Words stopwords but not sentiment.
- Per-comment sentiment label display (only aggregate in widget). Avoids visual noise in the table and avoids implying high accuracy per row.
- New billing tiers, new payment provider, or any change to webhook handling.
- DB migrations.
- Email notifications, transactional Resend hookup (Phase 3).
- `tubemine.tech` DNS work.
- Polar KYC. User submits in parallel.
- README full rewrite. Only the one-line repo description and any "extract YouTube comments" hero blurb get touched. Body of README can keep technical accuracy.

## 4. Widget specifications

### 4.1 Sentiment widget

**Where:** `src/components/sentiment.tsx`, rendered in `tubemine.tsx` between `TopWordsPanel` and `ResultsPanel`.

**When visible:** when extracted comment count >= 25. Below that the widget is hidden (sample too small to be meaningful; cycle 1 lowered the original >50 threshold to give small videos some value while keeping noise low).

**Data source:** sentiment per-comment is computed **server-side in `/api/extract`** and returned alongside `comments`. Reason: VADER lexicon (~7,500 EN words) plus RU lexicon (~200-400 words) is ~30-60KB JSON when trimmed. Sending it to every anonymous visitor is wasteful. Server compute on 1,000 comments with a Map lookup is sub-50ms.

**Response shape additions to `/api/extract`:**

```ts
type ExtractResponse = {
  comments: Comment[]          // unchanged
  extracted: number
  used: number
  remaining: number
  budget: number
  resetAt: string
  // new in Phase 2:
  sentiment: {
    positive: number           // count
    neutral: number
    negative: number
    score: number              // -1..+1, weighted mean of valence
    sampleSize: number         // == comments.length when widget rendered
    coverage: number           // 0..1, fraction of comments that matched >=1 lexicon word
    languages: Array<"en" | "ru">  // which lexicons fired
  } | null                     // null when sampleSize < 25 or coverage < 0.05
}
```

**Per-comment:** `Comment.sentiment?: "positive" | "neutral" | "negative" | "unknown"` — included in CSV export only (not shown in the on-screen table to avoid visual noise + perception of false precision).

**Lexicon design:**

- **English:** subset of VADER (MIT licensed). Keep only words with `|valence| >= 0.5`, lowercase. Target ~3,500 entries, ~40KB JSON. Stored at `src/lib/sentiment/lexicon-en.json`.
- **Russian:** hand-curated ~200-300 word lexicon seeded from public single-word emotion sources (no copyleft dependency). Stored at `src/lib/sentiment/lexicon-ru.json`. Each entry has a valence in {-2, -1, +1, +2}. **Labeled "experimental" in the widget UI** when RU words contribute >= 25% of the matched signal.
- **Scoring:** for each comment, tokenize like Top Words (Unicode-aware, strip URLs/mentions/HTML entities, lowercase), sum valences, apply mild negation handling (preceding "not"/"не" within 3 tokens flips sign of next match). Aggregate score = mean valence per comment, clamped to -1..+1.
- **Classification thresholds:** comment is `positive` if mean valence >= +0.4, `negative` if <= -0.4, else `neutral`. `unknown` if zero matches.

**UI:** horizontal stacked bar (red / gray / green) with counts and percentages, plus a single-line summary ("mostly positive (62%)" / "polarized" / "mostly neutral"). "Polarized" if pos and neg are both >= 30%. "Experimental for Russian" tag when RU coverage threshold tripped.

**Accessibility:** bar has `aria-label` summarizing the breakdown; per-segment labels visible at sm+ breakpoint, tooltip on hover.

### 4.2 Emoji Frequency widget

**Where:** `src/components/emoji-frequency.tsx`, rendered after Sentiment.

**When visible:** when at least one emoji appears in the comment set. Hidden otherwise (avoids empty state on dry technical channels).

**Data:** client-side pure function `topEmojisFromComments(texts, limit=10)` in `src/lib/emoji-frequency.ts`. Uses Unicode property regex `\p{Extended_Pictographic}` to identify emoji codepoints; collapses ZWJ-joined sequences into a single token (so the "family" or "tech worker" emoji counts as one). Mirrors Top Words architecture: pure function in `lib/`, thin client component in `components/`.

**Why client-side:** dataset is small (top 10 of a few hundred unique emojis), no lexicon needed, regex is built into modern V8. Adds <2KB to the bundle.

**UI:** simple grid of 10 cards, each showing the emoji at large size, count, and %share of total emojis in the dataset. Sorted by count descending.

**Accessibility:** each emoji has `aria-label={emojiName(codepoint)}` so screen readers announce "fire emoji, 42 occurrences" not "🔥 42." Use a lightweight inline name map for top ~50 emojis; fall back to "emoji" for unknown.

### 4.3 Top Words widget (unchanged)

Already shipped, no changes. Order in render flow: Top Words first (most general), then Sentiment, then Emoji, then Results table.

## 5. CSV gating model

### 5.1 Behavior matrix

| User state | Extract | Top Words | Sentiment | Emoji | Results table | CSV download |
|---|---|---|---|---|---|---|
| Anonymous | yes, up to IP cap (1k/mo) | yes | yes | yes | yes | NO, replaced with "Sign in to export CSV" CTA |
| Free signed-in | yes, up to 1k/mo | yes | yes | yes | yes | YES, no extra cap (already bounded by quota) |
| Pro signed-in | yes, up to 100k/mo | yes | yes | yes | yes | YES |

Cycle 1 reduced the original "free tier CSV up to 1k rows" rule to "CSV uncapped within their quota". Reason: their monthly extraction cap is already 1k. A separate CSV cap is redundant and confusing.

### 5.2 Anonymous CTA UX

Replace the CSV button on the results header with a button labeled **"Sign in to export CSV"**. Clicking sends the user to `/login?redirect=/?csv=1&v=<videoId>`. Post-auth, `/auth/callback` honors the redirect param (already works) and the home page checks the `csv=1` query, restores the most recently extracted video from session storage, and auto-triggers the CSV download once.

Cycle 2 challenged this: the auto-restore is fragile (session storage is per-tab; OAuth round-trip may reuse the tab). Decision: keep the CTA simple. Post-sign-in, land on `/dashboard` with a one-time toast "Signed in. Re-paste your URL to export." This is laziest and avoids state-recovery bugs. The CSV re-extract is free for signed-in Free users within quota.

### 5.3 Analytics tracking

Add events:

- `csv_signin_gate_shown` (fired when anonymous user sees the results panel)
- `csv_signin_clicked` (fired on CTA click)
- `sentiment_rendered` (with `{ score, positive, negative, coverage, lang_mix }`)
- `emoji_rendered` (with `{ uniqueCount, totalCount }`)

Existing `csv_downloaded` continues to fire only for signed-in users.

## 6. Positioning copy

### 6.1 Hero

| Element | Before (Phase 1.5) | After (Phase 2) |
|---|---|---|
| H1 | "Understand any YouTube video's audience." | unchanged |
| Sub-copy | "Paste a URL. See the top words across every comment, spot recurring themes, and export the full dataset as CSV. No signup. No API key. Free up to 1,000 comments per month." | "Paste a URL. Get sentiment, top words, and the emojis your audience leans on, in seconds. Free up to 1,000 comments per month." |
| Caption | "For researchers, marketers, creators, and indie devs who want the signal, not a scrape." | unchanged (already analytics-coded, "not a scrape" is intentional) |

CSV is removed from hero sub-copy. The word "extract" stays out of the hero entirely.

### 6.2 Demo card (`tubemine.tsx`)

| Element | Before | After |
|---|---|---|
| Card label | "Try it" | "Analyze a video" |
| Submit button (URL form) | "Preview" | "Analyze" (with arrow icon) |
| Extract action button | "Extract N comments" | "Analyze N comments" |
| Loading state | "Extracting..." | "Analyzing..." |
| Results header | "{N} comments" + "Download CSV" button | "{N} comments analyzed" + ("Download CSV" if signed in, else gated CTA) |

Internal API names (`/api/extract`, `recordUsage`, etc.) stay the same. Only user-facing labels change.

### 6.3 Pricing page

| Free features list | Before | After |
|---|---|---|
| "Research-ready CSV export" | this line | "CSV export" |
| (no sentiment line) | add: "Sentiment and emoji insights" |

Pro features: add "Sentiment and emoji insights" too. No other changes.

### 6.4 Metadata + JSON-LD

| Field | Before | After |
|---|---|---|
| Root `title` | "TubeMine - YouTube Comment Analytics. Free. No Setup." | unchanged |
| Root `description` | "Paste a YouTube URL, see top words and themes across every comment, export the dataset as CSV. No signup. No API key. Free up to 1,000 comments per month." | "Paste a YouTube URL. Get sentiment, top words, and audience themes in seconds. Free up to 1,000 comments per month." |
| OG description | "Paste a URL. Get instant comment analytics and CSV." | "Paste a URL. Get instant audience analytics: sentiment, top words, emojis." |
| Twitter description | same as OG | same as OG |
| JSON-LD description | "YouTube comment analytics: top words, themes, and research-ready CSV export. Free up to 1,000 comments per month, no signup, no API key required." | "YouTube audience analytics: sentiment, top words, and emoji insights from public comment data via the YouTube Data API. Free up to 1,000 comments per month." |

### 6.5 `package.json` description

| Before | After |
|---|---|
| "Extract YouTube comments as research-ready datasets. Free. No setup." | "YouTube audience analytics: sentiment, top words, and emoji insights via the YouTube Data API. Free. No setup." |

This is what GitHub shows under the repo name. Polar reviewers may check the repo.

### 6.6 README (limited touch)

Top-of-README one-liner gets the same rewrite as `package.json` description. The rest of README (architecture, env vars, technical detail) stays unchanged.

Cycle 2 explicitly debated removing the word "extract" everywhere in README. Rejected: README is technical documentation, and the API endpoint is genuinely named `/api/extract`. Pretending otherwise hurts developer onboarding without measurable Polar benefit.

## 7. Polar reviewer mental walkthrough

Two-minute trial run, fresh visitor, no account.

1. **Lands on tubemine.vercel.app.** Sees "Understand any YouTube video's audience." Subhead mentions sentiment, top words, emojis. **No "extract"/"download" in viewport.** Pricing link visible top-right.
2. **Pastes a URL.** Card label says "Analyze a video", button says "Analyze". Sees video preview, clicks "Analyze N comments".
3. **Results render.** Top Words bar chart, Sentiment widget (red/gray/green stacked bar with "mostly positive 62%"), Emoji widget (🔥 ❤️ 😂 grid), then a comments table. Below the table header: "Sign in to export CSV" button (instead of a download). **Strong analytics signal, no scraping surface.**
4. **Clicks Pricing.** Two-tier plan, Free $0, Pro $19. Features mention CSV but lead with "Sentiment and emoji insights" + "Top-words analytics". Looks like a normal SaaS.
5. **Inspects GitHub link in footer.** Repo description: "YouTube audience analytics: sentiment, top words..." README top says same. No "Extract YouTube comments" rebrand needed in body.

Reviewer conclusion: legitimate analytics product, not an extractor with extra steps. Risk of ban after manual review: substantially reduced.

What we cannot fully neutralize without losing the product:
- The word "comments" must appear (it is what we analyze).
- `/api/extract` URL still exists if reviewer pokes around.
- CSV download exists for signed-in users.

Mitigation: those are normal SaaS surfaces. Polar's actual concern is the public-facing positioning, per the rejection wording ("third-party content downloader/extractor").

## 8. Acceptance criteria

A change is shippable only when all are true.

- [ ] Hero H1 unchanged, sub-copy contains "sentiment" and "top words" and does NOT contain "extract", "export", or "CSV".
- [ ] Demo card label is "Analyze a video", submit button is "Analyze", extract action button is "Analyze N comments".
- [ ] Anonymous visitor on `/` sees Top Words, Sentiment, and Emoji widgets after a successful extract.
- [ ] Anonymous visitor on `/` sees "Sign in to export CSV" button instead of a download button.
- [ ] Signed-in Free visitor on `/` sees a working CSV download button.
- [ ] Signed-in Pro visitor on `/` sees a working CSV download button.
- [ ] Sentiment widget renders on extracts with >= 25 comments and overall coverage >= 5%, hidden otherwise.
- [ ] Sentiment widget shows "Experimental for Russian" tag when RU contribution >= 25% of matched signal.
- [ ] Emoji widget renders when at least one emoji is present.
- [ ] `/pricing` Free features list contains "Sentiment and emoji insights" and "CSV export" (not "Research-ready CSV export").
- [ ] Root metadata description and JSON-LD description contain "sentiment" and do not contain "CSV export" wording.
- [ ] `package.json` description rewritten.
- [ ] README first paragraph rewritten.
- [ ] No new DB migrations.
- [ ] No new webhook handler changes.
- [ ] Bundle size delta for new client code < 50KB after gzip (server-side sentiment makes this trivial; emoji widget is tiny).
- [ ] All `npm run lint`, `pnpm build`, `tsc --noEmit` pass.
- [ ] Visual verification screenshots taken via chrome-devtools MCP for: anonymous results state, signed-in results state, pricing page, hero.
- [ ] Production deploy at tubemine.vercel.app behaves identically to local dev.

## 9. Open questions for user

None forced. Defaults from the brief were accepted as-is. If any of the following surface during implementation, fall back to user:

- Cycle 1 lowered Sentiment min sample from 50 to 25. If you prefer 50 say so, otherwise 25 ships.
- Cycle 2 dropped the per-tier CSV row limit because monthly extraction cap already enforces it. If you wanted distinct CSV row gating, say so.

## 10. Cycle 1 review log (self anti-yes-man)

Issues raised against v1 and resolved in v2:

1. **Bundled VADER on client = bundle bloat.** v1 implied client-side scoring; v2 moves to server-side in `/api/extract`, returns aggregate + per-comment label. Lexicon never reaches the browser.
2. **Russian lexicon sourcing risk.** v1 hand-waved "RU lexicon". v2 names the constraint: no copyleft source, ~200-300 hand-curated words, explicitly labeled experimental in UI when RU dominates the matched signal.
3. **Sentiment threshold = 50 may exclude small samples.** Lowered to 25. Still hides on truly small (<25) where statistical noise dwarfs signal.
4. **CSV row gating per tier was redundant.** Monthly quota already enforces a 1k ceiling on Free. Removed extra cap.
5. **Anonymous CSV gate auto-restore is fragile.** Cross-tab OAuth flows lose session storage. v2 drops auto-restore, shows a toast instead. Lazy and reliable.
6. **`package.json` description leaks to GitHub.** Added to scope explicitly.
7. **Per-comment sentiment in the table = visual noise + false-precision implication.** v2: only aggregate widget on screen, per-comment label only in CSV export.

## 11. Cycle 2 review log (fresh-eyes / staff engineer)

Issues raised against v2 and resolved in v3:

1. **"Would I ship this?"** Yes, conditional on RU lexicon being delivered as data not a stub. Spec now requires a real ~200-300 word file, not "TBD".
2. **Defended-but-shouldn't-have-been:** original v1 still mentioned changing the URL extract endpoint name. Dropped, internals stay stable. Per-comment label in table also dropped (defended in v1 as "added value"; cycle 2 correctly flagged it as bloat and confidence-misleading).
3. **Language match to user's intent:** user said "просто скачать комментарий". CSV is still possible for signed-in users with one click. We have not bloated the core flow — we added 2 analytics widgets above it and gated one button. Spirit preserved.
4. **Polar reviewer 2-minute walkthrough:** added §7 explicit walkthrough. Anonymous flow shows no download surface at all.
5. **Unspoken concern (first revenue ASAP without ban):** the implementation is small enough to ship in a single session, and the gating is reversible if it tanks conversion. Acceptance criteria include a rollback-friendly screenshot pair (before / after).
6. **What about the demo on the homepage running an anonymous extract:** anonymous extracts still work, still see analytics. Nothing about anonymous extraction was removed. Only CSV download was moved behind sign-in. Hero conversion funnel is now: paste → analyze → see value → optional sign-in for export.

End of SPEC.
