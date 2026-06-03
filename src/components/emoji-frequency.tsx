"use client"

import { useEffect } from "react"
import { Lock, LogIn } from "lucide-react"
import { track } from "@vercel/analytics"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { emojiName, type EmojiCount } from "@/lib/emoji-frequency"
import { formatNumber } from "@/lib/format"
import type { ExtractTier } from "@/components/tubemine"

export function EmojiPanel({
  tier,
  items,
  totalUnique,
}: {
  tier: ExtractTier
  items: EmojiCount[]
  totalUnique: number
}) {
  const t = useTranslations("analytics.emoji")
  useEffect(() => {
    if (items.length === 0) return
    track("emoji_rendered", {
      tier,
      uniqueCount: items.length,
      totalCount: items.reduce((sum, e) => sum + e.count, 0),
    })
  }, [tier, items])

  if (items.length === 0) return null

  const remaining = Math.max(0, totalUnique - items.length)
  const cta = upgradeCta(t, tier, remaining)
  const maxShare = items[0]?.share ?? 0

  return (
    <div className="widget" data-testid="emoji-widget">
      <div className="widget-head">
        <div className="widget-head-l">
          <div className="widget-title">{t("heading")}</div>
          <div className="widget-sub">{t("sub")}</div>
        </div>
        <div className="widget-meta">
          {t("unique_top_shown", { total: totalUnique, shown: items.length })}
        </div>
      </div>
      <div className="widget-body">
        <div className="em-grid">
          {items.map(({ emoji, count, share }) => {
            const barPct = maxShare > 0 ? Math.round((share / maxShare) * 100) : 0
            return (
              <div
                key={emoji}
                className="em-row"
                role="img"
                aria-label={
                  tier === "pro"
                    ? `${emojiName(emoji)}, ${count} occurrences (${Math.round(share * 100)} percent)`
                    : `${emojiName(emoji)}, ${count} occurrences`
                }
              >
                <span className="glyph">{emoji}</span>
                <span className="em-bar">
                  <span style={{ width: `${barPct}%` }} />
                </span>
                <span className="em-pct">
                  {tier === "pro" ? `${Math.round(share * 100)}%` : formatNumber(count)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
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
