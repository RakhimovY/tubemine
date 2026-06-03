"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react"
// useMemo retained for stable Intl formatters; do not remove.
import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { track } from "@vercel/analytics"
import type { AnalysisRow } from "@/lib/analyses"
import {
  deriveDistribution,
  qualitativeSummary,
} from "@/lib/sentiment-summary"

type Tier = "free" | "pro"

type Props = {
  tier: Tier
  locale: string
  initialItems: AnalysisRow[]
  initialNextCursor: string | null
}

const PRO_HISTORY_CAP = 100
const PAGE_SIZE = 10

type DateRange = "all" | "7" | "30"

type ToastVariant = "success" | "warning" | "error"
type ToastAction = {
  id: string
  label: string
  variant?: "default" | "danger"
  onClick?: () => void
}
type ToastEntry = {
  id: number
  variant: ToastVariant
  title?: string
  message?: string
  actions?: ToastAction[]
  duration: number | null
}

let _toastId = 0
function nextToastId() {
  _toastId += 1
  return _toastId
}

/*
  TUB-1 Visual Port (History, Page 5/9): client island. Verbatim port of the
  populated table, mobile cards, filter bar, pagination, empty state, and
  skeleton loading sections from
    /tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/TubeMine History.html
  Wires the design markup to the existing /api/analyses + /api/analyses/[id]
  backend. View opens the YouTube watch page in a new tab. Re-analyze sends
  the user back to /dashboard. Delete uses the design's top-center
  TMToast confirm flow.
*/
export function HistoryClient({
  tier,
  locale,
  initialItems,
  initialNextCursor,
}: Props) {
  const t = useTranslations("history")
  const tLabel = useTranslations("sentiment_label")
  const router = useRouter()

  const [items, setItems] = useState<AnalysisRow[]>(initialItems)
  // Free tier discards the server cursor (cap at 10). Pro tier paginates
  // client-side over up to 100 server-fetched rows.
  const [cursor, setCursor] = useState<string | null>(
    tier === "pro" ? initialNextCursor : null,
  )
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [dateRange, setDateRange] = useState<DateRange>("all")
  // dateCutoffMs is an absolute UNIX-ms threshold recomputed whenever
  // dateRange changes (or initially), set via setState so we never call
  // Date.now() during render (react-hooks/purity).
  const [dateCutoff, setDateCutoff] = useState<number | null>(null)
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [locale],
  )
  const numberFmt = useMemo(
    () => new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US"),
    [locale],
  )

  // ===== Toast host (matches design's .tm-toast-host, top-center, ARIA polite) =====
  const showToast = useCallback((opts: Omit<ToastEntry, "id" | "duration"> & { duration?: number | null }) => {
    const entry: ToastEntry = {
      id: nextToastId(),
      variant: opts.variant,
      title: opts.title,
      message: opts.message,
      actions: opts.actions,
      duration: opts.duration === undefined ? 5000 : opts.duration,
    }
    setToasts((prev) => [...prev, entry])
    if (entry.duration && entry.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((tt) => tt.id !== entry.id))
      }, entry.duration)
    }
    return entry.id
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((tt) => tt.id !== id))
  }, [])

  // ===== Load more (Pro only, client-side fetch into items[]) =====
  const fetchMore = useCallback(async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(
        `/api/analyses?cursor=${encodeURIComponent(cursor)}&limit=20`,
      )
      if (res.ok) {
        const data = (await res.json()) as {
          items: AnalysisRow[]
          nextCursor: string | null
        }
        setItems((prev) =>
          [...prev, ...data.items].slice(0, PRO_HISTORY_CAP),
        )
        setCursor(data.nextCursor)
      }
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, loadingMore])

  // ===== Filtering =====
  // Pure render-time filter. dateCutoff is an absolute timestamp captured
  // via setState in the dateRange handler, so render itself never calls
  // Date.now() (react-hooks/purity). Date.parse on a row's processed_at
  // is a pure string -> number conversion.
  const q = search.trim().toLowerCase()
  const filteredItems = items.filter((it) => {
    if (dateCutoff !== null) {
      const at = Date.parse(it.processed_at)
      if (!Number.isFinite(at) || at < dateCutoff) return false
    }
    if (q) {
      const title = (it.video_title ?? it.video_id).toLowerCase()
      if (!title.includes(q)) return false
    }
    return true
  })

  const hasFilters = search.trim().length > 0 || dateRange !== "all"

  // ===== Pagination (client-side over filteredItems) =====
  const totalKnown = filteredItems.length
  const totalPages = Math.max(1, Math.ceil(totalKnown / PAGE_SIZE))
  // Clamp current page if the filter shrank the list below the active page.
  // Derived, not stored, so we never call setState during render.
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pageEnd = Math.min(pageStart + PAGE_SIZE, totalKnown)
  const visibleItems = filteredItems.slice(pageStart, pageEnd)

  // When the user paginates near the tail of what we've loaded, auto-fetch
  // the next page (Pro only). Free is capped at 10 server-side. We trigger
  // the fetch from the setPage handler, not in an effect, to avoid the
  // react-hooks/set-state-in-effect rule.
  const maybePrefetchMore = useCallback(
    (nextPage: number) => {
      if (tier !== "pro") return
      if (!cursor) return
      const lookahead = (nextPage - 1) * PAGE_SIZE + PAGE_SIZE
      if (lookahead >= items.length - PAGE_SIZE) {
        void fetchMore()
      }
    },
    [tier, cursor, items.length, fetchMore],
  )

  // When filters change, jump back to page 1 via handlers (search/dateRange
  // setters wrap setPage). The single source of truth for "what filter is
  // active" is search + dateRange; page is reset wherever they are set.
  function applySearch(value: string) {
    setSearch(value)
    setPage(1)
  }
  function applyDateRange(value: DateRange) {
    setDateRange(value)
    setPage(1)
    if (value === "all") {
      setDateCutoff(null)
    } else {
      const days = value === "7" ? 7 : 30
      setDateCutoff(Date.now() - days * 24 * 60 * 60 * 1000)
    }
  }
  function gotoPage(p: number) {
    const clamped = Math.max(1, Math.min(totalPages, p))
    setPage(clamped)
    maybePrefetchMore(clamped)
  }

  // ===== Delete flow =====
  const performDelete = useCallback(
    async (id: string) => {
      setRemovingIds((prev) => new Set(prev).add(id))
      // Allow the design's exit animation (240ms) to play before removal.
      await new Promise((r) => setTimeout(r, 240))
      const previous = items
      setItems((rows) => rows.filter((r) => r.id !== id))
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      const res = await fetch(`/api/analyses/${id}`, { method: "DELETE" })
      if (!res.ok) {
        setItems(previous)
        showToast({
          variant: "error",
          title: t("toast_delete_error_title"),
          message: t("toast_delete_error_message"),
        })
        return
      }
      showToast({
        variant: "success",
        title: t("toast_delete_success_title"),
        message: t("toast_delete_success_message"),
      })
      startTransition(() => router.refresh())
    },
    [items, router, showToast, t],
  )

  const askDelete = useCallback(
    (row: AnalysisRow) => {
      const title = row.video_title ?? row.video_id
      const clipped = title.length > 50 ? `${title.slice(0, 50)}...` : title
      const toastId = showToast({
        variant: "warning",
        title: t("toast_delete_confirm_title"),
        message: t("toast_delete_confirm_message", { title: clipped }),
        duration: null,
        actions: [
          { id: "cancel", label: t("toast_cancel") },
          {
            id: "confirm",
            label: t("toast_confirm_delete"),
            variant: "danger",
            onClick: () => {
              void performDelete(row.id)
            },
          },
        ],
      })
      // Capture id so action onClick can dismiss the toast itself.
      // Wrap the actions in a final pass that dismisses on click.
      setToasts((prev) =>
        prev.map((tt) =>
          tt.id === toastId
            ? {
                ...tt,
                actions: tt.actions?.map((a) => ({
                  ...a,
                  onClick: () => {
                    a.onClick?.()
                    dismissToast(toastId)
                  },
                })),
              }
            : tt,
        ),
      )
    },
    [dismissToast, performDelete, showToast, t],
  )

  // ===== Overflow menu (mobile cards) outside-click handler =====
  const cardsRootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!openMenuId) return
    function onDocClick(e: MouseEvent) {
      const root = cardsRootRef.current
      if (!root) return
      if (!root.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [openMenuId])

  function handleClearFilters() {
    applySearch("")
    applyDateRange("all")
  }

  function handleSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      applySearch("")
    }
  }

  function watchUrl(videoId: string) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
  }

  // Row-level click is a mouse convenience that opens the analysis detail page.
  // Clicks that land on a real control (action buttons, the title link, the
  // re-analyze link) are ignored so their own handlers run. Keyboard users
  // navigate via the focusable title link, which points at the same detail URL.
  function openDetailFromRow(e: ReactMouseEvent<HTMLElement>, id: string) {
    if ((e.target as HTMLElement).closest("a, button")) return
    router.push(`/history/${id}`)
  }

  async function downloadFromCache(
    row: AnalysisRow,
    format: "csv" | "json" | "xlsx",
  ) {
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "cache", analysisId: row.id, format }),
      })
      if (!res.ok) {
        showToast({
          variant: "error",
          title: t("toast_delete_error_title"),
          duration: 4000,
        })
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
      showToast({
        variant: "error",
        title: t("toast_delete_error_title"),
        duration: 4000,
      })
    }
  }

  // ===== Empty state (zero saved analyses across the account) =====
  if (items.length === 0) {
    return (
      <section className="if-empty" aria-label={t("empty_section_aria")}>
        <div className="empty-state-card">
          <span className="empty-illus" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x={2} y={4} width={20} height={16} rx={2} />
              <path d="M2 8h4M2 12h4M2 16h4M18 8h4M18 12h4M18 16h4M10 4v16M14 4v16" />
            </svg>
          </span>
          <h2>{t("empty_title")}</h2>
          <p>{t("empty_body")}</p>
          <a href={`/${locale}/dashboard`} className="btn btn--primary">
            {t("empty_cta")}
          </a>
        </div>
      </section>
    )
  }

  return (
    <>
      <ToastHost
        toasts={toasts}
        onDismiss={dismissToast}
        dismissLabel={t("toast_dismiss")}
      />

      {/* Filter bar */}
      <div
        className={hasFilters ? "filter-bar has-filters" : "filter-bar"}
        role="search"
      >
        <div className="input-wrap has-prefix">
          <span className="prefix-icon">
            <SearchIcon />
          </span>
          <label htmlFor="history-search" style={{ position: "absolute", left: -9999 }}>
            {t("search_label")}
          </label>
          <input
            id="history-search"
            className="input"
            type="search"
            placeholder={t("search_placeholder")}
            autoComplete="off"
            value={search}
            onChange={(e) => applySearch(e.target.value)}
            onKeyDown={handleSearchKey}
          />
        </div>
        <select
          aria-label={t("date_range_label")}
          value={dateRange}
          onChange={(e) => applyDateRange(e.target.value as DateRange)}
        >
          <option value="all">{t("date_range_all")}</option>
          <option value="7">{t("date_range_7")}</option>
          <option value="30">{t("date_range_30")}</option>
        </select>
        <button
          type="button"
          className="clear-btn"
          onClick={handleClearFilters}
        >
          <XIcon />
          {t("filter_clear")}
        </button>
      </div>

      <section className="history-card" aria-label={t("list_aria")}>
        {/* Desktop table */}
        <div className="history-table">
          <div className="history-row is-head" role="row" aria-hidden="true">
            <span>{t("col_video")}</span>
            <span>{t("col_date")}</span>
            <span>{t("col_comments")}</span>
            <span>{t("col_sentiment")}</span>
            <span style={{ textAlign: "right" }}>{t("col_actions")}</span>
          </div>

          {visibleItems.map((row) => {
            const dist = deriveDistribution(row.sentiment)
            const pos = dist ? Math.round(dist.positive * 100) : 0
            const neu = dist ? Math.round(dist.neutral * 100) : 0
            const neg = dist ? Math.round(dist.negative * 100) : 0
            return (
              <article
                key={row.id}
                className={
                  removingIds.has(row.id)
                    ? "history-row is-removing"
                    : "history-row"
                }
                data-id={row.id}
                style={{ cursor: "pointer" }}
                onClick={(e) => openDetailFromRow(e, row.id)}
              >
                <div className="video-cell">
                  {row.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.thumbnail_url}
                      alt=""
                      className="video-thumb video-thumb--img"
                    />
                  ) : (
                    <span className="video-thumb" aria-hidden="true" />
                  )}
                  <div className="video-meta">
                    <Link
                      className="video-title-link"
                      href={`/history/${row.id}`}
                    >
                      {row.video_title ?? row.video_id}
                    </Link>
                    <span className="video-channel">
                      {row.channel_name ?? ""}
                    </span>
                  </div>
                </div>
                <span className="cell-date">
                  {dateFmt.format(new Date(row.processed_at))}
                </span>
                <span className="cell-comments">
                  {numberFmt.format(row.comment_count)}
                </span>
                <div className="sent-stack">
                  {dist ? (
                    <>
                      <div className="sent-bar">
                        <span className="sent-pos" style={{ width: `${pos}%` }} />
                        <span className="sent-neu" style={{ width: `${neu}%` }} />
                        <span className="sent-neg" style={{ width: `${neg}%` }} />
                      </div>
                      <div className="sent-pct">
                        <span className="pos">{pos}%</span>
                        <span>{neu}%</span>
                        <span className="neg">{neg}%</span>
                      </div>
                    </>
                  ) : (
                    <span
                      style={{
                        color: "var(--color-text-tertiary)",
                        fontFamily: "var(--font-family-mono)",
                        fontSize: 11,
                      }}
                    >
                      {tLabel("mixed")}
                    </span>
                  )}
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="icon-only text-btn"
                    aria-label="Download CSV"
                    onClick={() => downloadFromCache(row, "csv")}
                  >
                    CSV
                  </button>
                  {tier === "pro" && (
                    <>
                      <button
                        type="button"
                        className="icon-only text-btn"
                        aria-label="Download JSON"
                        onClick={() => downloadFromCache(row, "json")}
                      >
                        JSON
                      </button>
                      <button
                        type="button"
                        className="icon-only text-btn"
                        aria-label="Download Excel"
                        onClick={() => downloadFromCache(row, "xlsx")}
                      >
                        XLS
                      </button>
                    </>
                  )}
                  <a
                    href={watchUrl(row.video_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="icon-only"
                    aria-label={t("action_reanalyze")}
                  >
                    <RefreshIcon />
                  </a>
                  <button
                    type="button"
                    className="icon-only danger"
                    aria-label={t("action_delete")}
                    onClick={() => askDelete(row)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </article>
            )
          })}
        </div>

        {/* Mobile cards */}
        <div className="history-cards" ref={cardsRootRef}>
          {visibleItems.map((row) => {
            const dist = deriveDistribution(row.sentiment)
            const summary = dist ? qualitativeSummary(dist) : null
            const chipClass =
              summary === "mostly_negative" || summary === "leans_negative"
                ? "hcr-sent-chip neg"
                : summary === "mostly_positive" || summary === "leans_positive"
                  ? "hcr-sent-chip pos"
                  : "hcr-sent-chip neu"
            const sentLabel = summary ? tLabel(summary) : ""
            return (
              <article
                key={row.id}
                className={[
                  "history-card-row",
                  removingIds.has(row.id) ? "is-removing" : "",
                  openMenuId === row.id ? "is-menu-open" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-id={row.id}
                style={{ cursor: "pointer" }}
                onClick={(e) => openDetailFromRow(e, row.id)}
              >
                <div className="hcr-head">
                  {row.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.thumbnail_url}
                      alt=""
                      className="video-thumb video-thumb--img"
                    />
                  ) : (
                    <span className="video-thumb" aria-hidden="true" />
                  )}
                  <div className="hcr-title-block">
                    <Link className="hcr-title" href={`/history/${row.id}`}>
                      {row.video_title ?? row.video_id}
                    </Link>
                    <span className="hcr-channel">
                      {row.channel_name ?? ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="overflow-btn"
                    aria-label={t("more_actions")}
                    aria-haspopup="menu"
                    aria-expanded={openMenuId === row.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMenuId((cur) => (cur === row.id ? null : row.id))
                    }}
                  >
                    <DotsIcon />
                  </button>
                  <div className="overflow-menu" role="menu">
                    <Link href={`/history/${row.id}`} role="menuitem">
                      <EyeIcon /> {t("action_view")}
                    </Link>
                    <a href={`/${locale}/dashboard`} role="menuitem">
                      <RefreshIcon /> {t("action_reanalyze")}
                    </a>
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        setOpenMenuId(null)
                        askDelete(row)
                      }}
                    >
                      <TrashIcon /> {t("action_delete")}
                    </button>
                  </div>
                </div>
                <div className="hcr-meta">
                  <span>{dateFmt.format(new Date(row.processed_at))}</span>
                  <span className="dot-sep" />
                  <span>
                    {t("meta_comments_count", {
                      count: row.comment_count,
                    })}
                  </span>
                  {sentLabel ? (
                    <>
                      <span className="dot-sep" />
                      <span className={chipClass}>
                        <span className="dot" />
                        {sentLabel}
                      </span>
                    </>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 ? (
          <div className="pagination">
            <span className="pagination-info">
              {t("pagination_info", {
                from: pageStart + 1,
                to: pageEnd,
                total: totalKnown,
              })}
            </span>
            <nav className="pagination-pages" aria-label={t("pagination_aria")}>
              <button
                type="button"
                aria-label={t("pagination_prev")}
                className={safePage === 1 ? "is-disabled" : ""}
                onClick={() => gotoPage(safePage - 1)}
                disabled={safePage === 1}
              >
                <ChevLeftIcon />
              </button>
              {buildPageList(safePage, totalPages).map((p, idx) =>
                p === "..." ? (
                  <span
                    key={`gap-${idx}`}
                    style={{
                      minWidth: 36,
                      height: 36,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-text-tertiary)",
                    }}
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={p === safePage ? "is-current" : ""}
                    aria-current={p === safePage ? "page" : undefined}
                    onClick={() => gotoPage(p)}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                type="button"
                aria-label={t("pagination_next")}
                className={safePage >= totalPages ? "is-disabled" : ""}
                onClick={() => gotoPage(safePage + 1)}
                disabled={safePage >= totalPages}
              >
                <ChevRightIcon />
              </button>
            </nav>
          </div>
        ) : null}

        {/* Free tier upsell footer when at cap */}
        {tier === "free" && items.length >= PAGE_SIZE ? (
          <div className="pagination" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
            <span className="pagination-info">{t("cap_label_free")}</span>
          </div>
        ) : null}

        {tier === "pro" && loadingMore ? (
          <div className="pagination" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
            <span className="pagination-info">{t("loading_more")}</span>
          </div>
        ) : null}
      </section>
    </>
  )
}

/*
  Build a compact paginator like 1 ... 4 5 6 ... 12. Always shows the first
  and last page; collapses runs > 1 gap with an ellipsis sentinel.
*/
function buildPageList(current: number, total: number): Array<number | "..."> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const out: Array<number | "..."> = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) out.push("...")
  for (let i = left; i <= right; i += 1) out.push(i)
  if (right < total - 1) out.push("...")
  out.push(total)
  return out
}

function ToastHost({
  toasts,
  onDismiss,
  dismissLabel,
}: {
  toasts: ToastEntry[]
  onDismiss: (id: number) => void
  dismissLabel: string
}) {
  if (toasts.length === 0) return null
  return (
    <div className="tm-toast-host" aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.id} entry={t} onDismiss={onDismiss} dismissLabel={dismissLabel} />
      ))}
    </div>
  )
}

function Toast({
  entry,
  onDismiss,
  dismissLabel,
}: {
  entry: ToastEntry
  onDismiss: (id: number) => void
  dismissLabel: string
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const cls = [
    "tm-toast",
    `tm-toast--${entry.variant}`,
    visible ? "is-visible" : "",
  ]
    .filter(Boolean)
    .join(" ")
  return (
    <div
      className={cls}
      role={entry.variant === "error" ? "alert" : "status"}
    >
      <span className="tm-toast-icon">
        <ToastIcon variant={entry.variant} />
      </span>
      <div className="tm-toast-body">
        {entry.title ? <div className="tm-toast-title">{entry.title}</div> : null}
        {entry.message ? (
          <div className="tm-toast-message">{entry.message}</div>
        ) : null}
        {entry.actions && entry.actions.length > 0 ? (
          <div className="tm-toast-actions">
            {entry.actions.map((a) => (
              <button
                key={a.id}
                type="button"
                className={
                  a.variant === "danger"
                    ? "btn btn--destructive"
                    : "btn btn--secondary"
                }
                onClick={() => a.onClick?.()}
              >
                {a.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="tm-toast-dismiss"
        aria-label={dismissLabel}
        onClick={() => onDismiss(entry.id)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  )
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "success") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m4 12 5 5L20 6" />
      </svg>
    )
  }
  if (variant === "warning") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx={12} cy={12} r={9} />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 2 21h20Z" />
      <path d="M12 10v5" />
      <path d="M12 18h.01" />
    </svg>
  )
}

/* ===== Inline icon components from the design's <symbol id="i-*"> SVGs ===== */
function SearchIcon() {
  return (
    <svg
      className="icon icon-sm"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={11} cy={11} r={7} />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}
function XIcon() {
  return (
    <svg
      className="icon icon-sm"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}
function EyeIcon() {
  return (
    <svg
      className="icon icon-sm"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx={12} cy={12} r={3} />
    </svg>
  )
}
function RefreshIcon() {
  return (
    <svg
      className="icon icon-sm"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 15-6.7l3-2.3v7h-7" />
      <path d="M21 12a9 9 0 0 1-15 6.7l-3 2.3v-7h7" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg
      className="icon icon-sm"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  )
}
function DotsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={6} cy={12} r={1.5} />
      <circle cx={12} cy={12} r={1.5} />
      <circle cx={18} cy={12} r={1.5} />
    </svg>
  )
}
function ChevLeftIcon() {
  return (
    <svg
      className="icon icon-sm"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}
function ChevRightIcon() {
  return (
    <svg
      className="icon icon-sm"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
