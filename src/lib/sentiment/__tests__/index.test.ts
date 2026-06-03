import { describe, expect, it } from "vitest"
import { scoreCommentsSentiment } from "@/lib/sentiment"

/*
  Regression guard for the small-video sentiment fix. The aggregate used to be
  suppressed below 25 comments, which hid the Sentiment widget on the standard
  small test videos this project uses. The floor is now 5, with the coverage
  gate (>=1 lexicon match) doing the actual noise filtering.
*/
describe("scoreCommentsSentiment sample gating", () => {
  it("produces an aggregate for a small (5-comment) video with clear signal", () => {
    const comments = [
      "This is amazing, instantly subscribed",
      "I love this workflow, so helpful",
      "Great video, really useful tips",
      "Awesome editing, thanks for sharing",
      "what mic are you using",
    ]
    const { aggregate } = scoreCommentsSentiment(comments)
    expect(aggregate).not.toBeNull()
    expect(aggregate?.sampleSize).toBe(5)
    expect(aggregate?.positive).toBeGreaterThan(0)
  })

  it("returns null below the minimum sample floor", () => {
    const comments = ["amazing", "love it", "great", "awesome"]
    const { aggregate } = scoreCommentsSentiment(comments)
    expect(aggregate).toBeNull()
  })

  it("returns null when the sample has no lexicon signal (coverage gate)", () => {
    const comments = [
      "what camera setup is that",
      "which microphone did you use",
      "the timestamp at four minutes",
      "link to the plugin please",
      "what laptop model is this",
    ]
    const { aggregate } = scoreCommentsSentiment(comments)
    expect(aggregate).toBeNull()
  })
})
