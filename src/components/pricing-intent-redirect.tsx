"use client"

import { useEffect } from "react"

/**
 * Client island that runs the post-OAuth Pro checkout redirect.
 * PricingTierAware mounts this child only when client auth has
 * resolved (state.resolved === true), so signedIn + tier are the
 * final values, not the optimistic-anonymous initial state.
 *
 * Fires only when the user explicitly intended a Pro trial
 * (intent=signup + plan=pro from the Pro card CTA). A bare
 * intent=signup from the Free card just signs the user in and
 * leaves them on /pricing to pick a plan deliberately.
 *
 * Before triggering checkout, strips ?intent + ?plan from the
 * current history entry via history.replaceState so the back
 * button from Polar lands on /pricing without re-firing.
 *
 * POSTs to /api/checkout (the endpoint is POST-only by design;
 * the form fallback in ProCardCta uses the same path) and
 * navigates to the returned Polar checkout URL.
 */
export function PricingIntentRedirect({
  intent,
  plan,
  signedIn,
  tier,
}: {
  intent: string | null
  plan: string | null
  signedIn: boolean
  tier: "anonymous" | "free" | "pro"
}) {
  useEffect(() => {
    if (intent !== "signup" || plan !== "pro" || !signedIn || tier === "pro") return
    window.history.replaceState(null, "", window.location.pathname)
    void (async () => {
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          credentials: "include",
        })
        if (!res.ok) return
        const data = (await res.json()) as { url?: string }
        if (data?.url) window.location.assign(data.url)
      } catch {
        // Silent: user remains on /pricing as signed-in Free, can click
        // the Pro CTA manually (which submits the same /api/checkout POST).
      }
    })()
  }, [intent, plan, signedIn, tier])
  return null
}
