// Relative Strength Index (RSI) Indicator
import { BaseIndicator } from './BaseIndicator.js';

export class RSIIndicator extends BaseIndicator {
  constructor() {
    super('RSI');
  }

  async calculate(data: any[], periods: number[], symbol: string, interval: string, startDate?: string | null) {
    this.validateData(data);
    this.validatePeriods(periods);

    return periods.map((period, index) => ({
      period,
      values: this.calculateRSI(data, period),
      color: ['#9900cc', '#cc00ff', '#ff00cc'][index] || '#9900cc'
    }));
  }

  validateParams(periods: number[]): void {
    this.validatePeriods(periods, 2, 100);
  }

  // Calculate Relative Strength Index (RSI)
  calculateRSI(data: any[], period: number = 14): (number | null)[] {
    const rsi: (number | null)[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    // Calculate initial average gain and loss
    let avgGain = 0;
    let avgLoss = 0;
    
    for (let i = 0; i < period; i++) {
      if (i < gains.length) {
        avgGain += gains[i];
        avgLoss += losses[i];
      }
    }
    
    avgGain /= period;
    avgLoss /= period;
    
    // Fill initial values with null
    for (let i = 0; i <= period; i++) {
      rsi.push(null);
    }
    
    // Calculate RSI
    for (let i = period; i < gains.length; i++) {
      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
      
      // Update averages for next iteration
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    }
    
    return rsi;
  }
}
