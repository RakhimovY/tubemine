import { getTranslations, setRequestLocale } from "next-intl/server"

export default async function TermsPage({
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
          {t("legal_disclaimer_ru")}
        </p>
      ) : null}
      <h1>Terms of Service</h1>
      <p>
        By using TubeMine you agree to analyze YouTube public comments
        responsibly. We process data via the YouTube Data API v3 and do not
        warrant uninterrupted service.
      </p>
      <h2>Retention</h2>
      <p>
        Analysis results saved to your account are retained for 30 days from
        the date of analysis. You may delete any analysis at any time from
        your history page.
      </p>
      <h2>Billing</h2>
      <p>
        Pro plans are billed monthly via Polar. You may cancel at any time
        from the customer portal; cancellation takes effect at the end of
        the current billing period.
      </p>
      <h2>Account deletion</h2>
      <p>
        Email rakhimov.y.hh@gmail.com to request account deletion. Deletion
        cascades and removes all saved analyses + subscription records.
      </p>
    </main>
  )
}
