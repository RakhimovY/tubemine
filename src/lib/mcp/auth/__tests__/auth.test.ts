import { describe, it, expect, vi, beforeEach } from "vitest"
const single = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single }) }), update: () => ({ eq: () => ({}) }) }),
  }),
}))
import { ApiKeyProvider } from "../api-key-provider"
import { verifyTokenForMcp } from "../index"
function req(auth?: string) { return new Request("https://x/mcp", { headers: auth ? { authorization: auth } : {} }) }
beforeEach(() => single.mockReset())
describe("ApiKeyProvider", () => {
  it("returns userId for a valid stored key", async () => {
    single.mockResolvedValue({ data: { user_id: "u1", is_revoked: false } })
    expect(await new ApiKeyProvider().authenticate(req("Bearer tm_sk_abc"))).toEqual({ userId: "u1" })
  })
  it("returns null for a revoked key", async () => {
    single.mockResolvedValue({ data: { user_id: "u1", is_revoked: true } })
    expect(await new ApiKeyProvider().authenticate(req("Bearer tm_sk_abc"))).toBeNull()
  })
  it("returns null for unknown key", async () => {
    single.mockResolvedValue({ data: null })
    expect(await new ApiKeyProvider().authenticate(req("Bearer tm_sk_abc"))).toBeNull()
  })
  it("returns null for a non-tm_sk_ bearer", async () => {
    expect(await new ApiKeyProvider().authenticate(req("Bearer oauthtok"))).toBeNull()
  })
  it("returns null when no auth header", async () => {
    expect(await new ApiKeyProvider().authenticate(req())).toBeNull()
  })
})
describe("verifyTokenForMcp", () => {
  it("adapts a valid key to AuthInfo with extra.userId", async () => {
    single.mockResolvedValue({ data: { user_id: "u1", is_revoked: false } })
    const info = await verifyTokenForMcp(req("Bearer tm_sk_abc"), "tm_sk_abc")
    expect(info?.extra).toMatchObject({ userId: "u1" })
  })
  it("returns undefined (401) on failure", async () => {
    single.mockResolvedValue({ data: null })
    expect(await verifyTokenForMcp(req("Bearer tm_sk_x"), "tm_sk_x")).toBeUndefined()
  })
})
