import "server-only"
import { createServiceClient } from "@/lib/supabase/server"

type PolarSubscriptionData = {
  id: string
  customerId?: string
  status?: string
  currentPeriodEnd?: string | Date | null
  cancelAtPeriodEnd?: boolean
  endsAt?: string | Date | null
  // Polar SDK allows string | number | boolean values in metadata. We coerce
  // back to string when reading our own userId key.
  metadata?: Record<string, string | number | boolean | null | undefined>
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return new Date(value).toISOString()
}

function userIdFromPayload(data: PolarSubscriptionData): string | null {
  const meta = data.metadata ?? {}
  const candidate = meta.userId ?? meta.user_id
  if (typeof candidate !== "string" || candidate.length === 0) return null
  return candidate
}

async function findUserIdByCustomer(
  customerId: string | undefined,
): Promise<string | null> {
  if (!customerId) return null
  const sb = createServiceClient()
  const { data } = await sb
    .from("subscriptions")
    .select("user_id")
    .eq("polar_customer_id", customerId)
    .maybeSingle()
  return data?.user_id ?? null
}

async function findUserIdByPolarSubId(
  polarSubId: string,
): Promise<string | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from("subscriptions")
    .select("user_id")
    .eq("polar_subscription_id", polarSubId)
    .maybeSingle()
  return data?.user_id ?? null
}

async function resolveUserId(
  data: PolarSubscriptionData,
): Promise<string | null> {
  return (
    userIdFromPayload(data) ??
    (await findUserIdByPolarSubId(data.id)) ??
    (await findUserIdByCustomer(data.customerId))
  )
}

export async function handleSubscriptionActive(
  data: PolarSubscriptionData,
): Promise<void> {
  const userId = await resolveUserId(data)
  if (!userId) {
    console.warn("[polar] subscription.active without resolvable userId", {
      polarSubId: data.id,
    })
    return
  }

  const sb = createServiceClient()
  const now = new Date().toISOString()

  await sb.from("subscriptions").upsert(
    {
      user_id: userId,
      polar_subscription_id: data.id,
      polar_customer_id: data.customerId ?? null,
      status: data.status ?? "active",
      current_period_end: toIso(data.currentPeriodEnd ?? data.endsAt),
      cancel_at_period_end: data.cancelAtPeriodEnd ?? false,
      updated_at: now,
    },
    { onConflict: "user_id" },
  )

  await sb
    .from("profiles")
    .update({ tier: "pro", updated_at: now })
    .eq("user_id", userId)
}

export async function handleSubscriptionUpdated(
  data: PolarSubscriptionData,
): Promise<void> {
  const userId = await resolveUserId(data)
  if (!userId) {
    console.warn("[polar] subscription.updated without resolvable userId", {
      polarSubId: data.id,
    })
    return
  }

  const sb = createServiceClient()
  const now = new Date().toISOString()
  const status = data.status ?? "active"

  await sb.from("subscriptions").upsert(
    {
      user_id: userId,
      polar_subscription_id: data.id,
      polar_customer_id: data.customerId ?? null,
      status,
      current_period_end: toIso(data.currentPeriodEnd ?? data.endsAt),
      cancel_at_period_end: data.cancelAtPeriodEnd ?? false,
      updated_at: now,
    },
    { onConflict: "user_id" },
  )

  // If Polar marks the subscription as fully expired in an update event,
  // downgrade immediately. Otherwise leave tier as-is — revoked event handles it.
  if (status === "revoked" || status === "expired") {
    await sb
      .from("profiles")
      .update({ tier: "free", updated_at: now })
      .eq("user_id", userId)
  } else if (status === "active" || status === "trialing") {
    await sb
      .from("profiles")
      .update({ tier: "pro", updated_at: now })
      .eq("user_id", userId)
  }
}

export async function handleSubscriptionCanceled(
  data: PolarSubscriptionData,
): Promise<void> {
  // User clicked cancel. Access stays until current_period_end. Polar will
  // emit subscription.revoked when access actually ends -> we downgrade then.
  const userId = await resolveUserId(data)
  if (!userId) return

  const sb = createServiceClient()
  const now = new Date().toISOString()

  await sb
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: true,
      current_period_end: toIso(data.endsAt ?? data.currentPeriodEnd),
      updated_at: now,
    })
    .eq("user_id", userId)
}

export async function handleSubscriptionRevoked(
  data: PolarSubscriptionData,
): Promise<void> {
  // Access ended. Downgrade now.
  const userId = await resolveUserId(data)
  if (!userId) return

  const sb = createServiceClient()
  const now = new Date().toISOString()

  await sb
    .from("subscriptions")
    .update({ status: "revoked", updated_at: now })
    .eq("user_id", userId)

  await sb
    .from("profiles")
    .update({ tier: "free", updated_at: now })
    .eq("user_id", userId)
}

/**
 * Returns true if this webhook delivery was already processed.
 * Inserts into webhook_events; relies on PK conflict for atomicity.
 */
export async function markWebhookProcessed(
  eventId: string,
  eventType: string,
): Promise<boolean> {
  const sb = createServiceClient()
  const { error } = await sb
    .from("webhook_events")
    .insert({ event_id: eventId, event_type: eventType })
  if (!error) return false
  // 23505 = unique_violation in Postgres
  if (error.code === "23505") return true
  console.error("[webhook_events] insert failed:", error)
  // Fail open: process the event anyway (better double-process than miss)
  return false
}
