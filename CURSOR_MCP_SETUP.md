# Cursor MCP Configuration Guide

This guide provides step-by-step instructions for setting up the MCP Crypto Server with Cursor IDE.

## Quick Setup

### 1. Prerequisites

- Node.js 18+ installed
- PostgreSQL 12+ running
- Cursor IDE installed
- This MCP Crypto Server project cloned and set up

### 2. Install Dependencies

```bash
# Install the MCP Crypto Server (if not already done)
./install.sh

# Or manually:
npm install
npm run build
```

### 3. Configure Cursor MCP

The `.cursor/mcp.json` file in this project is already configured for Cursor. It contains:

```json
{
  "mcpServers": {
    "crypto-tools": {
      "command": "npm",
      "args": ["run", "mcp-server"],
      "cwd": "/home/MCPCrypto",
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      },
      "disabled": false
    }
  }
}
```

### 4. Update Path for Your System

**IMPORTANT**: Update the `cwd` path in `.cursor/mcp.json` to match your actual installation directory:

```bash
# Find your current directory
pwd

# Update the cwd field in .cursor/mcp.json to this path
```

### 5. Verify Configuration

Test that the server starts correctly:

```bash
# Test the MCP server
npm run mcp-server

# You should see output like:
# 🚀 Starting MCP Crypto Server...
# ✅ MCP Crypto Server started successfully!
# 🛠️ XX crypto tools are loaded and ready
```

Press `Ctrl+C` to stop the test server.

## Advanced Configuration

### Environment Variables

You can add additional environment variables to the MCP configuration for enhanced functionality:

```json
{
  "mcpServers": {
    "crypto-tools": {
      "command": "npm",
      "args": ["run", "mcp-server"],
      "cwd": "/path/to/your/MCPCrypto",
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info",
        "MAX_CONCURRENT_REQUESTS": "10",
        "REQUEST_TIMEOUT": "30000",
        "VERBOSE_LOGGING": "false"
      },
      "disabled": false
    }
  }
}
```

### Debug Mode

For troubleshooting, enable debug mode:

```json
{
  "mcpServers": {
    "crypto-tools": {
      "command": "npm",
      "args": ["run", "mcp-server"],
      "cwd": "/path/to/your/MCPCrypto",
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug",
        "VERBOSE_LOGGING": "true"
      },
      "disabled": false
    }
  }
}
```

## Using the MCP Server in Cursor

### 1. Start a New Chat

Open Cursor and start a new AI chat session.

### 2. Available Tools

The MCP server provides 50+ tools across these categories:

#### Market Data & Analysis
- `get_comprehensive_quotes` - Multi-exchange price comparison
- `analysis_comprehensive` - Technical analysis with indicators
- `liquidations_comprehensive_analysis` - Liquidation tracking

#### DeFi Intelligence
- `aave_get_all_rates_and_history` - Lending/borrowing rates
- `defillama_discover_protocols` - DeFi protocol discovery
- `dexscreener_analyze_pair` - DEX pair analysis

#### Social Intelligence
- `sentiment_get_sentiment_messages` - Social sentiment analysis
- `telegram_search_messages` - Telegram monitoring
- `reddit_search_posts` - Reddit analysis

#### Options & Derivatives
- `deribit_get_option_chain` - Options data with Greeks
- `deribit_analyze_iv` - Implied volatility analysis

#### News & Research
- `news_get_latest` - Multi-source crypto news
- `knowledge_search` - Search research files

### 3. Example Queries

Try these example queries in Cursor:

```
What's the current Bitcoin price across different exchanges?
```

```
Analyze Ethereum's technical indicators and provide a forecast
```

```
What's the sentiment around Solana in crypto communities?
```

```
Find high-yield DeFi opportunities with low risk
```

```
Get the latest crypto news about regulation
```

## Troubleshooting

### Common Issues

**1. "MCP server not found" or "Connection failed"**

- Verify the `cwd` path in `.cursor/mcp.json` is correct
- Ensure the server builds successfully: `npm run build`
- Check that Node.js 18+ is installed: `node --version`

**2. "Database connection failed"**

- Ensure PostgreSQL is running: `pg_isready`
- Check your `.env` file configuration
- Test database connection: `npm run test-connection`

**3. "No tools available"**

- Restart Cursor after configuration changes
- Check server logs for initialization errors
- Verify all dependencies are installed: `npm install`

**4. "Server crashes on startup"**

- Check the `.env` file exists and is properly configured
- Review logs in the `logs/` directory
- Try starting in debug mode (see Advanced Configuration above)

### Manual Testing

Test the server independently of Cursor:

```bash
# Test MCP server startup
npm run mcp-server

# Test database connection
npm run test-connection

# Run comprehensive tests
npm run test-mcp
```

### Log Files

Check these files for troubleshooting:

- `logs/mcp-server.log` - Main server logs
- `logs/database.log` - Database connection logs
- `logs/modules.log` - Module initialization logs

### Reset Configuration

If you need to start over:

```bash
# Reset database (caution: deletes all data)
npm run reset-db

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Security Notes

- The server runs entirely on your local machine
- No data is sent to external services without your explicit API keys
- Keep your `.env` file secure and never commit it to version control
- API keys should have minimal required permissions
- Regularly update dependencies: `npm update`

## Performance Tips

1. **Memory Usage**: For high-frequency usage:
   ```json
   {
     "env": {
       "NODE_OPTIONS": "--max-old-space-size=4096"
     }
   }
   ```

2. **Database Optimization**: Periodically optimize the database:
   ```bash
   psql $DATABASE_URL -c "VACUUM ANALYZE;"
   ```

3. **API Rate Limits**: Add API keys to `.env` for higher rate limits

## Getting Help

- **Documentation**: See `README.md` for comprehensive setup
- **API Docs**: Check `api_docs/` for tool specifications
- **Issues**: Report problems with full error logs
- **Logs**: Always check the `logs/` directory first

---

## Configuration File Reference

### Minimal Configuration
```json
{
  "mcpServers": {
    "crypto-tools": {
      "command": "npm",
      "args": ["run", "mcp-server"],
      "cwd": "/path/to/your/MCPCrypto"
    }
  }
}
```

### Full Configuration
```json
{
  "mcpServers": {
    "crypto-tools": {
      "command": "npm",
      "args": ["run", "mcp-server"],
      "cwd": "/path/to/your/MCPCrypto",
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info",
        "MAX_CONCURRENT_REQUESTS": "10",
        "REQUEST_TIMEOUT": "30000",
        "VERBOSE_LOGGING": "false"
      },
      "disabled": false
    }
  }
}
```

### Alternative Using Direct Node Execution
```json
{
  "mcpServers": {
    "crypto-tools": {
      "command": "node",
      "args": ["dist/mcp-server-socket.js"],
      "cwd": "/path/to/your/MCPCrypto",
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

---

**Ready to start?** Update the path in `.cursor/mcp.json` and restart Cursor to begin using your crypto analysis tools!