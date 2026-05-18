import { routing } from "./routing"

export type AppLocale = (typeof routing.locales)[number]

/**
 * SPEC section 4.4: find the highest-quality tag in Accept-Language. If it
 * starts with "ru" (case-insensitive), serve "ru". Else "en". Missing or
 * malformed header returns "en".
 */
export function detectLocaleFromAcceptLanguage(
  acceptLanguage: string | null,
): AppLocale {
  if (!acceptLanguage) return "en"

  const parts = acceptLanguage
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((part) => {
      const [tag, ...params] = part.split(";").map((s) => s.trim())
      let q = 1
      for (const param of params) {
        const m = param.match(/^q\s*=\s*([0-9.]+)$/i)
        if (m) {
          const v = Number.parseFloat(m[1])
          if (!Number.isNaN(v)) q = v
        }
      }
      return { tag: tag.toLowerCase(), q }
    })
    .filter((x) => x.tag && !Number.isNaN(x.q))

  if (parts.length === 0) return "en"

  parts.sort((a, b) => b.q - a.q)
  const top = parts[0]
  return top.tag.startsWith("ru") ? "ru" : "en"
}

/**
 * Validate cookie value against the locale allow-list. Per SPEC section 4.4:
 * unknown values fall through to detection.
 */
export function readLocaleCookie(value: string | undefined): AppLocale | null {
  if (!value) return null
  return (routing.locales as readonly string[]).includes(value)
    ? (value as AppLocale)
    : null
}
