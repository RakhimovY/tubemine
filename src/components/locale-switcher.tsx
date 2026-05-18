"use client"

import { useTransition } from "react"
import { useLocale } from "next-intl"
import { usePathname, useRouter } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"

export function LocaleSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    startTransition(() => {
      router.replace(pathname, { locale: next as (typeof routing.locales)[number] })
    })
  }

  return (
    <select
      aria-label="Language"
      value={locale}
      onChange={onChange}
      disabled={isPending}
      className="bg-transparent text-sm font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
    >
      {routing.locales.map((loc) => (
        <option key={loc} value={loc}>
          {loc.toUpperCase()}
        </option>
      ))}
    </select>
  )
}
