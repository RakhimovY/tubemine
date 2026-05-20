"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Copy, Check } from "lucide-react"

export function AccountFields({
  avatarUrl,
  email,
  joinedAt,
  accountId,
  locale,
}: {
  avatarUrl: string | null
  email: string
  joinedAt: string
  accountId: string
  locale: string
}) {
  const t = useTranslations("profile.account")
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(accountId)
    } catch {
      const ta = document.createElement("textarea")
      ta.value = accountId
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand("copy")
      } catch {}
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const dateLabel = new Date(joinedAt).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="size-10 rounded-full"
          />
        ) : (
          <div className="size-10 rounded-full bg-accent" />
        )}
        <p>{email}</p>
      </div>
      <p className="text-muted-foreground">
        {t("joined")}: {dateLabel}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">{t("account_id")}:</span>
        <code className="text-xs bg-muted/50 px-2 py-1 rounded font-mono">
          {accountId}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={t("copy")}
          className="text-xs underline-offset-2 hover:underline inline-flex items-center gap-1"
        >
          {copied ? (
            <>
              <Check className="size-3" />
              {t("copied")}
            </>
          ) : (
            <>
              <Copy className="size-3" />
              {t("copy")}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
