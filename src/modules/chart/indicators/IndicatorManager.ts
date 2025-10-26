// Indicator management system - orchestrates all technical indicators
import { SMAIndicator } from './SMAIndicator.js';
import { EMAIndicator } from './EMAIndicator.js';
import { RSIIndicator } from './RSIIndicator.js';
import { VWAPIndicator } from './VWAPIndicator.js';
import { VolumeVolatilityIndicator } from './VolumeVolatilityIndicator.js';
import { PercentileIndicator } from './PercentileIndicator.js';
import { MarketHeatIndicator } from './MarketHeatIndicator.js';

export class IndicatorManager {
  private indicators: { [key: string]: any };

  constructor() {
    this.indicators = {
      sma: new SMAIndicator(),
      ema: new EMAIndicator(),
      rsi: new RSIIndicator(),
      vwap: new VWAPIndicator(),
      volumeVolatility: new VolumeVolatilityIndicator(),
      percentile: new PercentileIndicator(),
      marketHeat: new MarketHeatIndicator()
    };
  }

  // Calculate all requested indicators
  async calculateIndicators(data: any[], symbol: string, interval: string, indicatorParams: any, startDate?: string | null) {
    const indicators: any = {};
    
    // If no indicator params provided, use defaults for common indicators
    if (Object.keys(indicatorParams).length === 0) {
      indicatorParams = this.getDefaultIndicatorParams();
    }
    
    // Process each indicator type
    for (const [type, params] of Object.entries(indicatorParams)) {
      if (this.indicators[type]) {
        try {
          const result = await this.indicators[type].calculate(data, params, symbol, interval, startDate);
          if (result) {
            indicators[type] = Array.isArray(result) ? result : [result];
          }
        } catch (error) {
          console.error(`Failed to calculate ${type} indicator:`, error);
        }
      }
    }

    return indicators;
  }

  // Get default indicator parameters
  getDefaultIndicatorParams() {
    return {
      sma: [20, 50, 200],
      ema: [12, 26],
      rsi: [14],
      vwap: {},
      volumeVolatility: { period: 20 },
      percentile: { metric: 'volume', period: 1000 },
      marketHeat: { period: 20, lookback: 100 }
    };
  }

  // Get available indicator types
  getAvailableIndicators(): string[] {
    return Object.keys(this.indicators);
  }

  // Validate indicator parameters
  validateIndicatorParams(indicatorParams: any): string[] {
    const errors: string[] = [];
    
    for (const [type, params] of Object.entries(indicatorParams)) {
      if (!this.indicators[type]) {
        errors.push(`Unknown indicator type: ${type}`);
        continue;
      }
      
      try {
        this.indicators[type].validateParams(params);
      } catch (error: any) {
        errors.push(`Invalid parameters for ${type}: ${error.message}`);
      }
    }
    
    return errors;
  }
}
