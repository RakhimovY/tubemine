import { describe, expect, it } from "vitest"
import { createFormatter, createTranslator } from "next-intl"
import en from "../../../messages/en.json"
import ru from "../../../messages/ru.json"

/*
  TUB-13 M20: validate that dashboard.recent_sub renders correctly for
  the canonical Russian plural pivots (1, 2, 5, 11, 21) and that English
  picks one vs. other for 1 vs. >1. createTranslator is the offline-safe
  next-intl helper that uses IntlMessageFormat under the hood, same code
  path as runtime page rendering.
*/

function t(locale: "en" | "ru") {
  return createTranslator({
    locale,
    messages: locale === "en" ? en : ru,
    formats: undefined,
  })
}

void createFormatter // not used; keep import for parity awareness

describe("dashboard.recent_sub ICU plural (M20)", () => {
  it("EN renders 'comment' for 1, 'comments' for 2+", () => {
    const tr = t("en")
    const a = tr("dashboard.recent_sub", {
      channel: "ch",
      when: "today",
      count: 1,
    })
    const b = tr("dashboard.recent_sub", {
      channel: "ch",
      when: "today",
      count: 2,
    })
    expect(a).toContain("1 comment")
    expect(a).not.toContain("1 comments")
    expect(b).toContain("2 comments")
  })

  it("RU renders correct plural for 1, 2, 5, 11, 21", () => {
    const tr = t("ru")
    const out = (n: number) =>
      tr("dashboard.recent_sub", {
        channel: "ch",
        when: "сегодня",
        count: n,
      })
    // RU: 1 -> комментарий (one), 2/3/4 -> комментария (few),
    // 5..20 -> комментариев (many), 21 -> комментарий (one)
    expect(out(1)).toContain("1 комментарий")
    expect(out(2)).toContain("2 комментария")
    expect(out(5)).toContain("5 комментариев")
    expect(out(11)).toContain("11 комментариев")
    expect(out(21)).toContain("21 комментарий")
  })
})
