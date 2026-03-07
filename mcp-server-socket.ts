#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import all modules
import { PolymarketModule } from './src/modules/polymarket/index.js';
import { SentimentModule } from './src/modules/sentiment/index.js';
import { NewsModule } from './src/modules/news/index.js';
import { ChartModule } from './src/modules/chart/index.js';
import { EconomicDataModule } from './src/modules/econ_data/index.js';
import { PerformanceModule } from './src/modules/performance/index.js';
import { AnalysisModule } from './src/modules/analysis/index.js';
import { TelegramModule } from './src/modules/telegram/index.js';
import { RedditModule } from './src/modules/reddit/index.js';
import { AaveModule } from './src/modules/aave/index.js';
import { DeFiLlamaModule } from './src/modules/defillama/index.js';
import { DexScreenerModule } from './src/modules/dexscreener/index.js';
import { ForecastingModule } from './src/modules/forecasting/index.js';
import { LiquidationModule } from './src/modules/liquidations/index.js';
import { QuoteModule } from './src/modules/quote/index.js';
import { AlphaScannerModule } from './src/modules/alpha/index.js';
import { DeribitModule } from './src/modules/deribit/index.js';
import { KnowledgeModule } from './src/modules/knowledge/index.js';
import { TradingModule } from './src/modules/trading/index.js';
import { OrderFlowModule } from './src/modules/orderflow/index.js';
import { SolanaModule } from './src/modules/solana/index.js';
import { SocialModule } from './src/modules/social/index.js';
import { EarningsFeedModule } from './src/modules/earnings/index.js';
import { MassiveModule } from './src/modules/massive/index.js';
import { BreakingNewsModule } from './src/modules/news/breaking-news.js';
import { ResearchModule } from './src/modules/research/index.js';
import { ConfigModule } from './src/modules/config/index.js';
import { StreamingModule } from './src/modules/streaming/index.js';

// Base module interface
export interface CryptoModule {
  name: string;
  tools: any[];
  initialize(): Promise<void>;
}

class SocketMCPServer {
  private server: Server;
  private modules: Map<string, CryptoModule> = new Map();
  private allTools: any[] = [];
  private isInitialized = false;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-crypto-server',
        version: '1.0.0',
        description: 'Professional MCP server providing comprehensive cryptocurrency intelligence, DeFi analytics, social sentiment analysis, and trading tools',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private async initializeAllModules() {
    if (this.isInitialized) {
      console.log(' Modules already initialized, skipping...');
      return;
    }

    console.log(' Initializing all modules upfront...');
    
    // Initialize modules without dependencies first
    const basicModuleClasses = [
      { name: 'polymarket', class: PolymarketModule },
      { name: 'sentiment', class: SentimentModule },
      { name: 'news', class: NewsModule },
      { name: 'chart', class: ChartModule },
      { name: 'econ_data', class: EconomicDataModule },
      { name: 'performance', class: PerformanceModule },
      { name: 'telegram', class: TelegramModule },
      { name: 'reddit', class: RedditModule },
      { name: 'aave', class: AaveModule },
      { name: 'defillama', class: DeFiLlamaModule },
      { name: 'dexscreener', class: DexScreenerModule },
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

    // Initialize basic modules first
    for (const { name, class: ModuleClass } of basicModuleClasses) {
      try {
        console.log(` Initializing ${name} module...`);
        const module = new ModuleClass();
        
        // For modules that do data fetching, only initialize tools, not background sync
        // The backend handles all data fetching and storage
        if (name === 'polymarket' || name === 'reddit' || name === 'liquidations') {
          console.log(` ${name} module: Tools only (backend handles data fetching)`);
          // Don't call initialize() - just use the tools that are already set up in constructor
        } else {
          await module.initialize();
        }
        
        this.modules.set(name, module);
        
        // Add tools from this module
        const moduleTools = module.tools || [];
        this.allTools.push(...moduleTools);
        console.log(` Added ${moduleTools.length} tools from ${name} module`);
        
      } catch (error) {
        console.error(` ${name} module initialization failed:`, error);
        console.log(` Added 0 tools from ${name} module`);
      }
    }

    // Initialize liquidation module (needed for analysis module)
    let liquidationModule: LiquidationModule | null = null;
    try {
      console.log(' Initializing liquidations module...');
      liquidationModule = new LiquidationModule();
      
      // For MCP server, only initialize tools, not background sync
      console.log(' liquidations module: Tools only (backend handles data fetching)');
      
      this.modules.set('liquidations', liquidationModule);
      const liquidationTools = liquidationModule.tools || [];
      this.allTools.push(...liquidationTools);
      console.log(` Added ${liquidationTools.length} tools from liquidations module`);
    } catch (error) {
      console.error(' liquidations module initialization failed:', error);
      console.log(' Added 0 tools from liquidations module');
    }

    // Initialize analysis module with CoinalyzeAPI from liquidation module
    try {
      console.log(' Initializing analysis module...');
      const coinalyzeAPI = liquidationModule?.getCoinalyzeAPI() || undefined;
      const analysisModule = new AnalysisModule(coinalyzeAPI);
      
      this.modules.set('analysis', analysisModule);
      const analysisTools = analysisModule.tools || [];
      this.allTools.push(...analysisTools);
      console.log(` Added ${analysisTools.length} tools from analysis module`);
    } catch (error) {
      console.error(' analysis module initialization failed:', error);
      console.log(' Added 0 tools from analysis module');
    }

    // Initialize forecasting module
    try {
      console.log(' Initializing forecasting module...');
      const forecastingModule = new ForecastingModule();
      
      this.modules.set('forecasting', forecastingModule);
      const forecastingTools = forecastingModule.tools || [];
      this.allTools.push(...forecastingTools);
      console.log(` Added ${forecastingTools.length} tools from forecasting module`);
    } catch (error) {
      console.error(' forecasting module initialization failed:', error);
      console.log(' Added 0 tools from forecasting module');
    }

    // Wire SocialModule -> NewsModule for free coin mention search
    const newsModule = this.modules.get('news');
    const socialModule = this.modules.get('social');
    if (newsModule && socialModule && 'setNewsModule' in socialModule) {
      (socialModule as any).setNewsModule(newsModule);
    }

    this.isInitialized = true;
    console.log(` All modules initialized. Total tools: ${this.allTools.length}`);
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      if (!this.isInitialized) {
        await this.initializeAllModules();
      }
      
      return {
        tools: this.allTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (!this.isInitialized) {
        await this.initializeAllModules();
      }

      const tool = this.allTools.find(t => t.name === name);
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }

      const startTime = Date.now();
      console.log(` Executing tool: ${name}`);
      console.log(` Arguments:`, JSON.stringify(args, null, 2));
      console.log(`${'='.repeat(60)}`);

      try {
        const result = await tool.handler(args);
        const duration = Date.now() - startTime;
        console.log(` Tool ${name} completed in ${duration}ms`);
        console.log(` Result:`, JSON.stringify(result, null, 2));
        console.log(`${'='.repeat(60)}\n`);
        return result;
      } catch (toolError) {
        const duration = Date.now() - startTime;
        console.error(` Tool ${name} failed after ${duration}ms:`, toolError);
        console.log(`${'='.repeat(60)}\n`);
        throw toolError;
      }
    });
  }

  /** Apply handlers to any Server instance (for HTTP mode where each connection gets its own Server) */
  private setupHandlersOn(srv: InstanceType<typeof Server>) {
    srv.setRequestHandler(ListToolsRequestSchema, async () => {
      if (!this.isInitialized) await this.initializeAllModules();
      return {
        tools: this.allTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });
    srv.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      if (!this.isInitialized) await this.initializeAllModules();
      const tool = this.allTools.find(t => t.name === name);
      if (!tool) throw new Error(`Tool not found: ${name}`);
      return await tool.handler(args);
    });
  }

  async start() {
    const transportMode = (process.env.TRANSPORT || 'stdio').toLowerCase();
    console.log('🚀 Starting MCP Crypto Server...');
    console.log('📊 Process ID:', process.pid);
    console.log('⚙️  Node version:', process.version);
    console.log('🔧 Transport:', transportMode);
    console.log('🔧 Environment:', process.env.NODE_ENV || 'development');

    try {
      await this.initializeAllModules();

      if (transportMode === 'http') {
        const port = parseInt(process.env.MCP_HTTP_PORT || '3001', 10);
        const sessions = new Map<string, { transport: InstanceType<typeof SSEServerTransport>; server: InstanceType<typeof Server> }>();

        const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
          const url = new URL(req.url || '/', `http://localhost`);
          if (req.method === 'GET' && url.pathname === '/sse') {
            const srv = new Server(
              { name: 'mcp-crypto-server', version: '1.0.0', description: 'MCP Crypto Server' },
              { capabilities: { tools: {} } }
            );
            this.setupHandlersOn(srv);
            const transport = new SSEServerTransport('/message', res as any);
            transport.onerror = (err) => console.error('SSE transport error:', err);
            transport.onclose = () => sessions.delete(transport.sessionId);
            await srv.connect(transport);
            sessions.set(transport.sessionId, { transport, server: srv });
          } else if (req.method === 'POST' && url.pathname === '/message') {
            const sessionId = url.searchParams.get('sessionId');
            if (!sessionId) {
              res.writeHead(400).end('Missing sessionId');
              return;
            }
            const entry = sessions.get(sessionId);
            if (!entry) {
              res.writeHead(404).end('Session not found');
              return;
            }
            await entry.transport.handlePostMessage(req as any, res as any);
          } else if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', tools: this.allTools.length }));
          } else {
            res.writeHead(404).end('Not found');
          }
        });

        httpServer.listen(port, '0.0.0.0', () => {
          console.log(`✅ MCP HTTP server listening on http://0.0.0.0:${port}`);
          console.log(`   GET /sse - MCP SSE endpoint`);
          console.log(`   POST /message?sessionId=... - client messages`);
          console.log(`   GET /health - health check`);
          console.log(`🛠️  ${this.allTools.length} crypto tools loaded`);
        });
        this.setupGracefulShutdown();
        return;
      }

      // Stdio mode (default)
      console.log('📡 Starting stdio transport...');
      const transport = new StdioServerTransport();
      transport.onerror = (error) => {
        console.error('❌ Transport error:', error);
        console.error('   Error type:', error.constructor.name);
        console.error('   Error message:', error.message);
      };
      await this.server.connect(transport);

      console.log('✅ MCP Crypto Server started successfully!');
      console.log('🔗 Server is ready to receive MCP requests via stdio');
      console.log(`🛠️  ${this.allTools.length} crypto tools are loaded and ready:`);

      const toolsByCategory = this.categorizeTools();
      Object.entries(toolsByCategory).forEach(([category, tools]) => {
        console.log(`   ${category}: ${tools.length} tools`);
      });

      console.log('⏳ Ready for MCP client connections (Cursor, Claude Desktop, etc.)...');
      console.log('📖 Setup guide: https://github.com/your-repo/mcp-crypto-server#mcp-client-setup');

      this.setupGracefulShutdown();
    } catch (error) {
      console.error('❌ Failed to start MCP server:', error);
      throw error;
    }
  }

  private categorizeTools(): Record<string, any[]> {
    const categories: Record<string, any[]> = {
      'Market Data': [],
      'DeFi': [],
      'Social Intelligence': [],
      'Technical Analysis': [],
      'Trading': [],
      'News & Research': [],
      'Configuration': [],
      'Other': []
    };

    this.allTools.forEach(tool => {
      const name = tool.name.toLowerCase();
      if (name.includes('quote') || name.includes('price') || name.includes('ohlcv') || name.includes('pyth')) {
        categories['Market Data'].push(tool);
      } else if (name.includes('aave') || name.includes('defillama') || name.includes('dex')) {
        categories['DeFi'].push(tool);
      } else if (name.includes('telegram') || name.includes('reddit') || name.includes('sentiment') || name.includes('social')) {
        categories['Social Intelligence'].push(tool);
      } else if (name.includes('analysis') || name.includes('chart') || name.includes('technical') || name.includes('forecast')) {
        categories['Technical Analysis'].push(tool);
      } else if (name.includes('trading') || name.includes('order') || name.includes('liquidation') || name.includes('deribit')) {
        categories['Trading'].push(tool);
      } else if (name.includes('news') || name.includes('research') || name.includes('knowledge') || name.includes('breaking')) {
        categories['News & Research'].push(tool);
      } else if (name.includes('config')) {
        categories['Configuration'].push(tool);
      } else {
        categories['Other'].push(tool);
      }
    });

    return categories;
  }

  private setupGracefulShutdown() {
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      for (const module of this.modules.values()) {
        try {
          if ('cleanup' in module && typeof module.cleanup === 'function') {
            await module.cleanup();
          }
        } catch (error) {
          console.error(`❌ Error cleaning up module ${module.name}:`, error);
        }
      }
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Start the server
const server = new SocketMCPServer();
server.start().catch((error) => {
  console.error(' Failed to start MCP server:', error);
  process.exit(1);
});
