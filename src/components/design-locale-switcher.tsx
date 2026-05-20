"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useLocale } from "next-intl"
import { usePathname, useRouter } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  ru: "Русский",
}

/*
  TUB-1 Visual Port: shared design locale switcher (verbatim port of the
  .locale-switcher block from TubeMine *.html). Used by both the public
  SiteHeader (via its own inline copy) and the Dashboard topbar. Exported
  so any signed-in page chrome can reuse the same dropdown affordance.
*/
export function DesignLocaleSwitcher({
  languageLabel,
  withLabel = false,
}: {
  languageLabel: string
  withLabel?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("click", onDocClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("click", onDocClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  function selectLocale(next: string) {
    setOpen(false)
    if (next === locale) return
    startTransition(() => {
      router.replace(pathname, {
        locale: next as (typeof routing.locales)[number],
      })
    })
  }

  return (
    <div
      ref={containerRef}
      className={open ? "locale-switcher is-open" : "locale-switcher"}
      data-locale-switcher
    >
      <button
        type="button"
        className="locale-trigger"
        aria-haspopup="listbox"
        aria-expanded={open ? "true" : "false"}
        aria-label={languageLabel}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        {withLabel ? (
          <span>
            <span className="locale-current">{locale.toUpperCase()}</span> ·{" "}
            {LOCALE_LABELS[locale] ?? locale}
          </span>
        ) : (
          <span className="locale-current">{locale.toUpperCase()}</span>
        )}
        <svg
          className="icon icon-sm arrow"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <ul className="locale-menu" role="listbox" aria-label={languageLabel}>
        {routing.locales.map((loc) => {
          const selected = loc === locale
          return (
            <li key={loc}>
              <button
                type="button"
                role="option"
                aria-selected={selected ? "true" : "false"}
                onClick={() => selectLocale(loc)}
              >
                <span className="code">{loc.toUpperCase()}</span>
                <span className="label">{LOCALE_LABELS[loc] ?? loc}</span>
                <svg
                  className="icon icon-sm check"
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m4 12 5 5L20 6" />
                </svg>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
