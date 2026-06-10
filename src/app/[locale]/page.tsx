import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link as IntlLink } from "@/i18n/navigation"
import { TubeMine } from "@/components/tubemine"
import { LandingFaq } from "@/components/landing-faq"
import { LandingSmoothScroll } from "@/components/landing-smooth-scroll"
import { LandingAuthGate } from "@/components/landing-auth-gate"
import { SiteFooter } from "@/components/site-footer"
import { HeroVideo } from "@/components/hero-video"
import { ClientLogo } from "@/components/brand/client-logo"
import { REPO_URL } from "@/lib/site-links"

/* Real MCP clients shown in the hero trust pill (brand logos, not dots). */
const HERO_CLIENTS = [
  "claude-code",
  "codex",
  "cursor",
  "chatgpt",
  "gemini-cli",
  "hermes",
  "openclaw",
] as const

const HERO_CLIENT_LABELS: Record<string, string> = {
  "claude-code": "Claude",
  codex: "Codex",
  cursor: "Cursor",
  chatgpt: "ChatGPT",
  "gemini-cli": "Gemini",
  hermes: "Hermes",
  openclaw: "OpenClaw",
}

const SUPPORT_EMAIL = "hello@tubemine.app"

/*
  Landing, v3 MCP-forward port of docs/design-v3/refs/TubeMine Landing.html.
  Leads with the MCP story (pull YouTube comments straight into your AI
  assistant) and keeps the web app as a clearly secondary path.
  Inline <style> CSS lives in src/app/globals.css scoped under .tm-design.
  Inline <script> behavior lives in small client islands:
    - LandingSmoothScroll: in-page anchor scroll with header offset
    - LandingFaq: accordion (one open, first by default)
    - SiteHeaderClient: sticky-nav scroll state, mobile drawer, locale dropdown
  Hero trust pill uses real brand logos via <ClientLogo />. The hero + how-it
  -works demos depict the single tool get_youtube_comments(); the MCP returns
  RAW comments and the user's AI does the analysis (no server-side analyze).
  The #demo section leads with the web-app strip (secondary path) and mounts
  the real <TubeMine /> extractor below it. Feature blocks reuse the shared
  result-block widget styling; sample/promo result is a static preview.
*/
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
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
    { q: t("faq.q8"), a: t("faq.a8") },
    { q: t("faq.q9"), a: t("faq.a9") },
  ]

  return (
    <LandingAuthGate>
      <LandingSmoothScroll />
      <main>
        {/* ===================== HERO ===================== */}
        <section className="hero">
          <div className="container">
            <div className="hero-pill" aria-label={t("hero.pill_aria")}>
              <span className="hp-dot" aria-hidden="true" />
              <span className="hp-prefix">{t("hero.pill_prefix")}</span>
              {HERO_CLIENTS.map((id) => (
                <span key={id} className="hp-client">
                  <ClientLogo client={id} className="hp-logo" />
                  <span>{HERO_CLIENT_LABELS[id]}</span>
                </span>
              ))}
            </div>

            <h1 className="hero-title">
              {t("hero.title_lead")}{" "}
              <span className="accent">{t("hero.title_accent")}</span>
            </h1>
            <p className="hero-sub">{t("hero.sub")}</p>

            <div className="hero-cta">
              <IntlLink href="/mcp-docs" className="btn btn--primary btn-lg hero-glow">
                {t("hero.cta_primary")}
                <ArrowRightIcon />
              </IntlLink>
            </div>
            <a href="#demo" className="hero-weblink">
              {t("hero.cta_secondary")}
            </a>

            <HeroVideo />
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

        {/* ===================== HOW IT WORKS ===================== */}
        <section
          className="section hiw"
          id="how-it-works"
          aria-label={t("how.title")}
        >
          <div className="container">
            <header className="section-head-center">
              <h2 className="section-title">{t("how.title")}</h2>
              <p className="section-sub">{t("how.sub")}</p>
            </header>

            <div className="hiw-flow">
              {/* Step 1, API-key setup (OAuth coming soon) */}
              <article className="hiw-step">
                <div className="hiw-copy">
                  <h3 className="hiw-title">{t("how.s1_title")}</h3>
                  <p className="hiw-body">{t("how.s1_body")}</p>
                </div>
                <div className="hiw-media" aria-hidden="true">
                  <div className="tm-bar">
                    <span className="tl" />
                    <span className="tl" />
                    <span className="tl" />
                    <span className="tm-name">{t("how.s1_term_name")}</span>
                  </div>
                  <div className="tm-body">
                    <div className="tm-line">
                      <span className="pr">$</span>{" "}
                      <span className="cmd">{t("how.s1_term_cmd")}</span>
                    </div>
                    <div className="tm-line mut">
                      {t("how.s1_term_connecting")}
                    </div>
                    <div className="tm-line ok">
                      <CheckIcon /> {t("how.s1_term_authed")}
                    </div>
                    <div className="tm-line ok">
                      <CheckIcon /> {t("how.s1_term_tools")}
                    </div>
                    <div className="tm-line">
                      <span className="pr">$</span> <span className="tm-caret" />
                    </div>
                  </div>
                </div>
              </article>

              {/* Step 2, drop a URL in chat */}
              <article className="hiw-step">
                <div className="hiw-copy">
                  <h3 className="hiw-title">{t("how.s2_title")}</h3>
                  <p className="hiw-body">{t("how.s2_body")}</p>
                </div>
                <div className="hiw-media" aria-hidden="true">
                  <div className="ch-body">
                    <div className="ch-bubble user">
                      {t("how.s2_user")}{" "}
                      <span className="ch-url">{t("how.s2_url")}</span>
                      <span className="ch-caret" />
                    </div>
                    <div className="ch-tool">
                      <PlugIcon className="ch-tool-icon" /> {t("how.s2_tool")}
                    </div>
                    <div className="ch-bubble ai">{t("how.s2_ai")}</div>
                  </div>
                </div>
              </article>

              {/* Step 3, AI returns the breakdown of the raw thread */}
              <article className="hiw-step">
                <div className="hiw-copy">
                  <h3 className="hiw-title">{t("how.s3_title")}</h3>
                  <p className="hiw-body">{t("how.s3_body")}</p>
                </div>
                <div className="hiw-media" aria-hidden="true">
                  <div className="mr-body">
                    <div className="mr-head">
                      <span className="mr-count">
                        {t("how.s3_count")}{" "}
                        <span className="u">{t("how.s3_count_unit")}</span>
                      </span>
                      <span className="mr-tag">● {t("how.s3_tag")}</span>
                    </div>
                    <div className="mr-sbar">
                      <span className="pos" style={{ width: "68%" }} />
                      <span className="neu" style={{ width: "24%" }} />
                      <span className="neg" style={{ width: "8%" }} />
                    </div>
                    <div className="mr-words">
                      {[
                        { w: "tutorial", pct: 100 },
                        { w: "love", pct: 78 },
                        { w: "workflow", pct: 64 },
                      ].map((row) => (
                        <div key={row.w} className="mr-word">
                          <span className="w">{row.w}</span>
                          <span className="track">
                            <span
                              className="fill"
                              style={{ width: `${row.pct}%` }}
                            />
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mr-emoji">
                      <span>🔥</span>
                      <span>❤️</span>
                      <span>👏</span>
                      <span>💯</span>
                      <span>😍</span>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ===================== WEB APP (secondary path) + LIVE DEMO ===================== */}
        <section className="section" id="demo">
          <div className="container">
            <div className="webapp-strip">
              <div className="ws-text">
                <span className="ws-eyebrow">{t("webapp.eyebrow")}</span>
                <h2 className="ws-title">{t("webapp.title")}</h2>
                <p className="ws-sub">{t("webapp.sub")}</p>
              </div>
              <IntlLink href="/dashboard" className="ws-link">
                {t("webapp.link")}
                <ArrowRightIcon />
              </IntlLink>
            </div>

            <div className="demo-wrap" style={{ marginTop: "var(--space-8)" }}>
              <TubeMine tier="anonymous" />
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

              <div className="ta-copy">
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
                  <IntlLink href="/login?intent=signup" className="btn btn--primary">
                    {t("dashboard.cta_signup")}
                  </IntlLink>
                  <a href="#pricing" className="btn btn--ghost">
                    {t("dashboard.cta_pricing")}
                  </a>
                </div>
              </div>
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
      <SiteFooter />
    </LandingAuthGate>
  )
}

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


function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
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

function PlugIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 2v6" />
      <path d="M15 2v6" />
      <path d="M7 8h10v3a5 5 0 0 1-10 0z" />
      <path d="M12 16v6" />
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
