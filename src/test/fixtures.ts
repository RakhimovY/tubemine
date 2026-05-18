import type { SentimentAggregate } from "@/lib/sentiment"

export const sampleSentiment: SentimentAggregate = {
  positive: 68,
  neutral: 24,
  negative: 8,
  score: 0.6,
  sampleSize: 100,
  coverage: 0.96,
  languages: ["en"],
  ruShare: 0,
}

export const sampleTopWords = [
  { token: "tutorial", count: 847 },
  { token: "love", count: 662 },
]

export const sampleEmoji = [
  { emoji: "🔥", count: 182, percent: 18.2 },
  { emoji: "❤️", count: 147, percent: 14.7 },
]

export const sampleAnalysisInsert = {
  user_id: "00000000-0000-0000-0000-000000000001",
  video_id: "abcDEFghijk",
  video_title: "Sample video",
  channel_name: "Sample channel",
  thumbnail_url: "https://example.com/thumb.jpg",
  comment_count: 100,
  sentiment: sampleSentiment,
  top_words: sampleTopWords,
  emoji_frequency: sampleEmoji,
}
