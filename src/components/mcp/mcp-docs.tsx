import { getTranslations } from "next-intl/server"
import { Link as IntlLink } from "@/i18n/navigation"
import { CodeBlock } from "@/components/ui/codeblock"
import { ClientLogo } from "@/components/brand/client-logo"
import { MCP_CLIENTS, MCP_ENDPOINT } from "@/lib/mcp/clients"

const SUPPORT_EMAIL = "hello@tubemine.app"

/*
  Shared MCP setup docs body. Server component.

  Numbered sections matching the v3 design ref (docs/design-v3/refs/
  "TubeMine MCP Docs.html"), but documenting ONLY the single
  get_youtube_comments tool. The second tool from the ref
  (analyze_youtube_comments) is intentionally dropped: the MCP server
  returns the raw comment thread and the user's own AI does any analysis.

  Layout mirrors the legal pages (sticky TOC aside + .legal-article).
  This component renders inside a .legal-page.mcp-docs-page wrapper so it
  reuses the legal CSS plus the MCP-docs-only additions in globals.css.

  Per-client config snippets / commands come from src/lib/mcp/clients.ts,
  not from i18n. Section copy comes from the mcp.docs namespace.
*/
export async function McpDocs({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "mcp.docs" })

  // 01 What + 02 Authentication, then one numbered section per client,
  // then 11 Limits + 12 Troubleshooting. Numbers are sequential.
  const setupStart = 3
  const setupEnd = setupStart + MCP_CLIENTS.length - 1 // 10 for 8 clients
  const limitsNum = setupEnd + 1 // 11
  const troubleNum = setupEnd + 2 // 12

  const pad = (n: number) => String(n).padStart(2, "0")

  return (
    <main>
      {/* ===================== HERO ===================== */}
      <section className="legal-hero">
        <div className="container">
          <span className="legal-badge">{t("hero_badge")}</span>
          <h1 className="legal-title">{t("hero_title")}</h1>
          <p className="legal-sub">{t("hero_sub")}</p>
          <p className="legal-updated">
            {t("hero_server_label")}: {MCP_ENDPOINT}
          </p>
        </div>
      </section>

      {/* ===================== BODY ===================== */}
      <section className="legal-body">
        <div className="container legal-grid">
          {/* ----- TOC ----- */}
          <aside className="toc" aria-label={t("toc_aria")}>
            <h3>{t("toc_heading")}</h3>
            <ol>
              <li>
                <a href="#what">{t("toc_what")}</a>
              </li>
              <li>
                <a href="#auth">{t("toc_auth")}</a>
              </li>
              {MCP_CLIENTS.map((client) => (
                <li key={client.id}>
                  <a href={`#${client.id}`}>
                    {t("toc_setup_prefix")}: {client.name}
                  </a>
                </li>
              ))}
              <li>
                <a href="#limits">{t("toc_limits")}</a>
              </li>
              <li>
                <a href="#trouble">{t("toc_trouble")}</a>
              </li>
            </ol>
          </aside>

          {/* ----- Article ----- */}
          <article className="legal-article">
            {/* 01 What is TubeMine MCP */}
            <section id="what">
              <h2>
                <span className="num">01</span> {t("what_title")}
              </h2>
              <p>{t("what_p1")}</p>
              <div className="spec-grid">
                <div className="spec-card">
                  <p className="spec-name">
                    <span className="fn">get_youtube_comments</span>(
                    <span className="arg">video_url, sort, max</span>)
                  </p>
                  <div className="spec-params">
                    <div className="spec-param">
                      <span className="pn">video_url</span>
                      <span className="pd">{t("what_param_video_url")}</span>
                    </div>
                    <div className="spec-param">
                      <span className="pn">sort</span>
                      <span className="pd">{t("what_param_sort")}</span>
                    </div>
                    <div className="spec-param">
                      <span className="pn">max</span>
                      <span className="pd">{t("what_param_max")}</span>
                    </div>
                  </div>
                  <dl className="spec-row">
                    <dt>{t("what_tool_returns_label")}</dt>
                    <dd>{t("what_tool_returns")}</dd>
                  </dl>
                </div>
              </div>
            </section>

            {/* 02 Authentication */}
            <section id="auth">
              <h2>
                <span className="num">02</span> {t("auth_title")}
              </h2>
              <p>{t("auth_p1")}</p>
              <p>{t("auth_p2_prefix")}</p>
              <p>
                {t("auth_p3_prefix")}{" "}
                <IntlLink href="/ai-access">{t("auth_p3_link")}</IntlLink>
                {t("auth_p3_tail")}
              </p>
              <div className="callout">
                <p>{t("auth_callout")}</p>
              </div>
            </section>

            {/* 03..10 One section per client */}
            {MCP_CLIENTS.map((client, i) => {
              const num = pad(setupStart + i)
              const { command, configPath, configSnippet, uiSteps } =
                client.connect
              return (
                <section key={client.id} id={client.id}>
                  <h2>
                    <span className="num">{num}</span>
                    <ClientLogo
                      client={client.id}
                      className="client-head-logo"
                    />
                    {t("toc_setup_prefix")}: {client.name}
                  </h2>

                  {command && (
                    <>
                      <p>{t("setup_command_p")}</p>
                      <CodeBlock label={t("label_terminal")} code={command} />
                    </>
                  )}

                  {configPath && configSnippet && (
                    <>
                      <p>{t("setup_config_p_prefix")}</p>
                      <p className="config-path">
                        {t("setup_config_file_intro")}{" "}
                        <code>{configPath}</code>
                      </p>
                      <CodeBlock label={configPath} code={configSnippet} />
                    </>
                  )}

                  {uiSteps && uiSteps.length > 0 && (
                    <>
                      <p>{t("setup_steps_p")}</p>
                      <ol className="step-list">
                        {uiSteps.map((step, si) => (
                          <li key={si}>{step}</li>
                        ))}
                      </ol>
                    </>
                  )}

                  {client.group === "oauth" && (
                    <p className="note-inline">{t("setup_oauth_note")}</p>
                  )}
                </section>
              )
            })}

            {/* 11 Usage and limits */}
            <section id="limits">
              <h2>
                <span className="num">{pad(limitsNum)}</span> {t("limits_title")}
              </h2>
              <p>{t("limits_p1")}</p>
              <ul className="def-list">
                <li>
                  <span className="term">{t("limits_free_term")}</span>
                  {t("limits_free_text")}
                </li>
                <li>
                  <span className="term">{t("limits_pro_term")}</span>
                  {t("limits_pro_text")}
                </li>
              </ul>
              <p>{t("limits_p2")}</p>
              <p>{t("limits_p3")}</p>
            </section>

            {/* 12 Troubleshooting */}
            <section id="trouble">
              <h2>
                <span className="num">{pad(troubleNum)}</span>{" "}
                {t("trouble_title")}
              </h2>
              <p>{t("trouble_p1")}</p>
              <ul className="def-list">
                <li>
                  <span className="term">{t("trouble_key_term")}</span>
                  {t("trouble_key_text_prefix")}{" "}
                  <IntlLink href="/ai-access">
                    <code>{t("trouble_key_link")}</code>
                  </IntlLink>{" "}
                  {t("trouble_key_text_tail")}
                </li>
                <li>
                  <span className="term">{t("trouble_notools_term")}</span>
                  {t("trouble_notools_text")}
                </li>
                <li>
                  <span className="term">{t("trouble_handlers_term")}</span>
                  {t("trouble_handlers_text")}
                </li>
              </ul>
              <p>
                {t("trouble_contact_prefix")}{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{" "}
                {t("trouble_contact_tail")}
              </p>
            </section>
          </article>
        </div>
      </section>
    </main>
  )
}
