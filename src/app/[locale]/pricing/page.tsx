import NextLink from "next/link"
import { setRequestLocale } from "next-intl/server"
import { ArrowUpRight, Check } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getUserQuota, FREE_MONTHLY_CAP, PRO_MONTHLY_CAP } from "@/lib/quota"
import { formatNumber } from "@/lib/format"
import { UpgradeButton } from "../dashboard/upgrade-button"

export const metadata = {
  title: "Pricing, TubeMine",
  description:
    "Free up to 1,000 comments per month. Pro unlocks 100,000 comments per month for $19. Sentiment, top words, and emoji analytics on every plan.",
}

export const dynamic = "force-dynamic"

type AuthState =
  | { signedIn: false }
  | { signedIn: true; tier: "free" | "pro" }

async function loadAuthState(): Promise<AuthState> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { signedIn: false }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { signedIn: false }
  const quota = await getUserQuota(user.id)
  return { signedIn: true, tier: quota.tier }
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const state = await loadAuthState()

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 pt-24 pb-16 sm:pt-28">
      <header className="flex flex-col items-center gap-3 text-center">
        <Badge
          variant="secondary"
          className="rounded-full border border-border/60"
        >
          Pricing
        </Badge>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Analyze more comments. No surprises.
        </h1>
        <p className="max-w-xl text-pretty text-sm text-muted-foreground sm:text-base">
          Start free, upgrade when you outgrow the quota. Same product, just a
          larger monthly cap.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <PlanCard
          name="Free"
          price="$0"
          priceSuffix="forever"
          summary={`${formatNumber(FREE_MONTHLY_CAP)} comments per month`}
          features={[
            "Sign in with Google",
            "Sentiment, top words, emoji insights",
            "Full audience analytics on every video",
            "CSV export",
            "No credit card",
          ]}
          cta={
            state.signedIn ? (
              <Link
                href="/dashboard"
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full",
                })}
              >
                Open dashboard
              </Link>
            ) : (
              <Link
                href="/login?redirect=/dashboard"
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full",
                })}
              >
                Start free
              </Link>
            )
          }
        />

        <PlanCard
          name="Pro"
          price="$19"
          priceSuffix="per month"
          highlight
          summary={`${formatNumber(PRO_MONTHLY_CAP)} comments per month`}
          features={[
            `${formatNumber(PRO_MONTHLY_CAP)} comments per month`,
            "Sentiment, top words, emoji insights",
            "Higher monthly cap, no overage charge",
            "Cancel anytime via customer portal",
            "Priority bug fixes",
          ]}
          cta={
            !state.signedIn ? (
              <Link
                href="/login?redirect=/pricing"
                className={buttonVariants({ className: "w-full" })}
              >
                Sign in to upgrade
              </Link>
            ) : state.tier === "pro" ? (
              <NextLink
                href="/api/portal"
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full",
                })}
              >
                Manage subscription
                <ArrowUpRight className="size-3.5" />
              </NextLink>
            ) : (
              <UpgradeButton fullWidth />
            )
          }
        />
      </div>

      <FaqSection />
    </main>
  )
}

function PlanCard({
  name,
  price,
  priceSuffix,
  summary,
  features,
  cta,
  highlight,
}: {
  name: string
  price: string
  priceSuffix: string
  summary: string
  features: string[]
  cta: React.ReactNode
  highlight?: boolean
}) {
  return (
    <Card
      className={
        highlight
          ? "border-primary/40 bg-primary/[0.02] shadow-xl shadow-primary/5"
          : "border-border/60"
      }
    >
      <CardContent className="flex flex-col gap-5 p-6 sm:p-7">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">{name}</h2>
          {highlight ? (
            <Badge className="rounded-full">Most popular</Badge>
          ) : null}
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-semibold tracking-tight">
              {price}
            </span>
            <span className="text-sm text-muted-foreground">
              {priceSuffix}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
        </div>
        <ul className="flex flex-col gap-2.5 text-sm">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 flex-none text-foreground/70" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <div>{cta}</div>
      </CardContent>
    </Card>
  )
}

function FaqSection() {
  const faqs = [
    {
      q: "What counts as a comment?",
      a: "Every top-level comment or reply we return for a video counts as one. The counter increments only on successful extraction.",
    },
    {
      q: "Do I need a YouTube API key?",
      a: "No. TubeMine uses a shared key on the server. You just paste a URL.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes. Cancel from the customer portal, keep access until the period ends, then downgrade automatically.",
    },
    {
      q: "What about refunds?",
      a: "Email us within 7 days of the charge and we will refund the latest invoice, no questions.",
    },
  ]
  return (
    <section className="mt-4 flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Frequently asked</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {faqs.map((f) => (
          <Card key={f.q} className="border-border/60">
            <CardContent className="flex flex-col gap-2 p-5">
              <p className="text-sm font-medium">{f.q}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {f.a}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
