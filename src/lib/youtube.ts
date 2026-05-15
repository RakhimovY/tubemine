import "server-only"
import { youtube } from "@googleapis/youtube"

export function ytClient() {
  const apiKey = process.env.YT_API_KEY
  if (!apiKey) {
    throw new Error("YT_API_KEY is not configured")
  }
  return youtube({ version: "v3", auth: apiKey })
}
