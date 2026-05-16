import { NextResponse, type NextRequest } from "next/server"
import { CustomerPortal } from "@polar-sh/nextjs"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function originFromRequest(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_ORIGIN ?? req.nextUrl.origin
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getCustomerIdForRequest(_req: NextRequest): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const sb = createServiceClient()
  const { data } = await sb
    .from("subscriptions")
    .select("polar_customer_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!data?.polar_customer_id) {
    throw new Error("No subscription found for this account")
  }
  return data.polar_customer_id
}

export async function GET(req: NextRequest): Promise<Response> {
  const accessToken = process.env.POLAR_ACCESS_TOKEN
  if (!accessToken) {
    return NextResponse.json(
      { error: "POLAR_ACCESS_TOKEN not configured" },
      { status: 500 },
    )
  }

  try {
    const handler = CustomerPortal({
      accessToken,
      server:
        (process.env.NEXT_PUBLIC_POLAR_SERVER as "sandbox" | "production") ??
        "sandbox",
      returnUrl: `${originFromRequest(req)}/dashboard`,
      getCustomerId: getCustomerIdForRequest,
    })
    return handler(req)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to open customer portal"
    return NextResponse.redirect(
      new URL(`/dashboard?portal_error=${encodeURIComponent(message)}`, req.url),
    )
  }
}
