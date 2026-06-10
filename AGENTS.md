# TubeMine, project instructions

Project-specific conventions for this repo. Global rules live in `~/.Codex/AGENTS.md`.

## Testing

### Use small-comment videos for manual / E2E / QA testing (required)

When testing analysis flows by hand (dashboard, history, exports, sentiment),
**always pick a YouTube video with a small comment count** (roughly 5 to 50
comments). Never test against a video with hundreds or thousands of comments.

Why:
- Every real analysis spends YouTube Data API quota. Big videos burn the shared
  daily quota fast (see open Linear TUB-2), which can take the whole app down
  for the day.
- Big extractions are slow and make iteration painful.
- Small videos exercise the same code paths.

Floor: the Sentiment aggregate is only published when a video has at least
`MIN_SAMPLE_SIZE` (5) scored comments and clears the coverage gate
(`src/lib/sentiment/index.ts`). So to see the Sentiment widget during testing,
use a video with **>= 5 comments that carry real opinion words**, not a 1 to 2
comment video.

## Commands

- Dev server: `npm run dev` (http://localhost:3000)
- Unit tests: `npm test` (`NODE_ENV=test vitest run`)
- Lint: `npm run lint`
- i18n parity check: `npm run i18n:check`
