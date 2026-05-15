import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
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
  title: "TubeMine - Extract YouTube Comments. Free. No Setup.",
  description:
    "Paste a YouTube URL, get a CSV of every comment. No signup. No API key. Free up to 1,000 comments per month.",
  metadataBase: new URL("https://tubemine.vercel.app"),
  openGraph: {
    title: "TubeMine - Extract YouTube Comments",
    description: "Paste a URL. Get a CSV. Done.",
    type: "website",
    url: "https://tubemine.vercel.app",
    siteName: "TubeMine",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TubeMine - Extract YouTube Comments. Free. No Setup.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TubeMine - Extract YouTube Comments",
    description: "Paste a URL. Get a CSV. Done.",
    images: ["/og-image.png"],
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
                "Extract YouTube video comments as research-ready CSV. Free, no signup, no API key required.",
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
        {children}
        <Toaster richColors position="top-center" />
        <Analytics />
      </body>
    </html>
  )
}
