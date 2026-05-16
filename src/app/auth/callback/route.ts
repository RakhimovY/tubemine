import { NextResponse, type NextRequest } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { sendWelcomeEmail } from "@/lib/email"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const redirect = sanitizeRedirect(searchParams.get("redirect"))

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    )
  }

  // Fire-and-forget welcome email, race-safe via DB flag.
  await maybeSendWelcome().catch((err) =>
    console.error("[auth/callback] welcome failed:", err),
  )

  return NextResponse.redirect(`${origin}${redirect}`)
}

async function maybeSendWelcome(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return

  // Atomic claim: only the first concurrent call flips welcome_sent_at from
  // null to a timestamp. Service role bypasses RLS for the write.
  const sb = createServiceClient()
  const { data: claimed } = await sb
    .from("profiles")
    .update({ welcome_sent_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("welcome_sent_at", null)
    .select("user_id")
    .maybeSingle()

  if (!claimed) return // already sent (or profile row missing)
  await sendWelcomeEmail(user.email)
}

function sanitizeRedirect(value: string | null): string {
  if (!value) return "/dashboard"
  // Allow only same-origin paths
  if (value.startsWith("/") && !value.startsWith("//")) return value
  return "/dashboard"
}
