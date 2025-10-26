import { DeribitModule } from '../../deribit/index.js';

export class OptionsAnalyzer {
  private readonly DISCLAIMER = "[WARNING] EXPERIMENTAL OPTIONS ANALYSIS - NOT FINANCIAL ADVICE (NFA/DYOR) WARNING:\nThis is experimental AI-powered options analysis. Past performance does not guarantee future results. Always do your own research and never invest more than you can afford to lose.";
  private deribitModule: DeribitModule | null = null;

  constructor(deribitModule?: DeribitModule) {
    this.deribitModule = deribitModule || null;
  }

  async analyzeOptionsData(args: any): Promise<any> {
    try {
      const { symbol, exchange = 'deribit', analysisType = 'implied_volatility', expirationRange = '30d' } = args;
      
      if (!this.deribitModule) {
        return {
          error: 'Deribit module not available',
          message: 'Deribit integration not initialized',
          disclaimer: this.DISCLAIMER
        };
      }

      if (exchange !== 'deribit') {
        return {
          error: 'Only Deribit exchange supported for options analysis',
          message: 'Please use exchange: "deribit" for options data',
          disclaimer: this.DISCLAIMER
        };
      }

      // Get currency from symbol
      const currency = this.getDeribitCurrency(symbol);
      if (!currency) {
        return {
          error: 'Unsupported symbol for options analysis',
          message: `Symbol ${symbol} not supported. Use BTC or ETH based symbols.`,
          disclaimer: this.DISCLAIMER
        };
      }

      // Use existing Deribit module tools based on analysis type
      let result: any;
      
      switch (analysisType) {
        case 'put_call_ratio':
          result = await this.deribitModule.getOptionChain({
            currency,
            include_greeks: true
          });
          break;
        case 'implied_volatility':
          result = await this.deribitModule.analyzeVolatilitySurface({
            currency
          });
          break;
        case 'greeks':
          result = await this.deribitModule.calculateComprehensiveGreeks({
            currency
          });
          break;
        case 'skew':
          result = await this.deribitModule.analyzeVolatilitySurface({
            currency
          });
          break;
        case 'term_structure':
          result = await this.deribitModule.analyzeVolatilitySurface({
            currency
          });
          break;
        default:
          result = await this.deribitModule.getOptionChain({
            currency,
            include_greeks: true
          });
          break;
      }

      return {
        optionsAnalysis: result,
        analysisType,
        symbol,
        currency,
        message: `${analysisType} analysis for ${symbol} options using Deribit data`,
        disclaimer: this.DISCLAIMER
      };

    } catch (error) {
      return {
        error: `Options analysis failed: ${error}`,
        message: 'Error analyzing options data',
        disclaimer: this.DISCLAIMER
      };
    }
  }


  private getDeribitCurrency(symbol: string): string | null {
    // Map common symbols to Deribit currencies
    const baseSymbol = symbol.replace('USDT', '').replace('USD', '').toUpperCase();
    
    const currencyMap: { [key: string]: string } = {
      'BTC': 'BTC',
      'ETH': 'ETH',
      'SOL': 'SOL',
      'ADA': 'ADA',
      'DOT': 'DOT',
      'LINK': 'LINK',
      'UNI': 'UNI',
      'AAVE': 'AAVE',
      'MATIC': 'MATIC',
      'AVAX': 'AVAX'
    };
    
    return currencyMap[baseSymbol] || null;
  }

}
