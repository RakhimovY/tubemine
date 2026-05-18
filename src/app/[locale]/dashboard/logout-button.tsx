"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export function LogoutButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  function onLogout() {
    setLoading(true)
    startTransition(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      // Also hit server route to clear server-side cookies.
      await fetch("/logout", { method: "POST" }).catch(() => undefined)
      router.replace("/")
      router.refresh()
    })
  }

  const busy = loading || pending
  return (
    <Button
      onClick={onLogout}
      variant="ghost"
      size="sm"
      disabled={busy}
      className="text-muted-foreground"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Sign out"}
    </Button>
  )
}
