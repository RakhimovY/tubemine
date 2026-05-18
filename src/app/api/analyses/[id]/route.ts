import { NextResponse } from "next/server"
import { deleteAnalysis } from "@/lib/analyses"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
