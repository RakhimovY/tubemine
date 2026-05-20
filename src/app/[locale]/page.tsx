import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link as IntlLink } from "@/i18n/navigation"
import { TubeMine, type ExtractTier } from "@/components/tubemine"
import { createClient } from "@/lib/supabase/server"
import { getUserQuota } from "@/lib/quota"
import { LandingFaq } from "@/components/landing-faq"
import { LandingSmoothScroll } from "@/components/landing-smooth-scroll"

const REPO_URL = "https://github.com/RakhimovY/tubemine"
const SUPPORT_EMAIL = "hello@tubemine.app"

export const dynamic = "force-dynamic"

type HomeAuthState = { tier: ExtractTier; isAnonymous: boolean }

async function resolveHomeAuthState(): Promise<HomeAuthState> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { tier: "anonymous", isAnonymous: true }
  }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { tier: "anonymous", isAnonymous: true }
    const quota = await getUserQuota(user.id)
    return { tier: quota.tier, isAnonymous: false }
  } catch {
    return { tier: "anonymous", isAnonymous: true }
  }
}

/*
  TUB-1 Visual Port (Landing, Page 1 of 9).
  This file is the verbatim semantic port of:
    /tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/TubeMine Landing.html
  Inline <style> CSS lives in src/app/globals.css scoped under .tm-design.
  Inline <script> behavior lives in small client islands:
    - LandingSmoothScroll: in-page anchor scroll with header offset
    - LandingFaq: accordion (one open, first by default)
    - SiteHeaderClient: sticky-nav scroll state, mobile drawer, locale dropdown
  The "Design preview" panel from the prototype is intentionally NOT shipped
  (README: do not ship the design preview panel to production).
  Live demo block mounts the real <TubeMine /> extractor; the design's
  sample/promo result is shown above it as a static educational preview.
*/
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const { tier, isAnonymous } = await resolveHomeAuthState()
  const t = await getTranslations("landing")

  const faqItems = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    {
      q: t("faq.q4"),
      a: (
        <>
          {t("faq.a4_prefix")}{" "}
          <IntlLink
            href="/terms"
            style={{
              color: "var(--color-text-primary)",
              textDecoration: "underline",
            }}
          >
            {t("faq.a4_link_terms")}
          </IntlLink>
          {t("faq.a4_suffix")}
        </>
      ),
    },
    { q: t("faq.q5"), a: t("faq.a5") },
    { q: t("faq.q6"), a: t("faq.a6") },
    {
      q: t("faq.q7"),
      a: (
        <>
          {t("faq.a7_prefix")}{" "}
          <IntlLink
            href="/privacy"
            style={{
              color: "var(--color-text-primary)",
              textDecoration: "underline",
            }}
          >
            {t("faq.a7_link_privacy")}
          </IntlLink>
          {t("faq.a7_suffix")}
        </>
      ),
    },
  ]

  return (
    <>
      <LandingSmoothScroll />
      <main>
        {/* ===================== HERO ===================== */}
        <section className="hero">
          <div className="container">
            <p className="hero-eyebrow">{t("hero.eyebrow")}</p>
            <h1 className="hero-title">
              {t("hero.title_lead")}{" "}
              <span className="accent">{t("hero.title_accent")}</span>
            </h1>
            <p className="hero-sub">{t("hero.sub")}</p>
            <div className="hero-cta">
              <a href="#demo" className="btn btn--primary btn-lg">
                {t("hero.cta_primary")}
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
                  <path d="M12 5v14" />
                  <path d="m6 13 6 6 6-6" />
                </svg>
              </a>
              <a href="#pricing" className="btn btn--ghost btn-lg">
                {t("hero.cta_secondary")}
              </a>
            </div>
          </div>
        </section>

        {/* ===================== TRUST ROW ===================== */}
        <section className="trust" aria-label={t("trust.aria")}>
          <div className="container trust-row">
            <span className="trust-tag">
              <span className="dot" />
              {t("trust.api")}
            </span>
            <span className="trust-sep">·</span>
            <span className="trust-tag">{t("trust.free_monthly")}</span>
            <span className="trust-sep">·</span>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="trust-tag"
              style={{ color: "inherit" }}
            >
              <GithubIcon />
              <span>{t("trust.oss")}</span>
            </a>
          </div>
        </section>

        {/* ===================== LIVE DEMO ===================== */}
        <section className="section" id="demo">
          <div className="container">
            <header className="section-head-center">
              <p className="section-eyebrow">{t("demo.eyebrow")}</p>
              <h2 className="section-title">{t("demo.title")}</h2>
              <p className="section-sub">{t("demo.sub")}</p>
            </header>

            <div className="demo-wrap">
              {/*
                The real extractor lives here. It owns the URL input, the
                Analyze submit, validation, and the actual analysis results.
                Wrapped in .tm-extractor-host so it sits inside the design's
                surface-raised card aesthetic.
              */}
              <div className="tm-extractor-host">
                <TubeMine tier={tier} />
              </div>

              {isAnonymous ? (
                <p
                  className="demo-quota"
                  style={{ marginTop: "var(--space-5)" }}
                >
                  <span>{t("demo.quota_anon")}</span>
                </p>
              ) : null}

              {isAnonymous ? (
                <div
                  className="demo-sample-strip"
                  role="note"
                  style={{ marginTop: "var(--space-7)" }}
                >
                  <span className="sample-primary">
                    <span className="sample-icon" aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 8h.01" />
                        <path d="M11 12h1v4h1" />
                      </svg>
                    </span>
                    <span>
                      <b>{t("demo.sample_label_strong")}</b>{" "}
                      {t("demo.sample_label_text")}
                    </span>
                  </span>
                  <span className="sample-meta">{t("demo.sample_meta")}</span>
                </div>
              ) : null}

              {isAnonymous ? (
                <DemoSampleResult
                  videoTitle={t("demo.sample.title")}
                  videoChannel={t("demo.sample.channel")}
                  videoDuration={t("demo.sample.duration")}
                  videoStatsAnalyzed={t("demo.sample.stats_analyzed")}
                  videoStatsViews={t("demo.sample.stats_views")}
                  videoStatsLikes={t("demo.sample.stats_likes")}
                  videoStatsLang={t("demo.sample.stats_lang")}
                  sentimentLabel={t("demo.sample.sentiment_label")}
                  sentimentTitle={t("demo.sample.sentiment_title")}
                  sentimentSub={t("demo.sample.sentiment_sub")}
                  sentimentAnalyzed={t("demo.sample.sentiment_analyzed")}
                  sentimentPos={t("demo.sample.legend_pos")}
                  sentimentNeu={t("demo.sample.legend_neu")}
                  sentimentNeg={t("demo.sample.legend_neg")}
                  sentimentFoot={t("demo.sample.sentiment_foot")}
                  topWordsTitle={t("demo.sample.top_words_title")}
                  topWordsSub={t("demo.sample.top_words_sub")}
                  emojiTitle={t("demo.sample.emoji_title")}
                  emojiSub={t("demo.sample.emoji_sub")}
                  commentsTitle={t("demo.sample.comments_title")}
                  commentsSub={t("demo.sample.comments_sub")}
                  commentsFoot={t("demo.sample.comments_foot")}
                  commentsFootCta={t("demo.sample.comments_foot_cta")}
                  posLabel={t("demo.sample.sent_pos")}
                  neuLabel={t("demo.sample.sent_neu")}
                  negLabel={t("demo.sample.sent_neg")}
                />
              ) : null}
            </div>
          </div>
        </section>

        {/* ===================== TRUST ACCELERANT ===================== */}
        <section
          className="section trust-accelerant"
          id="dashboard-preview"
        >
          <div className="container">
            <div className="ta-grid">
              <div className="ta-copy">
                <p className="section-eyebrow">{t("dashboard.eyebrow")}</p>
                <h2 className="title">{t("dashboard.title")}</h2>
                <p className="lede">{t("dashboard.lede")}</p>
                <ul className="ta-list">
                  {[
                    t("dashboard.b1"),
                    t("dashboard.b2"),
                    t("dashboard.b3"),
                    t("dashboard.b4"),
                  ].map((b, i) => (
                    <li key={i}>
                      <span className="ta-check">
                        <CheckIcon />
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="row-inline">
                  <IntlLink
                    href={isAnonymous ? "/login?intent=signup" : "/dashboard"}
                    className="btn btn--primary"
                  >
                    {isAnonymous
                      ? t("dashboard.cta_signup")
                      : t("dashboard.cta_dashboard")}
                  </IntlLink>
                  <a href="#pricing" className="btn btn--ghost">
                    {t("dashboard.cta_pricing")}
                  </a>
                </div>
              </div>

              <DashboardMock
                brand={t("header.brand")}
                section={t("dashboard.mock.section")}
                userTier={t("dashboard.mock.user_tier")}
                quotaTitle={t("dashboard.mock.quota_title")}
                quotaPct={t("dashboard.mock.quota_pct")}
                quotaReset={t("dashboard.mock.quota_reset")}
                recentTitle={t("dashboard.mock.recent_title")}
                recentAction={t("dashboard.mock.recent_action")}
                upgradeTitle={t("dashboard.mock.upgrade_title")}
                upgradeSub={t("dashboard.mock.upgrade_sub")}
                upgradePrice={t("dashboard.mock.upgrade_price")}
                items={[
                  {
                    title: t("dashboard.mock.row1_title"),
                    sub: t("dashboard.mock.row1_sub"),
                    sent: t("dashboard.mock.row1_sent"),
                  },
                  {
                    title: t("dashboard.mock.row2_title"),
                    sub: t("dashboard.mock.row2_sub"),
                    sent: t("dashboard.mock.row2_sent"),
                  },
                  {
                    title: t("dashboard.mock.row3_title"),
                    sub: t("dashboard.mock.row3_sub"),
                    sent: t("dashboard.mock.row3_sent"),
                  },
                  {
                    title: t("dashboard.mock.row4_title"),
                    sub: t("dashboard.mock.row4_sub"),
                    sent: t("dashboard.mock.row4_sent"),
                    mixed: true,
                  },
                ]}
              />
            </div>
          </div>
        </section>

        {/* ===================== FEATURE BLOCKS ===================== */}
        <section
          className="section"
          id="features"
          style={{ paddingTop: 0 }}
        >
          <div className="container">
            {/* 1, Sentiment */}
            <div className="feature-block">
              <div className="feature-copy">
                <p className="feature-eyebrow">
                  {t("features.sentiment.eyebrow")}
                </p>
                <h3 className="feature-title">
                  {t("features.sentiment.title")}
                </h3>
                <p className="feature-body">
                  {t("features.sentiment.body")}
                </p>
              </div>
              <div className="feature-visual">
                <div className="widget-head">
                  <span className="widget-title">
                    {t("features.sentiment.widget_title")}
                  </span>
                  <span className="sentiment-tag">
                    {t("features.sentiment.widget_tag")}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-tertiary)",
                    fontFamily: "var(--font-family-mono)",
                    marginBottom: 4,
                  }}
                >
                  {t("features.sentiment.analyzed_count")}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    color: "var(--color-text-primary)",
                    fontWeight: 500,
                    letterSpacing: "-0.005em",
                    marginBottom: "var(--space-5)",
                  }}
                >
                  {t("features.sentiment.summary")}
                </div>
                <div
                  className="sentiment-bar"
                  aria-label={t("features.sentiment.bar_aria")}
                >
                  <span className="sentiment-pos" style={{ width: "68%" }} />
                  <span className="sentiment-neu" style={{ width: "24%" }} />
                  <span className="sentiment-neg" style={{ width: "8%" }} />
                </div>
                <div className="sentiment-legend">
                  <span>
                    <span className="legend-dot legend-pos" />
                    {t("features.sentiment.legend_pos")}
                  </span>
                  <span>
                    <span className="legend-dot legend-neu" />
                    {t("features.sentiment.legend_neu")}
                  </span>
                  <span>
                    <span className="legend-dot legend-neg" />
                    {t("features.sentiment.legend_neg")}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-tertiary)",
                    lineHeight: 1.5,
                    margin: "var(--space-5) 0 0",
                    paddingTop: "var(--space-5)",
                    borderTop: "1px solid var(--color-border-subtle)",
                  }}
                >
                  {t("features.sentiment.foot")}
                </p>
              </div>
            </div>

            {/* 2, Top words */}
            <div className="feature-block reverse">
              <div className="feature-copy">
                <p className="feature-eyebrow">{t("features.words.eyebrow")}</p>
                <h3 className="feature-title">{t("features.words.title")}</h3>
                <p className="feature-body">{t("features.words.body")}</p>
              </div>
              <div className="feature-visual">
                <div className="widget-head">
                  <span className="widget-title">
                    {t("features.words.widget_title")}
                  </span>
                  <span className="widget-sub">
                    {t("features.words.widget_sub")}
                  </span>
                </div>
                <div className="tw-list">
                  {[
                    { w: "tutorial", pct: 100, n: "847" },
                    { w: "love", pct: 78, n: "662" },
                    { w: "workflow", pct: 64, n: "543" },
                    { w: "helpful", pct: 53, n: "449" },
                    { w: "thanks", pct: 47, n: "398" },
                    { w: "editing", pct: 43, n: "364" },
                    { w: "camera", pct: 36, n: "307" },
                    { w: "amazing", pct: 31, n: "261" },
                  ].map((row) => (
                    <div key={row.w} className="tw-row">
                      <span className="tw-word">{row.w}</span>
                      <span className="tw-bar">
                        <span style={{ width: `${row.pct}%` }} />
                      </span>
                      <span className="tw-count">{row.n}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3, Emoji */}
            <div className="feature-block">
              <div className="feature-copy">
                <p className="feature-eyebrow">{t("features.emoji.eyebrow")}</p>
                <h3 className="feature-title">{t("features.emoji.title")}</h3>
                <p className="feature-body">{t("features.emoji.body")}</p>
              </div>
              <div className="feature-visual">
                <div className="widget-head">
                  <span className="widget-title">
                    {t("features.emoji.widget_title")}
                  </span>
                  <span className="widget-sub">
                    {t("features.emoji.widget_sub")}
                  </span>
                </div>
                <div className="emoji-grid">
                  {[
                    { g: "🔥", pct: 100, p: "18.2%" },
                    { g: "❤️", pct: 81, p: "14.7%" },
                    { g: "👏", pct: 62, p: "11.3%" },
                    { g: "💯", pct: 53, p: "9.6%" },
                    { g: "😍", pct: 46, p: "8.4%" },
                    { g: "🙏", pct: 40, p: "7.2%" },
                    { g: "👍", pct: 37, p: "6.8%" },
                    { g: "😂", pct: 32, p: "5.9%" },
                    { g: "⚡", pct: 25, p: "4.5%" },
                    { g: "💪", pct: 17, p: "3.1%" },
                  ].map((row, i) => (
                    <div key={i} className="emoji-row">
                      <span className="glyph">{row.g}</span>
                      <span className="pct-bar">
                        <span style={{ width: `${row.pct}%` }} />
                      </span>
                      <span className="pct">{row.p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== PRICING ===================== */}
        <section
          className="section"
          id="pricing"
          style={{ borderTop: "1px solid var(--color-border-subtle)" }}
        >
          <div className="container">
            <header className="section-head-center">
              <p className="section-eyebrow">{t("pricing.eyebrow")}</p>
              <h2 className="section-title">{t("pricing.title")}</h2>
              <p className="section-sub">{t("pricing.sub")}</p>
            </header>

            <div className="pricing-grid">
              {/* Free */}
              <div className="card price-card">
                <div className="price-head">
                  <span className="price-name">{t("pricing.free.name")}</span>
                  <span className="badge badge--outline">
                    {t("pricing.free.badge")}
                  </span>
                </div>
                <div className="price-num">
                  {t("pricing.free.price")}
                  <span className="unit">{t("pricing.free.unit")}</span>
                </div>
                <p className="price-tagline">{t("pricing.free.tagline")}</p>
                <ul className="price-list">
                  {[
                    t("pricing.free.b1"),
                    t("pricing.free.b2"),
                    t("pricing.free.b3"),
                    t("pricing.free.b4"),
                    t("pricing.free.b5"),
                  ].map((b, i) => (
                    <li key={i}>
                      <span className="ta-check">
                        <CheckIcon />
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <IntlLink
                  href="/login?intent=signup"
                  className="btn btn--primary"
                  style={{ width: "100%" }}
                >
                  <GoogleIcon />
                  {t("pricing.free.cta")}
                </IntlLink>
              </div>

              {/* Pro */}
              <div className="card card--highlighted price-card">
                <div className="price-head">
                  <span className="price-name">{t("pricing.pro.name")}</span>
                  <span className="badge badge--default">
                    <span className="badge-dot" />
                    {t("pricing.pro.badge")}
                  </span>
                </div>
                <div className="price-num">
                  {t("pricing.pro.price")}
                  <span className="unit">{t("pricing.pro.unit")}</span>
                </div>
                <p className="price-tagline">{t("pricing.pro.tagline")}</p>
                <ul className="price-list">
                  {[
                    t("pricing.pro.b1"),
                    t("pricing.pro.b2"),
                    t("pricing.pro.b3"),
                    t("pricing.pro.b4"),
                    t("pricing.pro.b5"),
                  ].map((b, i) => (
                    <li key={i}>
                      <span className="ta-check">
                        <CheckIcon />
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <IntlLink
                  href="/login?intent=signup&plan=pro"
                  className="btn btn--primary"
                  style={{ width: "100%" }}
                >
                  {t("pricing.pro.cta")}
                </IntlLink>
                <p
                  style={{
                    fontFamily: "var(--font-family-mono)",
                    fontSize: 11,
                    color: "var(--color-text-tertiary)",
                    textAlign: "center",
                    margin: "var(--space-4) 0 0",
                  }}
                >
                  {t("pricing.pro.foot")}
                </p>
              </div>
            </div>

            <p
              style={{
                textAlign: "center",
                marginTop: "var(--space-7)",
                color: "var(--color-text-tertiary)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <IntlLink
                href="/pricing"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {t("pricing.see_full")}
              </IntlLink>
            </p>
          </div>
        </section>

        {/* ===================== FAQ ===================== */}
        <section
          className="section"
          id="faq"
          style={{
            borderTop: "1px solid var(--color-border-subtle)",
            paddingTop: "clamp(56px, 8vw, 96px)",
          }}
        >
          <div className="container">
            <header className="section-head-center">
              <p className="section-eyebrow">{t("faq.eyebrow")}</p>
              <h2 className="section-title">{t("faq.title")}</h2>
            </header>

            <LandingFaq items={faqItems} />

            <p
              style={{
                textAlign: "center",
                marginTop: "var(--space-7)",
                color: "var(--color-text-tertiary)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              {t("faq.contact_prefix")}{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                style={{ color: "var(--color-text-secondary)" }}
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        </section>

        {/* ===================== FINAL CTA ===================== */}
        <section className="final-cta">
          <div className="container">
            <h2 className="section-title">{t("final_cta.title")}</h2>
            <p
              className="section-sub"
              style={{
                margin: "0 auto var(--space-8)",
                maxWidth: "52ch",
              }}
            >
              {t("final_cta.sub")}
            </p>
            <a href="#demo" className="btn btn--primary btn-lg">
              {t("final_cta.cta")}
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
            </a>
          </div>
        </section>
      </main>

      {/* ===================== FOOTER ===================== */}
      <LandingFooter t={t} />
    </>
  )
}

function LandingFooter({
  t,
}: {
  t: Awaited<ReturnType<typeof getTranslations<"landing">>>
}) {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <IntlLink href="/" className="nav-brand">
              <span className="brand-mark" />
              <span>{t("header.brand")}</span>
            </IntlLink>
            <p>{t("footer.tagline")}</p>
          </div>
          <div className="footer-col">
            <h4>{t("footer.col_product")}</h4>
            <ul>
              <li>
                <a href="#features">{t("header.nav_features")}</a>
              </li>
              <li>
                <IntlLink href="/pricing">{t("header.nav_pricing")}</IntlLink>
              </li>
              <li>
                <IntlLink href="/dashboard">
                  {t("header.cta_dashboard")}
                </IntlLink>
              </li>
              <li>
                <IntlLink href="/changelog">
                  {t("header.nav_changelog")}
                </IntlLink>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>{t("footer.col_resources")}</h4>
            <ul>
              <li>
                <IntlLink href="/docs">{t("header.nav_docs")}</IntlLink>
              </li>
              <li>
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>{t("footer.col_legal")}</h4>
            <ul>
              <li>
                <IntlLink href="/privacy">{t("footer.privacy")}</IntlLink>
              </li>
              <li>
                <IntlLink href="/terms">{t("footer.terms")}</IntlLink>
              </li>
              <li>
                <a
                  href={`${REPO_URL}/blob/main/LICENSE`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("footer.license")}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <nav className="footer-social" aria-label={t("footer.social_aria")}>
          {SOCIALS.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
            >
              {s.icon}
            </a>
          ))}
        </nav>
        <div className="footer-bar">
          <span>{t("footer.copyright")}</span>
          <span>{t("footer.version")}</span>
        </div>
      </div>
    </footer>
  )
}

const SOCIALS: Array<{ label: string; url: string; icon: React.ReactNode }> = [
  {
    label: "GitHub",
    url: "https://github.com/RakhimovY/tubemine",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
  },
  {
    label: "X",
    url: "https://x.com/yerkeRakhimov",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    url: "https://www.linkedin.com/in/rakhimov-yerkebulan/",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: "dev.to",
    url: "https://dev.to/yerkerakhimov",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7.42 10.05c-.18-.16-.46-.23-.84-.23H6v4.46h.66c.42 0 .77-.08.94-.24.21-.21.22-.39.22-2.05 0-1.68-.04-1.78-.4-2zM0 4.94v14.12h24V4.94H0zM8.56 15.3c-.44.58-1.06.77-2.53.77H4.71V8.53h1.4c1.67 0 2.16.18 2.6.9.27.43.29.6.32 2.57.05 2.23-.02 2.73-.47 3.3zm5.09-5.47h-2.47v1.77h1.52v1.28l-.72.04-.75.03v1.77l1.22.03 1.2.04v1.28h-1.6c-1.53 0-1.6-.01-1.87-.3l-.3-.28v-3.16c0-3.02.01-3.18.25-3.48.23-.31.25-.31 1.88-.31h1.64v1.3zm4.68 5.45c-.17.43-.64.79-1 .79-.18 0-.45-.15-.67-.39-.32-.32-.45-.63-.82-2.08l-.9-3.39-.45-1.67h.76c.4 0 .75.02.75.05 0 .06 1.16 4.54 1.26 4.83.04.15.32-.7.73-2.3l.66-2.52.74-.04c.4-.02.73 0 .73.04 0 .14-1.67 6.38-1.8 6.68z" />
      </svg>
    ),
  },
  {
    label: "Threads",
    url: "https://www.threads.com/@ai.yerke_",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.444 1.5 15.59 1.472 12.01v-.022C1.5 8.41 2.35 5.557 3.995 3.508 5.844 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.985-8.304-6.015-2.91.022-5.11.937-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.78 3.631 2.696 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.103-2.14 1.704-3.73 1.79-1.202.065-2.36-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.74-1.755-.513-.586-1.302-.883-2.346-.89h-.034c-.835 0-1.96.227-2.676 1.298L7.354 7.795c.957-1.435 2.512-2.225 4.378-2.225h.05c3.108.02 4.963 1.93 5.247 5.27.165.07.328.142.488.217 2.234 1.05 3.874 2.64 4.713 4.526 1.18 2.625 1.298 6.926-2.215 10.342-2.683 2.61-5.964 3.71-9.62 3.736zm.952-13.965q-.448 0-.928.026c-1.789.101-2.904.929-2.84 2.107.052.825.952 1.484 2.107 1.42 1.062-.061 2.453-.475 2.69-3.396a8.55 8.55 0 0 0-1.03-.157z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    url: "https://www.instagram.com/ai.yerke_/",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.849.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.849.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
      </svg>
    ),
  },
  {
    label: "Telegram",
    url: "https://t.me/ai_yerke",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    label: "Reddit",
    url: "https://www.reddit.com/user/ErkeshaA/",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.04 1.605a3.32 3.32 0 0 1 .046.568c0 2.892-3.36 5.244-7.494 5.244-4.135 0-7.493-2.352-7.493-5.244 0-.193.015-.383.043-.57-.602-.273-1.034-.89-1.034-1.604 0-.967.785-1.752 1.752-1.752.478 0 .91.18 1.217.487 1.205-.86 2.878-1.424 4.715-1.486l.911-4.298a.32.32 0 0 1 .382-.252l2.987.63a1.249 1.249 0 0 1 1.107-.679zM9.794 10.872c-.875 0-1.557.737-1.557 1.604s.683 1.604 1.558 1.604 1.557-.737 1.557-1.604-.683-1.604-1.557-1.604zm4.392 0c-.875 0-1.557.737-1.557 1.604s.683 1.604 1.557 1.604 1.558-.737 1.558-1.604-.683-1.604-1.557-1.604zm-4.286 2.952a.51.51 0 0 0-.518.518c0 .284.231.515.518.515.282 0 .515-.231.515-.515 0-.287-.232-.518-.515-.518zm4.182 0a.51.51 0 0 0-.518.518c0 .284.231.515.518.515.282 0 .515-.231.515-.515 0-.287-.232-.518-.515-.518zm-4.495 2.27c.36 1.116 1.405 1.929 2.61 1.929 1.207 0 2.25-.813 2.61-1.929.058-.18-.082-.296-.18-.198-.567.567-1.451.755-2.43.755-.978 0-1.86-.188-2.43-.755-.097-.098-.237.018-.18.198z" />
      </svg>
    ),
  },
]

/* =====================================================================
   Dashboard mock (visual only): direct port of the design's
   .dashboard-mock block in the trust-accelerant section.
   ===================================================================== */
function DashboardMock({
  brand,
  section,
  userTier,
  quotaTitle,
  quotaPct,
  quotaReset,
  recentTitle,
  recentAction,
  upgradeTitle,
  upgradeSub,
  upgradePrice,
  items,
}: {
  brand: string
  section: string
  userTier: string
  quotaTitle: string
  quotaPct: string
  quotaReset: string
  recentTitle: string
  recentAction: string
  upgradeTitle: string
  upgradeSub: string
  upgradePrice: string
  items: Array<{ title: string; sub: string; sent: string; mixed?: boolean }>
}) {
  return (
    <div className="dashboard-mock" aria-hidden="true">
      <div className="dm-topbar">
        <div className="dm-brand">
          <span className="brand-mark" />
          <span>{brand}</span>
          <span
            style={{
              color: "var(--color-text-tertiary)",
              fontSize: 11,
              marginLeft: 6,
            }}
          >
            {section}
          </span>
        </div>
        <div className="dm-user">
          <span
            className="badge badge--secondary"
            style={{ height: 20, padding: "0 8px", fontSize: 11 }}
          >
            {userTier}
          </span>
          <span className="dm-avatar">AR</span>
        </div>
      </div>

      <div className="dm-body">
        <div className="dm-quota">
          <div className="dm-quota-head">
            <span className="dm-quota-title">{quotaTitle}</span>
            <span className="dm-quota-num">3,062 / 5,000</span>
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-valuenow={61}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="progress-track">
              <div className="progress-fill" style={{ width: "61%" }} />
            </div>
          </div>
          <div className="dm-quota-foot">
            <span>{quotaPct}</span>
            <span>{quotaReset}</span>
          </div>
        </div>

        <div>
          <div className="dm-section-head">
            <span className="dm-section-title">{recentTitle}</span>
            <span className="dm-section-action">{recentAction}</span>
          </div>
          <div className="dm-list">
            {items.map((row, i) => (
              <div key={i} className="dm-row">
                <span className="mini-thumb" />
                <div className="dm-row-meta">
                  <div className="dm-row-title">{row.title}</div>
                  <div className="dm-row-sub">{row.sub}</div>
                </div>
                <span className="dm-row-sent">
                  <span
                    className="dot"
                    style={{
                      background: row.mixed
                        ? "var(--color-sentiment-neutral)"
                        : "var(--color-accent-positive)",
                    }}
                  />
                  {row.sent}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="dm-upgrade">
          <div className="dm-upgrade-row">
            <div className="dm-upgrade-text">
              <div className="dm-upgrade-title">{upgradeTitle}</div>
              <div className="dm-upgrade-sub">{upgradeSub}</div>
            </div>
            <span className="dm-upgrade-cta">{upgradePrice}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* =====================================================================
   Sample/promo result block, shown above the real extractor for
   anonymous visitors as an educational static preview. Direct port of
   the design's #demoResult promo card.
   ===================================================================== */
function DemoSampleResult(props: {
  videoTitle: string
  videoChannel: string
  videoDuration: string
  videoStatsAnalyzed: string
  videoStatsViews: string
  videoStatsLikes: string
  videoStatsLang: string
  sentimentLabel: string
  sentimentTitle: string
  sentimentSub: string
  sentimentAnalyzed: string
  sentimentPos: string
  sentimentNeu: string
  sentimentNeg: string
  sentimentFoot: string
  topWordsTitle: string
  topWordsSub: string
  emojiTitle: string
  emojiSub: string
  commentsTitle: string
  commentsSub: string
  commentsFoot: string
  commentsFootCta: string
  posLabel: string
  neuLabel: string
  negLabel: string
}) {
  return (
    <div
      className="demo-result"
      style={{ marginTop: "var(--space-7)" }}
      aria-live="polite"
    >
      <div className="demo-result-head">
        <div className="thumb" aria-hidden="true">
          <span className="thumb-duration">{props.videoDuration}</span>
        </div>
        <div>
          <h3 className="demo-meta-title">{props.videoTitle}</h3>
          <div className="demo-meta-channel">{props.videoChannel}</div>
          <div className="demo-meta-stats">
            <span>
              <strong>19,422</strong> {props.videoStatsAnalyzed}
            </span>
            <span>
              <strong>847K</strong> {props.videoStatsViews}
            </span>
            <span>
              <strong>32K</strong> {props.videoStatsLikes}
            </span>
            <span>{props.videoStatsLang}</span>
          </div>
        </div>
      </div>

      <div className="widget-grid">
        <div className="widget">
          <div className="widget-head">
            <span className="widget-title">{props.sentimentTitle}</span>
            <span className="widget-sub">{props.sentimentSub}</span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-family-mono)",
              marginBottom: 4,
            }}
          >
            {props.sentimentAnalyzed}
          </div>
          <div
            style={{
              fontSize: 16,
              color: "var(--color-text-primary)",
              fontWeight: 500,
              letterSpacing: "-0.005em",
              marginBottom: "var(--space-4)",
            }}
          >
            {props.sentimentLabel}
          </div>
          <div className="sentiment-bar" role="img" aria-label="">
            <span className="sentiment-pos" style={{ width: "68%" }} />
            <span className="sentiment-neu" style={{ width: "24%" }} />
            <span className="sentiment-neg" style={{ width: "8%" }} />
          </div>
          <div className="sentiment-legend">
            <span>
              <span className="legend-dot legend-pos" />
              {props.sentimentPos}
            </span>
            <span>
              <span className="legend-dot legend-neu" />
              {props.sentimentNeu}
            </span>
            <span>
              <span className="legend-dot legend-neg" />
              {props.sentimentNeg}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-family-mono)",
            }}
          >
            {props.sentimentFoot}
          </div>
        </div>

        <div className="widget">
          <div className="widget-head">
            <span className="widget-title">{props.topWordsTitle}</span>
            <span className="widget-sub">{props.topWordsSub}</span>
          </div>
          <div className="tw-list">
            {[
              { w: "tutorial", pct: 100, n: "847" },
              { w: "love", pct: 78, n: "662" },
              { w: "workflow", pct: 64, n: "543" },
              { w: "helpful", pct: 53, n: "449" },
              { w: "thanks", pct: 47, n: "398" },
              { w: "editing", pct: 43, n: "364" },
              { w: "camera", pct: 36, n: "307" },
              { w: "amazing", pct: 31, n: "261" },
            ].map((row) => (
              <div key={row.w} className="tw-row">
                <span className="tw-word">{row.w}</span>
                <span className="tw-bar">
                  <span style={{ width: `${row.pct}%` }} />
                </span>
                <span className="tw-count">{row.n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="widget">
          <div className="widget-head">
            <span className="widget-title">{props.emojiTitle}</span>
            <span className="widget-sub">{props.emojiSub}</span>
          </div>
          <div className="emoji-grid">
            {[
              { g: "🔥", pct: 100, p: "18.2%" },
              { g: "❤️", pct: 81, p: "14.7%" },
              { g: "👏", pct: 62, p: "11.3%" },
              { g: "💯", pct: 53, p: "9.6%" },
              { g: "😍", pct: 46, p: "8.4%" },
              { g: "🙏", pct: 40, p: "7.2%" },
              { g: "👍", pct: 37, p: "6.8%" },
              { g: "😂", pct: 32, p: "5.9%" },
              { g: "⚡", pct: 25, p: "4.5%" },
              { g: "💪", pct: 17, p: "3.1%" },
            ].map((row, i) => (
              <div key={i} className="emoji-row">
                <span className="glyph">{row.g}</span>
                <span className="pct-bar">
                  <span style={{ width: `${row.pct}%` }} />
                </span>
                <span className="pct">{row.p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card comments-card">
        <div
          className="widget-head"
          style={{ marginBottom: "var(--space-3)" }}
        >
          <span className="widget-title">{props.commentsTitle}</span>
          <span className="widget-sub">{props.commentsSub}</span>
        </div>
        <div className="comments-list">
          {SAMPLE_COMMENTS.map((c, i) => (
            <div key={i} className="comment-row">
              <span className="comment-author">{c.author}</span>
              <span className="comment-text">{c.text}</span>
              <span className={`comment-sent ${c.kind}`}>
                <span className="dot" />
                {c.kind === "pos"
                  ? props.posLabel
                  : c.kind === "neg"
                    ? props.negLabel
                    : props.neuLabel}
              </span>
            </div>
          ))}
        </div>
        <div className="comments-foot">
          <span>{props.commentsFoot}</span>
          <IntlLink
            href="/login?intent=signup"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {props.commentsFootCta}
          </IntlLink>
        </div>
      </div>
    </div>
  )
}

const SAMPLE_COMMENTS: Array<{
  author: string
  text: string
  kind: "pos" | "neu" | "neg"
}> = [
  {
    author: "@sarah_makes",
    text: "This is the workflow video I've needed for months 🔥 The premiere shortcut at 4:12 alone is worth a sub. Thank you!",
    kind: "pos",
  },
  {
    author: "@mike.travels",
    text: "Quick question, what mic are you using for the voiceover? It sounds amazing.",
    kind: "neu",
  },
  {
    author: "@designdaily",
    text: "Love the part about cutting B-roll first. I always do it last and it slows me down so much. Trying this tomorrow ❤️",
    kind: "pos",
  },
  {
    author: "@noahcodes",
    text: "Sponsored sections in the middle were kind of jarring tbh, but the actual tutorial parts were 💯",
    kind: "neu",
  },
  {
    author: "@priya.films",
    text: "Way too long. Could've been a 6 min video honestly.",
    kind: "neg",
  },
]

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 12 5 5L20 6" />
    </svg>
  )
}

function GithubIcon() {
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
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.12-1.47-1.12-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M21.6 12.227c0-.708-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.51h3.232c1.891-1.742 2.98-4.305 2.98-7.351Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.964-.895 6.619-2.422l-3.232-2.51c-.895.6-2.04.955-3.387.955-2.605 0-4.81-1.76-5.596-4.123H3.064v2.59A9.997 9.997 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.404 13.9A6.013 6.013 0 0 1 6.09 12c0-.66.114-1.3.314-1.9V7.51H3.064A9.997 9.997 0 0 0 2 12c0 1.614.386 3.14 1.064 4.49l3.34-2.59Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.977c1.468 0 2.787.505 3.824 1.498l2.868-2.868C16.96 2.99 14.695 2 12 2A9.997 9.997 0 0 0 3.064 7.51l3.34 2.59C7.19 7.737 9.395 5.977 12 5.977Z"
        fill="#EA4335"
      />
    </svg>
  )
}
