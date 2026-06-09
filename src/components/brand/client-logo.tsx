import ClaudeLogo from "./claude-logo"
import OpenAILogo from "./openai-logo"
import CursorLogo from "./cursor-logo"
import GeminiLogo from "./gemini-logo"
import NousLogo from "./nous-logo"
import OpenClawLogo from "./openclaw-logo"

const MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "claude-code": ClaudeLogo, "claude-desktop": ClaudeLogo,
  chatgpt: OpenAILogo, codex: OpenAILogo,
  cursor: CursorLogo, "gemini-cli": GeminiLogo,
  hermes: NousLogo, openclaw: OpenClawLogo,
}
export function ClientLogo({ client, className }: { client: string; className?: string }) {
  const Logo = MAP[client] ?? OpenClawLogo
  return <Logo className={className} />
}
