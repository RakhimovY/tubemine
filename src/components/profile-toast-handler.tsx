"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

/**
 * Mounts in profile/page.tsx as a client island.
 * Reads ?canceled=true from URL and fires a Sonner toast once.
 * Strips the param via router.replace so the toast does not re-fire
 * on refresh or back-nav.
 */
export function ProfileToastHandler({ locale }: { locale: string }) {
  const t = useTranslations("profile")
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    if (params.get("canceled") === "true") {
      toast(t("canceled_toast"))
      router.replace(`/${locale}/profile`, { scroll: false })
    }
    // Only fire once on mount; re-runs OK if params change (router.replace strips).
  }, [params, router, t, locale])

  return null
}
