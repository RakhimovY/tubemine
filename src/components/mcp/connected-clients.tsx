"use client"

import type { ApiKeyRow } from "@/lib/mcp/mask"

/*
  P2.2: "Connected clients" table for /ai-access. Each active API key is one
  authorization row. The data model has no per-client mapping, so the row
  represents the key itself: its name, auth method (always API key for now,
  OAuth lands in a later phase), created date, last used, and a Revoke action.
  Mobile (<560px) stacks each cell with a data-label, driven by the CSS in
  globals.css under `.tm-design .mcp-page .mcp-table`. When there are no
  active keys, the empty state is shown instead of the table.
*/
type Labels = {
  heading: string
  meta: string
  colName: string
  colAuth: string
  colCreated: string
  colLastUsed: string
  colAction: string
  authMethod: string
  revoke: string
  defaultName: string
  emptyTitle: string
  emptySub: string
}

export function ConnectedClients({
  keys,
  isPending,
  fmtDate,
  fmtLastUsed,
  onRevoke,
  labels,
}: {
  keys: ApiKeyRow[]
  isPending: boolean
  fmtDate: (iso: string) => string
  fmtLastUsed: (iso: string | null) => string
  onRevoke: (id: string) => void
  labels: Labels
}) {
  return (
    <section className="card" aria-labelledby="mcp-clients-h">
      <div className="card-head">
        <h2 id="mcp-clients-h">{labels.heading}</h2>
        {keys.length > 0 ? <span className="meta">{labels.meta}</span> : null}
      </div>

      {keys.length === 0 ? (
        <div className="mcp-empty">
          <span className="badge-circle">
            <PlugIcon />
          </span>
          <div className="title">{labels.emptyTitle}</div>
          <div className="sub">{labels.emptySub}</div>
        </div>
      ) : (
        <div className="mcp-table-wrap">
          <table className="mcp-table">
            <thead>
              <tr>
                <th>{labels.colName}</th>
                <th>{labels.colAuth}</th>
                <th>{labels.colCreated}</th>
                <th>{labels.colLastUsed}</th>
                <th className="right">{labels.colAction}</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td data-label={labels.colName}>
                    <span className="mcp-client">
                      <span className="mark">
                        <KeyIcon />
                      </span>
                      {k.name || labels.defaultName}
                    </span>
                  </td>
                  <td data-label={labels.colAuth}>
                    <span className="method-tag key">{labels.authMethod}</span>
                  </td>
                  <td data-label={labels.colCreated}>
                    <span className="mcp-when">{fmtDate(k.created_at)}</span>
                  </td>
                  <td data-label={labels.colLastUsed}>
                    <span className="mcp-when">
                      {fmtLastUsed(k.last_used_at)}
                    </span>
                  </td>
                  <td className="right">
                    <button
                      type="button"
                      className="btn btn--ghost btn-sm revoke-btn"
                      disabled={isPending}
                      onClick={() => onRevoke(k.id)}
                    >
                      {labels.revoke}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function KeyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx={7.5} cy={15.5} r={4.5} />
      <path d="m10.7 12.3 8.3-8.3" />
      <path d="m16 5 3 3" />
      <path d="m19 8 2-2" />
    </svg>
  )
}
function PlugIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 2v6" />
      <path d="M15 2v6" />
      <path d="M6 8h12v2a6 6 0 0 1-12 0Z" />
      <path d="M12 16v6" />
    </svg>
  )
}
