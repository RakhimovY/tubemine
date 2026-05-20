// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EmojiPanel } from "../emoji-frequency"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}))
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }))

const items = [
  { emoji: "🔥", count: 100, share: 0.5 },
  { emoji: "👍", count: 50, share: 0.25 },
]

describe("EmojiPanel tier-aware percent gate (M17)", () => {
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
