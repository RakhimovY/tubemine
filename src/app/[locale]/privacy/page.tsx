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
      <h2>Google user data we access</h2>
      <p>
        TubeMine uses the YouTube Data API v3 with the{" "}
        <code>youtube.readonly</code> scope only when you opt into Bring Your
        Own Key (BYOK) access. We never write to your YouTube account, never
        modify content, and never request any other Google scope. We request
        read-only access to public video metadata and public comment threads
        on the specific video URLs you submit, nothing else.
      </p>
      <p>
        Data we read from Google APIs is held in server memory only for the
        duration of one analysis request, then discarded. Aggregated results
        (sentiment percentages, top words, emoji counts) are saved to your
        TubeMine account for 30 days as described above. We do not share
        Google user data with any third party, do not use it to train any
        model, and do not use it for any purpose other than fulfilling your
        analysis request.
      </p>
      <p>
        You can revoke TubeMine&apos;s access to your Google account any time
        at{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
        >
          myaccount.google.com/permissions
        </a>
        . Revoking access immediately stops any further data access; previously
        stored aggregated results remain subject to the 30-day retention until
        you delete them or they expire.
      </p>
      <h2>Authentication</h2>
      <p>
        We use Supabase Auth for Google sign-in. We store your email address
        and authentication tokens. We do not share these with third parties.
      </p>
      <h2>Third-party sharing</h2>
      <p>
        We do not sell, rent, or share your data with any third party. Polar
        processes payments (card details handled by Polar, never seen by us).
        Supabase stores authentication state and aggregated results. Vercel
        hosts the application and processes requests. None of these vendors
        receive Google user data beyond what is necessary to operate the
        service.
      </p>
      <h2>Billing</h2>
      <p>
        Payment is handled by Polar. We never see or store your card details.
      </p>
      <h2>Contact</h2>
      <p>
        Email <a href="mailto:hello@tubemine.tech">hello@tubemine.tech</a> for
        privacy questions, Google data handling questions, or data deletion
        requests. We respond within 5 business days.
      </p>
    </main>
  )
}
