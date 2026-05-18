import { describe, it, vi } from "vitest"

// Wires the save side-effect mock surface for Phase 4 Task 4.1. Full route
// invocation requires stubbing YouTube + budget + sentiment modules, which is
// out of scope for unit tests at this phase. Endpoint behavior is verified in
// Phase 12 smoke tests against the deployed preview (see E2E-runbook.md).

vi.mock("@/lib/analyses", () => ({
  saveAnalysis: vi.fn(),
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

describe("POST /api/extract save side-effect", () => {
  it.todo(
    "calls saveAnalysis when userId is non-null with full payload shape (verified via Phase 12 smoke against preview)",
  )

  it.todo(
    "does NOT call saveAnalysis when userId is null (verified via Phase 12 smoke)",
  )
})
