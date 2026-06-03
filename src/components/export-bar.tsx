"use client"

import { Download } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ExtractTier } from "@/components/tubemine"

export function ExportBar({
  tier,
  onDownloadCsv,
  onDownloadJson,
  onDownloadExcel,
}: {
  tier: ExtractTier
  videoId?: string
  onDownloadCsv: () => void
  onDownloadJson: () => void | Promise<void>
  onDownloadExcel: () => void | Promise<void>
}) {
  const tCommon = useTranslations("common")

  // anon + free share the single CSV control (Papa.unparse runs client-side).
  if (tier === "anonymous" || tier === "free") {
    return (
      <button type="button" onClick={onDownloadCsv} className="btn btn--primary tm-action-btn">
        <Download className="icon icon-sm" aria-hidden="true" />
        {tCommon("save_csv")}
      </button>
    )
  }

  // tier === "pro"
  return (
    <>
      <button type="button" onClick={onDownloadCsv} className="btn btn--primary tm-action-btn">
        <Download className="icon icon-sm" aria-hidden="true" />
        {tCommon("save_csv")}
      </button>
      <button type="button" onClick={() => void onDownloadJson()} className="btn btn--outline">
        <Download className="icon icon-sm" aria-hidden="true" />
        {tCommon("save_json")}
      </button>
      <button type="button" onClick={() => void onDownloadExcel()} className="btn btn--outline">
        <Download className="icon icon-sm" aria-hidden="true" />
        {tCommon("save_excel")}
      </button>
    </>
  )
}
