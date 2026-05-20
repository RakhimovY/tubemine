import { getTranslations, setRequestLocale } from "next-intl/server"
import { redirect } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/server"
import { getUserQuota } from "@/lib/quota"
import { ProfileSection } from "@/components/profile-section"
import { AccountFields } from "@/components/account-fields"
import { PlanCard } from "@/components/plan-card"
import { BillingCard } from "@/components/billing-card"
import { DangerZone } from "@/components/danger-zone"
import { ProfileToastHandler } from "@/components/profile-toast-handler"

export const dynamic = "force-dynamic"

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("profile")
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect({ href: `/login?next=/${locale}/profile`, locale })
    return null
  }
  // Direct supabase query for subscription row (lib/subscription only exports webhook handlers).
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id)
    .maybeSingle()
  const quota = await getUserQuota(user.id)

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <ProfileToastHandler locale={locale} />
      <h1 className="text-2xl font-bold mb-2">{t("title")}</h1>
      <div className="mt-8">
        <ProfileSection title={t("section_account")}>
          <AccountFields
            avatarUrl={
              (user.user_metadata?.avatar_url as string | undefined) ?? null
            }
            email={user.email ?? ""}
            joinedAt={user.created_at}
            accountId={user.id}
            locale={locale}
          />
        </ProfileSection>
        <ProfileSection title={t("section_plan")}>
          <PlanCard
            tier={quota.tier}
            subscription={subscription}
            quotaUsed={quota.used}
            quotaCap={quota.cap}
            locale={locale}
          />
        </ProfileSection>
        {quota.tier === "pro" ? (
          <ProfileSection title={t("section_billing")}>
            <BillingCard />
          </ProfileSection>
        ) : null}
        <ProfileSection title={t("section_danger")}>
          <DangerZone />
        </ProfileSection>
      </div>
    </main>
  )
}
