# Archived Files (DEPRECATED)

⚠️ **DEPRECATED** - These files are no longer maintained. Use the main MCP server (`mcp-server-socket.ts`) and web platform (`api-server.ts`) instead.

This directory contains legacy chat-agent and legacy-backends that are not needed for the core MCP server functionality.

## Chat Agent Files (archive/chat-agent/)

- `agent.ts` - CLI-based AI trading agent (Big John/Ysalis)
- `claude-client.ts` - Claude API client for chat conversations
- `SYSTEM-PROMPT.md` - System prompt for the chat agent
- `system-prompt.md` - Alternative system prompt file
- `system-prompt.template.md` - System prompt template
- `start-big-john.sh` - Startup script for the chat agent

These files provided a conversational AI interface but are separate from the core MCP server functionality. They can be restored if needed by moving them back to their original locations.

## Original Locations

- `cli/agent.ts` → Main chat agent CLI
- `src/claude-client.ts` → Claude API integration
- Root directory → System prompt files and startup scripts