import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getAnalysesCount } from "@/lib/analyses"

describe("getAnalysesCount", () => {
  it("returns the count when supabase responds with no error", async () => {
    const select = vi.fn().mockResolvedValue({ count: 7, error: null })
    const from = vi.fn().mockReturnValue({ select })
    const sb = { from } as unknown as SupabaseClient

    const result = await getAnalysesCount(sb)

    expect(result).toBe(7)
    expect(from).toHaveBeenCalledWith("analyses")
    expect(select).toHaveBeenCalledWith("id", { count: "exact", head: true })
  })
})
