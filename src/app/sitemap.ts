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
  const out: MetadataRoute.Sitemap = []
  for (const locale of locales) {
    for (const route of routes) {
      out.push({
        url: `${base}/${locale}${route}`,
        changeFrequency: "weekly",
        priority: route === "" ? 1.0 : 0.7,
      })
    }
  }
  return out
}
