import { getTranslations, setRequestLocale } from "next-intl/server"
import type { ReactNode } from "react"
import { redirect } from "@/i18n/navigation"
import { createClient, getCachedUser } from "@/lib/supabase/server"
import { getUserQuota, type Tier } from "@/lib/quota"
import { getAnalysesCount } from "@/lib/analyses"
import { AppShell } from "@/components/app-shell"

/*
  TUB-13 M23: shared signed-in layout for /dashboard, /profile, /history.
  Renders the AppShell once at this layer so the topbar and sidebar persist
  across route transitions (no re-mount, no flicker). Auth check and the
  shared bits the shell needs (tier, initials, history count) are resolved
  here so the leaf pages can stay focused on page-specific data.

  Pages inside this group can still fetch their own auth-derived data, but
  they MUST NOT wrap themselves in another DashboardShell or AppShell.
*/
export default async function AppGroupLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) {
    redirect({ href: `/login?next=/${locale}/dashboard`, locale })
    return null
  }

  const [quota, historyCount] = await Promise.all([
    getUserQuota(user.id),
    getAnalysesCount(supabase),
  ])

  const tier: Tier = quota.tier
  const initials = buildInitials(user.email, user.user_metadata?.full_name)

  const tShell = await getTranslations("dashboard.shell")
  return (
    <AppShell
      tier={tier}
      initials={initials}
      historyCount={historyCount}
      labels={{
        brand: tShell("brand"),
        crumb: tShell("crumb"),
        openMenu: tShell("open_menu"),
        closeMenu: tShell("close_menu"),
        sidebarLabel: tShell("sidebar_label"),
        workspaceLabel: tShell("workspace_label"),
        moreLabel: tShell("more_label"),
        navHome: tShell("nav_home"),
        navHistory: tShell("nav_history"),
        navProfile: tShell("nav_profile"),
        navGithub: tShell("nav_github"),
        navDocs: tShell("nav_docs"),
        navSignOut: tShell("nav_sign_out"),
        tierBadgeFree: tShell("tier_badge_free"),
        tierBadgePro: tShell("tier_badge_pro"),
        languageLabel: tShell("language_label"),
      }}
    >
      {children}
    </AppShell>
  )
}

function buildInitials(email: string | undefined, fullName: unknown): string {
  const source =
    typeof fullName === "string" && fullName ? fullName : (email ?? "")
  const parts = source.split(/\s|@/).filter(Boolean).slice(0, 2)
  if (parts.length === 0) return "U"
  return parts.map((s) => s[0]?.toUpperCase() ?? "").join("") || "U"
}
