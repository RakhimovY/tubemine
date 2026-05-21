"use client"

import { useCallback, useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Link } from "@/i18n/navigation"
import { DesignLocaleSwitcher } from "@/components/design-locale-switcher"
import { SideNav, type SideNavLabels } from "@/components/side-nav"

/*
  TUB-13 M23: AppShell. Persistent topbar + sidebar chrome for the signed-in
  app routes (/dashboard, /profile, /history). Wraps children with the same
  60px topbar and 240px sidebar from the design's port. Lives at the
  src/app/[locale]/(app)/layout.tsx level so the shell stays mounted across
  intra-app navigation (no flicker, no re-mount of <SideNav />).

  Mobile (<1024px): the sidebar collapses into a drawer toggled by the
  hamburger button in the topbar. Drawer behavior mirrors the original
  dashboard-shell.tsx (scrim click, escape, force-close at desktop bp,
  body scroll lock). When a nav item is clicked, the drawer closes via
  the onNavigate callback passed to <SideNav />.
*/

type Tier = "free" | "pro"

export type AppShellLabels = SideNavLabels & {
  brand: string
  crumb: string
  openMenu: string
  closeMenu: string
  tierBadgeFree: string
  tierBadgePro: string
  languageLabel: string
}

export function AppShell({
  tier,
  initials,
  historyCount,
  labels,
  children,
}: {
  tier: Tier
  initials: string
  historyCount: number
  labels: AppShellLabels
  children: ReactNode
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  // Lock scroll while drawer is open (mobile only).
  useEffect(() => {
    if (drawerOpen) {
      document.body.classList.add("no-scroll")
    } else {
      document.body.classList.remove("no-scroll")
    }
    return () => document.body.classList.remove("no-scroll")
  }, [drawerOpen])

  // Escape closes drawer.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && drawerOpen) closeDrawer()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [drawerOpen, closeDrawer])

  // Force-close once we cross the 1024 desktop breakpoint.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    function handle(e: MediaQueryListEvent) {
      if (e.matches) setDrawerOpen(false)
    }
    mq.addEventListener("change", handle)
    return () => mq.removeEventListener("change", handle)
  }, [])

  return (
    <div className="dashboard-page"><div className="shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="menu-btn"
            aria-label={drawerOpen ? labels.closeMenu : labels.openMenu}
            aria-controls="dashboard-sidebar"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </button>
          <Link href="/" className="topbar-brand">
            <span className="brand-mark" aria-hidden="true" />
            <span>{labels.brand}</span>
            <span className="crumb">{labels.crumb}</span>
          </Link>
        </div>
        <div className="topbar-right">
          <DesignLocaleSwitcher languageLabel={labels.languageLabel} />
          <span className="topbar-divider" aria-hidden="true" />
          {tier === "free" ? (
            <span className="badge badge--secondary" style={{ height: 22 }}>
              {labels.tierBadgeFree}
            </span>
          ) : (
            <span className="badge badge--default" style={{ height: 22 }}>
              <span className="badge-dot" />
              {labels.tierBadgePro}
            </span>
          )}
          <div className="topbar-user">
            <span className="avatar" aria-hidden="true">
              {initials || "U"}
            </span>
          </div>
        </div>
      </header>

      <div
        className={drawerOpen ? "sidebar-scrim is-visible" : "sidebar-scrim"}
        aria-hidden="true"
        onClick={closeDrawer}
      />
      <SideNav
        historyCount={historyCount}
        labels={{
          sidebarLabel: labels.sidebarLabel,
          workspaceLabel: labels.workspaceLabel,
          moreLabel: labels.moreLabel,
          navHome: labels.navHome,
          navHistory: labels.navHistory,
          navProfile: labels.navProfile,
          navGithub: labels.navGithub,
          navDocs: labels.navDocs,
          navSignOut: labels.navSignOut,
        }}
        drawerOpen={drawerOpen}
        onNavigate={closeDrawer}
      />

      <main className="main">
        <div className="main-inner">{children}</div>
      </main>
    </div></div>
  )
}
