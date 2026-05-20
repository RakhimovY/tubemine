"use client"

import type { ReactNode } from "react"
import { usePathname } from "@/i18n/navigation"

/*
  TUB-1 Visual Port: dashboard ships its own app-shell chrome (topbar +
  sidebar), so the public SiteHeader is suppressed on every /dashboard
  route. The root LocaleLayout always renders <SiteHeader /> wrapped in
  this gate, so SiteHeader still runs as a server component, but its
  output is dropped on the client when the active path is /dashboard.
  Other routes (landing, pricing, login, etc.) keep their existing
  public header unchanged. Uses the locale-aware pathname helper from
  next-intl, which strips the /<locale> prefix before matching.
*/
export function SiteHeaderGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/")
  if (isDashboard) return null
  return <>{children}</>
}
