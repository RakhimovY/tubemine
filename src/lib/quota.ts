import "server-only"
import { cache } from "react"
import { createServiceClient } from "@/lib/supabase/server"

export const FREE_MONTHLY_CAP = 5_000
export const PRO_MONTHLY_CAP = 100_000

export type Tier = "free" | "pro"

export type UserQuota = {
  tier: Tier
  cap: number
  used: number
  remaining: number
  resetAt: string
}

function nextMonthFirstIso(): string {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() + 1, 1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`
}

/**
 * Derive effective tier for a user. profile.tier is the paid state; the
 * subscription row provides a grace-period override if Polar marked it
 * revoked but the profile write lost the race.
 */
async function effectiveTier(userId: string): Promise<Tier> {
  const sb = createServiceClient()
  const [profileRes, subRes] = await Promise.all([
    sb.from("profiles").select("tier").eq("user_id", userId).maybeSingle(),
    sb
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle(),
  ])

  const profileTier: Tier = profileRes.data?.tier === "pro" ? "pro" : "free"

  // Hard downgrade if subscription is revoked, regardless of profile state.
  if (profileTier === "pro" && subRes.data?.status === "revoked") {
    return "free"
  }

  return profileTier
}

const _getUserQuota = async (userId: string): Promise<UserQuota> => {
  const sb = createServiceClient()
  const [tier, usageRes] = await Promise.all([
    effectiveTier(userId),
    sb
      .from("usage")
      .select("comments_used")
      .eq("user_id", userId)
      .eq("month", currentMonth())
      .maybeSingle(),
  ])

  const cap = tier === "pro" ? PRO_MONTHLY_CAP : FREE_MONTHLY_CAP
  const used = usageRes.data?.comments_used ?? 0

  return {
    tier,
    cap,
    used,
    remaining: Math.max(0, cap - used),
    resetAt: nextMonthFirstIso(),
  }
}

export const getUserQuota = cache(_getUserQuota)

/**
 * Atomically increment a user's monthly usage. Returns the new total.
 * Uses the bump_usage Postgres function for race-free upsert+increment.
 */
export async function bumpUserUsage(
  userId: string,
  delta: number,
): Promise<number> {
  if (delta <= 0) return 0
  const sb = createServiceClient()
  const { data, error } = await sb.rpc("bump_usage", {
    uid: userId,
    delta,
  })
  if (error) {
    console.error("[quota] bump_usage failed:", error)
    return 0
  }
  return typeof data === "number" ? data : 0
}
