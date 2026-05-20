import "server-only"
import { Resend, type WebhookEventPayload } from "resend"

/**
 * Inbound email forwarding logic. Webhook handler logic isolated from the
 * Next.js route shell so it can be unit-tested directly.
 *
 * Flow:
 *   external sender → tubemine.tech apex MX → AWS SES (Resend us-east-1)
 *   → Resend POSTs `email.received` to /api/inbound/resend
 *   → this module verifies svix signature and forwards to FORWARD_TO via
 *     `resend.emails.receiving.forward(...)` (passthrough = Resend reuses
 *     the received body, so we don't need to fetch it ourselves).
 *
 * Defensive choices:
 *   - Signature failure → 401 (never silently accept).
 *   - Unknown event type → 200 with no-op (Resend will not retry).
 *   - Forward call failure → 500 with logged details (Resend WILL retry,
 *     idempotent by emailId on Resend's side).
 *   - Bad JSON → 400.
 */

const FORWARD_TO_DEFAULT = "erke.bulan622@gmail.com"
const FORWARD_FROM_DEFAULT =
  "TubeMine Support <support@tubemine.tech>"

let cachedResend: Resend | null = null

function client(): Resend | null {
  if (cachedResend) return cachedResend
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  cachedResend = new Resend(key)
  return cachedResend
}

// Test seam: lets unit tests inject a mock Resend client without touching
// process.env or the singleton cache.
export function __setResendClientForTest(c: Resend | null): void {
  cachedResend = c
}

export interface InboundHandlerResult {
  status: number
  body: { ok: boolean; reason?: string; forwardedId?: string }
}

export interface InboundHandlerInput {
  rawBody: string
  svixId: string | null
  svixTimestamp: string | null
  svixSignature: string | null
  webhookSecret: string | undefined
  forwardTo?: string | string[]
  forwardFrom?: string
}

/**
 * Process a Resend inbound webhook request. Pure function: no req/res
 * dependencies, so it can be unit-tested with synthetic input.
 */
export async function processInboundWebhook(
  input: InboundHandlerInput,
): Promise<InboundHandlerResult> {
  const {
    rawBody,
    svixId,
    svixTimestamp,
    svixSignature,
    webhookSecret,
    forwardTo = FORWARD_TO_DEFAULT,
    forwardFrom = FORWARD_FROM_DEFAULT,
  } = input

  if (!webhookSecret) {
    console.error(
      "[inbound/resend] RESEND_WEBHOOK_SECRET not set; refusing webhook",
    )
    return {
      status: 500,
      body: { ok: false, reason: "secret-not-configured" },
    }
  }

  if (!svixId || !svixTimestamp || !svixSignature) {
    return {
      status: 400,
      body: { ok: false, reason: "missing-svix-headers" },
    }
  }

  const r = client()
  if (!r) {
    console.error(
      "[inbound/resend] RESEND_API_KEY not set; cannot verify or forward",
    )
    return {
      status: 500,
      body: { ok: false, reason: "resend-not-configured" },
    }
  }

  let event: WebhookEventPayload
  try {
    // resend.webhooks.verify throws if signature is invalid (svix under the
    // hood). Returns the typed event payload on success.
    event = r.webhooks.verify({
      payload: rawBody,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret,
    })
  } catch (err) {
    console.warn(
      "[inbound/resend] signature verification failed:",
      err instanceof Error ? err.message : String(err),
    )
    return {
      status: 401,
      body: { ok: false, reason: "invalid-signature" },
    }
  }

  if (event.type !== "email.received") {
    // We only subscribe to email.received in Resend, but ignore other types
    // defensively in case the webhook subscription drifts.
    return {
      status: 200,
      body: { ok: true, reason: "ignored-event-type" },
    }
  }

  const emailId = event.data.email_id
  if (!emailId) {
    return {
      status: 400,
      body: { ok: false, reason: "missing-email-id" },
    }
  }

  try {
    const result = await r.emails.receiving.forward({
      emailId,
      to: forwardTo,
      from: forwardFrom,
    })
    if (result.error) {
      console.error(
        "[inbound/resend] forward returned error:",
        result.error,
        "for emailId=",
        emailId,
      )
      return {
        status: 500,
        body: { ok: false, reason: "forward-error" },
      }
    }
    return {
      status: 200,
      body: { ok: true, forwardedId: result.data?.id },
    }
  } catch (err) {
    console.error(
      "[inbound/resend] forward threw:",
      err instanceof Error ? err.message : String(err),
      "for emailId=",
      emailId,
    )
    // Returning 500 lets Resend retry per Standard Webhooks spec.
    return {
      status: 500,
      body: { ok: false, reason: "forward-threw" },
    }
  }
}
