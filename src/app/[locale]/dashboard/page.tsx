import NextLink from "next/link"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { ArrowUpRight, Sparkles, Zap } from "lucide-react"
import { Link, redirect } from "@/i18n/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getUserQuota, FREE_MONTHLY_CAP, PRO_MONTHLY_CAP } from "@/lib/quota"
import { formatNumber } from "@/lib/format"
import { RecentAnalyses } from "@/components/recent-analyses"
import { UpgradeButton } from "./upgrade-button"
import { LogoutButton } from "./logout-button"

export const metadata = {
  title: "Dashboard - TubeMine",
  description: "Your TubeMine usage and subscription.",
}

export const dynamic = "force-dynamic"

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ welcome?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const sp = await searchParams
  const showWelcome = sp?.welcome === "true"

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect({ href: `/login?next=/${locale}/dashboard`, locale })
    return null
  }

  const quota = await getUserQuota(user.id)
  const percent = Math.min(100, Math.round((quota.used / quota.cap) * 100))
  const resetDate = new Date(quota.resetAt).toLocaleDateString(
    locale === "ru" ? "ru-RU" : "en-US",
    {
      month: "short",
      day: "numeric",
    },
  )
  const t = await getTranslations("dashboard")

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 pt-24 pb-16 sm:pt-28">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      </header>

      {showWelcome && quota.tier === "pro" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4 sm:p-5">
            <Sparkles className="size-5 text-primary" />
            <p className="text-sm">
              You are on <strong>Pro</strong>. 100,000 comments per month.
              Thanks for supporting TubeMine.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-5 p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Plan</span>
              <Badge
                variant={quota.tier === "pro" ? "default" : "secondary"}
                className="capitalize"
              >
                {quota.tier}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              Resets {resetDate}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-end justify-between">
              <span className="text-sm font-medium">
                {formatNumber(quota.used)}{" "}
                <span className="text-muted-foreground">
                  / {formatNumber(quota.cap)} comments
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {percent}% used
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={
                  quota.remaining === 0
                    ? "h-full bg-destructive transition-[width]"
                    : "h-full bg-primary transition-[width]"
                }
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(quota.remaining)} comments remaining this month.
            </p>
          </div>

          <Separator />

          {quota.tier === "free" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Need more?</p>
                <p className="text-xs text-muted-foreground">
                  TubeMine Pro: {formatNumber(PRO_MONTHLY_CAP)} comments/month
                  for $19.
                </p>
              </div>
              <UpgradeButton />
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Subscription</p>
                <p className="text-xs text-muted-foreground">
                  Manage payment method, invoices, or cancel anytime.
                </p>
              </div>
              <NextLink
                href="/api/portal"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Manage subscription <ArrowUpRight className="size-3.5" />
              </NextLink>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-4 p-6 sm:p-7">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-foreground/70" />
            <h2 className="text-sm font-medium">Extract comments</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Head back to the extractor to pull comments. Your usage will
            increment as you extract.
          </p>
          <div>
            <Link
              href="/"
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              Open extractor
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4">
        <LogoutButton />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Free tier: {formatNumber(FREE_MONTHLY_CAP)} comments/month. Pro:{" "}
        {formatNumber(PRO_MONTHLY_CAP)} comments/month for $19.
      </p>

      <RecentAnalyses tier={quota.tier} />
    </main>
  )
}
