export const MCP_ENDPOINT = "https://tubemine.tech/mcp"

export type McpClientGroup = "oauth" | "apikey"

export type McpClient = {
  id: string
  name: string
  logo: string                 // ClientLogo key, same as id
  group: McpClientGroup
  connect: {
    command?: string
    configPath?: string
    configSnippet?: string
    uiSteps?: string[]
  }
}

export const MCP_CLIENTS: McpClient[] = [
  // 1. Claude Code
  {
    id: "claude-code",
    name: "Claude Code",
    logo: "claude-code",
    group: "oauth",
    connect: {
      command: `claude mcp add --transport http TubeMine ${MCP_ENDPOINT} --header "Authorization: Bearer YOUR_KEY"`,
    },
  },

  // 2. ChatGPT
  {
    id: "chatgpt",
    name: "ChatGPT",
    logo: "chatgpt",
    group: "oauth",
    connect: {
      uiSteps: [
        "Settings > Apps > Advanced > Developer mode",
        `Create app, set MCP server URL ${MCP_ENDPOINT}`,
        "Choose API key auth and paste tm_sk_...",
      ],
    },
  },

  // 3. Cursor
  // VERIFY (gate 4): confirm configPath and snippet format against current Cursor docs before shipping
  {
    id: "cursor",
    name: "Cursor",
    logo: "cursor",
    group: "oauth",
    connect: {
      configPath: "~/.cursor/mcp.json",
      configSnippet: `{
  "mcpServers": {
    "tubemine": {
      "url": "${MCP_ENDPOINT}",
      "headers": {
        "Authorization": "Bearer YOUR_KEY"
      }
    }
  }
}`,
    },
  },

  // 4. Codex
  // VERIFY (gate 4): confirm configPath and TOML key names against current Codex CLI docs before shipping
  {
    id: "codex",
    name: "Codex",
    logo: "codex",
    group: "apikey",
    connect: {
      configPath: "~/.codex/config.toml",
      configSnippet: `[mcp_servers.tubemine]
url = "${MCP_ENDPOINT}"
bearer_token_env_var = "TUBEMINE_MCP_KEY"`,
    },
  },

  // 5. Gemini CLI
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    logo: "gemini-cli",
    group: "apikey",
    connect: {
      configPath: "~/.gemini/settings.json",
      configSnippet: `{
  "mcpServers": {
    "tubemine": {
      "httpUrl": "${MCP_ENDPOINT}",
      "headers": {
        "Authorization": "Bearer YOUR_KEY"
      }
    }
  }
}`,
    },
  },

  // 6. Claude Desktop
  // Note: Desktop remote transport is key-based; uses mcp-remote shim or url+headers block
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    logo: "claude-desktop",
    group: "apikey",
    connect: {
      configPath: "claude_desktop_config.json",
      configSnippet: `{
  "mcpServers": {
    "tubemine": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${MCP_ENDPOINT}",
        "--header",
        "Authorization: Bearer YOUR_KEY"
      ]
    }
  }
}`,
    },
  },

  // 7. Hermes
  // VERIFY (gate 4): confirm configPath and YAML structure against current Hermes docs before shipping
  {
    id: "hermes",
    name: "Hermes",
    logo: "hermes",
    group: "apikey",
    connect: {
      configPath: "~/.hermes/config.yaml",
      configSnippet: `mcp_servers:
  tubemine:
    url: "${MCP_ENDPOINT}"
    headers:
      Authorization: "Bearer YOUR_KEY"`,
    },
  },

  // 8. OpenClaw
  // VERIFY (gate 4): confirm CLI flag syntax against current OpenClaw docs before shipping
  {
    id: "openclaw",
    name: "OpenClaw",
    logo: "openclaw",
    group: "apikey",
    connect: {
      command: `openclaw mcp add TubeMine --url ${MCP_ENDPOINT} --header "Authorization: Bearer YOUR_KEY"`,
    },
  },
]
