// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TopWordsPanel } from "../top-words"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, number | string>) =>
    values && values.count !== undefined ? `${key}:${values.count}` : key,
}))

const words = Array.from({ length: 40 }, (_, i) => ({ word: `w${i}`, count: 100 - i }))

describe("TopWordsPanel redesign", () => {
  it("renders a .widget with a .tw-grid of .tw-row, word inside the bar", () => {
    const { container } = render(
      <TopWordsPanel tier="free" items={words.slice(0, 15)} totalUnique={1284} commentsAnalyzed={19422} />,
    )
    expect(container.querySelector(".widget")).not.toBeNull()
    expect(container.querySelector(".tw-grid")).not.toBeNull()
    const firstRow = container.querySelector(".tw-row")
    expect(firstRow?.querySelector(".tw-bar .tw-word")).not.toBeNull()
    expect(firstRow?.querySelector(".tw-count")).not.toBeNull()
  })

  it("does NOT render the methodology footnote text", () => {
    const { container } = render(
      <TopWordsPanel tier="free" items={words.slice(0, 15)} totalUnique={1284} commentsAnalyzed={19422} />,
    )
    expect(container.textContent).not.toContain("footnote")
  })

  it("pro: shows 30 rows initially and a Show all toggle when > 30", () => {
    const { container } = render(
      <TopWordsPanel tier="pro" items={words} totalUnique={1284} commentsAnalyzed={19422} />,
    )
    expect(container.querySelectorAll(".tw-row")).toHaveLength(30)
    expect(container.querySelector(".tier-cta.btnlike")).not.toBeNull()
  })

  it("anon: shows the sign-in CTA when more words remain", () => {
    const { container } = render(
      <TopWordsPanel tier="anonymous" items={words.slice(0, 5)} totalUnique={1284} commentsAnalyzed={19422} />,
    )
    expect(container.querySelectorAll(".tw-row")).toHaveLength(5)
    expect(container.querySelector(".tier-cta a")).not.toBeNull()
  })
})
