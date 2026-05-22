import type { MetadataRoute } from "next"

const base = "https://tubemine.tech"
const locales = ["en", "ru"] as const
const routes = [
  "",
  "/pricing",
  "/login",
  "/docs",
  "/changelog",
  "/privacy",
  "/terms",
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const out: MetadataRoute.Sitemap = []
  for (const locale of locales) {
    for (const route of routes) {
      out.push({
        url: `${base}/${locale}${route}`,
        lastModified,
        changeFrequency: "weekly",
        priority: route === "" ? 1.0 : 0.7,
        alternates: {
          languages: {
            en: `${base}/en${route}`,
            ru: `${base}/ru${route}`,
            "x-default": `${base}/en${route}`,
          },
        },
      })
    }
  }
  return out
}
