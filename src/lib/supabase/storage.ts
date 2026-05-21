import "server-only"
import { createServiceClient } from "@/lib/supabase/server"
import type { StoredComment } from "@/lib/comments"

const BUCKET = "analyses-comments"
const UUID_RE = /^[0-9a-f-]{36}$/i
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/

export function commentsBlobPath(userId: string, videoId: string): string {
  if (!UUID_RE.test(userId)) {
    throw new Error("commentsBlobPath: invalid userId")
  }
  if (!YT_ID_RE.test(videoId)) {
    throw new Error("commentsBlobPath: invalid videoId")
  }
  return `${userId}/${videoId}.json`
}

function splitAndValidatePath(path: string): { userId: string; videoId: string } {
  const parts = path.split("/")
  if (parts.length !== 2) throw new Error("invalid blob path")
  const [userId, fname] = parts
  if (!fname.endsWith(".json")) throw new Error("invalid blob path")
  const videoId = fname.slice(0, -5)
  if (!UUID_RE.test(userId) || !YT_ID_RE.test(videoId)) {
    throw new Error("invalid blob path segments")
  }
  return { userId, videoId }
}

export async function uploadCommentsBlob(
  userId: string,
  videoId: string,
  json: string,
): Promise<string> {
  const path = commentsBlobPath(userId, videoId)
  const sb = createServiceClient()
  const { error } = await sb.storage.from(BUCKET).upload(path, json, {
    contentType: "application/json",
    upsert: true,
  })
  if (error) throw new Error(`uploadCommentsBlob: ${error.message}`)
  return path
}

export async function downloadCommentsBlob(path: string): Promise<StoredComment[]> {
  splitAndValidatePath(path)
  const sb = createServiceClient()
  const { data, error } = await sb.storage.from(BUCKET).download(path)
  if (error || !data) {
    throw new Error(`downloadCommentsBlob: ${error?.message ?? "no data"}`)
  }
  const text = await data.text()
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) throw new Error("not an array")
    return parsed as StoredComment[]
  } catch (e) {
    throw new Error(`downloadCommentsBlob parse: ${(e as Error).message}`)
  }
}

export async function deleteCommentsBlob(path: string): Promise<void> {
  try {
    splitAndValidatePath(path)
    const sb = createServiceClient()
    await sb.storage.from(BUCKET).remove([path])
  } catch (e) {
    console.warn("[storage] deleteCommentsBlob failed (swallowed)", {
      path,
      error: (e as Error).message,
    })
  }
}
