"use client"

import { useEffect } from "react"
import { Lock } from "lucide-react"
import { track } from "@vercel/analytics"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
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
  const tLabel = useTranslations("sentiment_label")
  const t = useTranslations("analytics.sentiment")
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
      <div className="widget" data-testid="sentiment-widget">
        <Head t={t} ru={false} count={commentsAnalyzed} />
        <div className="s-locked">
          <span className="lock-badge">
            <Lock className="size-4" aria-hidden="true" />
          </span>
          <div>{t("anon_locked_text")}</div>
          <div>
            <Link href="/login?next=/">{t("anon_locked_cta")}</Link>
          </div>
        </div>
      </div>
    )
  }

  if (!aggregate) return null
  const dist = distribution ?? deriveDistribution(aggregate)
  if (!dist) return null

  const ruExperimental = aggregate.ruShare >= 0.25
  const summary = tLabel(qualitativeSummary(dist))
  const pct = (n: number) => Math.round(n * 100)

  if (tier === "free") {
    return (
      <div className="widget" data-testid="sentiment-widget">
        <Head t={t} ru={ruExperimental} count={aggregate.sampleSize} />
        <div className="widget-body">
          <div className="s-bar h14" role="img" aria-label={t("free_bar_aria")}>
            {aggregate.positive > 0 && <span className="pos" style={{ width: `${dist.positive * 100}%` }} />}
            {aggregate.neutral > 0 && <span className="neu" style={{ width: `${dist.neutral * 100}%` }} />}
            {aggregate.negative > 0 && <span className="neg" style={{ width: `${dist.negative * 100}%` }} />}
          </div>
          <div className="s-label">
            <span className="dot" /> {summary}
          </div>
        </div>
        <div className="tier-cta widget-foot">
          <Lock className="size-3" aria-hidden="true" />
          <Link href="/pricing">{t("upgrade_cta")}</Link>
        </div>
      </div>
    )
  }

  // pro
  return (
    <div className="widget" data-testid="sentiment-widget">
      <Head t={t} ru={ruExperimental} count={aggregate.sampleSize} />
      <div className="widget-body">
        <div
          className="s-bar h22"
          role="img"
          aria-label={t("pro_bar_aria", { pos: pct(dist.positive), neu: pct(dist.neutral), neg: pct(dist.negative) })}
        >
          {aggregate.positive > 0 && (
            <span className="pos" style={{ width: `${dist.positive * 100}%` }}>
              {pct(dist.positive) >= 8 ? <i>{pct(dist.positive)}%</i> : null}
            </span>
          )}
          {aggregate.neutral > 0 && (
            <span className="neu" style={{ width: `${dist.neutral * 100}%` }}>
              {pct(dist.neutral) >= 8 ? <i>{pct(dist.neutral)}%</i> : null}
            </span>
          )}
          {aggregate.negative > 0 && (
            <span className="neg" style={{ width: `${dist.negative * 100}%` }}>
              {pct(dist.negative) >= 8 ? <i>{pct(dist.negative)}%</i> : null}
            </span>
          )}
        </div>
        <div className="s-legend">
          <div className="row">
            <span className="ld pos" />
            <span className="lname">{t("legend_positive")}</span>
            <span className="lval">{formatNumber(aggregate.positive)}</span>
          </div>
          <div className="row">
            <span className="ld neu" />
            <span className="lname">{t("legend_neutral")}</span>
            <span className="lval">{formatNumber(aggregate.neutral)}</span>
          </div>
          <div className="row">
            <span className="ld neg" />
            <span className="lname">{t("legend_negative")}</span>
            <span className="lval">{formatNumber(aggregate.negative)}</span>
          </div>
        </div>
        <div className="s-label">
          <span className="dot" /> {summary}
        </div>
      </div>
      <div className="s-foot widget-foot">
        {t("footnote", { percent: Math.round(aggregate.coverage * 100) })}
      </div>
    </div>
  )
}

function Head({
  t,
  ru,
  count,
}: {
  t: (key: string, values?: Record<string, number | string>) => string
  ru: boolean
  count: number
}) {
  return (
    <div className="widget-head">
      <div className="widget-head-l">
        <div className="widget-title">
          {t("heading")}
          {ru ? (
            <span className="ru-pill" title={t("ru_experimental_title")}>
              <span>&#946;</span> {t("ru_experimental")}
            </span>
          ) : null}
        </div>
        <div className="widget-sub">{t("across_comments", { count })}</div>
      </div>
    </div>
  )
}
