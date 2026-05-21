import { NextResponse } from "next/server"
import { deleteAnalysis, getAnalysisById } from "@/lib/analyses"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  const result = await getAnalysisById(supabase, id)
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }
    return NextResponse.json({ error: "comments_unavailable" }, { status: 500 })
  }
  const row = result.row
  const has_comments = row.comments != null || row.comments_blob_path != null
  return NextResponse.json({
    id: row.id,
    video_id: row.video_id,
    video_title: row.video_title,
    channel_name: row.channel_name,
    thumbnail_url: row.thumbnail_url,
    comment_count: row.comment_count,
    sentiment: row.sentiment,
    top_words: row.top_words,
    emoji_frequency: row.emoji_frequency,
    processed_at: row.processed_at,
    expires_at: row.expires_at,
    comments: row.comments,
    has_comments,
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth check FIRST per SPEC §3.3 (401 ranks before 400).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  // Pass user-scoped client. RLS owner-check enforced at DB.
  const deleted = await deleteAnalysis(supabase, id)
  return NextResponse.json({ deleted })
}
