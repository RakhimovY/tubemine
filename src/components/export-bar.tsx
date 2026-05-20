"use client"

import { Download } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
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

  // Phase K + TUB-1 Phase 1: anon and free tiers share the same single CSV button.
  // Papa.unparse runs client-side, so no backend gate needed. Sign-in interstitial removed.
  if (tier === "anonymous" || tier === "free") {
    return (
      <Button onClick={onDownloadCsv} size="sm">
        <Download className="size-4" />
        Export CSV
      </Button>
    )
  }

  // tier === "pro"
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onDownloadCsv} size="sm">
        <Download className="size-4" />
        Export CSV
      </Button>
      <Button onClick={onDownloadJson} size="sm" variant="outline">
        <Download className="size-4" />
        {tCommon("export_json")}
      </Button>
      <Button onClick={onDownloadExcel} size="sm" variant="outline">
        <Download className="size-4" />
        {tCommon("export_excel")}
      </Button>
    </div>
  )
}
