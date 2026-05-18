// next-intl routing config. Sub-path strategy locked in SPEC §4.3.
// API surface (defineRouting, createNavigation, createMiddleware) verified
// against next-intl 4.x docs via context7 in Task 0.2.

import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: ["en", "ru"],
  defaultLocale: "en",
  localePrefix: "always",
})

export type AppLocale = (typeof routing.locales)[number]
