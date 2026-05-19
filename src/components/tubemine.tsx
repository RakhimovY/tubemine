"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { z } from "zod"
import Papa from "papaparse"
import { toast } from "sonner"
import { track } from "@vercel/analytics"
import {
  ArrowRight,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { CsvGate } from "@/components/csv-gate"

export type ExtractTier = "anonymous" | "free" | "pro"

const FormSchema = z.object({
  url: z
    .string()
    .min(1, "Paste a YouTube URL")
    .refine(
      (v) => extractVideoId(v) !== null,
      "That doesn't look like a YouTube video URL",
    ),
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
        toast.error(data.error ?? "Preview failed")
        return
      }
      setPreview(data as VideoMeta)
      track("preview_loaded", {
        videoId: data.videoId,
        commentCount: data.commentCount,
        disabled: data.commentsDisabled ? "true" : "false",
      })
      if (data.commentsDisabled || data.commentCount === 0) {
        toast.warning("Comments are disabled or empty for this video")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error")
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
        toast.error(data.error ?? "Analysis failed")
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
      toast.success(`Analyzed ${data.extracted} comments`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error")
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

  function downloadCsv() {
    if (comments.length === 0) return
    track("csv_downloaded", {
      videoId: preview?.videoId ?? "unknown",
      count: comments.length,
      tier,
    })
    const csv = Papa.unparse(comments, {
      columns: ["author", "text", "sentiment", "likes", "replies", "publishedAt"],
    })
    const slug = (preview?.title ?? "comments")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50)
    const filename = `tubemine-${slug || preview?.videoId}.csv`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const remainingLabel = budget
    ? `${formatNumber(budget.remaining)} of ${formatNumber(budget.budget)} comments left this month`
    : null

  const extractCount = preview
    ? Math.min(preview.commentCount, budget?.remaining ?? preview.commentCount)
    : 0

  return (
    <section id="demo" className="w-full max-w-3xl px-6 py-10 sm:py-16">
      <Card className="border-border/60 shadow-2xl shadow-black/5 backdrop-blur supports-[backdrop-filter]:bg-card/95">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-foreground/70" />
              <span>Analyze a video</span>
            </div>
            {remainingLabel && (
              <Badge variant="secondary" className="font-normal">
                {remainingLabel}
              </Badge>
            )}
          </div>

          <form
            onSubmit={form.handleSubmit(onPreview)}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Play className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 fill-current text-muted-foreground/60" />
              <Input
                {...form.register("url")}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text").trim()
                  const isYouTube = extractVideoId(pasted) !== null
                  track("paste_attempted", {
                    isValidYouTube: isYouTube ? "true" : "false",
                    length: pasted.length,
                  })
                }}
                type="url"
                inputMode="url"
                placeholder="https://www.youtube.com/watch?v=..."
                className="h-11 pl-9 text-sm"
                disabled={previewLoading || extractLoading}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-11 px-5"
              disabled={previewLoading || extractLoading}
            >
              {previewLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  Analyze <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>
          {form.formState.errors.url && (
            <p className="mt-2 text-xs text-destructive">
              {form.formState.errors.url.message}
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
                    <span>{formatNumber(preview.views)} views</span>
                    <span>{formatNumber(preview.likes)} likes</span>
                    <span>
                      {formatNumber(preview.commentCount)} comments
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  onClick={onExtract}
                  size="lg"
                  className="h-11"
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
                      Analyzing...
                    </>
                  ) : (
                    <>
                      Analyze {formatNumber(extractCount)} comments
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  disabled={extractLoading}
                  className="text-muted-foreground"
                >
                  <RotateCcw className="size-3.5" />
                  Try another URL
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
            onDownload={downloadCsv}
          />
        </>
      )}
    </section>
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

function ResultsPanel({
  comments,
  videoTitle,
  videoId,
  tier,
  onDownload,
}: {
  comments: Comment[]
  videoTitle: string
  videoId?: string
  tier: ExtractTier
  onDownload: () => void
}) {
  return (
    <Card className="mt-6 border-border/60">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-6 py-4">
          <div>
            <p className="text-sm font-medium">
              {comments.length.toLocaleString("en-US")} comments analyzed
            </p>
            {videoTitle && (
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {videoTitle}
              </p>
            )}
          </div>
          <CsvGate tier={tier} onDownload={onDownload} videoId={videoId} />
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="w-[160px]">Author</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead className="w-[80px] text-right">Likes</TableHead>
                <TableHead className="w-[80px] text-right">Replies</TableHead>
                <TableHead className="w-[100px] text-right">When</TableHead>
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
                    {c.replies > 0 ? formatNumber(c.replies) : "-"}
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
