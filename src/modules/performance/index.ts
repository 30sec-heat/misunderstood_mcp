import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import ccxt from 'ccxt';

export class PerformanceModule extends BaseCryptoModule {
  name = 'performance';

  protected setupTools() {
    this.addTool({
      name: 'performance_get_top_gainers',
      description: 'Get top performing assets by price change percentage',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of top gainers to return',
            default: 15
          },
          excludeMajors: {
            type: 'boolean',
            description: 'Exclude BTC and ETH from results',
            default: false
          },
          minVolume: {
            type: 'number',
            description: 'Minimum 24h volume in USD',
            default: 20000000
          },
          timeframe: {
            type: 'string',
            description: 'Timeframe for performance calculation',
            enum: ['24h', '1h', '4h', '1d'],
            default: '24h'
          }
        }
      },
      handler: this.getTopGainers.bind(this)
    });

    this.addTool({
      name: 'performance_get_worst_performers',
      description: 'Get worst performing assets by price change percentage',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of worst performers to return',
            default: 15
          },
          minVolume: {
            type: 'number',
            description: 'Minimum 24h volume in USD',
            default: 5000000
          },
          timeframe: {
            type: 'string',
            description: 'Timeframe for performance calculation',
            enum: ['24h', '1h', '4h', '1d'],
            default: '24h'
          }
        }
      },
      handler: this.getWorstPerformers.bind(this)
    });

    this.addTool({
      name: 'performance_get_high_volume_markets',
      description: 'Get high volume markets sorted by trading volume',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of markets to return',
            default: 50
          },
          minVolume: {
            type: 'number',
            description: 'Minimum 24h volume in USD',
            default: 20000000
          },
          excludeStablecoins: {
            type: 'boolean',
            description: 'Exclude stablecoins from results',
            default: true
          }
        }
      },
      handler: this.getHighVolumeMarkets.bind(this)
    });

    this.addTool({
      name: 'performance_get_market_comparison',
      description: 'Get comprehensive market performance comparison',
      inputSchema: {
        type: 'object',
        properties: {
          symbols: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of symbols to compare (e.g., ["BTC", "ETH", "SOL"])'
          },
          timeframe: {
            type: 'string',
            description: 'Timeframe for comparison',
            enum: ['1h', '4h', '24h', '7d'],
            default: '24h'
          }
        },
        required: ['symbols']
      },
      handler: this.getMarketComparison.bind(this)
    });

    this.addTool({
      name: 'performance_get_best_worst_combo',
      description: 'Get top best and worst performers for comparison charts',
      inputSchema: {
        type: 'object',
        properties: {
          bestLimit: {
            type: 'number',
            description: 'Number of best performers',
            default: 5
          },
          worstLimit: {
            type: 'number',
            description: 'Number of worst performers',
            default: 5
          },
          minVolume: {
            type: 'number',
            description: 'Minimum 24h volume in USD',
            default: 20000000
          },
          timeframe: {
            type: 'string',
            description: 'Timeframe for performance calculation',
            enum: ['24h', '1h', '4h', '1d'],
            default: '24h'
          }
        }
      },
      handler: this.getBestWorstCombo.bind(this)
    });
  }

  private async getTopGainers(args: any) {
    try {
      const { limit, excludeMajors, minVolume, timeframe } = args;
      
      console.log('[DATA] Fetching top gainers using CCXT...');
      
      // Try multiple exchanges in order of preference
      const exchanges = ['coinbase', 'mexc', 'bitget', 'kraken'];
      let tickers: any[] = [];
      let exchangeName = '';

      for (const exchangeId of exchanges) {
        try {
          const exchange = new (ccxt as any)[exchangeId]();
          console.log(`   Trying ${exchangeId}...`);
          
          const allTickers = await exchange.fetchTickers();
          tickers = Object.values(allTickers);
          exchangeName = exchangeId;
          console.log(`   [SUCCESS] Successfully fetched ${tickers.length} tickers from ${exchangeId}`);
          break;
        } catch (error) {
          console.log(`   [ERROR] ${exchangeId} failed: ${error}`);
          continue;
        }
      }

      if (tickers.length === 0) {
        throw new Error('All exchanges failed');
      }

      let filtered = tickers
        .filter((ticker: any) => ticker.symbol.endsWith('/USDT') || ticker.symbol.endsWith('/USD'))
        .map((ticker: any) => ({
          symbol: ticker.symbol.replace('/USDT', '').replace('/USD', ''),
          priceChangePercent: ticker.percentage || 0,
          volume: ticker.quoteVolume || 0,
          price: ticker.last || 0,
          high: ticker.high || 0,
          low: ticker.low || 0,
          baseVolume: ticker.baseVolume || 0,
          originalSymbol: ticker.symbol
        }));

      // Deduplicate by symbol, keeping the one with highest volume
      const symbolMap = new Map();
      filtered.forEach((item: any) => {
        const existing = symbolMap.get(item.symbol);
        if (!existing || item.volume > existing.volume) {
          symbolMap.set(item.symbol, item);
        }
      });
      filtered = Array.from(symbolMap.values());

      if (excludeMajors) {
        filtered = filtered.filter((ticker: any) => 
          !['BTC', 'ETH'].includes(ticker.symbol)
        );
        console.log('🚫 Excluding BTC and ETH from top gainers');
      }

      const result = filtered
        .filter((ticker: any) => ticker.volume > (minVolume || 0))
        .sort((a: any, b: any) => b.priceChangePercent - a.priceChangePercent)
        .slice(0, limit || 15);

      return {
        gainers: result,
        count: result.length,
        timeframe,
        minVolume: minVolume / 1000000 + 'M USD',
        exchange: exchangeName,
        message: `Found ${result.length} top gainers with >${minVolume/1000000}M USD volume from ${exchangeName}`
      };
    } catch (error: any) {
      return {
        gainers: [],
        error: error.message,
        message: `Failed to fetch top gainers: ${error.message}`
      };
    }
  }

  private async getWorstPerformers(args: any) {
    try {
      const { limit, minVolume, timeframe } = args;
      
      console.log('[DATA] Fetching worst performers using CCXT...');
      
      // Try multiple exchanges in order of preference
      const exchanges = ['coinbase', 'mexc', 'bitget', 'kraken'];
      let tickers: any[] = [];
      let exchangeName = '';

      for (const exchangeId of exchanges) {
        try {
          const exchange = new (ccxt as any)[exchangeId]();
          console.log(`   Trying ${exchangeId}...`);
          
          const allTickers = await exchange.fetchTickers();
          tickers = Object.values(allTickers);
          exchangeName = exchangeId;
          console.log(`   [SUCCESS] Successfully fetched ${tickers.length} tickers from ${exchangeId}`);
          break;
        } catch (error) {
          console.log(`   [ERROR] ${exchangeId} failed: ${error}`);
          continue;
        }
      }

      if (tickers.length === 0) {
        throw new Error('All exchanges failed');
      }

      let filtered = tickers
        .filter((ticker: any) => ticker.symbol.endsWith('/USDT') || ticker.symbol.endsWith('/USD'))
        .map((ticker: any) => ({
          symbol: ticker.symbol.replace('/USDT', '').replace('/USD', ''),
          priceChangePercent: ticker.percentage || 0,
          volume: ticker.quoteVolume || 0,
          price: ticker.last || 0,
          high: ticker.high || 0,
          low: ticker.low || 0,
          baseVolume: ticker.baseVolume || 0,
          originalSymbol: ticker.symbol
        }));

      // Deduplicate by symbol, keeping the one with highest volume
      const symbolMap = new Map();
      filtered.forEach((item: any) => {
        const existing = symbolMap.get(item.symbol);
        if (!existing || item.volume > existing.volume) {
          symbolMap.set(item.symbol, item);
        }
      });
      filtered = Array.from(symbolMap.values());

      const result = filtered
        .filter((ticker: any) => ticker.volume > (minVolume || 0))
        .sort((a: any, b: any) => a.priceChangePercent - b.priceChangePercent)
        .slice(0, limit || 15);

      return {
        performers: result,
        count: result.length,
        timeframe,
        minVolume: minVolume / 1000000 + 'M USD',
        exchange: exchangeName,
        message: `Found ${result.length} worst performers with >${minVolume/1000000}M USD volume from ${exchangeName}`
      };
    } catch (error: any) {
      return {
        performers: [],
        error: error.message,
        message: `Failed to fetch worst performers: ${error.message}`
      };
    }
  }

  private async getHighVolumeMarkets(args: any) {
    try {
      const { limit, minVolume, excludeStablecoins } = args;
      
      console.log(`[DATA] Fetching high volume markets (>${minVolume/1000000}M USD) using CCXT...`);
      
      // Try multiple exchanges in order of preference
      const exchanges = ['coinbase', 'mexc', 'bitget', 'kraken'];
      let tickers: any[] = [];
      let exchangeName = '';

      for (const exchangeId of exchanges) {
        try {
          const exchange = new (ccxt as any)[exchangeId]();
          console.log(`   Trying ${exchangeId}...`);
          
          const allTickers = await exchange.fetchTickers();
          tickers = Object.values(allTickers);
          exchangeName = exchangeId;
          console.log(`   [SUCCESS] Successfully fetched ${tickers.length} tickers from ${exchangeId}`);
          break;
        } catch (error) {
          console.log(`   [ERROR] ${exchangeId} failed: ${error}`);
          continue;
        }
      }

      if (tickers.length === 0) {
        throw new Error('All exchanges failed');
      }

      let markets = tickers
        .filter((ticker: any) => ticker.symbol.endsWith('/USDT') || ticker.symbol.endsWith('/USD'))
        .map((ticker: any) => ({
          symbol: ticker.symbol.replace('/USDT', '').replace('/USD', ''),
          volume24h: ticker.quoteVolume || 0,
          priceChange: ticker.percentage || 0,
          price: ticker.last || 0,
          trades: ticker.count || 0,
          originalSymbol: ticker.symbol
        }));

      // Deduplicate by symbol, keeping the one with highest volume
      const symbolMap = new Map();
      markets.forEach((item: any) => {
        const existing = symbolMap.get(item.symbol);
        if (!existing || item.volume24h > existing.volume24h) {
          symbolMap.set(item.symbol, item);
        }
      });
      markets = Array.from(symbolMap.values());

      markets = markets.filter((market: any) => market.volume24h > (minVolume || 0));

      if (excludeStablecoins) {
        const stablecoinList = ['USDC', 'BUSD', 'DAI', 'TUSD', 'USDD', 'FDUSD'];
        markets = markets.filter((market: any) => !stablecoinList.includes(market.symbol));
      }

      const result = markets
        .sort((a: any, b: any) => b.volume24h - a.volume24h)
        .slice(0, limit || 50);

      return {
        markets: result,
        count: result.length,
        minVolume: minVolume / 1000000 + 'M USD',
        totalVolume: result.reduce((sum: number, market: any) => sum + market.volume24h, 0) / 1000000,
        exchange: exchangeName,
        message: `Found ${result.length} high volume markets with >${minVolume/1000000}M USD volume from ${exchangeName}`
      };
    } catch (error: any) {
      return {
        markets: [],
        error: error.message,
        message: `Failed to fetch high volume markets: ${error.message}`
      };
    }
  }

  private async getMarketComparison(args: any) {
    try {
      const { symbols, timeframe } = args;
      
      console.log(`[DATA] Comparing ${symbols.length} markets using CCXT...`);
      
      // Try multiple exchanges in order of preference
      const exchanges = ['coinbase', 'mexc', 'bitget', 'kraken'];
      let tickers: any[] = [];
      let exchangeName = '';

      for (const exchangeId of exchanges) {
        try {
          const exchange = new (ccxt as any)[exchangeId]();
          console.log(`   Trying ${exchangeId}...`);
          
          const allTickers = await exchange.fetchTickers();
          tickers = Object.values(allTickers);
          exchangeName = exchangeId;
          console.log(`   [SUCCESS] Successfully fetched ${tickers.length} tickers from ${exchangeId}`);
          break;
        } catch (error) {
          console.log(`   [ERROR] ${exchangeId} failed: ${error}`);
          continue;
        }
      }

      if (tickers.length === 0) {
        throw new Error('All exchanges failed');
      }

      const comparison = symbols.map((symbol: string) => {
        const ticker = tickers.find((t: any) => 
          t.symbol === `${symbol}/USDT` || t.symbol === `${symbol}/USD`
        );
        if (!ticker) {
          return {
            symbol,
            error: 'Symbol not found'
          };
        }

        return {
          symbol,
          priceChangePercent: ticker.percentage || 0,
          volume: ticker.quoteVolume || 0,
          price: ticker.last || 0,
          high: ticker.high || 0,
          low: ticker.low || 0,
          trades: ticker.count || 0
        };
      });

      // Sort by performance
      const sortedComparison = comparison
        .filter((item: any) => !item.error)
        .sort((a: any, b: any) => b.priceChangePercent - a.priceChangePercent);

      return {
        comparison: sortedComparison,
        timeframe,
        count: sortedComparison.length,
        bestPerformer: sortedComparison[0],
        worstPerformer: sortedComparison[sortedComparison.length - 1],
        exchange: exchangeName,
        message: `Compared ${sortedComparison.length} markets for ${timeframe} performance from ${exchangeName}`
      };
    } catch (error: any) {
      return {
        comparison: [],
        error: error.message,
        message: `Failed to compare markets: ${error.message}`
      };
    }
  }

  private async getBestWorstCombo(args: any) {
    try {
      const { bestLimit, worstLimit, minVolume, timeframe } = args;
      
      // Get best performers
      const bestResult = await this.getTopGainers({
        limit: bestLimit,
        excludeMajors: false,
        minVolume,
        timeframe
      });

      // Get worst performers
      const worstResult = await this.getWorstPerformers({
        limit: worstLimit,
        minVolume,
        timeframe
      });

      return {
        bestPerformers: bestResult.gainers || [],
        worstPerformers: worstResult.performers || [],
        bestCount: bestResult.gainers?.length || 0,
        worstCount: worstResult.performers?.length || 0,
        timeframe,
        minVolume: minVolume / 1000000 + 'M USD',
        message: `Found ${bestResult.gainers?.length || 0} best and ${worstResult.performers?.length || 0} worst performers`
      };
    } catch (error: any) {
      return {
        bestPerformers: [],
        worstPerformers: [],
        error: error.message,
        message: `Failed to get best/worst combo: ${error.message}`
      };
    }
  }
}
