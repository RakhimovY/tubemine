"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "@/i18n/navigation"
import { getAuthHint } from "@/lib/auth-hint"

/**
 * Client island that runs a hint-only redirect for signed-in
 * visitors landing on /[locale]/. No async supabase fetch, no
 * onAuthStateChange listener: the only signal is the localStorage
 * hint set by SiteHeaderClient on every page (TUB-30 contract).
 *
 * Cold-load signed-in visitors with no hint see the anonymous
 * landing. Accepted trade per spec section 3.4: eliminates the
 * 500-2000ms supabase round-trip on every landing visit (the
 * overwhelming majority of which is anonymous marketing traffic).
 */
export function LandingAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    async function resolve() {
      const hint = getAuthHint()
      if (hint !== "signed-in") return
      // Detach setState from the synchronous effect body to satisfy
      // react-hooks/avoid-sync-set-state-in-effect; matches the pattern
      // used in PricingTierAware (TUB-32 PR 1).
      await Promise.resolve()
      setRedirecting(true)
      router.replace("/dashboard")
    }
    void resolve()
  }, [router])

  if (redirecting) {
    return (
      <div
        className="landing-redirect-indicator"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="brand-mark" aria-hidden="true" />
      </div>
    )
  }
  return <>{children}</>
}
