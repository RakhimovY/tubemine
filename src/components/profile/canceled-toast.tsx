"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

/*
  TUB-1 Visual Port: client island that mirrors the inline `pushToast`
  flow in
    /tmp/tubemine-handoff-2026-05-20/tubemine-v3-ux/project/TubeMine Profile.html
  (L1023-1062). When the URL carries ?canceled=true the toast renders
  inside .toast-host with the design's structure (.toast / .toast-icon /
  .toast-body / .toast-dismiss / .toast::before accent strip). The URL
  param is stripped via router.replace once the toast has been shown so
  the toast does not re-fire on refresh or back-nav. The toast
  auto-dismisses after 6 seconds. The accent strip is yellow
  (--color-feedback-warning) to match the design.

  Lifecycle is a single `phase` string ("hidden" | "entering" | "shown"
  | "leaving") driven only by setTimeout / event-handler callbacks,
  never by direct setState() inside an effect body, to satisfy the
  react-hooks/set-state-in-effect lint rule.
*/
type Phase = "hidden" | "entering" | "shown" | "leaving"

export function CanceledToast({
  title,
  message,
  dismissLabel,
  endsDate,
  locale,
}: {
  title: string
  message: string
  dismissLabel: string
  endsDate: string
  locale: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const firstRunRef = useRef(false)
  const [phase, setPhase] = useState<Phase>("hidden")

  // Detect first observation of ?canceled=true and queue the toast.
  // setPhase is dispatched via a microtask (callback context), not
  // synchronously inside the effect body.
  useEffect(() => {
    if (firstRunRef.current) return
    if (searchParams.get("canceled") !== "true") return
    firstRunRef.current = true
    // Strip the param so a refresh does not re-fire.
    router.replace(`/${locale}/profile`, { scroll: false })
    queueMicrotask(() => setPhase("entering"))
  }, [searchParams, router, locale])

  // entering -> shown one frame later so the .is-visible CSS transition runs.
  useEffect(() => {
    if (phase !== "entering") return
    const raf = requestAnimationFrame(() => setPhase("shown"))
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // shown -> leaving after 6s (auto-dismiss).
  useEffect(() => {
    if (phase !== "shown") return
    const timer = setTimeout(() => setPhase("leaving"), 6000)
    return () => clearTimeout(timer)
  }, [phase])

  // leaving -> hidden after the 240ms fade-out.
  useEffect(() => {
    if (phase !== "leaving") return
    const unmount = setTimeout(() => setPhase("hidden"), 240)
    return () => clearTimeout(unmount)
  }, [phase])

  if (phase === "hidden") return null

  const visible = phase === "shown"
  const rendered = endsDate ? message.replace("{date}", endsDate) : message

  return (
    <div className={visible ? "toast is-visible" : "toast"} role="status">
      <span className="toast-icon">
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
      </span>
      <div className="toast-body">
        <div className="toast-title">{title}</div>
        <div className="toast-message">{rendered}</div>
      </div>
      <button
        type="button"
        className="toast-dismiss"
        aria-label={dismissLabel}
        onClick={() => setPhase("leaving")}
      >
        <svg
          width={14}
          height={14}
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
