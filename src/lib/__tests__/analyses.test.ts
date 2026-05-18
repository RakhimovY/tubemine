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
