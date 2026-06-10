import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const nextConfig: NextConfig = {
  /* config options here */
  // No /mcp rewrite: it breaks mcp-handler's path matching (handler keeps
  // seeing the source path /mcp while configured for /api/mcp). The MCP server
  // is served directly at /api/mcp (see src/lib/mcp/clients.ts MCP_ENDPOINT).
}

export default withNextIntl(nextConfig)
