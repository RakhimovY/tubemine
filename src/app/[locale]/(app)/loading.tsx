import { Skeleton } from "@/components/ui/skeleton"

/*
  TUB-28 Step 1: Suspense fallback for child pages in the (app) route group.
  Renders instantly on navigation between /dashboard, /profile, /history while
  the new page's server data resolves. AppShell chrome (topbar + sidebar) is
  already mounted by the parent layout, so this file only fills .main-inner.

  Hard rules:
    - No t() / getTranslations() / useTranslations(). Locale-agnostic body.
    - No auth. No data fetches.
    - Reserved class .is-placeholder is NOT used here (owned by
      .recent-thumb.is-placeholder in globals.css line 1776 for missing
      thumbnail fallback). Use [data-slot="skeleton"] from the Skeleton
      primitive instead.

  Block heights match the real dashboard sections so transition to real
  content does not visibly jump.
*/
export default function AppGroupLoading() {
  return (
    <div className="dashboard-page" aria-busy="true" aria-live="polite">
      {/* Welcome strip placeholder. Real welcome-strip is ~56px tall. */}
      <Skeleton className="h-14 w-2/3" />

      {/* Usage card placeholder. Real usage card is ~180px tall. */}
      <Skeleton className="h-44 w-full rounded-xl" />

      {/* Quick analyze card placeholder. Real quick-analyze is ~220px tall. */}
      <Skeleton className="h-56 w-full rounded-xl" />

      {/* Recent analyses list: 5 rows, ~64px each. */}
      <div className="recent-list">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  )
}
