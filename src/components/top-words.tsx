"use client"

import { useMemo } from "react"
import { Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { topWordsFromComments } from "@/lib/top-words"
import { formatNumber } from "@/lib/format"
import type { Comment } from "@/lib/types"

export function TopWordsPanel({ comments }: { comments: Comment[] }) {
  const words = useMemo(
    () => topWordsFromComments(comments.map((c) => c.text), 20),
    [comments],
  )

  if (words.length === 0) return null

  const max = words[0].count

  return (
    <Card className="mt-6 border-border/60">
      <CardContent className="flex flex-col gap-4 p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-foreground/70" />
          <h2 className="text-sm font-medium">Top words</h2>
          <span className="text-xs text-muted-foreground">
            across {formatNumber(comments.length)} comments
          </span>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {words.map(({ word, count }) => {
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
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Frequency-based, after stripping common stopwords, URLs, and mentions.
          Multi-language aware. Use this to spot recurring themes at a glance.
        </p>
      </CardContent>
    </Card>
  )
}
