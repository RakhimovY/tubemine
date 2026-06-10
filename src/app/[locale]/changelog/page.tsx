import { getTranslations, setRequestLocale } from "next-intl/server"
import { LegalToc } from "@/components/legal-toc"
import { SiteFooter } from "@/components/site-footer"
import { breadcrumbSchema, seoAlternates } from "@/lib/seo-alternates"

const LAST_UPDATED = "June 10, 2026"

export const dynamic = "force-static"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "changelog.meta" })
  return {
    title: t("title"),
    description: t("description"),
    alternates: seoAlternates("/changelog", locale),
  }
}

/*
  TUB-31 Changelog content sprint (page 2 of 2).
  Body is English-only (per existing legal_disclaimer_ru_changelog design).
  Chrome (hero, TOC, footer) is bilingual. Article wrapper carries
  lang="en" dir="ltr" so screen readers on /ru/changelog pronounce
  release notes with English phonetics. RU disclaimer banner above the
  hero carries role="note" so RU users hear an explicit notification.
  Reuses the .legal-page CSS scope from /privacy + /terms + /docs.
*/
export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("changelog")
  const tRoot = await getTranslations()

  const releases = [
    {
      id: "r-2026-06-10",
      num: "01",
      date: "2026-06-10",
      body: (
        <>
          {/* SRC: TUB-50 MCP server + v3 design port. PR #7, #8. */}
          <h3>Added</h3>
          <ul>
            <li>
              TubeMine MCP server. Connect your AI assistant (Claude Code,
              ChatGPT, Cursor, Codex, Gemini CLI, Claude Desktop, Hermes, or
              OpenClaw) and pull any YouTube video&apos;s comments straight into
              your chat with one tool, <code>get_youtube_comments</code>. Your AI
              does the analysis on the raw thread it returns (TUB-50).
            </li>
            <li>
              New <code>/ai-access</code> page to create, copy, and revoke API
              keys, with one-click ready setup commands for each client.
            </li>
            <li>
              MCP setup docs at <code>/mcp-docs</code> with per-client connection
              guides.
            </li>
          </ul>
          <h3>Changed</h3>
          <ul>
            <li>
              Landing, pricing, and metadata repositioned around the MCP
              integration. The web analytics app stays as the no-setup option.
            </li>
            <li>Full v3 design refresh applied across the remaining pages.</li>
          </ul>
        </>
      ),
    },
    {
      id: "r-2026-05-21",
      num: "02",
      date: "2026-05-21",
      body: (
        <>
          {/* SRC: TUB-8, TUB-11 hotfixes, TUB-12, TUB-13 milestones, TUB-16..27. Commits: ee9fc16 7e172e0 f7f288e 4b3fbe5 fefeb02 55b0460 552e7cc f5a89b3 ffe3ff2 2d21bc0 21091b7 59cd134 5eb799d 856dfce ab2e3e8 c8d00d4 cdc17c3 ddcb2a6 5e7aac9 */}
          <h3>Added</h3>
          <ul>
            <li>
              Inbound email forwarding so <code>support@tubemine.tech</code> now
              reaches the inbox (TUB-8).
            </li>
            <li>
              Shared signed-in app shell layout. No more flicker switching
              between Dashboard, History, and Profile (TUB-13).
            </li>
            <li>
              Russian and English localization across the export bar, analytics,
              extractor, and skeleton loading states (TUB-13).
            </li>
          </ul>
          <h3>Changed</h3>
          <ul>
            <li>
              GitHub README rewritten with new screenshots and the production URL
              migrated to <code>tubemine.tech</code> (TUB-12).
            </li>
            <li>
              Header swaps the &quot;Features&quot; link for &quot;Dashboard&quot; when you are
              signed in.
            </li>
          </ul>
          <h3>Fixed</h3>
          <ul>
            <li>Pro sentiment label now localizes correctly in Russian (TUB-21).</li>
            <li>
              Profile plan card no longer shows the raw{" "}
              <code>{"{cap, number}"}</code> ICU placeholder (TUB-17).
            </li>
            <li>Dashboard cards now have proper spacing between sections (TUB-19).</li>
            <li>
              Topbar breadcrumb now updates when navigating between Dashboard,
              History, and Profile (TUB-18).
            </li>
            <li>
              Recent Analyses and History rows now persist real video title,
              channel name, and thumbnail instead of placeholders (TUB-20).
            </li>
            <li>Russian profile no longer doubles the word &quot;использовано&quot; (TUB-22).</li>
            <li>
              Extract and &quot;Try another URL&quot; buttons match the design system
              instead of low-contrast shadcn primitives (TUB-25).
            </li>
            <li>
              Dashboard quota indicator no longer renders three times on the
              same page for Pro users (TUB-26).
            </li>
            <li>
              Quick Analyze preview thumbnail now respects the 180px width cap
              (TUB-27).
            </li>
          </ul>
          <h3>Security</h3>
          <ul>
            <li>
              CSV and XLSX exports now sanitize formula-injection vectors (
              <code>=</code> <code>+</code> <code>-</code> <code>@</code> plus
              full-width Unicode variants) per OWASP guidance. Affects every
              export across Anonymous, Free, and Pro tiers (TUB-23, P0).
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "r-2026-05-20",
      num: "03",
      date: "2026-05-20",
      body: (
        <>
          {/* SRC: TUB-1 (visual port 9 pages), TUB-11 Phase 1 branding, TUB-7. Commits: 534e15f..80b0a21, 5e7aac9 */}
          <h3>Added</h3>
          <ul>
            <li>
              Full v3 visual redesign across landing, pricing, dashboard,
              profile, history, login, OAuth intro, privacy, and terms (TUB-1,
              9 pages).
            </li>
            <li>
              TubeMine logo, favicon, PWA icons, and OpenGraph image (TUB-11).
            </li>
          </ul>
          <h3>Changed</h3>
          <ul>
            <li>
              Pricing FAQ rewritten to clarify how the 3-day trial and 7-day
              refund window interact (TUB-7).
            </li>
          </ul>
          <h3>Fixed</h3>
          <ul>
            <li>
              Privacy and Terms bullet text no longer wraps per-word on narrow
              viewports.
            </li>
            <li>
              OAuth redirect now hard-pins to <code>NEXT_PUBLIC_ORIGIN</code> (no
              more accidental localhost redirects from production).
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "r-2026-05-19",
      num: "04",
      date: "2026-05-19",
      body: (
        <>
          {/* SRC: Phase H + Phase J. Commits: 32423b5 f381746 860e277 73d68b3 030147d 6eacfe3 165b759 6f46952 */}
          <h3>Added</h3>
          <ul>
            <li>3-day free Pro trial. No card charged until day 4.</li>
            <li>
              Tier-aware Recent Analyses rows on the dashboard: qualitative
              label for Free, exact percentages for Pro.
            </li>
            <li>JSON and Excel exports for Pro.</li>
            <li>History retention increased from 10 to 100 entries for Pro.</li>
            <li>Russian sentiment labels (positive, neutral, negative).</li>
            <li>
              Google OAuth profile metadata (email, name, avatar) copied into the
              profile record.
            </li>
          </ul>
          <h3>Changed</h3>
          <ul>
            <li>
              Landing hero now shows only for anonymous visitors. Signed-in
              visitors land directly on the dashboard.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "r-2026-05-17",
      num: "05",
      date: "2026-05-17",
      body: (
        <>
          {/* SRC: Phase 1.5 + Phase 2. Commits: 217b793 93644e0 */}
          <h3>Added</h3>
          <ul>
            <li>
              Sentiment analysis on every comment (positive, neutral, negative
              direction).
            </li>
            <li>Top words and emoji frequency rankings.</li>
            <li>CSV download for Anonymous and Free tiers with quota gating.</li>
            <li>Google OAuth sign-in.</li>
            <li>Pricing page with Free vs Pro comparison.</li>
          </ul>
        </>
      ),
    },
    {
      id: "r-2026-05-15",
      num: "06",
      date: "2026-05-15",
      body: (
        <>
          {/* SRC: initial scaffold. Commits: 9e91f3a 7957565 2860ebb 1a182d9 6e47459 */}
          <h3>Added</h3>
          <ul>
            <li>First public release (Phase 0).</li>
            <li>
              YouTube URL preview shows title, channel, view, like, and comment
              counts.
            </li>
            <li>
              Anonymous comment analysis with monthly per-IP budget enforced via
              Vercel KV.
            </li>
            <li>CSV download client-side via Papa Parse.</li>
            <li>MIT license.</li>
          </ul>
        </>
      ),
    },
  ]

  const breadcrumb = breadcrumbSchema(locale, "/changelog")

  return (
    <div className="legal-page changelog-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <LegalToc />

      {locale === "ru" ? (
        <div
          role="note"
          className="not-prose mb-6 rounded border-l-4 border-yellow-500 bg-yellow-50 p-4 text-sm dark:bg-yellow-950/30"
        >
          {tRoot("legal_disclaimer_ru_changelog")}
        </div>
      ) : null}

      <main>
        <section className="legal-hero">
          <div className="container">
            <span className="legal-badge">{t("hero.badge")}</span>
            <h1 className="legal-title">{t("hero.title")}</h1>
            <p className="legal-sub">{t("hero.sub")}</p>
            <p className="legal-updated">
              {t("hero.updated_label")}: {LAST_UPDATED}
            </p>
          </div>
        </section>

        <section className="legal-body">
          <div className="container legal-grid">
            <aside className="toc" aria-label={t("toc.aria")}>
              <h3>{t("toc.heading")}</h3>
              <ol>
                {releases.map((r) => (
                  <li key={r.id}>
                    <a href={`#${r.id}`}>{r.date}</a>
                  </li>
                ))}
              </ol>
            </aside>

            <article className="legal-article" lang="en" dir="ltr">
              {releases.map((r) => (
                <section key={r.id} id={r.id}>
                  <h2>
                    <span className="num">{r.num}</span> {r.date}
                  </h2>
                  {r.body}
                </section>
              ))}
            </article>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

