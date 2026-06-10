import "server-only"
import { bumpUserUsage, getUserQuota, type UserQuota } from "@/lib/quota"
import { ytClient } from "@/lib/youtube"

// One YouTube top-level comment, fully coerced to non-null primitives. Shared
// by the web extract route and the (future) MCP tool so both walk one
// fetch+paginate+quota code path.
export type RawComment = {
  author: string
  text: string
  likes: number
  replies: number
  publishedAt: string
}

export type FetchOptions = {
  videoId: string
  max: number
  order: "time" | "relevance"
}

// Distinct error classes so callers can map each failure to its own response
// without re-parsing google error shapes.
export class CommentsDisabledError extends Error {
  constructor() {
    super("comments_disabled")
    this.name = "CommentsDisabledError"
  }
}

export class VideoNotFoundError extends Error {
  constructor() {
    super("video_not_found")
    this.name = "VideoNotFoundError"
  }
}

export class YouTubeQuotaError extends Error {
  constructor() {
    super("youtube_quota_exceeded")
    this.name = "YouTubeQuotaError"
  }
}

export class NoCommentsError extends Error {
  constructor(message?: string) {
    super(message ?? "extraction_failed")
    this.name = "NoCommentsError"
  }
}

export class QuotaExceededError extends Error {
  constructor(public quota: UserQuota) {
    super("quota_exceeded")
    this.name = "QuotaExceededError"
  }
}

const PAGE_SIZE = 100

/**
 * Paginate top-level comment threads for a video up to `max`. Ports the exact
 * loop the web route used: PAGE_SIZE 100, plainText, order from opts, capped
 * to max, following nextPageToken.
 *
 * Error contract: if a page `list` call throws AFTER >= 1 comment is already
 * collected, the partial set is returned (the error is swallowed, matching the
 * route's "if comments already collected, proceed" behavior). If ZERO comments
 * are collected, the google error is mapped to a typed error and thrown.
 */
export async function fetchCommentThread(
  opts: FetchOptions,
): Promise<RawComment[]> {
  const { videoId, max, order } = opts
  const yt = ytClient()
  const comments: RawComment[] = []
  let pageToken: string | undefined

  try {
    while (comments.length < max) {
      const res = await yt.commentThreads.list({
        part: ["snippet"],
        videoId,
        maxResults: Math.min(PAGE_SIZE, max - comments.length),
        pageToken,
        textFormat: "plainText",
        order,
      })

      for (const item of res.data.items ?? []) {
        const s = item.snippet?.topLevelComment?.snippet
        if (!s) continue
        comments.push({
          author: s.authorDisplayName ?? "(anonymous)",
          text: s.textDisplay ?? "",
          likes: Number(s.likeCount ?? 0),
          replies: Number(item.snippet?.totalReplyCount ?? 0),
          publishedAt: s.publishedAt ?? "",
        })
        if (comments.length >= max) break
      }

      pageToken = res.data.nextPageToken ?? undefined
      if (!pageToken) break
    }
  } catch (err) {
    // If comments are already collected, swallow the error and return the
    // partial set (preserves the route's prior behavior).
    if (comments.length >= 1) {
      return comments
    }

    const e = err as {
      code?: number
      message?: string
      errors?: Array<{ reason?: string }>
    }
    const reason = e?.errors?.[0]?.reason

    if (
      e?.code === 403 &&
      (reason === "commentsDisabled" || /disabled/i.test(e?.message ?? ""))
    ) {
      throw new CommentsDisabledError()
    }
    if (e?.code === 403 && reason === "quotaExceeded") {
      throw new YouTubeQuotaError()
    }
    if (e?.code === 404) {
      throw new VideoNotFoundError()
    }

    throw new NoCommentsError(e?.message)
  }

  return comments
}

/**
 * Quota-gated extraction for a signed-in user. Resolves the user's quota,
 * rejects when exhausted, fetches up to the allowed limit, then records actual
 * usage. Shared entry point for the web route and the MCP tool.
 */
export async function extractCommentsForUser(opts: {
  userId: string
  videoId: string
  max?: number
  order?: "time" | "relevance"
}): Promise<{
  comments: RawComment[]
  extracted: number
  truncatedByQuota: boolean
  usedAfter: number
  quota: UserQuota
}> {
  const { userId, videoId, max, order } = opts

  const quota = await getUserQuota(userId)
  if (quota.remaining <= 0) {
    throw new QuotaExceededError(quota)
  }

  const effectiveMax = max ?? quota.remaining
  const limit = Math.min(effectiveMax, quota.remaining)

  const comments = await fetchCommentThread({
    videoId,
    max: limit,
    order: order ?? "relevance",
  })

  // New monthly total after the atomic bump (0 on RPC failure / no-op delta).
  const usedAfter = await bumpUserUsage(userId, comments.length)

  const truncatedByQuota =
    comments.length >= limit && quota.remaining < effectiveMax

  return {
    comments,
    extracted: comments.length,
    truncatedByQuota,
    usedAfter,
    quota,
  }
}
