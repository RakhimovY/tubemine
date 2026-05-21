import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link as IntlLink } from "@/i18n/navigation"
import { LegalToc } from "@/components/legal-toc"

const REPO_URL = "https://github.com/RakhimovY/tubemine"
const SUPPORT_EMAIL = "hello@tubemine.app"
const LAST_UPDATED = "May 21, 2026"

export const dynamic = "force-dynamic"

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
  const tLanding = await getTranslations("landing")

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
      id: "quickstart",
      num: "02",
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
      num: "03",
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
      num: "04",
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
      num: "05",
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
      num: "06",
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
      num: "07",
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
      num: "08",
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

  return (
    <div className="legal-page">
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

      <DocsFooter tLanding={tLanding} />
    </div>
  )
}

function DocsFooter({
  tLanding,
}: {
  tLanding: Awaited<ReturnType<typeof getTranslations<"landing">>>
}) {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <IntlLink href="/" className="nav-brand">
              <span className="brand-mark" />
              <span>{tLanding("header.brand")}</span>
            </IntlLink>
            <p>{tLanding("footer.tagline")}</p>
          </div>
          <div className="footer-col">
            <h4>{tLanding("footer.col_product")}</h4>
            <ul>
              <li>
                <IntlLink href="/#features">
                  {tLanding("header.nav_features")}
                </IntlLink>
              </li>
              <li>
                <IntlLink href="/pricing">
                  {tLanding("header.nav_pricing")}
                </IntlLink>
              </li>
              <li>
                <IntlLink href="/dashboard">
                  {tLanding("header.cta_dashboard")}
                </IntlLink>
              </li>
              <li>
                <IntlLink href="/changelog">
                  {tLanding("header.nav_changelog")}
                </IntlLink>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>{tLanding("footer.col_resources")}</h4>
            <ul>
              <li>
                <IntlLink href="/docs">{tLanding("header.nav_docs")}</IntlLink>
              </li>
              <li>
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>{tLanding("footer.col_legal")}</h4>
            <ul>
              <li>
                <IntlLink href="/privacy">{tLanding("footer.privacy")}</IntlLink>
              </li>
              <li>
                <IntlLink href="/terms">{tLanding("footer.terms")}</IntlLink>
              </li>
              <li>
                <a
                  href={`${REPO_URL}/blob/main/LICENSE`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {tLanding("footer.license")}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <nav className="footer-social" aria-label={tLanding("footer.social_aria")}>
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
          <span>{tLanding("footer.copyright")}</span>
          <span>{tLanding("footer.version")}</span>
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
