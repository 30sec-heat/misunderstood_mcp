import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import { LiquidationPostgresDatabase } from './postgres-database.js';
import { BinanceWebSocketListener } from './binance-websocket.js';
import { CoinalyzeAPI } from './coinalyze-api.js';
import { LiquidationAnalysisTool } from './tools/LiquidationAnalysisTool.js';
import { TelegramModule } from '../telegram/index.js';

export interface LiquidationModuleConfig {
  coinalyzeApiKey?: string;
  enableBinanceWebSocket?: boolean;
  enableCoinalyzeSync?: boolean;
  syncInterval?: number; // in milliseconds
  dbPath?: string;
}

export class LiquidationModule extends BaseCryptoModule {
  name = 'liquidations';
  
  private db: LiquidationPostgresDatabase;
  private binanceListener: BinanceWebSocketListener;
  private coinalyzeAPI: CoinalyzeAPI | null = null;
  private analysisTool: LiquidationAnalysisTool;
  private config: LiquidationModuleConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  // isInitialized is inherited from BaseCryptoModule
  private liquidationConnected: boolean = false;
  private lastSyncTime: number = 0;
  private readonly SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  private readonly COINALYZE_RATE_LIMIT = 40; // requests per minute
  private readonly COINS_PER_REQUEST = 20; // coins per API request
  private coinalyzeRequestCount = 0;
  private coinalyzeRateLimitReset = Date.now() + 60000;
  private telegramModule: TelegramModule | null = null;

  constructor(config: LiquidationModuleConfig = {}) {
    super();
    this.config = {
      coinalyzeApiKey: process.env.COINALYZE_API_KEY,
      enableBinanceWebSocket: true,
      enableCoinalyzeSync: true,
      syncInterval: 60 * 60 * 1000, // 1 hour
      ...config
    };

    this.db = new LiquidationPostgresDatabase();
    
    // Initialize database immediately so tools can use it
    this.db.initialize().catch(error => {
      console.warn('Liquidations database initialization failed:', error.message);
    });
    
    this.binanceListener = new BinanceWebSocketListener(this.db);
    this.analysisTool = new LiquidationAnalysisTool(this.db);

    if (this.config.coinalyzeApiKey) {
      this.coinalyzeAPI = new CoinalyzeAPI(this.config.coinalyzeApiKey, this.db);
    }
    
    // Set up tools after properties are initialized
    this.setupTools();
  }

  // Getter to expose CoinalyzeAPI for other modules
  public getCoinalyzeAPI(): CoinalyzeAPI | null {
    return this.coinalyzeAPI;
  }

  protected setupTools() {
    // Single consolidated liquidations analysis tool
    this.addTool({
      name: 'liquidations_comprehensive_analysis',
      description: 'Get comprehensive liquidation analysis for a specific coin including all metrics, trends, alerts, and social sentiment',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading symbol to analyze (e.g., BTCUSDT, ETHUSDT)',
            default: 'BTCUSDT'
          },
          timeframe: {
            type: 'string',
            description: 'Time period for analysis',
            enum: ['5m', '15m', '1h', '4h', '1d', '1w'],
            default: '1h'
          },
          minUsdValue: {
            type: 'number',
            description: 'Minimum liquidation value in USD to filter out small liquidations',
            default: 1000
          },
          includeMarketOverview: {
            type: 'boolean',
            description: 'Include overall market liquidation overview',
            default: true
          },
          includeSocialSentiment: {
            type: 'boolean',
            description: 'Include Telegram social sentiment analysis',
            default: true
          },
          alertThreshold: {
            type: 'number',
            description: 'Minimum liquidation value for high-value alerts',
            default: 500000
          }
        },
        required: ['symbol']
      },
      handler: this.getComprehensiveLiquidationAnalysis.bind(this)
    });

    // Keep the basic stats endpoint
    this.addTool({
      name: 'liquidations_get_stats',
      description: 'Get overall liquidation module statistics',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: this.getModuleStats.bind(this)
    });
  }

  async initialize(): Promise<void> {
    this.setupTools();
    
    if (this.isInitialized) {
      return;
    }

    try {
      await this.db.initialize();
      console.log('Liquidation database initialized');

      if (this.config.enableBinanceWebSocket && this.binanceListener) {
        await this.binanceListener.connect();
        await this.binanceListener.connectOpenInterest();
        this.liquidationConnected = true;
        console.log('Binance WebSocket listeners connected');
      }

      if (this.config.enableCoinalyzeSync && this.coinalyzeAPI) {
        await this.startCoinalyzeSync();
        console.log('Coinalyze sync started');
      }

      this.isInitialized = true;
      console.log('Liquidation module initialized successfully');
    } catch (error) {
      console.error('Failed to initialize liquidation module:', error);
      throw error;
    }
  }

  private async startCoinalyzeSync(): Promise<void> {
    if (!this.coinalyzeAPI) {
      console.warn('Coinalyze API not available, skipping sync');
      return;
    }

    // Initial sync
    await this.performCoinalyzeSync();

    // Set up periodic sync
    this.syncInterval = setInterval(async () => {
      try {
        await this.performCoinalyzeSync();
      } catch (error) {
        console.error('Error during Coinalyze sync:', error);
      }
    }, this.config.syncInterval);
  }

  private async performCoinalyzeSync(): Promise<void> {
    if (!this.coinalyzeAPI) return;

    try {
      console.log('💥 Liquidations: Starting optimized Coinalyze sync...');
      
      // Reset rate limit counter if needed
      const now = Date.now();
      if (now >= this.coinalyzeRateLimitReset) {
        this.coinalyzeRequestCount = 0;
        this.coinalyzeRateLimitReset = now + 60000; // Reset every minute
      }

      // Get popular symbols in batches to respect rate limits
      const allSymbols = await this.getSymbolsWithRateLimit();
      
      // Process symbols in batches of 20 (coins per request)
      const batches = this.chunkArray(allSymbols, this.COINS_PER_REQUEST);
      
      for (const batch of batches) {
        // Check rate limit before each request
        if (this.coinalyzeRequestCount >= this.COINALYZE_RATE_LIMIT) {
          console.log('💥 Liquidations: Rate limit reached, waiting...');
          await this.waitForRateLimit();
        }

        try {
          // Sync open interest (1 request)
          await this.coinalyzeAPI.syncOpenInterestData(batch);
          this.coinalyzeRequestCount++;
          
          // Small delay between requests
          await this.delay(1500); // 1.5 seconds
          
          if (this.coinalyzeRequestCount >= this.COINALYZE_RATE_LIMIT) {
            await this.waitForRateLimit();
          }
          
          // Sync liquidation data (1 request)
          await this.coinalyzeAPI.syncLiquidationData(batch, '1hour');
          this.coinalyzeRequestCount++;
          
          // Small delay between batches
          await this.delay(1500);
          
        } catch (error) {
          console.error(`Error syncing batch of ${batch.length} symbols:`, error);
          // Continue with next batch
        }
      }
      
      this.lastSyncTime = Date.now();
      console.log(`💥 Liquidations: Optimized Coinalyze sync completed for ${allSymbols.length} symbols in ${batches.length} batches`);
    } catch (error) {
      console.error('Error performing Coinalyze sync:', error);
    }
  }

  private async getSymbolsWithRateLimit(): Promise<string[]> {
    try {
      // This counts as 1 request
      this.coinalyzeRequestCount++;
      return await this.coinalyzeAPI!.getPopularSymbols(100); // Get more symbols but batch them
    } catch (error) {
      console.error('Error getting symbols:', error);
      // Return default symbols if API fails
      return [
        'BTCUSDT_PERP', 'ETHUSDT_PERP', 'ADAUSDT_PERP', 'SOLUSDT_PERP', 'DOTUSDT_PERP',
        'LINKUSDT_PERP', 'LTCUSDT_PERP', 'BCHUSDT_PERP', 'XRPUSDT_PERP', 'AVAXUSDT_PERP',
        'MATICUSDT_PERP', 'ATOMUSDT_PERP', 'NEARUSDT_PERP', 'FTMUSDT_PERP', 'SANDUSDT_PERP',
        'MANAUSDT_PERP', 'AXSUSDT_PERP', 'APEUSDT_PERP', 'GMTUSDT_PERP', 'GALAUSDT_PERP'
      ];
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async waitForRateLimit(): Promise<void> {
    const waitTime = this.coinalyzeRateLimitReset - Date.now();
    if (waitTime > 0) {
      console.log(`💥 Liquidations: Waiting ${Math.ceil(waitTime / 1000)}s for rate limit reset...`);
      await this.delay(waitTime);
    }
    this.coinalyzeRequestCount = 0;
    this.coinalyzeRateLimitReset = Date.now() + 60000;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Tool handlers
  public async getMostLiquidatedCoins(args: any) {
    try {
      const { timeframe = '1h', limit = 10, minUsdValue = 1000 } = args;
      const result = await this.analysisTool.getMostLiquidatedCoins(timeframe, limit, minUsdValue);
      
      return {
        liquidations: result,
        timeframe,
        minUsdValue,
        total: result.length,
        message: `Found ${result.length} most liquidated coins in the last ${timeframe} (min $${minUsdValue.toLocaleString()})`
      };
    } catch (error) {
      return {
        liquidations: [],
        error: `Failed to get most liquidated coins: ${error}`,
        message: 'Error retrieving liquidation data'
      };
    }
  }

  public async getLargeLiquidations(args: any) {
    try {
      const { threshold = 100000, limit = 20, timeframe = '1h', minUsdValue = 1000 } = args;
      const liquidations = await this.db.getLargestLiquidations(limit, timeframe, minUsdValue);
      const filtered = liquidations.filter(liq => liq.notional_value >= threshold);
      
      return {
        liquidations: filtered,
        threshold,
        minUsdValue,
        timeframe,
        total: filtered.length,
        message: `Found ${filtered.length} large liquidations above $${threshold.toLocaleString()} (min $${minUsdValue.toLocaleString()})`
      };
    } catch (error) {
      return {
        liquidations: [],
        error: `Failed to get large liquidations: ${error}`,
        message: 'Error retrieving large liquidation data'
      };
    }
  }

  public async getSymbolAnalysis(args: any) {
    try {
      const { symbol, timeframe = '1h', exchange, minUsdValue = 1000 } = args;
      const analysis = await this.analysisTool.getLiquidationAnalysis(symbol, exchange, timeframe, minUsdValue);
      const trends = await this.analysisTool.getLiquidationTrends(symbol, timeframe, 24, minUsdValue);
      const openInterest = await this.analysisTool.getOpenInterestAnalysis(symbol, exchange);

      return {
        symbol,
        timeframe,
        exchange: exchange || 'all',
        minUsdValue,
        analysis: analysis[0] || null,
        trends: trends.slice(-12), // Last 12 periods
        openInterest: openInterest[0] || null,
        message: `Analysis completed for ${symbol} (min $${minUsdValue.toLocaleString()})`
      };
    } catch (error) {
      return {
        symbol: args.symbol,
        error: `Failed to analyze symbol: ${error}`,
        message: 'Error analyzing symbol liquidation data'
      };
    }
  }

  public async getOpenInterestData(args: any) {
    try {
      const { symbol, exchange, timeframe = '1h' } = args;
      const current = await this.db.getCurrentOpenInterest(symbol, exchange);
      const history = await this.db.getOpenInterestHistory(symbol, exchange, timeframe);
      const analysis = await this.analysisTool.getOpenInterestAnalysis(symbol, exchange);

      return {
        symbol,
        exchange: exchange || 'all',
        current: current,
        history: history.slice(-24), // Last 24 data points
        analysis: analysis[0] || null,
        message: `Open interest data retrieved for ${symbol}`
      };
    } catch (error) {
      return {
        symbol: args.symbol,
        error: `Failed to get open interest: ${error}`,
        message: 'Error retrieving open interest data'
      };
    }
  }

  public async getExchangeComparison(args: any) {
    try {
      const { timeframe = '1h', minUsdValue = 1000 } = args;
      const comparison = await this.analysisTool.getExchangeComparison(timeframe, minUsdValue);
      
      return {
        exchanges: comparison,
        timeframe,
        minUsdValue,
        total: comparison.length,
        message: `Exchange comparison completed for ${timeframe} (min $${minUsdValue.toLocaleString()})`
      };
    } catch (error) {
      return {
        exchanges: [],
        error: `Failed to compare exchanges: ${error}`,
        message: 'Error comparing exchange liquidation activity'
      };
    }
  }

  public async getLiquidationAlerts(args: any) {
    try {
      const { threshold = 1000000, minUsdValue = 1000 } = args;
      const alerts = await this.analysisTool.getLiquidationAlerts(threshold, minUsdValue);
      
      return {
        alerts: alerts,
        threshold,
        minUsdValue,
        total: alerts.length,
        message: `Found ${alerts.length} liquidation alerts above $${threshold.toLocaleString()} (min $${minUsdValue.toLocaleString()})`
      };
    } catch (error) {
      return {
        alerts: [],
        error: `Failed to get alerts: ${error}`,
        message: 'Error retrieving liquidation alerts'
      };
    }
  }

  public async getMarketOverview(args: any) {
    try {
      const { timeframe = '1h', minUsdValue = 1000 } = args;
      const mostLiquidated = await this.analysisTool.getMostLiquidatedCoins(timeframe, 10, minUsdValue);
      const exchangeComparison = await this.analysisTool.getExchangeComparison(timeframe, minUsdValue);
      const alerts = await this.analysisTool.getLiquidationAlerts(500000, minUsdValue);
      const stats = await this.db.getStats();

      return {
        timeframe,
        minUsdValue,
        mostLiquidatedCoins: mostLiquidated,
        exchangeComparison,
        alerts,
        stats,
        websocketConnected: this.liquidationConnected,
        lastSync: new Date(this.lastSyncTime).toISOString(),
        message: `Market overview completed for ${timeframe} (min $${minUsdValue.toLocaleString()})`
      };
    } catch (error) {
      return {
        error: `Failed to get market overview: ${error}`,
        message: 'Error retrieving market overview'
      };
    }
  }

  public async getLiquidationTrends(args: any) {
    try {
      const { symbol, timeframe = '1h', periods = 24, minUsdValue = 1000 } = args;
      const trends = await this.analysisTool.getLiquidationTrends(symbol, timeframe, periods, minUsdValue);
      
      return {
        symbol,
        timeframe,
        minUsdValue,
        trends: trends,
        periods: trends.length,
        message: `Liquidation trends retrieved for ${symbol} (min $${minUsdValue.toLocaleString()})`
      };
    } catch (error) {
      return {
        symbol: args.symbol,
        error: `Failed to get trends: ${error}`,
        message: 'Error retrieving liquidation trends'
      };
    }
  }

  public async getModuleStats(args: any) {
    try {
      const stats = await this.db.getStats();
      
      return {
        stats: stats,
        websocketConnected: this.liquidationConnected,
        lastSync: new Date(this.lastSyncTime).toISOString(),
        message: 'Module statistics retrieved successfully'
      };
    } catch (error) {
      return {
        stats: null,
        error: `Failed to get stats: ${error}`,
        message: 'Error retrieving module statistics'
      };
    }
  }

  public async searchLiquidations(args: any) {
    try {
      const { ticker, timeRange = '24h', limit = 50 } = args;
      
      // If no telegram module is available, try to create one
      if (!this.telegramModule) {
        this.telegramModule = new TelegramModule();
      }

      let searchQuery: string;
      let searchType: string;
      
      if (ticker) {
        // Search for specific ticker + liquidation terms
        searchQuery = `${ticker} liquidated`;
        searchType = `ticker-specific (${ticker})`;
      } else {
        // Global search for liquidation terms
        searchQuery = 'liquidated';
        searchType = 'global';
      }

      // Search Telegram messages
      const telegramResult = await this.telegramModule.searchMessages({
        query: searchQuery,
        timeRange,
        limit
      });

      const messages = telegramResult.messages || [];
      
      // Process and filter messages to focus on liquidation context
      const liquidationMessages = messages.filter((msg: any) => {
        const text = msg.message_text?.toLowerCase() || '';
        return text.includes('liquidat') || text.includes('rekt') || text.includes('blown up') || text.includes('margin call');
      });

      // Create summary without exact numbers (as requested)
      const summary = {
        searchType,
        ticker: ticker || 'all',
        timeRange,
        totalMessages: liquidationMessages.length,
        hasActivity: liquidationMessages.length > 0,
        activityLevel: this.getActivityLevel(liquidationMessages.length),
        recentActivity: liquidationMessages.slice(0, 5).map((msg: any) => ({
          chat: msg.chat_title,
          username: msg.username,
          timestamp: msg.timestamp,
          snippet: this.createSnippet(msg.message_text)
        }))
      };

      return {
        ...summary,
        message: ticker 
          ? `Found liquidation mentions for ${ticker} - ${summary.activityLevel} activity level`
          : `Found global liquidation mentions - ${summary.activityLevel} activity level`
      };
    } catch (error) {
      return {
        searchType: args.ticker ? `ticker-specific (${args.ticker})` : 'global',
        ticker: args.ticker || 'all',
        error: `Search failed: ${error}`,
        message: 'Error searching for liquidation mentions'
      };
    }
  }

  private getActivityLevel(messageCount: number): string {
    if (messageCount === 0) return 'no';
    if (messageCount <= 5) return 'low';
    if (messageCount <= 15) return 'moderate';
    if (messageCount <= 30) return 'high';
    return 'very high';
  }

  private createSnippet(text: string): string {
    if (!text) return '';
    // Find liquidation-related keywords and create a snippet around them
    const keywords = ['liquidat', 'rekt', 'blown up', 'margin call'];
    const lowerText = text.toLowerCase();
    
    for (const keyword of keywords) {
      const index = lowerText.indexOf(keyword);
      if (index !== -1) {
        const start = Math.max(0, index - 30);
        const end = Math.min(text.length, index + 50);
        return '...' + text.substring(start, end) + '...';
      }
    }
    
    // Fallback to first 80 characters
    return text.length > 80 ? text.substring(0, 80) + '...' : text;
  }

  public async getComprehensiveLiquidationAnalysis(args: any) {
    try {
      const { 
        symbol, 
        timeframe = '1h', 
        minUsdValue = 1000, 
        includeMarketOverview = true,
        includeSocialSentiment = true,
        alertThreshold = 500000
      } = args;

      console.log(`[SEARCH] Starting comprehensive liquidation analysis for ${symbol}...`);

      // Core symbol analysis
      const symbolAnalysis = await this.analysisTool.getLiquidationAnalysis(symbol, undefined, timeframe, minUsdValue);
      const trends = await this.analysisTool.getLiquidationTrends(symbol, timeframe, 24, minUsdValue);
      const openInterest = await this.analysisTool.getOpenInterestAnalysis(symbol, undefined);
      
      // Get large liquidations from database directly
      const largeLiquidations = await this.db.getLargestLiquidations(20, timeframe, minUsdValue);
      const symbolLargeLiquidations = largeLiquidations.filter((liq: any) => liq.symbol === symbol);

      let marketOverview = null;
      if (includeMarketOverview) {
        const mostLiquidated = await this.analysisTool.getMostLiquidatedCoins(timeframe, 10, minUsdValue);
        const exchangeComparison = await this.analysisTool.getExchangeComparison(timeframe, minUsdValue);
        const alerts = await this.analysisTool.getLiquidationAlerts(alertThreshold, minUsdValue);
        
        marketOverview = {
          mostLiquidatedCoins: mostLiquidated,
          exchangeComparison,
          alerts: alerts.filter((alert: any) => alert.symbol === symbol), // Filter alerts for this symbol
          totalMarketAlerts: alerts.length
        };
      }

      let socialSentiment = null;
      if (includeSocialSentiment) {
        try {
          if (!this.telegramModule) {
            this.telegramModule = new TelegramModule();
          }

          const ticker = symbol.replace('USDT', '').replace('PERP', '');
          const telegramResult = await this.telegramModule.searchMessages({
            query: `${ticker} liquidated`,
            timeRange: timeframe === '1h' ? '6h' : '24h',
            limit: 50
          });

          const messages = telegramResult.messages || [];
          const liquidationMessages = messages.filter((msg: any) => {
            const text = msg.message_text?.toLowerCase() || '';
            return text.includes('liquidat') || text.includes('rekt') || text.includes('blown up') || text.includes('margin call');
          });

          socialSentiment = {
            totalMessages: liquidationMessages.length,
            hasActivity: liquidationMessages.length > 0,
            activityLevel: this.getActivityLevel(liquidationMessages.length),
            recentActivity: liquidationMessages.slice(0, 3).map((msg: any) => ({
              chat: msg.chat_title,
              username: msg.username,
              timestamp: msg.timestamp,
              snippet: this.createSnippet(msg.message_text)
            }))
          };
        } catch (error) {
          console.warn('Social sentiment analysis failed:', error);
          socialSentiment = { error: 'Social sentiment analysis unavailable' };
        }
      }

      // Module stats
      const stats = await this.db.getStats();

      const result = {
        symbol,
        timeframe,
        minUsdValue,
        analysisTimestamp: new Date().toISOString(),
        
        // Core symbol data
        symbolAnalysis,
        trends,
        openInterest,
        largeLiquidations: symbolLargeLiquidations,
        
        // Market context (optional)
        marketOverview,
        
        // Social sentiment (optional)
        socialSentiment,
        
        // System status
        systemStatus: {
          websocketConnected: this.liquidationConnected,
          lastSync: new Date(this.lastSyncTime).toISOString(),
          stats
        },
        
        message: `Comprehensive liquidation analysis completed for ${symbol} (${timeframe})`
      };

      console.log(`[SUCCESS] Comprehensive analysis completed for ${symbol}`);
      return result;

    } catch (error) {
      console.error('Comprehensive analysis failed:', error);
      return {
        symbol: args.symbol,
        error: `Failed to get comprehensive analysis: ${error}`,
        message: 'Error retrieving comprehensive liquidation analysis'
      };
    }
  }

  // Public methods for other modules
  async getLiquidationAnalysis(symbol?: string, exchange?: string, timeframe: string = '1h') {
    return await this.analysisTool.getLiquidationAnalysis(symbol, exchange, timeframe);
  }

  async getMostLiquidatedCoinsData(timeframe: string = '1h', limit: number = 10) {
    return await this.analysisTool.getMostLiquidatedCoins(timeframe, limit);
  }

  async getOpenInterestAnalysis(symbol: string, exchange?: string) {
    return await this.analysisTool.getOpenInterestAnalysis(symbol, exchange);
  }

  async getLiquidationTrendsData(symbol: string, timeframe: string = '1h', periods: number = 24) {
    return await this.analysisTool.getLiquidationTrends(symbol, timeframe, periods);
  }

  async getLiquidationAlertsData(threshold: number = 1000000) {
    return await this.analysisTool.getLiquidationAlerts(threshold);
  }

  async getExchangeComparisonData(timeframe: string = '1h') {
    return await this.analysisTool.getExchangeComparison(timeframe);
  }

  async getLiquidationsBySymbol(symbol: string, timeframe?: string, limit?: number) {
    return await this.db.getLiquidationsBySymbol(symbol, timeframe, limit);
  }

  async getLiquidationsByExchange(exchange: string, timeframe?: string, limit?: number) {
    return await this.db.getLiquidationsByExchange(exchange, timeframe, limit);
  }

  async getLargestLiquidations(limit: number = 10, timeframe?: string) {
    return await this.db.getLargestLiquidations(limit, timeframe);
  }

  async getCurrentOpenInterest(symbol: string, exchange?: string) {
    return await this.db.getCurrentOpenInterest(symbol, exchange);
  }

  async getOpenInterestHistory(symbol: string, exchange?: string, timeframe?: string) {
    return await this.db.getOpenInterestHistory(symbol, exchange, timeframe);
  }

  async getStats() {
    return await this.db.getStats();
  }

  async cleanupOldData() {
    return await this.db.cleanupOldData();
  }

  isWebSocketConnected(): boolean {
    return this.binanceListener.isWebSocketConnected();
  }

  async getLastSyncTime() {
    return this.lastSyncTime;
  }

  async isConnected() {
    return this.liquidationConnected;
  }

  // Cleanup method
  async destroy(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.binanceListener.disconnect();
    await this.db.close();
    this.isInitialized = false;
    this.liquidationConnected = false;
  }
}
