"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

/*
  TUB-1 Visual Port: dashboard's welcome pulse. Verbatim port of the
  .pulse + auto-dismiss timer from
  /tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/TubeMine Dashboard.html
  Shows only when ?welcome=true is in the URL. Auto-dismisses after 5s
  AND strips the ?welcome param so a refresh does not re-pulse. Manual
  close button mirrors the design.
*/
export function WelcomePulse({
  title,
  subtitle,
  dismissLabel,
}: {
  title: string
  subtitle: string
  dismissLabel: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  function dismiss() {
    setFading(true)
    // After CSS fade (240ms) unmount + strip URL param.
    window.setTimeout(() => {
      setVisible(false)
      try {
        const url = new URL(window.location.href)
        if (url.searchParams.has("welcome")) {
          url.searchParams.delete("welcome")
          router.replace(
            url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""),
            { scroll: false },
          )
        }
      } catch {
        // noop
      }
    }, 280)
  }

  useEffect(() => {
    const t = window.setTimeout(dismiss, 5000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!visible) return null

  return (
    <div
      className="pulse"
      role="status"
      aria-live="polite"
      style={
        fading
          ? {
              opacity: 0,
              transition: "opacity 240ms cubic-bezier(0.2, 0, 0, 1)",
            }
          : undefined
      }
    >
      <span className="pulse-icon" aria-hidden="true">
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
          <path d="m4 12 5 5L20 6" />
        </svg>
      </span>
      <div className="pulse-body">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <button
        type="button"
        className="pulse-dismiss"
        aria-label={dismissLabel}
        onClick={dismiss}
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
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  )
}
