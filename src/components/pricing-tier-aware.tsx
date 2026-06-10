"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import NextLink from "next/link"
import { Link as IntlLink } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/client"
import { setAuthHint } from "@/lib/auth-hint"
import { PricingIntentRedirect } from "@/components/pricing-intent-redirect"

type Tier = "anonymous" | "free" | "pro"

type State = {
  signedIn: boolean
  tier: Tier
  resolved: boolean
}

const INITIAL_STATE: State = {
  signedIn: false,
  tier: "anonymous",
  resolved: false,
}

export function PricingTierAware() {
  const t = useTranslations("pricing")
  const locale = useLocale()
  const searchParams = useSearchParams()
  const intent = searchParams?.get("intent") ?? null
  const plan = searchParams?.get("plan") ?? null

  const [state, setState] = useState<State>(INITIAL_STATE)
  const requestIdRef = useRef(0)

  useEffect(() => {
    let sb: ReturnType<typeof createClient> | null = null
    try {
      sb = createClient()
    } catch {
      // Env missing or createBrowserClient threw: stay at INITIAL_STATE
      // (anonymous, !resolved). Page renders anon CTAs only and
      // PricingIntentRedirect does not mount. Per spec § 5 error row 1.
      return
    }
    if (!sb) return
    const sbClient = sb

    async function resolve(): Promise<void> {
      const myId = ++requestIdRef.current
      const { data: { user }, error } = await sbClient.auth.getUser()
      if (myId !== requestIdRef.current) return

      if (error || !user) {
        setState({ signedIn: false, tier: "anonymous", resolved: true })
        setAuthHint("anonymous")
        return
      }

      const [profileQ, subQ] = await Promise.all([
        sbClient.from("profiles").select("tier").eq("user_id", user.id).maybeSingle(),
        sbClient.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle(),
      ])
      if (myId !== requestIdRef.current) return

      const rawTier: "free" | "pro" = profileQ.data?.tier === "pro" ? "pro" : "free"
      const isRevoked = rawTier === "pro" && subQ.data?.status === "revoked"
      const effective: "free" | "pro" = isRevoked ? "free" : rawTier
      setState({ signedIn: true, tier: effective, resolved: true })
      setAuthHint("signed-in")
    }

    // Subscribe BEFORE the IIFE so INITIAL_SESSION (fired by Supabase
    // synchronously on subscribe) is captured by the requestId counter.
    const { data: sub } = sbClient.auth.onAuthStateChange(() => {
      void resolve()
    })

    void resolve()

    return () => {
      sub?.subscription?.unsubscribe()
    }
  }, [])

  return (
    <div className="pricing-grid">
      {/* FREE */}
      <article className="price-card" aria-labelledby="plan-free">
        <div className="price-head">
          <span className="price-name" id="plan-free">{t("free.name")}</span>
          <span className="badge badge--outline">{t("free.badge")}</span>
        </div>
        <div className="price-num">
          <span className="currency">{t("free.currency")}</span>
          {t("free.price")}
          <span className="unit">{t("free.unit")}</span>
        </div>
        <ul className="price-list">
          {[t("free.b1"), t("free.b2"), t("free.b3"), t("free.b4"), t("free.b5"), t("free.b6")].map((b, i) => (
            <li key={i}>
              <span className="price-check"><CheckIcon /></span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="price-foot" suppressHydrationWarning>
          <FreeCardCta tier={state.tier} />
        </div>
      </article>

      {/* PRO */}
      <article className="price-card is-popular" aria-labelledby="plan-pro">
        <div className="price-head">
          <span className="price-name" id="plan-pro">{t("pro.name")}</span>
          <span className="badge badge--default">
            <span className="badge-dot" />
            {t("pro.badge")}
          </span>
        </div>
        <div className="price-num">
          <span className="currency">{t("pro.currency")}</span>
          {t("pro.price")}
          <span className="unit">{t("pro.unit")}</span>
        </div>
        <ul className="price-list">
          {[t("pro.b1"), t("pro.b2"), t("pro.b3"), t("pro.b4"), t("pro.b5"), t("pro.b6")].map((b, i) => (
            <li key={i}>
              <span className="price-check"><CheckIcon /></span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="price-foot" suppressHydrationWarning>
          <ProCardCta tier={state.tier} locale={locale} />
        </div>
      </article>

      {state.resolved && (
        <PricingIntentRedirect
          intent={intent}
          plan={plan}
          signedIn={state.signedIn}
          tier={state.tier}
        />
      )}
    </div>
  )
}

function FreeCardCta({ tier }: { tier: Tier }) {
  const t = useTranslations("pricing")
  if (tier === "anonymous") {
    return (
      <IntlLink
        href="/login?intent=signup"
        className="btn btn--primary"
        style={{ gap: 10 }}
      >
        <GoogleIcon />
        {t("free.cta_anon")}
      </IntlLink>
    )
  }
  if (tier === "free") {
    return (
      <>
        <IntlLink href="/dashboard" className="btn btn--secondary">{t("free.cta_free")}</IntlLink>
        <p className="price-note">{t("free.note_free")}</p>
      </>
    )
  }
  return (
    <>
      <IntlLink href="/dashboard" className="btn btn--secondary">{t("free.cta_pro")}</IntlLink>
      <p className="price-note">{t("free.note_pro")}</p>
    </>
  )
}

function ProCardCta({ tier, locale }: { tier: Tier; locale: string }) {
  const t = useTranslations("pricing")
  if (tier === "anonymous") {
    return (
      <>
        <IntlLink
          href={`/login?next=/${locale}/pricing&intent=signup&plan=pro`}
          className="btn btn--primary"
        >
          {t("pro.cta_anon")}
        </IntlLink>
        <p className="price-note">{t("pro.note_anon")}</p>
      </>
    )
  }
  if (tier === "free") {
    return (
      <>
        <ProUpgradeButton label={t("pro.cta_free")} />
        <p className="price-note">{t("pro.note_free")}</p>
      </>
    )
  }
  return (
    <>
      <NextLink href="/api/portal" className="btn btn--secondary">{t("pro.cta_pro")}</NextLink>
      <p className="price-note">{t("pro.note_pro")}</p>
    </>
  )
}

function ProUpgradeButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false)
  async function handleClick() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) {
        setLoading(false)
        return
      }
      const data = (await res.json()) as { url?: string }
      if (data?.url) {
        window.location.assign(data.url)
      } else {
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading ? "true" : "false"}
      className="btn btn--primary"
    >
      {label}
      <ArrowRightIcon />
    </button>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="m4 12 5 5L20 6" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg
      className="icon icon-sm"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M21.6 12.227c0-.708-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.51h3.232c1.891-1.742 2.98-4.305 2.98-7.351Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.964-.895 6.619-2.422l-3.232-2.51c-.895.6-2.04.955-3.387.955-2.605 0-4.81-1.76-5.596-4.123H3.064v2.59A9.997 9.997 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.404 13.9A6.013 6.013 0 0 1 6.09 12c0-.66.114-1.3.314-1.9V7.51H3.064A9.997 9.997 0 0 0 2 12c0 1.614.386 3.14 1.064 4.49l3.34-2.59Z" fill="#FBBC05" />
      <path d="M12 5.977c1.468 0 2.787.505 3.824 1.498l2.868-2.868C16.96 2.99 14.695 2 12 2A9.997 9.997 0 0 0 3.064 7.51l3.34 2.59C7.19 7.737 9.395 5.977 12 5.977Z" fill="#EA4335" />
    </svg>
  )
}
