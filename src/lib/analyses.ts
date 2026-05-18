import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceClient } from "@/lib/supabase/server"
import type { SentimentAggregate } from "@/lib/sentiment"

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
}

export type Cursor = { processed_at: string; id: string }

export type ListResult = {
  items: AnalysisRow[]
  nextCursor: string | null
}

export async function saveAnalysis(input: AnalysisInsert): Promise<void> {
  const sb = createServiceClient()
  const now = new Date()
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

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
  }
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
  const cap = Math.min(Math.max(1, limit), 50)

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
