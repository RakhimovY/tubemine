import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link as IntlLink } from "@/i18n/navigation"
import { LegalToc } from "@/components/legal-toc"
import { SiteFooter } from "@/components/site-footer"
import { seoAlternates } from "@/lib/seo-alternates"

const SUPPORT_EMAIL = "hello@tubemine.app"
const YT_API_TOS_URL =
  "https://developers.google.com/youtube/terms/api-services-terms-of-service"
/*
  "Last updated" date is intentionally hardcoded in source (not in CMS, not
  user-editable) per design handoff README. Update this constant whenever
  the policy text changes; the date renders verbatim in both locales.
*/
const LAST_UPDATED = "May 18, 2026"

export const dynamic = "force-static"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "terms.meta" })
  return {
    title: t("title"),
    description: t("description"),
    alternates: seoAlternates("/terms", locale),
  }
}

/*
  TUB-1 Visual Port (Terms, Page 9 of 9, sprint COMPLETE).
  This file is the verbatim semantic port of:
    /tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/TubeMine Terms.html
  Inline <style> CSS lives in src/app/globals.css scoped under
  `.tm-design .legal-page` (shared with /privacy from Page 8). All the CSS
  selectors used here (.legal-hero, .legal-grid, .toc, .legal-article,
  section, h2 .num, ul, strong, a, code) were already added by Page 8 and
  match the Terms HTML exactly, so no new CSS is needed.
  Public chrome (SiteHeader + this page's design footer) is retained, the
  shared SiteHeader runs from src/components/site-header.tsx (not
  suppressed by site-header-gate.tsx, see APP_SHELL_ROUTES).
  Inline <script> behavior lives in one client island:
    - LegalToc: IntersectionObserver-driven active-section highlight in
      the sticky TOC, plus smooth-scroll on anchor click with an 80px
      sticky-nav offset. Reused as-is from Page 8.
*/
export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("terms")

  const sections = [
    {
      id: "asis",
      num: "01",
      tocLabel: t("sections.asis.toc_label"),
      title: t("sections.asis.title"),
      body: (
        <>
          <p>
            {t("sections.asis.p1_prefix")}{" "}
            <strong>{t("sections.asis.p1_strong")}</strong>
            {t("sections.asis.p1_tail")}
          </p>
          <p>{t("sections.asis.p2")}</p>
        </>
      ),
    },
    {
      id: "youtube",
      num: "02",
      tocLabel: t("sections.youtube.toc_label"),
      title: t("sections.youtube.title"),
      body: (
        <>
          <p>
            {t("sections.youtube.p1_prefix")}{" "}
            <a href={YT_API_TOS_URL} target="_blank" rel="noopener noreferrer">
              {t("sections.youtube.p1_link")}
            </a>
            {t("sections.youtube.p1_tail")}
          </p>
          <p>{t("sections.youtube.p2")}</p>
        </>
      ),
    },
    {
      id: "use",
      num: "03",
      tocLabel: t("sections.use.toc_label"),
      title: t("sections.use.title"),
      body: (
        <>
          <p>{t("sections.use.p1")}</p>
          <ul>
            <li>
              <strong>{t("sections.use.b1_strong")}</strong>{" "}
              {t("sections.use.b1_text")}
            </li>
            <li>
              <strong>{t("sections.use.b2_strong")}</strong>{" "}
              {t("sections.use.b2_text")}
            </li>
            <li>
              <strong>{t("sections.use.b3_strong")}</strong>{" "}
              {t("sections.use.b3_text")}
            </li>
            <li>
              <strong>{t("sections.use.b4_strong")}</strong>{" "}
              {t("sections.use.b4_text")}
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "suspension",
      num: "04",
      tocLabel: t("sections.suspension.toc_label"),
      title: t("sections.suspension.title"),
      body: (
        <>
          <p>{t("sections.suspension.p1")}</p>
          <p>
            <strong>{t("sections.suspension.p2_strong")}</strong>
            {t("sections.suspension.p2_tail")}
          </p>
        </>
      ),
    },
    {
      id: "pricing",
      num: "05",
      tocLabel: t("sections.pricing.toc_label"),
      title: t("sections.pricing.title"),
      body: (
        <>
          <p>
            {t("sections.pricing.p1_prefix")}{" "}
            <strong>{t("sections.pricing.p1_strong")}</strong>{" "}
            {t("sections.pricing.p1_tail")}
          </p>
        </>
      ),
    },
    {
      id: "law",
      num: "06",
      tocLabel: t("sections.law.toc_label"),
      title: t("sections.law.title"),
      body: (
        <>
          <p>
            {t("sections.law.p1_prefix")}{" "}
            <strong>{t("sections.law.p1_strong")}</strong>
            {t("sections.law.p1_mid")}{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{" "}
            {t("sections.law.p1_tail")}
          </p>
          <p>{t("sections.law.p2")}</p>
        </>
      ),
    },
    {
      id: "contact",
      num: "07",
      tocLabel: t("sections.contact.toc_label"),
      title: t("sections.contact.title"),
      body: (
        <>
          <p>
            {t("sections.contact.p1_prefix")}{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.{" "}
            {t("sections.contact.p1_tail")}
          </p>
        </>
      ),
    },
  ]

  return (
    <div className="legal-page">
      <LegalToc />

      <main>
        {/* ===================== HERO ===================== */}
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

        {/* ===================== BODY ===================== */}
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

      {/* ===================== FOOTER ===================== */}
      <SiteFooter />
    </div>
  )
}

