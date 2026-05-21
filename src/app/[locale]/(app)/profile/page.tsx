import { getTranslations, setRequestLocale } from "next-intl/server"
import NextLink from "next/link"
import { Link, redirect } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/server"
import { getUserQuota, type Tier } from "@/lib/quota"
import { formatNumber } from "@/lib/format"
import { AccountIdCopy } from "@/components/profile/account-id-copy"
import { CanceledToast } from "@/components/profile/canceled-toast"

export const metadata = {
  title: "Profile - TubeMine",
  description: "Account settings, plan, billing, and danger zone.",
}

export const dynamic = "force-dynamic"

/*
  TUB-1 Visual Port (Profile, Page 4 of 9).
  Verbatim semantic port of:
    /tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/TubeMine Profile.html
  The page wrapper carries BOTH `dashboard-page` (so the shared shell CSS
  applies for free) and `profile-page` (for profile-specific .settings-section,
  .field-row, .plan-card, .billing-body, .danger-row, .copy-btn etc.). The
  inline <script> behavior is split into two small client islands:
    - <AccountIdCopy /> for the click-to-copy account ID button
    - <CanceledToast /> for the ?canceled=true one-shot toast that strips
      the URL param via router.replace
  The public <SiteHeader /> is suppressed for /profile by <SiteHeaderGate />.
  The "Design preview" panel from the prototype is intentionally NOT
  shipped (README: do not ship the design preview panel to production).
*/
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect({ href: `/login?next=/${locale}/profile`, locale })
    return null
  }

  // Direct supabase query for subscription row (lib/subscription only exports
  // webhook handlers, no read helper).
  const [{ data: subscription }, quota] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("status, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
    getUserQuota(user.id),
  ])

  const tier: Tier = quota.tier
  const tProfile = await getTranslations("profile")

  const dateFmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  const shortDateFmt = new Intl.DateTimeFormat(
    locale === "ru" ? "ru-RU" : "en-US",
    { month: "short", day: "numeric", year: "numeric" },
  )
  const joinedDateLabel = dateFmt.format(new Date(user.created_at))
  const joinedDaysAgo = daysSince(user.created_at)
  const resetDateLabel = shortDateFmt.format(new Date(quota.resetAt))

  const periodEndIso = subscription?.current_period_end ?? null
  const periodEndLabel = periodEndIso
    ? shortDateFmt.format(new Date(periodEndIso))
    : ""
  const subscriptionCanceled =
    subscription?.status === "revoked" ||
    subscription?.cancel_at_period_end === true

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : ""
  const displayName = fullName || (user.email ?? "")
  const initials = buildInitials(user.email, user.user_metadata?.full_name)

  const usedPercent = Math.min(100, Math.round((quota.used / quota.cap) * 100))

  return (
    <div className="dashboard-page profile-page">
        {/* Toast host (transient feedback like "Subscription canceled") */}
        <div className="toast-host" aria-live="polite">
          <CanceledToast
            title={tProfile("canceled_toast_title")}
            message={tProfile("canceled_toast_message")}
            dismissLabel={tProfile("canceled_toast_dismiss")}
            endsDate={periodEndLabel}
            locale={locale}
          />
        </div>

        <h1 className="page-title">{tProfile("title")}</h1>

        {/* ============ ACCOUNT ============ */}
        <section
          className="settings-section"
          aria-labelledby="profile-sec-account"
        >
          <header className="settings-head">
            <h2 id="profile-sec-account">{tProfile("section_account")}</h2>
            <p>{tProfile("section_account_sub")}</p>
          </header>
          <div className="settings-body">
            {/* Avatar + name */}
            <div className="field-row">
              <div className="key">{tProfile("account.field_profile")}</div>
              <div className="value">
                <div className="avatar-row">
                  <span className="avatar-lg" aria-hidden="true">
                    {initials}
                  </span>
                  <div className="avatar-meta">
                    <span className="name">{displayName}</span>
                    <span className="from">
                      {tProfile("account.via_google")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="field-row">
              <div className="key">{tProfile("account.field_email")}</div>
              <div className="value">
                <span className="mono">{user.email}</span>
                <span
                  className="badge badge--secondary"
                  style={{ height: 20, padding: "0 8px", fontSize: 11 }}
                >
                  {tProfile("account.email_readonly")}
                </span>
              </div>
            </div>

            {/* Joined */}
            <div className="field-row">
              <div className="key">{tProfile("account.field_joined")}</div>
              <div className="value">
                <span>{joinedDateLabel}</span>
                <span
                  className="muted"
                  style={{
                    fontFamily: "var(--font-family-mono)",
                    fontSize: 12,
                  }}
                >
                  {tProfile("account.ago_relative", { days: joinedDaysAgo })}
                </span>
              </div>
            </div>

            {/* Account ID */}
            <div className="field-row">
              <div className="key">{tProfile("account.field_account_id")}</div>
              <div className="value">
                <span className="mono">{user.id}</span>
                <AccountIdCopy
                  accountId={user.id}
                  copyLabel={tProfile("account.copy")}
                  copiedLabel={tProfile("account.copied")}
                  ariaLabel={tProfile("account.copy_aria")}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ============ PLAN ============ */}
        <section
          className="settings-section"
          aria-labelledby="profile-sec-plan"
        >
          <header className="settings-head">
            <h2 id="profile-sec-plan">{tProfile("section_plan")}</h2>
            <p>{tProfile("section_plan_sub")}</p>
          </header>
          <div className="settings-body">
            <div className="plan-card">
              <div className="plan-head">
                <span className="name">
                  {tier === "free" ? (
                    <span
                      className="badge badge--secondary"
                      style={{ height: 22 }}
                    >
                      {tProfile("plan.tier_free")}
                    </span>
                  ) : (
                    <span
                      className="badge badge--default"
                      style={{ height: 22 }}
                    >
                      <span className="badge-dot" />
                      {tProfile("plan.tier_pro")}
                    </span>
                  )}
                </span>
                {tier === "free" ? (
                  <Link
                    href="/pricing"
                    className="btn btn--secondary btn-sm"
                  >
                    {tProfile("plan.upgrade")}
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
                  </Link>
                ) : (
                  <Link href="/pricing" className="btn btn--ghost btn-sm">
                    {tProfile("plan.see_plans")}
                  </Link>
                )}
              </div>
              <p className="plan-cap">
                <span className="num">{formatNumber(quota.cap)}</span>{" "}
                {tier === "free"
                  ? planCapSuffix(
                      tProfile("plan.free_cap", { cap: quota.cap }),
                      quota.cap,
                    )
                  : planCapSuffix(
                      tProfile("plan.pro_cap", { cap: quota.cap }),
                      quota.cap,
                    )}
              </p>
              <div className="plan-progress">
                <div className="plan-progress-head">
                  <span>
                    {tProfile("plan.used_line", {
                      used: quota.used,
                      cap: quota.cap,
                    })}
                  </span>
                  <span>
                    {tProfile("plan.used_percent", { percent: usedPercent })}
                  </span>
                </div>
                <div
                  className="progress"
                  role="progressbar"
                  aria-valuenow={usedPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${usedPercent}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="plan-foot">
                <Link href="/dashboard">{tProfile("plan.open_dashboard")}</Link>
                <span
                  className={
                    tier === "pro" && subscriptionCanceled
                      ? "renew is-canceled"
                      : "renew"
                  }
                >
                  {tier === "pro" && periodEndLabel
                    ? subscriptionCanceled
                      ? tProfile("plan.ends", { date: periodEndLabel })
                      : tProfile("plan.renews", { date: periodEndLabel })
                    : tProfile("plan.resets", { date: resetDateLabel })}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ============ YOUTUBE CONNECTION ============ */}
        <section
          className="settings-section"
          aria-labelledby="profile-sec-yt"
        >
          <header className="settings-head">
            <h2 id="profile-sec-yt">{tProfile("section_yt")}</h2>
            <p>{tProfile("section_yt_sub")}</p>
          </header>
          <div className="settings-body">
            <div className="yt-conn">
              <div className="yt-conn-status">
                <span className="yt-dot is-coming" aria-hidden="true" />
                <div className="yt-conn-label">
                  <span className="name">{tProfile("yt.coming_title")}</span>
                  <span className="sub">{tProfile("yt.coming_sub")}</span>
                </div>
                <button
                  type="button"
                  className="btn btn--secondary btn-sm"
                  disabled
                  aria-disabled="true"
                  style={{ cursor: "not-allowed", opacity: 0.55 }}
                >
                  {tProfile("yt.coming_cta")}
                </button>
              </div>
              <p className="yt-helper">{tProfile("yt.helper")}</p>
            </div>
          </div>
        </section>

        {/* ============ BILLING (Pro only) ============ */}
        {tier === "pro" ? (
          <section
            className="settings-section"
            aria-labelledby="profile-sec-billing"
          >
            <header className="settings-head">
              <h2 id="profile-sec-billing">{tProfile("section_billing")}</h2>
              <p>{tProfile("section_billing_sub")}</p>
            </header>
            <div className="settings-body">
              <div className="billing-body">
                <div>
                  <NextLink href="/api/portal" className="btn btn--secondary">
                    {tProfile("billing.manage")}
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
                      <path d="M14 3h7v7" />
                      <path d="M21 3 10 14" />
                      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                    </svg>
                  </NextLink>
                </div>
                <p className="billing-help">{tProfile("billing.help")}</p>
              </div>
            </div>
          </section>
        ) : null}

        {/* ============ DANGER ZONE ============ */}
        <section
          className="settings-section danger-section"
          aria-labelledby="profile-sec-danger"
        >
          <header className="settings-head">
            <h2
              id="profile-sec-danger"
              style={{ color: "var(--color-feedback-danger)" }}
            >
              {tProfile("section_danger")}
            </h2>
            <p>{tProfile("section_danger_sub")}</p>
          </header>
          <div className="settings-body">
            <div className="danger-row">
              <div className="copy">
                <strong>{tProfile("danger.sign_out_title")}</strong>
                <span>{tProfile("danger.sign_out_sub")}</span>
              </div>
              <form action="/logout" method="POST" className="sign-out-form">
                <button type="submit" className="btn btn--destructive">
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
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="m16 17 5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                  {tProfile("danger.sign_out")}
                </button>
              </form>
            </div>

            <div className="danger-row">
              <div className="copy">
                <strong>{tProfile("danger.delete_title")}</strong>
                <span>
                  {tProfile("danger.delete_sub_prefix")}
                  <a
                    href="mailto:hello@tubemine.app"
                    style={{
                      color: "var(--color-text-primary)",
                      textDecoration: "underline",
                    }}
                  >
                    hello@tubemine.app
                  </a>
                  {tProfile("danger.delete_sub_suffix")}
                </span>
              </div>
              <span className="badge badge--secondary" style={{ height: 22 }}>
                {tProfile("danger.delete_email_badge")}
              </span>
            </div>
          </div>
        </section>
    </div>
  )
}

function buildInitials(email: string | undefined, fullName: unknown): string {
  const source = typeof fullName === "string" && fullName ? fullName : email ?? ""
  const parts = source.split(/\s|@/).filter(Boolean).slice(0, 2)
  if (parts.length === 0) return "U"
  return parts.map((s) => s[0]?.toUpperCase() ?? "").join("") || "U"
}

function daysSince(iso: string): number {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

/*
  The plan-cap copy is "5,000 comments per month" (Free) or "100,000 comments
  per month" (Pro). The full sentence comes from the translation, but the
  leading number is rendered separately so it can carry the .num class style.
  Strip the leading number token (ICU formats it as a localized number that
  may contain commas, spaces or non-breaking spaces) and return the
  remainder. We match the first contiguous run of [\d.,  \s] then
  drop the trailing whitespace.
*/
function planCapSuffix(formatted: string, _cap: number): string {
  void _cap
  return formatted.replace(/^[\d.,  \s]+/, "").trimStart()
}
