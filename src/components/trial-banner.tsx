import "server-only"
import NextLink from "next/link"
import { Sparkles, ArrowUpRight } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export type TrialState =
  | { kind: "active"; daysLeft: number; canceled: boolean; endsDate: string | null }
  | { kind: "today"; canceled: boolean; endsDate: string | null }
  | null

export async function loadTrialState(userId: string): Promise<TrialState> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .maybeSingle()
  if (!data || data.status !== "trialing" || !data.current_period_end) return null
  const endsAt = Date.parse(data.current_period_end)
  // Hide check wins over copy swap: if period expired, banner hidden regardless of canceled.
  if (Number.isNaN(endsAt) || endsAt <= Date.now()) return null
  const msRemaining = endsAt - Date.now()
  const canceled = data.cancel_at_period_end === true
  const endsDate = data.current_period_end
  if (msRemaining <= 86_400_000) return { kind: "today", canceled, endsDate }
  const daysLeft = Math.ceil(msRemaining / 86_400_000)
  return { kind: "active", daysLeft, canceled, endsDate }
}

export async function TrialBanner({
  userId,
  locale,
}: {
  userId: string
  locale?: string
}) {
  const state = await loadTrialState(userId)
  if (!state) return null
  const t = await getTranslations("dashboard")
  const dateLabel = state.endsDate
    ? new Date(state.endsDate).toLocaleDateString(locale ?? "en", {
        month: "short",
        day: "numeric",
      })
    : ""
  let text: string
  if (state.kind === "today") {
    text = state.canceled
      ? t("trial_banner_today_canceled", { date: dateLabel })
      : t("trial_banner_today")
  } else {
    text = state.canceled
      ? t("trial_banner_text_canceled", {
          days: state.daysLeft,
          date: dateLabel,
        })
      : t("trial_banner_text", { days: state.daysLeft })
  }
  return (
    <Card className="border-amber-500/30 bg-amber-500/[0.04]">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <Sparkles className="size-5 text-amber-600" />
          <p className="text-sm">{text}</p>
        </div>
        <NextLink
          href="/api/portal"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {t("trial_manage_cta")} <ArrowUpRight className="size-3.5" />
        </NextLink>
      </CardContent>
    </Card>
  )
}
