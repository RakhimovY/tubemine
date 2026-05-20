import { getTranslations } from "next-intl/server"

const ROWS = [
  "monthly_comments",
  "sentiment_direction",
  "sentiment_exact",
  "top_words",
  "top_emoji",
  "export_formats",
  "saved_analyses",
] as const

const TIERS = ["anon", "free", "pro"] as const

export async function ComparisonTable() {
  const t = await getTranslations("pricing.compare_table")
  const tPricing = await getTranslations("pricing")

  return (
    <section className="mx-auto w-full" aria-labelledby="compare-heading">
      <h2
        id="compare-heading"
        className="text-center text-lg font-semibold mb-6"
      >
        {tPricing("compare_title")}
      </h2>
      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full border-collapse rounded-lg border border-border/60 overflow-hidden">
          <thead>
            <tr className="border-b border-border bg-card/50">
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                {t("feature_header")}
              </th>
              {TIERS.map((tier) => (
                <th
                  key={tier}
                  className="text-left py-3 px-4 text-sm font-medium"
                >
                  {t(`col_${tier}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row} className="border-b border-border/50 last:border-b-0">
                <td className="py-3 px-4 text-sm">{t(`row.${row}`)}</td>
                {TIERS.map((tier) => (
                  <td
                    key={tier}
                    className="py-3 px-4 text-sm text-muted-foreground"
                  >
                    {t(`row.${row}_${tier}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile compare-cards */}
      <div className="md:hidden space-y-4">
        {TIERS.map((tier) => (
          <div
            key={tier}
            className="rounded-lg border border-border/60 bg-card p-4"
          >
            <h3 className="text-base font-semibold mb-3">{t(`col_${tier}`)}</h3>
            <dl className="space-y-2 text-sm">
              {ROWS.map((row) => (
                <div key={row} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t(`row.${row}`)}</dt>
                  <dd className="text-right">{t(`row.${row}_${tier}`)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}
