# Deprecated Chat Agent Components

⚠️ **DEPRECATED**: These components are no longer actively maintained and have been superseded by the pure MCP server implementation.

## What's Here

This directory contains the original chat agent components that provided a CLI-based AI trading agent called "Big John" or "Ysalis". These components included:

- `cli/agent.ts` - Main chat agent CLI
- `cli/setup-wizard.ts` - Setup wizard for chat agent
- `cli/strategy-dashboard.ts` - Strategy management dashboard
- `.ysalis/` - Configuration directory for chat agent

## Migration to Pure MCP Server

The project has been refactored to focus on being a pure MCP (Model Context Protocol) server that provides crypto trading tools to any MCP client such as:

- **Cursor IDE** (with Cline/Claude extension)
- **Claude Desktop**
- **ChatGPT Desktop** (experimental MCP support)
- **Other MCP-compatible clients**

## Why This Change?

1. **Better Integration**: MCP provides standardized tool integration with AI clients
2. **Wider Compatibility**: Works with multiple AI clients, not just a custom chat interface
3. **Simplified Architecture**: Focus on tool provision rather than chat management
4. **Better User Experience**: Users can interact through their preferred AI client

## Using the New MCP Server

Instead of the deprecated chat agent, use the MCP server:

```bash
# Start the MCP server
npm start

# Or use the explicit MCP server command
npm run mcp-server
```

Then connect from your preferred MCP client (Cursor, Claude Desktop, etc.).

## Legacy Usage (Deprecated)

If you need to use the deprecated chat agent components, you can still run them with:

```bash
# Install optional dependencies first
npm install @anthropic-ai/sdk chalk commander cors express openai

# Run deprecated chat agent
npm run deprecated:agent

# Run deprecated setup wizard
npm run deprecated:setup-wizard

# Run deprecated strategy dashboard
npm run deprecated:strategy-dashboard
```

**Note**: These deprecated components may not receive updates and could become incompatible with future versions of dependencies.

## Recommended Migration Path

1. **Stop using the chat agent CLI**
2. **Set up MCP client integration** (see `MCP-SETUP-GUIDE.md`)
3. **Use your preferred AI client** with the MCP server for crypto tools
4. **Remove deprecated components** once you've confirmed the MCP setup works for your needs

For detailed setup instructions, see the main `README.md` and `MCP-SETUP-GUIDE.md` files.