// Market Heat Indicator - comprehensive market "heat" analysis
import { BaseIndicator } from './BaseIndicator.js';

export class MarketHeatIndicator extends BaseIndicator {
  constructor() {
    super('MarketHeat');
  }

  async calculate(data: any[], params: any, symbol: string, interval: string, startDate?: string | null) {
    this.validateData(data);

    const period = params.period || 20;
    const lookback = params.lookback || 100;

    return {
      heatScore: this.calculateHeatScore(data, period),
      volumeHeat: this.calculateVolumeHeat(data, period),
      priceHeat: this.calculatePriceHeat(data, period),
      volatilityHeat: this.calculateVolatilityHeat(data, period),
      trendHeat: this.calculateTrendHeat(data, period),
      overallHeat: this.calculateOverallHeat(data, period, lookback),
      color: '#ff6600'
    };
  }

  validateParams(params: any): void {
    if (params.period && (!Number.isInteger(params.period) || params.period < 5 || params.period > 100)) {
      throw new Error('Period must be an integer between 5 and 100');
    }
    if (params.lookback && (!Number.isInteger(params.lookback) || params.lookback < 20 || params.lookback > 500)) {
      throw new Error('Lookback must be an integer between 20 and 500');
    }
  }

  // Calculate overall heat score
  calculateHeatScore(data: any[], period: number): (number | null)[] {
    const heatScores: (number | null)[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        heatScores.push(null);
        continue;
      }

      const volumeHeat = this.calculateVolumeHeat(data, period)[i];
      const priceHeat = this.calculatePriceHeat(data, period)[i];
      const volatilityHeat = this.calculateVolatilityHeat(data, period)[i];
      const trendHeat = this.calculateTrendHeat(data, period)[i];

      if (volumeHeat === null || priceHeat === null || volatilityHeat === null || trendHeat === null) {
        heatScores.push(null);
        continue;
      }

      // Weighted combination of heat factors
      const weights = {
        volume: 0.3,
        price: 0.25,
        volatility: 0.25,
        trend: 0.2
      };

      const overallHeat = (
        volumeHeat * weights.volume +
        priceHeat * weights.price +
        volatilityHeat * weights.volatility +
        trendHeat * weights.trend
      );

      heatScores.push(Math.min(overallHeat, 100));
    }

    return heatScores;
  }

  // Calculate volume-based heat
  calculateVolumeHeat(data: any[], period: number): (number | null)[] {
    const volumeHeat: (number | null)[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        volumeHeat.push(null);
        continue;
      }

      const volumes = data.slice(i - period + 1, i + 1).map(candle => candle.volume);
      const currentVolume = data[i].volume;
      
      // Volume percentile
      const belowCount = volumes.filter(vol => vol < currentVolume).length;
      const volumePercentile = (belowCount / period) * 100;
      
      // Volume growth rate
      const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / period;
      const volumeGrowth = avgVolume > 0 ? (currentVolume - avgVolume) / avgVolume : 0;
      
      // Volume volatility
      const variance = volumes.reduce((sum, vol) => sum + Math.pow(vol - avgVolume, 2), 0) / period;
      const volumeVolatility = avgVolume > 0 ? Math.sqrt(variance) / avgVolume : 0;
      
      // Combine factors
      const heat = (volumePercentile * 0.4) + (Math.max(volumeGrowth, 0) * 30 * 0.3) + (volumeVolatility * 100 * 0.3);
      
      volumeHeat.push(Math.min(heat, 100));
    }

    return volumeHeat;
  }

  // Calculate price-based heat
  calculatePriceHeat(data: any[], period: number): (number | null)[] {
    const priceHeat: (number | null)[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        priceHeat.push(null);
        continue;
      }

      const prices = data.slice(i - period + 1, i + 1).map(candle => candle.close);
      const currentPrice = data[i].close;
      
      // Price momentum
      const priceChange = currentPrice - prices[0];
      const priceMomentum = prices[0] > 0 ? priceChange / prices[0] : 0;
      
      // Price volatility
      const avgPrice = prices.reduce((sum, price) => sum + price, 0) / period;
      const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / period;
      const priceVolatility = avgPrice > 0 ? Math.sqrt(variance) / avgPrice : 0;
      
      // Price range heat (high-low range)
      const ranges = data.slice(i - period + 1, i + 1).map(candle => candle.high - candle.low);
      const avgRange = ranges.reduce((sum, range) => sum + range, 0) / period;
      const currentRange = data[i].high - data[i].low;
      const rangeHeat = avgRange > 0 ? (currentRange / avgRange) * 50 : 0;
      
      // Combine factors
      const heat = (Math.abs(priceMomentum) * 50 * 0.4) + (priceVolatility * 100 * 0.3) + (rangeHeat * 0.3);
      
      priceHeat.push(Math.min(heat, 100));
    }

    return priceHeat;
  }

  // Calculate volatility-based heat
  calculateVolatilityHeat(data: any[], period: number): (number | null)[] {
    const volatilityHeat: (number | null)[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        volatilityHeat.push(null);
        continue;
      }

      const candles = data.slice(i - period + 1, i + 1);
      
      // Calculate returns
      const returns = [];
      for (let j = 1; j < candles.length; j++) {
        const returnValue = candles[j].close / candles[j - 1].close - 1;
        returns.push(returnValue);
      }
      
      // Volatility (standard deviation of returns)
      const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance);
      
      // Recent volatility vs historical
      const recentVolatility = this.calculateRecentVolatility(candles.slice(-5));
      const historicalVolatility = this.calculateRecentVolatility(candles.slice(0, -5));
      
      const volatilityRatio = historicalVolatility > 0 ? recentVolatility / historicalVolatility : 1;
      
      // Heat based on volatility and ratio
      const heat = (volatility * 1000 * 0.6) + (volatilityRatio * 50 * 0.4);
      
      volatilityHeat.push(Math.min(heat, 100));
    }

    return volatilityHeat;
  }

  // Calculate trend-based heat
  calculateTrendHeat(data: any[], period: number): (number | null)[] {
    const trendHeat: (number | null)[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        trendHeat.push(null);
        continue;
      }

      const prices = data.slice(i - period + 1, i + 1).map(candle => candle.close);
      
      // Linear regression slope
      const slope = this.calculateSlope(prices);
      
      // Trend strength (R-squared)
      const trendStrength = this.calculateTrendStrength(prices);
      
      // Price acceleration
      const recentPrices = prices.slice(-5);
      const acceleration = this.calculateAcceleration(recentPrices);
      
      // Combine factors
      const heat = (Math.abs(slope) * 1000 * 0.4) + (trendStrength * 100 * 0.3) + (Math.abs(acceleration) * 1000 * 0.3);
      
      trendHeat.push(Math.min(heat, 100));
    }

    return trendHeat;
  }

  // Calculate overall heat with longer lookback
  calculateOverallHeat(data: any[], period: number, lookback: number): (number | null)[] {
    const overallHeat: (number | null)[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < lookback - 1) {
        overallHeat.push(null);
        continue;
      }

      const recentData = data.slice(i - lookback + 1, i + 1);
      const heatScores = this.calculateHeatScore(recentData, period);
      
      // Get the most recent heat score
      const currentHeat = heatScores[heatScores.length - 1];
      
      // Calculate heat trend
      const heatTrend = this.calculateHeatTrend(heatScores.slice(-10));
      
      // Overall heat considering trend
      const overall = currentHeat !== null ? currentHeat + heatTrend : null;
      
      overallHeat.push(overall !== null ? Math.min(Math.max(overall, 0), 100) : null);
    }

    return overallHeat;
  }

  // Helper methods
  private calculateRecentVolatility(candles: any[]): number {
    if (candles.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < candles.length; i++) {
      const returnValue = candles[i].close / candles[i - 1].close - 1;
      returns.push(returnValue);
    }
    
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private calculateSlope(prices: number[]): number {
    const n = prices.length;
    const x = Array.from({ length: n }, (_, i) => i);
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = prices.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * prices[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private calculateTrendStrength(prices: number[]): number {
    const n = prices.length;
    const x = Array.from({ length: n }, (_, i) => i);
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = prices.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * prices[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = prices.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const yMean = sumY / n;
    const ssRes = prices.reduce((sum, price, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(price - predicted, 2);
    }, 0);
    const ssTot = prices.reduce((sum, price) => sum + Math.pow(price - yMean, 2), 0);
    
    return ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
  }

  private calculateAcceleration(prices: number[]): number {
    if (prices.length < 3) return 0;
    
    const slopes = [];
    for (let i = 1; i < prices.length; i++) {
      slopes.push(prices[i] - prices[i - 1]);
    }
    
    const accelerations = [];
    for (let i = 1; i < slopes.length; i++) {
      accelerations.push(slopes[i] - slopes[i - 1]);
    }
    
    return accelerations.length > 0 ? accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length : 0;
  }

  private calculateHeatTrend(heatScores: (number | null)[]): number {
    const validScores = heatScores.filter(score => score !== null) as number[];
    if (validScores.length < 2) return 0;
    
    const firstHalf = validScores.slice(0, Math.floor(validScores.length / 2));
    const secondHalf = validScores.slice(Math.floor(validScores.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
    
    return secondAvg - firstAvg;
  }
}
