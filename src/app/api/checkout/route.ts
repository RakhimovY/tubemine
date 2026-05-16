import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createProCheckout } from "@/lib/polar"

export const runtime = "nodejs"

function originFromRequest(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_ORIGIN ??
    req.nextUrl.origin
  )
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return NextResponse.json(
      { error: "You must be signed in to upgrade." },
      { status: 401 },
    )
  }

  try {
    const origin = originFromRequest(req)
    const { checkoutUrl } = await createProCheckout({
      userId: user.id,
      customerEmail: user.email,
      successUrl: `${origin}/dashboard?welcome=true`,
    })

    return NextResponse.json({ url: checkoutUrl })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create checkout"
    console.error("[checkout] failed:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
