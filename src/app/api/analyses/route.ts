import { NextResponse } from "next/server"
import { z } from "zod"
import {
  ANALYSES_LIST_MAX,
  ANALYSES_LIST_MIN,
  type Cursor,
  decodeCursor,
  listAnalyses,
} from "@/lib/analyses"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LimitSchema = z.coerce
  .number()
  .int()
  .min(ANALYSES_LIST_MIN)
  .max(ANALYSES_LIST_MAX)
  .default(20)

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const rawCursor = url.searchParams.get("cursor")
  const limitParam = url.searchParams.get("limit")

  let cursor: Cursor | null = null
  if (rawCursor) {
    cursor = decodeCursor(rawCursor)
    if (cursor === null) {
      return NextResponse.json(
        { error: "invalid_cursor" },
        { status: 400 },
      )
    }
  }

  const limitParsed = LimitSchema.safeParse(limitParam ?? "20")
  if (!limitParsed.success) {
    return NextResponse.json({ error: "invalid_limit" }, { status: 400 })
  }

  // Pass user-scoped client (NOT service role) so RLS enforces ownership at DB layer.
  const result = await listAnalyses(supabase, cursor, limitParsed.data)
  return NextResponse.json(result)
}
