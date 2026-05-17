import "server-only"
import { LEXICON_EN, NEGATIONS_EN } from "./lexicon-en"
import { LEXICON_RU, NEGATIONS_RU } from "./lexicon-ru"

export type SentimentLabel = "positive" | "negative" | "neutral" | "unknown"

export type SentimentAggregate = {
  positive: number
  neutral: number
  negative: number
  score: number          // -1..+1 mean of per-comment mean valences (clamped)
  sampleSize: number
  coverage: number       // fraction of comments with >=1 lexicon match
  languages: Array<"en" | "ru">
  ruShare: number        // 0..1, fraction of matches that came from RU lexicon
}

export type CommentSentiment = {
  label: SentimentLabel
  score: number          // mean valence within the comment, clamped to [-2, +2]
  matches: number
  ruMatches: number      // matches that came from the RU lexicon
}

// Token detection: Unicode letters + apostrophes. Same shape as Top Words.
const TOKEN_SPLIT = /[^\p{L}\p{N}']+/u

// Tight 2-token window keeps "не плохо" flipping correctly without leaking
// across short clause boundaries like "не плохо, мне понравилось".
const NEG_WINDOW = 2
const POS_THRESHOLD = 0.4
const NEG_THRESHOLD = -0.4

function tokenize(raw: string): string[] {
  if (!raw) return []
  const cleaned = raw
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[@#]\S+/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .toLowerCase()
  const out: string[] = []
  for (const tok of cleaned.split(TOKEN_SPLIT)) {
    const t = tok.trim().replace(/^'+|'+$/g, "")
    if (t.length === 0 || t.length > 32) continue
    out.push(t)
  }
  return out
}

function scoreComment(raw: string): CommentSentiment {
  const tokens = tokenize(raw)
  if (tokens.length === 0) {
    return { label: "unknown", score: 0, matches: 0, ruMatches: 0 }
  }

  let sum = 0
  let matches = 0
  let ruMatches = 0

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    let valence = LEXICON_EN[tok]
    let isRu = false
    if (valence === undefined) {
      valence = LEXICON_RU[tok]
      if (valence !== undefined) isRu = true
    }
    if (valence === undefined) continue

    // Negation flip: scan up to NEG_WINDOW preceding tokens for any negation.
    let negated = false
    const start = Math.max(0, i - NEG_WINDOW)
    for (let j = i - 1; j >= start; j--) {
      const prev = tokens[j]
      if (NEGATIONS_EN.has(prev) || NEGATIONS_RU.has(prev)) {
        negated = true
        break
      }
    }

    sum += negated ? -valence : valence
    matches++
    if (isRu) ruMatches++
  }

  if (matches === 0) {
    return { label: "unknown", score: 0, matches: 0, ruMatches: 0 }
  }

  const mean = sum / matches
  // mean is in [-2, +2]; classify against thresholds on that scale.
  let label: SentimentLabel = "neutral"
  if (mean >= POS_THRESHOLD) label = "positive"
  else if (mean <= NEG_THRESHOLD) label = "negative"

  return { label, score: mean, matches, ruMatches }
}

export type SentimentResult = {
  perComment: CommentSentiment[]
  aggregate: SentimentAggregate | null
}

/**
 * Score every comment, return per-comment labels + an aggregate (or null
 * when the sample is too small / coverage too sparse to be useful).
 *
 * Pure. Server-only.
 */
export function scoreCommentsSentiment(texts: readonly string[]): SentimentResult {
  const perComment: CommentSentiment[] = []
  let positive = 0
  let neutral = 0
  let negative = 0
  let matched = 0
  let totalRuMatches = 0
  let totalMatches = 0
  let scoreSum = 0
  let scoreCount = 0

  for (const t of texts) {
    const s = scoreComment(t)
    perComment.push(s)
    if (s.matches === 0) continue
    matched++
    totalMatches += s.matches
    totalRuMatches += s.ruMatches
    scoreSum += Math.max(-2, Math.min(2, s.score))
    scoreCount++
    if (s.label === "positive") positive++
    else if (s.label === "negative") negative++
    else if (s.label === "neutral") neutral++
  }

  const sampleSize = perComment.length
  const coverage = sampleSize === 0 ? 0 : matched / sampleSize

  if (sampleSize < 25 || coverage < 0.05) {
    return { perComment, aggregate: null }
  }

  const meanScore = scoreCount === 0 ? 0 : scoreSum / scoreCount
  // Rescale [-2, +2] mean to [-1, +1] for client display.
  const scoreNormalized = Math.max(-1, Math.min(1, meanScore / 2))

  const languages: Array<"en" | "ru"> = []
  if (totalMatches - totalRuMatches > 0) languages.push("en")
  if (totalRuMatches > 0) languages.push("ru")
  const ruShare = totalMatches === 0 ? 0 : totalRuMatches / totalMatches

  return {
    perComment,
    aggregate: {
      positive,
      neutral,
      negative,
      score: scoreNormalized,
      sampleSize,
      coverage,
      languages,
      ruShare,
    },
  }
}
