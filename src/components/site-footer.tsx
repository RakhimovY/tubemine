import { getTranslations } from "next-intl/server"
import { Link as IntlLink } from "@/i18n/navigation"
import { REPO_URL, SOCIALS } from "@/lib/site-links"

export async function SiteFooter() {
  const t = await getTranslations("landing")
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
                <IntlLink href="/#features">
                  {t("header.nav_features")}
                </IntlLink>
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
                <IntlLink href="/mcp-docs">{t("header.nav_mcp")}</IntlLink>
              </li>
              <li>
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </li>
              <li>
                <a href="mailto:support@tubemine.tech">{t("footer.support")}</a>
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

export default SiteFooter
