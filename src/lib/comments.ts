// Persisted shape of one YT comment in the analyses cache (JSONB or storage blob).
// Kept minimal: only the fields needed by the detail view + cache export paths.
export type StoredComment = {
  authorName: string | null
  text: string
  likes: number
  replies: number | null
  publishedAt: string | null
  sentiment: "positive" | "neutral" | "negative" | "unknown" | null
}
