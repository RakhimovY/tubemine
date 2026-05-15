import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: "https://tubemine.vercel.app/sitemap.xml",
    host: "https://tubemine.vercel.app",
  }
}
