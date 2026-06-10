import { getTranslations, setRequestLocale } from "next-intl/server"
import { LegalToc } from "@/components/legal-toc"
import { SiteFooter } from "@/components/site-footer"
import { McpDocs } from "@/components/mcp/mcp-docs"
import { breadcrumbSchema, seoAlternates } from "@/lib/seo-alternates"

export const dynamic = "force-static"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "mcp.docs" })
  return {
    title: t("meta_title"),
    description: t("meta_description"),
    alternates: seoAlternates("/mcp-docs", locale),
  }
}

/*
  Public MCP setup docs page (/mcp-docs).

  Reuses the legal-page layout (public SiteHeader from the root layout's
  SiteHeaderGate, the sticky-TOC grid, and SiteFooter) rather than the
  signed-in app shell. /mcp-docs is not in APP_SHELL_ROUTES, so the public
  SiteHeader renders.

  The .mcp-docs-page class sits next to .legal-page so the shared legal
  CSS applies and the MCP-docs-only additions in globals.css (spec cards,
  client-head logo, step-list, def-list, note-inline, config-path) scope
  to this page.

  LegalToc is the same IntersectionObserver client island the legal pages
  use: it drives the active-section highlight and smooth-scrolls anchor
  clicks (so /mcp-docs#cursor jumps to the Cursor section).
*/
export default async function McpDocsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const breadcrumb = breadcrumbSchema(locale, "/mcp-docs")

  return (
    <div className="legal-page mcp-docs-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <LegalToc />

      <McpDocs locale={locale} />

      <SiteFooter />
    </div>
  )
}
