// Simple Moving Average (SMA) Indicator
import { BaseIndicator } from './BaseIndicator.js';

export class SMAIndicator extends BaseIndicator {
  constructor() {
    super('SMA');
  }

  async calculate(data: any[], periods: number[], symbol: string, interval: string, startDate?: string | null) {
    this.validateData(data);
    this.validatePeriods(periods);

    return periods.map((period, index) => ({
      period,
      values: this.calculateSMA(data, period),
      color: ['#ff6600', '#ff9900', '#ffcc00'][index] || '#ff6600'
    }));
  }

  validateParams(periods: number[]): void {
    this.validatePeriods(periods, 1, 200);
  }

  // Calculate Simple Moving Average
  calculateSMA(data: any[], period: number): (number | null)[] {
    const sma: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        sma.push(null);
      } else {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j].close;
        }
        sma.push(sum / period);
      }
    }
    return sma;
  }
}
