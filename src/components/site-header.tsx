import { getTranslations } from "next-intl/server"
import { createClient } from "@/lib/supabase/server"
import { SiteHeaderClient } from "@/components/site-header-client"

const REPO_URL = "https://github.com/RakhimovY/tubemine"

/*
  TUB-1 Visual Port: SiteHeader rebuilt from design HTML's <nav> block.
  Server component fetches auth state (anonymous vs signed-in) and locale
  copy, then hands the markup off to a client island that owns:
    - sticky-nav scroll state (.is-scrolled)
    - mobile drawer open/close (.mobile-drawer / .mobile-drawer-backdrop)
    - locale-switcher dropdown (.locale-switcher)
  The header markup itself is shipped as plain JSX so the design's CSS
  classes (in the landing styled-jsx block + globally scoped chrome below)
  apply unchanged.
*/

type AuthState = "anonymous" | "signed-in"

async function resolveAuthState(): Promise<{
  state: AuthState
  initials: string
}> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { state: "anonymous", initials: "" }
  }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { state: "anonymous", initials: "" }
    const source =
      (user.user_metadata?.full_name as string | undefined) ??
      user.email ??
      ""
    const initials = source
      .split(/\s|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "U"
    return { state: "signed-in", initials }
  } catch {
    return { state: "anonymous", initials: "" }
  }
}

export async function SiteHeader() {
  const [{ state, initials }, t] = await Promise.all([
    resolveAuthState(),
    getTranslations("landing"),
  ])

  return (
    <SiteHeaderClient
      authState={state}
      initials={initials}
      repoUrl={REPO_URL}
      labels={{
        brand: t("header.brand"),
        features: t("header.nav_features"),
        pricing: t("header.nav_pricing"),
        docs: t("header.nav_docs"),
        changelog: t("header.nav_changelog"),
        getStarted: t("header.cta_get_started"),
        dashboard: t("header.cta_dashboard"),
        openMenu: t("header.open_menu"),
        closeMenu: t("header.close_menu"),
        languageLabel: t("header.language_label"),
        github: t("header.github_label"),
      }}
    />
  )
}
