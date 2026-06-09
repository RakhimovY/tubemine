"use client"

import type { ReactNode } from "react"
import { usePathname } from "@/i18n/navigation"

/*
  TUB-1 Visual Port: the signed-in app pages (/dashboard, /profile,
  /history) ship their own app-shell chrome (topbar + sidebar via
  <DashboardShell />), and the anonymous /login page ships its own slim
  topbar inlined into the page itself, so the public SiteHeader is
  suppressed on every such route. The root LocaleLayout always renders
  <SiteHeader /> wrapped in this gate, so SiteHeader still runs as a
  server component, but its output is dropped on the client when the
  active path is in the suppression list. Other routes (landing, pricing,
  privacy, terms, etc.) keep their existing public header unchanged.
  Uses the locale-aware pathname helper from next-intl, which strips the
  /<locale> prefix before matching.
*/
const APP_SHELL_ROUTES = [
  "/dashboard",
  "/profile",
  "/history",
  "/ai-access",
  "/login",
] as const

export function SiteHeaderGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isAppShell = APP_SHELL_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
  if (isAppShell) return null
  return <>{children}</>
}
