import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  authUserId: vi.fn(),
}))
vi.mock("@/lib/quota", () => ({
  getUserQuota: vi.fn(),
  PRO_MONTHLY_CAP: 100_000,
  FREE_MONTHLY_CAP: 5_000,
}))

import { authUserId } from "@/lib/auth"
import { getUserQuota } from "@/lib/quota"
import { POST } from "../route"

const mockAuth = authUserId as unknown as ReturnType<typeof vi.fn>
const mockQuota = getUserQuota as unknown as ReturnType<typeof vi.fn>

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const goodBody = {
  format: "json" as const,
  videoId: "dQw4w9WgXcQ",
  videoTitle: "Test",
  channelName: "Chan",
  comments: [
    {
      author: "a",
      text: "t",
      likes: 0,
      replies: 0,
      publishedAt: "2026-05-19T00:00:00Z",
    },
  ],
}

describe("POST /api/export", () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockQuota.mockReset()
  })

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue({ userId: null, userEmail: null })
    const res = await POST(makeRequest(goodBody) as never)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toMatch(/sign in/i)
  })

  it("returns 403 when tier is free", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", userEmail: "u1@x" })
    mockQuota.mockResolvedValue({ tier: "free", cap: 5000, used: 0, remaining: 5000, resetAt: "" })
    const res = await POST(makeRequest(goodBody) as never)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/pro/i)
  })

  it("returns 400 on malformed JSON", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", userEmail: "u1@x" })
    mockQuota.mockResolvedValue({ tier: "pro", cap: 100000, used: 0, remaining: 100000, resetAt: "" })
    const req = new Request("http://localhost/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it("returns 400 when comments array exceeds 10000", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", userEmail: "u1@x" })
    mockQuota.mockResolvedValue({ tier: "pro", cap: 100000, used: 0, remaining: 100000, resetAt: "" })
    const body = {
      ...goodBody,
      comments: Array.from({ length: 10_001 }, () => ({
        author: "a",
        text: "t",
        likes: 0,
        replies: 0,
        publishedAt: "2026-05-19T00:00:00Z",
      })),
    }
    const res = await POST(makeRequest(body) as never)
    expect(res.status).toBe(400)
  })

  it("returns 200 with JSON attachment for Pro user, format=json", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", userEmail: "u1@x" })
    mockQuota.mockResolvedValue({ tier: "pro", cap: 100000, used: 0, remaining: 100000, resetAt: "" })
    const res = await POST(makeRequest(goodBody) as never)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-disposition")).toMatch(/attachment.*\.json/)
    const json = await res.json()
    expect(json.videoId).toBe("dQw4w9WgXcQ")
    expect(json.comments).toHaveLength(1)
  })

  it("returns 200 xlsx buffer for Pro user, format=xlsx", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", userEmail: "u1@x" })
    mockQuota.mockResolvedValue({ tier: "pro", cap: 100000, used: 0, remaining: 100000, resetAt: "" })
    const res = await POST(makeRequest({ ...goodBody, format: "xlsx" }) as never)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toMatch(
      /spreadsheetml\.sheet/,
    )
    expect(res.headers.get("content-disposition")).toMatch(/attachment.*\.xlsx/)
    const buf = await res.arrayBuffer()
    expect(buf.byteLength).toBeGreaterThan(0)
  })

  it("returns 200 JSON for Pro with empty comments[] (edge case 4)", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", userEmail: "u1@x" })
    mockQuota.mockResolvedValue({ tier: "pro", cap: 100000, used: 0, remaining: 100000, resetAt: "" })
    const res = await POST(makeRequest({ ...goodBody, comments: [] }) as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.comments).toEqual([])
  })

  it("returns 200 xlsx for Pro with empty comments[] (edge case 4)", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", userEmail: "u1@x" })
    mockQuota.mockResolvedValue({ tier: "pro", cap: 100000, used: 0, remaining: 100000, resetAt: "" })
    const res = await POST(makeRequest({ ...goodBody, format: "xlsx", comments: [] }) as never)
    expect(res.status).toBe(200)
    const buf = await res.arrayBuffer()
    expect(buf.byteLength).toBeGreaterThan(0)
  })
})
