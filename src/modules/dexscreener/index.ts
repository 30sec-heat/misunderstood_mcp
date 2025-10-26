import { BaseCryptoModule } from '../base/module.js';
import { DexScreenerDataFetcher } from './data/DexScreenerDataFetcher.js';
import { TokenProfileAnalysisTool } from './tools/TokenProfileAnalysisTool.js';
import { OrderAnalysisTool } from './tools/OrderAnalysisTool.js';
import { PairAnalysisTool } from './tools/PairAnalysisTool.js';

export class DexScreenerModule extends BaseCryptoModule {
  name = 'dexscreener';
  private dataFetcher: DexScreenerDataFetcher;
  private tokenProfileAnalysisTool: TokenProfileAnalysisTool;
  private orderAnalysisTool: OrderAnalysisTool;
  private pairAnalysisTool: PairAnalysisTool;

  constructor() {
    super();
    
    // Initialize properties after calling super()
    this.dataFetcher = new DexScreenerDataFetcher();
    this.tokenProfileAnalysisTool = new TokenProfileAnalysisTool(this.dataFetcher);
    this.orderAnalysisTool = new OrderAnalysisTool(this.dataFetcher);
    this.pairAnalysisTool = new PairAnalysisTool(this.dataFetcher);
    
    // Set up tools after properties are initialized
    this.setupTools();
  }

  protected setupTools() {
    // Consolidated Token Analysis Tool
    this.addTool({
      name: 'dexscreener_analyze_token',
      description: 'Comprehensive analysis of a single token including profile, pairs, orders, and risk assessment',
      inputSchema: {
        type: 'object',
        properties: {
          chainId: {
            type: 'string',
            description: 'Chain ID (e.g., "ethereum", "bsc", "polygon")'
          },
          address: {
            type: 'string',
            description: 'Token contract address'
          }
        },
        required: ['chainId', 'address']
      },
      handler: async (args: any) => this.tokenProfileAnalysisTool.analyzeToken(args.chainId, args.address)
    });

    // Consolidated Token Search Tool
    this.addTool({
      name: 'dexscreener_get_tokens',
      description: 'Get tokens with comprehensive filtering by chain, market cap, price range, liquidity, volume, and sorting options',
      inputSchema: {
        type: 'object',
        properties: {
          chainId: {
            type: 'string',
            description: 'Chain ID (e.g., "ethereum", "bsc", "polygon")'
          },
          minMarketCap: {
            type: 'number',
            description: 'Minimum market cap in USD'
          },
          maxMarketCap: {
            type: 'number',
            description: 'Maximum market cap in USD'
          },
          minPrice: {
            type: 'number',
            description: 'Minimum price in USD'
          },
          maxPrice: {
            type: 'number',
            description: 'Maximum price in USD'
          },
          minLiquidity: {
            type: 'number',
            description: 'Minimum liquidity in USD'
          },
          maxLiquidity: {
            type: 'number',
            description: 'Maximum liquidity in USD'
          },
          minVolume24h: {
            type: 'number',
            description: 'Minimum 24h volume in USD'
          },
          maxVolume24h: {
            type: 'number',
            description: 'Maximum 24h volume in USD'
          },
          sortBy: {
            type: 'string',
            enum: ['marketCap', 'volume24h', 'liquidity', 'priceChange24h'],
            description: 'Sort tokens by specified metric'
          },
          sortOrder: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: 'Sort order (ascending or descending)',
            default: 'desc'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of tokens to return',
            default: 50
          }
        }
      },
      handler: async (args: any) => this.tokenProfileAnalysisTool.getTokens(args)
    });

    // Consolidated Orders Analysis Tool
    this.addTool({
      name: 'dexscreener_get_orders',
      description: 'Get orders with comprehensive filtering by volume, liquidity, price change, DEX, timeframe, and sorting options',
      inputSchema: {
        type: 'object',
        properties: {
          chainId: {
            type: 'string',
            description: 'Chain ID (e.g., "ethereum", "bsc", "polygon")'
          },
          tokenAddress: {
            type: 'string',
            description: 'Token contract address'
          },
          minVolume: {
            type: 'number',
            description: 'Minimum 24h volume in USD'
          },
          maxVolume: {
            type: 'number',
            description: 'Maximum 24h volume in USD'
          },
          minLiquidity: {
            type: 'number',
            description: 'Minimum liquidity in USD'
          },
          maxLiquidity: {
            type: 'number',
            description: 'Maximum liquidity in USD'
          },
          minPriceChange: {
            type: 'number',
            description: 'Minimum 24h price change percentage'
          },
          maxPriceChange: {
            type: 'number',
            description: 'Maximum 24h price change percentage'
          },
          dexId: {
            type: 'string',
            description: 'DEX ID (e.g., "uniswap", "sushiswap", "pancakeswap")'
          },
          timeframe: {
            type: 'string',
            enum: ['m5', 'h1', 'h6', 'h24'],
            description: 'Timeframe for volume filtering'
          },
          sortBy: {
            type: 'string',
            enum: ['volume', 'liquidity', 'priceChange'],
            description: 'Sort orders by specified metric'
          },
          sortOrder: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: 'Sort order (ascending or descending)',
            default: 'desc'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of orders to return',
            default: 50
          }
        },
        required: ['chainId', 'tokenAddress']
      },
      handler: async (args: any) => this.orderAnalysisTool.getOrdersWithFilters(args)
    });

    // Consolidated Pairs Analysis Tool
    this.addTool({
      name: 'dexscreener_get_pairs',
      description: 'Get pairs with comprehensive filtering by volume, liquidity, price change, DEX, timeframe, age, and sorting options',
      inputSchema: {
        type: 'object',
        properties: {
          chainId: {
            type: 'string',
            description: 'Chain ID (e.g., "ethereum", "bsc", "polygon")'
          },
          tokenAddress: {
            type: 'string',
            description: 'Token contract address'
          },
          minVolume: {
            type: 'number',
            description: 'Minimum 24h volume in USD'
          },
          maxVolume: {
            type: 'number',
            description: 'Maximum 24h volume in USD'
          },
          minLiquidity: {
            type: 'number',
            description: 'Minimum liquidity in USD'
          },
          maxLiquidity: {
            type: 'number',
            description: 'Maximum liquidity in USD'
          },
          minPriceChange: {
            type: 'number',
            description: 'Minimum 24h price change percentage'
          },
          maxPriceChange: {
            type: 'number',
            description: 'Maximum 24h price change percentage'
          },
          dexId: {
            type: 'string',
            description: 'DEX ID (e.g., "uniswap", "sushiswap", "pancakeswap")'
          },
          timeframe: {
            type: 'string',
            enum: ['m5', 'h1', 'h6', 'h24'],
            description: 'Timeframe for volume filtering'
          },
          hoursAgo: {
            type: 'number',
            description: 'Filter pairs created within this many hours ago'
          },
          sortBy: {
            type: 'string',
            enum: ['volume', 'liquidity', 'priceChange', 'age'],
            description: 'Sort pairs by specified metric'
          },
          sortOrder: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: 'Sort order (ascending or descending)',
            default: 'desc'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of pairs to return',
            default: 50
          }
        }
      },
      handler: async (args: any) => this.pairAnalysisTool.getPairsWithFilters(args)
    });

    // Keep search pairs as separate tool as requested
    this.addTool({
      name: 'dexscreener_search_pairs',
      description: 'Search for pairs by query (token name, symbol, or address)',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (token name, symbol, or address)'
          }
        },
        required: ['query']
      },
      handler: async (args: any) => this.pairAnalysisTool.searchPairs(args.query)
    });

    // Chain Information Tools
    this.addTool({
      name: 'dexscreener_get_available_chains',
      description: 'Get list of all available chains with statistics',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async () => this.dataFetcher.getAvailableChains()
    });
  }
}
