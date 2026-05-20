import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { buttonVariants } from "@/components/ui/button"

export const dynamic = "force-static"

export default async function OauthIntroPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("oauth_intro")

  return (
    <main className="container mx-auto px-4 py-12 max-w-md text-center">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <div className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
        {t("coming_soon_banner")}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{t("helper")}</p>
      <button
        type="button"
        disabled
        className={`${buttonVariants({ size: "lg" })} mt-6 w-full opacity-50 cursor-not-allowed`}
      >
        {t("continue_disabled")}
      </button>
      <Link
        href="/dashboard?welcome=true"
        className="mt-4 inline-block text-sm underline-offset-2 hover:underline"
      >
        {t("shared_quota_link")}
      </Link>
      <p className="mt-6">
        <Link
          href="/login"
          className="text-sm underline-offset-2 hover:underline"
        >
          {t("back_to_login")}
        </Link>
      </p>
      <ul className="mt-8 flex flex-wrap justify-center gap-3 text-[10px] font-mono text-muted-foreground">
        <li>{t("trust.scope")}</li>
        <li>{t("trust.no_write")}</li>
        <li>{t("trust.revoke")}</li>
      </ul>
    </main>
  )
}
