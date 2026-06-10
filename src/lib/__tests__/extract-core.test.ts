import { describe, it, expect, vi, beforeEach } from "vitest"
const listMock = vi.fn()
vi.mock("@/lib/youtube", () => ({ ytClient: () => ({ commentThreads: { list: listMock }, videos: { list: vi.fn().mockResolvedValue({ data: { items: [] } }) } }) }))
const getUserQuota = vi.fn(); const bumpUserUsage = vi.fn()
vi.mock("@/lib/quota", () => ({ getUserQuota: (...a: unknown[]) => getUserQuota(...a), bumpUserUsage: (...a: unknown[]) => bumpUserUsage(...a) }))
import { extractCommentsForUser, fetchCommentThread, QuotaExceededError, YouTubeQuotaError } from "../extract-core"
beforeEach(() => { listMock.mockReset(); getUserQuota.mockReset(); bumpUserUsage.mockReset() })
function page(items: unknown[], next?: string) { return { data: { items, nextPageToken: next } } }
function comment(text: string) { return { snippet: { topLevelComment: { snippet: { authorDisplayName: "a", textDisplay: text, likeCount: 1, publishedAt: "2026-01-01" } }, totalReplyCount: 0 } } }
describe("extractCommentsForUser", () => {
  it("throws QuotaExceededError when remaining<=0", async () => {
    getUserQuota.mockResolvedValue({ tier: "free", cap: 5000, used: 5000, remaining: 0, resetAt: "2026-07-01T00:00:00.000Z" })
    await expect(extractCommentsForUser({ userId: "u", videoId: "dQw4w9WgXcQ" })).rejects.toBeInstanceOf(QuotaExceededError)
    expect(bumpUserUsage).not.toHaveBeenCalled()
  })
  it("returns comments and bumps usage by actual count, truncatedByQuota false when quota ample", async () => {
    getUserQuota.mockResolvedValue({ tier: "pro", cap: 100000, used: 0, remaining: 100000, resetAt: "x" })
    listMock.mockResolvedValueOnce(page([comment("hi"), comment("yo")]))
    bumpUserUsage.mockResolvedValue(2)
    const r = await extractCommentsForUser({ userId: "u", videoId: "dQw4w9WgXcQ", max: 10 })
    expect(r.extracted).toBe(2)
    expect(bumpUserUsage).toHaveBeenCalledWith("u", 2)
    expect(r.truncatedByQuota).toBe(false)
  })
})
describe("fetchCommentThread error map", () => {
  it("maps google quotaExceeded (0 collected) to YouTubeQuotaError", async () => {
    listMock.mockRejectedValueOnce({ code: 403, errors: [{ reason: "quotaExceeded" }] })
    await expect(fetchCommentThread({ videoId: "dQw4w9WgXcQ", max: 10, order: "time" })).rejects.toBeInstanceOf(YouTubeQuotaError)
  })
  it("empty result with no error returns []", async () => {
    listMock.mockResolvedValueOnce(page([]))
    await expect(fetchCommentThread({ videoId: "dQw4w9WgXcQ", max: 10, order: "time" })).resolves.toEqual([])
  })
})
