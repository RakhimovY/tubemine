// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ExportBar } from "../export-bar"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

// With the next-intl mock (key returns key), "save_csv"/"save_json"/"save_excel"
// are the literal strings rendered in tests; real EN/RU values are validated
// by check-message-parity + locale render in dev.
describe("ExportBar tier-aware rendering", () => {
  it("anon: renders single CSV control (no sign-in gate, Phase K unlock)", () => {
    render(
      <ExportBar
        tier="anonymous"
        onDownloadCsv={vi.fn()}
        onDownloadJson={vi.fn()}
        onDownloadExcel={vi.fn()}
      />,
    )
    expect(document.body.textContent).toContain("save_csv")
    expect(document.body.textContent).not.toContain("Sign in to export")
    expect(document.body.textContent).not.toContain("save_json")
    expect(document.body.textContent).not.toContain("save_excel")
  })

  it("free: renders single CSV control (no JSON, no Excel)", () => {
    render(
      <ExportBar
        tier="free"
        onDownloadCsv={vi.fn()}
        onDownloadJson={vi.fn()}
        onDownloadExcel={vi.fn()}
      />,
    )
    expect(document.body.textContent).toContain("save_csv")
    expect(document.body.textContent).not.toContain("save_json")
    expect(document.body.textContent).not.toContain("save_excel")
  })

  it("pro: renders CSV + JSON + Excel controls", () => {
    render(
      <ExportBar
        tier="pro"
        onDownloadCsv={vi.fn()}
        onDownloadJson={vi.fn()}
        onDownloadExcel={vi.fn()}
      />,
    )
    expect(document.body.textContent).toContain("save_csv")
    expect(document.body.textContent).toContain("save_json")
    expect(document.body.textContent).toContain("save_excel")
  })
})
