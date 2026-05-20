"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export function DangerZone() {
  const t = useTranslations("profile")
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <div className="space-y-3 text-sm">
      <Button
        variant="destructive"
        size="sm"
        onClick={handleSignOut}
        disabled={busy}
      >
        {busy ? t("danger.sign_out_busy") : t("danger.sign_out")}
      </Button>
      <p className="text-xs text-muted-foreground">
        {t("account.delete_note")}
      </p>
    </div>
  )
}
