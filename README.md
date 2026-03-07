# MCP Crypto Server

> Professional MCP server providing comprehensive cryptocurrency intelligence, DeFi analytics, and trading tools

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-blue.svg)](https://www.postgresql.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A comprehensive **Model Context Protocol (MCP) server** providing 106+ cryptocurrency tools including market data, DeFi intelligence, social sentiment analysis, and trading insights. Connect to **Claude Desktop**, **Cursor IDE**, or any MCP-compatible client for advanced crypto analysis.

**🎯 Pure MCP Server** - No chat interface, just powerful tools for your AI client.

## 🚀 Quick Start

### Installation

```bash
# Clone and setup
git clone <repository-url>
cd mcp-crypto-server

# One-command installation (installs dependencies, sets up database, configures MCP)
chmod +x install.sh
./install.sh
```

### MCP Client Setup

After installation, connect to your preferred AI client:

**Cursor IDE:**
```json
// Add to your Cursor settings (Cmd/Ctrl + Shift + P → "Preferences: Open User Settings (JSON)")
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

**Claude Desktop:**
```json
// Add to ~/.claude/claude_desktop_config.json (or %APPDATA%\Claude\claude_desktop_config.json on Windows)
{
  "mcpServers": {
    "crypto": {
      "command": "tsx",
      "args": ["/absolute/path/to/mcp-crypto-server/mcp-server-socket.ts"]
    }
  }
}
```

**Other MCP Clients:**
The server uses stdio transport and is compatible with any MCP client. Use the command `tsx mcp-server-socket.ts` in the project directory.

📖 **Detailed setup instructions**: See [MCP-SETUP-GUIDE.md](MCP-SETUP-GUIDE.md)

## 🐳 Docker

Run the full stack with Docker Compose:

```bash
# Start all services (MCP server, backend API, webapp, PostgreSQL)
docker-compose up -d

# Or build and run
docker-compose up --build -d
```

**Services and ports:**
| Service    | Port | Description                    |
|-----------|------|--------------------------------|
| mcp-server| 3001 | MCP HTTP/SSE (TRANSPORT=http)  |
| backend   | 3000 | Express API (/api/tools, etc.) |
| webapp    | 80   | React app (nginx)              |
| postgres  | 5432| PostgreSQL database            |

**Environment variables** (create `.env` or pass to docker-compose):
- `TRANSPORT` - `stdio` (default) or `http` for MCP server
- `MCP_HTTP_PORT` - Port for MCP HTTP mode (default: 3001)
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DATABASE`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

**MCP server only** (stdio mode for Cursor/Claude Desktop):
```bash
docker run -it --rm -v $(pwd):/app -w /app node:20-alpine sh -c "npm install && npx tsx mcp-server-socket.ts"
```

**MCP server only** (HTTP mode):
```bash
docker run -d -p 3001:3001 -e TRANSPORT=http -e MCP_HTTP_PORT=3001 mcp-crypto-server
```

## 🛠️ Core MCP Tools (106 Available)

### **Market Data & Pricing (15+ tools)**
- `get_comprehensive_quotes` - Real-time prices across exchanges
- `get_ohlcv_history` - Historical OHLCV data with pagination
- `get_symbol_correlation` - Correlation analysis between trading pairs
- `pyth_get_price_feeds` - Pyth Network price feeds
- `quote_get_listings` - Exchange listings and market data

### **Technical Analysis (12+ tools)**
- `technical_detect_fvg` - Fair Value Gap detection
- `get_orderflow_glossary` - Order flow terminology and concepts
- `analysis_comprehensive_forecast` - Multi-factor forecasting
- `chart_get_technical_analysis` - Technical indicators and patterns

### **DeFi Intelligence (20+ tools)**
- **Aave (8 tools)**: Lending rates, collateral analysis, yield opportunities
- **DeFiLlama (6 tools)**: Protocol TVL, yield farming, DEX analytics  
- **Deribit (5 tools)**: Options flow, volatility analysis, Greeks calculations
- **DexScreener (4 tools)**: Token analysis, pair discovery, liquidity tracking

### **Social Sentiment (15+ tools)**
- `telegram_summarize_chat_messages` - Summarize chat activity
- `telegram_search_messages_by_subject` - RAG-style message search
- `sentiment_get_unified_score` - Cross-platform sentiment analysis
- `reddit_search_discussions` - Reddit sentiment and discussions
- `social_search_coin_mentions` - Cross-platform social mentions

### **Polymarket (8 tools)**
- `polymarket_search_markets` - Find prediction markets
- `polymarket_get_trending_markets` - Trending markets by volume
- `polymarket_get_markets_by_category` - Filter by category
- `polymarket_get_ending_soon` - Markets ending soon

### **Open Interest & Liquidations (8 tools)**
- `coinalyze_oi_history` - Open Interest time series
- `coinalyze_liquidation_history` - Historical liquidations
- `coinalyze_funding_history` - Funding rate analysis
- `liquidation_get_recent` - Real-time liquidation tracking

### **Research & Knowledge (10+ tools)**
- `research_search` - Web + database unified search
- `knowledge_search_all` - Search across all data sources
- `news_search` - News aggregation and analysis
- `breaking_news_get_latest` - Breaking news alerts

### **Solana Ecosystem (8 tools)**
- `solana_get_token_metadata` - Token information
- `solana_search_token_by_name` - Token discovery
- `solana_get_swap_quote` - Jupiter swap quotes
- `solana_get_token_price_history` - Historical price data

### **Configuration & Utilities (6 tools)**
- `config_set_env_var` - Set API keys and environment variables
- `config_list_allowed_keys` - List configurable parameters
- `streaming_start_price_feed` - Real-time data streams

## 📊 Data Sources

- **Exchanges**: Binance, Bybit (spot + futures)
- **DeFi**: Aave, DeFiLlama, Uniswap, PancakeSwap
- **Social**: Telegram, Reddit, Twitter (via APIs)
- **News**: RSS feeds, CryptoNews API, TradFi sources
- **On-chain**: Solana, Ethereum data
- **Derivatives**: Deribit options, Coinalyze metrics

## 🔧 Requirements

- **Node.js** 18+
- **PostgreSQL** 12+
- **2GB+ RAM**
- **2GB+ disk space**

## 📁 Project Structure

```
mcp-crypto-server/
├── src/
│   ├── modules/           # Core MCP modules
│   │   ├── aave/         # Aave DeFi tools
│   │   ├── deribit/      # Options & derivatives
│   │   ├── sentiment/    # Social sentiment analysis
│   │   ├── telegram/     # Telegram integration
│   │   └── ...
│   ├── base/             # Base classes and utilities
│   └── streaming/        # Real-time data streams
├── knowledge/            # Document storage (auto-indexed)
├── test/                 # Test utilities
├── scripts/              # Setup and maintenance scripts
├── mcp-server-socket.ts  # Main MCP server entry point
└── install.sh           # One-command setup
```

## 🚦 Usage Examples

Once connected to your MCP client (Cursor, Claude Desktop, etc.), you can use natural language queries:

**Market Analysis:**
- *"What's the current BTC price and sentiment across exchanges?"*
- *"Show me ETH options flow and volatility on Deribit"*
- *"Find correlation between SOL and BTC over the last week"*
- *"Get comprehensive quotes for the top 10 cryptocurrencies"*

**DeFi Intelligence:**
- *"What are the best yield opportunities on Aave right now?"*
- *"Show me TVL changes across major DeFi protocols this month"*
- *"Find new token pairs with high liquidity on DEXs"*
- *"Compare lending rates across different DeFi protocols"*

**Social Sentiment & Prediction Markets:**
- *"What's the sentiment around Ethereum staking this week?"*
- *"Summarize recent discussions about Bitcoin ETFs"*
- *"Find trending prediction markets on Polymarket"*
- *"What are crypto communities saying about the next Fed meeting?"*

**Research & Analysis:**
- *"Search for recent news about crypto regulatory changes"*
- *"Find information about upcoming token unlocks"*
- *"Analyze liquidation patterns for major cryptocurrencies"*
- *"Get a comprehensive forecast for Bitcoin price movement"*

**Solana Ecosystem:**
- *"Find information about a specific Solana token"*
- *"Get swap quotes for SOL to USDC"*
- *"What's the social sentiment around new Solana projects?"*

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with your API keys:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/crypto_db

# Exchange APIs (optional - for enhanced data)
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
npm run setup-telegram
# Follow the prompts to authenticate
```

## 🧪 Testing

```bash
# Test database connection
npm run test-connection

# Test MCP server
npm run test-mcp

# Test specific modules
npm run test-knowledge
npm run test-all
```

## 🔧 Development

```bash
# Start MCP server in development mode
npm run dev

# Build TypeScript
npm run build

# Clean build artifacts
npm run clean

# Reset database (caution: deletes all data)
npm run reset-db
```

## 📚 Documentation

- [MCP Setup Guide](MCP-SETUP-GUIDE.md) - Detailed client setup instructions
- [API Documentation](api_docs/) - Complete tool reference
- [Module Development](src/modules/README.md) - Adding new modules

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md).

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with proper tests
4. Update documentation as needed
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the guides in this repository
- **Issues**: Report bugs on GitHub Issues
- **Logs**: Check the `logs/` directory for troubleshooting
- **Community**: Join our [Telegram Community](https://t.me/+f6szsd7zYqdlZDIy)

---

*Built for the MCP ecosystem - connecting AI clients to comprehensive crypto intelligence.*