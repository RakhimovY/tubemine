import { kv } from "@vercel/kv"
import type { NextRequest } from "next/server"

export const MONTHLY_BUDGET = 1000

const kvConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
)

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

export function nextMonthFirstIso(): string {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() + 1, 1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

function budgetKey(ip: string): string {
  return `tubemine:budget:${ip}:${currentMonth()}`
}

export async function getUsed(ip: string): Promise<number> {
  if (!kvConfigured) return 0
  return (await kv.get<number>(budgetKey(ip))) ?? 0
}

export async function recordUsage(ip: string, count: number): Promise<void> {
  if (!kvConfigured) return
  const key = budgetKey(ip)
  const current = (await kv.get<number>(key)) ?? 0
  await kv.set(key, current + count, { ex: 60 * 60 * 24 * 35 })
}

export type BudgetStatus = {
  used: number
  remaining: number
  budget: number
  resetAt: string
}

export async function getBudgetStatus(ip: string): Promise<BudgetStatus> {
  const used = await getUsed(ip)
  return {
    used,
    remaining: Math.max(0, MONTHLY_BUDGET - used),
    budget: MONTHLY_BUDGET,
    resetAt: nextMonthFirstIso(),
  }
}
