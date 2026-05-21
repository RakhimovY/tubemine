"use client"

import { useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useTranslations } from "next-intl"
import type { StoredComment } from "@/lib/comments"

export function CommentsTable({ comments }: { comments: StoredComment[] }) {
  const t = useTranslations("history_detail")
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: comments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 8,
  })

  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("comments_table_empty")}</p>
    )
  }

  return (
    <div className="mt-4 rounded-lg border">
      <div className="hidden grid-cols-[1fr_2fr_auto_auto_auto] gap-3 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
        <span>{t("column_author")}</span>
        <span>{t("column_text")}</span>
        <span>{t("column_sentiment")}</span>
        <span>{t("column_likes")}</span>
        <span>{t("column_published")}</span>
      </div>
      <div ref={parentRef} className="h-[600px] overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const c = comments[vi.index]
            return (
              <div
                key={vi.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vi.start}px)`,
                  height: vi.size,
                }}
                className="grid grid-cols-1 gap-1 border-b px-4 py-2 sm:grid-cols-[1fr_2fr_auto_auto_auto] sm:gap-3"
              >
                <span
                  className="truncate text-xs font-medium"
                  title={c.authorName ?? ""}
                >
                  {c.authorName ?? ""}
                </span>
                <span
                  className="line-clamp-2 text-xs text-foreground/90"
                  title={c.text}
                >
                  {c.text}
                </span>
                <span className="text-xs text-muted-foreground">
                  {c.sentiment ?? "-"}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {c.likes}
                </span>
                <span className="text-xs text-muted-foreground">
                  {c.publishedAt ? new Date(c.publishedAt).toLocaleDateString() : ""}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
