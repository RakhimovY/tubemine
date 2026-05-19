import { listAnalyses } from "@/lib/analyses"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "@/i18n/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { getUserQuota } from "@/lib/quota"
import { HistoryClient } from "./history-client"

export const dynamic = "force-dynamic"

type Tier = "free" | "pro"

async function resolveTier(userId: string): Promise<Tier> {
  try {
    const quota = await getUserQuota(userId)
    return quota.tier
  } catch (err) {
    console.warn("[history] getUserQuota failed; defaulting to free", err)
    return "free"
  }
}

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect({ href: `/login?next=/${locale}/history`, locale })
    return null
  }

  const t = await getTranslations("history")
  const tier = await resolveTier(user.id)
  const initialLimit = tier === "pro" ? 20 : 10
  const initial = await listAnalyses(supabase, null, initialLimit)
  const subtitleKey = tier === "pro" ? "cap_label_pro" : "cap_label_free"

  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t(subtitleKey)}</p>
      <HistoryClient
        tier={tier}
        initialItems={initial.items}
        initialNextCursor={initial.nextCursor}
      />
    </main>
  )
}
