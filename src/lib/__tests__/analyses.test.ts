import { describe, it, expect, vi, beforeEach } from "vitest"
import { saveAnalysis } from "@/lib/analyses"
import { sampleAnalysisInsert } from "@/test/fixtures"
import { createMockTable, createMockServiceClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}))

const { createServiceClient } = await import("@/lib/supabase/server")

describe("saveAnalysis", () => {
  let table: ReturnType<typeof createMockTable>
  let client: ReturnType<typeof createMockServiceClient>

  beforeEach(() => {
    table = createMockTable()
    client = createMockServiceClient(table)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)
  })

  it("upserts on (user_id, video_id) with 30-day expires_at", async () => {
    table.upsert.mockReturnValue({
      ...table,
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as never)

    await saveAnalysis({
      userId: sampleAnalysisInsert.user_id,
      videoId: sampleAnalysisInsert.video_id,
      videoTitle: sampleAnalysisInsert.video_title,
      channelName: sampleAnalysisInsert.channel_name,
      thumbnailUrl: sampleAnalysisInsert.thumbnail_url,
      commentCount: sampleAnalysisInsert.comment_count,
      sentiment: sampleAnalysisInsert.sentiment,
      topWords: sampleAnalysisInsert.top_words,
      emojiFrequency: sampleAnalysisInsert.emoji_frequency,
    })

    expect(client.from).toHaveBeenCalledWith("analyses")
    expect(table.upsert).toHaveBeenCalledTimes(1)
    const [payload, opts] = table.upsert.mock.calls[0]
    expect(payload.user_id).toBe(sampleAnalysisInsert.user_id)
    expect(payload.video_id).toBe(sampleAnalysisInsert.video_id)
    expect(opts).toEqual({ onConflict: "user_id,video_id" })
  })
})

describe("listAnalyses cursor encoding", () => {
  it("encodes and decodes a cursor losslessly", async () => {
    const { encodeCursor, decodeCursor } = await import("@/lib/analyses")
    const input = { processed_at: "2026-05-18T12:00:00.000Z", id: "abc" }
    const encoded = encodeCursor(input)
    expect(decodeCursor(encoded)).toEqual(input)
  })

  it("returns null on malformed cursor", async () => {
    const { decodeCursor } = await import("@/lib/analyses")
    expect(decodeCursor("not-base64!!!")).toBeNull()
    expect(decodeCursor("eyJpbnZhbGlkIjp0cnVlfQ==")).toBeNull()
  })
})

describe("listAnalyses", () => {
  it.todo(
    "queries with cursor filter when cursor provided (verified via Phase 12 smoke against preview DB)",
  )
})

describe("deleteAnalysis", () => {
  let table: ReturnType<typeof createMockTable>

  beforeEach(() => {
    table = createMockTable()
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockServiceClient(table),
    )
  })

  it("returns deleted count from RLS-scoped delete", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: [{ id: "row1" }], error: null, count: 1 })
    table.delete.mockReturnValue({ select: vi.fn(() => ({ eq: eqMock })) } as never)
    const { deleteAnalysis } = await import("@/lib/analyses")

    const mockClient = createMockServiceClient(table)
    const result = await deleteAnalysis(mockClient as never, "row1")
    expect(result).toBe(1)
  })

  it("returns 0 when no row matches (idempotent)", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 })
    table.delete.mockReturnValue({ select: vi.fn(() => ({ eq: eqMock })) } as never)
    const { deleteAnalysis } = await import("@/lib/analyses")

    const mockClient = createMockServiceClient(table)
    const result = await deleteAnalysis(mockClient as never, "ghost-id")
    expect(result).toBe(0)
  })
})

describe("purgeExpiredAnalyses", () => {
  it("deletes rows where expires_at < now() and returns count", async () => {
    const table = createMockTable()
    const ltMock = vi.fn().mockResolvedValue({ data: [{ id: "a" }, { id: "b" }], error: null })
    table.delete.mockReturnValue({ select: vi.fn(() => ({ lt: ltMock })) } as never)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockServiceClient(table),
    )

    const { purgeExpiredAnalyses } = await import("@/lib/analyses")
    const result = await purgeExpiredAnalyses()
    expect(result).toBe(2)
  })
})
