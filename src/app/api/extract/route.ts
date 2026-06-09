import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { saveAnalysis } from "@/lib/analyses"
import type { StoredComment } from "@/lib/comments"
import {
  MONTHLY_BUDGET,
  getBudgetStatus,
  getClientIp,
  nextMonthFirstIso,
  recordUsage,
} from "@/lib/budget"
import { analyzeTopEmojis, type EmojiCount } from "@/lib/emoji-frequency"
import { PRO_MONTHLY_CAP, getUserQuota } from "@/lib/quota"
import {
  CommentsDisabledError,
  extractCommentsForUser,
  NoCommentsError,
  QuotaExceededError,
  VideoNotFoundError,
  YouTubeQuotaError,
} from "@/lib/extract-core"
import { scoreCommentsSentiment, type SentimentAggregate } from "@/lib/sentiment"
import { analyzeTopWords, type WordCount } from "@/lib/top-words"
import type { Comment } from "@/lib/types"
import { ytClient } from "@/lib/youtube"
import { authUserId } from "@/lib/auth"

type ExtractTier = "anonymous" | "free" | "pro"

type SentimentDistribution = {
  positive: number
  neutral: number
  negative: number
}

const TOP_WORDS_LIMIT_BY_TIER: Record<ExtractTier, number> = {
  anonymous: 5,
  free: 15,
  pro: Number.POSITIVE_INFINITY,
}

const TOP_EMOJI_LIMIT_BY_TIER: Record<ExtractTier, number> = {
  anonymous: 5,
  free: 15,
  pro: Number.POSITIVE_INFINITY,
}

// Storage cap is independent of presentation tier limits. SPEC §3.1.
const STORAGE_TOP_WORDS = 50
const STORAGE_TOP_EMOJIS = 20

function sentimentDistribution(
  agg: SentimentAggregate | null,
): SentimentDistribution | null {
  if (!agg) return null
  const total = agg.positive + agg.neutral + agg.negative
  if (total === 0) return null
  return {
    positive: agg.positive / total,
    neutral: agg.neutral / total,
    negative: agg.negative / total,
  }
}

function takeTopWords(items: WordCount[], tier: ExtractTier): WordCount[] {
  const limit = TOP_WORDS_LIMIT_BY_TIER[tier]
  return Number.isFinite(limit) && limit < items.length
    ? items.slice(0, limit)
    : items
}

function takeTopEmojis(items: EmojiCount[], tier: ExtractTier): EmojiCount[] {
  const limit = TOP_EMOJI_LIMIT_BY_TIER[tier]
  return Number.isFinite(limit) && limit < items.length
    ? items.slice(0, limit)
    : items
}

export const runtime = "nodejs"
export const maxDuration = 60

const ExtractSchema = z.object({
  videoId: z.string().regex(/^[\w-]{11}$/, "Invalid videoId"),
  maxComments: z.number().int().min(1).max(PRO_MONTHLY_CAP).optional(),
})

const PAGE_SIZE = 100

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = ExtractSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    )
  }

  const { userId } = await authUserId()
  const { videoId, maxComments } = parsed.data

  // ── Signed-in path ──────────────────────────────────────────────────────
  // Quota check + fetch + paginate + usage bump now live in the shared
  // extract-core module so the (future) MCP tool walks the same path. The web
  // route keeps order:"time" to preserve its existing behavior, then runs the
  // unchanged downstream: sentiment, top-words, emoji, metadata fetch, save.
  if (userId) {
    const yt = ytClient()

    // Fetch video metadata in parallel with comments (1 quota unit, ~0 added
    // latency). Used downstream for saveAnalysis so History + Recent Analyses
    // render thumbnails and titles instead of just the video id placeholder.
    // Best-effort: a failure here must not block the extract.
    const metaPromise = yt.videos
      .list({ part: ["snippet"], id: [videoId] })
      .catch(() => null)

    let userQuota: Awaited<ReturnType<typeof getUserQuota>>
    let comments: Comment[]
    let usedAfter: number
    try {
      const result = await extractCommentsForUser({
        userId,
        videoId,
        max: maxComments,
        order: "time",
      })
      userQuota = result.quota
      comments = result.comments as Comment[]
      usedAfter = result.usedAfter
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        const q = err.quota
        return NextResponse.json(
          {
            error:
              q.tier === "pro"
                ? "Monthly Pro cap reached. Resets on the 1st."
                : "Free tier cap reached. Upgrade for 100,000 comments/month.",
            code: "quota_exceeded",
            tier: q.tier,
            used: q.used,
            cap: q.cap,
            budget: q.cap,
            remaining: 0,
            resetAt: q.resetAt,
          },
          { status: 402 },
        )
      }
      if (err instanceof CommentsDisabledError) {
        return NextResponse.json(
          { error: "Comments are disabled for this video by the uploader" },
          { status: 400 },
        )
      }
      if (err instanceof YouTubeQuotaError) {
        return NextResponse.json(
          {
            error:
              "TubeMine has hit its YouTube API daily quota. Please try again tomorrow.",
          },
          { status: 503 },
        )
      }
      if (err instanceof VideoNotFoundError) {
        return NextResponse.json({ error: "Video not found" }, { status: 404 })
      }
      if (err instanceof NoCommentsError) {
        return NextResponse.json(
          { error: err.message || "Extraction failed" },
          { status: 500 },
        )
      }
      throw err
    }

    // Score sentiment in-process. Never let it block the extract response.
    let sentimentAggregate: SentimentAggregate | null = null
    try {
      const result = scoreCommentsSentiment(comments.map((c) => c.text))
      sentimentAggregate = result.aggregate
      for (let i = 0; i < comments.length; i++) {
        comments[i].sentiment = result.perComment[i]?.label ?? "unknown"
      }
    } catch (err) {
      console.error("[sentiment] scoring failed:", err)
    }

    // Single full ranking pass. Slice per tier for response, slice STORAGE_*
    // for persistence.
    const texts = comments.map((c) => c.text)
    const wordsAnalysis = analyzeTopWords(texts, Number.POSITIVE_INFINITY)
    const emojiAnalysis = analyzeTopEmojis(texts, Number.POSITIVE_INFINITY)

    const tier: ExtractTier = userQuota.tier
    const topWordsForTier = takeTopWords(wordsAnalysis.items, tier)
    const topEmojisForTier = takeTopEmojis(emojiAnalysis.items, tier)
    const distribution = sentimentDistribution(sentimentAggregate)

    // Usage was bumped atomically inside extractCommentsForUser, which returns
    // the live post-bump total (usedAfter). Mirror the original fallback: prefer
    // the RPC total, fall back to the pre-read snapshot + this request's count
    // when the bump returned 0 (RPC failure / no-op).
    const newUsed = usedAfter || userQuota.used + comments.length

    // Best-effort persistence: never blocks the response.
    try {
      const topWordsStored = wordsAnalysis.items
        .slice(0, STORAGE_TOP_WORDS)
        .map((w) => ({ token: w.word, count: w.count }))
      const emojiStored = emojiAnalysis.items
        .slice(0, STORAGE_TOP_EMOJIS)
        .map((e) => ({ emoji: e.emoji, count: e.count, percent: e.share * 100 }))

      const metaSnippet = (await metaPromise)?.data.items?.[0]?.snippet ?? null
      const storedComments: StoredComment[] = comments.map((c) => ({
        authorName: c.author ?? null,
        text: c.text,
        likes: c.likes,
        replies: c.replies,
        publishedAt: c.publishedAt,
        sentiment: c.sentiment ?? null,
      }))
      await saveAnalysis({
        userId,
        videoId,
        videoTitle: metaSnippet?.title ?? null,
        channelName: metaSnippet?.channelTitle ?? null,
        thumbnailUrl:
          metaSnippet?.thumbnails?.high?.url ??
          metaSnippet?.thumbnails?.medium?.url ??
          metaSnippet?.thumbnails?.default?.url ??
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        commentCount: comments.length,
        sentiment: sentimentAggregate,
        topWords: topWordsStored,
        emojiFrequency: emojiStored,
        tier: userQuota.tier,
        comments: storedComments,
      })
    } catch (e) {
      console.warn("[analyses] save threw (extract continues)", {
        error: String(e),
        userId,
        videoId,
      })
    }

    return NextResponse.json({
      comments,
      extracted: comments.length,
      tier,
      used: newUsed,
      remaining: Math.max(0, userQuota.cap - newUsed),
      cap: userQuota.cap,
      // Legacy field name kept for the existing client UI.
      budget: userQuota.cap,
      resetAt: userQuota.resetAt,
      sentiment: sentimentAggregate,
      sentiment_distribution: distribution,
      top_words: topWordsForTier,
      top_emoji: topEmojisForTier,
      unique_words_total: wordsAnalysis.totalUnique,
      unique_emoji_total: emojiAnalysis.totalUnique,
    })
  }

  // ── Anonymous (IP) path ─────────────────────────────────────────────────
  // Left intentionally inline + unchanged from the original implementation.
  const ip = getClientIp(req)
  const ipStatus = await getBudgetStatus(ip)
  if (ipStatus.remaining <= 0) {
    return NextResponse.json(
      {
        error: "Monthly budget exhausted",
        used: ipStatus.used,
        budget: ipStatus.budget,
        remaining: 0,
        resetAt: ipStatus.resetAt,
      },
      { status: 429 },
    )
  }
  const limit = Math.min(maxComments ?? MONTHLY_BUDGET, ipStatus.remaining)

  const yt = ytClient()
  const comments: Comment[] = []
  let pageToken: string | undefined

  // Fetch video metadata in parallel with comments. Best-effort: started here
  // to keep the IP path's prior side-effects identical (quota unit spent).
  yt.videos.list({ part: ["snippet"], id: [videoId] }).catch(() => null)

  try {
    while (comments.length < limit) {
      const res = await yt.commentThreads.list({
        part: ["snippet"],
        videoId,
        maxResults: Math.min(PAGE_SIZE, limit - comments.length),
        pageToken,
        textFormat: "plainText",
        order: "time",
      })

      for (const item of res.data.items ?? []) {
        const s = item.snippet?.topLevelComment?.snippet
        if (!s) continue
        comments.push({
          author: s.authorDisplayName ?? "(anonymous)",
          text: s.textDisplay ?? "",
          likes: Number(s.likeCount ?? 0),
          publishedAt: s.publishedAt ?? "",
          replies: Number(item.snippet?.totalReplyCount ?? 0),
        })
        if (comments.length >= limit) break
      }

      pageToken = res.data.nextPageToken ?? undefined
      if (!pageToken) break
    }
  } catch (err) {
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
      return NextResponse.json(
        { error: "Comments are disabled for this video by the uploader" },
        { status: 400 },
      )
    }
    if (e?.code === 403 && reason === "quotaExceeded") {
      return NextResponse.json(
        {
          error:
            "TubeMine has hit its YouTube API daily quota. Please try again tomorrow.",
        },
        { status: 503 },
      )
    }
    if (e?.code === 404) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    if (comments.length === 0) {
      return NextResponse.json(
        { error: e?.message ?? "Extraction failed" },
        { status: 500 },
      )
    }
  }

  // Score sentiment in-process. Never let it block the extract response.
  // Per-comment sentiment is still surfaced in the anonymous `comments`
  // payload; the aggregate is intentionally omitted from the response below.
  try {
    const result = scoreCommentsSentiment(comments.map((c) => c.text))
    for (let i = 0; i < comments.length; i++) {
      comments[i].sentiment = result.perComment[i]?.label ?? "unknown"
    }
  } catch (err) {
    console.error("[sentiment] scoring failed:", err)
  }

  // Single full ranking pass. Slice per tier for response.
  const texts = comments.map((c) => c.text)
  const wordsAnalysis = analyzeTopWords(texts, Number.POSITIVE_INFINITY)
  const emojiAnalysis = analyzeTopEmojis(texts, Number.POSITIVE_INFINITY)

  const tier: ExtractTier = "anonymous"
  const topWordsForTier = takeTopWords(wordsAnalysis.items, tier)
  const topEmojisForTier = takeTopEmojis(emojiAnalysis.items, tier)

  await recordUsage(ip, comments.length)
  return NextResponse.json({
    comments,
    extracted: comments.length,
    tier,
    used: ipStatus.used + comments.length,
    remaining: Math.max(0, ipStatus.remaining - comments.length),
    budget: ipStatus.budget,
    resetAt: ipStatus.resetAt,
    // Anonymous: sentiment + sentiment_distribution intentionally omitted (curiosity-gap floor).
    top_words: topWordsForTier,
    top_emoji: topEmojisForTier,
    unique_words_total: wordsAnalysis.totalUnique,
    unique_emoji_total: emojiAnalysis.totalUnique,
  })
}

export async function GET(req: NextRequest) {
  const { userId } = await authUserId()
  if (userId) {
    const quota = await getUserQuota(userId)
    return NextResponse.json({
      tier: quota.tier,
      used: quota.used,
      remaining: quota.remaining,
      cap: quota.cap,
      budget: quota.cap,
      resetAt: quota.resetAt,
    })
  }
  const ip = getClientIp(req)
  const status = await getBudgetStatus(ip)
  return NextResponse.json({
    tier: "anonymous" as ExtractTier,
    ...status,
    resetAt: nextMonthFirstIso(),
  })
}
