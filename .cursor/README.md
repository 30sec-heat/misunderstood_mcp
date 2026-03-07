# Cursor MCP Configuration

This directory contains the MCP (Model Context Protocol) configuration for Cursor IDE to connect to the MCP Crypto Server.

## Files

- `mcp.json` - Main MCP server configuration for Cursor
- `README.md` - This documentation file

## Configuration Details

The `mcp.json` file configures Cursor to connect to the "crypto-tools" MCP server with the following settings:

- **Server Name**: `crypto-tools` (accessible in Cursor's MCP interface)
- **Command**: `npm run mcp-server` (starts the MCP server)
- **Working Directory**: `/home/MCPCrypto` (update this path for your system)
- **Environment**: Production mode with info-level logging

## Setup Instructions

1. **Update the Path**: Edit `mcp.json` and change the `cwd` field to match your actual installation directory:
   ```bash
   pwd  # Get your current directory
   # Update the "cwd" field in mcp.json to this path
   ```

2. **Restart Cursor**: After making changes, restart Cursor IDE for the configuration to take effect.

3. **Verify Connection**: Start a new AI chat in Cursor and ask about available crypto tools.

## Environment Variables

The configuration includes these environment variables:

- `NODE_ENV=production` - Runs in production mode
- `LOG_LEVEL=info` - Sets logging level to info

For debugging, you can temporarily change these to:
- `NODE_ENV=development`
- `LOG_LEVEL=debug`

## Troubleshooting

If the MCP server doesn't connect:

1. Check that the `cwd` path is correct
2. Ensure the server builds successfully: `npm run build`
3. Test the server manually: `npm run mcp-server`
4. Check Cursor's developer console for MCP connection errors

## Available Tools

Once connected, you'll have access to 100+ crypto analysis tools including:

- Market data and price analysis
- DeFi protocol analysis
- Social sentiment tracking
- Technical analysis and forecasting
- News and research tools
- Trading and options analysis

For detailed setup instructions, see `../CURSOR_MCP_SETUP.md`.