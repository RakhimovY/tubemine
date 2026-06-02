// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { EmojiPanel } from "../emoji-frequency"

// Isolate each render: @testing-library/react appends to document.body and
// the repo has no global auto-cleanup, so the gate tests below (which read
// document.body.textContent) must not see a previous test's output.
afterEach(() => cleanup())

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}))
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

const items = [
  { emoji: "🔥", count: 100, share: 0.5 },
  { emoji: "👍", count: 50, share: 0.25 },
]

describe("EmojiPanel redesign + M17 percent gate", () => {
  it("renders compact .em-row rows with a bar", () => {
    const { container } = render(<EmojiPanel tier="pro" items={items} totalUnique={20} />)
    expect(container.querySelector(".widget")).not.toBeNull()
    expect(container.querySelector(".em-grid")).not.toBeNull()
    expect(container.querySelectorAll(".em-row")).toHaveLength(items.length)
    expect(container.querySelector(".em-row .em-bar")).not.toBeNull()
  })

  it("anon: hides % values from visible text", () => {
    render(<EmojiPanel tier="anonymous" items={items} totalUnique={20} />)
    expect(document.body.textContent).not.toContain("50%")
    expect(document.body.textContent).not.toContain("25%")
  })

  it("free: hides % values from visible text", () => {
    render(<EmojiPanel tier="free" items={items} totalUnique={20} />)
    expect(document.body.textContent).not.toContain("50%")
    expect(document.body.textContent).not.toContain("25%")
  })

  it("pro: shows % values in visible text", () => {
    render(<EmojiPanel tier="pro" items={items} totalUnique={20} />)
    expect(document.body.textContent).toContain("50%")
    expect(document.body.textContent).toContain("25%")
  })
})
