import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import axios from 'axios';
import { PolymarketPostgresDatabase, MarketRecord } from './postgres-database.js';
import * as fs from 'fs';
import * as path from 'path';
import * as gamma from './gamma-client.js';
import { getPriceHistory } from './clob-client.js';
import { getUserPositions } from './data-api-client.js';

// TypeScript interfaces for Polymarket data based on actual API response
interface PolymarketOutcome {
  name: string;
  price: number;
  probability: number;
}

interface PolymarketMarket {
  id: string;
  question: string;
  description: string;
  image: string;
  endDate: string;
  closed: boolean;
  archived: boolean;
  outcomes: string; // JSON string like "[\"Up\", \"Down\"]"
  outcomePrices?: string; // JSON string like "[\"0.5\", \"0.5\"]"
  volume: string;
  liquidity: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PolymarketModuleConfig {
  apiKey?: string;
  baseUrl: string;
  syncInterval: number;
  priceUpdateInterval: number;
}

interface PolymarketEvent {
  id: string;
  title: string;
  description: string;
  image: string;
  endDate: string;
  closed: boolean;
  archived: boolean;
  markets: PolymarketMarket[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags: Array<{
    id: string;
    label: string;
    slug: string;
  }>;
}

interface PolymarketPriceHistory {
  timestamp: string;
  price: number;
  volume: number;
}

interface PolymarketApiResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}


export class PolymarketModule extends BaseCryptoModule {
  name = 'polymarket';
  
  private apiBaseUrl = 'https://gamma-api.polymarket.com';
  private database: PolymarketPostgresDatabase;
  private lastSyncTime: number = 0;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private readonly SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly PRICE_UPDATE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour for price updates
  private priceUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private config: PolymarketModuleConfig = {
    baseUrl: 'https://clob.polymarket.com',
    syncInterval: this.SYNC_INTERVAL_MS,
    priceUpdateInterval: this.PRICE_UPDATE_INTERVAL_MS
  };

  protected setupTools() {
    this.addTool({
      name: 'polymarket_get_markets',
      description: 'Search for markets in the database and return their details',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find markets by question, description, or keywords'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of markets to return',
            default: 50
          },
          category: {
            type: 'string',
            description: 'Filter by market category',
            enum: ['politics', 'sports', 'crypto', 'economics', 'other']
          },
          status: {
            type: 'string',
            description: 'Filter by market status',
            enum: ['open', 'closed', 'all'],
            default: 'open'
          }
        }
      },
      handler: this.getMarkets.bind(this)
    });

    this.addTool({
      name: 'polymarket_market_sentiment',
      description: 'Analyze market sentiment based on trading activity',
      inputSchema: {
        type: 'object',
        properties: {
          marketId: {
            type: 'string',
            description: 'Market condition ID to analyze'
          },
          timeframe: {
            type: 'string',
            description: 'Timeframe for sentiment analysis',
            enum: ['1h', '4h', '24h', '7d'],
            default: '24h'
          }
        },
        required: ['marketId']
      },
      handler: this.analyzeMarketSentiment.bind(this)
    });

    this.addTool({
      name: 'polymarket_get_trending_markets',
      description: 'Get trending prediction markets from Polymarket Gamma API, sorted by volume or liquidity',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of markets to return', default: 20 },
          sortBy: { type: 'string', description: 'Sort field', enum: ['volume', 'liquidity', 'created'], default: 'volume' }
        }
      },
      handler: this.getTrendingMarkets.bind(this)
    });

    this.addTool({
      name: 'polymarket_get_markets_by_category',
      description: 'Get markets filtered by category/tag (e.g. politics, crypto, sports)',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Category slug or label (e.g. politics, crypto)' },
          limit: { type: 'number', description: 'Max number of markets', default: 20 }
        },
        required: ['category']
      },
      handler: this.getMarketsByCategory.bind(this)
    });

    this.addTool({
      name: 'polymarket_get_ending_soon',
      description: 'Get markets ending within a specified number of days',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of markets', default: 20 },
          withinDays: { type: 'number', description: 'Days until resolution', default: 7 }
        }
      },
      handler: this.getEndingSoon.bind(this)
    });

    this.addTool({
      name: 'polymarket_get_market_details',
      description: 'Get full details for a specific market or event by ID',
      inputSchema: {
        type: 'object',
        properties: {
          marketId: { type: 'string', description: 'Market condition ID or event ID' }
        },
        required: ['marketId']
      },
      handler: this.getMarketDetailsTool.bind(this)
    });

    this.addTool({
      name: 'polymarket_get_price_history',
      description: 'Get historical price data for a market from CLOB API',
      inputSchema: {
        type: 'object',
        properties: {
          market: { type: 'string', description: 'Market condition ID (required)' },
          interval: { type: 'string', description: 'Time interval', enum: ['max', 'all', '1m', '1h', '6h', '1d', '1w'], default: '1d' },
          startTs: { type: 'number', description: 'Optional start unix timestamp' },
          endTs: { type: 'number', description: 'Optional end unix timestamp' }
        },
        required: ['market']
      },
      handler: this.getPriceHistoryTool.bind(this)
    });

    this.addTool({
      name: 'polymarket_get_user_positions',
      description: 'Get current open positions for a user by wallet address (Data API)',
      inputSchema: {
        type: 'object',
        properties: {
          user: { type: 'string', description: 'User wallet address (0x-prefixed)' },
          limit: { type: 'number', description: 'Max positions to return', default: 100 },
          market: { type: 'string', description: 'Filter by market condition ID' },
          eventId: { type: 'string', description: 'Filter by event ID' }
        },
        required: ['user']
      },
      handler: this.getUserPositionsTool.bind(this)
    });

    this.addTool({
      name: 'polymarket_get_resolved_events',
      description: 'Get recently resolved prediction market events',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max events to return', default: 20 }
        }
      },
      handler: this.getResolvedEvents.bind(this)
    });

    this.addTool({
      name: 'polymarket_get_upcoming_resolutions',
      description: 'Get events with resolutions coming up within N days',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max events', default: 20 },
          withinDays: { type: 'number', description: 'Days until resolution', default: 7 }
        }
      },
      handler: this.getUpcomingResolutions.bind(this)
    });

    this.addTool({
      name: 'polymarket_get_market_comments',
      description: 'Get comments for an event or market',
      inputSchema: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'Event ID (preferred if available)' },
          marketId: { type: 'string', description: 'Market ID (if no eventId)' },
          limit: { type: 'number', description: 'Max comments', default: 20 }
        }
      },
      handler: this.getMarketComments.bind(this)
    });

    this.addTool({
      name: 'polymarket_search_markets',
      description: "Search Polymarket for prediction markets by topic. Use when users ask 'check what odds or if there are odds for xyz'.",
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (required) - e.g. "bitcoin 100k", "Trump election"' },
          limit: { type: 'number', description: 'Max markets to return', default: 10 },
          includeOdds: { type: 'boolean', description: 'Include current odds in results', default: true }
        },
        required: ['query']
      },
      handler: this.searchMarkets.bind(this)
    });

    this.addTool({
      name: 'polymarket_check_odds',
      description: "Quick check if Polymarket has odds for a topic. Returns yes/no plus matching markets with odds if found.",
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Topic to check (e.g. "bitcoin 100k", "Trump election")' }
        },
        required: ['topic']
      },
      handler: this.checkOdds.bind(this)
    });
  }

  constructor() {
    super();
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.database = new PolymarketPostgresDatabase();
    
    // Initialize database immediately so tools can use it
    this.database.initialize().catch(error => {
      console.warn('Polymarket database initialization failed:', error.message);
    });
    
    // Set up tools after properties are initialized
    this.setupTools();
  }

  async initialize(): Promise<void> {
    // Tools are already set up in constructor, database already initialized
    await this.startBackgroundSync();
  }

  private async startBackgroundSync(): Promise<void> {
    // Initial sync
    await this.syncActiveMarkets();
    
    // Set up daily market sync
    this.syncInterval = setInterval(async () => {
      await this.syncActiveMarkets();
    }, this.SYNC_INTERVAL_MS);
    
    // Set up hourly price updates
    this.priceUpdateInterval = setInterval(async () => {
      await this.updatePrices();
    }, this.PRICE_UPDATE_INTERVAL_MS);
  }

  private async syncActiveMarkets(): Promise<void> {
    try {
      console.log('[DATA] Polymarket: Starting daily market sync...');
      const response = await axios.get(`${this.apiBaseUrl}/events`, {
        params: {
          order: 'id',
          ascending: false,
          closed: false,
          limit: 100
        }
      });

      const events: PolymarketEvent[] = response.data;
      let marketsProcessed = 0;
      
      // Process markets in batches to avoid overwhelming the database
      const batchSize = 10;
      const allMarkets: PolymarketMarket[] = [];
      
      for (const event of events) {
        for (const market of event.markets) {
          if (!market.closed && !market.archived && market.active) {
            allMarkets.push(market);
          }
        }
      }
      
      // Process in batches
      for (let i = 0; i < allMarkets.length; i += batchSize) {
        const batch = allMarkets.slice(i, i + batchSize);
        
        for (const market of batch) {
          try {
            // Store market in database
            const marketRecord: MarketRecord = {
              id: market.id,
              question: market.question,
              description: market.description,
              image: market.image,
              endDate: market.endDate,
              closed: market.closed,
              archived: market.archived,
              active: market.active,
              volume: parseFloat(market.volume || '0'),
              liquidity: parseFloat(market.liquidity || '0'),
              createdAt: market.createdAt,
              updatedAt: market.updatedAt,
              lastSynced: new Date().toISOString()
            };
            
            await this.database.upsertMarket(marketRecord);
            
            // Store outcomes
            if (market.outcomes) {
              try {
                const outcomesArray = JSON.parse(market.outcomes);
                const pricesArray = market.outcomePrices ? JSON.parse(market.outcomePrices) : [];
                
                const outcomes = outcomesArray.map((outcomeName: string, index: number) => ({
                  name: outcomeName,
                  price: parseFloat(pricesArray[index] || '0'),
                  probability: parseFloat(pricesArray[index] || '0')
                }));
                
                await this.database.upsertOutcomes(market.id, outcomes);
                
                // Store initial price history
                for (const outcome of outcomes) {
                  await this.database.addPriceHistory(
                    market.id,
                    outcome.name,
                    outcome.price,
                    marketRecord.volume
                  );
                }
              } catch (error) {
                console.error('Failed to parse outcomes for market', market.id, ':', error);
              }
            }
            
            marketsProcessed++;
          } catch (error) {
            console.error('Failed to process market', market.id, ':', error);
          }
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Cleanup old data
      await this.database.cleanupOldData();
      
      this.lastSyncTime = Date.now();
      console.log(`[DATA] Polymarket: Daily sync completed. Processed ${marketsProcessed} markets.`);
      
      // Log sample markets
      if (allMarkets.length > 0) {
        const sampleMarkets = allMarkets.slice(0, 3);
        sampleMarkets.forEach(market => {
          console.log(`[DATA] [${market.question?.substring(0, 60)}${market.question?.length > 60 ? '...' : ''} (Vol: ${market.volume || '0'})`);
        });
      }
    } catch (error) {
      console.error('Failed to sync Polymarket data:', error);
    }
  }

  private async updatePrices(): Promise<void> {
    try {
      console.log('[DATA] Polymarket: Starting hourly price update...');
      const activeMarkets = await this.database.getActiveMarkets(100); // Update prices for up to 100 markets
      
      for (const market of activeMarkets) {
        try {
          // Fetch current market data
          const response = await axios.get(`${this.apiBaseUrl}/markets/${market.id}`);
          const marketData = response.data;
          
          if (marketData.outcomes && marketData.outcomePrices) {
            const outcomesArray = JSON.parse(marketData.outcomes);
            const pricesArray = JSON.parse(marketData.outcomePrices);
            
            // Update outcomes
            const outcomes = outcomesArray.map((outcomeName: string, index: number) => ({
              name: outcomeName,
              price: parseFloat(pricesArray[index] || '0'),
              probability: parseFloat(pricesArray[index] || '0')
            }));
            
            await this.database.upsertOutcomes(market.id, outcomes);
            
            // Add price history
            for (const outcome of outcomes) {
              await this.database.addPriceHistory(
                market.id,
                outcome.name,
                outcome.price,
                market.volume
              );
            }
          }
        } catch (error) {
          console.error(`Failed to update prices for market ${market.id}:`, error);
        }
      }
      
      console.log(`[DATA] Polymarket: Price update completed for ${activeMarkets.length} markets.`);
    } catch (error) {
      console.error('Failed to update prices:', error);
    }
  }

  private async fetchMarketDetails(marketId: string): Promise<PolymarketMarket | null> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/markets/${marketId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch market details for ${marketId}:`, error);
      return null;
    }
  }

  public async getMarkets(args: any) {
    try {
      const query = args.query;
      const limit = args.limit || 50;
      const category = args.category;
      const status = args.status || 'open';
      
      let markets;
      
      if (query) {
        // Search for markets by query
        const allMarkets = await this.database.getActiveMarkets(1000, category); // Get more markets for searching
        markets = allMarkets.filter(market => {
          const searchText = `${market.question} ${market.description}`.toLowerCase();
          return searchText.includes(query.toLowerCase());
        }).slice(0, limit);
      } else {
        // Get markets based on status filter
        if (status === 'all') {
          markets = await this.database.getAllMarkets(limit, category);
        } else if (status === 'closed') {
          markets = await this.database.getClosedMarkets(limit, category);
        } else {
          markets = await this.database.getActiveMarkets(limit, category);
        }
      }
      
      const stats = await this.database.getStats();
      
      // Get outcomes for each market
      const marketsWithOutcomes = await Promise.all(
        markets.map(async (market) => {
          const outcomes = await this.database.getOutcomesByMarketId(market.id);
          return {
            id: market.id,
            question: market.question,
            description: market.description,
            image: market.image,
            outcomes: outcomes.map(outcome => ({
              name: outcome.name,
              price: outcome.price,
              probability: outcome.probability
            })),
            volume: market.volume,
            liquidity: market.liquidity,
            end_date: market.endDate,
            active: market.active,
            closed: market.closed,
            created_at: market.createdAt,
            updated_at: market.updatedAt
          };
        })
      );
      
      return {
        query: query || null,
        status: status,
        category: category || null,
        markets: marketsWithOutcomes,
        total: marketsWithOutcomes.length,
        total_in_db: stats.activeMarkets,
        last_sync: new Date(this.lastSyncTime).toISOString(),
        message: query 
          ? `Found ${marketsWithOutcomes.length} markets matching "${query}"` 
          : `Retrieved ${marketsWithOutcomes.length} ${status} markets from database`
      };
    } catch (error) {
      return {
        query: args.query || null,
        markets: [],
        error: `Failed to fetch markets: ${error}`,
        message: 'Error retrieving markets'
      };
    }
  }

  private getTimeframeMs(timeframe: string): number {
    switch (timeframe) {
      case '1h': return 60 * 60 * 1000;
      case '4h': return 4 * 60 * 60 * 1000;
      case '1d': return 24 * 60 * 60 * 1000;
      case '1w': return 7 * 24 * 60 * 60 * 1000;
      default: return 0; // Return all data
    }
  }

  public async analyzeMarketSentiment(args: any) {
    try {
      const marketId = args.marketId;
      const timeframe = args.timeframe || '24h';
      
      // Get trades and activities for the market
      const trades: any[] = []; // Database method removed
      
      if (trades.length === 0) {
        return {
          marketId,
          sentiment: {
            score: 0,
            direction: 'neutral',
            confidence: 0,
            factors: []
          },
          message: 'No trading data available for sentiment analysis'
        };
      }
      
      // Calculate sentiment based on trading activity
      const buyTrades = trades.filter(t => t.side === 'BUY');
      const sellTrades = trades.filter(t => t.side === 'SELL');
      
      const buyVolume = buyTrades.reduce((sum, t) => sum + (t.size * t.price), 0);
      const sellVolume = sellTrades.reduce((sum, t) => sum + (t.size * t.price), 0);
      const totalVolume = buyVolume + sellVolume;
      
      // Calculate sentiment score (-1 to 1)
      const volumeRatio = totalVolume > 0 ? (buyVolume - sellVolume) / totalVolume : 0;
      const tradeRatio = trades.length > 0 ? (buyTrades.length - sellTrades.length) / trades.length : 0;
      
      // Weighted sentiment score
      const sentimentScore = (volumeRatio * 0.7) + (tradeRatio * 0.3);
      
      // Determine sentiment direction
      let direction = 'neutral';
      if (sentimentScore > 0.1) direction = 'bullish';
      else if (sentimentScore < -0.1) direction = 'bearish';
      
      // Calculate confidence based on volume and trade count
      const confidence = Math.min(1, Math.log(trades.length + 1) / 10) * Math.min(1, totalVolume / 10000);
      
      // Analyze recent trends
      const recentTrades = trades.slice(0, Math.min(10, trades.length));
      const recentBuyRatio = recentTrades.filter(t => t.side === 'BUY').length / recentTrades.length;
      
      const factors = [
        {
          factor: 'Volume Ratio',
          value: volumeRatio,
          description: `Buy volume vs sell volume: ${(volumeRatio * 100).toFixed(1)}%`
        },
        {
          factor: 'Trade Count Ratio',
          value: tradeRatio,
          description: `Buy trades vs sell trades: ${(tradeRatio * 100).toFixed(1)}%`
        },
        {
          factor: 'Recent Activity',
          value: recentBuyRatio,
          description: `Recent buy ratio: ${(recentBuyRatio * 100).toFixed(1)}%`
        },
        {
          factor: 'Total Volume',
          value: totalVolume,
          description: `Total trading volume: $${totalVolume.toFixed(2)}`
        }
      ];
      
      return {
        marketId,
        timeframe,
        sentiment: {
          score: sentimentScore,
          direction,
          confidence,
          factors,
          buyVolume,
          sellVolume,
          totalTrades: trades.length,
          recentBuyRatio
        },
        message: `Market sentiment analysis completed for ${marketId}`
      };
    } catch (error) {
      return {
        marketId: args.marketId,
        sentiment: null,
        error: `Failed to analyze market sentiment: ${error}`,
        message: 'Error analyzing market sentiment'
      };
    }
  }

  public async getTrendingMarkets(args: any) {
    const limit = args.limit ?? 20;
    const sortBy = args.sortBy ?? 'volume';
    const events = await gamma.getTrendingMarkets(limit, sortBy);
    return { events, total: events.length, sortBy };
  }

  public async getMarketsByCategory(args: any) {
    const category = args.category;
    const limit = args.limit ?? 20;
    if (!category) return { error: 'category is required', events: [] };
    const events = await gamma.getMarketsByCategory(category, limit);
    return { events, total: events.length, category };
  }

  public async getEndingSoon(args: any) {
    const limit = args.limit ?? 20;
    const withinDays = args.withinDays ?? 7;
    const events = await gamma.getEndingSoon(limit, withinDays);
    return { events, total: events.length, withinDays };
  }

  public async getMarketDetailsTool(args: any) {
    const marketId = args.marketId;
    if (!marketId) return { error: 'marketId is required' };
    const details = await gamma.getMarketDetails(marketId);
    if (!details) return { error: 'Market not found', marketId };
    return { market: details };
  }

  public async getPriceHistoryTool(args: any) {
    const market = args.market;
    const interval = args.interval ?? '1d';
    const startTs = args.startTs;
    const endTs = args.endTs;
    if (!market) return { error: 'market is required', history: [] };
    const history = await getPriceHistory(market, interval, startTs, endTs);
    return { market, interval, history, count: history.length };
  }

  public async getUserPositionsTool(args: any) {
    const user = args.user;
    const limit = args.limit ?? 100;
    const market = args.market;
    const eventId = args.eventId;
    if (!user) return { error: 'user (wallet address) is required', positions: [] };
    const positions = await getUserPositions(user, { limit, market, eventId });
    return { user, positions, total: positions.length };
  }

  public async getResolvedEvents(args: any) {
    const limit = args.limit ?? 20;
    const events = await gamma.getResolvedEvents(limit);
    return { events, total: events.length };
  }

  public async getUpcomingResolutions(args: any) {
    const limit = args.limit ?? 20;
    const withinDays = args.withinDays ?? 7;
    const events = await gamma.getUpcomingResolutions(limit, withinDays);
    return { events, total: events.length, withinDays };
  }

  public async getMarketComments(args: any) {
    const eventId = args.eventId;
    const marketId = args.marketId;
    const limit = args.limit ?? 20;
    if (!eventId && !marketId) return { error: 'eventId or marketId required', comments: [] };
    const comments = await gamma.getMarketComments(eventId, marketId, limit);
    return { comments, total: comments.length };
  }

  public async searchMarkets(args: any) {
    const query = args.query?.trim();
    const limit = args.limit ?? 10;
    const includeOdds = args.includeOdds !== false;
    if (!query) return { error: 'query is required', markets: [], message: 'Please provide a search query.' };
    const markets = await gamma.searchMarkets(query, limit, includeOdds);
    const message = markets.length > 0
      ? `Found ${markets.length} markets for '${query}': ${markets.map(m => `"${m.question}"${m.odds ? ` (${m.odds.map(o => `${o.outcome}: ${(o.probability * 100).toFixed(1)}%`).join(', ')})` : ''}`).join('; ')}`
      : `No markets found for '${query}'.`;
    return { query, markets, total: markets.length, message };
  }

  public async checkOdds(args: any) {
    const topic = args.topic?.trim();
    if (!topic) return { found: false, error: 'topic is required', markets: [], message: 'Please provide a topic to check.' };
    const markets = await gamma.searchMarkets(topic, 5, true);
    const found = markets.length > 0;
    const message = found
      ? `Yes, Polymarket has odds for '${topic}'. Found ${markets.length} market(s): ${markets.map(m => `"${m.question}" - ${m.odds?.map(o => `${o.outcome}: ${(o.probability * 100).toFixed(1)}%`).join(', ')}`).join('; ')}`
      : `No, Polymarket does not appear to have active odds for '${topic}'.`;
    return { found, topic, markets, total: markets.length, message };
  }

  // Cleanup method for testing
  async destroy(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
    }
    await this.database.close();
  }
}
