import { NextResponse, type NextRequest } from "next/server"
import { Webhooks } from "@polar-sh/nextjs"
import {
  handleSubscriptionActive,
  handleSubscriptionCanceled,
  handleSubscriptionRevoked,
  handleSubscriptionUpdated,
  markWebhookProcessed,
} from "@/lib/subscription"

export const runtime = "nodejs"
// Polar relies on raw body for signature verification. App Router gives us
// the raw body by default in route handlers.

export async function POST(request: NextRequest): Promise<Response> {
  const secret = process.env.POLAR_WEBHOOK_SECRET
  if (!secret) {
    console.error("[polar/webhook] POLAR_WEBHOOK_SECRET not set")
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    )
  }

  // The webhook-id header is Polar's per-delivery ID (Standard Webhooks spec).
  // Retries reuse the same id, so it's the right key for idempotency.
  const webhookId = request.headers.get("webhook-id") ?? ""

  async function once<T>(
    type: string,
    payload: T,
    handler: (data: T) => Promise<void>,
  ): Promise<void> {
    if (webhookId) {
      const already = await markWebhookProcessed(webhookId, type)
      if (already) return
    }
    await handler(payload)
  }

  const handle = Webhooks({
    webhookSecret: secret,
    onSubscriptionCreated: async (payload) =>
      once("subscription.created", payload.data, handleSubscriptionActive),
    onSubscriptionActive: async (payload) =>
      once("subscription.active", payload.data, handleSubscriptionActive),
    onSubscriptionUpdated: async (payload) =>
      once("subscription.updated", payload.data, handleSubscriptionUpdated),
    onSubscriptionCanceled: async (payload) =>
      once("subscription.canceled", payload.data, handleSubscriptionCanceled),
    onSubscriptionRevoked: async (payload) =>
      once("subscription.revoked", payload.data, handleSubscriptionRevoked),
  })

  return handle(request)
}
