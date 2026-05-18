import { getTranslations, setRequestLocale } from "next-intl/server"

export default async function PrivacyPage({
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
      <h1>Privacy Policy</h1>
      <p>
        TubeMine analyzes public YouTube comments via the YouTube Data API.
        We never store raw comment text on our servers.
      </p>
      <h2>What we store</h2>
      <p>
        We store the aggregated analysis results (sentiment percentages, top
        words, emoji frequencies) for 30 days, associated with your account.
        Raw comment text is processed in memory and never written to disk.
        After 30 days, results are automatically purged. You can delete any
        saved analysis at any time from your history page.
      </p>
      <h2>Authentication</h2>
      <p>
        We use Supabase Auth for Google sign-in. We store your email address
        and authentication tokens. We do not share these with third parties.
      </p>
      <h2>Billing</h2>
      <p>
        Payment is handled by Polar. We never see or store your card details.
      </p>
      <h2>Contact</h2>
      <p>
        Email rakhimov.y.hh@gmail.com for any privacy questions or data
        deletion requests.
      </p>
    </main>
  )
}
