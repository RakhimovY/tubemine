import { getTranslations, setRequestLocale } from "next-intl/server"
import NextLink from "next/link"
import { Link, redirect } from "@/i18n/navigation"
import { createClient, getCachedUser } from "@/lib/supabase/server"
import {
  getUserQuota,
  FREE_MONTHLY_CAP,
  PRO_MONTHLY_CAP,
  type Tier,
} from "@/lib/quota"
import { formatNumber, formatDateRelative } from "@/lib/format"
import { listAnalyses } from "@/lib/analyses"
import {
  deriveDistribution,
  proSentimentDominant,
  qualitativeSummary,
  type SentimentDistribution,
} from "@/lib/sentiment-summary"
import { loadTrialState } from "@/components/trial-banner"
import { TubeMine } from "@/components/tubemine"
import { WelcomePulse } from "@/components/dashboard/welcome-pulse"

export const metadata = {
  title: "Dashboard - TubeMine",
  description: "Your TubeMine usage and subscription.",
}

export const dynamic = "force-dynamic"

/*
  TUB-1 Visual Port (Dashboard, Page 3 of 9). Verbatim semantic port of:
    /tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/TubeMine Dashboard.html
  Inline <style> CSS lives in src/app/globals.css scoped under
  `.tm-design .dashboard-page`.

  TUB-13 M23 update: the topbar + sidebar chrome is now rendered ONCE in
  the shared (app) route-group layout at src/app/[locale]/(app)/layout.tsx
  via <AppShell />. This page renders only its own content; the chrome
  stays mounted across /dashboard ↔ /profile ↔ /history navigation.

  Inline <script> behavior:
    - WelcomePulse: shown when ?welcome=true, auto-dismiss after 5s,
      strips the URL param on dismiss/timeout
    - <TubeMine /> (existing component): the Quick analyze form, preview,
      and full extract/results pipeline; reused unchanged from Landing
  The public <SiteHeader /> is suppressed for /dashboard by
  <SiteHeaderGate /> in src/app/[locale]/layout.tsx.
*/
export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ welcome?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const sp = await searchParams
  const showWelcome = sp?.welcome === "true"

  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) {
    redirect({ href: `/login?next=/${locale}/dashboard`, locale })
    return null
  }

  const [quota, recent, trial] = await Promise.all([
    getUserQuota(user.id),
    listAnalyses(supabase, null, 10),
    loadTrialState(user.id),
  ])

  const tier: Tier = quota.tier
  const percent = Math.min(100, Math.round((quota.used / quota.cap) * 100))
  const capped = quota.remaining <= 0
  const dateFmt = new Intl.DateTimeFormat(
    locale === "ru" ? "ru-RU" : "en-US",
    { month: "short", day: "numeric" },
  )
  const resetDateLabel = dateFmt.format(new Date(quota.resetAt))
  const trialEndsLabel = trial?.endsDate
    ? dateFmt.format(new Date(trial.endsDate))
    : ""
  const daysUntilReset = computeDaysUntil(quota.resetAt)

  const displayName =
    typeof user.user_metadata?.full_name === "string" &&
    user.user_metadata.full_name.length > 0
      ? `, ${user.user_metadata.full_name.split(/\s+/)[0]}`
      : ""

  const t = await getTranslations("dashboard")
  const tSent = await getTranslations("sentiment_label")
  const items = recent.items

  const lastAnalysisWhen = items[0]?.processed_at
    ? formatDateRelative(items[0].processed_at)
    : ""
  const welcomeMeta = lastAnalysisWhen
    ? t("welcome_meta_with_last", { when: lastAnalysisWhen })
    : t("welcome_meta_first")

  return (
    <div className="dashboard-page">
        {/* ===== Welcome strip ===== */}
        <header className="welcome-strip">
          <h1 className="welcome-title">
            {t("welcome_title", { name: displayName })}
          </h1>
          <span className="welcome-meta">{welcomeMeta}</span>
        </header>

        {/* ===== Trial countdown banner ===== */}
        {trial ? (
          <TrialBanner
            tier={tier}
            kind={trial.kind}
            canceled={trial.canceled}
            daysLeft={trial.kind === "active" ? trial.daysLeft : 0}
            endsDate={trialEndsLabel}
          />
        ) : null}

        {/* ===== Welcome pulse (only when ?welcome=true) ===== */}
        {showWelcome ? (
          <WelcomePulse
            title={t("welcome_pulse_title")}
            subtitle={t("welcome_pulse_sub")}
            dismissLabel={t("welcome_pulse_dismiss")}
          />
        ) : null}

        {/* ===== Usage card ===== */}
        {capped && tier === "free" ? (
          <UsageCardCapped
            cap={quota.cap}
            resetDate={resetDateLabel}
            metaLabel={t("usage_resets_label", { date: resetDateLabel })}
            heading={t("usage_heading")}
            label={t("usage_label")}
            capReachedMeta={t("usage_cap_reached_meta")}
            capError={t("usage_cap_error", {
              cap: formatNumber(quota.cap),
              pro: formatNumber(PRO_MONTHLY_CAP),
              days: daysUntilReset,
            })}
            quotaUsed={t("usage_cap_quota_used")}
            upgradeCta={t("upgrade_cta")}
            resetIn={t("usage_resets_in_days", { days: daysUntilReset })}
          />
        ) : (
          <UsageCardOk
            tier={tier}
            used={quota.used}
            cap={quota.cap}
            remaining={quota.remaining}
            percent={percent}
            metaLabel={t("usage_resets_label", { date: resetDateLabel })}
            heading={t("usage_heading")}
            label={t("usage_label")}
            usedBadge={t("usage_used_badge", { percent })}
            remainingLabel={t("usage_remaining", {
              count: formatNumber(quota.remaining),
            })}
            resetIn={t("usage_resets_in_days", { days: daysUntilReset })}
          />
        )}

        {/* ===== Quick analyze ===== */}
        <section
          className="card quick-analyze"
          aria-labelledby="dashboard-qa-h"
        >
          <div className="card-head">
            <h2 id="dashboard-qa-h">{t("quick_analyze_heading")}</h2>
            <span className="meta">{t("quick_analyze_sub")}</span>
          </div>
          <div className="tubemine-mount">
            <TubeMine tier={tier} />
          </div>
        </section>

        {/* ===== Recent analyses ===== */}
        {items.length > 0 ? (
          <section className="card" aria-labelledby="dashboard-recent-h">
            <div className="card-head">
              <h2 id="dashboard-recent-h">{t("recent_analyses_heading")}</h2>
              <Link
                href="/history"
                className="meta"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {t("recent_view_all_count", { count: items.length })}
              </Link>
            </div>

            <div className="recent-list">
              {items.map((item) => {
                const dist = deriveDistribution(item.sentiment)
                const sentClass = sentClassFor(dist)
                let sentLabel = ""
                if (dist) {
                  if (tier === "free") {
                    sentLabel = tSent(qualitativeSummary(dist))
                  } else {
                    const dom = proSentimentDominant(dist)
                    sentLabel = tSent(`pro_${dom.key}`, { pct: dom.pct })
                  }
                }
                return (
                  <Link
                    key={item.id}
                    href={`/history/${item.id}`}
                    className="recent-row-link"
                  >
                    <article className="recent-row">
                      {item.thumbnail_url ? (
                        <div className="recent-thumb">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.thumbnail_url} alt="" />
                        </div>
                      ) : (
                        <div
                          className="recent-thumb is-placeholder"
                          aria-hidden="true"
                        />
                      )}
                      <div className="recent-body">
                        <div className="recent-title">
                          {item.video_title ?? item.video_id}
                        </div>
                        <div className="recent-sub">
                          {t("recent_sub", {
                            channel: item.channel_name ?? "-",
                            when: formatDateRelative(item.processed_at),
                            count: item.comment_count,
                          })}
                        </div>
                      </div>
                      {sentLabel ? (
                        <span className={`recent-sent ${sentClass}`}>
                          <span className="dot" />
                          {sentLabel}
                        </span>
                      ) : null}
                    </article>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : (
          <section className="card" aria-labelledby="dashboard-recent-empty-h">
            <div className="card-head">
              <h2 id="dashboard-recent-empty-h">
                {t("recent_analyses_heading")}
              </h2>
              <span className="meta">{t("recent_zero_saved")}</span>
            </div>
            <div className="empty-state">
              <span className="empty-illus" aria-hidden="true">
                <svg
                  className="icon icon-lg"
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width={20}
                  height={20}
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
                  <path d="M8 10h8" />
                  <path d="M8 13h5" />
                </svg>
              </span>
              <h3>{t("empty_state_title")}</h3>
              <p>{t("empty_state_body")}</p>
              <a href="#dashboard-qa-h" className="btn btn--secondary">
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
                {t("empty_state_cta")}
              </a>
            </div>
          </section>
        )}

        {/* ===== Upgrade card (Free) or Manage subscription (Pro) ===== */}
        {tier === "free" ? (
          <section
            className="tier-card is-upgrade"
            aria-labelledby="dashboard-upg-h"
          >
            <div>
              <h2 id="dashboard-upg-h" className="title">
                {t("tier_upgrade_title")}
              </h2>
              <p className="sub">{t("tier_upgrade_sub")}</p>
            </div>
            <div className="cta-col">
              <Link href="/pricing" className="btn btn--ghost">
                {t("tier_upgrade_secondary_cta")}
              </Link>
              <form action="/api/checkout" method="POST">
                <button type="submit" className="btn btn--primary">
                  {t("upgrade_cta")}
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
                </button>
              </form>
            </div>
          </section>
        ) : (
          <section
            className="tier-card"
            aria-labelledby="dashboard-mgr-h"
          >
            <div>
              <h2 id="dashboard-mgr-h" className="title">
                {t("tier_manage_title")}
              </h2>
              <p className="sub">{t("tier_manage_sub")}</p>
            </div>
            <div className="cta-col">
              <Link href="/pricing" className="btn btn--ghost">
                {t("tier_manage_secondary_cta")}
              </Link>
              <NextLink href="/api/portal" className="btn btn--secondary">
                {t("tier_manage_primary_cta")}
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
              </NextLink>
            </div>
          </section>
        )}

        {/* Free-tier footer with implicit Pro upsell. Hidden for Pro users
            since the Monthly usage card + tier-card already show their cap;
            repeating it as small footer text is pure noise. */}
        {tier === "free" && (
          <p
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-family-mono)",
              margin: 0,
            }}
          >
            {`Free: ${formatNumber(FREE_MONTHLY_CAP)} / month · Pro: ${formatNumber(PRO_MONTHLY_CAP)} / month`}
          </p>
        )}
    </div>
  )
}

// Compute days until reset. Extracted so the impure Date.now() call lives
// outside of the React component body (the no-impure-functions lint rule
// flags it inside the render path, even though this is a server component).
function computeDaysUntil(iso: string): number {
  const target = Date.parse(iso)
  if (Number.isNaN(target)) return 0
  // Server-side rendering: Date.now() is the authoritative wall clock.
  const now = Date.now()
  return Math.max(0, Math.ceil((target - now) / 86_400_000))
}

function sentClassFor(dist: SentimentDistribution | null): "pos" | "neu" | "neg" {
  if (!dist) return "neu"
  const { positive: p, negative: n, neutral: u } = dist
  if (u > p && u > n) return "neu"
  if (p >= n) return "pos"
  return "neg"
}

function UsageCardOk({
  tier,
  used,
  cap,
  remaining,
  percent,
  heading,
  metaLabel,
  label,
  usedBadge,
  remainingLabel,
  resetIn,
}: {
  tier: Tier
  used: number
  cap: number
  remaining: number
  percent: number
  heading: string
  metaLabel: string
  label: string
  usedBadge: string
  remainingLabel: string
  resetIn: string
}) {
  void remaining
  return (
    <section className="card usage-card" aria-labelledby="dashboard-usage-h">
      <div className="card-head">
        <h2 id="dashboard-usage-h">{heading}</h2>
        <span className="meta">{metaLabel}</span>
      </div>
      <div className="usage-headline">
        <div>
          <div className="usage-num">
            <span className="val">{formatNumber(used)}</span>{" "}
            <span className="of">/ {formatNumber(cap)}</span>
          </div>
          <div className="usage-label">{label}</div>
        </div>
        <span className="badge badge--secondary">{usedBadge}</span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="usage-foot">
        <span>{remainingLabel}</span>
        <span>{resetIn}</span>
      </div>
      {/* tier kept for future per-tier copy variants */}
      <span className="sr-only">{tier}</span>
    </section>
  )
}

function UsageCardCapped({
  cap,
  resetDate,
  heading,
  metaLabel,
  label,
  capReachedMeta,
  capError,
  quotaUsed,
  upgradeCta,
  resetIn,
}: {
  cap: number
  resetDate: string
  heading: string
  metaLabel: string
  label: string
  capReachedMeta: string
  capError: string
  quotaUsed: string
  upgradeCta: string
  resetIn: string
}) {
  void metaLabel
  return (
    <section
      className="card usage-card is-capped"
      aria-labelledby="dashboard-usage-cap-h"
    >
      <div className="card-head">
        <h2 id="dashboard-usage-cap-h">{heading}</h2>
        <span className="meta" style={{ color: "var(--color-feedback-danger)" }}>
          {capReachedMeta}
        </span>
      </div>
      <div className="usage-headline">
        <div>
          <div className="usage-num">
            <span
              className="val"
              style={{ color: "var(--color-feedback-danger)" }}
            >
              {formatNumber(cap)}
            </span>{" "}
            <span className="of">/ {formatNumber(cap)}</span>
          </div>
          <div className="usage-label">{label}</div>
        </div>
        <span
          className="badge"
          style={{
            background: "var(--color-feedback-danger-soft)",
            color: "var(--color-feedback-danger)",
          }}
        >
          100% used
        </span>
      </div>
      <div
        className="progress progress--destructive"
        role="progressbar"
        aria-valuenow={100}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-track">
          <div className="progress-fill" style={{ width: "100%" }} />
        </div>
      </div>
      <div className="usage-error">
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
          <circle cx={12} cy={12} r={9} />
          <path d="M12 8v5" />
          <path d="M12 16h.01" />
        </svg>
        {capError}
      </div>
      <div className="usage-foot">
        <span>0</span>
        <span>{resetIn || resetDate}</span>
      </div>
      <div className="cap-upgrade-row">
        <span className="copy">{quotaUsed}</span>
        <form action="/api/checkout" method="POST">
          <button type="submit" className="btn btn--destructive btn-sm">
            {upgradeCta}
          </button>
        </form>
      </div>
    </section>
  )
}

function TrialBanner({
  kind,
  canceled,
  daysLeft,
  endsDate,
}: {
  tier: Tier
  kind: "active" | "today"
  canceled: boolean
  daysLeft: number
  endsDate: string
}) {
  // Inline static-text trial banner styled to design. Copy uses ASCII commas
  // and dots only (no em-dash). We do NOT use next-intl plural here because
  // the design's verbatim copy keeps a simple plain English sentence.
  let text: string
  if (kind === "today") {
    text = canceled
      ? `Trial ends today, ${endsDate}.`
      : "Trial ends today, then $19/mo."
  } else if (canceled) {
    text = `Trial: ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left, ends ${endsDate}.`
  } else {
    text = `Trial: ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left, then $19/mo.`
  }
  const sub = canceled
    ? "Pro features active until period end."
    : "Pro features active. Cancel anytime via customer portal."
  return (
    <div className="trial-banner" role="status" aria-live="polite">
      <div className="trial-copy">
        <span className="trial-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx={12} cy={12} r={9} />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        <div className="trial-text">
          <strong>{text}</strong>
          <span>{sub}</span>
        </div>
      </div>
      <div className="trial-action">
        <NextLink href="/api/portal" className="btn btn--secondary btn-sm">
          Manage subscription
        </NextLink>
      </div>
    </div>
  )
}
