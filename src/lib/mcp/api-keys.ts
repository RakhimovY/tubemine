import "server-only"
import { randomBytes, createHash } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { API_KEY_PREFIX, maskApiKey, type ApiKeyRow } from "./mask"

// Re-export the pure, client-safe display helpers from ./mask so existing
// server-side import sites keep working unchanged. Client components must
// import these from "@/lib/mcp/mask" directly to avoid pulling this
// server-only module into the browser bundle.
export { maskApiKey, type ApiKeyRow }

const PREFIX = API_KEY_PREFIX
export function generateApiKey(): { raw: string; hash: string } {
  const raw = PREFIX + randomBytes(32).toString("base64url")
  return { raw, hash: hashApiKey(raw) }
}
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
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
