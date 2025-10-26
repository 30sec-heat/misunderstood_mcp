// Volume Volatility Indicator - measures market "heat" based on volume patterns
import { BaseIndicator } from './BaseIndicator.js';

export class VolumeVolatilityIndicator extends BaseIndicator {
  constructor() {
    super('VolumeVolatility');
  }

  async calculate(data: any[], params: any, symbol: string, interval: string, startDate?: string | null) {
    this.validateData(data);

    return {
      values: this.calculateVolumeVolatility(data, params.period || 20),
      percentile: this.calculateVolumePercentile(data, params.period || 20),
      heatScore: this.calculateHeatScore(data, params.period || 20),
      color: '#ff4444'
    };
  }

  validateParams(params: any): void {
    if (params.period && (!Number.isInteger(params.period) || params.period < 5 || params.period > 100)) {
      throw new Error('Period must be an integer between 5 and 100');
    }
  }

  // Calculate volume volatility (standard deviation of volume)
  calculateVolumeVolatility(data: any[], period: number): (number | null)[] {
    const volatility: (number | null)[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        volatility.push(null);
        continue;
      }

      // Get volume values for the period
      const volumes = data.slice(i - period + 1, i + 1).map(candle => candle.volume);
      
      // Calculate mean volume
      const meanVolume = volumes.reduce((sum, vol) => sum + vol, 0) / period;
      
      // Calculate variance
      const variance = volumes.reduce((sum, vol) => sum + Math.pow(vol - meanVolume, 2), 0) / period;
      
      // Standard deviation (volatility)
      const stdDev = Math.sqrt(variance);
      
      // Normalize by mean volume to get relative volatility
      const relativeVolatility = meanVolume > 0 ? stdDev / meanVolume : 0;
      
      volatility.push(relativeVolatility);
    }

    return volatility;
  }

  // Calculate volume percentile ranking
  calculateVolumePercentile(data: any[], period: number): (number | null)[] {
    const percentiles: (number | null)[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        percentiles.push(null);
        continue;
      }

      // Get volumes for the period
      const volumes = data.slice(i - period + 1, i + 1).map(candle => candle.volume);
      const currentVolume = data[i].volume;
      
      // Count how many volumes are below current volume
      const belowCount = volumes.filter(vol => vol < currentVolume).length;
      
      // Calculate percentile (0-100)
      const percentile = (belowCount / period) * 100;
      
      percentiles.push(percentile);
    }

    return percentiles;
  }

  // Calculate market heat score (combination of volume volatility and percentile)
  calculateHeatScore(data: any[], period: number): (number | null)[] {
    const volumeVolatility = this.calculateVolumeVolatility(data, period);
    const volumePercentile = this.calculateVolumePercentile(data, period);
    const heatScores: (number | null)[] = [];

    for (let i = 0; i < data.length; i++) {
      if (volumeVolatility[i] === null || volumePercentile[i] === null) {
        heatScores.push(null);
        continue;
      }

      // Heat score combines volatility and percentile
      // Higher volatility + higher percentile = hotter market
      const volatilityWeight = 0.6;
      const percentileWeight = 0.4;
      
      // Normalize volatility (multiply by 100 for scale)
      const normalizedVolatility = Math.min(volumeVolatility[i]! * 100, 100);
      
      // Heat score (0-100)
      const heatScore = (normalizedVolatility * volatilityWeight) + (volumePercentile[i]! * percentileWeight);
      
      heatScores.push(Math.min(heatScore, 100));
    }

    return heatScores;
  }
}
