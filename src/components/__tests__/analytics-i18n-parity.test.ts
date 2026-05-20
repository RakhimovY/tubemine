import { describe, expect, it } from "vitest"
import en from "../../../messages/en.json"
import ru from "../../../messages/ru.json"

/*
  TUB-13 M19/M20/M21/M22: sanity-check that every analytics + extractor key
  introduced in this sprint exists in BOTH locales. The check-message-parity
  script already enforces global parity at the build step; these tests act
  as guard rails so a future refactor can't silently drop the analytics
  block.
*/
const REQUIRED_KEYS: Array<string[]> = [
  ["analytics", "top_words", "heading"],
  ["analytics", "top_words", "across_comments"],
  ["analytics", "top_words", "cta_anon"],
  ["analytics", "top_words", "cta_free"],
  ["analytics", "top_words", "footnote"],
  ["analytics", "emoji", "heading"],
  ["analytics", "emoji", "sub"],
  ["analytics", "emoji", "cta_anon"],
  ["analytics", "emoji", "cta_free"],
  ["analytics", "sentiment", "heading"],
  ["analytics", "sentiment", "anon_prefix"],
  ["analytics", "sentiment", "anon_link"],
  ["analytics", "sentiment", "anon_suffix"],
  ["analytics", "sentiment", "ru_experimental"],
  ["analytics", "sentiment", "upgrade_cta"],
  ["analytics", "sentiment", "legend_positive"],
  ["analytics", "sentiment", "legend_neutral"],
  ["analytics", "sentiment", "legend_negative"],
  ["extractor", "input_label"],
  ["extractor", "input_placeholder"],
  ["extractor", "analyzing"],
  ["extractor", "analyze_n_comments"],
  ["extractor", "try_another_url"],
  ["extractor", "col_author"],
  ["extractor", "col_comment"],
  ["extractor", "col_likes"],
  ["extractor", "col_replies"],
  ["extractor", "col_when"],
  ["extractor", "toast_preview_failed"],
  ["extractor", "toast_analysis_failed"],
  ["extractor", "toast_comments_disabled"],
  ["extractor", "toast_network_error"],
  ["extractor", "toast_analyzed"],
  ["extractor", "toast_export_failed"],
  ["extractor", "errors", "url_required"],
  ["extractor", "errors", "url_invalid_youtube"],
  ["common", "save_csv"],
  ["common", "save_json"],
  ["common", "save_excel"],
]

function pick(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj
  for (const k of path) {
    if (cur && typeof cur === "object" && k in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[k]
    } else {
      return undefined
    }
  }
  return cur
}

describe("analytics + extractor i18n keys exist in both locales", () => {
  for (const path of REQUIRED_KEYS) {
    const label = path.join(".")
    it(`EN ${label}`, () => {
      const v = pick(en, path)
      expect(typeof v).toBe("string")
      expect(v).not.toBe("")
    })
    it(`RU ${label}`, () => {
      const v = pick(ru, path)
      expect(typeof v).toBe("string")
      expect(v).not.toBe("")
    })
  }
})

describe("RU ICU plural shape for recent_sub (TUB-13 M20)", () => {
  it("dashboard.recent_sub in EN uses ICU plural for count", () => {
    const v = pick(en, ["dashboard", "recent_sub"])
    expect(v).toBe(
      "{channel} · {when} · {count, plural, one {# comment} other {# comments}}",
    )
  })

  it("dashboard.recent_sub in RU uses ICU plural with one/few/many/other", () => {
    const v = pick(ru, ["dashboard", "recent_sub"]) as string
    expect(v).toContain("plural")
    expect(v).toMatch(/one\s*\{/)
    expect(v).toMatch(/few\s*\{/)
    expect(v).toMatch(/many\s*\{/)
    expect(v).toMatch(/other\s*\{/)
  })
})
