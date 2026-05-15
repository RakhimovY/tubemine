# TubeMine

> Extract YouTube comments as research-ready datasets. Free. No setup.

[**tubemine.vercel.app**](https://tubemine.vercel.app)

![TubeMine screenshot](./public/screenshot.png)

## What it does

Paste a YouTube URL, get a CSV of every top-level comment. No signup. No API key. Free tier of 1,000 comments per IP per month, reset on the 1st.

For ML researchers, marketing analysts, indie devs, and anyone who wants the data, not the scrape.

## How it works

1. **Preview** (1 quota unit) — `videos.list` returns title, channel, view/like/comment counts so you confirm before extracting.
2. **Extract** (1 quota unit per page of 100 comments) — `commentThreads.list` paginated, sorted by time, top-level only.
3. **Download** — Papa Parse turns the JSON into CSV client-side; columns are `author, text, likes, replies, publishedAt`.

Per-IP monthly budget is enforced server-side via Upstash Redis (`tubemine:budget:{ip}:{YYYY-MM}` with 35-day TTL).

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui (Base UI)
- YouTube Data API v3 via [`@googleapis/youtube`](https://www.npmjs.com/package/@googleapis/youtube)
- Vercel KV (Upstash Redis) for per-IP monthly budget
- Papa Parse for CSV export
- Zod + react-hook-form for input validation
- Hosted on Vercel

## Local dev

```bash
pnpm install
cp .env.example .env.local
# Fill in YT_API_KEY and KV_* vars from `vercel env pull`
pnpm dev
```

## Roadmap

- **Phase 0** (current): anonymous prototype, monthly per-IP budget
- **Phase 1**: Supabase auth + Polar billing + paid tier (1,000 -> 100,000 comments/month)
- **Iteration 2**: Google OAuth migration (per-user 10k/day quota, scales infinitely)

## License

MIT. See [LICENSE](./LICENSE).
