"use client"

import { useEffect, useState } from "react"
import { track } from "@vercel/analytics"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useRouter } from "@/i18n/navigation"
import { TopWordsPanel } from "@/components/top-words"
import { CommentsTable } from "@/components/comments-table"
import { Button } from "@/components/ui/button"
import type { AnalysisDetailRow, TopWord, EmojiFreq } from "@/lib/analyses"
import type { SentimentAggregate } from "@/lib/sentiment"

type Tier = "free" | "pro"

export type AnalysisDetailViewProps = {
  tier: Tier
  row: AnalysisDetailRow & { has_comments: boolean }
}

export function AnalysisDetailView({ tier, row }: AnalysisDetailViewProps) {
  const t = useTranslations("history_detail")
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    track("history_analysis_opened", {
      analysis_id_prefix: row.id.slice(0, 8),
      tier,
    })
  }, [row.id, tier])

  async function download(format: "csv" | "json" | "xlsx") {
    if (!row.has_comments) return
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "cache", analysisId: row.id, format }),
      })
      if (res.status === 410) {
        toast.error(t("export_failed_legacy"))
        return
      }
      if (!res.ok) {
        toast.error(t("export_failed_transient"))
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${row.video_id}.${format === "xlsx" ? "xlsx" : format}`
      a.click()
      URL.revokeObjectURL(url)
      track("history_downloaded", {
        analysis_id_prefix: row.id.slice(0, 8),
        format,
      })
    } catch {
      toast.error(t("export_failed_transient"))
    }
  }

  async function onDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/analyses/${row.id}`, { method: "DELETE" })
      if (res.ok) {
        track("history_deleted", { analysis_id_prefix: row.id.slice(0, 8) })
        router.replace("/history")
      } else {
        toast.error(t("export_failed_transient"))
        setDeleting(false)
      }
    } catch {
      toast.error(t("export_failed_transient"))
      setDeleting(false)
    }
  }

  const sentiment = row.sentiment as SentimentAggregate | null
  const topWords = (row.top_words ?? []) as TopWord[]
  const emojis = (row.emoji_frequency ?? []) as EmojiFreq[]

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start gap-4">
        {row.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.thumbnail_url}
            alt=""
            className="h-24 w-40 rounded object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">
            {row.video_title ?? row.video_id}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {row.channel_name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("processed_at_label")}:{" "}
            {new Date(row.processed_at).toLocaleString()}
            {" · "}
            {t("expires_at_label")}:{" "}
            {new Date(row.expires_at).toLocaleDateString()}
            {" · "}
            {row.comment_count} {t("comment_count_label")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!row.has_comments}
            onClick={() => download("csv")}
          >
            {t("download_csv")}
          </Button>
          {tier === "pro" && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={!row.has_comments}
                onClick={() => download("json")}
              >
                {t("download_json")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!row.has_comments}
                onClick={() => download("xlsx")}
              >
                {t("download_excel")}
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={deleting}
          >
            {t("delete")}
          </Button>
        </div>
      </div>

      {!row.has_comments && (
        <p
          role="note"
          className="mt-3 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-900 dark:text-yellow-200"
        >
          {t("legacy_no_comments")}
        </p>
      )}

      {topWords.length > 0 && (
        <TopWordsPanel
          tier={tier}
          items={topWords.map((w) => ({ word: w.token, count: w.count }))}
          totalUnique={topWords.length}
          commentsAnalyzed={row.comment_count}
        />
      )}

      {sentiment && (
        <div className="mt-6 rounded-lg border p-6">
          <h2 className="text-sm font-medium">Sentiment</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            +{sentiment.positive} / ={sentiment.neutral} / -{sentiment.negative}
          </p>
        </div>
      )}

      {emojis.length > 0 && (
        <div className="mt-6 rounded-lg border p-6">
          <h2 className="text-sm font-medium">Emoji frequency</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {emojis.slice(0, tier === "pro" ? emojis.length : 15).map((e) => (
              <li key={e.emoji} className="text-sm">
                {e.emoji}{" "}
                <span className="text-xs text-muted-foreground">{e.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mt-8 text-sm font-medium">{t("comments_table_heading")}</h2>
      {row.has_comments && row.comments ? (
        <CommentsTable comments={row.comments} />
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("legacy_no_comments")}
        </p>
      )}
    </div>
  )
}
