import { describe, expect, it } from "vitest"
import {
  deriveDistribution,
  qualitativeSummary,
  proSentimentLabel,
  type SentimentDistribution,
} from "@/lib/sentiment-summary"

describe("deriveDistribution", () => {
  it("returns null when aggregate is null", () => {
    expect(deriveDistribution(null)).toBeNull()
  })

  it("returns null when totals sum to zero", () => {
    expect(deriveDistribution({ positive: 0, neutral: 0, negative: 0 })).toBeNull()
  })

  it("normalizes counts to 0-1", () => {
    const dist = deriveDistribution({ positive: 60, neutral: 30, negative: 10 })
    expect(dist).toEqual({ positive: 0.6, neutral: 0.3, negative: 0.1 })
  })
})

describe("qualitativeSummary returns SentimentLabelKey", () => {
  const cases: Array<[string, SentimentDistribution, string]> = [
    ["mostly_positive", { positive: 0.7, neutral: 0.2, negative: 0.1 }, "mostly_positive"],
    ["leans_positive", { positive: 0.5, neutral: 0.3, negative: 0.2 }, "leans_positive"],
    ["mixed", { positive: 0, neutral: 1, negative: 0 }, "mixed"],
    ["leans_negative", { positive: 0.2, neutral: 0.3, negative: 0.5 }, "leans_negative"],
    ["mostly_negative", { positive: 0.05, neutral: 0.25, negative: 0.7 }, "mostly_negative"],
    ["polarized", { positive: 0.4, neutral: 0.2, negative: 0.4 }, "polarized"],
    ["mostly_neutral", { positive: 0.25, neutral: 0.5, negative: 0.25 }, "mostly_neutral"],
  ]
  for (const [name, dist, expected] of cases) {
    it(`maps ${name} input to "${expected}" key`, () => {
      expect(qualitativeSummary(dist)).toBe(expected)
    })
  }

  it("tie-break: strict pos > neg returns leans_positive over mostly_neutral", () => {
    expect(qualitativeSummary({ positive: 0.2, neutral: 0.7, negative: 0.1 })).toBe("leans_positive")
  })
})

describe("proSentimentLabel", () => {
  it("returns argmax with percent", () => {
    expect(proSentimentLabel({ positive: 0.68, neutral: 0.2, negative: 0.12 })).toBe("68% positive")
  })

  it("tie-break order positive > neutral > negative", () => {
    expect(proSentimentLabel({ positive: 0.4, neutral: 0.4, negative: 0.2 })).toBe("40% positive")
  })
})
