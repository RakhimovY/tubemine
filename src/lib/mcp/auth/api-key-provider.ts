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
    const { data } = await db.from("user_api_keys").select("user_id, is_revoked").eq("key_hash", hash).single()
    if (!data || data.is_revoked) return null
    void db.from("user_api_keys").update({ last_used_at: new Date().toISOString() }).eq("key_hash", hash)
    return { userId: data.user_id as string }
  }
}
