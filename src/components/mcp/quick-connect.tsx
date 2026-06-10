import { Link } from "@/i18n/navigation"
import { ClientLogo } from "@/components/brand/client-logo"
import { MCP_CLIENTS, type McpClientGroup } from "@/lib/mcp/clients"

/*
  P2.2: Quick-connect client chips for /ai-access. Server component. Renders
  the 8 MCP_CLIENTS in two groups (oauth, apikey) as chips that each link to
  the per-client anchor on the /mcp-docs page (built in a later task; the
  anchor is safe to reference now). Each chip shows the client logo, name,
  and a small badge ("OAuth soon" for the oauth group, "API key" for the
  apikey group). Visual port of the .quick-clients block in
  docs/design-v3/refs/TubeMine MCP.html.
*/
export function QuickConnect({
  labels,
}: {
  labels: {
    groupOauth: string
    groupApikey: string
    badgeOauth: string
    badgeApikey: string
  }
}) {
  return (
    <div className="quick-groups">
      <QuickGroup
        group="oauth"
        label={labels.groupOauth}
        badge={labels.badgeOauth}
        badgeClass="oauth"
      />
      <QuickGroup
        group="apikey"
        label={labels.groupApikey}
        badge={labels.badgeApikey}
        badgeClass="key"
      />
    </div>
  )
}

function QuickGroup({
  group,
  label,
  badge,
  badgeClass,
}: {
  group: McpClientGroup
  label: string
  badge: string
  badgeClass: "oauth" | "key"
}) {
  const clients = MCP_CLIENTS.filter((c) => c.group === group)
  return (
    <div className="quick-group">
      <div className="quick-group-label">{label}</div>
      <div className="quick-clients">
        {clients.map((c) => (
          <Link key={c.id} href={`/mcp-docs#${c.id}`} className="client-btn">
            <ClientLogo client={c.id} className="client-logo" />
            {c.name}
            <span className={`cb-badge ${badgeClass}`}>{badge}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
