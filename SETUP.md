# MCP Crypto Server Setup Guide

This guide walks you through setting up the MCP Crypto Server with various MCP-compatible clients.

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Git

## Installation

### 1. Clone and Install

```bash
git clone <repository-url>
cd mcp-crypto-server

# Run the automated installer
chmod +x install.sh
./install.sh
```

The installer will:
- Install Node.js dependencies
- Set up PostgreSQL database and tables
- Configure environment variables
- Initialize the knowledge base
- Create MCP client configurations

### 2. Verify Installation

```bash
# Test database connection
npm run test-connection

# Test MCP server
npm run test-mcp

# Start the server manually (optional)
npm start
```

## MCP Client Setup

### Cursor IDE

1. Open Cursor IDE
2. Go to Settings (Cmd/Ctrl + ,)
3. Search for "MCP" or go to Extensions → MCP
4. Add the server configuration:

```json
{
  "mcp.servers": {
    "crypto": {
      "command": "node",
      "args": ["/full/path/to/mcp-crypto-server/mcp-server-socket.ts"],
      "env": {
        "NODE_PATH": "/full/path/to/mcp-crypto-server/node_modules"
      }
    }
  }
}
```

**Alternative using npm:**
```json
{
  "mcp.servers": {
    "crypto": {
      "command": "npm",
      "args": ["start"],
      "cwd": "/full/path/to/mcp-crypto-server"
    }
  }
}
```

### Claude Desktop

1. Locate your Claude Desktop config file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Add the server configuration:

```json
{
  "mcpServers": {
    "crypto": {
      "command": "node",
      "args": ["/full/path/to/mcp-crypto-server/mcp-server-socket.ts"],
      "env": {
        "NODE_PATH": "/full/path/to/mcp-crypto-server/node_modules"
      }
    }
  }
}
```

3. Restart Claude Desktop

### Other MCP Clients

For other MCP-compatible clients, use this general configuration:

- **Command**: `node`
- **Args**: `["/full/path/to/mcp-crypto-server/mcp-server-socket.ts"]`
- **Working Directory**: `/full/path/to/mcp-crypto-server`
- **Environment**: Set `NODE_PATH` to the node_modules directory

## Configuration

### Environment Variables

The installer creates a `.env` file. You can add optional API keys for enhanced functionality:

```bash
# Exchange APIs (for live trading data)
BINANCE_API_KEY=your_binance_key
BINANCE_SECRET_KEY=your_binance_secret
BYBIT_API_KEY=your_bybit_key
BYBIT_SECRET_KEY=your_bybit_secret

# Data Provider APIs
COINALYZE_API_KEY=your_coinalyze_key
EARNINGSFEED_API_KEY=your_earningsfeed_key
MASSIVE_API_KEY=your_polygon_key
CRYPTO_NEWS_API_KEY=your_news_key

# Search APIs
BRAVE_SEARCH_API_KEY=your_brave_key
SERPER_API_KEY=your_serper_key

# AI APIs (for enhanced features)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_claude_key
```

### Telegram Setup (Optional)

For social intelligence features:

```bash
npx tsx utils/telegram-auth.ts
```

Follow the prompts to authenticate with Telegram.

## Testing Your Setup

### 1. Test MCP Connection

In your MCP client (Cursor, Claude Desktop, etc.), try these queries:

```
What's the current Bitcoin price?
```

```
Show me the top DeFi protocols by TVL
```

```
What's the sentiment around Ethereum this week?
```

### 2. Available Tools

Ask your MCP client to list available tools:

```
What tools do you have available for crypto analysis?
```

### 3. Test Specific Modules

```
Get comprehensive quotes for BTC
```

```
Search for recent crypto news about regulation
```

```
What are the current Aave lending rates?
```

## Troubleshooting

### Common Issues

**1. "Command not found" or "Module not found"**
- Ensure Node.js 18+ is installed: `node --version`
- Check that the path to mcp-server-socket.ts is correct
- Verify NODE_PATH points to the node_modules directory

**2. "Database connection failed"**
- Ensure PostgreSQL is running: `pg_isready`
- Check DATABASE_URL in .env file
- Run: `npm run test-connection`

**3. "MCP server failed to start"**
- Check the logs in the `logs/` directory
- Ensure all dependencies are installed: `npm install`
- Try starting manually: `npm start`

**4. "No tools available"**
- Restart your MCP client after configuration changes
- Check the server logs for initialization errors
- Verify the configuration file syntax

### Debug Mode

Start the server with debug logging:

```bash
DEBUG=mcp:* npm start
```

### Log Files

Check these log files for troubleshooting:
- `logs/mcp-server.log` - Main server logs
- `logs/database.log` - Database connection logs
- `logs/modules.log` - Module initialization logs

### Reset Database

If you encounter database issues:

```bash
# Caution: This deletes all data
npm run reset-db
```

## Performance Tips

1. **Database Optimization**: The installer sets up proper indexes, but for large datasets consider:
   ```bash
   # Vacuum and analyze the database periodically
   psql $DATABASE_URL -c "VACUUM ANALYZE;"
   ```

2. **Memory Usage**: For high-frequency usage, increase Node.js memory:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm start
   ```

3. **API Rate Limits**: If you have API keys, the server will use authenticated endpoints with higher rate limits.

## Security Notes

- Keep your `.env` file secure and never commit it to version control
- API keys should have minimal required permissions
- Consider running the server in a containerized environment for production use
- Regularly update dependencies: `npm update`

## Getting Help

- **Documentation**: Check the main README.md and module-specific docs
- **Issues**: Report problems on GitHub Issues
- **Logs**: Always check the `logs/` directory first
- **Community**: Join our [Telegram Community](https://t.me/+f6szsd7zYqdlZDIy)

---

*For more advanced configuration options, see the main [README.md](README.md) file.*