import { describe, it, expect } from "vitest"
import { safeNext } from "../safe-next"

describe("safeNext", () => {
  const cases: Array<[string | null, string]> = [
    [null, "/"],
    ["", "/"],
    ["/en/history", "/en/history"],
    ["/ru/dashboard", "/ru/dashboard"],
    ["/en/", "/en/"],
    ["/ru/profile", "/ru/profile"],
    ["/en/history/nested/path", "/en/history/nested/path"],
    // open-redirect attempts must collapse to "/"
    ["https://evil.com", "/"],
    ["//evil.com", "/"],
    ["/en/../evil", "/"],
    ["/fr/history", "/"],
    ["?javascript:alert(1)", "/"],
    ["javascript:alert(1)", "/"],
    ["/en/history?q=ok", "/"],
    ["/en/history#frag", "/"],
    ["/en/history@evil.com", "/"],
    ["//en/history", "/"],
  ]

  for (const [input, expected] of cases) {
    it(`maps ${JSON.stringify(input)} to ${JSON.stringify(expected)}`, () => {
      expect(safeNext(input)).toBe(expected)
    })
  }
})
