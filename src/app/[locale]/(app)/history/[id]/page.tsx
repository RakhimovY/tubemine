import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAnalysisById } from "@/lib/analyses"
import { AnalysisDetailView } from "@/components/analysis-detail-view"
import { getUserQuota } from "@/lib/quota"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const result = await getAnalysisById(supabase, id)
  if (!result.ok && result.reason === "not_found") {
    notFound()
  }
  // For comments_unavailable, render with comments null; detail view shows
  // the legacy/unavailable placeholder per spec §7.
  const row = result.ok ? result.row : result.row
  const quota = await getUserQuota(user.id)
  const tier: "free" | "pro" = quota.tier === "pro" ? "pro" : "free"
  const has_comments =
    row.comments != null || row.comments_blob_path != null

  return <AnalysisDetailView tier={tier} row={{ ...row, has_comments }} />
}
