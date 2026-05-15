# TubeMine

> Extract YouTube comments as research-ready datasets. Free. No setup.

[tubemine.vercel.app](https://tubemine.vercel.app)

## What it does

Paste a YouTube URL, get a CSV of all top-level comments. No signup. No API key. Free tier of 1,000 comments per IP per month.

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
