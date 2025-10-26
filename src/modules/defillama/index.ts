import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import { DeFiLlamaDataFetcher } from './data/DeFiLlamaDataFetcher.js';
import { TVLAnalysisTool } from './tools/TVLAnalysisTool.js';
import { YieldAnalysisTool } from './tools/YieldAnalysisTool.js';
import { DexAnalysisTool } from './tools/DexAnalysisTool.js';

export class DeFiLlamaModule extends BaseCryptoModule {
  name = 'defillama';
  private dataFetcher: DeFiLlamaDataFetcher;
  private tvlAnalysisTool: TVLAnalysisTool;
  private yieldAnalysisTool: YieldAnalysisTool;
  private dexAnalysisTool: DexAnalysisTool;

  constructor() {
    super();
    
    // Initialize properties after calling super()
    this.dataFetcher = new DeFiLlamaDataFetcher();
    this.tvlAnalysisTool = new TVLAnalysisTool(this.dataFetcher);
    this.yieldAnalysisTool = new YieldAnalysisTool(this.dataFetcher);
    this.dexAnalysisTool = new DexAnalysisTool(this.dataFetcher);
    
    // Set up tools after properties are initialized
    this.setupTools();
  }

  protected setupTools() {
    // Discovery Tools - Help LLM discover available data
    this.addTool({
      name: 'defillama_discover_protocols',
      description: 'Discover all available protocols on DeFiLlama with their basic info',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of protocols to return (MCP optimized)',
            default: 50,
            minimum: 1,
            maximum: 200
          },
          category: {
            type: 'string',
            description: 'Filter by protocol category (optional)',
            examples: ['Lending', 'DEX', 'Yield', 'Derivatives', 'Bridge', 'Liquid Staking']
          }
        }
      },
      handler: this.tvlAnalysisTool.getProtocols.bind(this.tvlAnalysisTool)
    });

    this.addTool({
      name: 'defillama_get_chains',
      description: 'Get all available chains on DeFiLlama with their TVL data',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of chains to return (MCP optimized)',
            default: 30,
            minimum: 1,
            maximum: 100
          }
        }
      },
      handler: this.tvlAnalysisTool.getChainsTVL.bind(this.tvlAnalysisTool)
    });


    this.addTool({
      name: 'defillama_discover_yield_pools',
      description: 'Discover available yield farming pools across all chains',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of pools to return (MCP optimized)',
            default: 50,
            minimum: 1,
            maximum: 200
          },
          chain: {
            type: 'string',
            description: 'Filter by specific chain (optional)',
            examples: ['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'Avalanche']
          },
          minAPY: {
            type: 'number',
            description: 'Minimum APY threshold',
            default: 0.01
          }
        }
      },
      handler: this.yieldAnalysisTool.getYieldPools.bind(this.yieldAnalysisTool)
    });

    // TVL Analysis Tools
    this.addTool({
      name: 'defillama_get_protocol_tvl',
      description: 'Get historical TVL data for a specific protocol',
      inputSchema: {
        type: 'object',
        properties: {
          protocol: {
            type: 'string',
            description: 'Protocol slug (e.g., "aave", "uniswap")'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of data points to return (MCP optimized)',
            default: 30,
            minimum: 1,
            maximum: 100
          }
        },
        required: ['protocol']
      },
      handler: this.tvlAnalysisTool.getProtocolTVL.bind(this.tvlAnalysisTool)
    });

    this.addTool({
      name: 'defillama_get_chain_tvl_history',
      description: 'Get historical TVL data for a specific chain',
      inputSchema: {
        type: 'object',
        properties: {
          chain: {
            type: 'string',
            description: 'Chain name (e.g., "Ethereum", "Polygon")'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of data points to return (MCP optimized)',
            default: 30,
            minimum: 1,
            maximum: 100
          }
        },
        required: ['chain']
      },
      handler: this.tvlAnalysisTool.getChainTVLHistory.bind(this.tvlAnalysisTool)
    });

    // Yield Analysis Tools
    this.addTool({
      name: 'defillama_get_yield_pools',
      description: 'Get yield farming pools data',
      inputSchema: {
        type: 'object',
        properties: {
          chain: {
            type: 'string',
            description: 'Chain name (e.g., "Ethereum", "Polygon")',
            default: 'Ethereum'
          },
          minAPY: {
            type: 'number',
            description: 'Minimum APY threshold',
            default: 0.01
          },
          limit: {
            type: 'number',
            description: 'Maximum number of pools to return (MCP optimized)',
            default: 20,
            minimum: 1,
            maximum: 100
          }
        }
      },
      handler: this.yieldAnalysisTool.getYieldPools.bind(this.yieldAnalysisTool)
    });


    // DEX Analysis Tools
    this.addTool({
      name: 'defillama_get_dex_summary',
      description: 'Get comprehensive summary of DEX volume and fees with historical data',
      inputSchema: {
        type: 'object',
        properties: {
          protocol: {
            type: 'string',
            description: 'Protocol name (e.g., "uniswap", "sushiswap")'
          }
        },
        required: ['protocol']
      },
      handler: this.dexAnalysisTool.getDexSummary.bind(this.dexAnalysisTool)
    });
  }
}
