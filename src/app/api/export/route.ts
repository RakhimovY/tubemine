import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import ExcelJS from "exceljs"
import { authUserId } from "@/lib/auth"
import { getUserQuota } from "@/lib/quota"
import { sanitizeForSpreadsheet } from "@/lib/csv-safe"
import { createClient } from "@/lib/supabase/server"
import { downloadCommentsBlob } from "@/lib/supabase/storage"
import type { StoredComment } from "@/lib/comments"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CommentSchema = z.object({
  author: z.string().max(200),
  text: z.string().max(10_000),
  sentiment: z.string().max(20).optional(),
  likes: z.number().int().nonnegative().max(100_000_000),
  replies: z.number().int().nonnegative().max(100_000_000),
  publishedAt: z.string().max(50),
})

// Extract mode: live-extract flow. `mode` defaults to "extract" so existing
// callers (tubemine.tsx) don't need to send it. Spec §10 forbids touching
// tubemine.tsx, so this default is load-bearing.
const ExtractExportRequestSchema = z.object({
  mode: z.literal("extract").default("extract"),
  format: z.enum(["json", "xlsx"]),
  videoId: z.string().regex(/^[\w-]{11}$/),
  videoTitle: z.string().max(500).optional(),
  channelName: z.string().max(200).optional(),
  comments: z.array(CommentSchema).max(10_000),
})

// Cache mode: read from analyses table. Free tier can request CSV; JSON/xlsx
// remain Pro-only.
const CacheExportRequestSchema = z.object({
  mode: z.literal("cache"),
  analysisId: z.string().uuid(),
  format: z.enum(["csv", "json", "xlsx"]),
})

const RequestSchema = z.union([CacheExportRequestSchema, ExtractExportRequestSchema])

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

type ExportPayloadComment = {
  author: string
  text: string
  sentiment?: string
  likes: number
  replies: number
  publishedAt: string
}

async function buildExportResponse(
  format: "csv" | "json" | "xlsx",
  payload: {
    videoId: string
    videoTitle?: string
    channelName?: string
    comments: ExportPayloadComment[]
  },
): Promise<Response> {
  const filenameBase = `tubemine-${payload.videoId}-${todayUtc()}`

  if (format === "json") {
    const out = {
      videoId: payload.videoId,
      videoTitle: payload.videoTitle,
      channelName: payload.channelName,
      exported_at: new Date().toISOString(),
      comments: payload.comments,
    }
    return NextResponse.json(out, {
      headers: {
        "Content-Disposition": `attachment; filename="${filenameBase}.json"`,
      },
    })
  }

  if (format === "csv") {
    const header = ["Author", "Comment", "Sentiment", "Likes", "Replies", "Published"]
    const escape = (v: string | number) => {
      const safe = sanitizeForSpreadsheet(String(v))
      if (/["\n,]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
      return safe
    }
    const lines = [header.join(",")]
    for (const c of payload.comments) {
      lines.push(
        [
          escape(c.author),
          escape(c.text),
          escape(c.sentiment ?? ""),
          c.likes,
          c.replies,
          escape(c.publishedAt),
        ].join(","),
      )
    }
    const csv = lines.join("\n")
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    })
  }

  // format === "xlsx"
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Comments")
  sheet.addRow(["Author", "Comment", "Sentiment", "Likes", "Replies", "Published"])
  const stringCols = [1, 2, 3, 6]
  for (const c of payload.comments) {
    const row = sheet.addRow([
      sanitizeForSpreadsheet(c.author),
      sanitizeForSpreadsheet(c.text),
      sanitizeForSpreadsheet(c.sentiment ?? ""),
      c.likes,
      c.replies,
      sanitizeForSpreadsheet(c.publishedAt),
    ])
    for (const col of stringCols) {
      row.getCell(col).numFmt = "@"
    }
  }
  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
    },
  })
}

export async function POST(req: NextRequest) {
  const { userId } = await authUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }
  const data = parsed.data

  // Tier gate (TUB-34): Pro required for JSON / xlsx in both modes; cache+csv
  // is free-tier accessible (retention promise per pricing matrix).
  const needsPro =
    (data.mode === "extract" && (data.format === "json" || data.format === "xlsx")) ||
    (data.mode === "cache" && (data.format === "json" || data.format === "xlsx"))

  if (needsPro) {
    const quota = await getUserQuota(userId)
    if (quota.tier !== "pro") {
      return NextResponse.json(
        { error: "Pro plan required for this export format" },
        { status: 403 },
      )
    }
  }

  try {
    if (data.mode === "cache") {
      const supabase = await createClient()
      const { data: row, error } = await supabase
        .from("analyses")
        .select("video_id, video_title, channel_name, comments, comments_blob_path")
        .eq("id", data.analysisId)
        .maybeSingle()
      if (error || !row) {
        return NextResponse.json({ error: "not_found" }, { status: 404 })
      }
      let comments: StoredComment[] | null =
        (row.comments as StoredComment[] | null) ?? null
      if (!comments && row.comments_blob_path) {
        try {
          comments = await downloadCommentsBlob(row.comments_blob_path as string)
        } catch (e) {
          console.warn("[export] cache blob download failed", {
            error: (e as Error).message,
          })
          return NextResponse.json(
            { error: "comments_unavailable" },
            { status: 500 },
          )
        }
      }
      if (!comments) {
        return NextResponse.json(
          { error: "comments_not_stored" },
          { status: 410 },
        )
      }
      const exportComments: ExportPayloadComment[] = comments.map((c) => ({
        author: c.authorName ?? "",
        text: c.text,
        sentiment: c.sentiment ?? undefined,
        likes: c.likes,
        replies: c.replies ?? 0,
        publishedAt: c.publishedAt ?? "",
      }))
      return await buildExportResponse(data.format, {
        videoId: row.video_id as string,
        videoTitle: (row.video_title as string | null) ?? undefined,
        channelName: (row.channel_name as string | null) ?? undefined,
        comments: exportComments,
      })
    }

    // data.mode === "extract"
    return await buildExportResponse(data.format, {
      videoId: data.videoId,
      videoTitle: data.videoTitle,
      channelName: data.channelName,
      comments: data.comments,
    })
  } catch (err) {
    console.error("[export] build failed", err)
    return NextResponse.json({ error: "Export build failed" }, { status: 500 })
  }
}
