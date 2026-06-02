"use client"

import { useTranslations } from "next-intl"
import { formatNumber, formatDateRelative } from "@/lib/format"
import type { Comment } from "@/lib/types"
import type { WordCount } from "@/lib/top-words"
import type { EmojiCount } from "@/lib/emoji-frequency"
import {
  SentimentPanel,
  type SentimentAggregateProp,
  type SentimentDistribution,
} from "@/components/sentiment"
import { TopWordsPanel } from "@/components/top-words"
import { EmojiPanel } from "@/components/emoji-frequency"
import { ExportBar } from "@/components/export-bar"
import type { ExtractTier } from "@/components/tubemine"

export type ResultBlockData = {
  tier: ExtractTier
  commentsAnalyzed: number
  videoTitle: string
  channel: string
  sentiment: SentimentAggregateProp | null
  distribution: SentimentDistribution | null
  topWords: WordCount[]
  uniqueWordsTotal: number
  topEmoji: EmojiCount[]
  uniqueEmojiTotal: number
  comments: Comment[]
  onDownloadCsv: () => void
  onDownloadJson: () => void | Promise<void>
  onDownloadExcel: () => void | Promise<void>
}

export function ResultBlock(props: ResultBlockData) {
  const tEx = useTranslations("extractor")
  const { tier, commentsAnalyzed, videoTitle, channel } = props
  return (
    <div className="result-block">
      <div className="rb-head">
        <div className="rb-head-l">
          <div className="rb-head-title">{tEx("results_header", { count: commentsAnalyzed })}</div>
          {videoTitle ? (
            <div className="rb-head-video" title={`${videoTitle} ${channel}`.trim()}>
              {videoTitle}
              {channel ? <span className="by">{` · ${channel}`}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="rb-exports">
          <ExportBar
            tier={tier}
            onDownloadCsv={props.onDownloadCsv}
            onDownloadJson={props.onDownloadJson}
            onDownloadExcel={props.onDownloadExcel}
          />
        </div>
      </div>
      <div className="rb-widgets">
        <SentimentPanel
          tier={tier}
          aggregate={props.sentiment}
          distribution={props.distribution}
          commentsAnalyzed={commentsAnalyzed}
        />
        <TopWordsPanel
          tier={tier}
          items={props.topWords}
          totalUnique={props.uniqueWordsTotal}
          commentsAnalyzed={commentsAnalyzed}
        />
        <EmojiPanel tier={tier} items={props.topEmoji} totalUnique={props.uniqueEmojiTotal} />
      </div>
      <CommentsTable comments={props.comments} />
    </div>
  )
}

function CommentsTable({ comments }: { comments: Comment[] }) {
  const tEx = useTranslations("extractor")
  const tSent = useTranslations("analytics.sentiment")
  const dash = tEx("dash_placeholder")
  return (
    <div className="ctable-card">
      <div className="ctable-scroll">
        <table className="ctable">
          <colgroup>
            <col style={{ width: 168 }} />
            <col />
            <col style={{ width: 116 }} />
            <col style={{ width: 76 }} />
            <col style={{ width: 76 }} />
            <col style={{ width: 84 }} />
          </colgroup>
          <thead>
            <tr>
              <th>{tEx("col_author")}</th>
              <th>{tEx("col_comment")}</th>
              <th>{tEx("col_sentiment")}</th>
              <th className="num">{tEx("col_likes")}</th>
              <th className="num">{tEx("col_replies")}</th>
              <th>{tEx("col_when")}</th>
            </tr>
          </thead>
          <tbody>
            {comments.map((c, i) => (
              <tr key={i}>
                <td className="col-author">
                  <div className="c-author" title={c.author}>
                    {c.author}
                  </div>
                </td>
                <td className="col-comment">
                  <div className="c-text">{c.text}</div>
                </td>
                <td className="col-sent">
                  <SentChip sentiment={c.sentiment} tSent={tSent} dash={dash} />
                </td>
                <td className="col-likes">
                  <div className="c-num">{formatNumber(c.likes)}</div>
                  <span className="m-label">{tEx("col_likes")}</span>
                </td>
                <td className="col-replies">
                  <div className={`c-num${c.replies > 0 ? "" : " zero"}`}>
                    {c.replies > 0 ? formatNumber(c.replies) : dash}
                  </div>
                  <span className="m-label">{tEx("col_replies")}</span>
                </td>
                <td className="col-when">
                  <div className="c-when">{formatDateRelative(c.publishedAt)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SentChip({
  sentiment,
  tSent,
  dash,
}: {
  sentiment?: Comment["sentiment"]
  tSent: (key: string) => string
  dash: string
}) {
  if (sentiment === "positive") {
    return (
      <span className="c-sent pos">
        <span className="dot" />
        {tSent("legend_positive")}
      </span>
    )
  }
  if (sentiment === "negative") {
    return (
      <span className="c-sent neg">
        <span className="dot" />
        {tSent("legend_negative")}
      </span>
    )
  }
  if (sentiment === "neutral") {
    return (
      <span className="c-sent neu">
        <span className="dot" />
        {tSent("legend_neutral")}
      </span>
    )
  }
  return <span className="c-num zero">{dash}</span>
}

export function ResultBlockSkeleton() {
  const sentLineWidths = ["60%", "70%", "80%"]
  const headWidths = [50, 40, 60, 50, 60, 50]
  return (
    <div
      className="result-block"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="result-block-skeleton"
    >
      <div className="skw-head">
        <div style={{ display: "grid", gap: 8, flex: 1, maxWidth: 360 }}>
          <span className="skel sk-line" style={{ height: 16, width: "55%" }} />
          <span className="skel sk-line" style={{ height: 11, width: "80%" }} />
        </div>
        <span className="skel" style={{ width: 104, height: 34, borderRadius: 9999 }} />
      </div>
      <div className="rb-widgets">
        <div className="widget">
          <div className="widget-head">
            <div style={{ display: "grid", gap: 6, flex: 1 }}>
              <span className="skel sk-line" style={{ width: "50%" }} />
              <span className="skel sk-line" style={{ height: 10, width: "70%" }} />
            </div>
          </div>
          <span className="skel sk-line" style={{ height: 14, borderRadius: 9999 }} />
          {sentLineWidths.map((w, i) => (
            <span key={i} className="skel sk-line" style={{ width: w }} />
          ))}
        </div>
        <div className="widget">
          <div className="widget-head">
            <div style={{ display: "grid", gap: 6, flex: 1 }}>
              <span className="skel sk-line" style={{ width: "45%" }} />
              <span className="skel sk-line" style={{ height: 10, width: "70%" }} />
            </div>
          </div>
          <div className="tw-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="skel" style={{ height: 26, borderRadius: 6 }} />
            ))}
          </div>
        </div>
        <div className="widget">
          <div className="widget-head">
            <div style={{ display: "grid", gap: 6, flex: 1 }}>
              <span className="skel sk-line" style={{ width: "40%" }} />
              <span className="skel sk-line" style={{ height: 10, width: "65%" }} />
            </div>
          </div>
          <div className="em-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="skel sk-emrow" />
            ))}
          </div>
        </div>
      </div>
      <div className="sk-ctable">
        <div className="sk-ctrow sk-cthead">
          {headWidths.map((w, i) => (
            <span key={i} className="skel sk-line" style={{ width: `${w}%`, opacity: 0.6 }} />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, r) => (
          <div key={r} className="sk-ctrow">
            <span className="skel sk-line" style={{ width: "80%" }} />
            <span className="skel sk-line" style={{ width: "95%" }} />
            <span className="skel sk-line" style={{ width: "70%" }} />
            <span className="skel sk-line" style={{ width: "60%", justifySelf: "end" }} />
            <span className="skel sk-line" style={{ width: "50%", justifySelf: "end" }} />
            <span className="skel sk-line" style={{ width: "80%" }} />
          </div>
        ))}
      </div>
    </div>
  )
}
