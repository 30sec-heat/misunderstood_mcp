import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import { ComprehensiveAnalysisTool } from './tools/ComprehensiveAnalysisTool.js';
import { CoinalyzeAPI } from '../liquidations/coinalyze-api.js';

export class AnalysisModule extends BaseCryptoModule {
  name = 'analysis';
  private comprehensiveAnalysisTool: ComprehensiveAnalysisTool;

  constructor(coinalyzeAPI?: CoinalyzeAPI) {
    super();
    
    // Initialize the comprehensive analysis tool with optional Coinalyze API
    this.comprehensiveAnalysisTool = new ComprehensiveAnalysisTool(coinalyzeAPI);
    
    // Set up tools after initialization
    this.setupTools();
  }

  protected setupTools() {
    // Comprehensive Analysis Tool - Single tool that performs all analyses
    this.addTool({
      name: 'analysis_comprehensive',
      description: 'Perform comprehensive technical, statistical, and risk analysis with single data fetch',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTCUSDT)'
          },
          timeframe: {
            type: 'string',
            description: 'Timeframe for analysis',
            enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
            default: '1h'
          },
          exchange: {
            type: 'string',
            description: 'Exchange to use for data',
            enum: ['binance', 'bybit'],
            default: 'binance'
          },
          limit: {
            type: 'number',
            description: 'Number of candles to fetch for analysis',
            default: 1000,
            minimum: 1000,
            maximum: 1000
          },
          includeMicrostructure: {
            type: 'boolean',
            description: 'Include market microstructure data (spread, depth, funding)',
            default: true
          }
        },
        required: ['symbol']
      },
      handler: this.comprehensiveAnalysisTool.performComprehensiveAnalysis.bind(this.comprehensiveAnalysisTool)
    });
  }
}