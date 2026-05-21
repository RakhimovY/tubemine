import { describe, it, expect } from "vitest"
import { computeExpiresAt } from "@/lib/analyses"

describe("computeExpiresAt", () => {
  it("free = +30 days", () => {
    const now = new Date("2026-05-21T00:00:00Z")
    const got = computeExpiresAt(now, "free")
    expect(got.toISOString()).toBe("2026-06-20T00:00:00.000Z")
  })
  it("pro = +100 days", () => {
    const now = new Date("2026-05-21T00:00:00Z")
    const got = computeExpiresAt(now, "pro")
    expect(got.toISOString()).toBe("2026-08-29T00:00:00.000Z")
  })
})
