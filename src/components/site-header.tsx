import { getTranslations } from "next-intl/server"
import { SiteHeaderClient } from "@/components/site-header-client"

const REPO_URL = "https://github.com/RakhimovY/tubemine"

/*
  TUB-1 Visual Port: SiteHeader rebuilt from design HTML's <nav> block.
  Server component fetches locale copy only. Auth state lives in the
  client island (SiteHeaderClient) per TUB-30, so this file no longer
  reads cookies() and the routes that embed it stay statically
  prerenderable.
*/

export async function SiteHeader() {
  const t = await getTranslations("landing")

  return (
    <SiteHeaderClient
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
