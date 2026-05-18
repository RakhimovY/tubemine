import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

vi.mock("@/lib/analyses", () => ({
  purgeExpiredAnalyses: vi.fn(),
}))

const { purgeExpiredAnalyses } = await import("@/lib/analyses")
const { GET } = await import("../route")

describe("cron purge auth", () => {
  const originalSecret = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret"
    vi.mocked(purgeExpiredAnalyses).mockReset()
  })

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret
  })

  it("returns 401 without Authorization header", async () => {
    const req = new Request("http://test/api/internal/cron/purge-analyses")
    const res = await GET(req)
    expect(res.status).toBe(401)
    expect(vi.mocked(purgeExpiredAnalyses)).not.toHaveBeenCalled()
  })

  it("returns 401 with wrong bearer", async () => {
    const req = new Request("http://test/api/internal/cron/purge-analyses", {
      headers: { authorization: "Bearer wrong" },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
    expect(vi.mocked(purgeExpiredAnalyses)).not.toHaveBeenCalled()
  })

  it("returns 401 when CRON_SECRET is unset, even with bearer", async () => {
    delete process.env.CRON_SECRET
    const req = new Request("http://test/api/internal/cron/purge-analyses", {
      headers: { authorization: "Bearer test-secret" },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
    expect(vi.mocked(purgeExpiredAnalyses)).not.toHaveBeenCalled()
  })

  it("returns purged count with valid bearer", async () => {
    vi.mocked(purgeExpiredAnalyses).mockResolvedValueOnce(7)
    const req = new Request("http://test/api/internal/cron/purge-analyses", {
      headers: { authorization: "Bearer test-secret" },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ purged: 7 })
    expect(vi.mocked(purgeExpiredAnalyses)).toHaveBeenCalledTimes(1)
  })
})
