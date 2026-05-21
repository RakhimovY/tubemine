import { describe, it, expect } from "vitest"
import { commentsBlobPath } from "@/lib/supabase/storage"

describe("commentsBlobPath", () => {
  const userId = "11111111-2222-3333-4444-555555555555"
  it("formats path as <userId>/<videoId>.json", () => {
    expect(commentsBlobPath(userId, "dQw4w9WgXcQ")).toBe(
      "11111111-2222-3333-4444-555555555555/dQw4w9WgXcQ.json",
    )
  })
  it("rejects invalid uuid", () => {
    expect(() => commentsBlobPath("not-a-uuid", "dQw4w9WgXcQ")).toThrow()
  })
  it("rejects path-traversal videoId", () => {
    expect(() => commentsBlobPath(userId, "../etc/passwd")).toThrow()
  })
  it("rejects YT id wrong length", () => {
    expect(() => commentsBlobPath(userId, "short")).toThrow()
  })
})
