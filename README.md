# MCP Crypto Server

> Meet **Miss Understood** - the elite MCP server for crypto intelligence

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-blue.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[📱 Join Community](https://t.me/+f6szsd7zYqdlZDIy)** | Get help, share tips, and connect with other Miss Understood users!

This is an MCP server tailored to crypto use - completely free and open source. We're gonna dominate the crypto AI universe by delivering the elite MCP server for all, and not gate intelligence behind a 40k token stake paywall.

**TLDR:** Run the backend, npm install, create the db with the script and you're good to go.

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