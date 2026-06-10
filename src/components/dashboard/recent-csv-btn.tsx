"use client"

import { useState } from "react"

/*
  Thin client island for the Save CSV action button on each dashboard
  recent-analysis row. Calls /api/export with mode=cache and triggers a
  browser download. No extra state held; spinner shown while the request
  is in flight.
*/
export function RecentCsvBtn({
  analysisId,
  videoId,
  label,
  ariaLabel,
}: {
  analysisId: string
  videoId: string
  label: string
  ariaLabel: string
}) {
  const [busy, setBusy] = useState(false)

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "cache", analysisId, format: "csv" }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${videoId}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`btn btn--ghost btn-xs recent-action${busy ? " is-loading" : ""}`}
      aria-label={ariaLabel}
      onClick={handleClick}
      disabled={busy}
    >
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
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
        <path d="M14 3v6h6" />
        <path d="M8 14h8" />
        <path d="M8 18h6" />
      </svg>
      {label}
    </button>
  )
}
