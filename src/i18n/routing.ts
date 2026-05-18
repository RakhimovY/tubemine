// next-intl routing config. Sub-path strategy locked in SPEC section 4.3.
// API surface (defineRouting, createNavigation, createMiddleware) verified
// against next-intl 4.x docs via context7 in Task 0.2.

import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: ["en", "ru"],
  defaultLocale: "en",
  localePrefix: "always",
  // We do our own Accept-Language parsing per SPEC section 4.4; next-intl
  // reads the NEXT_LOCALE cookie that LocaleSwitcher (Phase 8) sets.
  localeDetection: false,
  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: true,
    path: "/",
  },
})

export type AppLocale = (typeof routing.locales)[number]
