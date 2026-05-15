const YT_VIDEO_ID_PATTERN =
  /(?:v=|vi=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/

export function extractVideoId(url: string): string | null {
  const match = url.match(YT_VIDEO_ID_PATTERN)
  return match ? match[1] : null
}

export type VideoMeta = {
  videoId: string
  title: string
  channel: string
  views: number
  likes: number
  commentCount: number
  thumbnail: string | null
  publishedAt: string | null
  commentsDisabled: boolean
}

export type Comment = {
  author: string
  text: string
  likes: number
  publishedAt: string
  replies: number
}
