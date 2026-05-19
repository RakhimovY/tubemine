import "server-only"
import { createClient } from "@/lib/supabase/server"

export async function authUserId(): Promise<{
  userId: string | null
  userEmail: string | null
}> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { userId: null, userEmail: null }
  }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return { userId: user?.id ?? null, userEmail: user?.email ?? null }
  } catch {
    return { userId: null, userEmail: null }
  }
}
