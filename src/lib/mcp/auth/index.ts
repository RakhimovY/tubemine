import "server-only"
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"
import type { AuthProvider } from "./types"
import { ApiKeyProvider } from "./api-key-provider"

export function getAuthProvider(): AuthProvider {
  return new ApiKeyProvider()
}
export async function verifyTokenForMcp(req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  const id = await getAuthProvider().authenticate(req, bearerToken)
  if (!id) return undefined
  return { token: bearerToken ?? "", clientId: "tubemine-api-key", scopes: [], extra: { userId: id.userId } }
}
