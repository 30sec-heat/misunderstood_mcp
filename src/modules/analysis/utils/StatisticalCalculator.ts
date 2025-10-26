export class StatisticalCalculator {
  /**
   * Calculate correlation coefficient between two arrays
   */
  static calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate basis (spot - futures price)
   */
  static calculateBasis(spotPrice: number, futuresPrice: number): {
    basis: number;
    basisPercent: number;
    premium: 'spot' | 'futures';
    premiumAmount: number;
    premiumPercent: number;
  } {
    const basis = spotPrice - futuresPrice;
    const basisPercent = (basis / spotPrice) * 100;
    const premium = basis > 0 ? 'spot' : 'futures';
    const premiumAmount = Math.abs(basis);
    const premiumPercent = Math.abs(basisPercent);

    return {
      basis,
      basisPercent,
      premium,
      premiumAmount,
      premiumPercent
    };
  }

  /**
   * Calculate price deviation statistics
   */
  static calculatePriceDeviation(prices: number[]): {
    average: number;
    max: number;
    min: number;
    deviation: number;
    deviationPercent: number;
    range: string;
  } {
    if (prices.length === 0) {
      return {
        average: 0,
        max: 0,
        min: 0,
        deviation: 0,
        deviationPercent: 0,
        range: '0 - 0'
      };
    }

    const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const max = Math.max(...prices);
    const min = Math.min(...prices);
    const deviation = max - min;
    const deviationPercent = (deviation / average) * 100;

    return {
      average,
      max,
      min,
      deviation,
      deviationPercent,
      range: `${min} - ${max}`
    };
  }

  /**
   * Calculate market depth metrics
   */
  static calculateMarketDepth(orderBook: { bids: [number, number][]; asks: [number, number][] }): {
    bidVolume: number;
    askVolume: number;
    totalVolume: number;
    spread: number;
    spreadPercent: number;
    imbalance: number;
    topBid: [number, number];
    topAsk: [number, number];
    levels: { bids: number; asks: number };
  } {
    const bidVolume = orderBook.bids.reduce((sum, [price, volume]) => sum + volume, 0);
    const askVolume = orderBook.asks.reduce((sum, [price, volume]) => sum + volume, 0);
    const spread = orderBook.asks[0][0] - orderBook.bids[0][0];
    const spreadPercent = (spread / orderBook.bids[0][0]) * 100;
    const imbalance = (bidVolume - askVolume) / (bidVolume + askVolume);

    return {
      bidVolume,
      askVolume,
      totalVolume: bidVolume + askVolume,
      spread,
      spreadPercent,
      imbalance,
      topBid: orderBook.bids[0],
      topAsk: orderBook.asks[0],
      levels: {
        bids: orderBook.bids.length,
        asks: orderBook.asks.length
      }
    };
  }

  /**
   * Calculate volume profile metrics
   */
  static calculateVolumeProfile(ohlcData: Array<{ close: number; volume: number }>): {
    poc: number;
    pocVolume: number;
    pocPercent: number;
    totalVolume: number;
    levels: Array<{ price: number; volume: number; percent: number }>;
    distribution: Array<{ price: number; volume: number; percent: number }>;
  } {
    const priceLevels: { [key: number]: number } = {};
    let totalVolume = 0;

    // Aggregate volume by price level
    for (const candle of ohlcData) {
      const priceLevel = Math.round(candle.close * 100) / 100; // Round to 2 decimal places
      priceLevels[priceLevel] = (priceLevels[priceLevel] || 0) + candle.volume;
      totalVolume += candle.volume;
    }

    // Find Point of Control (POC) - price level with highest volume
    let poc = 0;
    let maxVolume = 0;
    for (const [price, volume] of Object.entries(priceLevels)) {
      if (volume > maxVolume) {
        maxVolume = volume;
        poc = parseFloat(price);
      }
    }

    // Calculate volume profile metrics
    const sortedLevels = Object.entries(priceLevels)
      .map(([price, volume]) => ({ 
        price: parseFloat(price), 
        volume, 
        percent: (volume / totalVolume) * 100 
      }))
      .sort((a, b) => b.volume - a.volume);

    return {
      poc,
      pocVolume: maxVolume,
      pocPercent: (maxVolume / totalVolume) * 100,
      totalVolume,
      levels: sortedLevels.slice(0, 20), // Top 20 levels
      distribution: sortedLevels
    };
  }

  /**
   * Calculate correlation matrix for multiple symbols
   */
  static calculateCorrelationMatrix(priceData: { [key: string]: number[] }): { [key: string]: { [key: string]: number } } {
    const correlationMatrix: { [key: string]: { [key: string]: number } } = {};
    const symbolList = Object.keys(priceData);

    for (let i = 0; i < symbolList.length; i++) {
      const symbol1 = symbolList[i];
      correlationMatrix[symbol1] = {};
      
      for (let j = 0; j < symbolList.length; j++) {
        const symbol2 = symbolList[j];
        
        if (i === j) {
          correlationMatrix[symbol1][symbol2] = 1.0;
        } else {
          const correlation = this.calculateCorrelation(priceData[symbol1], priceData[symbol2]);
          correlationMatrix[symbol1][symbol2] = correlation;
        }
      }
    }

    return correlationMatrix;
  }

  /**
   * Calculate percentile rank for a value in an array
   */
  static calculatePercentileRank(value: number, array: number[]): number {
    if (array.length === 0) return 0;
    
    const sortedArray = [...array].sort((a, b) => a - b);
    const rank = sortedArray.findIndex(item => item >= value);
    
    if (rank === -1) return 100; // Value is higher than all values
    if (rank === 0) return 0; // Value is lower than all values
    
    return (rank / sortedArray.length) * 100;
  }

  /**
   * Calculate moving average
   */
  static calculateMovingAverage(data: number[], period: number): number[] {
    if (data.length < period) return [];
    
    const result: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
      result.push(sum / period);
    }
    
    return result;
  }

  /**
   * Calculate standard deviation
   */
  static calculateStandardDeviation(data: number[]): number {
    if (data.length === 0) return 0;
    
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate returns from price data
   */
  static calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  /**
   * Calculate rolling volatility (standard deviation of returns)
   */
  static calculateRollingVolatility(returns: number[], period: number): number[] {
    if (returns.length < period) return [];
    
    const volatilities: number[] = [];
    for (let i = period - 1; i < returns.length; i++) {
      const window = returns.slice(i - period + 1, i + 1);
      const volatility = this.calculateStandardDeviation(window);
      volatilities.push(volatility);
    }
    
    return volatilities;
  }

  /**
   * Calculate volume statistics
   */
  static calculateVolumeStats(volumes: number[]): {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
  } {
    if (volumes.length === 0) {
      return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0 };
    }

    const sorted = [...volumes].sort((a, b) => a - b);
    const mean = volumes.reduce((sum, val) => sum + val, 0) / volumes.length;
    const median = sorted.length % 2 === 0 
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    const stdDev = this.calculateStandardDeviation(volumes);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    return { mean, median, stdDev, min, max };
  }

  /**
   * Calculate Z-score
   */
  static calculateZScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }
}
