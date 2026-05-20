import { describe, expect, it, vi, beforeEach } from "vitest"

// Mock the Supabase server client before the SUT imports it.
const maybeSingleMock = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: maybeSingleMock,
        }),
      }),
    }),
  })),
}))

import { loadTrialState } from "@/components/trial-banner"

beforeEach(() => {
  maybeSingleMock.mockReset()
})

describe("loadTrialState", () => {
  it("returns null when no subscriptions row exists", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null })
    expect(await loadTrialState("user-1")).toBeNull()
  })

  it("returns null when status is 'active'", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        status: "active",
        current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      },
    })
    expect(await loadTrialState("user-1")).toBeNull()
  })

  it("returns null when status is 'canceled' (mid-trial cancel)", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        status: "canceled",
        current_period_end: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      },
    })
    expect(await loadTrialState("user-1")).toBeNull()
  })

  it("returns null when status is 'trialing' but current_period_end is null", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { status: "trialing", current_period_end: null },
    })
    expect(await loadTrialState("user-1")).toBeNull()
  })

  it("returns null when status is 'trialing' but current_period_end is in the past", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        status: "trialing",
        current_period_end: new Date(Date.now() - 1000).toISOString(),
      },
    })
    expect(await loadTrialState("user-1")).toBeNull()
  })

  it("returns days branch with daysLeft = 3 when 60h remain (Math.ceil(2.5) = 3)", async () => {
    const endsAt = new Date(Date.now() + 60 * 60 * 60 * 1000).toISOString()
    maybeSingleMock.mockResolvedValueOnce({
      data: { status: "trialing", current_period_end: endsAt },
    })
    const state = await loadTrialState("user-1")
    expect(state).toMatchObject({ kind: "active", daysLeft: 3, canceled: false })
  })

  it("returns today branch when less than 24h remain", async () => {
    const endsAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    maybeSingleMock.mockResolvedValueOnce({
      data: { status: "trialing", current_period_end: endsAt },
    })
    const state = await loadTrialState("user-1")
    expect(state).toMatchObject({ kind: "today", canceled: false })
  })

  it("returns canceled=true when cancel_at_period_end is true (mid-trial cancel)", async () => {
    const endsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        status: "trialing",
        current_period_end: endsAt,
        cancel_at_period_end: true,
      },
    })
    const state = await loadTrialState("user-1")
    expect(state).toMatchObject({ kind: "active", canceled: true })
  })

  it("returns canceled=false when cancel_at_period_end is null or missing", async () => {
    const endsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        status: "trialing",
        current_period_end: endsAt,
        cancel_at_period_end: null,
      },
    })
    const state = await loadTrialState("user-1")
    expect(state).toMatchObject({ canceled: false })
  })
})
