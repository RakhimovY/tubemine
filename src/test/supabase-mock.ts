import { vi } from "vitest"

export type MockTable = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  lt: ReturnType<typeof vi.fn>
  or: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
}

export function createMockTable(): MockTable {
  const chain = {} as MockTable
  for (const k of [
    "select", "insert", "update", "delete", "upsert",
    "eq", "lt", "or", "order", "limit",
  ] as const) {
    chain[k] = vi.fn(() => chain)
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }))
  return chain
}

export function createMockServiceClient(table: MockTable) {
  return {
    from: vi.fn(() => table),
    auth: {
      admin: {
        deleteUser: vi.fn(() => Promise.resolve({ data: null, error: null })),
      },
    },
  }
}
