// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SentimentPanel, type SentimentAggregateProp } from "../sentiment"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}))
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

const agg: SentimentAggregateProp = {
  positive: 13207, neutral: 4661, negative: 1554,
  score: 0.6, sampleSize: 19422, coverage: 0.92,
  languages: ["en"], ruShare: 0,
}
const dist = { positive: 0.68, neutral: 0.24, negative: 0.08 }

describe("SentimentPanel redesign", () => {
  it("anon: renders the locked teaser (no bar, no legend)", () => {
    const { container } = render(
      <SentimentPanel tier="anonymous" aggregate={null} distribution={null} commentsAnalyzed={19422} />,
    )
    expect(container.querySelector(".widget")).not.toBeNull()
    expect(container.querySelector(".s-locked")).not.toBeNull()
    expect(container.querySelector(".s-bar")).toBeNull()
    expect(container.querySelector(".s-legend")).toBeNull()
  })

  it("anon with 0 comments: renders nothing", () => {
    const { container } = render(
      <SentimentPanel tier="anonymous" aggregate={null} distribution={null} commentsAnalyzed={0} />,
    )
    expect(container.querySelector(".widget")).toBeNull()
  })

  it("free: renders the h14 bar + label, no legend", () => {
    const { container } = render(
      <SentimentPanel tier="free" aggregate={agg} distribution={dist} commentsAnalyzed={19422} />,
    )
    expect(container.querySelector(".s-bar.h14")).not.toBeNull()
    expect(container.querySelector(".s-label")).not.toBeNull()
    expect(container.querySelector(".s-legend")).toBeNull()
    expect(container.querySelector(".s-foot")).toBeNull()
  })

  it("pro: renders h22 bar with % labels + legend + foot", () => {
    const { container } = render(
      <SentimentPanel tier="pro" aggregate={agg} distribution={dist} commentsAnalyzed={19422} />,
    )
    expect(container.querySelector(".s-bar.h22")).not.toBeNull()
    expect(container.querySelector(".s-legend")).not.toBeNull()
    expect(container.querySelector(".s-foot")).not.toBeNull()
    expect(container.textContent).toContain("68%")
  })

  it("pro: shows RU pill when ruShare >= 0.25", () => {
    const { container } = render(
      <SentimentPanel tier="pro" aggregate={{ ...agg, ruShare: 0.3 }} distribution={dist} commentsAnalyzed={19422} />,
    )
    expect(container.querySelector(".ru-pill")).not.toBeNull()
  })
})
