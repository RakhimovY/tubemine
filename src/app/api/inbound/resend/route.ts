import { NextResponse, type NextRequest } from "next/server"
import { processInboundWebhook } from "@/lib/inbound-email"

export const runtime = "nodejs"
// Resend signs the raw body; we must read text(), not json(), so the bytes
// passed to verify() match exactly what was signed.
export const dynamic = "force-dynamic"

/**
 * Inbound webhook for Resend. Receives `email.received` events for
 * support@tubemine.tech and forwards each to FORWARD_TO (gmail) via the
 * Resend SDK's emails.receiving.forward(...) helper.
 *
 * Endpoint URL (registered in Resend dashboard):
 *   https://tubemine.tech/api/inbound/resend
 * Required env:
 *   RESEND_API_KEY        (already set, Phase 6)
 *   RESEND_WEBHOOK_SECRET (set in Phase 7b)
 *
 * Linear: TUB-8
 * See vault: projects/yt-comments/launch/2026-05-21/resend-setup.md Phase 7b
 */
export async function POST(request: NextRequest): Promise<Response> {
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch (err) {
    console.error(
      "[inbound/resend] failed to read body:",
      err instanceof Error ? err.message : String(err),
    )
    return NextResponse.json(
      { ok: false, reason: "body-read-failed" },
      { status: 400 },
    )
  }

  const result = await processInboundWebhook({
    rawBody,
    svixId: request.headers.get("svix-id"),
    svixTimestamp: request.headers.get("svix-timestamp"),
    svixSignature: request.headers.get("svix-signature"),
    webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
  })

  return NextResponse.json(result.body, { status: result.status })
}
