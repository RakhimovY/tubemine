import { Suspense } from "react"
import { redirect } from "next/navigation"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { createClient } from "@/lib/supabase/server"
import { safeNext } from "@/app/auth/callback/safe-next"
import { LoginClient } from "./login-client"

export const metadata = {
  title: "Sign in - TubeMine",
  description: "Sign in to TubeMine with Google. No password needed.",
}

/*
  TUB-1 Visual Port (Page 6/9): /login renders the design HTML verbatim
  (TubeMine Login.html). Anonymous-only page that opts out of the public
  SiteHeader (handled by SiteHeaderGate) and ships its own slim topbar,
  slim footer, and social row inlined into the page markup, so the
  design's CSS classes (.topbar, .stage, .login-card, .google-btn,
  .back-link, .trust-mini, .foot-social, .foot) apply unchanged.
*/

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  // Authed users do not see /login. Forward to ?next (allow-listed) or dashboard.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const sp = await searchParams
    const nextRaw = typeof sp?.next === "string" ? sp.next : null
    const safe = safeNext(nextRaw)
    redirect(safe !== "/" ? safe : `/${locale}/dashboard`)
  }

  const t = await getTranslations("login")
  return (
    <Suspense
      fallback={
        <main className="login-page" aria-busy="true">
          <div className="stage" />
        </main>
      }
    >
      <LoginClient
        labels={{
          brandAria: t("brand_aria"),
          languageLabel: t("language_label"),
          version: t("version"),
          title: t("title"),
          subtitle: t("subtitle"),
          googleButton: t("google_button"),
          googleAria: t("google_aria"),
          legalLead: t("legal_lead"),
          legalTerms: t("legal_terms"),
          legalAnd: t("legal_and"),
          legalPrivacy: t("legal_privacy"),
          backToHome: t("back_to_home"),
          trustOAuth: t("trust_oauth"),
          trustNoPassword: t("trust_no_password"),
          trustOpenSource: t("trust_open_source"),
          socialLabel: t("social_label"),
          githubAria: t("github_aria"),
          xAria: t("x_aria"),
          linkedinAria: t("linkedin_aria"),
          devtoAria: t("devto_aria"),
          threadsAria: t("threads_aria"),
          instagramAria: t("instagram_aria"),
          telegramAria: t("telegram_aria"),
          redditAria: t("reddit_aria"),
          footerCopyright: t("footer_copyright"),
          footerPrivacy: t("footer_privacy"),
          footerTerms: t("footer_terms"),
          footerContact: t("footer_contact"),
          errorInterrupted: t("error_interrupted"),
        }}
      />
    </Suspense>
  )
}
