// Exponential Moving Average (EMA) Indicator
import { BaseIndicator } from './BaseIndicator.js';

export class EMAIndicator extends BaseIndicator {
  constructor() {
    super('EMA');
  }

  async calculate(data: any[], periods: number[], symbol: string, interval: string, startDate?: string | null) {
    this.validateData(data);
    this.validatePeriods(periods);

    return periods.map((period, index) => ({
      period,
      values: this.calculateEMA(data, period),
      color: ['#0066ff', '#0099ff', '#00ccff'][index] || '#0066ff'
    }));
  }

  validateParams(periods: number[]): void {
    this.validatePeriods(periods, 1, 200);
  }

  // Calculate Exponential Moving Average
  calculateEMA(data: any[], period: number): (number | null)[] {
    const ema: (number | null)[] = [];
    const multiplier = 2 / (period + 1);
    
    // First EMA is SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      if (i < data.length) {
        sum += data[i].close;
        ema.push(i === period - 1 ? sum / period : null);
      }
    }
    
    // Calculate EMA for remaining data points
    for (let i = period; i < data.length; i++) {
      const prevEMA = ema[i - 1];
      if (prevEMA !== null) {
        ema.push((data[i].close - prevEMA) * multiplier + prevEMA);
      } else {
        ema.push(null);
      }
    }
    
    return ema;
  }
}
