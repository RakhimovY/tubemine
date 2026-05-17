"use client"

import Link from "next/link"
import { useEffect } from "react"
import { Download, LogIn } from "lucide-react"
import { track } from "@vercel/analytics"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button"

export function CsvGate({
  isSignedIn,
  onDownload,
  videoId,
}: {
  isSignedIn: boolean
  onDownload: () => void
  videoId?: string
}) {
  useEffect(() => {
    if (!isSignedIn) {
      track("csv_signin_gate_shown", { videoId: videoId ?? "unknown" })
    }
  }, [isSignedIn, videoId])

  if (isSignedIn) {
    return (
      <Button onClick={onDownload} size="sm">
        <Download className="size-4" />
        Download CSV
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
