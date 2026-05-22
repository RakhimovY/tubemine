import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { NextIntlClientProvider, hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { Toaster } from "@/components/ui/sonner"
import { SiteHeader } from "@/components/site-header"
import { SiteHeaderGate } from "@/components/site-header-gate"
import { routing } from "@/i18n/routing"
import { seoAlternates, ogLocale, SEO_SITE_BASE } from "@/lib/seo-alternates"
import "../globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "landing.meta" })
  const title = t("title")
  const description = t("description")
  const ogDescription = t("og_description")
  return {
    title,
    description,
    metadataBase: new URL(SEO_SITE_BASE),
    manifest: "/site.webmanifest",
    openGraph: {
      title,
      description: ogDescription,
      type: "website",
      url: `${SEO_SITE_BASE}/${locale}`,
      siteName: "TubeMine",
      locale: ogLocale(locale),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: ogDescription,
    },
    alternates: seoAlternates("", locale),
  }
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      {/*
        TUB-1 Visual Port: <body> carries the `tm-design` class so the v3
        design CSS tokens scoped under `.tm-design` (see globals.css) apply
        to the shared chrome (SiteHeader, mobile drawer, locale switcher)
        and to every page's content. The footer that previously lived in
        this layout was removed: the Landing page ships its own design
        footer, and other pages can opt into the shared chrome as they
        port over.
      */}
      <body className="tm-design min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "TubeMine",
              description:
                "YouTube audience analytics: sentiment, top words, and emoji insights from public comment data via the YouTube Data API. Free up to 5,000 comments per month with a free account.",
              url: "https://tubemine.tech",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              author: {
                "@type": "Person",
                name: "Yerken Rakhimov",
                url: "https://github.com/RakhimovY",
                sameAs: [
                  "https://github.com/RakhimovY",
                  "https://x.com/yerkeRakhimov",
                  "https://www.linkedin.com/in/rakhimov-yerkebulan/",
                ],
              },
              sourceOrganization: {
                "@type": "Organization",
                name: "TubeMine",
                url: "https://github.com/RakhimovY/tubemine",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "TubeMine",
              url: "https://tubemine.tech",
              logo: "https://tubemine.tech/icon.png",
              sameAs: [
                "https://github.com/RakhimovY/tubemine",
                "https://x.com/yerkeRakhimov",
                "https://www.linkedin.com/in/rakhimov-yerkebulan/",
                "https://t.me/ai_yerke",
              ],
            }),
          }}
        />
        <NextIntlClientProvider>
          <SiteHeaderGate>
            <SiteHeader />
          </SiteHeaderGate>
          {children}
          <Toaster richColors position="top-center" />
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  )
}
