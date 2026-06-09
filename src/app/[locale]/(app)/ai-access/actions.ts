"use server"
import { authUserId } from "@/lib/auth"
import { createApiKey, rotateApiKey, revokeApiKey, listApiKeys, type ApiKeyRow } from "@/lib/mcp/api-keys"

async function requireUser(): Promise<string> {
  const { userId } = await authUserId()
  if (!userId) throw new Error("Not authenticated")
  return userId
}

export async function getKeysAction(): Promise<ApiKeyRow[]> {
  const userId = await requireUser()
  return listApiKeys(userId)
}

export async function createKeyAction(name?: string): Promise<{ row: ApiKeyRow; raw: string }> {
  const userId = await requireUser()
  return createApiKey(userId, name?.trim() || undefined)
}

export async function rotateKeyAction(id: string): Promise<{ row: ApiKeyRow; raw: string }> {
  const userId = await requireUser()
  return rotateApiKey(userId, id)
}

export async function revokeKeyAction(id: string): Promise<void> {
  const userId = await requireUser()
  await revokeApiKey(userId, id)
}
