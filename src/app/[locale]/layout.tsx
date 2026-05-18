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

const socials = [
  { label: "GitHub", url: "https://github.com/RakhimovY/tubemine" },
  { label: "Threads", url: "https://www.threads.com/@ai.yerke_" },
  { label: "X", url: "https://x.com/yerkeRakhimov" },
  { label: "LinkedIn", url: "https://www.linkedin.com/in/rakhimov-yerkebulan/" },
  { label: "dev.to", url: "https://dev.to/yerkerakhimov" },
  { label: "Reddit", url: "https://www.reddit.com/user/ErkeshaA/" },
  { label: "Instagram", url: "https://www.instagram.com/ai.yerke_/" },
  { label: "Telegram", url: "https://t.me/ai_yerke" },
]

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
          <footer className="mt-auto border-t border-border/40 px-6 py-6">
            <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {socials.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="hover:text-foreground"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </footer>
          <Toaster richColors position="top-center" />
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  )
}
