import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Components cannot set cookies. Middleware handles refresh.
          }
        },
      },
    },
  )
}

export function createServiceClient() {
  // Service role bypasses RLS. Use only in webhooks and trusted server jobs.
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

/**
 * Per-request memoized auth lookup. RSC-ONLY.
 *
 * Use ONLY from server components rendered inside the React render tree
 * (layouts, pages under `src/app/[locale]/(app)/`).
 *
 * Do NOT call from:
 *   - Route handlers (`app/api/.../route.ts`)
 *   - Server actions
 *   - Middleware (`middleware.ts`)
 *   - Webhook handlers
 *
 * `react.cache` only dedupes within a single RSC render pass. Calling from
 * non-RSC contexts gives no dedup and may surprise future readers; use the
 * direct `(await createClient()).auth.getUser()` pattern there instead.
 */
export const getCachedUser = cache(async () => {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  return user
})
