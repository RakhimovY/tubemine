import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link as IntlLink } from "@/i18n/navigation"
import { LegalToc } from "@/components/legal-toc"
import { SiteFooter } from "@/components/site-footer"
import { McpSetupSummary } from "@/components/mcp/mcp-setup-summary"
import { REPO_URL } from "@/lib/site-links"
import { breadcrumbSchema, seoAlternates } from "@/lib/seo-alternates"

const SUPPORT_EMAIL = "hello@tubemine.app"
const LAST_UPDATED = "May 21, 2026"

export const dynamic = "force-static"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "docs.meta" })
  return {
    title: t("title"),
    description: t("description"),
    alternates: seoAlternates("/docs", locale),
  }
}

/*
  TUB-31 Docs content sprint (page 1 of 2).
  Reuses the .legal-page CSS scope shipped on /privacy and /terms.
  Inline <script> behavior lives in one client island reused as-is:
    - LegalToc: IntersectionObserver active-section highlight + smooth-scroll.
*/
export default async function DocsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("docs")

  const sections = [
    {
      id: "overview",
      num: "01",
      tocLabel: t("sections.overview.toc_label"),
      title: t("sections.overview.title"),
      body: (
        <>
          {/* SRC: README.md "What it does" lines 27-31 */}
          <p>{t("sections.overview.p1")}</p>
          <p>{t("sections.overview.p2")}</p>
        </>
      ),
    },
    {
      id: "mcp",
      num: "02",
      tocLabel: t("sections.mcp.toc_label"),
      title: t("sections.mcp.title"),
      body: <McpSetupSummary locale={locale} />,
    },
    {
      id: "quickstart",
      num: "03",
      tocLabel: t("sections.quickstart.toc_label"),
      title: t("sections.quickstart.title"),
      body: (
        <>
          {/* SRC: README.md "How it works" steps 1-3 (lines 70-75) + pricing.compare.row_monthly_anon */}
          <p>{t("sections.quickstart.p1")}</p>
          <ul>
            <li>
              <strong>{t("sections.quickstart.b1_strong")}</strong>{" "}
              {t("sections.quickstart.b1_text")}
            </li>
            <li>
              <strong>{t("sections.quickstart.b2_strong")}</strong>{" "}
              {t("sections.quickstart.b2_text")}
            </li>
            <li>
              <strong>{t("sections.quickstart.b3_strong")}</strong>{" "}
              {t("sections.quickstart.b3_text")}
            </li>
          </ul>
          <div className="callout">
            <p>
              <strong>{t("sections.quickstart.callout_strong")}</strong>{" "}
              {t("sections.quickstart.callout_text")}
            </p>
          </div>
        </>
      ),
    },
    {
      id: "signin",
      num: "04",
      tocLabel: t("sections.signin.toc_label"),
      title: t("sections.signin.title"),
      body: (
        <>
          {/* SRC: README plans table Free column + pricing.compare.row_monthly_free + row_saved_free */}
          <p>{t("sections.signin.p1")}</p>
          <ul>
            <li>
              <strong>{t("sections.signin.b1_strong")}</strong>{" "}
              {t("sections.signin.b1_text")}
            </li>
            <li>
              <strong>{t("sections.signin.b2_strong")}</strong>{" "}
              {t("sections.signin.b2_text")}
            </li>
            <li>
              <strong>{t("sections.signin.b3_strong")}</strong>{" "}
              {t("sections.signin.b3_text")}
            </li>
            <li>
              <strong>{t("sections.signin.b4_strong")}</strong>{" "}
              {t("sections.signin.b4_text")}
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "pro",
      num: "05",
      tocLabel: t("sections.pro.toc_label"),
      title: t("sections.pro.title"),
      body: (
        <>
          {/* SRC: README plans Pro column + pricing.pro.price/unit + pricing.faq.a5 */}
          <p>{t("sections.pro.p1")}</p>
          <ul>
            <li>
              <strong>{t("sections.pro.b1_strong")}</strong>{" "}
              {t("sections.pro.b1_text")}
            </li>
            <li>
              <strong>{t("sections.pro.b2_strong")}</strong>{" "}
              {t("sections.pro.b2_text")}
            </li>
            <li>
              <strong>{t("sections.pro.b3_strong")}</strong>{" "}
              {t("sections.pro.b3_text")}
            </li>
            <li>
              <strong>{t("sections.pro.b4_strong")}</strong>{" "}
              {t("sections.pro.b4_text")}
            </li>
          </ul>
          <p>
            {t("sections.pro.p2_prefix")}{" "}
            <IntlLink href="/pricing#faq">
              {t("sections.pro.p2_link_pricing")}
            </IntlLink>
            {t("sections.pro.p2_tail")}
          </p>
        </>
      ),
    },
    {
      id: "formats",
      num: "06",
      tocLabel: t("sections.formats.toc_label"),
      title: t("sections.formats.title"),
      body: (
        <>
          {/* SRC: README "How it works" step 3 lines 73-74 + TUB-23 sanitization */}
          <p>{t("sections.formats.p1")}</p>
          <ul>
            <li>
              <strong>{t("sections.formats.csv_strong")}</strong>{" "}
              {t("sections.formats.csv_text")}
            </li>
            <li>
              <strong>{t("sections.formats.json_strong")}</strong>{" "}
              {t("sections.formats.json_text")}
            </li>
            <li>
              <strong>{t("sections.formats.xlsx_strong")}</strong>{" "}
              {t("sections.formats.xlsx_text")}
            </li>
          </ul>
          <p>{t("sections.formats.p2_security")}</p>
        </>
      ),
    },
    {
      id: "limits",
      num: "07",
      tocLabel: t("sections.limits.toc_label"),
      title: t("sections.limits.title"),
      body: (
        <>
          {/* SRC: README "Quota enforcement" line 75 + comparison row_monthly_* */}
          <p>{t("sections.limits.p1")}</p>
          <ul>
            <li>
              <strong>{t("sections.limits.ip_strong")}</strong>{" "}
              {t("sections.limits.ip_text")}
            </li>
            <li>
              <strong>{t("sections.limits.user_strong")}</strong>{" "}
              {t("sections.limits.user_text")}
            </li>
            <li>
              <strong>{t("sections.limits.yt_strong")}</strong>{" "}
              {t("sections.limits.yt_text")}
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "troubleshoot",
      num: "08",
      tocLabel: t("sections.troubleshoot.toc_label"),
      title: t("sections.troubleshoot.title"),
      body: (
        <>
          {/* SRC: src/app/api/extract/route.ts:114-145, 203-213 + preview/route.ts:39 */}
          <p>{t("sections.troubleshoot.p1")}</p>
          <ul>
            <li>
              <strong>{t("sections.troubleshoot.err1_q")}</strong>{" "}
              {t("sections.troubleshoot.err1_a")}
            </li>
            <li>
              <strong>{t("sections.troubleshoot.err2_q")}</strong>{" "}
              {t("sections.troubleshoot.err2_a")}
            </li>
            <li>
              <strong>{t("sections.troubleshoot.err3_q")}</strong>{" "}
              {t("sections.troubleshoot.err3_a")}
            </li>
            <li>
              <strong>{t("sections.troubleshoot.err4_q")}</strong>{" "}
              {t("sections.troubleshoot.err4_a")}
            </li>
            <li>
              <strong>{t("sections.troubleshoot.err5_q")}</strong>{" "}
              {t("sections.troubleshoot.err5_a")}
            </li>
          </ul>
          <p>
            {t("sections.troubleshoot.p_contact_prefix")}{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>
              {t("sections.troubleshoot.p_contact_link")}
            </a>
            {t("sections.troubleshoot.p_contact_tail")}
          </p>
        </>
      ),
    },
    {
      id: "opensource",
      num: "09",
      tocLabel: t("sections.opensource.toc_label"),
      title: t("sections.opensource.title"),
      body: (
        <>
          {/* SRC: README Contributing + License sections lines 162-173 */}
          <p>
            {t("sections.opensource.p1_prefix")}{" "}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              {t("sections.opensource.p1_link_github")}
            </a>
            {t("sections.opensource.p1_tail")}
          </p>
          <p>{t("sections.opensource.p2")}</p>
        </>
      ),
    },
  ]

  const breadcrumb = breadcrumbSchema(locale, "/docs")

  return (
    <div className="legal-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <LegalToc />

      <main>
        <section className="legal-hero">
          <div className="container">
            <span className="legal-badge">{t("hero.badge")}</span>
            <h1 className="legal-title">{t("hero.title")}</h1>
            <p className="legal-sub">{t("hero.sub")}</p>
            <p className="legal-updated">
              {t("hero.updated_label")}: {LAST_UPDATED}
            </p>
          </div>
        </section>

        <section className="legal-body">
          <div className="container legal-grid">
            <aside className="toc" aria-label={t("toc.aria")}>
              <h3>{t("toc.heading")}</h3>
              <ol>
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>{s.tocLabel}</a>
                  </li>
                ))}
              </ol>
            </aside>

            <article className="legal-article">
              {sections.map((s) => (
                <section key={s.id} id={s.id}>
                  <h2>
                    <span className="num">{s.num}</span> {s.title}
                  </h2>
                  {s.body}
                </section>
              ))}
            </article>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

