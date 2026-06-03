"use client"

import { useState } from "react"
import { ChevronDown, Lock, LogIn } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
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
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null

  const PRO_INITIAL_CAP = 30
  const initialCap = tier === "pro" ? PRO_INITIAL_CAP : items.length
  const displayedItems = expanded ? items : items.slice(0, initialCap)
  const hasMore = tier === "pro" && items.length > PRO_INITIAL_CAP

  const max = items[0].count
  const remaining = Math.max(0, totalUnique - items.length)
  const cta = upgradeCta(t, tier, remaining)

  return (
    <div className="widget" data-testid="top-words-widget">
      <div className="widget-head">
        <div className="widget-head-l">
          <div className="widget-title">{t("heading")}</div>
          <div className="widget-sub">{t("across_comments", { count: commentsAnalyzed })}</div>
        </div>
        <div className="widget-meta">
          {t("unique_top_shown", { total: totalUnique, shown: items.length })}
        </div>
      </div>
      <div className="widget-body">
        <div className="tw-grid">
          {displayedItems.map(({ word, count }) => {
            const pct = Math.max(8, Math.round((count / max) * 100))
            return (
              <div key={word} className="tw-row">
                <div className="tw-bar">
                  <span className="tw-fill" style={{ width: `${pct}%` }} />
                  <span className="tw-word">{word}</span>
                </div>
                <div className="tw-count">{formatNumber(count)}</div>
              </div>
            )
          })}
        </div>
      </div>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="tier-cta btnlike widget-foot"
        >
          <ChevronDown
            className="size-3"
            aria-hidden="true"
            style={{ transform: expanded ? "rotate(180deg)" : undefined }}
          />
          <span>{expanded ? t("hide") : t("show_all", { count: items.length })}</span>
        </button>
      ) : null}
      {cta ? (
        <div className="tier-cta widget-foot">
          {tier === "anonymous" ? (
            <LogIn className="size-3" aria-hidden="true" />
          ) : (
            <Lock className="size-3" aria-hidden="true" />
          )}
          <Link href={cta.href}>{cta.label}</Link>
        </div>
      ) : null}
    </div>
  )
}

function upgradeCta(
  t: (key: string, values?: Record<string, number | string>) => string,
  tier: ExtractTier,
  remaining: number,
): { href: string; label: string } | null {
  if (remaining <= 0) return null
  if (tier === "anonymous") {
    return { href: "/login?next=/", label: t("cta_anon", { count: remaining }) }
  }
  if (tier === "free") {
    return { href: "/pricing", label: t("cta_free", { count: remaining }) }
  }
  return null
}
