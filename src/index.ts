#!/usr/bin/env node

// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import modules
import { PolymarketModule } from './modules/polymarket/index.js';
import { SentimentModule } from './modules/sentiment/index.js';
import { NewsModule } from './modules/news/index.js';
import { ChartModule } from './modules/chart/index.js';
import { EconomicDataModule } from './modules/econ_data/index.js';
import { PerformanceModule } from './modules/performance/index.js';
import { AnalysisModule } from './modules/analysis/index.js';
import { TelegramModule } from './modules/telegram/index.js';
import { DeFiLlamaModule } from './modules/defillama/index.js';
import { DexScreenerModule } from './modules/dexscreener/index.js';
import { AlphaScannerModule } from './modules/alpha/index.js';
import { QuoteModule } from './modules/quote/index.js';
import { DeribitModule } from './modules/deribit/index.js';
import { RedditModule } from './modules/reddit/index.js';
import { ForecastingModule } from './modules/forecasting/index.js';
import { AaveModule } from './modules/aave/index.js';
import { LiquidationModule } from './modules/liquidations/index.js';
import { KnowledgeModule } from './modules/knowledge/index.js';
import { TradingModule } from './modules/trading/index.js';
import { OrderFlowModule } from './modules/orderflow/index.js';
import { SolanaModule } from './modules/solana/index.js';
import { SocialModule } from './modules/social/index.js';
import { EarningsFeedModule } from './modules/earnings/index.js';
import { MassiveModule } from './modules/massive/index.js';
import { BreakingNewsModule } from './modules/news/breaking-news.js';
import { ResearchModule } from './modules/research/index.js';
// DatabaseManager removed - using PostgreSQL directly
import { websocketManager } from './modules/base/websocket-manager.js';

// Base module interface
export interface CryptoModule {
  name: string;
  tools: any[];
  initialize(): Promise<void>;
}

class CryptoMCPServer {
  private server: Server;
  private modules: CryptoModule[] = [];
  private moduleInstances: Map<string, CryptoModule> = new Map();
  private initializedModules: Set<string> = new Set();
  private memoryMonitorInterval: NodeJS.Timeout | null = null;
  private lastMemoryCheck: number = 0;

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
    this.registerModules();
    this.startMemoryMonitoring();
  }

  private registerModules() {
    // Register module classes without instantiating them
    const moduleClasses = [
      { name: 'polymarket', class: PolymarketModule },
      { name: 'sentiment', class: SentimentModule },
      { name: 'news', class: NewsModule },
      { name: 'chart', class: ChartModule },
      { name: 'econ_data', class: EconomicDataModule },
      { name: 'performance', class: PerformanceModule },
      { name: 'analysis', class: AnalysisModule },
      { name: 'telegram', class: TelegramModule },
      { name: 'defillama', class: DeFiLlamaModule },
      { name: 'dexscreener', class: DexScreenerModule },
      { name: 'alpha', class: AlphaScannerModule },
      { name: 'quote', class: QuoteModule },
      { name: 'deribit', class: DeribitModule },
      { name: 'reddit', class: RedditModule },
      { name: 'forecasting', class: ForecastingModule },
      { name: 'aave', class: AaveModule },
      { name: 'liquidations', class: LiquidationModule },
      { name: 'knowledge', class: KnowledgeModule },
      { name: 'trading', class: TradingModule },
      { name: 'orderflow', class: OrderFlowModule },
      { name: 'solana', class: SolanaModule },
      { name: 'social', class: SocialModule },
      { name: 'research', class: ResearchModule },
      { name: 'earningsfeed', class: EarningsFeedModule },
      { name: 'massive', class: MassiveModule },
      { name: 'breaking_news', class: BreakingNewsModule },
    ];

    // Store module classes for lazy loading
    moduleClasses.forEach(({ name, class: ModuleClass }) => {
      this.moduleInstances.set(name, ModuleClass as any);
    });

    // Modules registered for lazy loading
  }

  private async initializeModule(moduleName: string): Promise<CryptoModule | null> {
    if (this.initializedModules.has(moduleName)) {
      return this.moduleInstances.get(moduleName) || null;
    }

    const ModuleClass = this.moduleInstances.get(moduleName);
    if (!ModuleClass) {
      console.error(`Module ${moduleName} not found`);
      return null;
    }

    try {
      // Initializing module
      
      // Create module instance
      const module = new (ModuleClass as any)();
      
      // Add timeout for module initialization
      const initPromise = module.initialize();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Module ${moduleName} initialization timeout`)), 30000);
      });
      
      await Promise.race([initPromise, timeoutPromise]);
      
      // Store initialized module
      this.moduleInstances.set(moduleName, module);
      this.initializedModules.add(moduleName);
      this.modules.push(module);
      
      // Module initialized successfully
      return module;
    } catch (error) {
      console.error(`❌ Failed to initialize ${moduleName} module:`, error);
      return null;
    }
  }

  private async initializeEssentialModules() {
    // Initialize all modules for full tool discovery
    const essentialModules = [
      'telegram', 'polymarket', 'sentiment', 'news', 'reddit',
      'dexscreener', 'aave', 'analysis', 'defillama', 'deribit',
      'chart', 'econ_data', 'performance', 'alpha', 'quote',
      'knowledge', 'research',
      'forecasting', 'liquidations', 'trading', 'orderflow', 'solana', 'social',
      'earningsfeed', 'massive', 'breaking_news'
    ];
    
    // Initializing essential modules
    for (const moduleName of essentialModules) {
      try {
        // Add timeout to prevent hanging
        const initPromise = this.initializeModule(moduleName);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Module ${moduleName} initialization timeout`)), 10000);
        });
        
        await Promise.race([initPromise, timeoutPromise]);
        // Module loaded successfully
      } catch (error) {
        console.error(`❌ Failed to load ${moduleName} module:`, error instanceof Error ? error.message : String(error));
        // Continue with other modules
      }
    }

    // Set up cross-module dependencies
    const telegramModule = this.moduleInstances.get('telegram') as any;
    const polymarketModule = this.moduleInstances.get('polymarket') as any;
    const sentimentModule = this.moduleInstances.get('sentiment') as any;
    const alphaModule = this.moduleInstances.get('alpha') as any;
    const redditModule = this.moduleInstances.get('reddit') as any;
    const newsModule = this.moduleInstances.get('news') as any;
    const deribitModule = this.moduleInstances.get('deribit') as any;
    const forecastingModule = this.moduleInstances.get('forecasting') as any;
    const analysisModule = this.moduleInstances.get('analysis') as any;
    
    if (telegramModule && sentimentModule && sentimentModule.setTelegramModule) {
      sentimentModule.setTelegramModule(telegramModule);
    }
    
    if (polymarketModule && sentimentModule && sentimentModule.setPolymarketModule) {
      sentimentModule.setPolymarketModule(polymarketModule);
    }
    
    if (redditModule && sentimentModule && sentimentModule.setRedditModule) {
      sentimentModule.setRedditModule(redditModule);
    }

    if (newsModule && sentimentModule && sentimentModule.setNewsModule) {
      sentimentModule.setNewsModule(newsModule);
    }
    
    if (telegramModule && alphaModule && alphaModule.setTelegramModule) {
      alphaModule.setTelegramModule(telegramModule);
    }
    
    if (telegramModule && newsModule && newsModule.setTelegramModule) {
      newsModule.setTelegramModule(telegramModule);
    }
    
    if (deribitModule && forecastingModule && forecastingModule.setDeribitModule) {
      forecastingModule.setDeribitModule(deribitModule);
    }

    const socialModule = this.moduleInstances.get('social') as any;
    if (newsModule && socialModule && socialModule.setNewsModule) {
      socialModule.setNewsModule(newsModule);
    }

    // Wire up comprehensive forecast dependencies
    if (forecastingModule) {
      if (analysisModule && forecastingModule.setAnalysisModule) {
        forecastingModule.setAnalysisModule(analysisModule);
      }
      if (newsModule && forecastingModule.setNewsModule) {
        forecastingModule.setNewsModule(newsModule);
      }
    }
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Get tools from all registered modules, not just initialized ones
      const allTools: any[] = [];
      
      // First, get tools from successfully initialized modules
      for (const module of this.modules) {
        allTools.push(...module.tools);
      }
      
      // Then, get tools from modules that failed to initialize but still have tool definitions
      for (const [moduleName, ModuleClass] of this.moduleInstances) {
        if (!this.initializedModules.has(moduleName)) {
          try {
            // Create a temporary instance just to get the tools
            const tempModule = new (ModuleClass as any)();
            if (tempModule.tools && Array.isArray(tempModule.tools)) {
              allTools.push(...tempModule.tools);
              // Tools added from module
            }
          } catch (error) {
            console.warn(`⚠️ Could not get tools from module ${moduleName}:`, error);
          }
        }
      }
      
      // Tools registered
      return { tools: allTools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      // Find the tool in any initialized module
      for (const module of this.modules) {
        const tool = module.tools.find(t => t.name === name);
        if (tool && tool.handler) {
          return await tool.handler(args);
        }
      }

      // If tool not found in initialized modules, try to lazy load modules
      const moduleNames = Array.from(this.moduleInstances.keys());
      for (const moduleName of moduleNames) {
        if (!this.initializedModules.has(moduleName)) {
          // Try to initialize the module first
          const module = await this.initializeModule(moduleName);
          if (module) {
            const tool = module.tools.find(t => t.name === name);
            if (tool && tool.handler) {
              // Module lazy loaded for tool
              return await tool.handler(args);
            }
          } else {
            // If initialization failed, try to create a temporary instance for the tool
            try {
              const ModuleClass = this.moduleInstances.get(moduleName);
              if (ModuleClass) {
                const tempModule = new (ModuleClass as any)();
                const tool = tempModule.tools?.find((t: any) => t.name === name);
                if (tool && tool.handler) {
                  // Using tool from uninitialized module
                  return await tool.handler(args);
                }
              }
            } catch (error) {
              console.warn(`⚠️ Could not create temporary instance for module ${moduleName}:`, error);
            }
          }
        }
      }

      throw new Error(`Tool ${name} not found`);
    });
  }

  private startMemoryMonitoring() {
    this.memoryMonitorInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // Check every 30 seconds
  }

  private checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const externalMB = Math.round(memUsage.external / 1024 / 1024);
    
    // Log memory usage every 5 minutes
    const now = Date.now();
    if (now - this.lastMemoryCheck > 300000) {
      // Memory usage logged
      this.lastMemoryCheck = now;
    }

    // Warn if memory usage is high
    if (heapUsedMB > 1500) {
      console.warn(`⚠️ High memory usage detected: ${heapUsedMB}MB`);
      this.performGarbageCollection();
    }

    // Force garbage collection if memory usage is critical
    if (heapUsedMB > 2000) {
      console.warn(`🚨 Critical memory usage: ${heapUsedMB}MB - forcing garbage collection`);
      this.performGarbageCollection();
    }
  }

  private performGarbageCollection() {
    if (global.gc) {
      console.log('🧹 Performing garbage collection...');
      global.gc();
      
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      console.log(`✅ Garbage collection complete. Memory: ${heapUsedMB}MB`);
    } else {
      console.warn('⚠️ Garbage collection not available. Start with --expose-gc flag');
    }
  }

  async start() {
    // Starting MCP Crypto Server
    
    // Initialize only essential modules first
    await this.initializeEssentialModules();
    
    // Essential modules loaded
    
    // Start stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.log('✅ MCP Crypto Server started successfully!');
    console.log('🔧 Server is ready to receive MCP requests via stdio');
    
    // Setup graceful shutdown
    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown() {
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      // Stop memory monitoring
      if (this.memoryMonitorInterval) {
        clearInterval(this.memoryMonitorInterval);
        this.memoryMonitorInterval = null;
      }
      
      // Cleanup modules
      for (const module of this.modules) {
        try {
          if ('cleanup' in module && typeof module.cleanup === 'function') {
            await module.cleanup();
          }
        } catch (error) {
          console.error(`Error cleaning up module ${module.name}:`, error);
        }
      }
      
      // Close database connections
      // DatabaseManager removed - using PostgreSQL directly
      
      // Close WebSocket connections
      websocketManager.disconnectAll();
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));
  }
}

// Start the server
const server = new CryptoMCPServer();
server.start().catch(console.error);
