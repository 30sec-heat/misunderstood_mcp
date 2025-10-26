import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import { ExchangeManager } from './tools/ExchangeManager.js';
import { ComprehensiveForecastTool } from './tools/ComprehensiveForecastTool.js';
import { DeribitModule } from '../deribit/index.js';
import { AnalysisModule } from '../analysis/index.js';
import { NewsModule } from '../news/index.js';

export class ForecastingModule extends BaseCryptoModule {
  name = 'forecasting';
  private exchangeManager: ExchangeManager;
  private comprehensiveForecastTool: ComprehensiveForecastTool;
  private deribitModule: DeribitModule | null = null;
  private analysisModule: AnalysisModule | null = null;
  private newsModule: NewsModule | null = null;

  constructor() {
    super();
    
    // Initialize properties after calling super()
    this.exchangeManager = new ExchangeManager();
    this.comprehensiveForecastTool = new ComprehensiveForecastTool(this.exchangeManager);
    
    // Set up tools after properties are initialized
    this.setupTools();
  }

  setDeribitModule(deribitModule: DeribitModule): void {
    this.deribitModule = deribitModule;
    // Update comprehensive forecast tool
    this.updateComprehensiveForecastTool();
  }

  setAnalysisModule(analysisModule: AnalysisModule): void {
    this.analysisModule = analysisModule;
    this.updateComprehensiveForecastTool();
  }

  setNewsModule(newsModule: NewsModule): void {
    this.newsModule = newsModule;
    this.updateComprehensiveForecastTool();
  }

  private updateComprehensiveForecastTool(): void {
    this.comprehensiveForecastTool = new ComprehensiveForecastTool(
      this.exchangeManager,
      this.deribitModule || undefined,
      this.analysisModule || undefined,
      this.newsModule || undefined
    );
  }

  protected setupTools() {

    // Comprehensive Forecast Tool - Single tool that aggregates all analysis
    this.addTool({
      name: 'forecast_comprehensive',
      description: 'Perform comprehensive forecast analysis combining technical analysis, options data, news sentiment, and multi-timeframe analysis in one call (EXPERIMENTAL - NFA/DYOR)',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTCUSDT)'
          },
          timeframe: {
            type: 'string',
            description: 'Primary timeframe for analysis',
            enum: ['5m', '15m', '1h', '4h', '1d'],
            default: '1h'
          },
          predictionPeriod: {
            type: 'string',
            description: 'How far ahead to predict',
            enum: ['1h', '4h', '8h', '24h', '3d', '7d'],
            default: '24h'
          },
          exchange: {
            type: 'string',
            description: 'Exchange to use for data',
            enum: ['coinbase', 'mexc', 'bitget', 'kucoin', 'gate', 'bybit', 'okx', 'kraken', 'binance'],
            default: 'binance'
          },
          includeOptions: {
            type: 'boolean',
            description: 'Include options analysis (requires BTC or ETH)',
            default: true
          },
          includeNews: {
            type: 'boolean',
            description: 'Include news sentiment analysis',
            default: true
          },
          confidenceLevel: {
            type: 'number',
            description: 'Confidence level for predictions (0.1-0.9)',
            default: 0.7,
            minimum: 0.1,
            maximum: 0.9
          }
        },
        required: ['symbol']
      },
      handler: this.comprehensiveForecastTool.performComprehensiveForecast.bind(this.comprehensiveForecastTool)
    });
  }

  async initialize(): Promise<void> {
    this.setupTools();
    
    // Initialize Deribit module for options data
    try {
      this.deribitModule = new DeribitModule();
      await this.deribitModule.initialize();
    } catch (error) {
      console.warn('Deribit module initialization failed, options analysis will be limited:', error);
    }
  }

  async destroy(): Promise<void> {
    if (this.exchangeManager) {
      this.exchangeManager.destroy();
    }
    if (this.deribitModule) {
      await this.deribitModule.destroy();
    }
  }
}
