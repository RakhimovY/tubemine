# TubeMine

> Pull any YouTube video's comments straight into your AI assistant over MCP. Your AI does the analysis. Or use the web app for instant sentiment, top words, and emoji. Free 5,000 comments per month. Open source, MIT.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Live at tubemine.tech](https://img.shields.io/badge/live-tubemine.tech-blue)](https://tubemine.tech)
[![Stack: Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![MCP](https://img.shields.io/badge/MCP-server-7c3aed)](https://modelcontextprotocol.io)

**[tubemine.tech](https://tubemine.tech)**

> 🎥 Demo video coming soon. For now, try it live at [tubemine.tech](https://tubemine.tech) or connect the MCP server (below) to your AI assistant.

## Contents

- [What it does](#what-it-does)
- [Connect over MCP](#connect-over-mcp)
- [Features](#features)
- [Plans](#plans)
- [How it works](#how-it-works)
- [Stack](#stack)
- [Local dev](#local-dev)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## What it does

TubeMine has two ways in:

1. **MCP server (lead).** Connect TubeMine to your AI assistant once, then pull any YouTube video's comments straight into your chat. The server exposes a single tool, `get_youtube_comments`, that returns the raw thread (author, text, likes, replies, timestamps). Your own AI does whatever analysis you ask for: sentiment, themes, summaries, the standout comment. We hand over the data, your model reasons over it.

2. **Web app (no setup).** Paste a YouTube URL and get instant audience analytics over every comment: sentiment skew (positive, neutral, negative), the words people actually use, and the emojis the audience reaches for. Signed-in users get a quota meter, history, and CSV export. Pro adds exact percentages, hour-of-day trends, JSON, and Excel.

For creators, marketing analysts, ML researchers, indie devs, and anyone who wants the audience signal in seconds, from their AI or a browser.

## Connect over MCP

The remote MCP server speaks Streamable HTTP at:

```
https://tubemine.tech/api/mcp
```

Authentication is an API key sent as a Bearer token. Create one at **[tubemine.tech/ai-access](https://tubemine.tech/en/ai-access)** (it is shown once), then connect your client. Full per-client guides live at **[tubemine.tech/mcp-docs](https://tubemine.tech/en/mcp-docs)**.

**Claude Code**

```bash
claude mcp add --transport http TubeMine https://tubemine.tech/api/mcp \
  --header "Authorization: Bearer tm_sk_YOUR_KEY"
```

**Cursor** (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "tubemine": {
      "url": "https://tubemine.tech/api/mcp",
      "headers": { "Authorization": "Bearer tm_sk_YOUR_KEY" }
    }
  }
}
```

Then just ask, for example: *"Pull the comments from this video and tell me the overall sentiment and the most-liked complaint."* TubeMine returns the raw thread; your AI does the rest.

**Supported clients:** Claude Code, ChatGPT (Developer Mode), Cursor, Codex, Gemini CLI, Claude Desktop, Hermes, OpenClaw. One-click OAuth 2.1 for the clients that support it is on the roadmap; today every client connects with an API key.

**The tool**

| Tool | Params | Returns |
| --- | --- | --- |
| `get_youtube_comments` | `video_url` (URL or ID), `sort` (`relevance` \| `time`), `max` (count) | Raw comment thread: author, text, likes, replies, timestamps |

## Features

- **MCP server.** One tool, `get_youtube_comments`, raw comments into any of 8 AI clients. Per-user API keys with create / copy / revoke and one-click ready setup commands.
- **Sentiment analysis** on every comment (web app). Free shows direction, Pro shows exact percentages and hour-of-day trends.
- **Top words** ranked by frequency. Free shows top 15, Pro shows all ranked.
- **Emoji frequency** insights. Free shows top 15, Pro shows all ranked plus a heatmap.
- **CSV results** for Anonymous and Free tiers. Pro adds JSON and Excel.
- **3-day free Pro trial**, then $19 per month. Cancel anytime via the customer portal.
- **EN and RU bilingual** UI. Russian sentiment is in experimental beta.
- **No YouTube API key required.** TubeMine uses its own quota with the official YouTube Data API v3. MCP and the web app share the same per-user monthly quota.
- **Open source, MIT licensed.** Self-host, fork, or contribute.

## Plans

| | Anonymous | Free | Pro |
| --- | --- | --- | --- |
| Monthly comments (MCP + web, shared) | 1,000 | 5,000 | 100,000 |
| Account | No (per IP cap) | Google sign-in | Required |
| MCP access | No | Yes | Yes |
| Sentiment (web) | Total count only | Direction (qualitative) | Exact percentages plus trends |
| Top words | Top 5 plus counts | Top 15 plus counts | All ranked |
| Top emoji | Top 5 plus counts | Top 15 plus counts | All ranked plus heatmap |
| Result formats | CSV | CSV | CSV, JSON, Excel |
| Saved analyses | Single session | Last 10 | Last 100 |
| Price | $0 | $0 | $19 / month |

The MCP server needs an account (for the API key), so it is available on Free and Pro. Full comparison and FAQ at [tubemine.tech/pricing](https://tubemine.tech/en/pricing).

## How it works

**Via MCP:** your AI client calls `get_youtube_comments`. The server resolves the video, loads comments via `commentThreads.list` (paginated, top-level), and returns the raw thread to your model. No server-side analytics, your AI reasons over the data.

**Via the web app:**

1. **Paste a public YouTube URL.** The video resolves via `videos.list`, returning title, channel, view, like, and comment counts so you confirm the right video before analyzing.
2. **Analyze.** Comments load via `commentThreads.list`, then run through sentiment, top-words, and emoji pipelines server-side.
3. **Read or save.** Results render in the browser. CSV is built client-side via Papa Parse. Pro adds JSON and Excel via `/api/export`.

Both paths share one extraction core (`src/lib/extract-core.ts`) so quota accounting and the global YouTube-quota safety stay identical. Quota enforcement: anonymous monthly budget per IP via Vercel KV (Upstash Redis); per-user budget via Postgres with an atomic `bump_usage` RPC (race-free). MCP API keys are stored as SHA-256 hashes in `user_api_keys` with RLS.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **MCP**: [`mcp-handler`](https://github.com/vercel/mcp-handler) + [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk), Streamable HTTP at `app/api/[transport]/route.ts`
- **Tailwind CSS v4** + shadcn/ui on Base UI primitives (base-nova design system)
- **next-intl** for EN and RU localization
- **YouTube Data API v3** via [`@googleapis/youtube`](https://www.npmjs.com/package/@googleapis/youtube)
- **Supabase** (Postgres + Auth) for accounts, quotas, subscriptions, MCP API keys
- **Polar.sh** for subscription billing and customer portal
- **Resend** for transactional email
- **Vercel KV (Upstash Redis)** for per-IP anonymous budget
- **Papa Parse** for client-side CSV, **exceljs** (server-only) for Excel
- **Zod + react-hook-form** for input validation
- **Vitest + Testing Library** (259 tests, jsdom + RTL)
- Hosted on **Vercel**, custom domain **tubemine.tech**

## Local dev

```bash
pnpm install
cp .env.example .env.local
# Fill in YT_API_KEY, KV_*, Supabase, Polar, Resend keys
pnpm dev
```

> This repo is **pnpm-managed**. Use `pnpm` for installs (`npm install` corrupts the pnpm `node_modules`). `pnpm test`, `pnpm lint`, and `pnpm build` work as expected.

### Required env vars

See [`.env.example`](./.env.example) for the full list. The MCP server adds **no new env vars**, it reuses `YT_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.

```
YT_API_KEY
KV_REST_API_URL
KV_REST_API_TOKEN
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
POLAR_ACCESS_TOKEN
POLAR_WEBHOOK_SECRET
POLAR_PRODUCT_PRO_ID
NEXT_PUBLIC_POLAR_SERVER (sandbox | production)
RESEND_API_KEY
NEXT_PUBLIC_ORIGIN
CRON_SECRET (production only)
```

### Database migration

```bash
# Apply migrations via Supabase Studio (SQL editor) or CLI
supabase db push
```

Migrations live in `supabase/migrations/`. They create `profiles`, `usage`, `subscriptions`, `webhook_events`, the `analyses` tables, and `user_api_keys` (SHA-256-hashed MCP keys with RLS), plus the `handle_new_user` trigger and the `bump_usage` RPC for atomic quota increments.

### Polar setup

1. Create an org at <https://polar.sh>.
2. Create a Pro product ($19 per month recurring) and copy its product ID into `POLAR_PRODUCT_PRO_ID`.
3. Generate an Organization Access Token; set `POLAR_ACCESS_TOKEN`.
4. Add a webhook endpoint pointing at `https://<your-domain>/api/polar/webhook` and copy the signing secret into `POLAR_WEBHOOK_SECRET`. Subscribe to: `subscription.created`, `subscription.active`, `subscription.updated`, `subscription.canceled`, `subscription.revoked`.

### Resend setup

1. Create an account at <https://resend.com>.
2. Generate an API key; set `RESEND_API_KEY`.
3. Until your custom domain is verified, emails ship from `onboarding@resend.dev` (sandbox). Override by setting `RESEND_FROM` to a verified sender like `TubeMine <noreply@yourdomain.com>`.

## Deployment

TubeMine ships to Vercel. Production runs at [tubemine.tech](https://tubemine.tech) with the custom domain bound via DNS (apex + www both resolve, SSL provisioned by Vercel).

1. Push to `main`; Vercel auto-deploys.
2. Configure the env vars listed above in Project Settings, Environment Variables.
3. Bind your custom domain in Project Settings, Domains (Vercel handles SSL).
4. Optional: configure a Vercel Cron at `/api/internal/cron/purge-analyses` for daily comment-cache purge.

The MCP route runs on the Node.js runtime and is served at `/api/mcp` (do not front it with a `/mcp` rewrite, that breaks `mcp-handler` path matching).

## Roadmap

- **Phase 0** (shipped 2026-05-15): anonymous prototype, per-IP monthly budget.
- **Phase 1** (shipped 2026-05-17): Supabase Auth, Polar Pro plan, per-user quotas, dashboard.
- **Phase 2 + TUB-1** (shipped 2026-05-20): v3 visual port across 9 pages, sentiment Pro tier, tier-aware results, comparison table.
- **TUB-11** (shipped 2026-05-21): branding (logo, favicon, PWA icons, OG image).
- **MCP v1** (shipped 2026-06-10): remote MCP server, `get_youtube_comments` tool, API-key auth, `/ai-access` + `/mcp-docs`, full v3 design refresh, MCP-angle repositioning.
- **Next:** one-click OAuth 2.1 connect for Claude Code / ChatGPT / Cursor via a managed provider; demo video on the hero and in this README.

## Contributing

Contributions welcome under the MIT license. To get started:

1. Fork the repo and create a feature branch.
2. Run `pnpm install` and `pnpm dev`.
3. Make changes. Tests live in `*.test.tsx` and `*.test.ts` files; run `pnpm test`.
4. Lint with `pnpm lint`. Typecheck via `pnpm build`.
5. Open a PR against `main` with a clear description.

## License

[MIT](./LICENSE). Use it, fork it, ship it.

---

Last updated: 2026-06-10
