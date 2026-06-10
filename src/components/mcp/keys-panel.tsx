"use client"

import { useState, useTransition } from "react"
import { useTranslations, useLocale } from "next-intl"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { maskApiKey, type ApiKeyRow } from "@/lib/mcp/mask"
import {
  createKeyAction,
  revokeKeyAction,
} from "@/app/[locale]/(app)/ai-access/actions"
import { ConnectedClients } from "./connected-clients"

/*
  P2.2 (revised): Client island for /ai-access. Owns the live ApiKeyRow[] so the
  "Your API keys" panel and the "Connected clients" table stay in sync after
  create / revoke without a reload.

  Single unified list (no separate "save your new key" box): the just-created
  key appears as the first row showing its full raw value + a copy button + a
  "save it now" note, highlighted; every other key shows the mask (the raw is
  never re-fetchable). `revealed` is tied to a key id, so revoking that key
  clears the reveal too (fixes the old "deleted but the top one stays" bug).

  Rotate was removed: it confused users and is just revoke + create. Only
  Delete (revoke) remains, behind a confirm dialog.
*/
export function KeysPanel({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const t = useTranslations("mcp")
  const locale = useLocale()
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys)
  const [revealed, setRevealed] = useState<{ id: string; raw: string } | null>(
    null,
  )
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const dateFmt = new Intl.DateTimeFormat(
    locale === "ru" ? "ru-RU" : "en-US",
    { year: "numeric", month: "short", day: "numeric" },
  )
  const fmtDate = (iso: string) => dateFmt.format(new Date(iso))
  const fmtLastUsed = (iso: string | null) =>
    iso ? fmtDate(iso) : t("key_last_used_never")

  async function copy(value: string, id: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(id)
      toast.success(t("toast_copied"))
      window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500)
    } catch {
      toast.error(t("toast_error"))
    }
  }

  function handleCreate() {
    startTransition(async () => {
      try {
        const { row, raw } = await createKeyAction()
        setKeys((prev) => [row, ...prev.filter((k) => k.id !== row.id)])
        setRevealed({ id: row.id, raw })
        toast.success(t("toast_created"))
      } catch {
        toast.error(t("toast_error"))
      }
    })
  }

  function handleRevoke(id: string) {
    setConfirmId(null)
    startTransition(async () => {
      try {
        await revokeKeyAction(id)
        setKeys((prev) => prev.filter((k) => k.id !== id))
        // Clear the reveal if it belonged to the key we just removed, so the
        // raw value can never linger after the key is gone.
        setRevealed((r) => (r?.id === id ? null : r))
        toast.success(t("toast_revoked"))
      } catch {
        toast.error(t("toast_error"))
      }
    })
  }

  return (
    <>
      {/* ===== Your API keys (single unified list) ===== */}
      <section className="card" aria-labelledby="mcp-keys-h">
        <div className="card-head">
          <h2 id="mcp-keys-h">{t("keys_heading")}</h2>
          <span className="meta">{t("keys_sub")}</span>
        </div>

        {keys.length === 0 ? (
          <p className="keys-empty">{t("keys_empty")}</p>
        ) : (
          <div className="keys-list">
            {keys.map((k) => {
              const isNew = revealed?.id === k.id
              const shown = isNew ? revealed!.raw : maskApiKey()
              return (
                <div
                  className={isNew ? "key-row is-new" : "key-row"}
                  key={k.id}
                >
                  <div className="key-field">
                    {k.name ? (
                      <span className="key-name">{k.name}</span>
                    ) : null}
                    <code>{shown}</code>
                    {isNew ? (
                      <button
                        type="button"
                        className={
                          copiedId === k.id ? "icon-btn is-copied" : "icon-btn"
                        }
                        aria-label={t("key_copy")}
                        onClick={() => copy(revealed!.raw, k.id)}
                      >
                        <CopyIcon />
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost btn-sm revoke-btn"
                    disabled={isPending}
                    onClick={() => setConfirmId(k.id)}
                  >
                    {t("key_revoke")}
                  </button>
                  <div className="key-meta">
                    <span>
                      {t("key_created_label")} <b>{fmtDate(k.created_at)}</b>
                    </span>
                    <span>
                      {t("key_last_used_label")}{" "}
                      <b>{fmtLastUsed(k.last_used_at)}</b>
                    </span>
                  </div>
                  {isNew ? (
                    <p className="key-row-warning">{t("new_key_warning")}</p>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        <div className="keys-create-row">
          <button
            type="button"
            className="btn btn--primary"
            disabled={isPending}
            onClick={handleCreate}
          >
            <PlusIcon />
            {isPending ? t("keys_creating") : t("keys_create")}
          </button>
        </div>
      </section>

      {/* ===== Connected clients ===== */}
      <ConnectedClients
        keys={keys}
        isPending={isPending}
        fmtDate={fmtDate}
        fmtLastUsed={fmtLastUsed}
        onRevoke={(id) => setConfirmId(id)}
        labels={{
          heading: t("clients_heading"),
          meta: t("clients_meta"),
          colName: t("col_name"),
          colAuth: t("col_auth"),
          colCreated: t("col_created"),
          colLastUsed: t("col_last_used"),
          colAction: t("col_action"),
          authMethod: t("auth_method_apikey"),
          revoke: t("key_revoke"),
          defaultName: t("keys_default_name"),
          emptyTitle: t("clients_empty_title"),
          emptySub: t("clients_empty_sub"),
        }}
      />

      {/* ===== Confirm revoke dialog ===== */}
      <Dialog
        open={confirmId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("revoke_confirm_title")}</DialogTitle>
            <DialogDescription>{t("revoke_confirm_body")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setConfirmId(null)}
            >
              {t("confirm_cancel")}
            </button>
            <button
              type="button"
              className="btn btn--destructive"
              onClick={() => confirmId && handleRevoke(confirmId)}
            >
              {t("confirm_revoke")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ===== Inline icons ===== */
function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x={9} y={9} width={11} height={11} rx={2} />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg
      className="icon icon-sm"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}
