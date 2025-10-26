// Percentile Indicator - calculates percentile rankings for various metrics
import { BaseIndicator } from './BaseIndicator.js';

export class PercentileIndicator extends BaseIndicator {
  constructor() {
    super('Percentile');
  }

  async calculate(data: any[], params: any, symbol: string, interval: string, startDate?: string | null) {
    this.validateData(data);

    const metric = params.metric || 'volume';
    const period = params.period || 100;

    return {
      values: this.calculatePercentile(data, metric, period),
      metric,
      period,
      color: '#4444ff'
    };
  }

  validateParams(params: any): void {
    const validMetrics = ['volume', 'price', 'high', 'low', 'close', 'range'];
    if (params.metric && !validMetrics.includes(params.metric)) {
      throw new Error(`Metric must be one of: ${validMetrics.join(', ')}`);
    }
    if (params.period && (!Number.isInteger(params.period) || params.period < 10 || params.period > 1000)) {
      throw new Error('Period must be an integer between 10 and 1000');
    }
  }

  // Calculate percentile ranking for a specific metric
  calculatePercentile(data: any[], metric: string, period: number): (number | null)[] {
    const percentiles: (number | null)[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        percentiles.push(null);
        continue;
      }

      // Get values for the period
      const values = data.slice(i - period + 1, i + 1).map(candle => {
        switch (metric) {
          case 'volume':
            return candle.volume;
          case 'price':
          case 'close':
            return candle.close;
          case 'high':
            return candle.high;
          case 'low':
            return candle.low;
          case 'range':
            return candle.high - candle.low;
          default:
            return candle.close;
        }
      });

      const currentValue = values[values.length - 1];
      
      // Count how many values are below current value
      const belowCount = values.filter(val => val < currentValue).length;
      
      // Calculate percentile (0-100)
      const percentile = (belowCount / period) * 100;
      
      percentiles.push(percentile);
    }

    return percentiles;
  }
}
