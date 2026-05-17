"use client"

import { useEffect } from "react"
import { Activity, FlaskConical } from "lucide-react"
import { track } from "@vercel/analytics"
import { Card, CardContent } from "@/components/ui/card"
import { formatNumber } from "@/lib/format"

export type SentimentAggregateProp = {
  positive: number
  neutral: number
  negative: number
  score: number
  sampleSize: number
  coverage: number
  languages: Array<"en" | "ru">
  ruShare: number
}

export function SentimentPanel({
  aggregate,
}: {
  aggregate: SentimentAggregateProp | null
}) {
  useEffect(() => {
    if (!aggregate) return
    track("sentiment_rendered", {
      score: Number(aggregate.score.toFixed(2)),
      positive: aggregate.positive,
      negative: aggregate.negative,
      coverage: Number(aggregate.coverage.toFixed(2)),
      languages: aggregate.languages.join(","),
    })
  }, [aggregate])

  if (!aggregate) return null

  const total = aggregate.positive + aggregate.neutral + aggregate.negative
  if (total === 0) return null

  const pct = (n: number) => (n / total) * 100
  const pctRound = (n: number) => Math.round(pct(n))

  const summary = summarize(aggregate)
  const ruExperimental = aggregate.ruShare >= 0.25

  return (
    <Card className="mt-6 border-border/60">
      <CardContent className="flex flex-col gap-4 p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Activity className="size-4 text-foreground/70" />
          <h2 className="text-sm font-medium">Sentiment</h2>
          <span className="text-xs text-muted-foreground">
            across {formatNumber(aggregate.sampleSize)} comments
          </span>
          {ruExperimental ? (
            <span
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
              title="Russian lexicon coverage is approximate"
            >
              <FlaskConical className="size-3" />
              Experimental for Russian
            </span>
          ) : null}
        </div>

        <div
          role="img"
          aria-label={`${pctRound(aggregate.positive)} percent positive, ${pctRound(aggregate.neutral)} percent neutral, ${pctRound(aggregate.negative)} percent negative`}
          className="flex h-7 w-full overflow-hidden rounded-md border border-border/40"
        >
          {aggregate.positive > 0 && (
            <Segment
              widthPct={pct(aggregate.positive)}
              className="bg-emerald-500/70"
              label={`${pctRound(aggregate.positive)}%`}
            />
          )}
          {aggregate.neutral > 0 && (
            <Segment
              widthPct={pct(aggregate.neutral)}
              className="bg-muted-foreground/30"
              label={`${pctRound(aggregate.neutral)}%`}
            />
          )}
          {aggregate.negative > 0 && (
            <Segment
              widthPct={pct(aggregate.negative)}
              className="bg-rose-500/70"
              label={`${pctRound(aggregate.negative)}%`}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <Legend dotClass="bg-emerald-500/70" label="Positive" count={aggregate.positive} />
          <Legend dotClass="bg-muted-foreground/30" label="Neutral" count={aggregate.neutral} />
          <Legend dotClass="bg-rose-500/70" label="Negative" count={aggregate.negative} />
          <span className="ml-auto">{summary}</span>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Lexicon-based scoring (English + Russian), no LLM. Coverage:{" "}
          {Math.round(aggregate.coverage * 100)}% of comments matched at least
          one emotion word.
        </p>
      </CardContent>
    </Card>
  )
}

function Segment({
  widthPct,
  className,
  label,
}: {
  widthPct: number
  className: string
  label: string
}) {
  return (
    <div
      style={{ width: `${widthPct}%` }}
      className={`relative flex items-center justify-center text-[10px] font-medium text-foreground/80 ${className}`}
    >
      {widthPct >= 8 ? label : null}
    </div>
  )
}

function Legend({
  dotClass,
  label,
  count,
}: {
  dotClass: string
  label: string
  count: number
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${dotClass}`} aria-hidden="true" />
      <span>{label}</span>
      <span className="tabular-nums">{formatNumber(count)}</span>
    </span>
  )
}

function summarize(a: SentimentAggregateProp): string {
  const total = a.positive + a.neutral + a.negative
  if (total === 0) return ""
  const posShare = a.positive / total
  const negShare = a.negative / total
  if (posShare >= 0.3 && negShare >= 0.3) return "Polarized audience"
  if (posShare >= 0.6) return `Mostly positive (${Math.round(posShare * 100)}%)`
  if (negShare >= 0.6) return `Mostly negative (${Math.round(negShare * 100)}%)`
  if (posShare > negShare) return `Leans positive (${Math.round(posShare * 100)}%)`
  if (negShare > posShare) return `Leans negative (${Math.round(negShare * 100)}%)`
  return "Mostly neutral"
}
