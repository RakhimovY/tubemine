import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import { SiteHeader } from "@/components/site-header"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "TubeMine - YouTube Comment Analytics. Free. No Setup.",
  description:
    "Paste a YouTube URL, see top words and themes across every comment, export the dataset as CSV. No signup. No API key. Free up to 1,000 comments per month.",
  metadataBase: new URL("https://tubemine.vercel.app"),
  openGraph: {
    title: "TubeMine - YouTube Comment Analytics",
    description: "Paste a URL. Get instant comment analytics and CSV.",
    type: "website",
    url: "https://tubemine.vercel.app",
    siteName: "TubeMine",
  },
  twitter: {
    card: "summary_large_image",
    title: "TubeMine - YouTube Comment Analytics",
    description: "Paste a URL. Get instant comment analytics and CSV.",
  },
  alternates: {
    canonical: "https://tubemine.vercel.app",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
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
                "YouTube comment analytics: top words, themes, and research-ready CSV export. Free up to 1,000 comments per month, no signup, no API key required.",
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
        <SiteHeader />
        {children}
        <Toaster richColors position="top-center" />
        <Analytics />
      </body>
    </html>
  )
}
