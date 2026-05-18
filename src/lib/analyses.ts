import "server-only"
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
