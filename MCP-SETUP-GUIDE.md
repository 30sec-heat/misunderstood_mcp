# MCP Crypto Server Setup Guide

> Complete setup instructions for connecting the MCP Crypto Server to your AI client

## 🚀 Quick Setup

### 1. Install the MCP Server

```bash
git clone <repository-url>
cd mcp-crypto-server
chmod +x install.sh
./install.sh
```

The install script will:
- Install Node.js dependencies
- Set up PostgreSQL database
- Configure environment variables
- Test the MCP server connection

### 2. Configure Your MCP Client

Choose your preferred AI client and follow the setup instructions:

## 📱 Cursor IDE Setup

1. Open Cursor IDE
2. Press `Cmd/Ctrl + Shift + P` to open command palette
3. Type "Preferences: Open User Settings (JSON)"
4. Add the MCP server configuration:

```json
{
  "mcp.servers": {
    "crypto": {
      "command": "tsx",
      "args": ["/absolute/path/to/mcp-crypto-server/mcp-server-socket.ts"],
      "env": {}
    }
  }
}
```

**Important**: Replace `/absolute/path/to/mcp-crypto-server/` with the actual path to your installation.

### Cursor IDE Tips:
- The server will automatically start when you use crypto-related queries
- Use natural language like "What's the current Bitcoin price?"
- Tools are available through the AI chat interface

## 🖥️ Claude Desktop Setup

1. Locate your Claude Desktop config file:
   - **macOS**: `~/.claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Create or edit the file with:

```json
{
  "mcpServers": {
    "crypto": {
      "command": "tsx",
      "args": ["/absolute/path/to/mcp-crypto-server/mcp-server-socket.ts"]
    }
  }
}
```

3. Restart Claude Desktop

### Claude Desktop Tips:
- Look for the 🔌 icon indicating MCP servers are connected
- The crypto server will show as "crypto" in the server list
- All 106 tools are available through natural language queries

## 🛠️ Other MCP Clients

The server uses standard MCP stdio transport and works with any compatible client:

**Command**: `tsx mcp-server-socket.ts`  
**Working Directory**: Your mcp-crypto-server installation path  
**Transport**: stdio

### Example for custom clients:
```javascript
const serverProcess = spawn('tsx', ['mcp-server-socket.ts'], {
  cwd: '/path/to/mcp-crypto-server',
  stdio: ['pipe', 'pipe', 'pipe']
});
```

## 🔧 Configuration

### Environment Variables

The server works out-of-the-box, but you can enhance functionality with API keys:

```bash
# Database (auto-configured by install script)
DATABASE_URL=postgresql://user:pass@localhost/crypto_db

# Optional: Exchange APIs for enhanced data
BINANCE_API_KEY=your_binance_key
BINANCE_SECRET_KEY=your_binance_secret
BYBIT_API_KEY=your_bybit_key
BYBIT_SECRET_KEY=your_bybit_secret

# Optional: Data provider APIs
COINALYZE_API_KEY=your_coinalyze_key
EARNINGSFEED_API_KEY=your_earningsfeed_key
MASSIVE_API_KEY=your_polygon_key

# Optional: AI APIs for enhanced features
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_claude_key
```

### Setting API Keys via MCP

You can also set API keys through the MCP interface:

```
"Set my Binance API key to abc123"
"Configure my OpenAI API key"
"List all configurable API keys"
```

## 🧪 Testing Your Setup

### Test the MCP Connection
```bash
cd mcp-crypto-server
npm run test-mcp
```

This should show:
- ✅ Connected successfully
- ✅ Found 106 available tools
- ✅ Tool call successful

### Test Individual Tools
```bash
# List all available tools
npm run list-tools

# Test database connection
npm run test-connection

# Run comprehensive tests
npm run test-all
```

## 🎯 First Queries to Try

Once connected, try these queries with your MCP client:

**Basic Market Data:**
- "What's the current Bitcoin price?"
- "Show me the top 10 cryptocurrencies by market cap"
- "Get ETH price history for the last week"

**DeFi Intelligence:**
- "What are the best yield farming opportunities on Aave?"
- "Show me TVL data for major DeFi protocols"
- "Find high-liquidity trading pairs on DEXs"

**Social Sentiment:**
- "What's the sentiment around Bitcoin today?"
- "Summarize recent crypto discussions on Reddit"
- "Find trending prediction markets on Polymarket"

**Research:**
- "Search for recent news about Ethereum upgrades"
- "Find information about upcoming token unlocks"
- "Get a comprehensive analysis of SOL price trends"

## 🔍 Troubleshooting

### Common Issues:

**"Server not found" or connection errors:**
- Verify the absolute path in your config
- Ensure `tsx` is installed globally: `npm install -g tsx`
- Check that the server starts manually: `npm run mcp-server`

**"No tools available":**
- Check database connection: `npm run test-connection`
- Verify environment variables are set
- Look at server logs for initialization errors

**Tool execution errors:**
- Some tools require API keys for full functionality
- Check `.env` file configuration
- Use `config_list_allowed_keys` to see what can be configured

### Getting Help:

1. **Check the logs**: Server logs show detailed error information
2. **Test components**: Use individual test scripts to isolate issues
3. **Verify setup**: Run `npm run test-mcp` to validate the connection
4. **Community support**: Join our [Telegram Community](https://t.me/+f6szsd7zYqdlZDIy)

## 📊 Server Status

When the server starts successfully, you'll see:

```
🚀 Starting MCP Crypto Server...
✅ MCP Crypto Server started successfully!
🛠️  106 crypto tools are loaded and ready:
   Market Data: 15 tools
   DeFi: 20 tools
   Social Intelligence: 15 tools
   Technical Analysis: 12 tools
   Trading: 8 tools
   News & Research: 10 tools
   Configuration: 6 tools
   Other: 20 tools
⏳ Ready for MCP client connections (Cursor, Claude Desktop, etc.)...
```

This indicates all modules loaded successfully and the server is ready for connections.

---

*Need help? Check our [main README](README.md) or join the community for support.*