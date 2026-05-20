"use client"

import { useEffect } from "react"
import { Lock, Smile } from "lucide-react"
import { track } from "@vercel/analytics"
import { Link } from "@/i18n/navigation"
import { Card, CardContent } from "@/components/ui/card"
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
  const cta = upgradeCta(tier, remaining)

  return (
    <Card className="mt-6 border-border/60">
      <CardContent className="flex flex-col gap-4 p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Smile className="size-4 text-foreground/70" />
          <h2 className="text-sm font-medium">Top emojis</h2>
          <span className="text-xs text-muted-foreground">
            how your audience reacts
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {formatNumber(totalUnique)} unique, top {formatNumber(items.length)}{" "}
            shown
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {items.map(({ emoji, count, share }) => (
            <div
              key={emoji}
              role="img"
              aria-label={
                tier === "pro"
                  ? `${emojiName(emoji)}, ${count} occurrences (${Math.round(share * 100)} percent)`
                  : `${emojiName(emoji)}, ${count} occurrences`
              }
              className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border/40 bg-muted/40 px-2 py-3"
            >
              <span className="text-2xl leading-none">{emoji}</span>
              <span className="text-xs font-medium tabular-nums">
                {formatNumber(count)}
              </span>
              {tier === "pro" && (
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {Math.round(share * 100)}%
                </span>
              )}
            </div>
          ))}
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
      </CardContent>
    </Card>
  )
}

function upgradeCta(
  tier: ExtractTier,
  remaining: number,
): { href: string; label: string } | null {
  if (remaining <= 0) return null
  if (tier === "anonymous") {
    return {
      href: "/login?next=/",
      label: `${formatNumber(remaining)} more emojis available with a free account`,
    }
  }
  if (tier === "free") {
    return {
      href: "/pricing",
      label: `${formatNumber(remaining)} more emojis available in Pro`,
    }
  }
  return null
}
