"use client"

import { Link, usePathname } from "@/i18n/navigation"

/*
  TUB-13 M23: SideNav. Renders the persistent sidebar for the signed-in app
  (/dashboard, /profile, /history). Lives inside <AppShell />. Highlights
  the current page via `usePathname()` from next-intl (strips the locale
  prefix before matching). Closes the mobile drawer on nav click via the
  optional `onNavigate` callback.
*/
export type SideNavLabels = {
  sidebarLabel: string
  workspaceLabel: string
  moreLabel: string
  navHome: string
  navHistory: string
  navProfile: string
  navAiAccess: string
  navGithub: string
  navDocs: string
  navSignOut: string
}

export function SideNav({
  historyCount,
  labels,
  drawerOpen,
  onNavigate,
}: {
  historyCount: number
  labels: SideNavLabels
  drawerOpen: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <aside
      className={drawerOpen ? "sidebar is-open" : "sidebar"}
      id="dashboard-sidebar"
      aria-label={labels.sidebarLabel}
    >
      <nav className="sidebar-section" aria-label={labels.workspaceLabel}>
        <div className="sidebar-label">{labels.workspaceLabel}</div>
        <Link
          href="/dashboard"
          className={
            isActive("/dashboard") ? "nav-item is-active" : "nav-item"
          }
          aria-current={isActive("/dashboard") ? "page" : undefined}
          onClick={onNavigate}
        >
          <HomeIcon />
          {labels.navHome}
        </Link>
        <Link
          href="/history"
          className={isActive("/history") ? "nav-item is-active" : "nav-item"}
          aria-current={isActive("/history") ? "page" : undefined}
          onClick={onNavigate}
        >
          <ClockIcon />
          {labels.navHistory}
          {historyCount > 0 ? (
            <span className="count">{historyCount}</span>
          ) : null}
        </Link>
        <Link
          href="/profile"
          className={isActive("/profile") ? "nav-item is-active" : "nav-item"}
          aria-current={isActive("/profile") ? "page" : undefined}
          onClick={onNavigate}
        >
          <UserIcon />
          {labels.navProfile}
        </Link>
        <Link
          href="/ai-access"
          className={isActive("/ai-access") ? "nav-item is-active" : "nav-item"}
          aria-current={isActive("/ai-access") ? "page" : undefined}
          onClick={onNavigate}
        >
          <PlugIcon />
          {labels.navAiAccess}
        </Link>
      </nav>

      <div className="sidebar-divider" role="separator" />

      <nav className="sidebar-section" aria-label={labels.moreLabel}>
        <div className="sidebar-label">{labels.moreLabel}</div>
        <a
          href="https://github.com/RakhimovY/tubemine"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-item"
          onClick={onNavigate}
        >
          <GithubIcon />
          {labels.navGithub}
        </a>
        <Link
          href="/docs"
          className={isActive("/docs") ? "nav-item is-active" : "nav-item"}
          aria-current={isActive("/docs") ? "page" : undefined}
          onClick={onNavigate}
        >
          <DocsIcon />
          {labels.navDocs}
        </Link>
      </nav>

      <div className="sidebar-foot">
        <form action="/logout" method="POST" className="contents">
          <button type="submit" className="nav-item" style={{ width: "100%" }}>
            <LogoutIcon />
            {labels.navSignOut}
          </button>
        </form>
      </div>
    </aside>
  )
}

/* ===== Inline icons (match design's <symbol id="i-*">) ===== */
function HomeIcon() {
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
      <path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </svg>
  )
}
function ClockIcon() {
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
      <circle cx={12} cy={12} r={9} />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
function UserIcon() {
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
      <circle cx={12} cy={8} r={4} />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}
function PlugIcon() {
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
      <path d="M9 2v6" />
      <path d="M15 2v6" />
      <path d="M7 8h10v3a5 5 0 0 1-10 0z" />
      <path d="M12 16v6" />
    </svg>
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
function DocsIcon() {
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
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
      <path d="M8 10h8" />
      <path d="M8 13h5" />
    </svg>
  )
}
function LogoutIcon() {
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
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}
