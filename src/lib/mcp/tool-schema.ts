// zod form chosen per gate 1: app zod v4 (4.4.3) raw shape ACCEPTED.
// Probed empirically against @modelcontextprotocol/sdk 1.29.0 (peer "zod": "^3.25 || ^4.0",
// resolves to the app's zod 4.4.3, no nested copy). registerTool with a raw shape
// inputSchema registers, generates a correct draft-07 JSON Schema, validates, and
// executes a callTool end-to-end. No zod3 alias required.
import { z } from "zod";

export const MCP_MAX_PER_CALL = 2000;

export const getYoutubeCommentsShape = {
  video_url: z.string().describe("A YouTube video URL or bare 11-char video ID"),
  sort: z
    .enum(["relevance", "time"])
    .optional()
    .describe("Comment sort order (default relevance)"),
  max: z
    .number()
    .optional()
    .describe("Max comments to fetch (default 100, capped per call)"),
};
