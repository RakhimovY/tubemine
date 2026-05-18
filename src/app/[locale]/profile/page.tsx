import { setRequestLocale } from "next-intl/server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "@/i18n/navigation"

export const dynamic = "force-dynamic"

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect({ href: `/login?next=/${locale}/profile`, locale })
    return null
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold">Profile</h1>
      <p className="mt-4 text-muted-foreground">
        Account / Plan / Billing / Danger zone land here via Track A.
      </p>
    </main>
  )
}
