import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import axios from 'axios';
import { PolymarketPostgresDatabase, MarketRecord, OutcomeRecord, PriceHistoryRecord } from './postgres-database.js';
import * as fs from 'fs';
import * as path from 'path';

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
