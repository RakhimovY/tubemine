# TubeMine MCP v1 + v3 Design Port, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a remote MCP server exposing one tool (`get_youtube_comments`, raw comments, API-key auth behind a strategy pattern) plus a full v3 design reskin of the live Next.js app, on branch `feat/mcp-v1`, verified on a Vercel preview, not merged to prod without the user.

**Architecture:** Reuse the existing extract pipeline via a new shared `extract-core.ts` so MCP and web cannot drift. Auth is static `tm_sk_` keys (sha256-hashed in a new `user_api_keys` table) resolved by an `AuthProvider` strategy with a `null` OAuth stub. The v3 design tokens are integrated into the existing `globals.css` without hijacking Tailwind v4's `--spacing-*`/`--radius-*` utility scale (radius overrides stay scoped under `.tm-design`). Pages are recreated from `docs/design-v3/refs/*.html` + `screenshots/*`.

**Tech Stack:** Next.js 16.2.6 App Router, React 19, TypeScript, Tailwind v4, shadcn on `@base-ui/react`, Supabase (`@supabase/ssr`), `mcp-handler` + `@modelcontextprotocol/sdk`, zod v4 (with a `zod3` alias seam for the tool schema if needed), next-intl (EN+RU), Upstash/Vercel KV, Polar, vitest.

**Source of truth:** the spec at `docs/superpowers/specs/2026-06-09-tubemine-mcp-v1-and-v3-redesign-design.md` (read it; this plan implements it). Design refs at `docs/design-v3/`.

**Conventions for every task:** no em-dash/en-dash anywhere (copy, code, comments, commits); new UI copy goes in BOTH `messages/en.json` and `messages/ru.json` and must pass `npm run i18n:check`; tests run with `npm test`; lint with `npm run lint`. Commit after each task. Test analysis flows ONLY against small-comment YouTube videos (5-50 comments). Branch `feat/mcp-v1` is already created and checked out.

---

## Phase P0, Design-system foundation

### Task P0.1: Integrate v3 design tokens into globals.css (no Tailwind utility hijack)

**Files:**
- Modify: `src/app/globals.css`
- Reference: `docs/design-v3/globals.css`, `docs/design-v3/tokens.md`

- [ ] **Step 1: Inventory the collision surface**

Run: `grep -nE '^\s*--(spacing|radius)-' docs/design-v3/globals.css` and `grep -nE '@theme|\.tm-design|--radius-|--space-' src/app/globals.css | head -60`
Expected: confirm design-v3 registers `--spacing-1..8` and `--radius-xs/sm/md/lg` inside `@theme`, and that the current `globals.css` keeps `.tm-design`-scoped `--space-*` + `--radius-lg: 9999px` and only global `--radius-xs`/`--radius-pill`.

- [ ] **Step 2: Bring in the v3 token values WITHOUT the colliding `@theme` names**

In `src/app/globals.css`, add/update the v3 design tokens: surfaces (`--color-surface-*`), text (`--color-text-*`), borders (`--color-border-*`), feedback (`--color-feedback-*`), sentiment accents (`--color-accent-positive/negative`, `--color-sentiment-neutral`), type scale (`--font-size-*`, `--font-weight-*`, `--font-family-*`), shadow (`--shadow-1/2`), motion (`--duration-*`, `--ease-out`), layout (`--layout-sidebar-w`, `--layout-header-h`), and the landing red-accent vars (`--color-accent`, plus soft/line/glow variants from `docs/design-v3/refs/TubeMine Landing.html`). Carry the design SPACING scale as `--space-1..8` (the refs' names, v3 values: 4/6/8/10/12/16/20/24px). Do NOT register `--spacing-1..8` or `--radius-sm/md/lg` in the global `@theme`. Keep design radius overrides (`--radius-sm/md/lg`, the 9999px pill) scoped under `.tm-design` exactly as the file already does. Add the 4 keyframes if missing (`spin`, `pulse-ring`, `shimmer`, `indeterminate`) and the `prefers-reduced-motion` block.

- [ ] **Step 3: Remap shadcn compat tokens to v3 surfaces**

Update the `:root, .dark` shadcn tokens (`--background`, `--foreground`, `--card`, `--popover`, `--border`, `--input`, `--ring`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--sidebar*`) so their values resolve to the v3 surfaces/text/border colors (so `ui/*` primitives render on the v3 palette). Keep dark-only (`color-scheme: dark`); ensure no light theme remains.

- [ ] **Step 4: Build sanity + utility-scale spot check**

Run: `npm run build 2>&1 | tail -20`
Expected: build succeeds (it runs vitest + parity + next build). Then start dev (`npm run dev`) and confirm an existing page using stock `p-*`/`gap-*`/`rounded-lg` (e.g. login) is not visually re-scaled (gate 7). Stop dev.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): integrate v3 tokens into globals.css without Tailwind utility collision"
```

### Task P0.2: Brand-logo components

**Files:**
- Create: `src/components/brand/claude-logo.tsx`, `openai-logo.tsx`, `cursor-logo.tsx`, `gemini-logo.tsx`, `nous-logo.tsx`, `openclaw-logo.tsx`, `client-logo.tsx`, `index.ts`
- Reference: official brand marks; `docs/design-v3/refs/TubeMine MCP.html` (chip layout)

- [ ] **Step 1: Write each logo as a monochrome SVG component**

Each file exports a default React component `({ className }: { className?: string })` returning an inline `<svg viewBox=... fill="currentColor" aria-hidden>` of the brand mark, sized via `className` (default `h-5 w-5`). Use real official marks for Claude (Anthropic), OpenAI, Cursor, Gemini (Google), Nous Research. For `OpenClawLogo` (and `NousLogo` if no clean official SVG is available), use a tasteful monogram/initial mark in the same monochrome style (gate 8 fallback). `currentColor` lets them inherit text color (monochrome design).

- [ ] **Step 2: Write the `ClientLogo` resolver**

```tsx
// src/components/brand/client-logo.tsx
import ClaudeLogo from "./claude-logo"
import OpenAILogo from "./openai-logo"
import CursorLogo from "./cursor-logo"
import GeminiLogo from "./gemini-logo"
import NousLogo from "./nous-logo"
import OpenClawLogo from "./openclaw-logo"

const MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "claude-code": ClaudeLogo, "claude-desktop": ClaudeLogo,
  chatgpt: OpenAILogo, codex: OpenAILogo,
  cursor: CursorLogo, "gemini-cli": GeminiLogo,
  hermes: NousLogo, openclaw: OpenClawLogo,
}
export function ClientLogo({ client, className }: { client: string; className?: string }) {
  const Logo = MAP[client] ?? OpenClawLogo
  return <Logo className={className} />
}
```

- [ ] **Step 3: Re-export from index, typecheck**

`src/components/brand/index.ts` re-exports all. Run: `npx tsc --noEmit 2>&1 | head -20`. Expected: no new type errors in `src/components/brand`.

- [ ] **Step 4: Commit**

```bash
git add src/components/brand
git commit -m "feat(brand): real AI client logo components with ClientLogo resolver"
```

### Task P0.3: Client connection registry

**Files:**
- Create: `src/lib/mcp/clients.ts`
- Reference: spec 6.2; `~/vault/research/2026-06-08/mcp-clients-connection-matrix.md`

- [ ] **Step 1: Define the registry**

```ts
// src/lib/mcp/clients.ts
export const MCP_ENDPOINT = "https://tubemine.tech/mcp"
export type McpClientGroup = "oauth" | "apikey"
export type McpClient = {
  id: string
  name: string
  logo: string                 // ClientLogo key (same as id)
  group: McpClientGroup
  connect: { command?: string; configPath?: string; configSnippet?: string; uiSteps?: string[] }
}
export const MCP_CLIENTS: McpClient[] = [ /* 8 entries, canonical ids per spec 6.2 */ ]
```

Populate all 8 with canonical ids (`claude-code`, `chatgpt`, `cursor`, `codex`, `gemini-cli`, `claude-desktop`, `hermes`, `openclaw`), `group`, and a v1 API-key Bearer `connect` config using `MCP_ENDPOINT` and `Authorization: Bearer tm_sk_...`. Mark `cursor`/`codex`/`hermes`/`openclaw` snippets with a `// VERIFY (gate 4)` comment.

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit 2>&1 | head -10`. Expected: clean.
```bash
git add src/lib/mcp/clients.ts
git commit -m "feat(mcp): client connection registry (8 clients, canonical ids)"
```

### Task P0.4: New UI primitives (accordion, progress, codeblock)

**Files:**
- Create: `src/components/ui/accordion.tsx`, `src/components/ui/progress.tsx`, `src/components/ui/codeblock.tsx`
- Reference: `components.json` (base-nova on `@base-ui/react`); existing `src/components/ui/*` for style

- [ ] **Step 1: Add Base UI accordion**

Implement a single-open accordion using `@base-ui/react` Accordion primitives, matching the existing `ui/*` styling conventions (cva variants, `cn` from `@/lib/utils`). Caret rotates 180deg, max-height animates 200ms.

- [ ] **Step 2: Add progress**

`Progress({ value, variant }: { value?: number; variant?: "primary" | "destructive" })` using `@base-ui/react` or a styled `<div>` meter; indeterminate when `value` is undefined (use the `indeterminate` keyframe).

- [ ] **Step 3: Add codeblock**

`CodeBlock({ label, code, children })` renders a labeled box with the highlighted `children` and a copy button that copies `code` (raw) and shows a "Copied" state for ~1.5s. Use `lucide-react` Copy/Check icons.

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit 2>&1 | head -10`. Expected: clean.
```bash
git add src/components/ui/accordion.tsx src/components/ui/progress.tsx src/components/ui/codeblock.tsx
git commit -m "feat(ui): accordion, progress, codeblock primitives"
```

---

## Phase P1, MCP backend

### Task P1.1: Install packages, resolve zod form

**Files:**
- Modify: `package.json`, lockfile
- Create: `src/lib/mcp/tool-schema.ts`

- [ ] **Step 1: Install**

Run: `npm install mcp-handler @modelcontextprotocol/sdk`
Then read the installed versions: `node -e "console.log(require('mcp-handler/package.json').version, require('@modelcontextprotocol/sdk/package.json').version)"`. Record them. Confirm `withMcpAuth`, `createMcpHandler` exports exist: `node -e "console.log(Object.keys(require('mcp-handler')))"` (gate 2).

- [ ] **Step 2: Probe the zod form (gate 1)**

Write a throwaway check: build a raw-shape `{ video_url: z.string() }` with the app's zod v4 and attempt `new McpServer(...).registerTool("t", { description:"d", inputSchema: shape }, async()=>({content:[]}))` in a tiny script run with `npx tsx` (or a vitest). If it throws a zod-instance/validation error, fall to the alias path: `npm install zod3@npm:zod@^3` and author the tool schema with `import { z } from "zod3"`. Otherwise use app zod v4. Delete the throwaway.

- [ ] **Step 3: Write `tool-schema.ts`**

```ts
// src/lib/mcp/tool-schema.ts
// zod form chosen per gate 1: <record the choice here in a comment>
import { z } from "zod"   // or "zod3" if the alias path was needed
export const MCP_MAX_PER_CALL = 2000
export const getYoutubeCommentsShape = {
  video_url: z.string().describe("A YouTube video URL or bare 11-char video ID"),
  sort: z.enum(["relevance", "time"]).optional().describe("Comment sort order (default relevance)"),
  max: z.number().optional().describe("Max comments to fetch (default 100, capped per call)"),
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/mcp/tool-schema.ts
git commit -m "feat(mcp): install mcp-handler + sdk, resolve zod form for tool schema"
```

### Task P1.2: Migration 04_api_keys.sql (write file; application is a later gated step)

**Files:**
- Create: `supabase/migrations/04_api_keys.sql`
- Reference: spec 5.5

- [ ] **Step 1: Write the migration exactly per spec 5.5**

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

- [ ] **Step 2: Commit (do NOT apply to the DB yet)**

```bash
git add supabase/migrations/04_api_keys.sql
git commit -m "feat(db): 04_api_keys.sql migration for user_api_keys"
```

Application to the live shared Supabase DB happens in Task P4.2 (user-confirmed, additive, reversible).

### Task P1.3: API key library + tests

**Files:**
- Create: `src/lib/mcp/api-keys.ts`, `src/lib/mcp/__tests__/api-keys.test.ts`
- Reuse: `createServiceClient` from `src/lib/supabase/server.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/mcp/__tests__/api-keys.test.ts
import { describe, it, expect } from "vitest"
import { generateApiKey, hashApiKey, maskApiKey } from "../api-keys"

describe("api-keys", () => {
  it("generateApiKey returns a tm_sk_ key whose hash matches hashApiKey", () => {
    const { raw, hash } = generateApiKey()
    expect(raw.startsWith("tm_sk_")).toBe(true)
    expect(Buffer.from(raw.slice("tm_sk_".length), "base64url").length).toBe(32)
    expect(raw).not.toBe(hash)
    expect(hashApiKey(raw)).toBe(hash)
  })
  it("hashApiKey is deterministic 64-hex", () => {
    expect(hashApiKey("tm_sk_abc")).toBe(hashApiKey("tm_sk_abc"))
    expect(hashApiKey("tm_sk_abc")).toMatch(/^[0-9a-f]{64}$/)
  })
  it("maskApiKey returns a tm_sk_ masked string with no raw bytes", () => {
    expect(maskApiKey()).toMatch(/^tm_sk_[••]+$/)
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `npm test -- api-keys`
Expected: FAIL (module not found / exports undefined).

- [ ] **Step 3: Implement the pure helpers**

```ts
// src/lib/mcp/api-keys.ts
import "server-only"
import { randomBytes, createHash } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/server"

const PREFIX = "tm_sk_"
export function generateApiKey(): { raw: string; hash: string } {
  const raw = PREFIX + randomBytes(32).toString("base64url")
  return { raw, hash: hashApiKey(raw) }
}
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}
export function maskApiKey(): string {
  return PREFIX + "•".repeat(20)
}

export type ApiKeyRow = {
  id: string; name: string | null; created_at: string; last_used_at: string | null; is_revoked: boolean
}

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  const db = createServiceClient()
  const { data } = await db.from("user_api_keys")
    .select("id, name, created_at, last_used_at, is_revoked")
    .eq("user_id", userId).eq("is_revoked", false)
    .order("created_at", { ascending: false })
  return (data ?? []) as ApiKeyRow[]
}

export async function createApiKey(userId: string, name?: string): Promise<{ row: ApiKeyRow; raw: string }> {
  const db = createServiceClient()
  for (let attempt = 0; attempt < 2; attempt++) {
    const { raw, hash } = generateApiKey()
    const { data, error } = await db.from("user_api_keys")
      .insert({ user_id: userId, key_hash: hash, name: name ?? null })
      .select("id, name, created_at, last_used_at, is_revoked").single()
    if (!error && data) return { row: data as ApiKeyRow, raw }
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error("Could not create API key")
  }
  throw new Error("Could not create API key (hash conflict)")
}

export async function revokeApiKey(userId: string, id: string): Promise<void> {
  const db = createServiceClient()
  await db.from("user_api_keys").update({ is_revoked: true }).eq("id", id).eq("user_id", userId)
}

export async function rotateApiKey(userId: string, id: string): Promise<{ row: ApiKeyRow; raw: string }> {
  const db = createServiceClient()
  const { data: old } = await db.from("user_api_keys")
    .select("name").eq("id", id).eq("user_id", userId).single()
  await revokeApiKey(userId, id)
  return createApiKey(userId, (old?.name as string | null) ?? undefined)
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- api-keys`
Expected: PASS (the 3 pure-helper tests; DB ops are exercised in P1.4/P4.3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/api-keys.ts src/lib/mcp/__tests__/api-keys.test.ts
git commit -m "feat(mcp): api-keys lib (generate/hash/mask/list/create/revoke/rotate) + tests"
```

### Task P1.4: Auth strategy pattern + tests

**Files:**
- Create: `src/lib/mcp/auth/types.ts`, `api-key-provider.ts`, `oauth-provider.ts`, `index.ts`, `__tests__/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/mcp/auth/__tests__/auth.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const single = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: single }) }), update: () => ({ eq: () => ({ eq: () => ({}) }) }) }),
  }),
}))
import { ApiKeyProvider } from "../api-key-provider"
import { verifyTokenForMcp } from "../index"

function req(auth?: string) { return new Request("https://x/mcp", { headers: auth ? { authorization: auth } : {} }) }

beforeEach(() => single.mockReset())

describe("ApiKeyProvider", () => {
  it("returns userId for a valid stored key", async () => {
    single.mockResolvedValue({ data: { user_id: "u1", is_revoked: false } })
    const r = await new ApiKeyProvider().authenticate(req("Bearer tm_sk_abc"))
    expect(r).toEqual({ userId: "u1" })
  })
  it("returns null for a revoked key", async () => {
    single.mockResolvedValue({ data: { user_id: "u1", is_revoked: true } })
    expect(await new ApiKeyProvider().authenticate(req("Bearer tm_sk_abc"))).toBeNull()
  })
  it("returns null for unknown key", async () => {
    single.mockResolvedValue({ data: null })
    expect(await new ApiKeyProvider().authenticate(req("Bearer tm_sk_abc"))).toBeNull()
  })
  it("returns null for a non-tm_sk_ bearer", async () => {
    expect(await new ApiKeyProvider().authenticate(req("Bearer oauthtok"))).toBeNull()
  })
  it("returns null when no auth header", async () => {
    expect(await new ApiKeyProvider().authenticate(req())).toBeNull()
  })
})
describe("verifyTokenForMcp", () => {
  it("adapts a valid key to AuthInfo with extra.userId", async () => {
    single.mockResolvedValue({ data: { user_id: "u1", is_revoked: false } })
    const info = await verifyTokenForMcp(req("Bearer tm_sk_abc"), "tm_sk_abc")
    expect(info?.extra).toMatchObject({ userId: "u1" })
  })
  it("returns undefined (401) on failure", async () => {
    single.mockResolvedValue({ data: null })
    expect(await verifyTokenForMcp(req("Bearer tm_sk_x"), "tm_sk_x")).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- auth`. Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

```ts
// src/lib/mcp/auth/types.ts
export interface AuthProvider {
  authenticate(req: Request, bearerToken?: string): Promise<{ userId: string } | null>
}
```

```ts
// src/lib/mcp/auth/api-key-provider.ts
import "server-only"
import type { AuthProvider } from "./types"
import { createServiceClient } from "@/lib/supabase/server"
import { hashApiKey } from "../api-keys"

export class ApiKeyProvider implements AuthProvider {
  async authenticate(req: Request, bearerToken?: string): Promise<{ userId: string } | null> {
    const token = bearerToken ?? req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1]
    if (!token || !token.startsWith("tm_sk_")) return null
    const hash = hashApiKey(token)
    const db = createServiceClient()
    const { data } = await db.from("user_api_keys")
      .select("user_id, is_revoked").eq("key_hash", hash).single()
    if (!data || data.is_revoked) return null
    void db.from("user_api_keys").update({ last_used_at: new Date().toISOString() }).eq("key_hash", hash)
    return { userId: data.user_id as string }
  }
}
```

```ts
// src/lib/mcp/auth/oauth-provider.ts
import type { AuthProvider } from "./types"
// v2 seam: validate JWT/JWKS here. v1 stub returns null so any non-tm_sk_ bearer 401s.
export class OAuthProvider implements AuthProvider {
  async authenticate(): Promise<{ userId: string } | null> { return null }
}
```

```ts
// src/lib/mcp/auth/index.ts
import "server-only"
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"
import type { AuthProvider } from "./types"
import { ApiKeyProvider } from "./api-key-provider"

export function getAuthProvider(): AuthProvider {
  return new ApiKeyProvider()   // v2: compose ApiKeyProvider + OAuthProvider here
}
export async function verifyTokenForMcp(req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  const id = await getAuthProvider().authenticate(req, bearerToken)
  if (!id) return undefined
  return { token: bearerToken ?? "", clientId: "tubemine-api-key", scopes: [], extra: { userId: id.userId } }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- auth`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/auth
git commit -m "feat(mcp): AuthProvider strategy (ApiKeyProvider + OAuth stub) + verifyTokenForMcp + tests"
```

### Task P1.5: YouTube URL parser + tests

**Files:**
- Create: `src/lib/youtube-url.ts`, `src/lib/__tests__/youtube-url.test.ts`
- Reference: `src/lib/types.ts` `extractVideoId` (DO NOT modify)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/youtube-url.test.ts
import { describe, it, expect } from "vitest"
import { parseYouTubeVideoId } from "../youtube-url"

describe("parseYouTubeVideoId", () => {
  const id = "dQw4w9WgXcQ"
  it("accepts a bare 11-char id", () => expect(parseYouTubeVideoId(id)).toBe(id))
  it("watch?v=", () => expect(parseYouTubeVideoId(`https://www.youtube.com/watch?v=${id}&t=2`)).toBe(id))
  it("youtu.be", () => expect(parseYouTubeVideoId(`https://youtu.be/${id}`)).toBe(id))
  it("shorts", () => expect(parseYouTubeVideoId(`https://youtube.com/shorts/${id}`)).toBe(id))
  it("embed", () => expect(parseYouTubeVideoId(`https://www.youtube.com/embed/${id}`)).toBe(id))
  it("rejects junk", () => expect(parseYouTubeVideoId("not a url")).toBeNull())
  it("rejects wrong-length id", () => expect(parseYouTubeVideoId("abc")).toBeNull())
})
```

- [ ] **Step 2: Run, verify fail.** Run: `npm test -- youtube-url`. Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/youtube-url.ts
const ID = /^[\w-]{11}$/
const URL_PAT = /(?:v=|vi=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/
export function parseYouTubeVideoId(input: string): string | null {
  const s = input.trim()
  if (ID.test(s)) return s
  const m = s.match(URL_PAT)
  return m ? m[1] : null
}
```

- [ ] **Step 4: Run, verify pass.** Run: `npm test -- youtube-url`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/youtube-url.ts src/lib/__tests__/youtube-url.test.ts
git commit -m "feat(mcp): parseYouTubeVideoId (URL + bare id) + tests"
```

### Task P1.6: extract-core refactor + tests

**Files:**
- Create: `src/lib/extract-core.ts`, `src/lib/__tests__/extract-core.test.ts`
- Modify: `src/app/api/extract/route.ts` (signed-in branch calls the core)
- Reuse: `ytClient` (`src/lib/youtube.ts`), `getUserQuota`/`bumpUserUsage`/`UserQuota` (`src/lib/quota.ts`), `scoreCommentsSentiment` (`src/lib/sentiment`), `StoredComment` (`src/lib/comments.ts`), `saveAnalysis` (`src/lib/analyses`)

- [ ] **Step 1: Read the current route to copy the exact loop + error map**

Read `src/app/api/extract/route.ts` (the signed-in branch, the paginate loop, the 403/404/quotaExceeded mapping). The core must reproduce it.

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/__tests__/extract-core.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const listMock = vi.fn()
vi.mock("@/lib/youtube", () => ({ ytClient: () => ({ commentThreads: { list: listMock } }) }))
const getUserQuota = vi.fn(); const bumpUserUsage = vi.fn()
vi.mock("@/lib/quota", () => ({ getUserQuota: (...a:any)=>getUserQuota(...a), bumpUserUsage: (...a:any)=>bumpUserUsage(...a) }))

import { extractCommentsForUser, fetchCommentThread, QuotaExceededError, YouTubeQuotaError, NoCommentsError } from "../extract-core"

beforeEach(() => { listMock.mockReset(); getUserQuota.mockReset(); bumpUserUsage.mockReset() })

function page(items: any[], next?: string) { return { data: { items, nextPageToken: next } } }
function comment(text: string) { return { snippet: { topLevelComment: { snippet: { authorDisplayName: "a", textDisplay: text, likeCount: 1, publishedAt: "2026-01-01" } }, totalReplyCount: 0 } } }

describe("extractCommentsForUser", () => {
  it("throws QuotaExceededError when remaining<=0", async () => {
    getUserQuota.mockResolvedValue({ tier: "free", cap: 5000, used: 5000, remaining: 0, resetAt: "2026-07-01T00:00:00.000Z" })
    await expect(extractCommentsForUser({ userId: "u", videoId: "dQw4w9WgXcQ" })).rejects.toBeInstanceOf(QuotaExceededError)
    expect(bumpUserUsage).not.toHaveBeenCalled()
  })
  it("returns comments and bumps usage by actual count", async () => {
    getUserQuota.mockResolvedValue({ tier: "pro", cap: 100000, used: 0, remaining: 100000, resetAt: "x" })
    listMock.mockResolvedValueOnce(page([comment("hi"), comment("yo")]))
    bumpUserUsage.mockResolvedValue(2)
    const r = await extractCommentsForUser({ userId: "u", videoId: "dQw4w9WgXcQ", max: 10 })
    expect(r.extracted).toBe(2)
    expect(bumpUserUsage).toHaveBeenCalledWith("u", 2)
    expect(r.truncatedByQuota).toBe(false)
  })
})
describe("fetchCommentThread error map", () => {
  it("maps google quotaExceeded (0 collected) to YouTubeQuotaError", async () => {
    listMock.mockRejectedValueOnce({ code: 403, errors: [{ reason: "quotaExceeded" }] })
    await expect(fetchCommentThread({ videoId: "dQw4w9WgXcQ", max: 10, order: "time" })).rejects.toBeInstanceOf(YouTubeQuotaError)
  })
  it("empty result with no error returns [] (no throw)", async () => {
    listMock.mockResolvedValueOnce(page([]))
    await expect(fetchCommentThread({ videoId: "dQw4w9WgXcQ", max: 10, order: "time" })).resolves.toEqual([])
  })
})
```

- [ ] **Step 3: Run, verify fail.** Run: `npm test -- extract-core`. Expected: FAIL.

- [ ] **Step 4: Implement `extract-core.ts`** per spec 5.0. Export ALL FIVE error classes (`CommentsDisabledError`, `VideoNotFoundError`, `YouTubeQuotaError`, `NoCommentsError`, `QuotaExceededError`) since P1.7 imports all five. Implement the `RawComment` coercions, the partial-fetch contract, `fetchCommentThread` returning `RawComment[]`, and `extractCommentsForUser` with `effectiveMax`/`limit`/`truncatedByQuota = comments.length >= limit && remaining < effectiveMax`, `bumpUserUsage(userId, comments.length)`. Mirror the route's loop (PAGE_SIZE 100, `textFormat:"plainText"`, `order`, cap to `max`). Throw typed errors only when 0 collected; swallow-and-return-partial otherwise.

- [ ] **Step 5: Run, verify pass.** Run: `npm test -- extract-core`. Expected: PASS.

- [ ] **Step 6: Refactor the route to call the core**

In `src/app/api/extract/route.ts`, replace the signed-in branch's inline quota-check + fetch loop with `extractCommentsForUser(...)` (order "time"), then keep the existing sentiment/top-words/emoji + best-effort `videos.list` + `saveAnalysis` (build `StoredComment[]` by index with `sentiment` from `scoreCommentsSentiment`), and map `QuotaExceededError`->402, `YouTubeQuotaError`->503, `CommentsDisabledError`->400, `VideoNotFoundError`->404, `NoCommentsError`->500. Anonymous (IP) branch unchanged.

- [ ] **Step 7: Run the full suite, verify the existing extract tests still pass**

Run: `npm test`. Expected: PASS (existing `src/app/api/extract/__tests__` green; web behavior preserved).

- [ ] **Step 8: Commit**

```bash
git add src/lib/extract-core.ts src/lib/__tests__/extract-core.test.ts src/app/api/extract/route.ts
git commit -m "refactor(extract): shared extract-core; route signed-in branch reuses it"
```

### Task P1.7: MCP route + tool + rewrite + proxy exclusion

**Files:**
- Create: `src/app/api/[transport]/route.ts`
- Modify: `next.config.ts`, `src/proxy.ts`
- Reuse: `verifyTokenForMcp`, `extractCommentsForUser`, `parseYouTubeVideoId`, `getYoutubeCommentsShape`/`MCP_MAX_PER_CALL`

- [ ] **Step 1: Implement the route**

```ts
// src/app/api/[transport]/route.ts
import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { verifyTokenForMcp } from "@/lib/mcp/auth"
import { getYoutubeCommentsShape, MCP_MAX_PER_CALL } from "@/lib/mcp/tool-schema"
import { parseYouTubeVideoId } from "@/lib/youtube-url"
import {
  extractCommentsForUser, QuotaExceededError, YouTubeQuotaError,
  CommentsDisabledError, VideoNotFoundError, NoCommentsError,
} from "@/lib/extract-core"

export const runtime = "nodejs"
export const maxDuration = 60

const base = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_youtube_comments",
      { description: "Fetch raw YouTube comments (author, text, likes, replies, timestamp) for a video. Your AI does any analysis.", inputSchema: getYoutubeCommentsShape },
      async ({ video_url, sort, max }, extra) => {
        const userId = (extra?.authInfo?.extra as { userId?: string } | undefined)?.userId
        if (!userId) return { content: [{ type: "text", text: "Unauthorized." }], isError: true }
        const videoId = parseYouTubeVideoId(String(video_url))
        if (!videoId) return { content: [{ type: "text", text: `Could not parse a YouTube video id from: ${video_url}` }], isError: true }
        const clamped = Math.min(Math.max(1, Math.floor(Number(max ?? 100)) || 100), MCP_MAX_PER_CALL)
        try {
          const r = await extractCommentsForUser({ userId, videoId, max: clamped, order: (sort as "relevance" | "time") ?? "relevance" })
          const payload = { video_id: videoId, count: r.extracted, truncated_by_quota: r.truncatedByQuota, sort: sort ?? "relevance", comments: r.comments }
          return { content: [{ type: "text", text: JSON.stringify(payload) }] }
        } catch (e) {
          if (e instanceof QuotaExceededError) {
            const q = e.quota, reset = q.resetAt.slice(0, 10)
            return { content: [{ type: "text", text: `Monthly comment quota reached: used ${q.used}/${q.cap} on the ${q.tier} plan. Resets ${reset}. Upgrade or wait for the reset.` }], isError: true }
          }
          if (e instanceof YouTubeQuotaError) return { content: [{ type: "text", text: "TubeMine has hit its YouTube API daily quota. Please try again tomorrow." }], isError: true }
          if (e instanceof CommentsDisabledError) return { content: [{ type: "text", text: "Comments are disabled for this video." }], isError: true }
          if (e instanceof VideoNotFoundError) return { content: [{ type: "text", text: "Video not found." }], isError: true }
          if (e instanceof NoCommentsError) return { content: [{ type: "text", text: "No comments found for this video." }], isError: true }
          return { content: [{ type: "text", text: "Unexpected error fetching comments." }], isError: true }
        }
      },
    )
  },
  { serverInfo: { name: "TubeMine", version: "1.0.0" }, capabilities: { tools: {} } },
  { basePath: "/api", maxDuration: 60, verboseLogs: false },
)
const handler = withMcpAuth(base, verifyTokenForMcp, { required: true })
export { handler as GET, handler as POST, handler as DELETE }
```

(If gate 2 revealed a different `withMcpAuth`/`registerTool` signature, adjust to the installed package; keep the tool logic identical.)

- [ ] **Step 2: Add the rewrite**

In `next.config.ts`, add to `nextConfig`:
```ts
async rewrites() { return [{ source: "/mcp", destination: "/api/mcp" }] },
```

- [ ] **Step 3: Exclude bare `/mcp` from the proxy i18n redirect**

In `src/proxy.ts`, add bare `/mcp` (EXACT segment) to the `skipIntl` condition (e.g. `pathname === "/mcp"`). Do not match `/mcp-docs` or `/ai-access`.

- [ ] **Step 4: Local smoke test**

Run `npm run dev`, then:
`curl -s -X POST http://localhost:3000/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`
Expected: a JSON-RPC response listing `get_youtube_comments` OR a 401 (auth required) WITHOUT an HTML 308 redirect. A 401 here is fine (no key); the key check is whether the i18n redirect is gone and the route resolves. Stop dev.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/[transport]/route.ts next.config.ts src/proxy.ts
git commit -m "feat(mcp): /mcp route + get_youtube_comments tool + rewrite + proxy skipIntl"
```

---

## Phase P2, MCP frontend surfaces

> All P2 pages use the `.tm-design` scope + v3 tokens, real `ClientLogo`s, and the `MCP_CLIENTS` registry. Add every new copy string to `messages/en.json` + `messages/ru.json` under an `mcp` namespace and run `npm run i18n:check` in each task's verify step. Recreate visuals from the named ref + screenshot.

### Task P2.1: API-key server actions/route

**Files:**
- Create: `src/app/[locale]/(app)/ai-access/actions.ts` (server actions) or `src/app/api/mcp-keys/route.ts`
- Reuse: `authUserId` (`src/lib/auth.ts`), `src/lib/mcp/api-keys.ts`

- [ ] **Step 1: Implement create/rotate/revoke/list bound to the session user**

Server actions: `createKey(name?)`, `rotateKey(id)`, `revokeKey(id)`, `getKeys()`. Each resolves `const { userId } = await authUserId()`; if no `userId`, throw/redirect. Then call the lib with that `userId`. `createKey`/`rotateKey` return `{ row, raw }` (raw shown once); `getKeys` returns `ApiKeyRow[]`. Enforce the IDOR invariant (lib already filters by `user_id`).

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit 2>&1 | head -10`. Expected: clean.
```bash
git add src/app/[locale]/(app)/ai-access
git commit -m "feat(mcp): server actions for api-key create/rotate/revoke/list"
```

### Task P2.2: `/ai-access` signed-in MCP dashboard page

**Files:**
- Create: `src/app/[locale]/(app)/ai-access/page.tsx` + presentational components under `src/components/mcp/`
- Reference: `docs/design-v3/refs/TubeMine MCP.html`, `screenshots/mcp-desktop.jpg`, `mcp-clients-desktop.jpg`

- [ ] **Step 1: Build the page** with the app shell + side-nav, header + status pill, quick-connect client chips (two groups, `ClientLogo` + OAuth/Key badge; oauth group shows "OAuth one-click coming soon"), a keys panel (create with optional name -> raw shown ONCE in a reveal/copy with a store-it-now warning; existing keys masked; per-key Rotate + Revoke with confirm), and a Connected-clients table (Client+logo / Auth method / Created / Last used / Revoke) populated from `getKeys()`, with the empty state. Mobile `data-label` stacking. Match the screenshots.

- [ ] **Step 2: i18n** , add `mcp` namespace strings (EN+RU). Run: `npm run i18n:check`. Expected: PASS.

- [ ] **Step 3: Build + commit**

Run: `npm run build 2>&1 | tail -10`. Expected: success.
```bash
git add src/app/[locale]/(app)/ai-access src/components/mcp messages/en.json messages/ru.json
git commit -m "feat(mcp): /ai-access dashboard (keys management + connected clients)"
```

### Task P2.3: `/mcp-docs` public setup docs

**Files:**
- Create: `src/app/[locale]/mcp-docs/page.tsx`, `src/components/mcp/mcp-docs.tsx`
- Reuse: `LegalToc` layout, `CodeBlock`, `MCP_CLIENTS`
- Reference: `docs/design-v3/refs/TubeMine MCP Docs.html`, `screenshots/mcp-docs-desktop.jpg`

- [ ] **Step 1: Build the docs** with the legal-page TOC layout: section 01 documents ONLY `get_youtube_comments` (single spec card; drop `analyze_youtube_comments` everywhere), 02 Authentication (API key v1; OAuth "coming soon" for the 3 oauth clients), 03-10 per-client setup rendered from `MCP_CLIENTS` (CodeBlocks using `MCP_ENDPOINT` = `https://tubemine.tech/mcp`), 11 Usage and limits (Free 5,000 / Pro 100,000, no hard cap, shared YouTube daily quota note), 12 Troubleshooting (invalid key; no tools; "missing GET/POST/DELETE" -> use exactly `https://tubemine.tech/mcp`).

- [ ] **Step 2: i18n + parity.** Run: `npm run i18n:check`. Expected: PASS.

- [ ] **Step 3: Build + commit**

Run: `npm run build 2>&1 | tail -10`. Expected: success.
```bash
git add src/app/[locale]/mcp-docs src/components/mcp/mcp-docs.tsx messages/en.json messages/ru.json
git commit -m "feat(mcp): /mcp-docs public setup docs (single tool, per-client configs)"
```

### Task P2.4: Pricing MCP-access line

**Files:**
- Modify: `src/app/[locale]/pricing/page.tsx`, `src/components/pricing-tier-aware.tsx` (and the comparison table component)
- Reference: `docs/design-v3/refs/TubeMine Pricing.html`

- [ ] **Step 1: Add the MCP line** , a bullet "AI assistant access via MCP" in both Free and Pro cards, plus a comparison-table row "AI assistant access (MCP)" = Anonymous No / Free Yes / Pro Yes, with a footnote that MCP usage counts against the same monthly comment quota (no separate/2x quota). Keep numbers: Anonymous 1,000 / Free 5,000 / Pro 100,000; Pro $19/mo. Keep "Trusted by 1 paying customer".

- [ ] **Step 2: i18n + build + commit**

Run: `npm run i18n:check && npm run build 2>&1 | tail -5`. Expected: PASS + success.
```bash
git add src/app/[locale]/pricing src/components/pricing-tier-aware.tsx messages/en.json messages/ru.json
git commit -m "feat(pricing): add MCP-access line per tier (honest shared-quota wording)"
```

### Task P2.5: Dashboard MCP banner + side-nav item

**Files:**
- Modify: `src/components/side-nav.tsx`, `src/app/[locale]/(app)/dashboard/page.tsx`
- Reference: `docs/design-v3/refs/TubeMine Dashboard.html` (`.mcp-banner`)

- [ ] **Step 1: Side-nav** , add a "MCP / AI Access" item (plug icon from `lucide-react`) linking to `/ai-access`, in the Workspace group.

- [ ] **Step 2: Dashboard banner** , add the "Analyze from your AI assistant [New]" banner (`role="note"`, plug icon) with "Connect your AI" (primary) and "Manage access" (secondary), both -> `/ai-access`.

- [ ] **Step 3: i18n + build + commit**

Run: `npm run i18n:check && npm run build 2>&1 | tail -5`. Expected: PASS + success.
```bash
git add src/components/side-nav.tsx src/app/[locale]/(app)/dashboard/page.tsx messages/en.json messages/ru.json
git commit -m "feat(mcp): dashboard MCP banner + side-nav AI Access item"
```

---

## Phase P3, full v3 reskin of remaining pages

> Each page task: recreate the named ref's markup + CSS in the existing React page using the v3 tokens/components, match the desktop + mobile screenshot, keep all existing functionality and data wiring, ensure EN+RU copy, clean at 372px. Verify each with `npm run build` and a dev-server visual check against the screenshot. Commit per page.

### Task P3.1: Landing page (MCP-hero + all sections)

**Files:** Modify `src/app/[locale]/page.tsx` (the only landing entry; there is NO `src/app/page.tsx`) and its section components (`landing-*.tsx`, `result-block.tsx` reuse).
**Reference:** `docs/design-v3/refs/TubeMine Landing.html`, `screenshots/landing-desktop.jpg`, `landing-mobile.jpg`, `landing-demo-promo-desktop.jpg`.

- [ ] **Step 1:** Port the MCP-hero: trust pill with real `ClientLogo`s (Claude, Codex, Cursor, ChatGPT, Gemini, Hermes, OpenClaw), H1 about pulling comments inside your AI, primary CTA "Connect your AI" -> `/mcp-docs`, secondary "Or use the web app" -> the web-app/demo section (the `#demo` anchor / dashboard, per spec 6.5). Animated AI-chat demo references only `get_youtube_comments()`.
- [ ] **Step 2:** Port how-it-works (fix terminal mock to "1 tool registered", API-key auth framing; OAuth "coming"), web-app strip, trust accelerant/dashboard preview, feature blocks (reuse shared result block), pricing teaser, FAQ (accordion), final CTA, footer.
- [ ] **Step 3:** i18n (`landing` + `mcp` strings), build, visual-match check, commit.

Run: `npm run i18n:check && npm run build 2>&1 | tail -5`. Expected: PASS + success.
```bash
git add src/app/[locale]/page.tsx src/components/landing-*.tsx src/components/tubemine.tsx src/components/site-header*.tsx src/components/site-footer.tsx src/app/globals.css messages/en.json messages/ru.json
git commit -m "feat(landing): v3 MCP-hero + full section port"
```
(Stage only the landing-related files actually touched; do NOT `git add src/components` wholesale, which would pull in unrelated in-progress work from sibling P3 tasks.)

### Task P3.2: Dashboard home reskin

**Files:** Modify `src/app/[locale]/(app)/dashboard/page.tsx` + `src/components/dashboard/*`, `recent-analyses.tsx`, `trial-banner.tsx`.
**Reference:** `TubeMine Dashboard.html`, `screenshots/dashboard-desktop.jpg`, `dashboard-mobile.jpg`, `dashboard-capped-*.jpg`, `dashboard-result-free/pro.jpg`, `dashboard-loading.jpg`.

- [ ] **Step 1:** Port welcome strip, MCP banner (from P2.5), trial/welcome banners, usage card (ok + `is-capped` states with `Progress`), quick-analyze (prefill + loading skeleton mounting the shared result block), recent analyses (+ empty state, Save CSV), upgrade/manage cards. Do NOT ship the ref's bottom-right "Design preview" panel.
- [ ] **Step 2:** i18n, build, visual check, commit.
```bash
git commit -am "feat(dashboard): v3 home reskin"
```

### Task P3.3: History (list + detail) reskin

**Files:** `src/app/[locale]/(app)/history/*`, `src/components/analysis-detail-view.tsx`, `recent-analyses.tsx`.
**Reference:** `TubeMine History.html`, `screenshots/history-desktop.jpg`, `history-mobile.jpg`.
- [ ] Port; keep clickable rows + shared result block; i18n; build; visual check; commit `feat(history): v3 reskin`.

### Task P3.4: Profile reskin

**Files:** `src/app/[locale]/(app)/profile/*`, `src/components/profile/*`.
**Reference:** `TubeMine Profile.html`, `screenshots/profile-desktop.jpg`, `profile-mobile.jpg`.
- [ ] Port; keep account/subscription wiring; i18n; build; visual check; commit `feat(profile): v3 reskin`.

### Task P3.5: Login reskin

**Files:** `src/app/[locale]/login/*`, `src/components/landing-auth-gate.tsx`.
**Reference:** `TubeMine Login.html`, `screenshots/login-desktop.jpg`, `login-mobile.jpg`.
- [ ] Port; keep Google OAuth sign-in flow; i18n; build; visual check; commit `feat(login): v3 reskin`.

### Task P3.6: Privacy + Terms reskin

**Files:** `src/app/[locale]/privacy/*`, `src/app/[locale]/terms/*`, `src/components/legal-toc.tsx`.
**Reference:** `TubeMine Privacy.html`, `TubeMine Terms.html`, `screenshots/privacy-*.jpg`, `terms-*.jpg`.
- [ ] Port both via the shared `LegalToc` layout; keep all legal copy; i18n; build; visual check; commit `feat(legal): v3 reskin privacy + terms`.

### Task P3.7: Changelog + Docs reskin

**Files:** `src/app/[locale]/changelog/*`, `src/app/[locale]/docs/*`.
**Reference:** `TubeMine Changelog.html`, `TubeMine Docs.html`, `screenshots/changelog-*.jpg`, `docs-*.jpg`.
- [ ] Port both (Docs here is the existing general docs page, distinct from `/mcp-docs`); i18n; build; visual check; commit `feat(content): v3 reskin changelog + docs`.

### Task P3.8: Shared chrome reskin pass

**Files:** `src/components/app-shell.tsx`, `site-header*.tsx`, `site-footer.tsx`, `locale-switcher.tsx`, `side-nav.tsx`, `pricing-tier-aware.tsx`, `result-block.tsx`.
**Reference:** `TubeMine Design System.html`, `screenshots/design-system-desktop.jpg`.
- [ ] Verify all shared chrome matches v3 tokens (topbar, sidebar, footer, header, locale switcher, result block). Fix any drift. i18n; build; full visual sweep across pages; commit `feat(chrome): v3 shared chrome consistency pass`.

---

## Phase P4, cleanup, migration, QA, ship

### Task P4.1: Remove oauth-intro

**Files:** Delete `src/app/[locale]/oauth-intro/`; remove the `oauth_intro` namespace from `messages/en.json` + `messages/ru.json`; remove any `oauth-consent` component; remove the `.oauth-intro-page` CSS block from `src/app/globals.css`; remove all nav/link/CTA references (grep `site-header-gate.tsx`, etc.).

- [ ] **Step 1:** `git rm -r src/app/[locale]/oauth-intro`, remove the `oauth_intro` message keys (both locales), and delete the `.oauth-intro-page` CSS block in `src/app/globals.css` (search the file for `oauth-intro`). Then grep for residual references:
Run: `grep -rn "oauth-intro\|oauth_intro\|oauthIntro\|oauth-consent" src messages | grep -v "design-v3"`
Expected: 0 hits after cleanup.
- [ ] **Step 2:** `npm run i18n:check && npm run build 2>&1 | tail -5`. Expected: PASS + success.
- [ ] **Step 3:** Commit `chore: remove oauth-intro page (debunked premise)`.

### Task P4.2: Apply the migration to the live DB (USER-CONFIRMED, gated)

**Files:** `supabase/migrations/04_api_keys.sql` (already written in P1.2).

- [ ] **Step 1:** Show the user the exact SQL from `04_api_keys.sql` and confirm before applying (the user pre-approved "apply during build"; still show the final SQL).
- [ ] **Step 2:** Apply via Supabase MCP `apply_migration` (name `04_api_keys`, the file's SQL). If MCP/CLI is blocked, use the Monaco-MCP Studio fallback (navigate to the project SQL editor, inject via `window.monaco.editor.getEditors()[0].setValue(...)`, Run) per the runbook.
- [ ] **Step 3:** Verify: `select` to confirm the table + RLS exist (Supabase MCP `list_tables` / `execute_sql "select count(*) from public.user_api_keys"`). Confirm RLS enabled via `get_advisors`.

(No commit; this is a DB action. Record the outcome in P4.5 vault notes.)

### Task P4.3: Live writer/reader round-trip for keys (via Supabase MCP, after migration)

Runs after P4.2 (the table exists). Proves the migration columns and the lib's
insert/read shape agree against the REAL schema (runbook lesson: writer/reader drift is
invisible to hand-built fixtures). This is a one-off live check via Supabase MCP, not a
vitest (a unit test cannot satisfy the `auth.users` FK; the P1.3 unit tests already
cover the pure logic).

- [ ] **Step 1:** Get a real `user_id` from `auth.users` (the project owner). Via Supabase MCP `execute_sql`: `select id from auth.users limit 1`.
- [ ] **Step 2:** Round-trip via Supabase MCP `execute_sql`: insert a throwaway row for that user id (`insert into public.user_api_keys (user_id, key_hash, name) values ('<id>', 'roundtrip_test_hash', 'roundtrip') returning *`), select it back and confirm all columns (`id, user_id, key_hash, name, created_at, last_used_at, is_revoked`) return as expected, then delete it (`delete from public.user_api_keys where key_hash = 'roundtrip_test_hash'`). Confirm 0 rows remain for that hash.
- [ ] **Step 3:** No commit (DB-only). Note the result in the P4.5 vault update.

### Task P4.4: Full QA gate (tests, lint, build, i18n)

- [ ] **Step 1:** `npm test` , all green (MCP unit tests + existing suite).
- [ ] **Step 2:** `npm run lint` , clean.
- [ ] **Step 3:** `npm run i18n:check` , EN+RU parity.
- [ ] **Step 4:** `npm run build` , succeeds.
- [ ] **Step 5:** No em/en-dash in THIS branch's changes (pre-existing legacy dashes in untouched files are out of scope): `git diff main...HEAD --name-only | grep -E '\.(ts|tsx|css|json|md)$' | xargs grep -nP "[\x{2013}\x{2014}]" 2>/dev/null` , 0 hits in changed files. Fix any introduced by this work.
- [ ] **Step 6:** Commit any fixes `chore(qa): lint/i18n/dash fixes`.

### Task P4.5: Branch push + Vercel preview verification + vault updates

- [ ] **Step 1:** Push `feat/mcp-v1`: `git push -u origin feat/mcp-v1`. Obtain the Vercel preview URL.
- [ ] **Step 2:** Verify on preview (gates 3, 6; and acceptance):
  - `curl https://<preview>/mcp` (POST `tools/list`) returns JSON-RPC, not HTML 308.
  - `/mcp-docs` and `/ai-access` localize correctly; `POST /en/mcp` does not act as the transport.
  - Create a `tm_sk_` key in `/ai-access`; connect a client (or curl with `Authorization: Bearer ...`) and `tools/call get_youtube_comments` on a SMALL-comment video; confirm raw comments returned and the user's usage bumped.
  - Revoke the key; confirm the next call 401s.
  - Spot-check the reskinned pages on the preview (desktop + 372px mobile).
  - If a browser connector hits CORS, apply gate 5 (add CORS headers + OPTIONS) and re-push.
- [ ] **Step 3:** Update vault via `mcp__obsidian__*` (NOT local files): `projects/yt-comments/qa/flows-summary.md` (add MCP flow rows; correct $19 / Free 5,000) and `projects/yt-comments/mcp-build-plan.md` (mark v1 done; record routes `/mcp`, `/ai-access`, `/mcp-docs`, the multi-named-key model, the zod gate outcome, CORS outcome).
- [ ] **Step 4:** STOP. Do NOT merge to `main` / deploy to prod. Present the preview URL + a summary to the user for verification.

---

## Acceptance checklist (mirror of spec section 12)

- [ ] `/mcp` answers `tools/list` + `tools/call` for `get_youtube_comments`.
- [ ] API-key Bearer auth works end to end; strategy pattern in place; OAuth is a future drop-in.
- [ ] `04_api_keys.sql` applied (hash-only, RLS on); generate/rotate/revoke UI works.
- [ ] MCP reuses extract/youtube/quota via the shared core; shared-quota exhaustion returns a clean MCP error.
- [ ] MCP surfaces shipped (`/mcp-docs` single tool, `/ai-access`, landing MCP-hero, pricing MCP line, dashboard banner, side-nav, real logos); `oauth-intro` removed.
- [ ] Full v3 reskin: tokens integrated; every page matches the refs/screenshots; mobile clean at 372px; dark-only.
- [ ] `npm test`, `npm run i18n:check`, `npm run lint`, `npm run build` all pass; no em/en-dash.
- [ ] All on `feat/mcp-v1`; preview opened; not merged to prod without the user; vault notes updated.
