import type { AuthProvider } from "./types"
// v2 seam: validate JWT/JWKS here. v1 stub returns null so any non-tm_sk_ bearer 401s.
export class OAuthProvider implements AuthProvider {
  async authenticate(): Promise<{ userId: string } | null> { return null }
}
