import { listAnalyses } from "@/lib/analyses"
import { createClient } from "@/lib/supabase/server"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import {
  deriveDistribution,
  proSentimentLabel,
  qualitativeSummary,
} from "@/lib/sentiment-summary"

type Tier = "free" | "pro"

export async function RecentAnalyses({ tier }: { tier: Tier }) {
  const t = await getTranslations("dashboard")
  const supabase = await createClient()
  const { items } = await listAnalyses(supabase, null, 5)

  if (items.length === 0) {
    return (
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">{t("recent_analyses_heading")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("recent_analyses_heading")}</h2>
        <Link
          href="/history"
          className="text-sm text-muted-foreground hover:underline"
        >
          {t("view_all")}
        </Link>
      </div>
      {tier === "pro" && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("last_100_saved")}
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {items.map((item) => {
          const dist = deriveDistribution(item.sentiment)
          return (
            <li key={item.id} className="flex items-center gap-3">
              {item.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnail_url}
                  alt=""
                  className="h-12 w-20 rounded object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {item.video_title ?? item.video_id}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.channel_name} · {item.comment_count} comments
                </p>
              </div>
              {dist ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {tier === "free" ? qualitativeSummary(dist) : proSentimentLabel(dist)}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
