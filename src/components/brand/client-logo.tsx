/*
  Renders the real brand mark for a given MCP client id. Assets live in
  /public/brand (background-stripped, dark-theme friendly): the OpenAI swirl
  with its teal square removed, a white Cursor mark, etc. A single <img> keeps
  every logo uniform; object-fit:contain plus the caller's sizing class
  (.hp-logo / .client-logo / .client-head-logo) control the box.
*/
const ASSET: Record<string, string> = {
  "claude-code": "claude.svg",
  "claude-desktop": "claude.svg",
  chatgpt: "openai.svg",
  codex: "openai.svg",
  cursor: "cursor.svg",
  "gemini-cli": "gemini.svg",
  hermes: "hermes.png",
  openclaw: "openclaw.svg",
}

export function ClientLogo({
  client,
  className,
}: {
  client: string
  className?: string
}) {
  const src = ASSET[client] ?? "openclaw.svg"
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny decorative brand mark; next/image is overkill for inline SVG icons
    <img
      src={`/brand/${src}`}
      alt=""
      aria-hidden="true"
      className={className}
      style={{ objectFit: "contain" }}
      loading="lazy"
      decoding="async"
    />
  )
}
