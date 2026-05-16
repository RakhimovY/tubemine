import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL("/", request.url), { status: 303 })
}

export async function GET(request: NextRequest) {
  // Convenience for browser nav. POST preferred from forms.
  return POST(request)
}
