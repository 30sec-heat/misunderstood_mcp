/**
 * Shared MCP server logic - module initialization and handlers.
 * Used by both stdio (mcp-server-socket.ts) and HTTP/SSE (mcp-server-http.ts, server/index.ts).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { PolymarketModule } from './modules/polymarket/index.js';
import { SentimentModule } from './modules/sentiment/index.js';
import { NewsModule } from './modules/news/index.js';
import { ChartModule } from './modules/chart/index.js';
import { EconomicDataModule } from './modules/econ_data/index.js';
import { PerformanceModule } from './modules/performance/index.js';
import { TelegramModule } from './modules/telegram/index.js';
import { RedditModule } from './modules/reddit/index.js';
// Aave, DeFiLlama, DexScreener, Analysis - excluded (missing data fetchers in repo)
import { ForecastingModule } from './modules/forecasting/index.js';
import { LiquidationModule } from './modules/liquidations/index.js';
import { QuoteModule } from './modules/quote/index.js';
import { AlphaScannerModule } from './modules/alpha/index.js';
import { DeribitModule } from './modules/deribit/index.js';
import { KnowledgeModule } from './modules/knowledge/index.js';
import { TradingModule } from './modules/trading/index.js';
import { OrderFlowModule } from './modules/orderflow/index.js';
import { SolanaModule } from './modules/solana/index.js';
import { SocialModule } from './modules/social/index.js';
import { EarningsFeedModule } from './modules/earnings/index.js';
import { MassiveModule } from './modules/massive/index.js';
import { BreakingNewsModule } from './modules/news/breaking-news.js';
import { ResearchModule } from './modules/research/index.js';
import { ConfigModule } from './modules/config/index.js';
import { StreamingModule } from './modules/streaming/index.js';

export interface CryptoModule {
  name: string;
  tools: any[];
  initialize(): Promise<void>;
}

export interface MCPServerCore {
  server: Server;
  getAllTools: () => any[];
  getModules: () => Map<string, CryptoModule>;
  initializeAllModules: () => Promise<void>;
}

export function createMCPServerCore(): MCPServerCore {
  const server = new Server(
    {
      name: 'mcp-crypto-server',
      version: '1.0.0',
      description:
        'Professional MCP server providing comprehensive cryptocurrency intelligence, DeFi analytics, social sentiment analysis, and trading tools',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const modules: Map<string, CryptoModule> = new Map();
  let allTools: any[] = [];
  let isInitialized = false;

  async function initializeAllModules() {
    if (isInitialized) return;

    const basicModuleClasses = [
      { name: 'polymarket', class: PolymarketModule },
      { name: 'sentiment', class: SentimentModule },
      { name: 'news', class: NewsModule },
      { name: 'chart', class: ChartModule },
      { name: 'econ_data', class: EconomicDataModule },
      { name: 'performance', class: PerformanceModule },
      { name: 'telegram', class: TelegramModule },
      { name: 'reddit', class: RedditModule },
      // AaveModule, DeFiLlamaModule - disabled (missing data fetchers in repo)
      // { name: 'dexscreener', class: DexScreenerModule }, // disabled - missing DexScreenerDataFetcher
      { name: 'quote', class: QuoteModule },
      { name: 'alpha', class: AlphaScannerModule },
      { name: 'deribit', class: DeribitModule },
      { name: 'knowledge', class: KnowledgeModule },
      { name: 'trading', class: TradingModule },
      { name: 'orderflow', class: OrderFlowModule },
      { name: 'solana', class: SolanaModule },
      { name: 'social', class: SocialModule },
      { name: 'research', class: ResearchModule },
      { name: 'earningsfeed', class: EarningsFeedModule },
      { name: 'massive', class: MassiveModule },
      { name: 'breaking_news', class: BreakingNewsModule },
      { name: 'config', class: ConfigModule },
      { name: 'streaming', class: StreamingModule },
    ];

    for (const { name, class: ModuleClass } of basicModuleClasses) {
      try {
        const module = new ModuleClass();
        if (name !== 'polymarket' && name !== 'reddit' && name !== 'liquidations') {
          await module.initialize();
        }
        modules.set(name, module);
        const moduleTools = module.tools || [];
        allTools.push(...moduleTools);
      } catch (error) {
        console.error(`[MCP] ${name} module init failed:`, error);
      }
    }

    let liquidationModule: LiquidationModule | null = null;
    try {
      liquidationModule = new LiquidationModule();
      modules.set('liquidations', liquidationModule);
      allTools.push(...(liquidationModule.tools || []));
    } catch (error) {
      console.error('[MCP] liquidations module init failed:', error);
    }


    try {
      const forecastingModule = new ForecastingModule();
      modules.set('forecasting', forecastingModule);
      allTools.push(...(forecastingModule.tools || []));
    } catch (error) {
      console.error('[MCP] forecasting module init failed:', error);
    }

    const newsModule = modules.get('news');
    const socialModule = modules.get('social');
    if (newsModule && socialModule && 'setNewsModule' in socialModule) {
      (socialModule as any).setNewsModule(newsModule);
    }

    isInitialized = true;
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    if (!isInitialized) await initializeAllModules();
    return {
      tools: allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (!isInitialized) await initializeAllModules();

    const tool = allTools.find((t) => t.name === name);
    if (!tool) throw new Error(`Tool not found: ${name}`);

    return await tool.handler(args);
  });

  return {
    server,
    getAllTools: () => allTools,
    getModules: () => modules,
    initializeAllModules,
  };
}
