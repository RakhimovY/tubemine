"use client"

import { Lock, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { formatNumber } from "@/lib/format"
import type { WordCount } from "@/lib/top-words"
import type { ExtractTier } from "@/components/tubemine"

export function TopWordsPanel({
  tier,
  items,
  totalUnique,
  commentsAnalyzed,
}: {
  tier: ExtractTier
  items: WordCount[]
  totalUnique: number
  commentsAnalyzed: number
}) {
  const t = useTranslations("analytics.top_words")
  if (items.length === 0) return null

  const max = items[0].count
  const remaining = Math.max(0, totalUnique - items.length)
  const cta = upgradeCta(t, tier, remaining)

  return (
    <Card className="mt-6 border-border/60">
      <CardContent className="flex flex-col gap-4 p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="size-4 text-foreground/70" />
          <h2 className="text-sm font-medium">{t("heading")}</h2>
          <span className="text-xs text-muted-foreground">
            {t("across_comments", { count: commentsAnalyzed })}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {t("unique_top_shown", {
              total: totalUnique,
              shown: items.length,
            })}
          </span>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {items.map(({ word, count }) => {
            const pct = Math.max(4, Math.round((count / max) * 100))
            return (
              <div
                key={word}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
              >
                <div className="relative h-7 overflow-hidden rounded-md bg-muted/60">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/15"
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative z-10 flex h-full items-center pl-3 text-xs font-medium">
                    {word}
                  </span>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatNumber(count)}
                </span>
              </div>
            )
          })}
        </div>
        {cta ? (
          <Link
            href={cta.href}
            className="inline-flex w-fit items-center gap-1.5 text-xs text-foreground/80 underline-offset-4 hover:underline"
          >
            <Lock className="size-3" />
            {cta.label}
          </Link>
        ) : null}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t("footnote")}
        </p>
      </CardContent>
    </Card>
  )
}

function upgradeCta(
  t: (key: string, values?: Record<string, number | string>) => string,
  tier: ExtractTier,
  remaining: number,
): { href: string; label: string } | null {
  if (remaining <= 0) return null
  if (tier === "anonymous") {
    return {
      href: "/login?next=/",
      label: t("cta_anon", { count: remaining }),
    }
  }
  if (tier === "free") {
    return {
      href: "/pricing",
      label: t("cta_free", { count: remaining }),
    }
  }
  return null
}
