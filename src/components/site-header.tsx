import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export async function SiteHeader() {
  // If Supabase isn't configured yet, hide auth UI entirely.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const linkClass = buttonVariants({ variant: "ghost", size: "sm" })

  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-end gap-1 px-6 py-4">
      <Link href="/pricing" className={linkClass}>
        Pricing
      </Link>
      {user ? (
        <Link href="/dashboard" className={linkClass}>
          Dashboard
        </Link>
      ) : (
        <Link href="/login" className={linkClass}>
          Sign in
        </Link>
      )}
    </header>
  )
}
