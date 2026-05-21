import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceClient } from "@/lib/supabase/server"
import type { SentimentAggregate } from "@/lib/sentiment"
import type { StoredComment } from "@/lib/comments"
import {
  commentsBlobPath,
  uploadCommentsBlob,
  downloadCommentsBlob,
  deleteCommentsBlob,
} from "@/lib/supabase/storage"

// Tier-aware TTL: Free 30 days, Pro 100 days (TUB-34).
const FREE_TTL_DAYS = 30
const PRO_TTL_DAYS = 100

export function computeExpiresAt(now: Date, tier: "free" | "pro"): Date {
  const days = tier === "pro" ? PRO_TTL_DAYS : FREE_TTL_DAYS
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
}

const COMMENTS_INLINE_THRESHOLD_BYTES = 5 * 1024 * 1024
const COMMENTS_HARD_MAX_BYTES = 45 * 1024 * 1024

export const ANALYSES_LIST_MIN = 1
export const ANALYSES_LIST_MAX = 100

// Cursor id is the analyses table primary key, which is uuid. Validating here
// keeps the .or() filter below safe from injection via crafted cursor payloads
// (PostgREST does NOT escape values inside .or() string filters).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TopWord = { token: string; count: number }
export type EmojiFreq = { emoji: string; count: number; percent: number }

export type AnalysisRow = {
  id: string
  video_id: string
  video_title: string | null
  channel_name: string | null
  thumbnail_url: string | null
  comment_count: number
  sentiment: SentimentAggregate | null
  top_words: TopWord[] | null
  emoji_frequency: EmojiFreq[] | null
  processed_at: string
  expires_at: string
}

export type AnalysisInsert = {
  userId: string
  videoId: string
  videoTitle: string | null
  channelName: string | null
  thumbnailUrl: string | null
  commentCount: number
  sentiment: SentimentAggregate | null
  topWords: TopWord[]
  emojiFrequency: EmojiFreq[]
  tier: "free" | "pro"
  comments: StoredComment[]
}

export type AnalysisDetailRow = AnalysisRow & {
  comments: StoredComment[] | null
  comments_blob_path: string | null
}

export type GetAnalysisByIdResult =
  | { ok: true; row: AnalysisDetailRow }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "comments_unavailable"; row: AnalysisDetailRow }

export type Cursor = { processed_at: string; id: string }

export type ListResult = {
  items: AnalysisRow[]
  nextCursor: string | null
}

export async function saveAnalysis(input: AnalysisInsert): Promise<void> {
  const sb = createServiceClient()
  const now = new Date()
  const expires = computeExpiresAt(now, input.tier)

  const serialized = JSON.stringify(input.comments)
  const size = Buffer.byteLength(serialized, "utf-8")
  if (size > COMMENTS_HARD_MAX_BYTES) {
    console.warn("[analyses] comments payload exceeds hard max, skipping persistence", {
      size,
      userId: input.userId,
      videoId: input.videoId,
    })
    return
  }
  const useBlob = size > COMMENTS_INLINE_THRESHOLD_BYTES
  let commentsJson: StoredComment[] | null
  let commentsBlobPathValue: string | null
  if (useBlob) {
    commentsBlobPathValue = commentsBlobPath(input.userId, input.videoId)
    commentsJson = null
  } else {
    commentsJson = input.comments
    commentsBlobPathValue = null
  }

  const { error } = await sb.from("analyses").upsert(
    {
      user_id: input.userId,
      video_id: input.videoId,
      video_title: input.videoTitle,
      channel_name: input.channelName,
      thumbnail_url: input.thumbnailUrl,
      comment_count: input.commentCount,
      sentiment: input.sentiment,
      top_words: input.topWords,
      emoji_frequency: input.emojiFrequency,
      comments: commentsJson,
      comments_blob_path: commentsBlobPathValue,
      processed_at: now.toISOString(),
      expires_at: expires.toISOString(),
    },
    { onConflict: "user_id,video_id" },
  )

  if (error) {
    console.warn("[analyses] save failed", {
      error: error.message,
      userId: input.userId,
      videoId: input.videoId,
    })
    return
  }

  if (commentsBlobPathValue) {
    try {
      await uploadCommentsBlob(input.userId, input.videoId, serialized)
    } catch (e) {
      // Row already upserted with comments_blob_path; missing blob surfaces
      // as 500 comments_unavailable on detail reads. User can re-extract.
      console.warn("[analyses] blob upload failed after row upsert", {
        error: (e as Error).message,
        path: commentsBlobPathValue,
      })
    }
  }
}

/**
 * Load a single analysis for the detail view, including comments.
 *
 * CRITICAL: `userSb` MUST be the user-scoped client (from createClient()).
 * The row-level SELECT through RLS is the authorization gate. If RLS returns
 * nothing, blob fetch never runs. Passing a service client here would
 * silently expose cross-user comments.
 */
export async function getAnalysisById(
  userSb: SupabaseClient,
  id: string,
): Promise<GetAnalysisByIdResult> {
  if (!UUID_RE.test(id)) return { ok: false, reason: "not_found" }
  const { data, error } = await userSb
    .from("analyses")
    .select(
      "id, video_id, video_title, channel_name, thumbnail_url, comment_count, sentiment, top_words, emoji_frequency, comments, comments_blob_path, processed_at, expires_at",
    )
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.warn("[analyses] getAnalysisById error", { error: error.message, id })
    return { ok: false, reason: "not_found" }
  }
  if (!data) return { ok: false, reason: "not_found" }
  const row = data as AnalysisDetailRow
  if (row.comments_blob_path && !row.comments) {
    try {
      row.comments = await downloadCommentsBlob(row.comments_blob_path)
    } catch (e) {
      console.warn("[analyses] blob download failed", {
        error: (e as Error).message,
        path: row.comments_blob_path,
      })
      row.comments = null
      return { ok: false, reason: "comments_unavailable", row }
    }
  }
  return { ok: true, row }
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), "utf-8").toString("base64url")
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf-8")
    const parsed = JSON.parse(json)
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.processed_at !== "string" ||
      typeof parsed.id !== "string"
    ) {
      return null
    }
    if (Number.isNaN(Date.parse(parsed.processed_at))) return null
    if (!UUID_RE.test(parsed.id)) return null
    return { processed_at: parsed.processed_at, id: parsed.id }
  } catch {
    return null
  }
}

export async function listAnalyses(
  sb: SupabaseClient,
  cursor: Cursor | null,
  limit: number,
): Promise<ListResult> {
  // sb is the USER-SCOPED Supabase server client (createClient()). RLS policy
  // "users read own analyses" filters to auth.uid() = user_id, so no manual
  // user_id .eq() is needed per SPEC architectural decision.
  // Caller should validate the limit (Phase 4 route uses Zod); clamp here is
  // defense in depth.
  const cap = Math.min(Math.max(ANALYSES_LIST_MIN, limit), ANALYSES_LIST_MAX)

  // IMPORTANT (TUB-34): never include `comments` or `comments_blob_path` here.
  // TOAST decompression of multi-MB JSONB across every list render would crater
  // perf. Only getAnalysisById and the export cache branch SELECT those columns.
  let query = sb
    .from("analyses")
    .select(
      "id, video_id, video_title, channel_name, thumbnail_url, comment_count, sentiment, top_words, emoji_frequency, processed_at, expires_at",
    )
    .order("processed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(cap + 1)

  if (cursor) {
    // (processed_at, id) < (cursor.processed_at, cursor.id) in desc order:
    // Postgres composite comparison via OR clause.
    query = query.or(
      `processed_at.lt.${cursor.processed_at},and(processed_at.eq.${cursor.processed_at},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error) {
    console.warn("[analyses] list failed", { error: error.message })
    return { items: [], nextCursor: null }
  }

  const rows = (data ?? []) as AnalysisRow[]
  const hasMore = rows.length > cap
  const items = hasMore ? rows.slice(0, cap) : rows
  const last = items[items.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeCursor({ processed_at: last.processed_at, id: last.id })
      : null

  return { items, nextCursor }
}

export async function deleteAnalysis(
  sb: SupabaseClient,
  id: string,
): Promise<number> {
  // sb is the USER-SCOPED Supabase server client. RLS policy
  // "users delete own analyses" enforces auth.uid() = user_id. A DELETE on a
  // row owned by another user removes 0 rows; we collapse that to
  // { deleted: 0 } per SPEC idempotent contract (no enumeration leak).
  const { data, error } = await sb
    .from("analyses")
    .delete()
    .select("id, comments_blob_path")
    .eq("id", id)

  if (error) {
    console.warn("[analyses] delete failed", { error: error.message, id })
    return 0
  }
  for (const row of data ?? []) {
    const path = (row as { comments_blob_path: string | null }).comments_blob_path
    if (path) void deleteCommentsBlob(path)
  }
  return data?.length ?? 0
}

export async function purgeExpiredAnalyses(): Promise<number> {
  const sb = createServiceClient()
  const cutoff = new Date().toISOString()
  // Collect blob paths BEFORE deleting rows.
  const { data: expired, error: selErr } = await sb
    .from("analyses")
    .select("id, comments_blob_path")
    .lt("expires_at", cutoff)
  if (selErr) {
    console.warn("[analyses] cron list expired failed", { error: selErr.message })
    return 0
  }
  const blobPaths = (expired ?? [])
    .map((r) => (r as { comments_blob_path: string | null }).comments_blob_path)
    .filter((p): p is string => !!p)

  const { data, error } = await sb
    .from("analyses")
    .delete()
    .select("id")
    .lt("expires_at", cutoff)
  if (error) {
    console.warn("[analyses] cron purge failed", { error: error.message })
    return 0
  }
  // Best-effort blob cleanup. Orphans accepted per spec §5.3.
  await Promise.all(blobPaths.map((p) => deleteCommentsBlob(p)))
  return data?.length ?? 0
}

export async function getAnalysesCount(sb: SupabaseClient): Promise<number> {
  // sb is the USER-SCOPED Supabase server client. RLS policy
  // "users read own analyses" filters auth.uid() = user_id, so count is
  // scoped to the caller. head:true + count:'exact' returns a count
  // without a row payload (index-only scan when possible).
  const { count, error } = await sb
    .from("analyses")
    .select("id", { count: "exact", head: true })
  if (error) {
    console.warn("[analyses] count failed", { error: error.message })
    return 0
  }
  return count ?? 0
}
