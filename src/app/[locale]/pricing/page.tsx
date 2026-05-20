import NextLink from "next/link"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { ArrowUpRight, Check } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getUserQuota } from "@/lib/quota"
import { UpgradeButton } from "../dashboard/upgrade-button"
import { ComparisonTable } from "@/components/comparison-table"
import { TrustLine } from "@/components/trust-line"
import { FaqAccordion } from "@/components/faq-accordion"
import { PricingIntentRedirect } from "@/components/pricing-intent-redirect"

export const metadata = {
  title: "Pricing, TubeMine",
  description:
    "Free up to 5,000 comments per month with a free account. Pro unlocks 100,000 comments per month for $19. Sentiment, top words, and emoji analytics on every plan.",
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
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ intent?: string; plan?: string; next?: string }>
}) {
  const { locale } = await params
  const sp = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations("pricing")
  const state = await loadAuthState()
  const tier: "anonymous" | "free" | "pro" = state.signedIn
    ? state.tier
    : "anonymous"

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 pt-24 pb-16 sm:pt-28">
      {/* Client island: runs ?intent=signup&plan=pro post-OAuth redirect to /api/checkout */}
      <PricingIntentRedirect
        intent={sp.intent ?? null}
        signedIn={state.signedIn}
        tier={tier}
      />

      <header className="flex flex-col items-center gap-3 text-center">
        <Badge
          variant="secondary"
          className="rounded-full border border-border/60"
        >
          {t("page_title")}
        </Badge>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("hero_heading")}
        </h1>
        <p className="max-w-xl text-pretty text-sm text-muted-foreground sm:text-base">
          {t("page_subtitle")}
        </p>
      </header>

      <ComparisonTable />

      <div className="grid gap-5 sm:grid-cols-2 max-w-4xl mx-auto w-full">
        <PlanCard
          name={t("free_plan")}
          price="$0"
          priceSuffix="forever"
          features={[
            t("free_bullets.b1"),
            t("free_bullets.b2"),
            t("free_bullets.b3"),
            t("free_bullets.b4"),
            t("free_bullets.b5"),
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
                {state.tier === "pro" ? t("cta.pro_free") : t("cta.free_free")}
              </Link>
            ) : (
              <Link
                href="/login?next=/dashboard"
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full",
                })}
              >
                {t("cta.anon_free")}
              </Link>
            )
          }
        />

        <PlanCard
          name={t("pro_plan")}
          price="$19"
          priceSuffix="per month"
          highlight
          features={[
            t("pro_bullets.b1"),
            t("pro_bullets.b2"),
            t("pro_bullets.b3"),
            t("pro_bullets.b4"),
            t("pro_bullets.b5"),
          ]}
          footer={t("pro_footer")}
          cta={
            !state.signedIn ? (
              <Link
                href="/login?next=/pricing&intent=signup&plan=pro"
                className={buttonVariants({ className: "w-full" })}
              >
                {t("cta.anon_pro")}
              </Link>
            ) : state.tier === "pro" ? (
              <NextLink
                href="/api/portal"
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full",
                })}
              >
                {t("cta.pro_pro")}
                <ArrowUpRight className="size-3.5" />
              </NextLink>
            ) : (
              <>
                <UpgradeButton fullWidth label={t("start_trial_cta")} />
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {t("trial_subnote")}
                </p>
              </>
            )
          }
        />
      </div>

      <TrustLine />

      <section className="mt-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <h2 className="text-lg font-semibold text-center">{t("faq_title")}</h2>
        <FaqAccordion
          items={[
            { question: t("faq_v2.comment_q"), answer: t("faq_v2.comment_a") },
            { question: t("faq_v2.apikey_q"), answer: t("faq_v2.apikey_a") },
            { question: t("faq_v2.cancel_q"), answer: t("faq_v2.cancel_a") },
            { question: t("faq_v2.refund_q"), answer: t("faq_v2.refund_a") },
          ]}
        />
      </section>
    </main>
  )
}

function PlanCard({
  name,
  price,
  priceSuffix,
  features,
  cta,
  footer,
  highlight,
}: {
  name: string
  price: string
  priceSuffix: string
  features: string[]
  cta: React.ReactNode
  footer?: string
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
            <span className="text-sm text-muted-foreground">{priceSuffix}</span>
          </div>
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
        {footer ? (
          <p className="text-center text-xs text-muted-foreground">{footer}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
