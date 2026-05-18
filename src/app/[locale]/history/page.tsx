import { listAnalyses } from "@/lib/analyses"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "@/i18n/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { HistoryClient } from "./history-client"

export const dynamic = "force-dynamic"

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
  const initial = await listAnalyses(supabase, null, 20)

  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <HistoryClient
        initialItems={initial.items}
        initialNextCursor={initial.nextCursor}
      />
    </main>
  )
}
