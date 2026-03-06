#!/usr/bin/env node

import { CryptoModule } from './src/index.js';

// Import all modules
import { PolymarketModule } from './src/modules/polymarket/index.js';
import { SentimentModule } from './src/modules/sentiment/index.js';
import { NewsModule } from './src/modules/news/index.js';
import { ChartModule } from './src/modules/chart/index.js';
import { EconomicDataModule } from './src/modules/pyth/index.js';
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
import { EarningsFeedModule } from './src/modules/earnings/index.js';
import { MassiveModule } from './src/modules/massive/index.js';
import { BreakingNewsModule } from './src/modules/news/breaking-news.js';

// Service status interface
interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'initializing';
  lastError?: string;
  startTime?: Date;
  uptime?: number;
}

export class CryptoBackend {
  private modules: CryptoModule[] = [];
  private telegramModule: TelegramModule | null = null;
  private serviceStatuses: Map<string, ServiceStatus> = new Map();
  private isShuttingDown = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupSignalHandlers();
  }

  private setupSignalHandlers() {
    // Handle graceful shutdown
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGHUP', () => this.gracefulShutdown('SIGHUP'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('unhandledRejection');
    });
  }

  async initialize() {
    console.log(' Initializing Crypto Backend...');
    
    try {
      // Initialize modules with graceful error handling
      // First, initialize modules without dependencies
      const basicModuleClasses = [
        { class: NewsModule, name: 'news' },
        { class: ChartModule, name: 'chart' },
        { class: EconomicDataModule, name: 'pyth' },
        { class: PerformanceModule, name: 'performance' },
        { class: AaveModule, name: 'aave' },
        { class: DeFiLlamaModule, name: 'defillama' },
        { class: DexScreenerModule, name: 'dexscreener' },
        { class: QuoteModule, name: 'quote' },
        { class: AlphaScannerModule, name: 'alpha' },
        { class: DeribitModule, name: 'deribit' },
        { class: KnowledgeModule, name: 'knowledge' },
        { class: TradingModule, name: 'trading' },
        { class: OrderFlowModule, name: 'orderflow' },
        { class: EarningsFeedModule, name: 'earningsfeed' },
        { class: MassiveModule, name: 'massive' },
        { class: BreakingNewsModule, name: 'breaking_news' },
      ];

      // Initialize basic modules first
      for (const { class: ModuleClass, name: moduleName } of basicModuleClasses) {
        console.log(` Initializing ${moduleName} module...`);
        
        try {
          this.updateServiceStatus(moduleName, 'initializing');
          const module = new ModuleClass();
          await module.initialize();
          this.modules.push(module);
          this.updateServiceStatus(moduleName, 'running');
          console.log(` ${moduleName} module initialized successfully`);
        } catch (error) {
          console.error(` Failed to initialize ${moduleName} module:`, error);
          this.updateServiceStatus(moduleName, 'error', error instanceof Error ? error.message : String(error));
        }
      }

      // Initialize liquidation module first (needed for analysis module)
      let liquidationModule: LiquidationModule | null = null;
      try {
        console.log(' Initializing liquidations module...');
        this.updateServiceStatus('liquidations', 'initializing');
        liquidationModule = new LiquidationModule();
        await liquidationModule.initialize();
        this.modules.push(liquidationModule);
        this.updateServiceStatus('liquidations', 'running');
        console.log(' liquidations module initialized successfully');
      } catch (error) {
        console.error(' Failed to initialize liquidations module:', error);
        this.updateServiceStatus('liquidations', 'error', error instanceof Error ? error.message : String(error));
      }

      // Initialize analysis module with CoinalyzeAPI from liquidation module
      try {
        console.log(' Initializing analysis module...');
        this.updateServiceStatus('analysis', 'initializing');
        const coinalyzeAPI = liquidationModule?.getCoinalyzeAPI() || undefined;
        const analysisModule = new AnalysisModule(coinalyzeAPI);
        await analysisModule.initialize();
        this.modules.push(analysisModule);
        this.updateServiceStatus('analysis', 'running');
        console.log(' analysis module initialized successfully');
      } catch (error) {
        console.error(' Failed to initialize analysis module:', error);
        this.updateServiceStatus('analysis', 'error', error instanceof Error ? error.message : String(error));
      }

      // Initialize forecasting module (may depend on analysis module)
      try {
        console.log(' Initializing forecasting module...');
        this.updateServiceStatus('forecasting', 'initializing');
        const forecastingModule = new ForecastingModule();
        await forecastingModule.initialize();
        this.modules.push(forecastingModule);
        this.updateServiceStatus('forecasting', 'running');
        console.log(' forecasting module initialized successfully');
      } catch (error) {
        console.error(' Failed to initialize forecasting module:', error);
        this.updateServiceStatus('forecasting', 'error', error instanceof Error ? error.message : String(error));
      }

      // Try to initialize database-dependent modules
      let redditModule: RedditModule | null = null;
      
      try {
        console.log(' Initializing Telegram service...');
        this.updateServiceStatus('telegram', 'initializing');
        this.telegramModule = new TelegramModule();
        await this.telegramModule.initialize();
        this.updateServiceStatus('telegram', 'running');
        console.log(' Telegram module initialized successfully');
      } catch (error) {
        console.warn(' Telegram module failed to initialize (database issue):', error instanceof Error ? error.message : String(error));
        this.updateServiceStatus('telegram', 'error', 'Database compilation issue');
        this.telegramModule = null; // Ensure it's null if initialization fails
      }

      try {
        console.log('🔴 Initializing Reddit service...');
        this.updateServiceStatus('reddit', 'initializing');
        redditModule = new RedditModule();
        await redditModule.initialize();
        this.modules.push(redditModule);
        this.updateServiceStatus('reddit', 'running');
        console.log(' Reddit module initialized successfully');
      } catch (error) {
        console.warn(' Reddit module failed to initialize (database issue):', error instanceof Error ? error.message : String(error));
        this.updateServiceStatus('reddit', 'error', 'Database compilation issue');
        redditModule = null; // Ensure it's null if initialization fails
      }

      try {
        console.log(' Initializing Polymarket service...');
        this.updateServiceStatus('polymarket', 'initializing');
        const polymarketModule = new PolymarketModule();
        await polymarketModule.initialize();
        this.modules.push(polymarketModule);
        this.updateServiceStatus('polymarket', 'running');
        console.log(' Polymarket module initialized successfully');
      } catch (error) {
        console.warn(' Polymarket module failed to initialize (database issue):', error instanceof Error ? error.message : String(error));
        this.updateServiceStatus('polymarket', 'error', 'Database compilation issue');
      }

      // Initialize sentiment module if dependencies are available
      try {
        console.log(' Initializing sentiment module...');
        this.updateServiceStatus('sentiment', 'initializing');
        const sentimentModule = new SentimentModule();
        
        // Set up module dependencies if available
        if (this.telegramModule) {
          console.log(' Setting Telegram module for sentiment analysis...');
          sentimentModule.setTelegramModule(this.telegramModule);
        } else {
          console.warn(' Telegram module not available for sentiment analysis');
        }
        
        // Set Reddit module if available
        if (redditModule) {
          console.log('🔴 Setting Reddit module for sentiment analysis...');
          sentimentModule.setRedditModule(redditModule);
        } else {
          console.warn(' Reddit module not available for sentiment analysis');
        }
        
        // Note: Sentiment module doesn't need direct Polymarket module reference
        // It can access Polymarket data through database queries if needed
        
        console.log(' Calling sentiment module initialize()...');
        await sentimentModule.initialize();
        this.modules.push(sentimentModule);
        this.updateServiceStatus('sentiment', 'running');
        console.log(' Sentiment module initialized successfully');
        
        // Set up Telegram module for news module if available
        const newsModule = this.modules.find(m => m.name === 'news');
        if (newsModule && this.telegramModule && 'setTelegramModule' in newsModule) {
          (newsModule as any).setTelegramModule(this.telegramModule);
        }
      } catch (error) {
        console.error(' Sentiment module failed to initialize:', error instanceof Error ? error.message : String(error));
        console.error(' Full error:', error);
        this.updateServiceStatus('sentiment', 'error', error instanceof Error ? error.message : String(error));
      }

      console.log(` Backend initialization complete. ${this.modules.length} modules loaded.`);
      
      // Start health monitoring
      this.startHealthMonitoring();
      
    } catch (error) {
      console.error(' Failed to initialize backend:', error);
      // Don't throw error - continue even if some modules fail
    }
  }

  private updateServiceStatus(name: string, status: ServiceStatus['status'], error?: string) {
    const currentStatus = this.serviceStatuses.get(name) || {
      name,
      status: 'stopped' as const,
    };

    const newStatus: ServiceStatus = {
      ...currentStatus,
      status,
      lastError: error,
      startTime: status === 'running' && currentStatus.status !== 'running' ? new Date() : currentStatus.startTime,
      uptime: status === 'running' && currentStatus.startTime ? Date.now() - currentStatus.startTime.getTime() : undefined,
    };

    this.serviceStatuses.set(name, newStatus);
  }

  private startHealthMonitoring() {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds
  }

  private async performHealthCheck() {
    const healthStatus = {
      timestamp: new Date().toISOString(),
      services: Array.from(this.serviceStatuses.values()),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      modules: this.modules.length,
    };

    // Log health status periodically
    const runningServices = healthStatus.services.filter(s => s.status === 'running').length;
    const totalServices = healthStatus.services.length;
    
    if (runningServices < totalServices) {
      console.warn(`  Health check: ${runningServices}/${totalServices} services running`);
      const errorServices = healthStatus.services.filter(s => s.status === 'error');
      errorServices.forEach(service => {
        console.warn(`   - ${service.name}: ${service.lastError}`);
      });
    }
  }

  private async gracefulShutdown(signal: string) {
    if (this.isShuttingDown) {
      console.log('🛑 Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    console.log(`🛑 Received ${signal}, initiating graceful shutdown...`);

    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Stop Telegram service
      if (this.telegramModule) {
        console.log(' Stopping Telegram service...');
        try {
          await this.telegramModule.destroy();
          this.updateServiceStatus('telegram', 'stopped');
          console.log(' Telegram service stopped');
        } catch (error) {
          console.error(' Error stopping Telegram service:', error);
        }
      }

      // Stop other modules
      for (const module of this.modules) {
        const moduleName = module.name;
        console.log(` Stopping ${moduleName} module...`);
        
        try {
          if ('cleanup' in module && typeof module.cleanup === 'function') {
            await module.cleanup();
          }
          if ('destroy' in module && typeof module.destroy === 'function') {
            await module.destroy();
          }
          this.updateServiceStatus(moduleName, 'stopped');
          console.log(` ${moduleName} module stopped`);
        } catch (error) {
          console.error(` Error stopping ${moduleName} module:`, error);
        }
      }

      console.log(' Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error(' Error during shutdown:', error);
      process.exit(1);
    }
  }

  // Public methods for server.ts to use
  getTools() {
    return this.modules.flatMap(module => module.tools);
  }

  async callTool(name: string, args: any) {
    // Find the tool in any module
    for (const module of this.modules) {
      const tool = module.tools.find(t => t.name === name);
      if (tool && tool.handler) {
        return await tool.handler(args);
      }
    }
    throw new Error(`Tool ${name} not found`);
  }

  getServiceStatus() {
    return {
      services: Array.from(this.serviceStatuses.values()),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      modules: this.modules.length,
    };
  }

  getServerInfo() {
    const allTools = this.getTools();
    return {
      server: 'mcp-crypto-server',
      version: '1.0.0',
      tools: allTools.length,
      modules: this.modules.length
    };
  }
}

// Export singleton instance
export const cryptoBackend = new CryptoBackend();

// Start the backend if this file is run directly
async function startBackend() {
  console.log(' Starting Crypto Backend Server...');
  console.log(' Process ID:', process.pid);
  console.log(' Node version:', process.version);
  console.log(' Working directory:', process.cwd());
  
  try {
    await cryptoBackend.initialize();
    console.log(' Crypto Backend Server started successfully!');
    console.log(' All modules initialized and running');
    console.log(' Backend is now processing data and maintaining services');
    console.log(' Press Ctrl+C to stop the backend gracefully');
    
    // Keep the process running
    process.stdin.resume();
  } catch (error) {
    console.error(' Failed to start Crypto Backend Server:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startBackend().catch((error) => {
    console.error(' Backend startup failed:', error);
    process.exit(1);
  });
}