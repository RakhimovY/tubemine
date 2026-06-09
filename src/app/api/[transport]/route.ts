import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { verifyTokenForMcp } from "@/lib/mcp/auth"
import { getYoutubeCommentsShape, MCP_MAX_PER_CALL } from "@/lib/mcp/tool-schema"
import { parseYouTubeVideoId } from "@/lib/youtube-url"
import {
  extractCommentsForUser, QuotaExceededError, YouTubeQuotaError,
  CommentsDisabledError, VideoNotFoundError, NoCommentsError,
} from "@/lib/extract-core"

export const runtime = "nodejs"
export const maxDuration = 60

const base = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_youtube_comments",
      {
        description: "Fetch raw YouTube comments (author, text, likes, replies, timestamp) for a video. Your AI does any analysis.",
        inputSchema: getYoutubeCommentsShape,
      },
      async ({ video_url, sort, max }, extra) => {
        const userId = (extra?.authInfo?.extra as { userId?: string } | undefined)?.userId
        if (!userId) return { content: [{ type: "text", text: "Unauthorized." }], isError: true }
        const videoId = parseYouTubeVideoId(String(video_url))
        if (!videoId) return { content: [{ type: "text", text: `Could not parse a YouTube video id from: ${video_url}` }], isError: true }
        const clamped = Math.min(Math.max(1, Math.floor(Number(max ?? 100)) || 100), MCP_MAX_PER_CALL)
        try {
          const r = await extractCommentsForUser({ userId, videoId, max: clamped, order: (sort as "relevance" | "time") ?? "relevance" })
          const payload = { video_id: videoId, count: r.extracted, truncated_by_quota: r.truncatedByQuota, sort: sort ?? "relevance", comments: r.comments }
          return { content: [{ type: "text", text: JSON.stringify(payload) }] }
        } catch (e) {
          if (e instanceof QuotaExceededError) {
            const q = e.quota, reset = q.resetAt.slice(0, 10)
            return { content: [{ type: "text", text: `Monthly comment quota reached: used ${q.used}/${q.cap} on the ${q.tier} plan. Resets ${reset}. Upgrade or wait for the reset.` }], isError: true }
          }
          if (e instanceof YouTubeQuotaError) return { content: [{ type: "text", text: "TubeMine has hit its YouTube API daily quota. Please try again tomorrow." }], isError: true }
          if (e instanceof CommentsDisabledError) return { content: [{ type: "text", text: "Comments are disabled for this video." }], isError: true }
          if (e instanceof VideoNotFoundError) return { content: [{ type: "text", text: "Video not found." }], isError: true }
          if (e instanceof NoCommentsError) return { content: [{ type: "text", text: "No comments found for this video." }], isError: true }
          return { content: [{ type: "text", text: "Unexpected error fetching comments." }], isError: true }
        }
      },
    )
  },
  { serverInfo: { name: "TubeMine", version: "1.0.0" }, capabilities: { tools: {} } },
  { basePath: "/api", maxDuration: 60, verboseLogs: false },
)
const handler = withMcpAuth(base, verifyTokenForMcp, { required: true })
export { handler as GET, handler as POST, handler as DELETE }
