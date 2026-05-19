"use client"

import { Link } from "@/i18n/navigation"
import { useEffect } from "react"
import { Download, LogIn } from "lucide-react"
import { useTranslations } from "next-intl"
import { track } from "@vercel/analytics"
import { Button, buttonVariants } from "@/components/ui/button"
import type { ExtractTier } from "@/components/tubemine"

export function ExportBar({
  tier,
  videoId,
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

  useEffect(() => {
    if (tier === "anonymous") {
      track("csv_signin_gate_shown", { videoId: videoId ?? "unknown" })
    }
  }, [tier, videoId])

  if (tier === "anonymous") {
    return (
      <Link
        href="/login?redirect=/"
        onClick={() => track("csv_signin_clicked", { videoId: videoId ?? "unknown" })}
        className={buttonVariants({ size: "sm" })}
      >
        <LogIn className="size-4" />
        Sign in to export CSV
      </Link>
    )
  }

  if (tier === "free") {
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
