import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: "https://tubemine.vercel.app",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://tubemine.vercel.app/pricing",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: "https://tubemine.vercel.app/login",
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ]
}
