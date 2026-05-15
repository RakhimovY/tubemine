import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { extractVideoId, type VideoMeta } from "@/lib/types"
import { ytClient } from "@/lib/youtube"

export const runtime = "nodejs"

const PreviewSchema = z.object({ url: z.string().min(1) })

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = PreviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing url field" }, { status: 400 })
  }

  const videoId = extractVideoId(parsed.data.url)
  if (!videoId) {
    return NextResponse.json(
      { error: "Could not parse a YouTube video ID from that URL" },
      { status: 400 },
    )
  }

  try {
    const yt = ytClient()
    const res = await yt.videos.list({
      part: ["snippet", "statistics"],
      id: [videoId],
    })
    const video = res.data.items?.[0]
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    const stats = video.statistics ?? {}
    const snippet = video.snippet ?? {}
    const meta: VideoMeta = {
      videoId,
      title: snippet.title ?? "(untitled)",
      channel: snippet.channelTitle ?? "(unknown)",
      views: Number(stats.viewCount ?? 0),
      likes: Number(stats.likeCount ?? 0),
      commentCount: Number(stats.commentCount ?? 0),
      thumbnail:
        snippet.thumbnails?.high?.url ??
        snippet.thumbnails?.default?.url ??
        null,
      publishedAt: snippet.publishedAt ?? null,
      commentsDisabled: stats.commentCount === undefined,
    }
    return NextResponse.json(meta)
  } catch (err) {
    const e = err as { code?: number; message?: string }
    if (e?.code === 403) {
      return NextResponse.json(
        { error: "YouTube API quota exhausted. Try again later." },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: e?.message ?? "Failed to fetch video metadata" },
      { status: 500 },
    )
  }
}
