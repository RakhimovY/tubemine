import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  MONTHLY_BUDGET,
  getBudgetStatus,
  getClientIp,
  nextMonthFirstIso,
  recordUsage,
} from "@/lib/budget"
import type { Comment } from "@/lib/types"
import { ytClient } from "@/lib/youtube"

export const runtime = "nodejs"
export const maxDuration = 60

const ExtractSchema = z.object({
  videoId: z.string().regex(/^[\w-]{11}$/, "Invalid videoId"),
  maxComments: z.number().int().min(1).max(MONTHLY_BUDGET).optional(),
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

  const { videoId, maxComments = MONTHLY_BUDGET } = parsed.data
  const ip = getClientIp(req)
  const status = await getBudgetStatus(ip)

  if (status.remaining <= 0) {
    return NextResponse.json(
      {
        error: "Monthly budget exhausted",
        used: status.used,
        budget: status.budget,
        remaining: 0,
        resetAt: status.resetAt,
      },
      { status: 429 },
    )
  }

  const limit = Math.min(maxComments, status.remaining)
  const yt = ytClient()
  const comments: Comment[] = []
  let pageToken: string | undefined

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
    const e = err as { code?: number; message?: string; errors?: Array<{ reason?: string }> }
    const reason = e?.errors?.[0]?.reason

    if (e?.code === 403 && (reason === "commentsDisabled" || /disabled/i.test(e?.message ?? ""))) {
      return NextResponse.json(
        { error: "Comments are disabled for this video by the uploader" },
        { status: 400 },
      )
    }
    if (e?.code === 403 && reason === "quotaExceeded") {
      return NextResponse.json(
        { error: "TubeMine has hit its YouTube API daily quota. Please try again tomorrow." },
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

  await recordUsage(ip, comments.length)

  return NextResponse.json({
    comments,
    extracted: comments.length,
    used: status.used + comments.length,
    remaining: Math.max(0, status.remaining - comments.length),
    budget: MONTHLY_BUDGET,
    resetAt: nextMonthFirstIso(),
  })
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const status = await getBudgetStatus(ip)
  return NextResponse.json(status)
}
