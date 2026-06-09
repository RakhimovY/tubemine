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

Create `src/lib/extract-core.ts` with two levels, and refactor the existing
`src/app/api/extract/route.ts` POST signed-in branch to call them (web behavior must
remain byte-identical; preserve `order:"time"` for the web path):

```ts
// src/lib/extract-core.ts
import "server-only"
export type RawComment = {
  author: string
  text: string
  likes: number
  replies: number
  publishedAt: string
}
export type FetchOptions = { videoId: string; max: number; order: "time" | "relevance" }
export class CommentsDisabledError extends Error {}
export class VideoNotFoundError extends Error {}
export class YouTubeQuotaError extends Error {}      // maps to the global 503 / quotaExceeded
export class NoCommentsError extends Error {}

// Pure YouTube fetch + paginate + error mapping. No quota, no persistence.
export async function fetchCommentThread(opts: FetchOptions): Promise<{ comments: RawComment[]; videoMeta?: { title?: string; channelTitle?: string } }>

// Signed-in core: quota check -> fetch -> bumpUserUsage. Returns raw comments + quota.
export class QuotaExceededError extends Error { constructor(public quota: UserQuota) { super("quota_exceeded") } }
export async function extractCommentsForUser(opts: {
  userId: string; videoId: string; max?: number; order?: "time" | "relevance"
}): Promise<{ comments: RawComment[]; extracted: number; quota: UserQuota }>
```

- `extractCommentsForUser` calls `getUserQuota(userId)`; if `remaining<=0` throws
  `QuotaExceededError(quota)`. `limit = Math.min(max ?? remaining, remaining)`. Calls
  `fetchCommentThread`. On success calls `bumpUserUsage(userId, comments.length)` and
  returns `{ comments, extracted: comments.length, quota }`.
- The web route's signed-in branch is rewritten to: call `extractCommentsForUser`,
  then run its existing post-processing (sentiment/top-words/emoji) and persistence on
  the returned comments, mapping the 402/503/400/404/500 responses from the thrown
  error classes. The anonymous (IP) branch is unchanged.
- This guarantees MCP and web share identical pagination + quota accounting.

### 5.1 Packages + zod reconciliation gate (build-time)

- Install `mcp-handler` and `@modelcontextprotocol/sdk` (>= 1.26.0). Do not pin an
  unverified `mcp-handler` version; install latest and read its `package.json`/peer
  deps.
- zod gate: the repo uses zod v4; SDK 1.26 docs show zod v3 raw-shape `inputSchema`.
  At install time, determine which form the INSTALLED SDK accepts. Keep the tool's
  input schema isolated in one tiny module (`src/lib/mcp/tool-schema.ts`) exporting the
  shape, so swapping raw-shape (`{ video_url: z.string(), ... }`) vs `z.object({...})`
  is a one-file change. If SDK 1.x + zod v4 raw shapes fail at runtime, the fallback is
  to define the tool schema with the SDK's bundled/expected zod form for that one
  schema only (do NOT downgrade the app's zod). Record the chosen form in a code comment.

### 5.2 Route + rewrite + middleware exclusion

- Route file `src/app/api/[transport]/route.ts`:
  - `export const runtime = "nodejs"` (required: sha256 crypto + service-role client +
    quota code are Node-only).
  - Build the `McpServer` inside the `createMcpHandler((server) => { ... })` callback
    (no prebuilt-instance path). `config = { basePath: "/api", maxDuration: 60, verboseLogs: false }`.
  - Wrap with `withMcpAuth(handler, verifyTokenForMcp, { required: true })`.
  - Export `GET`, `POST`, `DELETE` (all three; missing any -> silent client failures).
    Also export an `OPTIONS` handler returning CORS headers (see 5.6).
- Public endpoint: `next.config.ts` rewrite `{ source: "/mcp", destination: "/api/mcp" }`
  so clients use `https://tubemine.tech/mcp`. `[transport]` resolves to `mcp`.
- i18n middleware: the next-intl matcher MUST exclude exactly `/mcp` and all `/api/*`
  so the transport is reachable unprefixed and not locale-rewritten to `/en/mcp`. Use a
  matcher whose negative lookahead matches `mcp` only as a full segment (so `/mcp-docs`
  is still localized). Verify on preview with `curl https://<preview>/mcp` returning a
  JSON-RPC response (not an HTML redirect).

### 5.3 The tool, `get_youtube_comments`

- `inputSchema` (zod, form per 5.1):
  - `video_url: string` (a YouTube URL or bare 11-char ID), `.describe(...)`.
  - `sort: enum("relevance","time")`, optional, default `"relevance"`.
  - `max: number int`, optional, default 100, clamped to `[1, PRO_MONTHLY_CAP]`.
- Handler:
  1. Read `userId` from `extra.authInfo.extra.userId`. If absent, return
     `{ isError: true, content: [text: "Unauthorized"] }` (defensive; auth already
     enforced by `withMcpAuth`).
  2. `const videoId = parseYouTubeVideoId(video_url)`. If null, return `isError` text
     "Could not parse a YouTube video id from: <input>".
  3. `await extractCommentsForUser({ userId, videoId, max, order: sort })`.
  4. On `QuotaExceededError`: return `isError` text describing the monthly cap and
     reset date (from `err.quota`).
  5. On `YouTubeQuotaError`: return `isError` text "TubeMine has hit its YouTube API
     daily quota. Please try again tomorrow." (the global 503 condition, surfaced as a
     clean MCP error, never a crash).
  6. On `CommentsDisabledError`/`VideoNotFoundError`/`NoCommentsError`: matching
     `isError` text.
  7. Success: return `{ content: [{ type:"text", text: JSON.stringify(payload) }] }`
     where `payload = { video: { id, title?, channel? }, count, comments: RawComment[] }`.
     RawComment fields: `author, text, likes, replies, publishedAt`. No sentiment field
     (raw only).
- `parseYouTubeVideoId(input: string): string | null` in `src/lib/youtube-url.ts`:
  accepts `watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, and a bare 11-char id;
  validates `/^[\w-]{11}$/`. If a reusable client-side parser already exists in the
  repo, extract the shared logic here and have the client import it (single source of
  truth); otherwise create it fresh.

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

### 5.5 API keys library + data model

`src/lib/mcp/api-keys.ts` (all DB ops via `createServiceClient()`):

```ts
export function generateApiKey(): { raw: string; hash: string }
// raw = "tm_sk_" + randomBytes(32).toString("base64url"); hash = sha256(raw) hex
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

### 5.6 CORS

The MCP endpoint is a public API called by varied clients (CLI = no CORS; some web
connectors may preflight). Export an `OPTIONS` handler and attach permissive CORS
headers (`Access-Control-Allow-Origin: *`, `Allow-Methods: GET, POST, DELETE, OPTIONS`,
`Allow-Headers: Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version`,
`Expose-Headers: Mcp-Session-Id`) on responses. No repo precedent exists, so this is an
explicit decision; verify a cross-origin preflight on preview.

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
table, docs section headers).

### 6.2 Client connection registry (single source for chips + docs)

`src/lib/mcp/clients.ts` exports an ordered list of the 8 clients:
`{ id, name, logo, group: "oauth" | "apikey", endpoint: "https://tubemine.tech/mcp",
setup: { kind: "cli" | "config-file" | "ui", code?, filePath?, steps? } }`.
v1: ALL clients connect via API-key Bearer; the 3 "oauth" group members show an
"OAuth one-click coming soon" note but the working v1 setup is Bearer. Per-client
snippets use `https://tubemine.tech/mcp` with `Authorization: Bearer tm_sk_...`.
Snippets for Cursor / Codex / Hermes / OpenClaw are pattern stubs to be verified against
official docs at build time (see section 9). Groups:
- OAuth-capable (v2): Claude Code, ChatGPT (Dev Mode), Cursor.
- API-key (Bearer): Codex CLI, Gemini CLI, Claude Desktop, Hermes (Nous), OpenClaw.

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
- Replace the design-token layer with the v3 `@theme` block (surfaces, text, borders,
  feedback, sentiment accents, type scale, spacing `--spacing-N`, radii, shadow, motion,
  `--layout-sidebar-w`/`--layout-header-h`), plus the base resets and the 4 keyframes
  (`spin`, `pulse-ring`, `shimmer`, `indeterminate`), and `prefers-reduced-motion`.
- Add the landing red-accent vars (`--color-accent` and soft/line/glow variants) used by
  the hero, since the official v3 `@theme` omits them but the landing ref relies on them.
- Keep the shadcn compat tokens (`--background`, `--foreground`, `--card`, `--border`,
  `--input`, `--ring`, `--primary`, `--sidebar*`, `--radius*`, etc.) but REMAP their
  values to the v3 surfaces/text so existing `ui/*` primitives (button, card, dialog,
  input, table, skeleton, badge, separator) render correctly on the v3 palette. Dark-only
  (`color-scheme: dark`); remove any light theme.
- The remaining bespoke page CSS in `globals.css` is migrated page-by-page in 7.2 to the
  v3 tokens (variable renames `--space-N` -> `--spacing-N`, color values -> v3). After
  the swap, no page may reference a removed token.

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
destructive + indeterminate), `tabs` (if the connect UI uses tabs), plus a `codeblock`
component (label + copy button + syntax token classes) for docs. Reuse existing
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
  `curl https://<preview>/mcp` returns JSON-RPC (rewrite + middleware exclusion work);
  `tools/list` shows `get_youtube_comments`; an end-to-end `tools/call` with a real
  `tm_sk_...` key (created in `/ai-access`) on a SMALL-comment video returns raw comments
  and bumps the user's usage. Do NOT merge to `main` / deploy to prod without the user.
- Vault updates in the same effort (via `mcp__obsidian__*`): update
  `projects/yt-comments/qa/flows-summary.md` (add MCP flow rows + the corrected $19 /
  5,000 numbers) and `projects/yt-comments/mcp-build-plan.md` (mark v1 done, record the
  routes `/mcp`, `/ai-access`, `/mcp-docs`, the multi-key model, the zod gate outcome).

## 9. Build-time verification gates (must verify before relying on)

1. zod form for the SDK actually installed (raw shape v3 vs `z.object` v4), section 5.1.
2. `mcp-handler` installed version supports `withMcpAuth`; confirm exact export names by
   reading the installed package, not memory.
3. `/mcp` rewrite + i18n middleware exclusion reachable on the preview (curl).
4. Per-client connect snippets for Cursor / Codex / Hermes / OpenClaw against current
   official docs (the matrix has placeholders). Use Context7 / official docs at build.
5. CORS preflight behavior on preview (section 5.6).

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
