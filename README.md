# MCP Crypto Server

> Meet **Miss Understood** - the smartest  redhead in your area

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-blue.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Stop Drowning in Data Noise. Start Getting Intelligence That Actually Matters.

Every crypto trader, researcher, and enthusiast faces the same problem: **information overload**. You're bombarded with thousands of tweets, Telegram messages, Reddit posts, news articles, and market data points every day. Most of it is noise. Some of it is gold. But finding the gold is like searching for a needle in a haystack.

**What if your AI assistant could cut through the noise and deliver only the intelligence YOU need, curated by YOU, for YOU?**

### **Fully Malleable to Your Needs**
Unlike generic crypto data feeds that spam you with everything, this server adapts to **your specific interests**. Want to track only DeFi governance discussions? Done. Only interested in Bitcoin options flow? Configured. Need to monitor specific Telegram channels for alpha? Set it up once, get curated intelligence forever.

### **Your Personal Knowledge Base**
Drop your research files, trading strategies, market analysis, or any documents into the knowledge folder. The server automatically indexes everything with semantic search, making your personal research instantly searchable and accessible to your AI assistant. Your years of accumulated knowledge become a searchable, intelligent database.

### **Curated Social Intelligence**
Instead of manually checking 15 Telegram channels, 8 Reddit communities, 3 news sites, and multiple DeFi protocols every morning, your AI instantly delivers:
- **Relevant discussions from YOUR universe** - your Telegram account is your universe
- **Reddit posts from YOUR selected subreddits**  
- **News articles from YOUR trusted sources**
- **Sentiment analysis and price analytics** to deliver technicals and intelligence to the best LLMs
- **Key insights from YOUR personal research files** by RAG retrieval - found a txt file with tokenomics? Add it to knowledge folder and never forget

**You control the data sources. You set the filters. You curate the intelligence.**

Your AI assistant becomes truly **yours** - powered by data you trust, filtered by criteria you set, enhanced by knowledge you've accumulated.

## Quick Start

### Installation

```bash
chmod +x install.sh
./install.sh
```

### MCP Client Setup

After installation, connect to your preferred AI client:

- **Cursor IDE**: Use `mcp-config-cursor.json`
- **Claude Desktop**: Use `mcp-config-claude-desktop.json`  
- **ChatGPT Desktop**: Use `mcp-config-chatgpt.json`
- **Other MCP Clients**: Use `mcp-config-generic.json`

📖 **Detailed setup instructions**: See `MCP-SETUP-GUIDE.md`

### Requirements & Setup

**Required:** Node.js 18+, PostgreSQL 12+, 4GB+ RAM, 10GB+ disk space

**Recommended:** Cursor with Remote SSH + Amazon EC2 free tier or run locally with 24/7 backend for continuous intelligence gathering.

**Optional:** Telegram account for social intelligence features

## Core Capabilities

**Market Intelligence:** Real-time prices, DeFi yields, options flow, liquidations, technical analysis, arbitrage detection

**Social Intelligence:** Semantic search across platforms, sentiment analysis, news aggregation, trend detection, alpha discovery  

**AI Analysis:** ML forecasting, risk assessment, correlation detection, automated research synthesis

**Knowledge Base:** Drop files in `knowledge/` folder for instant semantic search across your research, strategies, and analysis

## Project Structure

```
├── install.sh              # One-command installation
├── mcp-config-*.json      # MCP client configurations  
├── knowledge/             # Your research files (auto-indexed)
├── src/modules/           # Core modules: aave, deribit, sentiment, telegram, etc.
└── test/                  # Tests and utilities
```

## Usage

**Start:** `./start-all.sh` (MCP server auto-starts with AI clients)

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

## Development

**Scripts:** `npm run backend`, `npm run build`, `npm run test-all`

**Testing:** `npm run test-connection`, `npm run test-knowledge`, or test specific modules

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