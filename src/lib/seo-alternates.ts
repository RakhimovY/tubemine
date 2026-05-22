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

const BREADCRUMB_LABELS = {
  en: {
    home: "Home",
    "/pricing": "Pricing",
    "/docs": "Docs",
    "/changelog": "Changelog",
    "/privacy": "Privacy",
    "/terms": "Terms",
  },
  ru: {
    home: "Главная",
    "/pricing": "Цены",
    "/docs": "Документация",
    "/changelog": "История изменений",
    "/privacy": "Конфиденциальность",
    "/terms": "Условия",
  },
} as const

type BreadcrumbRoute = Exclude<keyof (typeof BREADCRUMB_LABELS)["en"], "home">

export function breadcrumbSchema(locale: string, route: BreadcrumbRoute) {
  const labels =
    BREADCRUMB_LABELS[locale as keyof typeof BREADCRUMB_LABELS] ??
    BREADCRUMB_LABELS.en
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: labels.home,
        item: `${SITE_BASE}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: labels[route],
        item: `${SITE_BASE}/${locale}${route}`,
      },
    ],
  }
}

export const SEO_SITE_BASE = SITE_BASE
export const SEO_LOCALES = LOCALES
