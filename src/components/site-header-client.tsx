"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useLocale } from "next-intl"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"

type AuthState = "anonymous" | "signed-in"

type Labels = {
  brand: string
  features: string
  pricing: string
  docs: string
  changelog: string
  getStarted: string
  dashboard: string
  openMenu: string
  closeMenu: string
  languageLabel: string
  github: string
}

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  ru: "Русский",
}

export function SiteHeaderClient({
  authState,
  initials,
  repoUrl,
  labels,
}: {
  authState: AuthState
  initials: string
  repoUrl: string
  labels: Labels
}) {
  const [scrolled, setScrolled] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (drawerOpen) {
      document.body.classList.add("no-scroll")
    } else {
      document.body.classList.remove("no-scroll")
    }
    return () => document.body.classList.remove("no-scroll")
  }, [drawerOpen])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && drawerOpen) setDrawerOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [drawerOpen])

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    function handle(e: MediaQueryListEvent) {
      if (e.matches) setDrawerOpen(false)
    }
    mq.addEventListener("change", handle)
    return () => mq.removeEventListener("change", handle)
  }, [])

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href
  const linkClass = (href: string) =>
    isActive(href) ? "nav-link is-active" : "nav-link"
  const linkAria = (href: string): "page" | undefined =>
    isActive(href) ? "page" : undefined
  const drawerLinkClass = (href: string) => (isActive(href) ? "is-active" : undefined)

  return (
    <>
      <nav
        className={scrolled ? "nav is-scrolled" : "nav"}
        id="nav"
        aria-label="Primary"
      >
        <div className="container nav-inner">
          <Link href="/" className="nav-brand" aria-label={`${labels.brand} home`}>
            <span className="brand-mark" aria-hidden="true" />
            <span>{labels.brand}</span>
          </Link>
          <div className="nav-links">
            {authState === "anonymous" ? (
              <Link href="/#features" className="nav-link">
                {labels.features}
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className={linkClass("/dashboard")}
                aria-current={linkAria("/dashboard")}
              >
                {labels.dashboard}
              </Link>
            )}
            <Link
              href="/pricing"
              className={linkClass("/pricing")}
              aria-current={linkAria("/pricing")}
            >
              {labels.pricing}
            </Link>
            <Link
              href="/docs"
              className={linkClass("/docs")}
              aria-current={linkAria("/docs")}
            >
              {labels.docs}
            </Link>
            <Link
              href="/changelog"
              className={linkClass("/changelog")}
              aria-current={linkAria("/changelog")}
            >
              {labels.changelog}
            </Link>
          </div>
          <div className="nav-actions">
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-ghost-icon"
              aria-label={labels.github}
            >
              <GithubIcon />
            </a>
            <LocaleSwitcherDropdown languageLabel={labels.languageLabel} />
            {authState === "anonymous" ? (
              <Link
                href="/login?intent=signup"
                className="btn btn--primary btn-sm if-anon"
              >
                {labels.getStarted}
              </Link>
            ) : (
              <>
                <Link
                  href="/dashboard"
                  className="btn btn--secondary btn-sm if-signed-in"
                >
                  {labels.dashboard}
                </Link>
                <span
                  className="if-signed-in"
                  aria-hidden="true"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, #4a4a52 0%, #2a2a30 100%)",
                    border: "1px solid var(--color-border-subtle)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--color-text-primary)",
                    fontSize: 11,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </span>
              </>
            )}
            <button
              type="button"
              className="mobile-menu-btn"
              aria-label={labels.openMenu}
              aria-controls="mobileDrawer"
              aria-expanded={drawerOpen ? "true" : "false"}
              onClick={() => setDrawerOpen(true)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <div
        className={
          drawerOpen
            ? "mobile-drawer-backdrop is-visible"
            : "mobile-drawer-backdrop"
        }
        aria-hidden="true"
        onClick={closeDrawer}
      />
      <aside
        className={drawerOpen ? "mobile-drawer is-open" : "mobile-drawer"}
        id="mobileDrawer"
        role="dialog"
        aria-modal="true"
        aria-label={labels.openMenu}
        aria-hidden={drawerOpen ? "false" : "true"}
      >
        <header className="mobile-drawer-head">
          <Link
            href="/"
            className="nav-brand"
            onClick={closeDrawer}
          >
            <span className="brand-mark" aria-hidden="true" />
            <span>{labels.brand}</span>
          </Link>
          <button
            type="button"
            className="mobile-drawer-close"
            aria-label={labels.closeMenu}
            onClick={closeDrawer}
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
        </header>
        <nav className="mobile-drawer-nav" aria-label="Mobile primary">
          {authState === "anonymous" ? (
            <Link href="/#features" onClick={closeDrawer}>
              {labels.features}
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className={drawerLinkClass("/dashboard")}
              aria-current={linkAria("/dashboard")}
              onClick={closeDrawer}
            >
              {labels.dashboard}
            </Link>
          )}
          <Link
            href="/pricing"
            className={drawerLinkClass("/pricing")}
            aria-current={linkAria("/pricing")}
            onClick={closeDrawer}
          >
            {labels.pricing}
          </Link>
          <Link
            href="/docs"
            className={drawerLinkClass("/docs")}
            aria-current={linkAria("/docs")}
            onClick={closeDrawer}
          >
            {labels.docs}
          </Link>
          <Link
            href="/changelog"
            className={drawerLinkClass("/changelog")}
            aria-current={linkAria("/changelog")}
            onClick={closeDrawer}
          >
            {labels.changelog}
          </Link>
        </nav>
        <div className="mobile-drawer-meta">
          <LocaleSwitcherDropdown
            languageLabel={labels.languageLabel}
            withLabel
          />
        </div>
        <div className="mobile-drawer-actions">
          {authState === "anonymous" ? (
            <Link
              href="/login?intent=signup"
              className="btn btn--primary btn-lg"
              onClick={closeDrawer}
            >
              {labels.getStarted}
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="btn btn--primary btn-lg"
              onClick={closeDrawer}
            >
              {labels.dashboard}
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}

function LocaleSwitcherDropdown({
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

function GithubIcon() {
  return (
    <svg
      className="icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.12-1.47-1.12-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  )
}
