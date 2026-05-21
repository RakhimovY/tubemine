"use client"

import { useEffect } from "react"

/**
 * Client island that runs the post-OAuth checkout redirect.
 * PricingTierAware mounts this child only when client auth has
 * resolved (state.resolved === true), so signedIn + tier are the
 * final values, not the optimistic-anonymous initial state.
 *
 * Before navigating to /api/checkout, this strips ?intent=signup
 * from the current history entry via history.replaceState so the
 * back-button from Polar (or from /api/checkout if it errors)
 * lands on /pricing without ?intent, preventing a redirect loop.
 */
export function PricingIntentRedirect({
  intent,
  signedIn,
  tier,
}: {
  intent: string | null
  signedIn: boolean
  tier: "anonymous" | "free" | "pro"
}) {
  useEffect(() => {
    if (intent === "signup" && signedIn && tier !== "pro") {
      window.history.replaceState(null, "", window.location.pathname)
      window.location.assign("/api/checkout")
    }
  }, [intent, signedIn, tier])
  return null
}
