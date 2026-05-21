import { getTranslations, setRequestLocale } from "next-intl/server"
import { redirect } from "@/i18n/navigation"
import { createClient, getCachedUser } from "@/lib/supabase/server"
import { getUserQuota, type Tier } from "@/lib/quota"
import { listAnalyses } from "@/lib/analyses"
import { HistoryClient } from "./history-client"

export const metadata = {
  title: "History - TubeMine",
  description: "Saved analyses, searchable across every video you've analyzed.",
}

export const dynamic = "force-dynamic"

/*
  TUB-1 Visual Port (History, Page 5/9). Verbatim semantic port of:
    /tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/TubeMine History.html
  The page wrapper carries BOTH `dashboard-page` (so the shared shell CSS
  applies for free) and `history-page` (for history-specific .filter-bar,
  .history-table, .history-row, .history-cards, .pagination, .empty-state-card,
  .tm-toast-host, etc.). The inline <script> behaviors (delete confirm flow,
  overflow menu, filter clear, skeleton loading) are implemented inside the
  <HistoryClient /> client island.

  The public <SiteHeader /> is suppressed for /history by <SiteHeaderGate />.
  The "Design preview" panel from the prototype is intentionally NOT shipped.
*/
export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const user = await getCachedUser()
  if (!user) {
    redirect({ href: `/login?next=/${locale}/history`, locale })
    return null
  }

  const [quota, initial] = await Promise.all([
    getUserQuota(user.id),
    listAnalyses(supabase, null, 100),
  ])

  const tier: Tier = quota.tier
  const tHistory = await getTranslations("history")

  // Items the client island will paginate over. Free tier is capped at 10;
  // Pro tier loads up to 100 saved (last 100 per locked pricing decision).
  const cap = tier === "pro" ? 100 : 10
  const items = initial.items.slice(0, cap)
  const cursor = tier === "pro" ? initial.nextCursor : null

  const totalSaved = items.length
  const oldestProcessedAt = items[items.length - 1]?.processed_at ?? null
  const oldestDateFmt = new Intl.DateTimeFormat(
    locale === "ru" ? "ru-RU" : "en-US",
    { month: "short", day: "numeric", year: "numeric" },
  )
  const subline =
    totalSaved === 0
      ? tHistory("subline_empty")
      : oldestProcessedAt
        ? tHistory("subline_populated", {
            count: totalSaved,
            date: oldestDateFmt.format(new Date(oldestProcessedAt)),
          })
        : tHistory("subline_populated_no_date", { count: totalSaved })

  return (
    <div className="dashboard-page history-page">
        <header className="page-head">
          <h1 className="page-title">{tHistory("title")}</h1>
          <p
            className="page-subline"
            style={
              totalSaved === 0
                ? { color: "var(--color-text-tertiary)" }
                : undefined
            }
          >
            {subline}
          </p>
        </header>

        <HistoryClient
          tier={tier}
          locale={locale}
          initialItems={items}
          initialNextCursor={cursor}
        />
    </div>
  )
}
