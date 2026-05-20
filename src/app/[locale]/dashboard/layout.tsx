import { setRequestLocale } from "next-intl/server"
import type { ReactNode } from "react"

/*
  TUB-1 Visual Port: dashboard route layout. Intentionally minimal: the
  parent LocaleLayout already supplies <html>, <body className="tm-design">,
  Toaster, and NextIntlClientProvider. We only need to enable the
  next-intl request locale for nested server components. The actual
  app-shell (topbar + sidebar) is rendered by <DashboardShell /> inside
  page.tsx so it can read the auth-derived tier + initials in the same
  Suspense boundary as the page content.

  The public <SiteHeader /> is suppressed for every /dashboard route by
  <SiteHeaderGate /> in src/app/[locale]/layout.tsx.
*/
export default async function DashboardLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string }>
  children: ReactNode
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return children
}
