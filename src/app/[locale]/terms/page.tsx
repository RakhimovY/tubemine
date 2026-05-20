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
      <h2>Google API services use</h2>
      <p>
        TubeMine uses YouTube Data API v3 in compliance with Google&apos;s
        API Services User Data Policy, including the Limited Use requirements.
        We access public video metadata and public comment threads only on
        the videos you submit; we never request any other Google API scope.
        Your continued use of TubeMine constitutes your agreement to abide by
        the{" "}
        <a
          href="https://www.youtube.com/t/terms"
          target="_blank"
          rel="noopener noreferrer"
        >
          YouTube Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Privacy Policy
        </a>
        .
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
        Email <a href="mailto:hello@tubemine.tech">hello@tubemine.tech</a> to
        request account deletion. Deletion cascades and removes all saved
        analyses + subscription records.
      </p>
    </main>
  )
}
