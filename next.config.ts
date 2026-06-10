import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [{ source: "/mcp", destination: "/api/mcp" }]
  },
}

export default withNextIntl(nextConfig)
