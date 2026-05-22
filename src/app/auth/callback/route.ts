import { NextResponse, type NextRequest } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { sendWelcomeEmail } from "@/lib/email"
import { safeNext } from "./safe-next"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = safeNext(searchParams.get("next"))
  const intent = searchParams.get("intent")
  const plan = searchParams.get("plan")

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

  // Pro signup intent: bounce back to /pricing so PricingIntentRedirect
  // can run the Pro checkout POST. Only fires when the user explicitly
  // picked the Pro plan (intent=signup&plan=pro from the Pro card CTA).
  // Generic signup intent (no plan, e.g. header "Get started" or Free
  // card CTA) falls through to the default-target branch below.
  if (intent === "signup" && plan === "pro") {
    const localeMatch = next.match(/^\/(en|ru)\//)
    const locale = localeMatch?.[1] ?? "en"
    const pricingUrl = new URL(`/${locale}/pricing`, origin)
    pricingUrl.searchParams.set("intent", "signup")
    pricingUrl.searchParams.set("plan", "pro")
    return NextResponse.redirect(pricingUrl)
  }

  // Default post-OAuth target: dashboard, not the landing page. safeNext
  // returns "/" when no next was set (header "Get started", bare /login
  // visits). Without this branch a freshly authenticated user would be
  // dumped on the marketing landing, which is confusing.
  if (next === "/") {
    const localeCookie = request.cookies.get("NEXT_LOCALE")?.value
    const locale = localeCookie === "ru" ? "ru" : "en"
    return NextResponse.redirect(`${origin}/${locale}/dashboard`)
  }

  return NextResponse.redirect(`${origin}${next}`)
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
