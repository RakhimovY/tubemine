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

/**
 * Coarse qualitative label for a distribution. English-only by design;
 * shown on Free-tier surfaces where the exact percent is paywalled.
 */
export function qualitativeSummary(dist: SentimentDistribution): string {
  const { positive: pos, negative: neg, neutral: neu } = dist
  if (neu >= 0.99) return "Mixed"
  if (pos >= 0.3 && neg >= 0.3) return "Polarized audience"
  if (pos >= 0.6) return "Mostly positive"
  if (neg >= 0.6) return "Mostly negative"
  if (pos > neg) return "Leans positive"
  if (neg > pos) return "Leans negative"
  return "Mostly neutral"
}

/**
 * Exact "{pct}% {dominant}" label for Pro tier. Picks the argmax over
 * positive/neutral/negative with tie-break order positive > neutral >
 * negative (per spec locked decision). pct is Math.round'd.
 */
export function proSentimentLabel(dist: SentimentDistribution): string {
  // Tie-break order: positive > neutral > negative (strict `>` keeps earlier winner).
  let bestKey: "positive" | "neutral" | "negative" = "positive"
  let bestVal = dist.positive
  if (dist.neutral > bestVal) {
    bestKey = "neutral"
    bestVal = dist.neutral
  }
  if (dist.negative > bestVal) {
    bestKey = "negative"
    bestVal = dist.negative
  }
  return `${Math.round(bestVal * 100)}% ${bestKey}`
}
