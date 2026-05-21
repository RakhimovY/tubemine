"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { z } from "zod"
import Papa from "papaparse"
import { toast } from "sonner"
import { track } from "@vercel/analytics"
import { Loader2, RotateCcw, Link as LinkIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { extractVideoId, type Comment, type VideoMeta } from "@/lib/types"
import { sanitizeCommentRowForSpreadsheet } from "@/lib/csv-safe"
import type { BudgetStatus } from "@/lib/budget"
import type { WordCount } from "@/lib/top-words"
import type { EmojiCount } from "@/lib/emoji-frequency"
import { formatDateRelative, formatNumber } from "@/lib/format"
import { TopWordsPanel } from "@/components/top-words"
import {
  SentimentPanel,
  type SentimentAggregateProp,
  type SentimentDistribution,
} from "@/components/sentiment"
import { EmojiPanel } from "@/components/emoji-frequency"
import { ExportBar } from "@/components/export-bar"

export type ExtractTier = "anonymous" | "free" | "pro"

// Validation messages are intentionally short tokens; the rendered surface
// uses next-intl to translate them via `errors.<token>`. Keep tokens
// lowercase + kebab-case so they collide with no other key in messages.
const FormSchema = z.object({
  url: z
    .string()
    .min(1, "url_required")
    .refine((v) => extractVideoId(v) !== null, "url_invalid_youtube"),
})
type FormValues = z.infer<typeof FormSchema>

type ExtractResponse = {
  comments: Comment[]
  extracted: number
  tier: ExtractTier
  used: number
  remaining: number
  budget: number
  resetAt: string
  sentiment?: SentimentAggregateProp | null
  sentiment_distribution?: SentimentDistribution | null
  top_words: WordCount[]
  top_emoji: EmojiCount[]
  unique_words_total: number
  unique_emoji_total: number
}

type Analytics = {
  topWords: WordCount[]
  topEmoji: EmojiCount[]
  uniqueWordsTotal: number
  uniqueEmojiTotal: number
}

const EMPTY_ANALYTICS: Analytics = {
  topWords: [],
  topEmoji: [],
  uniqueWordsTotal: 0,
  uniqueEmojiTotal: 0,
}

export function TubeMine({ tier: initialTier }: { tier: ExtractTier }) {
  const t = useTranslations("landing.demo")
  const tEx = useTranslations("extractor")
  const [tier, setTier] = useState<ExtractTier>(initialTier)
  const [preview, setPreview] = useState<VideoMeta | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [extractLoading, setExtractLoading] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [sentiment, setSentiment] = useState<SentimentAggregateProp | null>(null)
  const [distribution, setDistribution] = useState<SentimentDistribution | null>(
    null,
  )
  const [analytics, setAnalytics] = useState<Analytics>(EMPTY_ANALYTICS)
  const [budget, setBudget] = useState<BudgetStatus | null>(null)

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(FormSchema),
    defaultValues: { url: "" },
  })

  useEffect(() => {
    fetch("/api/extract", { method: "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        setBudget(data)
        if (data.tier && data.tier !== tier) {
          setTier(data.tier as ExtractTier)
        }
      })
      .catch(() => undefined)
    // Run once on mount: server-rendered tier is the authoritative starting point;
    // we only re-sync to catch mid-session webhook flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onPreview(values: FormValues) {
    setPreviewLoading(true)
    setComments([])
    setSentiment(null)
    setDistribution(null)
    setAnalytics(EMPTY_ANALYTICS)
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: values.url }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? tEx("toast_preview_failed"))
        return
      }
      setPreview(data as VideoMeta)
      track("preview_loaded", {
        videoId: data.videoId,
        commentCount: data.commentCount,
        disabled: data.commentsDisabled ? "true" : "false",
      })
      if (data.commentsDisabled || data.commentCount === 0) {
        toast.warning(tEx("toast_comments_disabled"))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tEx("toast_network_error"))
    } finally {
      setPreviewLoading(false)
    }
  }

  async function onExtract() {
    if (!preview) return
    setExtractLoading(true)
    setComments([])
    setSentiment(null)
    setDistribution(null)
    setAnalytics(EMPTY_ANALYTICS)
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: preview.videoId,
          maxComments: budget?.remaining ?? undefined,
        }),
      })
      const data = (await res.json()) as ExtractResponse & { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? tEx("toast_analysis_failed"))
        track("extract_failed", {
          videoId: preview.videoId,
          status: res.status,
          reason: data.error ?? "unknown",
          remaining: data.remaining ?? -1,
        })
        if (typeof data.remaining === "number") {
          setBudget({
            used: data.used ?? 0,
            remaining: data.remaining,
            budget: data.budget,
            resetAt: data.resetAt,
          })
        }
        return
      }
      setComments(data.comments)
      setSentiment(data.sentiment ?? null)
      setDistribution(data.sentiment_distribution ?? null)
      setAnalytics({
        topWords: data.top_words ?? [],
        topEmoji: data.top_emoji ?? [],
        uniqueWordsTotal: data.unique_words_total ?? 0,
        uniqueEmojiTotal: data.unique_emoji_total ?? 0,
      })
      if (data.tier && data.tier !== tier) setTier(data.tier)
      setBudget({
        used: data.used,
        remaining: data.remaining,
        budget: data.budget,
        resetAt: data.resetAt,
      })
      track("extract_completed", {
        videoId: preview.videoId,
        extracted: data.extracted,
        used: data.used,
        remaining: data.remaining,
        tier: data.tier ?? "unknown",
      })
      toast.success(tEx("toast_analyzed", { count: data.extracted }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tEx("toast_network_error"))
    } finally {
      setExtractLoading(false)
    }
  }

  function reset() {
    setPreview(null)
    setComments([])
    setSentiment(null)
    setDistribution(null)
    setAnalytics(EMPTY_ANALYTICS)
    form.reset({ url: "" })
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function downloadCsv() {
    if (comments.length === 0) return
    track("csv_downloaded", {
      videoId: preview?.videoId ?? "unknown",
      count: comments.length,
      tier,
    })
    // Sanitize user-controlled string fields against spreadsheet formula
    // injection (OWASP CSV Injection) before serialization. See
    // src/lib/csv-safe.ts for rationale + test coverage.
    const safeRows = comments.map((c) =>
      sanitizeCommentRowForSpreadsheet(c, [
        "author",
        "text",
        "sentiment",
        "publishedAt",
      ]),
    )
    const csv = Papa.unparse(safeRows, {
      columns: ["author", "text", "sentiment", "likes", "replies", "publishedAt"],
    })
    const today = new Date().toISOString().slice(0, 10)
    const filename = `tubemine-${preview?.videoId ?? "unknown"}-${today}.csv`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    triggerDownload(blob, filename)
  }

  async function downloadJson() {
    if (comments.length === 0 || !preview) return
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "json",
          videoId: preview.videoId,
          videoTitle: preview.title,
          channelName: preview.channel,
          comments,
        }),
      })
      if (!res.ok) throw new Error(tEx("toast_export_failed_status", { status: res.status }))
      const blob = await res.blob()
      const today = new Date().toISOString().slice(0, 10)
      triggerDownload(blob, `tubemine-${preview.videoId}-${today}.json`)
      track("export_completed", {
        format: "json",
        videoId: preview.videoId,
        count: comments.length,
        tier,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tEx("toast_export_failed"))
    }
  }

  async function downloadExcel() {
    if (comments.length === 0 || !preview) return
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "xlsx",
          videoId: preview.videoId,
          videoTitle: preview.title,
          channelName: preview.channel,
          comments,
        }),
      })
      if (!res.ok) throw new Error(tEx("toast_export_failed_status", { status: res.status }))
      const blob = await res.blob()
      const today = new Date().toISOString().slice(0, 10)
      triggerDownload(blob, `tubemine-${preview.videoId}-${today}.xlsx`)
      track("export_completed", {
        format: "xlsx",
        videoId: preview.videoId,
        count: comments.length,
        tier,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tEx("toast_export_failed"))
    }
  }

  const extractCount = preview
    ? Math.min(preview.commentCount, budget?.remaining ?? preview.commentCount)
    : 0

  const quotaLine =
    tier === "anonymous"
      ? t("quota_anon")
      : budget
        ? t(tier === "pro" ? "quota_pro" : "quota_free", {
            remaining: formatNumber(budget.remaining),
          })
        : null

  return (
    <>
      <form
        onSubmit={form.handleSubmit(onPreview)}
        className="demo-form"
        noValidate
      >
        <div
          className="input-wrap has-prefix"
          style={{ flex: 1 }}
        >
          <span className="prefix-icon" aria-hidden="true">
            <LinkIcon className="icon icon-sm" />
          </span>
          <label htmlFor="demoUrl" className="sr-only">
            {tEx("input_label")}
          </label>
          <input
            {...form.register("url")}
            id="demoUrl"
            type="url"
            inputMode="url"
            placeholder={tEx("input_placeholder")}
            className="input"
            disabled={previewLoading || extractLoading}
            autoComplete="off"
            spellCheck={false}
            aria-label={tEx("input_label")}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text").trim()
              const isYouTube = extractVideoId(pasted) !== null
              track("paste_attempted", {
                isValidYouTube: isYouTube ? "true" : "false",
                length: pasted.length,
              })
            }}
            onFocus={(e) => {
              // iOS Safari keyboard occludes the Analyze button on 375px viewports.
              // Scroll the input to center so the button stays visible above the keyboard.
              requestAnimationFrame(() => {
                e.target.scrollIntoView({
                  block: "center",
                  behavior: "smooth",
                })
              })
            }}
          />
        </div>
        <button
          type="submit"
          className={`btn btn--primary btn-lg${previewLoading ? " is-loading" : ""}`}
          disabled={previewLoading || extractLoading}
        >
          {previewLoading ? <Loader2 className="size-4 animate-spin" /> : t("cta")}
        </button>
      </form>

      {/* Show the quota meta only for anonymous users. Authed users (free
          and pro) see their canonical Monthly usage card on /dashboard,
          so showing the same info inside the form is redundant noise. */}
      {tier === "anonymous" && quotaLine && (
        <div className="demo-quota" role="status">
          <span>{quotaLine}</span>
        </div>
      )}

      {form.formState.errors.url && (
        <p className="mt-2 text-xs text-destructive">
          {tEx(
            `errors.${form.formState.errors.url.message ?? "url_invalid_youtube"}`,
          )}
        </p>
      )}

      {previewLoading && <PreviewSkeleton />}

      {preview && !previewLoading && (
        <div className="mt-6 rounded-xl border border-border/60 bg-muted/30 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row">
            {preview.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.thumbnail}
                alt=""
                className="aspect-video w-full max-w-[180px] flex-none rounded-lg object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                {preview.title}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {preview.channel}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{tEx("preview_views", { count: preview.views })}</span>
                <span>{tEx("preview_likes", { count: preview.likes })}</span>
                <span>
                  {tEx("preview_comments", { count: preview.commentCount })}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onExtract}
              className={`btn btn--primary btn-lg${extractLoading ? " is-loading" : ""}`}
              disabled={
                extractLoading ||
                preview.commentCount === 0 ||
                preview.commentsDisabled ||
                (budget?.remaining ?? 1) === 0
              }
            >
              {extractLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {tEx("analyzing")}
                </>
              ) : (
                <>{tEx("analyze_n_comments", { count: extractCount })}</>
              )}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={extractLoading}
              className="btn btn--ghost btn-sm"
            >
              <RotateCcw className="size-3.5" />
              {tEx("try_another_url")}
            </button>
          </div>
        </div>
      )}

      {/*
        TUB-13 M24: when extraction is running (after preview, before results),
        render skeleton placeholders for the 3 analytics panels so the user
        sees structural anticipation instead of empty space. Per the
        skeleton-screens design rule: every async base block gets a skeleton
        with matching geometry (header row + bars/grid).
      */}
      {extractLoading && comments.length === 0 && preview && (
        <>
          <TopWordsSkeleton />
          <SentimentSkeleton />
          <EmojiSkeleton />
        </>
      )}

      {comments.length > 0 && (
        <>
          <TopWordsPanel
            tier={tier}
            items={analytics.topWords}
            totalUnique={analytics.uniqueWordsTotal}
            commentsAnalyzed={comments.length}
          />
          <SentimentPanel
            tier={tier}
            aggregate={sentiment}
            distribution={distribution}
            commentsAnalyzed={comments.length}
          />
          <EmojiPanel
            tier={tier}
            items={analytics.topEmoji}
            totalUnique={analytics.uniqueEmojiTotal}
          />
          <ResultsPanel
            comments={comments}
            videoTitle={preview?.title ?? ""}
            videoId={preview?.videoId}
            tier={tier}
            onDownloadCsv={downloadCsv}
            onDownloadJson={downloadJson}
            onDownloadExcel={downloadExcel}
            labels={{
              header: tEx("results_header", { count: comments.length }),
              colAuthor: tEx("col_author"),
              colComment: tEx("col_comment"),
              colLikes: tEx("col_likes"),
              colReplies: tEx("col_replies"),
              colWhen: tEx("col_when"),
              dash: tEx("dash_placeholder"),
            }}
          />
        </>
      )}
    </>
  )
}

function PreviewSkeleton() {
  return (
    <div className="mt-6 rounded-xl border border-border/60 bg-muted/30 p-4 sm:p-5">
      <div className="flex gap-4">
        <Skeleton className="aspect-video w-full max-w-[180px] flex-none rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  )
}

/*
  TUB-13 M24: skeleton placeholders for the 3 analytics panels. Geometry
  mirrors the loaded state (header row + content shape) per the skeleton
  screens design rule. Uses the shadcn <Skeleton /> primitive (shimmer
  animation via `animate-pulse` baked in).
*/
function TopWordsSkeleton() {
  return (
    <Card
      className="mt-6 border-border/60"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="top-words-skeleton"
    >
      <CardContent className="flex flex-col gap-4 p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto h-3 w-32" />
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
            >
              <Skeleton className="h-7 w-full rounded-md" />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
        <Skeleton className="h-2.5 w-3/4" />
      </CardContent>
    </Card>
  )
}

function SentimentSkeleton() {
  return (
    <Card
      className="mt-6 border-border/60"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="sentiment-skeleton"
    >
      <CardContent className="flex flex-col gap-4 p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="ml-auto h-3 w-28" />
        </div>
        <Skeleton className="h-7 w-full rounded-md" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-2.5 w-2/3" />
      </CardContent>
    </Card>
  )
}

function EmojiSkeleton() {
  return (
    <Card
      className="mt-6 border-border/60"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="emoji-skeleton"
    >
      <CardContent className="flex flex-col gap-4 p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto h-3 w-32" />
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

type ResultsPanelLabels = {
  header: string
  colAuthor: string
  colComment: string
  colLikes: string
  colReplies: string
  colWhen: string
  dash: string
}

function ResultsPanel({
  comments,
  videoTitle,
  videoId,
  tier,
  onDownloadCsv,
  onDownloadJson,
  onDownloadExcel,
  labels,
}: {
  comments: Comment[]
  videoTitle: string
  videoId?: string
  tier: ExtractTier
  onDownloadCsv: () => void
  onDownloadJson: () => void | Promise<void>
  onDownloadExcel: () => void | Promise<void>
  labels: ResultsPanelLabels
}) {
  return (
    <Card className="mt-6 border-border/60">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-6 py-4">
          <div>
            <p className="text-sm font-medium">{labels.header}</p>
            {videoTitle && (
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {videoTitle}
              </p>
            )}
          </div>
          <ExportBar
            tier={tier}
            videoId={videoId}
            onDownloadCsv={onDownloadCsv}
            onDownloadJson={onDownloadJson}
            onDownloadExcel={onDownloadExcel}
          />
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="w-[160px]">{labels.colAuthor}</TableHead>
                <TableHead>{labels.colComment}</TableHead>
                <TableHead className="w-[80px] text-right">
                  {labels.colLikes}
                </TableHead>
                <TableHead className="w-[80px] text-right">
                  {labels.colReplies}
                </TableHead>
                <TableHead className="w-[100px] text-right">
                  {labels.colWhen}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comments.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="align-top text-xs font-medium">
                    {c.author}
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    <p className="whitespace-pre-wrap break-words">{c.text}</p>
                  </TableCell>
                  <TableCell className="align-top text-right text-xs tabular-nums text-muted-foreground">
                    {formatNumber(c.likes)}
                  </TableCell>
                  <TableCell className="align-top text-right text-xs tabular-nums text-muted-foreground">
                    {c.replies > 0 ? formatNumber(c.replies) : labels.dash}
                  </TableCell>
                  <TableCell className="align-top text-right text-xs text-muted-foreground">
                    {formatDateRelative(c.publishedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
