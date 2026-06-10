import { describe, it, expect } from "vitest"
import { parseYouTubeVideoId } from "../youtube-url"

describe("parseYouTubeVideoId", () => {
  const id = "dQw4w9WgXcQ"
  it("accepts a bare 11-char id", () => expect(parseYouTubeVideoId(id)).toBe(id))
  it("watch?v=", () => expect(parseYouTubeVideoId(`https://www.youtube.com/watch?v=${id}&t=2`)).toBe(id))
  it("youtu.be", () => expect(parseYouTubeVideoId(`https://youtu.be/${id}`)).toBe(id))
  it("shorts", () => expect(parseYouTubeVideoId(`https://youtube.com/shorts/${id}`)).toBe(id))
  it("embed", () => expect(parseYouTubeVideoId(`https://www.youtube.com/embed/${id}`)).toBe(id))
  it("rejects junk", () => expect(parseYouTubeVideoId("not a url")).toBeNull())
  it("rejects wrong-length id", () => expect(parseYouTubeVideoId("abc")).toBeNull())
})
