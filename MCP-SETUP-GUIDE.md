# MCP Configuration Setup Guide

This guide helps you connect the MCP Crypto Server to various AI clients that support the Model Context Protocol (MCP).

## LAUNCH: Quick Setup

1. **Install the MCP Crypto Server** (if not already done):
   ```bash
   ./install.sh
   ```

2. **Build the server**:
   ```bash
   npm run build
   ```

3. **Choose your AI client** and follow the specific setup instructions below.

## SETUP: Client-Specific Setup

### Cursor IDE (with Cline/Claude)

**Location**: Copy `mcp-config-cursor.json` to your Cline MCP settings:

- **Windows**: `%APPDATA%\Cursor\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json`
- **macOS**: `~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`
- **Linux**: `~/.config/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`

**Steps**:
1. Update the path in the config file to match your installation
2. Restart Cursor
3. Open a Cline conversation - crypto tools will be available

### Claude Desktop

**Location**: Update your Claude Desktop config file:

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

**Steps**:
1. Use content from `mcp-config-claude-desktop.json`
2. Update the path to match your installation
3. Restart Claude Desktop
4. Tools will be automatically available in new conversations

### ChatGPT Desktop (Experimental)

**Note**: MCP support in ChatGPT Desktop is experimental and may not be available in all versions.

**Alternative**: Use the HTTP API mode:
```bash
npm run backend  # Starts server on http://localhost:3000
```

### Other MCP Clients

Use `mcp-config-generic.json` as a template and adapt for your specific client.

##  Configuration Options

### Server Modes

1. **Standard MCP Mode** (recommended):
   ```bash
   npm start  # or node dist/mcp-server-socket.js
   ```

2. **HTTP API Mode** (for non-MCP clients):
   ```bash
   npm run backend  # Starts on port 3000
   ```

### Environment Variables

Add these to your MCP config's `env` section:

```json
{
  "env": {
    "NODE_ENV": "production",
    "LOG_LEVEL": "info",
    "MAX_CONCURRENT_REQUESTS": "10",
    "REQUEST_TIMEOUT": "30000"
  }
}
```

## SEARCH: Available Tools

Once connected, you'll have access to 50+ tools across these categories:

### Market Data & Analysis
- `get_comprehensive_quotes` - Multi-exchange price comparison
- `analysis_comprehensive` - Technical analysis with indicators
- `liquidations_comprehensive_analysis` - Liquidation tracking and alerts

### DeFi Intelligence  
- `aave_get_all_rates_and_history` - Lending/borrowing rates
- `aave_get_yield_market_and_risk` - Yield opportunities with risk analysis
- `defillama_discover_protocols` - DeFi protocol discovery

### Social Intelligence
- `sentiment_get_sentiment_messages` - Social media sentiment analysis
- `sentiment_semantic_search` - AI-powered social search
- `telegram_search_messages` - Telegram channel monitoring

### Options & Derivatives
- `deribit_get_option_chain` - Options data with Greeks
- `deribit_analyze_iv` - Implied volatility analysis
- `deribit_calculate_price_probabilities` - Price probability modeling

### News & Research
- `news_get_latest` - Multi-source crypto news
- `news_search` - Semantic news search
- `knowledge_search` - Search your personal research files

### AI Forecasting
- `forecast_comprehensive` - Multi-model price predictions
- `analysis_comprehensive` - Technical analysis with ML insights

## INFO: Usage Examples

Once configured, you can ask questions like:

**Market Analysis**:
- "What's the current sentiment around Ethereum staking?"
- "Show me arbitrage opportunities between exchanges"
- "Analyze Bitcoin's technical indicators and provide a forecast"

**DeFi Research**:
- "Find high-yield opportunities on Aave with low risk"
- "Compare lending rates across different protocols"
- "What are the liquidation risks at current market levels?"

**Social Intelligence**:
- "What's trending in crypto Telegram channels today?"
- "Search for discussions about 'Layer 2' in the last week"
- "Analyze cross-platform sentiment for Bitcoin"

**Personal Research**:
- "Search my knowledge base for MEV strategies"
- "Find information about yield farming in my research files"

## SETUP: Troubleshooting

### Common Issues

**Tools not appearing**:
1. Check that the server builds without errors: `npm run build`
2. Verify database connection: `npm run test-connection`
3. Check client logs for MCP connection errors
4. Ensure the path in config matches your installation

**Server won't start**:
1. Check your `.env` file configuration
2. Ensure PostgreSQL is running: `pg_isready`
3. Verify Node.js version: `node --version` (requires 18+)

**Database errors**:
1. Run database setup: `npm run setup-db`
2. Test connection: `npm run test-connection`
3. Check PostgreSQL logs for connection issues

### Debug Mode

Enable detailed logging by setting environment variables:

```json
{
  "env": {
    "NODE_ENV": "development",
    "LOG_LEVEL": "debug",
    "VERBOSE_LOGGING": "true"
  }
}
```

### Manual Testing

Test the server independently:

```bash
# Test MCP server
npm start

# Test HTTP API mode  
npm run backend

# Test specific functionality
npm run test-connection
npm run test-knowledge
```

## LOCK: Security Notes

- **Local Operation**: The server runs entirely on your machine - no data is sent to external services
- **API Keys**: Optional API keys enhance functionality but aren't required for basic operation
- **Database**: Uses local PostgreSQL - ensure proper access controls
- **Telegram**: Session files (`.session`) are sensitive - keep them private and secure
- **Environment**: Never commit `.env` or `.session` files to version control

## 📚 Additional Resources

- **Main Documentation**: See `README.md` for comprehensive setup and usage
- **API Documentation**: Check `api_docs/` for detailed tool specifications  
- **Troubleshooting**: Refer to README.md troubleshooting section
- **Community**: Join discussions for tips and best practices

## 🆘 Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Review logs in the `logs/` directory
3. Test individual components with the provided test scripts
4. Consult the main README.md for detailed documentation
5. Report issues with full error logs and system information

---

**Ready to supercharge your crypto analysis?** Choose your AI client above and get started! LAUNCH:
