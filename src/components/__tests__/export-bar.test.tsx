// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ExportBar } from "../export-bar"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

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
    expect(document.body.textContent).toContain("Export CSV")
    expect(document.body.textContent).not.toContain("Sign in to export")
    expect(document.body.textContent).not.toContain("export_json")
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
    expect(document.body.textContent).toContain("Export CSV")
    expect(document.body.textContent).not.toContain("export_json")
    expect(document.body.textContent).not.toContain("export_excel")
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
    expect(document.body.textContent).toContain("Export CSV")
    expect(document.body.textContent).toContain("export_json")
    expect(document.body.textContent).toContain("export_excel")
  })
})
