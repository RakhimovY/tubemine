"use client"

import { useEffect } from "react"
import { Activity, FlaskConical, Lock } from "lucide-react"
import { track } from "@vercel/analytics"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { formatNumber } from "@/lib/format"
import type { ExtractTier } from "@/components/tubemine"
import {
  deriveDistribution,
  qualitativeSummary,
  type SentimentDistribution,
} from "@/lib/sentiment-summary"

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

export type { SentimentDistribution }

export function SentimentPanel({
  tier,
  aggregate,
  distribution,
  commentsAnalyzed,
}: {
  tier: ExtractTier
  aggregate: SentimentAggregateProp | null
  distribution: SentimentDistribution | null
  commentsAnalyzed: number
}) {
  useEffect(() => {
    if (tier === "anonymous") {
      track("sentiment_curiosity_gap_shown", { commentsAnalyzed })
      return
    }
    if (!aggregate) return
    track("sentiment_rendered", {
      tier,
      score: Number(aggregate.score.toFixed(2)),
      positive: aggregate.positive,
      negative: aggregate.negative,
      coverage: Number(aggregate.coverage.toFixed(2)),
      languages: aggregate.languages.join(","),
    })
  }, [tier, aggregate, commentsAnalyzed])

  if (tier === "anonymous") {
    if (commentsAnalyzed === 0) return null
    return (
      <Card className="mt-6 border-border/60">
        <CardContent className="flex flex-col gap-3 p-6 sm:p-7">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-foreground/70" />
            <h2 className="text-sm font-medium">Sentiment</h2>
            <span className="text-xs text-muted-foreground">
              across {formatNumber(commentsAnalyzed)} comments
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Audience sentiment analyzed.{" "}
            <Link
              href="/login?redirect=/"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign up free
            </Link>{" "}
            to see whether the room leans positive, negative, or mixed.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!aggregate) return null

  const dist =
    distribution ?? deriveDistribution(aggregate)
  if (!dist) return null

  const tLabel = useTranslations("sentiment_label")
  const ruExperimental = aggregate.ruShare >= 0.25
  const summary = tLabel(qualitativeSummary(dist))

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

        {tier === "free" ? (
          <FreeBar dist={dist} />
        ) : (
          <ProBar dist={dist} aggregate={aggregate} />
        )}

        {tier === "free" ? (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{summary}</span>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1 text-foreground/80 underline-offset-4 hover:underline"
            >
              <Lock className="size-3" />
              Upgrade for exact percentages
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Legend dotClass="bg-emerald-500/70" label="Positive" count={aggregate.positive} />
            <Legend dotClass="bg-muted-foreground/30" label="Neutral" count={aggregate.neutral} />
            <Legend dotClass="bg-rose-500/70" label="Negative" count={aggregate.negative} />
            <span className="ml-auto">{summary}</span>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Lexicon-based scoring (English + Russian), no LLM. Coverage:{" "}
          {Math.round(aggregate.coverage * 100)}% of comments matched at least
          one emotion word.
        </p>
      </CardContent>
    </Card>
  )
}

function FreeBar({ dist }: { dist: SentimentDistribution }) {
  return (
    <div
      role="img"
      aria-label="Sentiment distribution, proportional bar"
      className="flex h-7 w-full overflow-hidden rounded-md border border-border/40"
    >
      {dist.positive > 0 && (
        <div
          style={{ width: `${dist.positive * 100}%` }}
          className="bg-emerald-500/70"
        />
      )}
      {dist.neutral > 0 && (
        <div
          style={{ width: `${dist.neutral * 100}%` }}
          className="bg-muted-foreground/30"
        />
      )}
      {dist.negative > 0 && (
        <div
          style={{ width: `${dist.negative * 100}%` }}
          className="bg-rose-500/70"
        />
      )}
    </div>
  )
}

function ProBar({
  dist,
  aggregate,
}: {
  dist: SentimentDistribution
  aggregate: SentimentAggregateProp
}) {
  const pctRound = (n: number) => Math.round(n * 100)
  return (
    <div
      role="img"
      aria-label={`${pctRound(dist.positive)} percent positive, ${pctRound(dist.neutral)} percent neutral, ${pctRound(dist.negative)} percent negative`}
      className="flex h-7 w-full overflow-hidden rounded-md border border-border/40"
    >
      {aggregate.positive > 0 && (
        <Segment
          widthPct={dist.positive * 100}
          className="bg-emerald-500/70"
          label={`${pctRound(dist.positive)}%`}
        />
      )}
      {aggregate.neutral > 0 && (
        <Segment
          widthPct={dist.neutral * 100}
          className="bg-muted-foreground/30"
          label={`${pctRound(dist.neutral)}%`}
        />
      )}
      {aggregate.negative > 0 && (
        <Segment
          widthPct={dist.negative * 100}
          className="bg-rose-500/70"
          label={`${pctRound(dist.negative)}%`}
        />
      )}
    </div>
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

