"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function UpgradeButton() {
  const [loading, setLoading] = useState(false)

  async function onUpgrade() {
    setLoading(true)
    try {
      const res = await fetch("/api/checkout", { method: "POST" })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Could not start checkout.")
        return
      }
      window.location.href = data.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={onUpgrade} disabled={loading} size="sm">
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        "Upgrade to Pro"
      )}
    </Button>
  )
}
