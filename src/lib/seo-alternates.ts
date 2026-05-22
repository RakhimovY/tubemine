const SITE_BASE = "https://tubemine.tech"
const LOCALES = ["en", "ru"] as const

export function seoAlternates(route: string, locale: string) {
  const path = route === "" || route.startsWith("/") ? route : `/${route}`
  return {
    canonical: `${SITE_BASE}/${locale}${path}`,
    languages: {
      en: `${SITE_BASE}/en${path}`,
      ru: `${SITE_BASE}/ru${path}`,
      "x-default": `${SITE_BASE}/en${path}`,
    },
  }
}

export function ogLocale(locale: string): string {
  return locale === "ru" ? "ru_RU" : "en_US"
}

export const SEO_SITE_BASE = SITE_BASE
export const SEO_LOCALES = LOCALES
