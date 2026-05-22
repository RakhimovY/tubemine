import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link as IntlLink } from "@/i18n/navigation"
import { LegalToc } from "@/components/legal-toc"
import { SiteFooter } from "@/components/site-footer"

const SUPPORT_EMAIL = "hello@tubemine.app"
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
  const t = await getTranslations({ locale, namespace: "privacy.meta" })
  return {
    title: t("title"),
    description: t("description"),
  }
}

/*
  TUB-1 Visual Port (Privacy, Page 8 of 9).
  This file is the verbatim semantic port of:
    /tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/TubeMine Privacy.html
  Inline <style> CSS lives in src/app/globals.css scoped under
  `.tm-design .legal-page` (shared with /terms once Page 9 ports).
  Public chrome (SiteHeader + this page's design footer) is retained, the
  shared SiteHeader runs from src/components/site-header.tsx (not
  suppressed by site-header-gate.tsx, see APP_SHELL_ROUTES).
  Inline <script> behavior lives in one client island:
    - LegalToc: IntersectionObserver-driven active-section highlight in
      the sticky TOC, plus smooth-scroll on anchor click with an 80px
      sticky-nav offset.
*/
export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("privacy")

  const sections = [
    {
      id: "collect",
      num: "01",
      tocLabel: t("sections.collect.toc_label"),
      title: t("sections.collect.title"),
      body: (
        <>
          <p>{t("sections.collect.p1")}</p>
          <ul>
            <li>
              <strong>{t("sections.collect.b1_strong")}</strong>{" "}
              {t("sections.collect.b1_text")}
            </li>
            <li>
              <strong>{t("sections.collect.b2_strong")}</strong>{" "}
              {t("sections.collect.b2_text")}
            </li>
            <li>
              <strong>{t("sections.collect.b3_strong")}</strong>{" "}
              {t("sections.collect.b3_text")}
            </li>
          </ul>
          <div className="callout">
            <p>
              <strong>{t("sections.collect.callout_strong")}</strong>{" "}
              {t("sections.collect.callout_text")}
            </p>
          </div>
        </>
      ),
    },
    {
      id: "never",
      num: "02",
      tocLabel: t("sections.never.toc_label"),
      title: t("sections.never.title"),
      body: (
        <>
          <p>{t("sections.never.p1")}</p>
          <ul>
            <li>
              <strong>{t("sections.never.b1_strong")}</strong>{" "}
              {t("sections.never.b1_text")}
            </li>
            <li>
              <strong>{t("sections.never.b2_strong")}</strong>{" "}
              {t("sections.never.b2_text")}
            </li>
            <li>
              <strong>{t("sections.never.b3_strong")}</strong>{" "}
              {t("sections.never.b3_text")}
            </li>
            <li>
              <strong>{t("sections.never.b4_strong")}</strong>{" "}
              {t("sections.never.b4_text")}
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "youtube",
      num: "03",
      tocLabel: t("sections.youtube.toc_label"),
      title: t("sections.youtube.title"),
      body: (
        <>
          <p>{t("sections.youtube.p1")}</p>
          <p>
            <strong>{t("sections.youtube.p2_strong")}</strong>{" "}
            {t("sections.youtube.p2_text")}
          </p>
          <p>{t("sections.youtube.p3")}</p>
        </>
      ),
    },
    {
      id: "cookies",
      num: "04",
      tocLabel: t("sections.cookies.toc_label"),
      title: t("sections.cookies.title"),
      body: (
        <>
          <p>{t("sections.cookies.p1")}</p>
          <ul>
            <li>
              {t("sections.cookies.b1_prefix")}{" "}
              <strong>{t("sections.cookies.b1_strong")}</strong>
              {t("sections.cookies.b1_mid")} <code>httpOnly</code>{" "}
              {t("sections.cookies.b1_and")} <code>sameSite=lax</code>.{" "}
              {t("sections.cookies.b1_tail")}
            </li>
          </ul>
          <p>{t("sections.cookies.p2")}</p>
        </>
      ),
    },
    {
      id: "rights",
      num: "05",
      tocLabel: t("sections.rights.toc_label"),
      title: t("sections.rights.title"),
      body: (
        <>
          <p>
            {t("sections.rights.p1_prefix")}{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{" "}
            {t("sections.rights.p1_tail")}
          </p>
          <p>{t("sections.rights.p2")}</p>
        </>
      ),
    },
    {
      id: "changes",
      num: "06",
      tocLabel: t("sections.changes.toc_label"),
      title: t("sections.changes.title"),
      body: (
        <>
          <p>
            {t("sections.changes.p1_prefix")}{" "}
            <strong>{t("sections.changes.p1_strong")}</strong>{" "}
            {t("sections.changes.p1_tail")}
          </p>
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

