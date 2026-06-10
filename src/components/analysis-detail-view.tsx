"use client"

import { useEffect, useState } from "react"
import { track } from "@vercel/analytics"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useRouter, Link } from "@/i18n/navigation"
import { ResultBlock } from "@/components/result-block"
import type { SentimentAggregateProp } from "@/components/sentiment"
import type { AnalysisDetailRow } from "@/lib/analyses"
import type { WordCount } from "@/lib/top-words"
import type { EmojiCount } from "@/lib/emoji-frequency"
import type { Comment } from "@/lib/types"

type Tier = "free" | "pro"

export type AnalysisDetailViewProps = {
  tier: Tier
  row: AnalysisDetailRow & { has_comments: boolean }
}

/*
  History detail view. Renders the SAME shared <ResultBlock> the dashboard uses
  (dense 3-up widget grid + comments table), fed from the cached analysis row.
  The only detail-specific chrome is the slim meta strip (processed / expires)
  plus a Delete control. Downloads reuse the cache-mode export endpoint.
*/
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

  const aggregate = (row.sentiment as SentimentAggregateProp | null) ?? null
  const topWords: WordCount[] = (row.top_words ?? []).map((w) => ({
    word: w.token,
    count: w.count,
  }))
  const emojisAll = row.emoji_frequency ?? []
  // Free tier sees the first 15 stored emoji (matches the dashboard cap); pro
  // sees everything stored. uniqueEmojiTotal is the full stored count so the
  // panel can surface the "top N shown" upgrade hint to free users.
  const emojiVisible = tier === "pro" ? emojisAll : emojisAll.slice(0, 15)
  const topEmoji: EmojiCount[] = emojiVisible.map((e) => ({
    emoji: e.emoji,
    count: e.count,
    share: (e.percent ?? 0) / 100,
  }))
  const comments: Comment[] = (row.comments ?? []).map((c) => ({
    author: c.authorName ?? "",
    text: c.text,
    likes: c.likes,
    replies: c.replies ?? 0,
    publishedAt: c.publishedAt ?? "",
    sentiment: c.sentiment ?? undefined,
  }))

  const processedDate = new Date(row.processed_at).toLocaleDateString(
    undefined,
    { month: "short", day: "numeric", year: "numeric" },
  )

  return (
    <div className="dashboard-page history-page">
      <div className="rb-detail-head">
        <Link href="/history" className="rb-detail-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {t("back_to_history")}
        </Link>
        <div className="rb-detail-headmeta">
          <div className="rb-detail-eyebrow">{t("saved_analysis")}</div>
          <div className="rb-detail-title">
            {row.video_title ?? row.video_id}
          </div>
        </div>
        <span className="rb-detail-date">{processedDate}</span>
        <button
          type="button"
          className="icon-only danger rb-detail-delete"
          aria-label={t("delete")}
          onClick={onDelete}
          disabled={deleting}
          title={t("delete")}
        >
          <svg
            className="icon icon-sm"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>

      {!row.has_comments && (
        <p role="note" className="detail-legacy-note">
          {t("legacy_no_comments")}
        </p>
      )}

      <ResultBlock
        tier={tier}
        commentsAnalyzed={row.comment_count}
        videoTitle={row.video_title ?? row.video_id}
        channel={row.channel_name ?? ""}
        sentiment={aggregate}
        distribution={null}
        topWords={topWords}
        uniqueWordsTotal={topWords.length}
        topEmoji={topEmoji}
        uniqueEmojiTotal={emojisAll.length}
        comments={comments}
        onDownloadCsv={() => download("csv")}
        onDownloadJson={() => download("json")}
        onDownloadExcel={() => download("xlsx")}
      />
    </div>
  )
}
