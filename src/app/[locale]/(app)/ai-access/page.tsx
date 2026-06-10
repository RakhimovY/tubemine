import { getTranslations, setRequestLocale } from "next-intl/server"
import { getKeysAction } from "./actions"
import { QuickConnect } from "@/components/mcp/quick-connect"
import { KeysPanel } from "@/components/mcp/keys-panel"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "mcp" })
  return {
    title: t("meta_title"),
    description: t("meta_description"),
  }
}

export const dynamic = "force-dynamic"

/*
  P2.2: /ai-access (AI Assistant access). Server component rendered inside the
  shared (app) route-group layout, so the topbar + sidebar chrome is already
  mounted by <AppShell /> one level up; this page renders only its own content
  inside `.dashboard-page .mcp-page`. Auth is enforced by the group layout and
  again by getKeysAction() (which throws if not authenticated).

  Visual port of docs/design-v3/refs/TubeMine MCP.html:
    1) Header + status pill (Connected when >= 1 active key, else Not connected)
    2) Quick-connect card: client chips in two groups (OAuth / API key), each
       linking to the /mcp-docs#<id> anchor (docs page ships in a later task)
    3) "Your API keys" panel + 4) "Connected clients" table, both owned by the
       <KeysPanel /> client island so they stay in sync after create/rotate/
       revoke without a reload.
*/
export default async function AiAccessPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const keys = await getKeysAction()
  const connected = keys.length > 0

  const t = await getTranslations("mcp")

  return (
    <div className="dashboard-page mcp-page">
      {/* 1) Header row + status pill */}
      <header className="mcp-head">
        <h1>{t("page_title")}</h1>
        {connected ? (
          <span className="status-pill is-connected">
            <span className="dot" />
            {t("status_connected")}
          </span>
        ) : (
          <span className="status-pill is-disconnected">
            <span className="dot" />
            {t("status_disconnected")}
          </span>
        )}
      </header>

      {/* 2) Quick-connect card */}
      <section className="card" aria-labelledby="mcp-quick-h">
        <div className="card-head">
          <h2 id="mcp-quick-h">{t("quick_heading")}</h2>
        </div>
        <p className="card-sub">{t("quick_sub")}</p>
        <QuickConnect
          labels={{
            groupOauth: t("quick_group_oauth"),
            groupApikey: t("quick_group_apikey"),
            badgeOauth: t("chip_badge_oauth"),
            badgeApikey: t("chip_badge_apikey"),
          }}
        />
        <div className="quick-foot">
          <span className="hint">{t("quick_hint")}</span>
        </div>
      </section>

      {/* 3) Your API keys + 4) Connected clients (client island) */}
      <KeysPanel initialKeys={keys} />
    </div>
  )
}
