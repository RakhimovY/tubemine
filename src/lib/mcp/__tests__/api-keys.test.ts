import { describe, it, expect } from "vitest"
import { generateApiKey, hashApiKey, maskApiKey } from "../api-keys"

describe("api-keys", () => {
  it("generateApiKey returns a tm_sk_ key whose hash matches hashApiKey", () => {
    const { raw, hash } = generateApiKey()
    expect(raw.startsWith("tm_sk_")).toBe(true)
    expect(Buffer.from(raw.slice("tm_sk_".length), "base64url").length).toBe(32)
    expect(raw).not.toBe(hash)
    expect(hashApiKey(raw)).toBe(hash)
  })
  it("hashApiKey is deterministic 64-hex", () => {
    expect(hashApiKey("tm_sk_abc")).toBe(hashApiKey("tm_sk_abc"))
    expect(hashApiKey("tm_sk_abc")).toMatch(/^[0-9a-f]{64}$/)
  })
  it("maskApiKey returns a tm_sk_ masked string with no raw bytes", () => {
    expect(maskApiKey()).toMatch(/^tm_sk_[•]+$/)
  })
})
