import { Suspense } from "react"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link as IntlLink } from "@/i18n/navigation"
import { LandingFaq } from "@/components/landing-faq"
import { PricingTierAware } from "@/components/pricing-tier-aware"
import { SiteFooter } from "@/components/site-footer"
import { REPO_URL } from "@/lib/site-links"
import { seoAlternates } from "@/lib/seo-alternates"

const SUPPORT_EMAIL = "hello@tubemine.app"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "pricing.meta" })
  return {
    title: t("title"),
    description: t("description"),
    alternates: seoAlternates("/pricing", locale),
  }
}

/*
  TUB-1 Visual Port (Pricing, Page 2 of 9).
  This file is the verbatim semantic port of:
    /tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/TubeMine Pricing.html
  Inline <style> CSS lives in src/app/globals.css scoped under
  `.tm-design .pricing-page`.
  Inline <script> behavior lives in small client islands:
    - LandingFaq: accordion (one open, first by default)
    - PricingIntentRedirect: post-OAuth ?intent=signup -> /api/checkout
  The "Design preview" panel from the prototype is intentionally NOT
  shipped (README: do not ship the design preview panel to production).
  Auth-aware CTAs live in the server component:
    anon -> /login?intent=signup (or with plan=pro for the Pro card)
    free -> /dashboard (Free card) or /api/checkout (Pro card via island)
    pro  -> /dashboard (Free card) or /api/portal (Pro card)
*/
export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("pricing")

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

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { q: t("faq.q1"), a: t("faq.a1") },
      { q: t("faq.q2"), a: t("faq.a2") },
      { q: t("faq.q3"), a: t("faq.a3") },
      {
        q: t("faq.q4"),
        a: `${t("faq.a4_prefix")} ${t("faq.a4_link_terms")}${t("faq.a4_suffix")}`,
      },
      { q: t("faq.q5"), a: t("faq.a5") },
      { q: t("faq.q6"), a: t("faq.a6") },
      {
        q: t("faq.q7"),
        a: `${t("faq.a7_prefix")} ${t("faq.a7_link_privacy")}${t("faq.a7_suffix")}`,
      },
    ].map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  }

  return (
    <div className="pricing-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <main>
        {/* ===================== HERO ===================== */}
        <section className="hero">
          <div className="container">
            <span className="hero-badge">{t("hero.badge")}</span>
            <h1 className="hero-title">{t("hero.title")}</h1>
            <p className="hero-sub">{t("hero.sub")}</p>
          </div>
        </section>

        {/* ===================== PRICING ===================== */}
        <section className="pricing-section">
          <div className="container">
            <Suspense fallback={null}>
              <PricingTierAware />
            </Suspense>

            {/* ===== Comparison ===== */}
            <div className="compare-wrap">
              <header className="compare-head">
                <p className="compare-eyebrow">{t("compare.eyebrow")}</p>
                <p className="compare-note">{t("compare.note")}</p>
              </header>

              {/* Desktop / tablet: table */}
              <table
                className="compare-table"
                aria-label={t("compare.aria")}
              >
                <thead>
                  <tr>
                    <th scope="col">{t("compare.feature_col")}</th>
                    <th scope="col">
                      {t("compare.col_anon")}
                      <span className="col-sub">
                        {t("compare.col_anon_sub")}
                      </span>
                    </th>
                    <th scope="col">
                      {t("compare.col_free")}
                      <span className="col-sub">
                        {t("compare.col_free_sub")}
                      </span>
                    </th>
                    <th scope="col" className="col-pro">
                      {t("compare.col_pro")}
                      <span className="col-sub">
                        {t("compare.col_pro_sub")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">{t("compare.row_monthly")}</th>
                    <td>
                      <span className="compare-val is-pos">
                        {t("compare.row_monthly_anon")}
                      </span>
                    </td>
                    <td>
                      <span className="compare-val is-pos">
                        {t("compare.row_monthly_free")}
                      </span>
                    </td>
                    <td className="col-pro">
                      <span className="compare-val is-pos">
                        {t("compare.row_monthly_pro")}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">{t("compare.row_sentiment_dir")}</th>
                    <td>
                      <span className="compare-val is-pos">
                        {t("compare.row_sentiment_dir_anon")}
                      </span>
                    </td>
                    <td>
                      <span className="compare-val is-pos">
                        {t("compare.row_sentiment_dir_free")}
                      </span>
                    </td>
                    <td className="col-pro">
                      <span className="compare-val is-pos">
                        {t("compare.row_sentiment_dir_pro")}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">{t("compare.row_sentiment_exact")}</th>
                    <td>
                      <span className="compare-val is-neg">
                        <span className="dotmark" />
                        {t("compare.row_no")}
                      </span>
                    </td>
                    <td>
                      <span className="compare-val is-neg">
                        <span className="dotmark" />
                        {t("compare.row_no")}
                      </span>
                    </td>
                    <td className="col-pro">
                      <span className="compare-val is-pos">
                        <span className="dotmark" />
                        {t("compare.row_yes")}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">{t("compare.row_top_words")}</th>
                    <td>
                      <span className="compare-val is-pos">
                        {t("compare.row_top_words_anon")}
                      </span>
                    </td>
                    <td>
                      <span className="compare-val is-pos">
                        {t("compare.row_top_words_free")}
                      </span>
                    </td>
                    <td className="col-pro">
                      <span className="compare-val is-pos">
                        {t("compare.row_top_words_pro")}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">{t("compare.row_top_emoji")}</th>
                    <td>
                      <span className="compare-val is-pos">
                        {t("compare.row_top_emoji_anon")}
                      </span>
                    </td>
                    <td>
                      <span className="compare-val is-pos">
                        {t("compare.row_top_emoji_free")}
                      </span>
                    </td>
                    <td className="col-pro">
                      <span className="compare-val is-pos">
                        {t("compare.row_top_emoji_pro")}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">{t("compare.row_export")}</th>
                    <td>
                      <span className="compare-val is-pos">
                        {t("compare.row_export_anon")}
                      </span>
                    </td>
                    <td>
                      <span className="compare-val is-pos">
                        {t("compare.row_export_free")}
                      </span>
                    </td>
                    <td className="col-pro">
                      <span className="compare-val is-pos">
                        {t("compare.row_export_pro")}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">{t("compare.row_saved")}</th>
                    <td>
                      <span className="compare-val is-pos">
                        {t("compare.row_saved_anon")}
                      </span>
                    </td>
                    <td>
                      <span className="compare-val is-pos">
                        {t("compare.row_saved_free")}
                      </span>
                    </td>
                    <td className="col-pro">
                      <span className="compare-val is-pos">
                        {t("compare.row_saved_pro")}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Mobile: stacked cards */}
              <div className="compare-cards" aria-hidden="false">
                <article className="compare-card">
                  <header className="compare-card-head">
                    <span className="name">{t("compare.col_anon")}</span>
                    <span className="who">{t("compare.col_anon_sub")}</span>
                  </header>
                  <dl>
                    <CompareRow
                      label={t("compare.row_monthly")}
                      value={t("compare.row_monthly_anon")}
                    />
                    <CompareRow
                      label={t("compare.row_sentiment_dir")}
                      value={t("compare.row_sentiment_dir_anon")}
                    />
                    <CompareRow
                      label={t("compare.row_sentiment_exact")}
                      value={t("compare.row_no")}
                      negative
                    />
                    <CompareRow
                      label={t("compare.row_top_words")}
                      value={t("compare.row_top_words_anon")}
                    />
                    <CompareRow
                      label={t("compare.row_top_emoji")}
                      value={t("compare.row_top_emoji_anon")}
                    />
                    <CompareRow
                      label={t("compare.row_export")}
                      value={t("compare.row_export_anon")}
                    />
                    <CompareRow
                      label={t("compare.row_saved")}
                      value={t("compare.row_saved_anon")}
                    />
                  </dl>
                </article>
                <article className="compare-card">
                  <header className="compare-card-head">
                    <span className="name">{t("compare.col_free")}</span>
                    <span className="who">{t("compare.col_free_sub")}</span>
                  </header>
                  <dl>
                    <CompareRow
                      label={t("compare.row_monthly")}
                      value={t("compare.row_monthly_free")}
                    />
                    <CompareRow
                      label={t("compare.row_sentiment_dir")}
                      value={t("compare.row_sentiment_dir_free")}
                    />
                    <CompareRow
                      label={t("compare.row_sentiment_exact")}
                      value={t("compare.row_no")}
                      negative
                    />
                    <CompareRow
                      label={t("compare.row_top_words")}
                      value={t("compare.row_top_words_free")}
                    />
                    <CompareRow
                      label={t("compare.row_top_emoji")}
                      value={t("compare.row_top_emoji_free")}
                    />
                    <CompareRow
                      label={t("compare.row_export")}
                      value={t("compare.row_export_free")}
                    />
                    <CompareRow
                      label={t("compare.row_saved")}
                      value={t("compare.row_saved_free")}
                    />
                  </dl>
                </article>
                <article className="compare-card is-pro">
                  <header className="compare-card-head">
                    <span className="name">{t("compare.col_pro")}</span>
                    <span className="who">{t("compare.col_pro_sub")}</span>
                  </header>
                  <dl>
                    <CompareRow
                      label={t("compare.row_monthly")}
                      value={t("compare.row_monthly_pro")}
                    />
                    <CompareRow
                      label={t("compare.row_sentiment_dir")}
                      value={t("compare.row_sentiment_dir_pro")}
                    />
                    <CompareRow
                      label={t("compare.row_sentiment_exact")}
                      value={t("compare.row_yes")}
                      positiveDot
                    />
                    <CompareRow
                      label={t("compare.row_top_words")}
                      value={t("compare.row_top_words_pro")}
                    />
                    <CompareRow
                      label={t("compare.row_top_emoji")}
                      value={t("compare.row_top_emoji_pro")}
                    />
                    <CompareRow
                      label={t("compare.row_export")}
                      value={t("compare.row_export_pro")}
                    />
                    <CompareRow
                      label={t("compare.row_saved")}
                      value={t("compare.row_saved_pro")}
                    />
                  </dl>
                </article>
              </div>
            </div>

            <p className="trust-line">
              <span className="dot" />
              {t("trust.customers")}
              <span style={{ color: "var(--color-text-disabled)" }}>·</span>
              <span>{t("trust.api")}</span>
              <span style={{ color: "var(--color-text-disabled)" }}>·</span>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--color-text-tertiary)",
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <GithubInlineIcon />
                {t("trust.oss")}
              </a>
            </p>
          </div>
        </section>

        {/* ===================== FAQ ===================== */}
        <section className="faq-section" id="faq">
          <div className="container">
            <header className="section-head">
              <p className="section-eyebrow">{t("faq.eyebrow")}</p>
              <h2 className="section-title">{t("faq.title")}</h2>
              <p className="section-sub">
                {t("faq.contact_prefix")}{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </header>

            <LandingFaq items={faqItems} />
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
            <IntlLink href="/" className="btn btn--primary btn-lg">
              {t("final_cta.cta")}
              <ArrowRightIcon />
            </IntlLink>
          </div>
        </section>
      </main>

      {/* ===================== FOOTER ===================== */}
      <SiteFooter />
    </div>
  )
}

function CompareRow({
  label,
  value,
  negative,
  positiveDot,
}: {
  label: string
  value: string
  negative?: boolean
  positiveDot?: boolean
}) {
  return (
    <div className="row">
      <dt>{label}</dt>
      <dd>
        <span className={`compare-val ${negative ? "is-neg" : "is-pos"}`}>
          {negative || positiveDot ? <span className="dotmark" /> : null}
          {value}
        </span>
      </dd>
    </div>
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

function GithubInlineIcon() {
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
