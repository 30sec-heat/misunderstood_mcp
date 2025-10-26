// Volume Weighted Average Price (VWAP) Indicator
import { BaseIndicator } from './BaseIndicator.js';

export class VWAPIndicator extends BaseIndicator {
  constructor() {
    super('VWAP');
  }

  async calculate(data: any[], params: any, symbol: string, interval: string, startDate?: string | null) {
    this.validateData(data);

    return {
      values: this.calculateVWAP(data),
      color: '#00ff00'
    };
  }

  validateParams(params: any): void {
    // VWAP doesn't require specific parameters
  }

  // Calculate Volume Weighted Average Price
  calculateVWAP(data: any[]): (number | null)[] {
    const vwap: (number | null)[] = [];
    let cumulativeVolumePrice = 0;
    let cumulativeVolume = 0;

    for (let i = 0; i < data.length; i++) {
      const candle = data[i];
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const volumePrice = typicalPrice * candle.volume;

      cumulativeVolumePrice += volumePrice;
      cumulativeVolume += candle.volume;

      if (cumulativeVolume > 0) {
        vwap.push(cumulativeVolumePrice / cumulativeVolume);
      } else {
        vwap.push(null);
      }
    }

    return vwap;
  }
}
