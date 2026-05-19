"use client"

import { Link } from "@/i18n/navigation"
import { useEffect } from "react"
import { Download, LogIn } from "lucide-react"
import { track } from "@vercel/analytics"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button"
import type { ExtractTier } from "@/components/tubemine"

export function CsvGate({
  tier,
  onDownload,
  videoId,
}: {
  tier: ExtractTier
  onDownload: () => void
  videoId?: string
}) {
  useEffect(() => {
    if (tier === "anonymous") {
      track("csv_signin_gate_shown", { videoId: videoId ?? "unknown" })
    }
  }, [tier, videoId])

  if (tier === "free" || tier === "pro") {
    return (
      <Button onClick={onDownload} size="sm">
        <Download className="size-4" />
        Export CSV
      </Button>
    )
  }

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
