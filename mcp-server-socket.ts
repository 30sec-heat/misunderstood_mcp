#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import all modules
import { PolymarketModule } from './src/modules/polymarket/index.js';
import { SentimentModule } from './src/modules/sentiment/index.js';
import { NewsModule } from './src/modules/news/index.js';
import { ChartModule } from './src/modules/chart/index.js';
import { PythNetworkModule } from './src/modules/pyth/index.js';
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
      { name: 'pyth', class: PythNetworkModule },
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

  async start() {
    console.log(' Starting Socket MCP Crypto Server...');
    console.log(' Process ID:', process.pid);
    console.log(' Node version:', process.version);
    
    // Initialize all modules upfront
    await this.initializeAllModules();
    
    console.log('📡 Starting stdio transport...');
    const transport = new StdioServerTransport();
    
    // Add connection event logging
    transport.onerror = (error) => {
      console.error(' Transport error:', error);
    };
    
    await this.server.connect(transport);
    
    console.log(' Socket MCP Crypto Server started successfully!');
    console.log(' Server is ready to receive MCP requests via stdio');
    console.log(` All ${this.allTools.length} tools are pre-loaded and ready`);
    console.log(' Waiting for MCP requests...');
    
    this.setupGracefulShutdown();
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
          console.error(`Error cleaning up module ${module.name}:`, error);
        }
      }
      
      console.log(' Graceful shutdown completed');
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
