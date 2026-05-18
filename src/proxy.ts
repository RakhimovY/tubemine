import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import createIntlMiddleware from "next-intl/middleware"
import { routing } from "@/i18n/routing"

const intl = createIntlMiddleware(routing)

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip locale handling for non-localized infrastructure paths.
  const skipIntl =
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt"

  // Run next-intl first so locale resolution and / -> /<locale> redirects fire
  // before we spend cycles on Supabase auth refresh.
  let response = skipIntl
    ? NextResponse.next({ request: { headers: request.headers } })
    : intl(request)

  // If intl issued a redirect (e.g. / -> /en), short-circuit. The downstream
  // request will run through this middleware again with the resolved locale.
  if (response.headers.get("location")) {
    return response
  }

  // Skip auth refresh if Supabase env not configured (e.g. preview env).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return response

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: [
    // Match all routes except static assets and the Polar webhook (raw body).
    "/((?!_next/static|_next/image|favicon.ico|api/polar/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
