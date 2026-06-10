import { getTranslations } from "next-intl/server"
import { Link as IntlLink } from "@/i18n/navigation"
import { CodeBlock } from "@/components/ui/codeblock"
import { MCP_CLIENTS, MCP_ENDPOINT } from "@/lib/mcp/clients"

/*
  Reusable, concise MCP setup summary. Rendered as the "MCP / AI access" section
  body inside /docs (the .legal-page scope), and links out to the full
  per-client guide on /mcp-docs (the McpDocs component). Uses only simple markup
  (p / code / CodeBlock / link) so it styles correctly inside .legal-page, and
  reuses the mcp.docs i18n namespace so copy stays in sync with the full page.
*/
export async function McpSetupSummary({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "mcp.docs" })
  const claudeCode = MCP_CLIENTS.find((c) => c.id === "claude-code")

  return (
    <>
      <p>{t("what_p1")}</p>
      <p>
        <code>get_youtube_comments(video_url, sort, max)</code> ,{" "}
        {t("what_tool_returns")}
      </p>
      <p>
        {t("auth_p3_prefix")}{" "}
        <IntlLink href="/ai-access">{t("auth_p3_link")}</IntlLink>
        {t("auth_p3_tail")}
      </p>
      {claudeCode?.connect.command ? (
        <CodeBlock
          label={t("label_terminal")}
          code={claudeCode.connect.command}
        />
      ) : null}
      <p className="config-path">
        {t("hero_server_label")}: <code>{MCP_ENDPOINT}</code>
      </p>
      <div className="callout">
        <p>
          <IntlLink href="/mcp-docs">{t("summary_full_link")}</IntlLink>
        </p>
      </div>
    </>
  )
}
