import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import ExcelJS from "exceljs"
import { authUserId } from "@/lib/auth"
import { getUserQuota } from "@/lib/quota"

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

const ExportRequestSchema = z.object({
  format: z.enum(["json", "xlsx"]),
  videoId: z.string().regex(/^[\w-]{11}$/),
  videoTitle: z.string().max(500).optional(),
  channelName: z.string().max(200).optional(),
  comments: z.array(CommentSchema).max(10_000),
})

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const { userId } = await authUserId()
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in required" },
      { status: 401 },
    )
  }

  const quota = await getUserQuota(userId)
  if (quota.tier !== "pro") {
    return NextResponse.json(
      { error: "Pro plan required for JSON and Excel export" },
      { status: 403 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    )
  }

  const parsed = ExportRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }

  const { format, videoId, videoTitle, channelName, comments } = parsed.data
  const filenameBase = `tubemine-${videoId}-${todayUtc()}`

  if (format === "json") {
    const payload = {
      videoId,
      videoTitle,
      channelName,
      exported_at: new Date().toISOString(),
      comments,
    }
    return NextResponse.json(payload, {
      headers: {
        "Content-Disposition": `attachment; filename="${filenameBase}.json"`,
      },
    })
  }

  // format === "xlsx"
  try {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Comments")
    sheet.addRow(["Author", "Comment", "Sentiment", "Likes", "Replies", "Published"])
    for (const c of comments) {
      sheet.addRow([
        c.author,
        c.text,
        c.sentiment ?? "",
        c.likes,
        c.replies,
        c.publishedAt,
      ])
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
  } catch (err) {
    console.error("[export] xlsx build failed", err)
    return NextResponse.json(
      { error: "Export build failed" },
      { status: 500 },
    )
  }
}
