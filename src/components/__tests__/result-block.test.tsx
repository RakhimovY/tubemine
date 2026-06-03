// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ResultBlock, ResultBlockSkeleton, type ResultBlockData } from "../result-block"
import type { SentimentAggregateProp } from "../sentiment"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}))
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, number | string>) =>
    values && values.count !== undefined ? `${key}:${values.count}` : key,
}))

afterEach(() => cleanup())

const agg: SentimentAggregateProp = {
  positive: 13207, neutral: 4661, negative: 1554,
  score: 0.6, sampleSize: 19422, coverage: 0.92,
  languages: ["en"], ruShare: 0,
}
const dist = { positive: 0.68, neutral: 0.24, negative: 0.08 }

const base: ResultBlockData = {
  tier: "pro",
  commentsAnalyzed: 19422,
  videoTitle: "A very long video title that should be ellipsized in the header subline area",
  channel: "@PixelForge",
  sentiment: agg,
  distribution: dist,
  topWords: [
    { word: "tutorial", count: 847 },
    { word: "colorgradingworkflow", count: 662 },
  ],
  uniqueWordsTotal: 1284,
  topEmoji: [
    { emoji: "\u{1F525}", count: 3541, share: 0.182 },
    { emoji: "❤️", count: 2860, share: 0.147 },
  ],
  uniqueEmojiTotal: 142,
  comments: [
    { author: "@sarah_makes", text: "Great workflow video, instantly subscribed.", likes: 1240, replies: 38, publishedAt: "2026-05-30T12:00:00.000Z", sentiment: "positive" },
    { author: "@longwinded_larry_the_editor_who_writes_full_essays", text: "x".repeat(400), likes: 17, replies: 0, publishedAt: "2026-05-28T12:00:00.000Z", sentiment: "neutral" },
  ],
  onDownloadCsv: vi.fn(),
  onDownloadJson: vi.fn(),
  onDownloadExcel: vi.fn(),
}

describe("ResultBlock", () => {
  it("renders header + 3-widget grid (Sentiment, Top Words, Emoji order) + table", () => {
    const { container } = render(<ResultBlock {...base} />)
    expect(container.querySelector(".result-block")).not.toBeNull()
    expect(container.querySelector(".rb-head")).not.toBeNull()
    const widgets = container.querySelector(".rb-widgets")
    expect(widgets).not.toBeNull()
    const order = Array.from(widgets!.children).map((c) => c.getAttribute("data-testid"))
    expect(order).toEqual(["sentiment-widget", "top-words-widget", "emoji-widget"])
    expect(container.querySelector(".ctable-card table.ctable")).not.toBeNull()
  })

  it("header subline truncates: carries a title attr with the full title + channel", () => {
    const { container } = render(<ResultBlock {...base} />)
    const sub = container.querySelector(".rb-head-video")
    expect(sub).not.toBeNull()
    expect(sub!.getAttribute("title")).toContain(base.videoTitle)
    expect(sub!.getAttribute("title")).toContain("@PixelForge")
    expect(sub!.querySelector(".by")?.textContent).toContain("@PixelForge")
  })

  it("comments table has 6 columns including Sentiment, dash for zero replies", () => {
    const { container } = render(<ResultBlock {...base} />)
    const heads = Array.from(container.querySelectorAll(".ctable thead th")).map((th) => th.textContent)
    expect(heads).toEqual(["col_author", "col_comment", "col_sentiment", "col_likes", "col_replies", "col_when"])
    const zero = container.querySelector(".ctable tbody tr:last-child .col-replies .c-num.zero")
    expect(zero?.textContent).toBe("dash_placeholder")
  })

  it("each comment row renders a sentiment chip and mobile m-label hooks", () => {
    const { container } = render(<ResultBlock {...base} />)
    expect(container.querySelector(".col-sent .c-sent.pos")).not.toBeNull()
    expect(container.querySelector(".col-sent .c-sent.neu")).not.toBeNull()
    expect(container.querySelectorAll(".col-likes .m-label").length).toBe(2)
    expect(container.querySelector(".col-author .c-author")?.getAttribute("title")).toContain("@sarah_makes")
  })

  it("anon: locked sentiment + single Save CSV", () => {
    const { container } = render(<ResultBlock {...base} tier="anonymous" sentiment={null} distribution={null} />)
    expect(container.querySelector(".s-locked")).not.toBeNull()
    expect(container.querySelectorAll(".rb-exports button").length).toBe(1)
  })

  it("pro: three export buttons", () => {
    const { container } = render(<ResultBlock {...base} />)
    expect(container.querySelectorAll(".rb-exports button").length).toBe(3)
  })

  it("skeleton renders with testid + result-block container", () => {
    const { container, getByTestId } = render(<ResultBlockSkeleton />)
    expect(getByTestId("result-block-skeleton")).not.toBeNull()
    expect(container.querySelector(".result-block .rb-widgets")).not.toBeNull()
    expect(container.querySelector(".sk-ctable")).not.toBeNull()
  })
})
