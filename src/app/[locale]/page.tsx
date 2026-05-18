import { getTranslations, setRequestLocale } from "next-intl/server"
import { Badge } from "@/components/ui/badge"
import { TubeMine } from "@/components/tubemine"
import { createClient } from "@/lib/supabase/server"

const REPO_URL = "https://github.com/RakhimovY/tubemine"

export const dynamic = "force-dynamic"

async function isUserSignedIn(): Promise<boolean> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return false
  }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return !!user
  } catch {
    return false
  }
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const isSignedIn = await isUserSignedIn()
  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      <main className="relative z-10 -mt-20 flex flex-1 flex-col items-center sm:-mt-28">
        <TubeMine isSignedIn={isSignedIn} />
      </main>
      <Footer />
    </div>
  )
}

async function Hero() {
  const t = await getTranslations("landing")
  return (
    <header className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="mesh-bg absolute inset-0" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-background/10 backdrop-blur-3xl"
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pt-20 pb-32 text-center sm:pt-28 sm:pb-40">
        <Badge
          variant="secondary"
          className="mb-6 rounded-full border border-border/60 bg-card/70 backdrop-blur"
        >
          Public OSS, MIT licensed
        </Badge>
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          {t("hero_title_a")}
          <br />
          {t("hero_title_b")}
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-foreground/70 sm:text-lg">
          {t("hero_subtitle")}
        </p>
        <p className="mt-3 text-xs text-foreground/50">
          For researchers, marketers, creators, and indie devs who want the
          signal, not a scrape.
        </p>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border/60 px-6 py-8 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 sm:flex-row">
        <p>
          TubeMine. Built with the YouTube Data API v3. Comments are public
          data; respect uploaders.
        </p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground"
        >
          <GithubIcon />
          Source on GitHub
        </a>
      </div>
    </footer>
  )
}

function GithubIcon() {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-3.5"
      fill="currentColor"
    >
      <path d="M12 .5a11.5 11.5 0 0 0-3.63 22.42c.57.1.78-.25.78-.55v-2c-3.18.69-3.85-1.34-3.85-1.34-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.54-.29-5.21-1.27-5.21-5.65 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17a10.95 10.95 0 0 1 5.74 0c2.19-1.48 3.15-1.17 3.15-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.39-2.68 5.36-5.23 5.64.41.36.78 1.07.78 2.16v3.2c0 .31.21.66.79.55A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}
