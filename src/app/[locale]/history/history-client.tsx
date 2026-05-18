"use client"

import { useState, useTransition } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import type { AnalysisRow } from "@/lib/analyses"

type Props = {
  initialItems: AnalysisRow[]
  initialNextCursor: string | null
}

export function HistoryClient({ initialItems, initialNextCursor }: Props) {
  const t = useTranslations("history")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialNextCursor)
  const [loading, setLoading] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function loadMore() {
    if (!cursor || loading) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/analyses?cursor=${encodeURIComponent(cursor)}&limit=20`,
      )
      if (res.ok) {
        const data = (await res.json()) as {
          items: AnalysisRow[]
          nextCursor: string | null
        }
        setItems((prev) => [...prev, ...data.items])
        setCursor(data.nextCursor)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setConfirmId(null)
    const prev = items
    setItems((rows) => rows.filter((r) => r.id !== id))
    const res = await fetch(`/api/analyses/${id}`, { method: "DELETE" })
    if (!res.ok) {
      setItems(prev) // revert on error
      return
    }
    startTransition(() => router.refresh())
  }

  if (items.length === 0) {
    return <p className="mt-6 text-muted-foreground">{t("empty")}</p>
  }

  return (
    <>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border p-4">
            {item.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnail_url}
                alt=""
                className="aspect-video w-full rounded object-cover"
              />
            ) : null}
            <p className="mt-2 line-clamp-2 font-medium">
              {item.video_title ?? item.video_id}
            </p>
            <p className="text-sm text-muted-foreground">
              {item.channel_name}
            </p>
            <button
              type="button"
              onClick={() => setConfirmId(item.id)}
              className="mt-3 inline-flex min-h-11 items-center text-sm text-destructive"
              aria-label={tCommon("delete")}
            >
              {tCommon("delete")}
            </button>
          </li>
        ))}
      </ul>

      {cursor ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading || isPending}
          className="mx-auto mt-6 block min-h-11 rounded border px-4 py-2"
        >
          {loading ? tCommon("loading") : tCommon("load_more")}
        </button>
      ) : null}

      {confirmId ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setConfirmId(null)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-dialog-title" className="text-lg font-semibold">
              {t("delete_dialog_title")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("delete_dialog_body")}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="min-h-11 rounded border px-3 py-2"
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmId)}
                className="min-h-11 rounded bg-destructive px-3 py-2 text-destructive-foreground"
              >
                {tCommon("delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
