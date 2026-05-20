"use client"

import { useEffect } from "react"

/**
 * Client island that runs the post-OAuth checkout redirect.
 * When pricing/page.tsx detects ?intent=signup AND signedIn AND tier !== "pro",
 * it mounts this island; the useEffect fires window.location.assign("/api/checkout")
 * once on mount. Single round-trip; no auth-callback edit needed.
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
      window.location.assign("/api/checkout")
    }
  }, [intent, signedIn, tier])
  return null
}
