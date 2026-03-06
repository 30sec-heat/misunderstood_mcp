# MCP Crypto Server

> Meet **Miss Understood** - the elite MCP server for crypto intelligence

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-blue.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[📱 Join Community](https://t.me/+f6szsd7zYqdlZDIy)** | Get help, share tips, and connect with other Miss Understood users!

This is an MCP server tailored to crypto use - completely free and open source. We're gonna dominate the crypto AI universe by delivering the elite MCP server for all, and not gate intelligence behind a 40k token stake paywall.

**TLDR:** Run the backend, npm install, create the db with the script and you're good to go.

### 🤖 Ysalis - AI Trading Agent (CLI + MCP)

Ysalis is the CLI-based AI trading agent. Turn natural language into automated trading strategies. Talk to it, describe conditions like *"bitcoin goes up when xyz... take a long"*, and it will parse, save, and execute.

**Quick start:**

```bash
# First run: guided setup (AI model, exchange, API keys, Telegram)
npm run ysalis

# Re-run setup anytime
npm run ysalis -- --setup

# Interactive chat with MCP tools
npm run ysalis
# or: npm run agent

# With backend API (recommended - faster)
npm run server &               # Start HTTP API on :3000
npm run ysalis -- -b http://localhost:3000

# Strategy dashboard - run/pause strategies, see PnL
npm run ysalis-dashboard
# or: npm run strategy-dashboard

# Create strategy from natural language
npm run ysalis -- -m strategy "when BTC goes above 100k I want to go long"

# Run strategy executor (dry-run by default)
npm run ysalis -- -m execute -d

# Automated backend (polls strategies, executes when conditions met)
npm run automated              # Dry-run (safe)
npm run automated:live         # Live orders (requires API keys)
```

**CLI options:** `-m chat|strategy|execute` `-e binance|bybit|both` `-k spot|futures|both` `-d` (dry-run) `-b <backend-url>`

**How Ysalis calls MCP tools:** The agent uses heuristic matching (e.g. "price" → quote tool, "strategy keywords" → NL parser) and explicit `/call <tool> <args>`. When used as an MCP server from Cursor/Claude, those clients perform chain-of-thought: the LLM sees available tools, reasons about the user query, and decides which tools to call (often chaining multiple calls). For full autonomous tool chaining from the CLI, use `--backend-url` with a client that supports tool use.

**Exchanges:** Binance & Bybit (spot + futures). Set `BINANCE_API_KEY`, `BINANCE_SECRET_KEY`, `BYBIT_API_KEY`, `BYBIT_SECRET_KEY` in `.env`.

**Set API keys via chat:** Say "set my Binance API key to abc123", "add OPENAI_API_KEY sk-xxx", or use `/set BINANCE_API_KEY abc123`. Uses `config_set_env_var` MCP tool. Restart server to pick up changes.

**Strategy parsing:** Requires `OPENAI_API_KEY` for natural language → structured strategy conversion.

**Manual strategies:** Copy `strategies.example.json` to `strategies.json` and edit. Set `enabled: true` for strategies to run.

## Quick Start

### Installation

The `install.sh` script automatically:
- Installs Node.js dependencies
- Sets up PostgreSQL database and creates required tables
- Configures environment variables
- Initializes the knowledge base with semantic search
- Sets up MCP client configurations

chmod +x install.sh
./install.sh

### MCP Client Setup

After installation, connect to your preferred AI client:

- **Cursor IDE**: Use `mcp-config-cursor.json`
- **Claude Desktop**: Use `mcp-config-claude-desktop.json`  
- **ChatGPT Desktop**: Use `mcp-config-chatgpt.json`
- **Other MCP Clients**: Use `mcp-config-generic.json`

📖 **Detailed setup instructions**: See `MCP-SETUP-GUIDE.md`

### Requirements & Setup

**Required:** Node.js 18+, PostgreSQL 12+, 2GB+ RAM, 2GB+ disk space

**Recommended:** Run locally and let backend run continuously for real-time intelligence gathering.

**Optional:** Telegram account for social intelligence features

## Core Capabilities

### **Technical & Order Flow**
- **OHLCV History**: Fetch 1000+ bars with pagination (`get_ohlcv_history`) across timeframes 1m–1d
- **Order Flow Glossary**: FVG, order blocks, BOS, CHoCH, liquidity pools, fair value gap terminology (`get_orderflow_glossary`)
- **Fair Value Gap Detector**: Bull/bear FVG detection on price data (`technical_detect_fvg`)
- **Correlation**: Pearson correlation between symbols for pair trading (`get_symbol_correlation`)

### **Open Interest & Liquidations (Coinalyze)**
- **OI History**: 1000+ bars of Open Interest by symbol/exchange/timeframe (`coinalyze_oi_history`)
- **OI Change**: Percent change over 1h, 4h, 24h, 7d (`coinalyze_oi_change`)
- **Funding History**: Funding rate time series (`coinalyze_funding_history`)
- **Liquidation History**: Historic liquidations by symbol/exchange (`coinalyze_liquidation_history`)
- Requires `COINALYZE_API_KEY` in `.env`

### **Polymarket**
- **Search markets / check odds**: `polymarket_search_markets`, `polymarket_check_odds` – "check what odds for xyz", search by topic
- **Trending / by category / ending soon**: Market discovery and filtering
- **Market details**: Full metadata, volume, liquidity, resolution
- **Price history**: Historical prices via CLOB API
- **User positions**: Portfolio by wallet address (Data API)
- **Resolved events / upcoming resolutions**
- **Market comments**: Sentiment and discussion per market

### **Telegram**
- **Summarize chat**: `telegram_summarize_chat_messages` – summarize last N messages of a chat
- **Search by subject**: `telegram_search_messages_by_subject` – e.g. "what happened in Iran last 24 hrs" (RAG-style)
- **Summarize by topic**: `telegram_summarize_recent_by_topic` – search + AI summary

### **Sentiment**
- **Unified score**: Aggregated Telegram + Reddit (+ News) sentiment
- **Symbol-specific**: BTC, ETH, SOL, etc. with ticker aliases
- **Time-windowed**: 1h, 4h, 24h, 7d sentiment windows
- **Extremes detection**: Fear/greed spike detection
- **Topic query**: Semantic search by keyword/topic
- **Health check**: Source availability (Telegram, Reddit, semantic engine)

### **Streaming / Real-time (Price & Message Monitoring)**
- **Price WebSockets**: Binance (spot + futures) and Bybit ticker streams feed the strategy executor
- **LivePriceFeed**: WebSocket-first price source with REST fallback for condition evaluation
- **MessageStreamBridge**: Polls Telegram for new messages; message-trigger strategies fire when channel posts match keywords
- **MessageTriggerStrategy**: `strategyType: 'message_trigger'` with `chatIds`, `keywords`, `regex`
- **MCP tools**: `streaming_get_status`, `streaming_subscribe_prices`
- See `src/streaming/README.md` for architecture

### **Strategy Management**
- **Dashboard**: `npm run ysalis-dashboard` – list strategies, run/pause/stop, view PnL
- **Per-strategy sizing**: fixed, percent_portfolio, risk_amount
- **Stops & targets**: price, percent, trailing, indicator-based (e.g. RSI exit)
- **API**: GET/POST `/strategies`, `/strategies/:id/run`, `/pause`, `/stop`

### **Research & Search**
- **research_search**: Web (Brave/Serper) + database – search online and internal sources
- **knowledge_search_all**: Unified search across knowledge, Telegram, Reddit, Polymarket, strategies

### **Solana**
- **Token metadata**: `solana_get_token_metadata`, `solana_search_token_by_name`
- **Swap quote**: `solana_get_swap_quote` – Jupiter API (no execution)
- **Social mentions**: `social_search_coin_mentions` – coin mentions (RSS, web search; Twitter via Brave/Serper if keys set)

### **Config**
- **config_set_env_var**: Add or update API keys / env vars in `.env` by speaking to the agent (e.g. "set my Binance API key to xyz")
- **config_list_allowed_keys**: List which keys can be set (API keys, optional config – excludes DB/system vars)

### **Financial Data (TradFi)**
- **Earnings Feed API**: SEC filings, insider transactions, 13F holdings, company profiles (`earningsfeed_*` tools)
- **Massive API**: Options quotes, snapshots, contracts, stock OHLC (`massive_*` tools)
- **Crypto News API**: Breaking news, search by symbol (`news_breaking_crypto`, `news_search_crypto`)

### **Market Intelligence**
- **Aave**: Lending rates, collateral analysis, yield opportunities, risk assessment
- **DeFiLlama**: Protocol TVL, yield farming pools, DEX analytics, chain comparisons
- **Deribit**: Options flow, volatility analysis, Greeks calculations, risk metrics
- **DexScreener**: Token analysis, pair discovery, liquidity tracking, new token alerts
- **Liquidations**: Real-time liquidation tracking, risk analysis, market impact assessment

### **Social Intelligence**
- **Telegram**: Monitor channels, sentiment analysis, alpha discovery, trend detection
- **Reddit**: Subreddit monitoring, discussion analysis, community sentiment
- **News**: RSS feeds, TradFi news, crypto news aggregation, semantic search
- **Sentiment**: Cross-platform sentiment analysis, semantic search, trend correlation

### **Technical Analysis**
- **Chart Analysis**: Technical indicators, pattern recognition, multi-timeframe analysis
- **Forecasting**: ML-powered price predictions, volatility forecasting, risk modeling
- **Performance**: Portfolio tracking, performance analytics, risk metrics

### **Knowledge Base**
Drop files in `knowledge/` folder for instant semantic search across your research, strategies, and analysis

## Project Structure

- `install.sh` - One-command installation
- `mcp-config-*.json` - MCP client configurations  
- `knowledge/` - Your research files (auto-indexed)
- `src/modules/` - Core modules: aave, deribit, sentiment, telegram, etc.
- `test/` - Tests and utilities

## Usage

Just need to run the backend - the AI modules will boot the MCP automatically when connected:

./start-all.sh

**Check Connection:** In Cursor, go to settings and check MCP parameters to verify connection status.

**Example Queries:**
- *"What's the sentiment around Ethereum staking this week from my monitored channels?"*
- *"How have people been reacting to this news?"*
- *"What do bitcoin options say about the new risk of the Bilateral China - USA trade talks?"*
- *"Find me yield opps to farm on AAVE"*
- *"Where is this guy getting liquidated on chain?"*

## Configuration

**Auto-configured:** Database, MCP API keys, environment variables via installer

**Telegram Setup:** Run `npx tsx utils/telegram-auth.ts` and follow prompts for social intelligence

**Optional APIs:** Add Binance/Bybit keys to `.env` for enhanced data access

## Knowledge Base

**Supported:** `.txt`, `.md`, `.csv`, `.json`, `.pdf` files in `knowledge/` directory

**Auto-indexed:** Drop files → instant semantic search across all your research


## Troubleshooting

**Node.js:** Ensure version 18+ (`node --version`)
**PostgreSQL:** Check running (`pg_isready`) 
**Permissions:** `chmod +x install.sh`
**Database:** `npm run test-connection`
**Telegram:** Re-run `npx tsx utils/telegram-auth.ts`
**Modules:** `npm install && npm run build`

**Help:** Check `logs/` directory, report issues on GitHub

## Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b feature/amazing-feature`
3. **Make your changes** with proper tests
4. **Add tests** for new functionality
5. **Update documentation** as needed
6. **Submit a pull request** with detailed description

### Development Guidelines

- Use TypeScript for all new code
- Follow existing code style and patterns
- Add comprehensive error handling
- Include unit tests for new features
- Update documentation for API changes

### Adding New Modules

To add a new module to the MCP Crypto Server:

1. **Create module directory** in `src/modules/your-module/`

2. **Implement the module class:**
   ```typescript
   import { BaseCryptoModule } from '../base/BaseCryptoModule.js';
   
   export class YourModule extends BaseCryptoModule {
     name = 'your-module';
     
     protected setupTools() {
       this.addTool({
         name: 'your_tool_name',
         description: 'Description of what your tool does',
         inputSchema: {
           type: 'object',
           properties: {
             // Define your input parameters here
           },
           required: ['required_param']
         },
         handler: this.handleYourTool.bind(this)
       });
     }
     
     private async handleYourTool(args: any) {
       // Implement your tool logic here
       return {
         content: [
           {
             type: 'text',
             text: 'Your tool response'
           }
         ]
       };
     }
   }
   ```

3. **Create database schema** (if needed) in `scripts/schema.sql`

4. **Add tests** in `test/test-your-module.ts`:
   ```typescript
   import { YourModule } from '../src/modules/your-module/YourModule.js';
   
   async function testYourModule() {
     const module = new YourModule();
     await module.initialize();
     
     // Add your tests here
     console.log('✅ YourModule tests passed');
   }
   
   testYourModule().catch(console.error);
   ```

5. **Register the module** in `src/index.ts`:
   ```typescript
   import { YourModule } from './modules/your-module/YourModule.js';
   
   // Add to the modules array
   const modules = [
     // ... existing modules
     new YourModule(),
   ];
   ```

6. **Update documentation** - add your module to this README and create specific docs if needed

### Module Architecture

All modules extend `BaseCryptoModule` which provides:
- Database connection management
- Tool registration system
- Error handling and logging
- Consistent API patterns

Key principles:
- Each module should be self-contained
- Database schemas are auto-created on initialization
- Tools should follow the MCP protocol specification
- Include comprehensive error handling
- Add proper TypeScript types

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.