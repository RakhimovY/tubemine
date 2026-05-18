import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { NextIntlClientProvider, hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { Toaster } from "@/components/ui/sonner"
import { SiteHeader } from "@/components/site-header"
import { routing } from "@/i18n/routing"
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
  const base = "https://tubemine.vercel.app"
  return {
    title: "TubeMine, YouTube Audience Analytics. Free. No Setup.",
    description:
      "Paste a YouTube URL. Get sentiment, top words, and audience themes in seconds. Free up to 1,000 comments per month.",
    metadataBase: new URL(base),
    openGraph: {
      title: "TubeMine, YouTube Audience Analytics",
      description:
        "Paste a URL. Get instant audience analytics: sentiment, top words, emojis.",
      type: "website",
      url: `${base}/${locale}`,
      siteName: "TubeMine",
      locale,
    },
    twitter: {
      card: "summary_large_image",
      title: "TubeMine, YouTube Audience Analytics",
      description:
        "Paste a URL. Get instant audience analytics: sentiment, top words, emojis.",
    },
    alternates: {
      canonical: `${base}/${locale}`,
      languages: {
        en: `${base}/en`,
        ru: `${base}/ru`,
        "x-default": `${base}/en`,
      },
    },
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "TubeMine",
              description:
                "YouTube audience analytics: sentiment, top words, and emoji insights from public comment data via the YouTube Data API. Free up to 1,000 comments per month.",
              url: "https://tubemine.vercel.app",
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
              },
              sourceOrganization: {
                "@type": "Organization",
                name: "TubeMine",
                url: "https://github.com/RakhimovY/tubemine",
              },
            }),
          }}
        />
        <NextIntlClientProvider>
          <SiteHeader />
          {children}
          <Toaster richColors position="top-center" />
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  )
}
