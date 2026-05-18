import { getTranslations, setRequestLocale } from "next-intl/server"

export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  return (
    <main className="container mx-auto py-8 px-4 prose dark:prose-invert">
      {locale === "ru" ? (
        <p className="not-prose mb-6 rounded border-l-4 border-yellow-500 bg-yellow-50 p-4 text-sm dark:bg-yellow-950/30">
          {t("legal_disclaimer_ru_changelog")}
        </p>
      ) : null}
      <h1>Changelog</h1>
      <p>Release notes will land here via Track A.</p>
    </main>
  )
}
