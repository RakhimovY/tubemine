// Pure, client-safe API-key display helpers. Kept free of any `server-only`
// or Supabase imports so client components (the /ai-access keys panel) can
// render the masked form of a key without pulling server modules into the
// browser bundle. The hashing / generation / DB code lives in api-keys.ts,
// which re-exports PREFIX from here so the prefix stays single-sourced.
export const API_KEY_PREFIX = "tm_sk_"

export function maskApiKey(): string {
  return API_KEY_PREFIX + "•".repeat(20)
}

export type ApiKeyRow = {
  id: string
  name: string | null
  created_at: string
  last_used_at: string | null
  is_revoked: boolean
}
