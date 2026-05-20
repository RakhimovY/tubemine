import { getTranslations } from "next-intl/server"

interface Subscription {
  status: string
  current_period_end: string | null
  cancel_at_period_end: boolean | null
}

export async function PlanCard({
  tier,
  subscription,
  quotaUsed,
  quotaCap,
  locale,
}: {
  tier: "free" | "pro"
  subscription: Subscription | null
  quotaUsed: number
  quotaCap: number
  locale: string
}) {
  const t = await getTranslations("profile.plan")
  // Derived inline; no new schema field. Either revoked status OR cancel_at_period_end=true.
  const subscriptionCanceled =
    subscription?.status === "revoked" ||
    subscription?.cancel_at_period_end === true
  const periodEnd = subscription?.current_period_end
  const dateLabel = periodEnd
    ? new Date(periodEnd).toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
      })
    : ""
  const pct = Math.min(100, Math.round((quotaUsed / quotaCap) * 100))

  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium">
        {tier === "pro" ? t("tier_pro") : t("tier_free")}
      </p>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">
          {t("usage", { used: quotaUsed, cap: quotaCap })}
        </p>
        <div
          className="h-2 rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {periodEnd ? (
        <p className="text-muted-foreground">
          {subscriptionCanceled
            ? t("ends", { date: dateLabel })
            : t("renews", { date: dateLabel })}
        </p>
      ) : null}
    </div>
  )
}
