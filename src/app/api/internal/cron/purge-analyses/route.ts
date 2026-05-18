import { NextResponse } from "next/server"
import { purgeExpiredAnalyses } from "@/lib/analyses"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const auth = request.headers.get("authorization")
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const start = Date.now()
  const purged = await purgeExpiredAnalyses()
  const durationMs = Date.now() - start

  console.log("[analyses] cron purge", { purged, durationMs })
  return NextResponse.json({ purged })
}
