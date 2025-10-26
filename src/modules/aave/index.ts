import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import { AaveV3DataFetcher } from './data/AaveV3DataFetcher.js';
import { ConsolidatedRatesAnalysisTool } from './tools/ConsolidatedRatesAnalysisTool.js';
import { ConsolidatedCollateralRiskTool } from './tools/ConsolidatedCollateralRiskTool.js';
import { ConsolidatedYieldMarketTool } from './tools/ConsolidatedYieldMarketTool.js';

export class AaveModule extends BaseCryptoModule {
  name = 'aave';
  private dataFetcher: AaveV3DataFetcher;
  private consolidatedRatesAnalysisTool: ConsolidatedRatesAnalysisTool;
  private consolidatedCollateralRiskTool: ConsolidatedCollateralRiskTool;
  private consolidatedYieldMarketTool: ConsolidatedYieldMarketTool;

  constructor() {
    super();
    
    // Initialize properties after calling super()
    this.dataFetcher = new AaveV3DataFetcher();
    this.consolidatedRatesAnalysisTool = new ConsolidatedRatesAnalysisTool(this.dataFetcher);
    this.consolidatedCollateralRiskTool = new ConsolidatedCollateralRiskTool(this.dataFetcher);
    this.consolidatedYieldMarketTool = new ConsolidatedYieldMarketTool(this.dataFetcher);
    
    // Set up tools after properties are initialized
    this.setupTools();
  }

  protected setupTools() {
    // Consolidated Rates Analysis Tool - combines lending rates, borrowing rates, and rate history
    this.addTool({
      name: 'aave_get_all_rates_and_history',
      description: 'Get comprehensive lending rates, borrowing rates, and rate history for Aave tokens',
      inputSchema: {
        type: 'object',
        properties: {
          chain: {
            type: 'string',
            description: 'Blockchain network',
            enum: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche'],
            default: 'ethereum'
          },
          asset: {
            type: 'string',
            description: 'Token symbol (optional - if not provided, returns data for multiple tokens)',
            examples: ['USDC', 'USDT', 'DAI', 'WETH', 'WBTC', 'LINK', 'AAVE', 'UNI', 'CRV', 'LDO', 'MKR', 'SNX', 'BAL', '1INCH', 'FRAX', 'LUSD', 'GHO', 'PYUSD', 'EURC', 'RLUSD']
          },
          includeHistory: {
            type: 'boolean',
            description: 'Include historical rate data (only works when asset is specified)',
            default: true
          },
          historyPeriod: {
            type: 'string',
            description: 'Period for historical data',
            enum: ['7d', '30d', '90d'],
            default: '30d'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of tokens to return (when asset not specified)',
            default: 20,
            minimum: 1,
            maximum: 50
          }
        },
        required: ['chain']
      },
      handler: this.consolidatedRatesAnalysisTool.getAllRatesAndHistory.bind(this.consolidatedRatesAnalysisTool)
    });

    // Consolidated Collateral Health & Liquidation Risk Tool
    this.addTool({
      name: 'aave_get_collateral_and_risk',
      description: 'Get comprehensive collateral health and liquidation risk analysis for Aave positions',
      inputSchema: {
        type: 'object',
        properties: {
          userAddress: {
            type: 'string',
            description: 'User wallet address (optional - if not provided, returns collateral factors)'
          },
          chain: {
            type: 'string',
            description: 'Blockchain network',
            enum: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche'],
            default: 'ethereum'
          },
          asset: {
            type: 'string',
            description: 'Token symbol to filter results (optional)',
            examples: ['USDC', 'USDT', 'DAI', 'WETH', 'WBTC', 'LINK', 'AAVE', 'UNI', 'CRV', 'LDO', 'MKR', 'SNX', 'BAL', '1INCH', 'FRAX', 'LUSD', 'GHO', 'PYUSD', 'EURC', 'RLUSD']
          },
          includeFactors: {
            type: 'boolean',
            description: 'Include collateral factors (LTV, liquidation thresholds)',
            default: false
          },
          scenarios: {
            type: 'array',
            items: {
              type: 'number',
              minimum: 0.05,
              maximum: 0.5
            },
            description: 'Price drop scenarios to analyze for liquidation risk',
            default: [0.1, 0.2, 0.3]
          },
          includeRecommendations: {
            type: 'boolean',
            description: 'Include risk management recommendations',
            default: true
          }
        },
        required: ['chain']
      },
      handler: this.consolidatedCollateralRiskTool.getCollateralHealthAndLiquidationRisk.bind(this.consolidatedCollateralRiskTool)
    });

    // Consolidated Yield Opportunities, Market Overview & Protocol Risk Tool
    this.addTool({
      name: 'aave_get_yield_market_and_risk',
      description: 'Get comprehensive yield opportunities, market overview, and protocol risk analysis for Aave',
      inputSchema: {
        type: 'object',
        properties: {
          chain: {
            type: 'string',
            description: 'Blockchain network',
            enum: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche'],
            default: 'ethereum'
          },
          asset: {
            type: 'string',
            description: 'Token symbol to filter results (optional)',
            examples: ['USDC', 'USDT', 'DAI', 'WETH', 'WBTC', 'LINK', 'AAVE', 'UNI', 'CRV', 'LDO', 'MKR', 'SNX', 'BAL', '1INCH', 'FRAX', 'LUSD', 'GHO', 'PYUSD', 'EURC', 'RLUSD']
          },
          minAPY: {
            type: 'number',
            description: 'Minimum APY percentage to filter yield opportunities',
            default: 0.01,
            minimum: 0,
            maximum: 1
          },
          riskLevel: {
            type: 'string',
            description: 'Filter yield opportunities by risk level',
            enum: ['low', 'medium', 'high', 'all'],
            default: 'all'
          },
          includeMarketOverview: {
            type: 'boolean',
            description: 'Include market overview with TVL, top tokens, and rate trends',
            default: true
          },
          includeProtocolRisk: {
            type: 'boolean',
            description: 'Include protocol risk assessment',
            default: true
          },
          includeRiskMetrics: {
            type: 'boolean',
            description: 'Include detailed risk metrics (health factors, liquidation thresholds)',
            default: false
          },
          limit: {
            type: 'number',
            description: 'Maximum number of yield opportunities to return',
            default: 20,
            minimum: 1,
            maximum: 50
          }
        },
        required: ['chain']
      },
      handler: this.consolidatedYieldMarketTool.getYieldOpportunitiesMarketOverviewAndRisk.bind(this.consolidatedYieldMarketTool)
    });

  }
}
