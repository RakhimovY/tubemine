# TubeMine MCP v1 + v3 Design Port, Spec

Date: 2026-06-09
Branch: `feat/mcp-v1`
Linear epic: TUB-50
Status: spec (turbo-pipeline Phase 1 output)

## 1. Goal

Ship two things on one feature branch, verified on a Vercel preview, never merged to
`main` without the user:

1. A remote MCP server that lets a user's AI assistant pull RAW YouTube comments into
   their chat through one tool, `get_youtube_comments`. Authenticated with static
   API keys (`tm_sk_...`), architected behind a strategy pattern so OAuth 2.1 slots in
   later (v2) with zero handler changes.
2. A full port of the v3 design (`docs/design-v3/`) into the live Next.js app: the new
   MCP surfaces PLUS a reskin of every existing page to the v3 token system.

Positioning (locked): MCP returns raw comments only; the user's own AI does any
analysis. The web app remains the separate "ready-made analytics dashboard" segment.

## 2. Locked decisions (do NOT relitigate; the 5x reviews may not reopen these)

1. MCP exposes ONE tool: `get_youtube_comments`. No server-side analytics tool. The
   earlier `analyze_youtube_comments` draft is dropped everywhere (backend + docs).
2. Auth v1 = API-key only (static Bearer `tm_sk_...`), behind an `AuthProvider`
   strategy pattern. No OAuth provider is integrated in v1; a `null`-returning
   `OAuthProvider` stub holds the seam.
3. The `oauth-intro` page is removed (route, component, messages, nav links). The
   design's "OAuth Intro" ref is ignored.
4. Hero "Connect your AI" CTA points to the public MCP setup docs page (`/mcp-docs`),
   not a bare signup wall.
5. Pricing cards gain an MCP-access line per tier with honest shared-quota wording
   (MCP and web share the same per-user monthly comment quota; no separate/2x MCP
   quota).
6. Real AI brand logos everywhere (reusable components), replacing the design's
   colored dots/text: Anthropic/Claude (Claude Code + Claude Desktop), OpenAI
   (ChatGPT + Codex), Cursor, Google/Gemini, Nous/Hermes, OpenClaw (lobster).
7. No per-user MCP hard cap in v1. MCP reuses the existing extract pipeline and
   inherits the global shared-quota protection (a clean error when the shared YouTube
   daily quota is exhausted). Quota is per-PROJECT, not per-user.
8. Scope of THIS run (user-confirmed 2026-06-09): "Everything now", the full v3
   reskin of every page in addition to all MCP work.
9. The `04_api_keys.sql` migration is applied to the live shared Supabase DB during
   this build (user-confirmed), gated by showing the exact SQL and confirming before
   running it. The table is additive and reversible (drop table); existing tables are
   untouched.

## 3. Reconciled facts (authoritative; ignore stale vault text)

- Tiers: Anonymous 1,000 comments/mo; Free $0 / 5,000 comments/mo; Pro $19/mo /
  100,000 comments/mo. (`flows-summary.md` $9 and `_project.md` "1k free" are stale.)
- `MIN_SAMPLE_SIZE` = 5 (sentiment coverage gate; web-only, does not gate MCP).
- Stack: Next.js 16.2.6 (App Router), React 19.2, TypeScript, Tailwind v4, shadcn on
  `@base-ui/react`, Supabase (`@supabase/ssr`), Polar, Upstash/Vercel KV, next-intl
  (EN+RU), zod v4 (`^4.4.3`), vitest. `next.config.ts` exists. Migrations `00`-`03`
  present; next is `04`.
- Reuse map (verified signatures):
  - `src/lib/youtube.ts`: `ytClient(): youtube_v3.Youtube` (reads `process.env.YT_API_KEY`,
    throws if missing; `import "server-only"`; no cookie dependency).
  - `src/lib/comments.ts`: `StoredComment = { authorName: string|null; text: string;
    likes: number; replies: number|null; publishedAt: string|null; sentiment:
    "positive"|"neutral"|"negative"|"unknown"|null }`.
  - `src/app/api/extract/route.ts`: signed-in branch does `getUserQuota(userId)` -> quota
    check (402 if `remaining<=0`) -> `ytClient()` paginate loop (`commentThreads.list`,
    PAGE_SIZE 100, `order:"time"`, `textFormat:"plainText"`) -> error map
    (`quotaExceeded` -> 503, `commentsDisabled` -> 400, 404 -> 404, empty -> 500) ->
    `bumpUserUsage(userId, comments.length)` -> optional `saveAnalysis`. Route expects a
    bare 11-char videoId (`/^[\w-]{11}$/`), NOT a URL.
  - `src/lib/auth.ts`: `authUserId(): Promise<{userId,userEmail}>` is COOKIE-dependent
    (`createClient()` -> `cookies()`). MUST NOT be called from the MCP handler.
  - `src/lib/supabase/server.ts`: `createClient()` (cookie SSR client, RLS),
    `createServiceClient()` (no cookies, service-role, bypasses RLS), `getCachedUser`
    (RSC-only). MCP uses `createServiceClient()`.
  - `src/lib/quota.ts`: `FREE_MONTHLY_CAP=5000`, `PRO_MONTHLY_CAP=100000`,
    `getUserQuota(userId): Promise<UserQuota>`, `bumpUserUsage(userId, delta): Promise<number>`
    (atomic RPC `bump_usage`). Both use `createServiceClient()` internally; safe from MCP.
  - `src/lib/budget.ts`: anonymous per-IP layer (`MONTHLY_BUDGET=1000`,
    `getClientIp(req)` header-dependent, `getBudgetStatus`, `recordUsage`). Used only on
    the anonymous web branch; MCP does not touch it (MCP callers are always authenticated).
- Verified MCP API (Context7, SDK 1.x line that `mcp-handler` uses):
  - `createMcpHandler((server) => {...}, serverOptions?, { basePath, maxDuration,
    verboseLogs, redisUrl })`. First arg is a callback that registers tools; no prebuilt
    instance overload. `basePath` must point to the dir containing `[transport]`.
  - Route `app/api/[transport]/route.ts`, export `GET`, `POST`, `DELETE`.
  - `withMcpAuth(handler, verifyToken, { required: true, requiredScopes?, resourceMetadataPath?, resourceUrl? })`.
  - `verifyToken(req: Request, bearerToken?: string): Promise<AuthInfo | undefined>`;
    return `undefined` -> 401 (when `required`). `AuthInfo = { token: string; clientId:
    string; scopes: string[]; expiresAt?: number; extra?: Record<string,unknown> }`,
    imported from `@modelcontextprotocol/sdk/server/auth/types.js`.
  - Identity reaches the tool via the handler's 2nd arg: `extra.authInfo` (so
    `extra.authInfo.extra.userId`).
  - `new McpServer({ name, version })`; `server.registerTool(name, { title?,
    description, inputSchema }, handler)`; handler returns `{ content: [{ type:"text",
    text }] }`, error via `isError: true`. Import `@modelcontextprotocol/sdk/server/mcp.js`.
  - Documented floor: `@modelcontextprotocol/sdk@1.26.0`. Docs pin `zod@^3` raw-shape
    `inputSchema`. See the zod gate in section 5.1.

## 4. Architecture: 5 sequenced sub-projects

Sequence is chosen so the MCP feature (the validation goal) is complete and
preview-testable at the end of P2, before the larger reskin (P3). Each sub-project
ends in a buildable, lint-clean, test-passing state.

- P0 Design-token foundation + shared components.
- P1 MCP backend.
- P2 MCP frontend surfaces.
- P3 Full v3 reskin of remaining pages.
- P4 Cleanup (remove oauth-intro) + i18n parity + QA + branch/preview + vault updates.

## 5. P1, MCP backend (detailed; built first conceptually, depends only on P0 logos for none of it)

### 5.0 Shared extract refactor (prevents route/MCP drift)

Create `src/lib/extract-core.ts` and refactor the existing
`src/app/api/extract/route.ts` POST signed-in branch to call it. The web response must
remain behaviorally identical (same comments, same quota accounting); the shared core
captures the fetch+paginate+quota code path, not a new return type for the web.

```ts
// src/lib/extract-core.ts
import "server-only"
export type RawComment = {           // all fields non-null; coerced from the YT API
  author: string                     // authorDisplayName ?? "(anonymous)"
  text: string                       // textDisplay ?? ""
  likes: number                      // Number(likeCount ?? 0)
  replies: number                    // Number(totalReplyCount ?? 0)
  publishedAt: string                // publishedAt ?? ""
}
export type FetchOptions = { videoId: string; max: number; order: "time" | "relevance" }
export class CommentsDisabledError extends Error {}
export class VideoNotFoundError extends Error {}
export class YouTubeQuotaError extends Error {}      // global 503 / google quotaExceeded
export class NoCommentsError extends Error {}
export class QuotaExceededError extends Error { constructor(public quota: UserQuota) { super("quota_exceeded") } }

// Pure YouTube fetch + paginate + error map. No quota, no persistence, no metadata.
export async function fetchCommentThread(opts: FetchOptions): Promise<RawComment[]>

// Signed-in core: quota check -> fetch -> bumpUserUsage(by actual count). Raw + quota.
export async function extractCommentsForUser(opts: {
  userId: string; videoId: string; max?: number; order?: "time" | "relevance"
}): Promise<{ comments: RawComment[]; extracted: number; truncatedByQuota: boolean; quota: UserQuota }>
```

- `fetchCommentThread` ports the route's exact loop (PAGE_SIZE 100,
  `textFormat:"plainText"`, cap to `max`) and coercions (the RawComment defaults above,
  so it never emits null). Error contract (preserves current route behavior): if
  `commentThreads.list` throws AFTER >=1 comment was already collected, swallow and
  return the partial set; only throw a typed error when ZERO comments were collected.
  The typed throws map the google reasons: `quotaExceeded` -> `YouTubeQuotaError`,
  `commentsDisabled` -> `CommentsDisabledError`, 404 -> `VideoNotFoundError`, otherwise
  (0 collected) -> `NoCommentsError`.
- `extractCommentsForUser` calls `getUserQuota(userId)`; if `remaining<=0` throws
  `QuotaExceededError(quota)`. `effectiveMax = max ?? remaining`;
  `limit = Math.min(effectiveMax, remaining)`. Calls `fetchCommentThread({ videoId,
  max: limit, order })`. On success calls `bumpUserUsage(userId, comments.length)` (the
  ACTUAL returned count, partial-safe). Compute the truncation flag AFTER the fetch from
  what actually happened, NOT from request params:
  `truncatedByQuota = comments.length >= limit && remaining < effectiveMax` (true only
  when the result actually filled the quota-bound limit; a small video returning fewer
  than `limit` comments yields false even if `remaining < effectiveMax`). Returns
  `{ comments, extracted: comments.length, truncatedByQuota, quota }`.
- The web route's signed-in branch is rewritten to call `extractCommentsForUser`, then
  reproduce today's behavior on the returned `RawComment[]`: score sentiment + top-words
  + emoji, do its own best-effort `videos.list` metadata fetch (web-only), and persist.
  Because the shared core returns plain `RawComment[]` (no `sentiment` slot), the web
  branch builds `StoredComment[]` by index (`author` -> `authorName`, `replies` stays a
  number, `sentiment` = the per-index label from `scoreCommentsSentiment`) for
  `saveAnalysis`, reproducing today's per-comment sentiment attachment. Thrown error
  classes map to the existing 402/503/400/404/500 responses. The anonymous (IP) branch
  is unchanged.
- MCP and web thus share the same pagination + quota-accounting code path. They do NOT
  necessarily return the same comment SET, because the MCP default sort is `relevance`
  while the web path uses `time` (see 5.3).

### 5.1 Packages + zod reconciliation gate (build-time)

- Install `mcp-handler` and `@modelcontextprotocol/sdk` (>= 1.26.0). Do not pin an
  unverified `mcp-handler` version; install latest and read its `package.json`/peer deps.
  (The lockfile already resolves `@modelcontextprotocol/sdk@1.29.x` with a transitive
  `zod@3.25.x`, so both zod v3 and v4 will coexist in `node_modules`.)
- zod gate: the app authors schemas with zod v4 (`import { z } from "zod"`), but the SDK
  validates `inputSchema` with its own zod v3 instance; a v4 schema can fail v3 internal
  brand/`instanceof` checks. Resolution, in order of preference:
  1. At install, test whether the installed SDK accepts a v4 raw shape (newer SDKs accept
     Standard Schema). If yes, author the tool schema with the app's zod v4 raw shape.
  2. If not, add an explicit aliased dependency `"zod3": "npm:zod@^3"` and author ONLY
     the tool's input schema (in `src/lib/mcp/tool-schema.ts`) with `import { z } from
     "zod3"`. Do NOT change the app's zod v4 anywhere else.
- Keep the tool input schema isolated in `src/lib/mcp/tool-schema.ts` so the form
  (raw-shape vs `z.object`, v3 vs v4) is a one-file change. Record the chosen path in a
  code comment.

### 5.2 Route + rewrite + proxy/i18n exclusion

- Route file `src/app/api/[transport]/route.ts`:
  - `export const runtime = "nodejs"` (required: sha256 crypto + service-role client +
    quota code are Node-only).
  - `export const maxDuration = 60`. The per-call comment ceiling (5.3,
    `MCP_MAX_PER_CALL`) is sized so a single `tools/call` finishes well inside 60s.
  - Build the `McpServer` inside the `createMcpHandler((server) => { ... })` callback
    (no prebuilt-instance path). `config = { basePath: "/api", maxDuration: 60, verboseLogs: false }`.
  - Wrap with `withMcpAuth(handler, verifyTokenForMcp, { required: true })`.
  - Export `GET`, `POST`, `DELETE` (all three; missing any -> silent client failures).
- Public endpoint: `next.config.ts` rewrite `{ source: "/mcp", destination: "/api/mcp" }`
  so clients use `https://tubemine.tech/mcp`. `[transport]` resolves to `mcp`.
- i18n/auth exclusion (CRITICAL, repo-specific): this app does NOT use a `middleware.ts`
  negative-lookahead matcher. It uses `src/proxy.ts` (Next.js 16 `proxy`), which runs
  BEFORE the `next.config` rewrite, wraps next-intl with `localePrefix: "always"`, and
  decides skipping via an in-body `skipIntl` boolean (currently
  `pathname.startsWith("/api") || "/auth" || ...`) plus Supabase session refresh on the
  broad `config.matcher`. Fix: add bare `/mcp` (EXACT segment) to the `skipIntl`
  condition so the proxy does NOT 308-redirect `/mcp` -> `/en/mcp`. (Note: in the current
  proxy, `/api` paths only set `skipIntl`, they do NOT early-return before the Supabase
  `getUser()` refresh; that refresh on a cookieless Bearer request is harmless, so the
  `skipIntl` edit alone is sufficient. Optionally add an early `return NextResponse.next()`
  for `/mcp` to skip the wasted refresh.) The EXACT-segment match keeps `/mcp-docs` and
  `/ai-access` localized. Verify on preview:
  `curl https://<preview>/mcp` returns JSON-RPC (not an HTML 308); `/mcp-docs` and
  `/ai-access` still localize; a locale-prefixed `POST /en/mcp` is NOT treated as the
  transport (404/redirect cleanly).
- CORS is NOT built in v1 (the primary clients are CLI tools that do not preflight). It
  is a verification gate (section 9): if a browser-based connector fails CORS on the
  preview, add permissive CORS headers (on success AND error/401 responses) + an
  `OPTIONS` export then, not preemptively.

### 5.3 The tool, `get_youtube_comments`

- Define `MCP_MAX_PER_CALL = 2000` (a single-call ceiling, distinct from the monthly
  cap; sized to finish inside the 60s function budget at ~100 comments/page and to avoid
  one call draining the shared YouTube daily quota).
- `inputSchema` (zod, form per 5.1):
  - `video_url: string` (a YouTube URL or bare 11-char ID), `.describe(...)`.
  - `sort: enum("relevance","time")`, optional, default `"relevance"`.
  - `max: number`, optional, default 100. Coerce to integer and clamp to
    `[1, MCP_MAX_PER_CALL]` (so an LLM emitting `0`, a negative, or a float yields a sane
    value, not a 0-comment success). Do not reject; clamp.
- Handler:
  1. Read `userId` from `extra.authInfo.extra.userId`. If absent, return
     `{ isError: true, content: [text: "Unauthorized"] }` (defensive; auth already
     enforced by `withMcpAuth`).
  2. `const videoId = parseYouTubeVideoId(video_url)`. If null, return `isError` text
     "Could not parse a YouTube video id from: <input>".
  3. `const r = await extractCommentsForUser({ userId, videoId, max, order: sort })`.
  4. On `QuotaExceededError(err)`: return `isError` text using the exact template:
     "Monthly comment quota reached: used {used}/{cap} on the {tier} plan. Resets
     {resetAt}. Upgrade or wait for the reset." (fields from `err.quota`:
     `used, cap, tier`; `resetAt` formatted as a human date `YYYY-MM-DD`, not the raw ISO
     timestamp).
  5. On `YouTubeQuotaError`: return `isError` text "TubeMine has hit its YouTube API
     daily quota. Please try again tomorrow." (the global 503 condition, surfaced as a
     clean MCP error, never a crash).
  6. On `CommentsDisabledError`/`VideoNotFoundError`/`NoCommentsError`: matching
     `isError` text ("Comments are disabled for this video." / "Video not found." /
     "No comments found for this video.").
  7. Success: return `{ content: [{ type:"text", text: JSON.stringify(payload) }] }`
     where `payload = { video_id, count: r.extracted, truncated_by_quota:
     r.truncatedByQuota, sort, comments: r.comments }`. RawComment fields:
     `author, text, likes, replies, publishedAt`. No sentiment, no title/channel (raw
     comments only). `truncated_by_quota` lets the assistant tell the user the result was
     capped by their remaining monthly quota (not by video length).
- `parseYouTubeVideoId(input: string): string | null` in `src/lib/youtube-url.ts`:
  accepts `watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, `/v/`, AND a bare 11-char id;
  validates `/^[\w-]{11}$/`. The repo already has `extractVideoId` in `src/lib/types.ts`
  whose regex requires a URL prefix (no bare id) and is relied on by the client zod
  refine + tests. Do NOT change `extractVideoId`. Implement `parseYouTubeVideoId` to
  first try the bare-id check, then the URL patterns (it may import/reuse the same
  pattern source as `extractVideoId` without altering `extractVideoId`'s contract).
- Pagination note (build-time verify, section 9): confirm `fetchCommentThread` paginates
  correctly under `order:"relevance"` (YouTube caps relevance-ordered results and may
  stop returning `nextPageToken` earlier than `time`); the loop's `if (!pageToken) break`
  already handles early termination, but verify the returned count is reasonable.

### 5.4 Auth, strategy pattern

Files under `src/lib/mcp/auth/`:

```ts
// types.ts
export interface AuthProvider { authenticate(req: Request, bearerToken?: string): Promise<{ userId: string } | null> }

// api-key-provider.ts
export class ApiKeyProvider implements AuthProvider { /* tm_sk_ detect -> sha256 -> user_api_keys lookup */ }

// oauth-provider.ts  (v2 seam; v1 stub)
export class OAuthProvider implements AuthProvider { async authenticate() { return null } }

// index.ts
export function getAuthProvider(): AuthProvider { return new ApiKeyProvider() }  // v2: swap/compose here
export async function verifyTokenForMcp(req: Request, bearerToken?: string): Promise<AuthInfo | undefined>
```

- `ApiKeyProvider.authenticate`:
  - Extract token: prefer the `bearerToken` arg; else parse `Authorization: Bearer (.+)`
    from `req`. If no token, return null.
  - If `!token.startsWith("tm_sk_")`, return null (lets the dual-path fall through; in
    v1 there is no OAuth, so non-`tm_sk_` -> 401).
  - `hash = sha256(token)` (hex). Look up `user_api_keys` by `key_hash` via
    `createServiceClient()` (bypasses RLS). If no row or `is_revoked`, return null.
  - Fire-and-forget update `last_used_at = now()` (do not await/block).
  - Return `{ userId: row.user_id }`.
- `verifyTokenForMcp`: runs `getAuthProvider().authenticate(req, bearerToken)`; if null
  return `undefined` (-> 401). Else adapt to `AuthInfo`:
  `{ token: bearerToken ?? "", clientId: "tubemine-api-key", scopes: [], extra: { userId } }`.
- Adding OAuth later = implement `OAuthProvider`, compose in `getAuthProvider`, add a
  non-`tm_sk_` branch; route/tool handler change zero lines.
- Revocation latency: `withMcpAuth` runs `verifyToken` on EVERY JSON-RPC request, not
  once per session, so revoking or rotating a key takes effect on the client's next
  `tools/call`. The `is_revoked` check in `ApiKeyProvider` is the enforcement point.
  Verify on preview: revoke a key, confirm the next call 401s (do not assume session
  caching keeps it alive).

### 5.5 API keys library + data model

`src/lib/mcp/api-keys.ts` (all DB ops via `createServiceClient()`):

```ts
export function generateApiKey(): { raw: string; hash: string }
// raw = "tm_sk_" + randomBytes(32).toString("base64url"); hash = sha256(raw) hex
// randomBytes + sha256 from Node "node:crypto": randomBytes(32),
// createHash("sha256").update(raw).digest("hex"). No external dep. The same
// hashApiKey is used by ApiKeyProvider (5.4).
export function hashApiKey(raw: string): string
export function maskApiKey(): string            // display-only "tm_sk_" + bullets
export type ApiKeyRow = { id: string; name: string | null; created_at: string; last_used_at: string | null; is_revoked: boolean }
export async function listApiKeys(userId: string): Promise<ApiKeyRow[]>          // non-revoked, newest first
export async function createApiKey(userId: string, name?: string): Promise<{ row: ApiKeyRow; raw: string }>  // raw shown ONCE
export async function revokeApiKey(userId: string, id: string): Promise<void>    // set is_revoked = true
export async function rotateApiKey(userId: string, id: string): Promise<{ row: ApiKeyRow; raw: string }>     // revoke old + create new (same name)
```

Migration `supabase/migrations/04_api_keys.sql`:

```sql
create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_hash text not null unique,
  name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  is_revoked boolean not null default false
);
create index if not exists idx_user_api_keys_user on public.user_api_keys(user_id);
alter table public.user_api_keys enable row level security;
create policy "user_api_keys_select_own" on public.user_api_keys for select using (auth.uid() = user_id);
create policy "user_api_keys_insert_own" on public.user_api_keys for insert with check (auth.uid() = user_id);
create policy "user_api_keys_update_own" on public.user_api_keys for update using (auth.uid() = user_id);
create policy "user_api_keys_delete_own" on public.user_api_keys for delete using (auth.uid() = user_id);
-- v2 OAuth forward-compat: add oauth_client_id text, oauth_provider text later.
```

- Hash: SHA-256 hex only (NOT bcrypt; bcrypt breaks the indexed `eq("key_hash", hash)`
  lookup). Raw key never stored; shown once at create/rotate.
- Dashboard key operations resolve `userId` via the cookie path (`authUserId()`) in a
  server action / route handler, then call the lib with an explicit `userId` filter.
  The MCP route lookup uses the service client (no session). RLS protects against any
  accidental anon-key path.
- HARD INVARIANT (IDOR guard): every scoped/destructive op (`revokeApiKey`,
  `rotateApiKey`, `listApiKeys`) runs via the service client (RLS bypassed) and MUST
  filter by BOTH `id` and `user_id` (`.eq("id", id).eq("user_id", userId)`). RLS will
  NOT protect the service path, so the `user_id` filter is the only guard against
  revoking/rotating another user's key.
- `createApiKey`/`rotateApiKey`: on the (astronomically unlikely) `key_hash`
  unique-constraint conflict, regenerate and retry once; if it still conflicts, surface a
  clean error. Never leak a raw DB error and never lose the freshly generated raw key
  silently.

### 5.6 CORS (deferred to a verification gate)

CORS is not built preemptively in v1 (primary clients are CLI/server-side and do not
issue preflights, and there is no repo precedent). It is verification gate 5 in section
9: if a browser-based connector (e.g. ChatGPT Dev Mode web) fails on the preview with a
CORS error, add permissive CORS headers attached to BOTH success and error/401 responses
(`Access-Control-Allow-Origin: *`, `Allow-Methods: GET, POST, DELETE, OPTIONS`,
`Allow-Headers: Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version`,
`Expose-Headers: Mcp-Session-Id`) plus an `OPTIONS` export at that point. Record the
outcome in the build-plan note.

### 5.7 Tests (vitest)

- `api-keys.test.ts`: `generateApiKey` -> `tm_sk_` prefix, decodes to 32 bytes, raw !=
  hash; `hashApiKey` deterministic + equals the generated hash; mask shape.
- `auth.test.ts`: `ApiKeyProvider` returns `{userId}` for a valid stored hash (mock
  service client), null for revoked/unknown/non-`tm_sk_`; `verifyTokenForMcp` maps to
  `AuthInfo` with `extra.userId`, returns `undefined` on null.
- `youtube-url.test.ts`: `parseYouTubeVideoId` for watch/youtu.be/shorts/embed/bare-id
  + invalid -> null.
- `extract-core.test.ts`: `extractCommentsForUser` throws `QuotaExceededError` when
  remaining<=0 (mock `getUserQuota`); `fetchCommentThread` maps a mocked `quotaExceeded`
  google error to `YouTubeQuotaError` and a mocked empty result to `NoCommentsError`.
- Do NOT call the real YouTube API in tests (honor the small-video quota rule; unit
  tests mock `ytClient`).

## 6. P2, MCP frontend surfaces

Routes (collision-safe with the `/mcp` server endpoint):
- Public MCP setup docs: `src/app/[locale]/mcp-docs/page.tsx` -> `/mcp-docs` (hero CTA).
- Signed-in MCP management: `src/app/[locale]/(app)/ai-access/page.tsx` -> `/ai-access`
  (side-nav "MCP / AI Access" + dashboard banner target).

### 6.1 Brand-logo components (P0 deliverable, used here)

`src/components/brand/` reusable, monochrome-friendly SVG marks sized via props:
`ClaudeLogo`, `OpenAILogo`, `CursorLogo`, `GeminiLogo`, `NousLogo`, `OpenClawLogo`.
A `ClientLogo({ client })` mapping resolves each of the 8 clients to its mark
(Claude Code + Claude Desktop -> Claude; ChatGPT + Codex -> OpenAI). Replace ALL colored
`.logo-dot`/text placeholders (landing trust pill, connect chips, connected-clients
table, docs section headers). For a mark without a readily available official SVG
(notably `OpenClawLogo`, possibly `NousLogo`), use a clean monogram/initial mark in the
same monochrome style as a fallback rather than blocking (build-time gate 8, section 9).

### 6.2 Client connection registry (single source for chips + docs)

`src/lib/mcp/clients.ts` exports an ordered list of the 8 clients with CANONICAL ids
(used as the `ClientLogo` key, the docs anchor `#<id>`, and the chip key). Each entry:
`{ id, name, logo, group: "oauth" | "apikey", connect: { command?, configPath?,
configSnippet?, uiSteps? } }` (a plain per-client data bag, not a typed rendering-mode
union; the docs page renders whichever fields are present). Endpoint is the shared
constant `https://tubemine.tech/mcp`. Canonical ids / display names / group / logo:
- `claude-code` "Claude Code" (oauth, Claude)
- `chatgpt` "ChatGPT" (oauth, OpenAI)
- `cursor` "Cursor" (oauth, Cursor)
- `codex` "Codex" (apikey, OpenAI)
- `gemini-cli` "Gemini CLI" (apikey, Gemini)
- `claude-desktop` "Claude Desktop" (apikey, Claude)
- `hermes` "Hermes" (apikey, Nous)
- `openclaw` "OpenClaw" (apikey, OpenClaw)
v1: ALL clients connect via API-key Bearer (`Authorization: Bearer tm_sk_...`); the 3
`oauth`-group members additionally show an "OAuth one-click coming soon" note but their
working v1 setup is Bearer. Snippets for `cursor`, `codex`, `hermes`, `openclaw` are
pattern stubs to verify against official docs at build time (gate 4, section 9).

### 6.3 `/ai-access` (signed-in MCP dashboard)

API-key model decision: MULTIPLE NAMED KEYS, one per client. This is the only honest
model for per-client `last_used_at` + individual revoke with static Bearer keys (a
single shared key cannot identify which client called). The design's single "Your API
key" card generalizes to a keys list; the "Connected clients" table IS the list of
non-revoked keys.

Sections (port `TubeMine MCP.html`, app shell + side-nav):
- Header "AI Assistant access" + status pill (Connected when >=1 active key).
- Quick-connect: client chips in two groups (real logos, OAuth/Key badge). Clicking a
  chip scrolls to / opens that client's setup (links to `/mcp-docs#<client>`), and
  offers "Create a key for <client>".
- Keys panel: "Create key" (optional name, default to the chosen client) -> shows the
  raw `tm_sk_...` ONCE in a copyable reveal with a "store it now" warning; existing keys
  shown masked. Per key: Rotate (revoke old + issue new, same name) and Revoke, with a
  confirm explaining the client must reconnect.
- Connected clients table: columns Client (name + logo) / Auth method / Created / Last
  used / Action (Revoke). Mobile: `data-label` stacked. Empty state when no active keys.

Server actions / route for create/rotate/revoke/list use `authUserId()` (cookie) ->
`src/lib/mcp/api-keys.ts`. Never return a raw key except on create/rotate.

### 6.4 `/mcp-docs` (public setup docs)

Port `TubeMine MCP Docs.html` using the existing `<LegalToc>`/legal-page TOC layout.
Document ONLY `get_youtube_comments` (drop the second spec card and reword "two tools"
-> "one tool" and the section-11 `analyze_youtube_comments` mention). Sections: 01 What
is TubeMine MCP, 02 Authentication (API key v1; OAuth "coming soon" for the 3 capable
clients), 03-10 per-client setup (from `clients.ts`), 11 Usage and limits (Free 5,000 /
Pro 100,000, no hard cap, fair use, shared YouTube daily quota note), 12 Troubleshooting
(key invalid; client sees no tools; "missing GET/POST/DELETE" -> use exactly
`https://tubemine.tech/mcp`). All code blocks use the canonical `/mcp` endpoint.

### 6.5 Landing MCP-hero

Port `TubeMine Landing.html` MCP-forward: trust pill with real logos
("Works in Claude, Codex, Cursor, ChatGPT, Gemini, Hermes, OpenClaw"); H1 about pulling
comments inside your AI assistant; primary CTA "Connect your AI" -> `/mcp-docs`;
secondary "Or use the web app" -> the web demo/dashboard. Keep the animated AI-chat demo
referencing only `get_youtube_comments()`. Fix the how-it-works terminal mock to say "1
tool registered" and reflect API-key auth (OAuth labeled as coming). Keep the web app as
a clearly secondary path. Do not re-introduce server-side analytics framing.

### 6.6 Pricing + MCP line

Port `TubeMine Pricing.html` and add an MCP-access line: a bullet in each Free and Pro
card ("AI assistant access via MCP") and a comparison-table row "AI assistant access
(MCP)" = Anonymous No / Free Yes / Pro Yes, with a footnote that MCP usage counts
against the same monthly comment quota (no separate or doubled quota). Keep numbers:
Anonymous 1,000 / Free 5,000 / Pro 100,000; Pro $19/mo. Keep "Trusted by 1 paying
customer" (do not inflate).

### 6.7 Dashboard MCP banner + side-nav

- Dashboard home (`(app)/dashboard`): add the "Analyze from your AI assistant [New]"
  banner (`role="note"`, plug icon) with "Connect your AI" / "Manage access" -> `/ai-access`.
- `src/components/side-nav.tsx`: add a "MCP / AI Access" item (plug icon) -> `/ai-access`.

### 6.8 i18n

Add an `mcp` namespace to `messages/en.json` and `messages/ru.json` (dashboard + docs +
connect + landing MCP strings + pricing MCP line). Extend `landing`, `pricing`,
`dashboard` namespaces as needed. EN+RU complete; `npm run i18n:check` passes.

## 7. P3, full v3 reskin of remaining pages

### 7.1 Token foundation (do first within P3, blocks the rest)

Integrate `docs/design-v3/globals.css` into `src/app/globals.css`:
- Bring in the v3 design tokens (surfaces, text, borders, feedback, sentiment accents,
  type scale, shadow, motion, `--layout-sidebar-w`/`--layout-header-h`), the base resets,
  the 4 keyframes (`spin`, `pulse-ring`, `shimmer`, `indeterminate`), and
  `prefers-reduced-motion`.
- Tailwind v4 namespace collision (CRITICAL): do NOT register the design's spacing/radius
  scale into the global `@theme` under the names `--spacing-1..8` or
  `--radius-sm/md/lg` (the existing file's global `--radius-xs`/`--radius-pill` are fine
  to keep; the harmful ones are the utility-backing `--radius-sm/md/lg` and the spacing
  scale). In Tailwind v4 `--spacing-6` IS `p-6`/`gap-6` and `--radius-lg`
  IS `rounded-lg`, so that would silently re-scale every numeric spacing utility and turn
  every stock `rounded-lg` primitive into a pill across already-shipped pages. The current
  `globals.css` already avoids this (it uses `.tm-design`-scoped `--space-*` for spacing
  and only registers `--radius-xs`/`--radius-pill` globally, scoping radius overrides like
  `--radius-lg: 9999px` under `.tm-design`). Follow that exact pattern: carry the design
  SPACING as `--space-*` (the refs' names, v3 values); carry the design RADIUS as scoped
  overrides under `.tm-design` (NOT in the global `@theme`), so Tailwind's global
  `--spacing-*`/`--radius-*` utility scale stays intact. The bespoke v3 page CSS lives
  inside the `.tm-design` scope and references the scoped vars.
- Add the landing red-accent vars (`--color-accent` and soft/line/glow variants) used by
  the hero, since the official v3 `@theme` omits them but the landing ref relies on them.
- Keep the shadcn compat tokens (`--background`, `--foreground`, `--card`, `--border`,
  `--input`, `--ring`, `--primary`, `--sidebar*`, `--radius*`, etc.) but REMAP their
  values to the v3 surfaces/text so existing `ui/*` primitives (button, card, dialog,
  input, table, skeleton, badge, separator) render correctly on the v3 palette. Dark-only
  (`color-scheme: dark`); remove any light theme.
- The remaining bespoke page CSS in `globals.css` is migrated page-by-page in 7.2 to the
  v3 values (update `--space-*` values + colors to v3; keep radius overrides scoped under
  `.tm-design`; do not introduce colliding global token names). After the swap, no page
  may reference a removed token.

### 7.2 Per-page port (match `docs/design-v3/refs/*.html` + `screenshots/*`)

Port each page's CSS + React markup to v3, verifying against the ref + desktop and
mobile screenshots. Mobile-first, dark-only, clean at 372px:
- Landing base sections (beyond the MCP-hero in P2): how-it-works, web-app strip, trust
  accelerant / dashboard preview, feature blocks (reuse the shared result block), pricing
  teaser, FAQ, final CTA, footer.
- Dashboard home: welcome strip, MCP banner (from P2), trial/welcome banners, usage card
  (ok + capped states), quick-analyze, recent analyses (+ empty state), upgrade / manage
  cards. Do NOT ship the ref's bottom-right "Design preview" panel.
- History (list + detail), Profile, Login, Privacy, Terms, Changelog, Docs (the existing
  general docs page; keep distinct from `/mcp-docs`).
- Shared chrome: app shell topbar + side-nav, public site header/footer, locale switcher,
  legal TOC, pricing cards (auth-aware), result block (already shared, verify tokens).

### 7.3 New UI primitives needed

Add the primitives the v3 components require that are not yet in `src/components/ui/`:
`accordion` (Base UI, single-open, FAQ + docs), `progress` (usage meter, primary +
destructive + indeterminate), plus a `codeblock` component (label + copy button + syntax
token classes) for docs. (Do NOT add `tabs` preemptively; the v3 connect UI uses chips,
not tabs. Add it later only if a ported ref actually requires it.) Reuse existing
primitives where they fit; follow `components.json` (base-nova on `@base-ui/react`).

## 8. P4, cleanup + i18n + QA + ship

- Remove `oauth-intro`: delete `src/app/[locale]/oauth-intro/`, any `oauth-consent`
  component, the `oauth_intro` message namespace in both locales, and every nav/link/CTA
  pointing to it. Grep to confirm zero references remain.
- i18n parity: `npm run i18n:check` passes (EN+RU). No em-dash / en-dash anywhere
  (copy, code, comments, commits).
- `npm test` passes (new MCP tests + existing suite). `npm run lint` clean.
  `next build` succeeds (the build script also runs vitest + parity).
- Apply `04_api_keys.sql` to the live shared Supabase DB (Supabase MCP `apply_migration`,
  or the Monaco-MCP fallback if CLI/password are blocked), after showing the exact SQL
  and getting user confirmation. Verify with a `select` that the table + RLS exist.
- Branch `feat/mcp-v1`; push; obtain the Vercel preview URL. Verify on preview:
  `curl https://<preview>/mcp` returns JSON-RPC (rewrite + `proxy.ts` `skipIntl`
  exclusion work);
  `tools/list` shows `get_youtube_comments`; an end-to-end `tools/call` with a real
  `tm_sk_...` key (created in `/ai-access`) on a SMALL-comment video returns raw comments
  and bumps the user's usage. Do NOT merge to `main` / deploy to prod without the user.
- Vault updates in the same effort (via `mcp__obsidian__*`): update
  `projects/yt-comments/qa/flows-summary.md` (add MCP flow rows + the corrected $19 /
  5,000 numbers) and `projects/yt-comments/mcp-build-plan.md` (mark v1 done, record the
  routes `/mcp`, `/ai-access`, `/mcp-docs`, the multi-key model, the zod gate outcome).

## 9. Build-time verification gates (must verify before relying on)

1. zod form for the SDK actually installed (raw shape vs `z.object`, v3 instance vs v4),
   section 5.1; isolate in `tool-schema.ts`.
2. `mcp-handler` installed version supports `withMcpAuth`; confirm exact export names and
   the `verifyToken`/`AuthInfo` shape by reading the installed package, not memory.
3. `/mcp` reachable on the preview: `curl https://<preview>/mcp` returns JSON-RPC (not an
   HTML 308); the `proxy.ts` `skipIntl` edit for bare `/mcp` works; `/mcp-docs` and
   `/ai-access` still localize; a locale-prefixed `POST /en/mcp` does NOT act as the
   transport.
4. Per-client connect snippets for `cursor`, `codex`, `hermes`, `openclaw` against
   current official docs (the matrix has placeholders). Use Context7 / official docs.
5. CORS: only if a browser connector fails on preview, add permissive CORS (success +
   error responses) + `OPTIONS` (section 5.6).
6. `order:"relevance"` pagination returns a reasonable count via `fetchCommentThread`
   (section 5.3).
7. After the globals.css token integration, spot-check already-shipped pages for the
   Tailwind spacing/radius collision (section 7.1): stock `p-*`/`gap-*`/`rounded-lg`
   utilities unchanged.
8. Brand-logo provenance (section 6.1): each of the 6 marks renders; for any client
   without an official SVG (e.g. OpenClaw), a monogram fallback is used.

## 10. Pre-flight runbook checklist (apply during P1/P4)

- No new env var. Reuse `YT_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` (server-only, never
  `NEXT_PUBLIC_`, never logged or returned in MCP output). Use `.trim() ||` not `??` for
  any env default in the auth/handshake path.
- Keep all DB/credential access behind the existing Supabase service layer; no inline
  `fetch("https://...supabase...")`.
- Confirm `SUPABASE_SERVICE_ROLE_KEY` + `YT_API_KEY` exist in BOTH Production and Preview
  scopes (one shared DB; the migration is visible to both immediately, so apply it before
  the preview expects the table).
- Pin Node runtime on the route. Test the full chain (Bearer -> hash -> table -> quota ->
  YT -> response) end to end; do not trust per-unit "passes". Put auth/response-shape
  assertions in vitest, not prod curl (Vercel rewrites XFF; API-key path is the identity,
  not IP).
- Public-copy framing: describe MCP as "AI assistant access / analytics access", not
  "extractor/downloader" (Polar re-review ban risk).

## 11. Out of scope (v1)

- Any OAuth provider integration (Clerk/DCR/JWKS), OAuth discovery metadata, scopes,
  refresh tokens. Only the `OAuthProvider` null stub + seam ship now.
- A second MCP tool (analytics). One tool only.
- Per-user MCP rate limiting beyond the shared global quota.
- Redis-backed MCP sessions (Streamable HTTP is stateless at our scale).
- Persisting MCP pulls into the web history (raw return only; reconsider in a later
  iteration if demand appears).

## 12. Acceptance criteria

- `mcp-handler` + SDK installed; `/mcp` (via `/api/[transport]`) answers `tools/list`
  and `tools/call` for `get_youtube_comments`.
- API-key Bearer auth works end to end (create in `/ai-access` -> connect a client ->
  tool call attributed to the user). Strategy-pattern abstraction in place; OAuth is a
  future drop-in (one new class, zero handler changes).
- `04_api_keys.sql` applied (hash-only, RLS on); generate/rotate/revoke UI works.
- MCP tool reuses extract/youtube/quota logic via the shared core; shared-quota
  exhaustion returns a clean MCP error, never a crash.
- MCP surfaces shipped: `/mcp-docs` (single tool), `/ai-access` dashboard, landing
  MCP-hero, pricing with MCP line, dashboard banner, side-nav item, real-logo
  components. `oauth-intro` removed.
- Full v3 reskin: v3 tokens integrated; every page ported to match the handoff
  refs/screenshots; mobile clean at 372px; dark-only.
- EN+RU complete; `npm run i18n:check`, `npm test`, `npm run lint`, `next build` all
  pass. No em/en-dash.
- All work on `feat/mcp-v1`; Vercel preview opened for the user. Not merged/deployed to
  prod without the user. Vault `flows-summary.md` + `mcp-build-plan.md` updated.
