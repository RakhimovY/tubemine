"use client"

import { useState } from "react"

/*
  TUB-1 Visual Port: client island for the Account ID copy button.
  Mirrors the inline <script> behavior in
    /tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/TubeMine Profile.html
  (copyBtn handler around L965-998): clipboard.writeText with a textarea
  fallback for non-secure contexts, then toggles `.is-copied` and swaps
  the copy/copied label for 1.5s.
*/
export function AccountIdCopy({
  accountId,
  copyLabel,
  copiedLabel,
  ariaLabel,
}: {
  accountId: string
  copyLabel: string
  copiedLabel: string
  ariaLabel: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const text = accountId.trim()
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {
      try {
        await navigator.clipboard.writeText(text)
        flash()
        return
      } catch {
        // fall through to textarea fallback
      }
    }
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      flash()
    } catch {
      // silent: no feedback possible
    }
  }

  function flash() {
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      className={copied ? "copy-btn is-copied" : "copy-btn"}
      onClick={handleCopy}
      aria-label={ariaLabel}
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
        <rect x={9} y={9} width={13} height={13} rx={2} />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span className="copy-label">{copied ? copiedLabel : copyLabel}</span>
    </button>
  )
}
