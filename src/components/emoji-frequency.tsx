"use client"

import { useEffect, useMemo } from "react"
import { Smile } from "lucide-react"
import { track } from "@vercel/analytics"
import { Card, CardContent } from "@/components/ui/card"
import {
  topEmojisFromComments,
  emojiName,
  type EmojiCount,
} from "@/lib/emoji-frequency"
import type { Comment } from "@/lib/types"
import { formatNumber } from "@/lib/format"

export function EmojiPanel({ comments }: { comments: Comment[] }) {
  const top = useMemo<EmojiCount[]>(
    () => topEmojisFromComments(comments.map((c) => c.text), 10),
    [comments],
  )

  useEffect(() => {
    if (top.length === 0) return
    track("emoji_rendered", {
      uniqueCount: top.length,
      totalCount: top.reduce((sum, e) => sum + e.count, 0),
    })
  }, [top])

  if (top.length === 0) return null

  return (
    <Card className="mt-6 border-border/60">
      <CardContent className="flex flex-col gap-4 p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <Smile className="size-4 text-foreground/70" />
          <h2 className="text-sm font-medium">Top emojis</h2>
          <span className="text-xs text-muted-foreground">
            how your audience reacts
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {top.map(({ emoji, count, share }) => (
            <div
              key={emoji}
              role="img"
              aria-label={`${emojiName(emoji)}, ${count} occurrences (${Math.round(share * 100)} percent)`}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border/40 bg-muted/40 px-2 py-3"
            >
              <span className="text-2xl leading-none">{emoji}</span>
              <span className="text-xs font-medium tabular-nums">
                {formatNumber(count)}
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {Math.round(share * 100)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
