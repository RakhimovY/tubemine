export type SentimentDistribution = {
  positive: number
  neutral: number
  negative: number
}

/**
 * Convert an aggregate (positive/neutral/negative counts) into a normalized
 * 0-1 distribution. Returns null when total === 0 (caller hides the label).
 *
 * Accepts any object with the three count fields, including the full
 * SentimentAggregate from @/lib/sentiment (structural typing).
 */
export function deriveDistribution(
  agg: { positive: number; neutral: number; negative: number } | null,
): SentimentDistribution | null {
  if (!agg) return null
  const total = agg.positive + agg.neutral + agg.negative
  if (total === 0) return null
  return {
    positive: agg.positive / total,
    neutral: agg.neutral / total,
    negative: agg.negative / total,
  }
}

export type SentimentLabelKey =
  | "mostly_positive"
  | "leans_positive"
  | "mixed"
  | "leans_negative"
  | "mostly_negative"
  | "polarized"
  | "mostly_neutral"

/**
 * Coarse qualitative label key for a distribution. Consumers translate via
 * next-intl `t("sentiment_label." + key)`. Shown on Free-tier surfaces
 * where the exact percent is paywalled.
 */
export function qualitativeSummary(dist: SentimentDistribution): SentimentLabelKey {
  const { positive: pos, negative: neg, neutral: neu } = dist
  if (neu >= 0.99) return "mixed"
  if (pos >= 0.3 && neg >= 0.3) return "polarized"
  if (pos >= 0.6) return "mostly_positive"
  if (neg >= 0.6) return "mostly_negative"
  if (pos > neg) return "leans_positive"
  if (neg > pos) return "leans_negative"
  return "mostly_neutral"
}

/**
 * Argmax over positive/neutral/negative with tie-break order positive >
 * neutral > negative (per spec locked decision). pct is Math.round'd.
 * Caller decides how to render (translate, format) — see proSentimentLabel
 * for the legacy EN-only formatter or use tSent("pro_<key>", {pct}) for i18n.
 */
export function proSentimentDominant(dist: SentimentDistribution): {
  key: "positive" | "neutral" | "negative"
  pct: number
} {
  let key: "positive" | "neutral" | "negative" = "positive"
  let bestVal = dist.positive
  if (dist.neutral > bestVal) {
    key = "neutral"
    bestVal = dist.neutral
  }
  if (dist.negative > bestVal) {
    key = "negative"
    bestVal = dist.negative
  }
  return { key, pct: Math.round(bestVal * 100) }
}

/**
 * Legacy EN-only "{pct}% {dominant}" label. Kept for back-compat with
 * existing tests; new code should use proSentimentDominant + tSent for
 * locale-correct rendering.
 */
export function proSentimentLabel(dist: SentimentDistribution): string {
  const { key, pct } = proSentimentDominant(dist)
  return `${pct}% ${key}`
}
