// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DemoSampleResult } from "../demo-sample-result"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}))
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, number | string>) =>
    values && values.count !== undefined ? `${key}:${values.count}` : key,
}))

describe("DemoSampleResult", () => {
  it("renders the anon result block (locked sentiment, single export, table)", () => {
    const { container } = render(<DemoSampleResult />)
    expect(container.querySelector(".result-block")).not.toBeNull()
    expect(container.querySelector(".rb-widgets")).not.toBeNull()
    expect(container.querySelector(".s-locked")).not.toBeNull()
    expect(container.querySelectorAll(".rb-exports button").length).toBe(1)
    expect(container.querySelector(".ctable-card")).not.toBeNull()
  })

  it("uses long mock strings (long author + long word) for truncation stress", () => {
    const { container } = render(<DemoSampleResult />)
    expect(container.textContent).toContain("colorgradingworkflow")
    expect(container.querySelector('[title*="longwinded_larry"]')).not.toBeNull()
  })

  it("contains no em-dash or en-dash in rendered text", () => {
    const { container } = render(<DemoSampleResult />)
    expect(container.textContent).not.toMatch(/[—–]/)
  })
})
