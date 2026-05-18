import "server-only"
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
