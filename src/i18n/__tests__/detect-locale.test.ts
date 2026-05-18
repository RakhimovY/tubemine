import { describe, it, expect } from "vitest"
import {
  detectLocaleFromAcceptLanguage,
  readLocaleCookie,
} from "@/i18n/detect-locale"

describe("detectLocaleFromAcceptLanguage", () => {
  const cases: Array<[string | null, "en" | "ru"]> = [
    [null, "en"],
    ["", "en"],
    ["ru-RU,ru;q=0.9", "ru"],
    ["en-US,en;q=0.9", "en"],
    ["fr-FR", "en"],
    // Ukrainian primary; ru as low-priority fallback should NOT route to RU
    // per SPEC section 4.4 (only highest-q tag matters).
    ["uk-UA,uk;q=0.9,ru;q=0.5", "en"],
    ["RU", "ru"],
    ["ru-KZ", "ru"],
    ["en-US,ru;q=0.7", "en"], // top-q is en (implicit 1.0)
    ["ru;q=0.9,en;q=0.7", "ru"], // top-q is ru
    ["ru;q=invalid", "ru"], // malformed q defaults to 1
    ["*", "en"], // wildcard maps to en
  ]
  for (const [input, expected] of cases) {
    it(`maps ${JSON.stringify(input)} to ${expected}`, () => {
      expect(detectLocaleFromAcceptLanguage(input)).toBe(expected)
    })
  }
})

describe("readLocaleCookie", () => {
  it("returns en for 'en'", () => {
    expect(readLocaleCookie("en")).toBe("en")
  })
  it("returns ru for 'ru'", () => {
    expect(readLocaleCookie("ru")).toBe("ru")
  })
  it("returns null for unknown value", () => {
    expect(readLocaleCookie("fr")).toBe(null)
  })
  it("returns null for empty string", () => {
    expect(readLocaleCookie("")).toBe(null)
  })
  it("returns null for undefined", () => {
    expect(readLocaleCookie(undefined)).toBe(null)
  })
})
