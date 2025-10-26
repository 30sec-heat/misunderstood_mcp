import { ExchangeDataFetcher, OHLCData } from '../data/ExchangeDataFetcher.js';
import { StatisticalCalculator } from '../utils/StatisticalCalculator.js';
import { CoinalyzeAPI, CoinalyzeOpenInterestHistory } from '../../liquidations/coinalyze-api.js';

export interface ComprehensiveAnalysisResult {
  symbol: string;
  exchange: string;
  timeframe: string;
  currentPrice: number;
  dataPoints: number;
  timestamp: number;
  
  // Technical Indicators
  technicalIndicators: {
    sma: { sma20: number; sma50: number; sma200: number };
    ema: { ema12: number; ema20: number; ema50: number };
    rsi: { rsi14: number; rsi21: number };
    macd: { macd: number; signal: number; histogram: number };
    bollingerBands: { upper: number; middle: number; lower: number; squeeze: boolean };
    stochastic: { k: number; d: number; overbought: boolean; oversold: boolean };
    vwap: number;
    atr: number;
    adx: number;
    williamsR: number;
  };
  
  // Price Action Analysis
  priceAction: {
    trend: { direction: string; strength: number; slope: number };
    supportLevels: Array<{ price: number; strength: number; touches: number }>;
    resistanceLevels: Array<{ price: number; strength: number; touches: number }>;
    nearestSupport: number | null;
    nearestResistance: number | null;
  };
  
  // Chart Patterns
  chartPatterns: Array<{
    type: string;
    confidence: number;
    description: string;
    breakoutPrice?: number;
    targetPrice?: number;
  }>;
  
  // Momentum Analysis (Linear Regression Based)
  momentum: {
    priceLinearRegression: {
      short: { slope: number; correlation: number; direction: string; period: number };
      medium: { slope: number; correlation: number; direction: string; period: number };
      long: { slope: number; correlation: number; direction: string; period: number };
    };
    volumeLinearRegression: {
      short: { slope: number; correlation: number; direction: string; period: number };
      medium: { slope: number; correlation: number; direction: string; period: number };
      long: { slope: number; correlation: number; direction: string; period: number };
    };
    momentumScore: number;
    divergences: Array<{
      type: string;
      strength: number;
      indicator: string;
    }>;
  };
  
  // Basic Statistics (simplified for crypto trading)
  statistics: {
    volatility: number;
    priceRange: { min: number; max: number; range: number };
    recentPerformance: {
      change1h: number;
      change24h: number;
      change7d: number;
    };
  };
  
  // Risk Analysis (crypto-focused)
  risk: {
    volatility: number;
    maxDrawdown: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    liquidationRisk: {
      nearSupport: number | null;
      supportDistance: number;
      riskScore: number;
    };
  };
  
  // Volume Analysis
  volume: {
    averageVolume: number;
    volumePercentileRank: number;
    volumeTrend: string;
    volumeProfile: Array<{
      priceLevel: number;
      volume: number;
      percentage: number;
    }>;
  };
  
  // Open Interest Analysis (from Coinalyze)
  openInterestAnalysis?: {
    currentOI: number;
    oiHistory: Array<{ timestamp: number; value: number }>;
    oiTrends: {
      short: { slope: number; correlation: number; direction: string };
      medium: { slope: number; correlation: number; direction: string };
      long: { slope: number; correlation: number; direction: string };
    };
    priceOICorrelation: {
      correlation: number;
      marketSentiment: string;
      interpretation: string;
    };
    oiChangeAnalysis: {
      recent24h: { change: number; changePercent: number };
      recent7d: { change: number; changePercent: number };
    };
  };
  
  // Market Microstructure (if available)
  microstructure?: {
    spread: number;
    marketDepth: {
      bidDepth: number;
      askDepth: number;
      imbalance: number;
    };
    fundingRate?: number;
    openInterest?: number;
  };
  
  // Summary and Signals
  summary: {
    overallSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    signalStrength: number;
    keyLevels: {
      support: number[];
      resistance: number[];
    };
    alerts: string[];
    recommendations: string[];
  };
}

export class ComprehensiveAnalysisTool {
  private dataFetcher: ExchangeDataFetcher;
  private coinalyzeAPI: CoinalyzeAPI | null = null;

  constructor(coinalyzeAPI?: CoinalyzeAPI) {
    this.dataFetcher = new ExchangeDataFetcher();
    this.coinalyzeAPI = coinalyzeAPI || null;
  }

  async performComprehensiveAnalysis(args: any): Promise<ComprehensiveAnalysisResult | { error: string; message: string }> {
    try {
      const { 
        symbol, 
        timeframe = '1h', 
        exchange = 'binance', 
        limit = 1000,
        includeMicrostructure = true 
      } = args;
      
      if (!symbol) {
        return {
          error: 'Missing symbol parameter',
          message: 'Symbol parameter is required for comprehensive analysis'
        };
      }

      // Single data fetch with high limit
      const rawOhlcData = await this.dataFetcher.fetchOHLCData(symbol, exchange, timeframe, limit);
      
      if (!rawOhlcData || rawOhlcData.length < 100) {
        return {
          error: 'Insufficient data',
          message: `Need at least 100 candles for comprehensive analysis. Got ${rawOhlcData?.length || 0}`
        };
      }

      // Validate and clean the OHLC data
      const ohlcData = rawOhlcData.filter(candle => 
        candle && 
        !isNaN(candle.open) && !isNaN(candle.high) && !isNaN(candle.low) && !isNaN(candle.close) && !isNaN(candle.volume) &&
        candle.open > 0 && candle.high > 0 && candle.low > 0 && candle.close > 0 && candle.volume >= 0 &&
        candle.high >= candle.low && candle.high >= candle.open && candle.high >= candle.close &&
        candle.low <= candle.open && candle.low <= candle.close
      );

      if (ohlcData.length < 50) {
        return {
          error: 'Insufficient valid data',
          message: `After data validation, only ${ohlcData.length} valid candles remain. Need at least 50.`
        };
      }

      const currentPrice = ohlcData[ohlcData.length - 1].close;
      const timestamp = Date.now();

      // Perform all analyses
      const result: ComprehensiveAnalysisResult = {
        symbol,
        exchange,
        timeframe,
        currentPrice,
        dataPoints: ohlcData.length,
        timestamp,
        
        technicalIndicators: this.calculateTechnicalIndicators(ohlcData),
        priceAction: this.analyzePriceAction(ohlcData),
        chartPatterns: this.detectChartPatterns(ohlcData),
        momentum: this.analyzeMomentum(ohlcData),
        statistics: this.performStatisticalAnalysis(ohlcData),
        risk: this.calculateRiskMetrics(ohlcData),
        volume: this.analyzeVolume(ohlcData),
        summary: { 
          overallSignal: 'NEUTRAL', 
          signalStrength: 0, 
          keyLevels: { support: [], resistance: [] }, 
          alerts: [], 
          recommendations: [] 
        }
      };

      // Add Open Interest analysis if Coinalyze API is available
      if (this.coinalyzeAPI) {
        try {
          result.openInterestAnalysis = await this.analyzeOpenInterest(symbol, ohlcData);
        } catch (error) {
          console.warn('Failed to fetch Open Interest data:', error);
          // OI data is optional, continue without it
        }
      }

      // Add microstructure data if requested and available
      if (includeMicrostructure) {
        try {
          result.microstructure = await this.getMicrostructureData(symbol, exchange);
        } catch (error) {
          // Microstructure data is optional, continue without it
        }
      }

      // Generate summary and signals
      result.summary = this.generateSummary(result);

      return result;
    } catch (error: any) {
      return {
        error: error.message,
        message: `Failed to perform comprehensive analysis: ${error.message}`
      };
    }
  }

  private calculateTechnicalIndicators(ohlcData: OHLCData[]) {
    const closes = ohlcData.map(c => c.close);
    const highs = ohlcData.map(c => c.high);
    const lows = ohlcData.map(c => c.low);
    const volumes = ohlcData.map(c => c.volume);

    return {
      sma: {
        sma20: this.calculateSMA(closes, 20),
        sma50: this.calculateSMA(closes, 50),
        sma200: this.calculateSMA(closes, 200)
      },
      ema: {
        ema12: this.calculateEMA(closes, 12),
        ema20: this.calculateEMA(closes, 20),
        ema50: this.calculateEMA(closes, 50)
      },
      rsi: {
        rsi14: this.calculateRSI(closes, 14),
        rsi21: this.calculateRSI(closes, 21)
      },
      macd: this.calculateMACD(closes),
      bollingerBands: this.calculateBollingerBands(closes, 20, 2),
      stochastic: this.calculateStochastic(highs, lows, closes, 14),
      vwap: this.calculateVWAP(ohlcData),
      atr: this.calculateATR(highs, lows, closes, 14),
      adx: this.calculateADX(highs, lows, closes, 14),
      williamsR: this.calculateWilliamsR(highs, lows, closes, 14)
    };
  }

  private analyzePriceAction(ohlcData: OHLCData[]) {
    const supportLevels = this.findSupportLevels(ohlcData);
    const resistanceLevels = this.findResistanceLevels(ohlcData);
    const currentPrice = ohlcData[ohlcData.length - 1].close;
    
    return {
      trend: this.calculateTrend(ohlcData),
      supportLevels: supportLevels.slice(0, 5),
      resistanceLevels: resistanceLevels.slice(0, 5),
      nearestSupport: this.findNearestLevel(currentPrice, supportLevels, 'below'),
      nearestResistance: this.findNearestLevel(currentPrice, resistanceLevels, 'above')
    };
  }

  private detectChartPatterns(ohlcData: OHLCData[]) {
    const patterns = [];
    
    // Detect various patterns
    const triangle = this.detectTrianglePattern(ohlcData);
    if (triangle) patterns.push(triangle);
    
    const headShoulders = this.detectHeadAndShouldersPattern(ohlcData);
    if (headShoulders) patterns.push(headShoulders);
    
    const doubleTop = this.detectDoubleTopPattern(ohlcData);
    if (doubleTop) patterns.push(doubleTop);
    
    const doubleBottom = this.detectDoubleBottomPattern(ohlcData);
    if (doubleBottom) patterns.push(doubleBottom);
    
    return patterns.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  private analyzeMomentum(ohlcData: OHLCData[]) {
    const closes = ohlcData.map(c => c.close);
    const volumes = ohlcData.map(c => c.volume);
    
    // Define periods for linear regression analysis
    const shortPeriod = Math.min(20, Math.floor(ohlcData.length * 0.1));
    const mediumPeriod = Math.min(50, Math.floor(ohlcData.length * 0.25));
    const longPeriod = Math.min(200, Math.floor(ohlcData.length * 0.5));
    
    return {
      priceLinearRegression: {
        short: { ...this.calculatePriceLinearRegression(closes.slice(-shortPeriod)), period: shortPeriod },
        medium: { ...this.calculatePriceLinearRegression(closes.slice(-mediumPeriod)), period: mediumPeriod },
        long: { ...this.calculatePriceLinearRegression(closes.slice(-longPeriod)), period: longPeriod }
      },
      volumeLinearRegression: {
        short: { ...this.calculateVolumeLinearRegression(volumes.slice(-shortPeriod)), period: shortPeriod },
        medium: { ...this.calculateVolumeLinearRegression(volumes.slice(-mediumPeriod)), period: mediumPeriod },
        long: { ...this.calculateVolumeLinearRegression(volumes.slice(-longPeriod)), period: longPeriod }
      },
      momentumScore: this.calculateMomentumScore(ohlcData),
      divergences: this.detectDivergences(ohlcData)
    };
  }

  private performStatisticalAnalysis(ohlcData: OHLCData[]) {
    const closes = ohlcData.map(c => c.close);
    const returns = StatisticalCalculator.calculateReturns(closes);
    
    // Calculate recent performance changes
    const currentPrice = closes[closes.length - 1];
    const price1hAgo = closes.length > 1 ? closes[closes.length - 2] : currentPrice;
    const price24hAgo = closes.length > 24 ? closes[closes.length - 24] : currentPrice;
    const price7dAgo = closes.length > 168 ? closes[closes.length - 168] : currentPrice; // Assuming 1h timeframe
    
    return {
      volatility: StatisticalCalculator.calculateStandardDeviation(returns),
      priceRange: {
        min: Math.min(...closes),
        max: Math.max(...closes),
        range: Math.max(...closes) - Math.min(...closes)
      },
      recentPerformance: {
        change1h: ((currentPrice - price1hAgo) / price1hAgo) * 100,
        change24h: ((currentPrice - price24hAgo) / price24hAgo) * 100,
        change7d: ((currentPrice - price7dAgo) / price7dAgo) * 100
      }
    };
  }

  private calculateRiskMetrics(ohlcData: OHLCData[]) {
    const closes = ohlcData.map(c => c.close);
    const returns = StatisticalCalculator.calculateReturns(closes);
    const currentPrice = closes[closes.length - 1];
    
    const volatility = StatisticalCalculator.calculateStandardDeviation(returns);
    const maxDrawdown = this.calculateMaxDrawdown(returns);
    
    // Determine risk level based on volatility
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    if (volatility < 0.02) riskLevel = 'LOW';
    else if (volatility < 0.05) riskLevel = 'MEDIUM';
    else if (volatility < 0.1) riskLevel = 'HIGH';
    else riskLevel = 'EXTREME';
    
    // Calculate liquidation risk based on support levels
    const supportLevels = this.findSupportLevels(ohlcData);
    const nearestSupport = supportLevels.length > 0 ? supportLevels[0].price : null;
    const supportDistance = nearestSupport ? ((currentPrice - nearestSupport) / currentPrice) * 100 : 100;
    
    let riskScore = 0;
    if (supportDistance < 5) riskScore = 90;
    else if (supportDistance < 10) riskScore = 70;
    else if (supportDistance < 20) riskScore = 50;
    else riskScore = 20;
    
    return {
      volatility,
      maxDrawdown,
      riskLevel,
      liquidationRisk: {
        nearSupport: nearestSupport,
        supportDistance,
        riskScore
      }
    };
  }

  private analyzeVolume(ohlcData: OHLCData[]) {
    const volumes = ohlcData.map(c => c.volume);
    
    return {
      averageVolume: volumes.reduce((sum, v) => sum + v, 0) / volumes.length,
      volumePercentileRank: this.calculateVolumePercentileRank(volumes),
      volumeTrend: this.calculateVolumeTrend(volumes),
      volumeProfile: this.calculateVolumeProfile(ohlcData)
    };
  }

  private async getMicrostructureData(symbol: string, exchange: string) {
    try {
      const [orderBook, fundingRate] = await Promise.all([
        this.dataFetcher.fetchOrderBook(symbol, exchange, 20).catch(() => null),
        this.dataFetcher.fetchFundingRate(symbol, exchange).catch(() => null)
      ]);

      // Calculate market depth metrics from order book
      const bidDepth = orderBook?.bids.reduce((sum, [price, qty]) => sum + (price * qty), 0) || 0;
      const askDepth = orderBook?.asks.reduce((sum, [price, qty]) => sum + (price * qty), 0) || 0;
      const spread = orderBook ? (orderBook.asks[0]?.[0] || 0) - (orderBook.bids[0]?.[0] || 0) : 0;
      const imbalance = bidDepth + askDepth > 0 ? (bidDepth - askDepth) / (bidDepth + askDepth) : 0;

      return {
        spread,
        marketDepth: {
          bidDepth,
          askDepth,
          imbalance
        },
        fundingRate: fundingRate?.rate || undefined,
        openInterest: undefined // Could be added if available
      };
    } catch (error) {
      return undefined;
    }
  }

  private generateSummary(analysis: ComprehensiveAnalysisResult) {
    const signals = [];
    const alerts = [];
    const recommendations = [];
    
    // Analyze technical indicators for signals
    const { technicalIndicators, priceAction, momentum, risk } = analysis;
    
    // RSI signals
    if (technicalIndicators.rsi.rsi14 > 70) {
      signals.push('BEARISH');
      alerts.push('RSI overbought (>70)');
    } else if (technicalIndicators.rsi.rsi14 < 30) {
      signals.push('BULLISH');
      alerts.push('RSI oversold (<30)');
    }
    
    // MACD signals
    if (technicalIndicators.macd.histogram > 0 && technicalIndicators.macd.macd > technicalIndicators.macd.signal) {
      signals.push('BULLISH');
    } else if (technicalIndicators.macd.histogram < 0 && technicalIndicators.macd.macd < technicalIndicators.macd.signal) {
      signals.push('BEARISH');
    }
    
    // Trend signals
    if (priceAction.trend.direction === 'uptrend' && priceAction.trend.strength > 0.5) {
      signals.push('BULLISH');
    } else if (priceAction.trend.direction === 'downtrend' && priceAction.trend.strength > 0.5) {
      signals.push('BEARISH');
    }
    
    // Risk alerts
    if (risk.volatility > 0.05) {
      alerts.push('High volatility detected');
    }
    
    if (risk.riskLevel === 'HIGH' || risk.riskLevel === 'EXTREME') {
      alerts.push(`${risk.riskLevel.toLowerCase()} risk level detected`);
    }
    
    if (risk.liquidationRisk.riskScore > 70) {
      alerts.push('High liquidation risk - price near support');
    }
    
    // Generate overall signal
    const bullishSignals = signals.filter(s => s === 'BULLISH').length;
    const bearishSignals = signals.filter(s => s === 'BEARISH').length;
    
    let overallSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let signalStrength = 0;
    
    if (bullishSignals > bearishSignals) {
      overallSignal = 'BULLISH';
      signalStrength = (bullishSignals / (bullishSignals + bearishSignals)) * 100;
    } else if (bearishSignals > bullishSignals) {
      overallSignal = 'BEARISH';
      signalStrength = (bearishSignals / (bullishSignals + bearishSignals)) * 100;
    }
    
    // Key levels
    const keyLevels = {
      support: priceAction.supportLevels.slice(0, 3).map(s => s.price),
      resistance: priceAction.resistanceLevels.slice(0, 3).map(r => r.price)
    };
    
    // Recommendations
    if (overallSignal === 'BULLISH' && signalStrength > 60) {
      recommendations.push('Consider long positions');
      recommendations.push(`Target: ${keyLevels.resistance[0]?.toFixed(2) || 'N/A'}`);
      recommendations.push(`Stop loss: ${keyLevels.support[0]?.toFixed(2) || 'N/A'}`);
    } else if (overallSignal === 'BEARISH' && signalStrength > 60) {
      recommendations.push('Consider short positions');
      recommendations.push(`Target: ${keyLevels.support[0]?.toFixed(2) || 'N/A'}`);
      recommendations.push(`Stop loss: ${keyLevels.resistance[0]?.toFixed(2) || 'N/A'}`);
    } else {
      recommendations.push('Wait for clearer signals');
      recommendations.push('Monitor key support/resistance levels');
    }
    
    return {
      overallSignal,
      signalStrength: Math.round(signalStrength),
      keyLevels,
      alerts,
      recommendations
    };
  }

  // Technical Indicator Calculations
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period || prices.length === 0) return 0;
    const recentPrices = prices.slice(-period);
    const sum = recentPrices.reduce((sum, price) => sum + price, 0);
    return sum > 0 ? sum / period : 0;
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period || prices.length === 0) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    // Validate first price
    if (isNaN(ema) || ema <= 0) return 0;
    
    for (let i = 1; i < prices.length; i++) {
      if (isNaN(prices[i]) || prices[i] <= 0) continue;
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return isNaN(ema) ? 0 : ema;
  }

  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const avgGain = gains.slice(-period).reduce((sum, g) => sum + g, 0) / period;
    const avgLoss = losses.slice(-period).reduce((sum, l) => sum + l, 0) / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]) {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    const signal = macd * 0.9; // Simplified signal line
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }

  private calculateBollingerBands(prices: number[], period: number, stdDevMultiplier: number) {
    const sma = this.calculateSMA(prices, period);
    const recentPrices = prices.slice(-period);
    const stdDev = StatisticalCalculator.calculateStandardDeviation(recentPrices);
    
    const upper = sma + (stdDevMultiplier * stdDev);
    const lower = sma - (stdDevMultiplier * stdDev);
    const squeeze = (upper - lower) / sma < 0.1; // Simplified squeeze detection
    
    return { upper, middle: sma, lower, squeeze };
  }

  private calculateStochastic(highs: number[], lows: number[], closes: number[], period: number) {
    if (closes.length < period) return { k: 50, d: 50, overbought: false, oversold: false };
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];
    
    const lowestLow = Math.min(...recentLows);
    const highestHigh = Math.max(...recentHighs);
    
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    const d = k * 0.9; // Simplified D line
    
    return {
      k,
      d,
      overbought: k > 80,
      oversold: k < 20
    };
  }

  private calculateVWAP(ohlcData: OHLCData[]): number {
    if (ohlcData.length === 0) return 0;
    
    let totalVolume = 0;
    let totalVolumePrice = 0;
    
    for (const candle of ohlcData) {
      // Validate candle data
      if (!candle || isNaN(candle.high) || isNaN(candle.low) || isNaN(candle.close) || isNaN(candle.volume)) {
        continue;
      }
      
      if (candle.high <= 0 || candle.low <= 0 || candle.close <= 0 || candle.volume <= 0) {
        continue;
      }
      
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      totalVolumePrice += typicalPrice * candle.volume;
      totalVolume += candle.volume;
    }
    
    return totalVolume > 0 ? totalVolumePrice / totalVolume : 0;
  }

  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    if (closes.length < period + 1) return 0;
    
    const trueRanges: number[] = [];
    
    for (let i = 1; i < closes.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      
      trueRanges.push(tr);
    }
    
    return trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
  }

  private calculateADX(highs: number[], lows: number[], closes: number[], period: number): number {
    // Simplified ADX calculation
    if (closes.length < period + 1) return 0;
    
    let totalDM = 0;
    let count = 0;
    
    for (let i = 1; i < Math.min(closes.length, period + 1); i++) {
      const highDiff = highs[i] - highs[i - 1];
      const lowDiff = lows[i - 1] - lows[i];
      
      if (highDiff > lowDiff && highDiff > 0) {
        totalDM += highDiff;
        count++;
      } else if (lowDiff > highDiff && lowDiff > 0) {
        totalDM += lowDiff;
        count++;
      }
    }
    
    return count > 0 ? (totalDM / count) * 100 : 0;
  }

  private calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number): number {
    if (closes.length < period || highs.length < period || lows.length < period) return -50;
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];
    
    // Validate data
    if (recentHighs.length === 0 || recentLows.length === 0 || isNaN(currentClose)) return -50;
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    // Avoid division by zero
    if (highestHigh === lowestLow) return -50;
    
    const williamsR = ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
    return isNaN(williamsR) ? -50 : williamsR;
  }

  // Price Action Analysis Methods
  private calculateTrend(ohlcData: OHLCData[]) {
    if (ohlcData.length < 2) {
      return { direction: 'sideways', strength: 0, slope: 0 };
    }
    
    const closes = ohlcData.map(c => c.close).filter(c => !isNaN(c) && c > 0);
    const timestamps = ohlcData.map(c => c.timestamp).filter(t => !isNaN(t) && t > 0);
    
    if (closes.length < 2 || timestamps.length < 2 || closes.length !== timestamps.length) {
      return { direction: 'sideways', strength: 0, slope: 0 };
    }
    
    // Linear regression for trend
    const n = closes.length;
    const sumX = timestamps.reduce((sum, t) => sum + t, 0);
    const sumY = closes.reduce((sum, c) => sum + c, 0);
    const sumXY = timestamps.reduce((sum, t, i) => sum + t * closes[i], 0);
    const sumXX = timestamps.reduce((sum, t) => sum + t * t, 0);

    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) {
      return { direction: 'sideways', strength: 0, slope: 0 };
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const strength = Math.abs(slope) * 1000000; // Scale for readability

    let direction = 'sideways';
    if (slope > 0.000001) direction = 'uptrend';
    else if (slope < -0.000001) direction = 'downtrend';

    return { 
      direction, 
      strength: isNaN(strength) ? 0 : strength, 
      slope: isNaN(slope) ? 0 : slope 
    };
  }

  private findSupportLevels(ohlcData: OHLCData[]) {
    const levels: Array<{ price: number; strength: number; touches: number }> = [];
    const priceMap: { [key: number]: number } = {};

    // Find local lows
    for (let i = 2; i < ohlcData.length - 2; i++) {
      const current = ohlcData[i];
      const prev1 = ohlcData[i - 1];
      const prev2 = ohlcData[i - 2];
      const next1 = ohlcData[i + 1];
      const next2 = ohlcData[i + 2];

      if (current.low < prev1.low && current.low < prev2.low && 
          current.low < next1.low && current.low < next2.low) {
        
        const roundedPrice = Math.round(current.low * 100) / 100;
        priceMap[roundedPrice] = (priceMap[roundedPrice] || 0) + 1;
      }
    }

    for (const [price, touches] of Object.entries(priceMap)) {
      if (touches >= 2) {
        levels.push({
          price: parseFloat(price),
          strength: touches,
          touches
        });
      }
    }

    return levels.sort((a, b) => b.strength - a.strength);
  }

  private findResistanceLevels(ohlcData: OHLCData[]) {
    const levels: Array<{ price: number; strength: number; touches: number }> = [];
    const priceMap: { [key: number]: number } = {};

    // Find local highs
    for (let i = 2; i < ohlcData.length - 2; i++) {
      const current = ohlcData[i];
      const prev1 = ohlcData[i - 1];
      const prev2 = ohlcData[i - 2];
      const next1 = ohlcData[i + 1];
      const next2 = ohlcData[i + 2];

      if (current.high > prev1.high && current.high > prev2.high && 
          current.high > next1.high && current.high > next2.high) {
        
        const roundedPrice = Math.round(current.high * 100) / 100;
        priceMap[roundedPrice] = (priceMap[roundedPrice] || 0) + 1;
      }
    }

    for (const [price, touches] of Object.entries(priceMap)) {
      if (touches >= 2) {
        levels.push({
          price: parseFloat(price),
          strength: touches,
          touches
        });
      }
    }

    return levels.sort((a, b) => b.strength - a.strength);
  }

  private findNearestLevel(currentPrice: number, levels: Array<{ price: number; strength: number; touches: number }>, direction: 'above' | 'below'): number | null {
    const filteredLevels = levels.filter(level => 
      direction === 'above' ? level.price > currentPrice : level.price < currentPrice
    );
    
    if (filteredLevels.length === 0) return null;
    
    const nearest = filteredLevels.reduce((nearest, level) => {
      const nearestDistance = Math.abs(nearest.price - currentPrice);
      const currentDistance = Math.abs(level.price - currentPrice);
      return currentDistance < nearestDistance ? level : nearest;
    });
    
    return nearest.price;
  }

  // Helper methods for chart patterns
  private getSignificantHighs(ohlcData: OHLCData[]) {
    const highs: Array<{ price: number; timestamp: number }> = [];
    
    for (let i = 2; i < ohlcData.length - 2; i++) {
      const current = ohlcData[i];
      const prev1 = ohlcData[i - 1];
      const prev2 = ohlcData[i - 2];
      const next1 = ohlcData[i + 1];
      const next2 = ohlcData[i + 2];

      if (current.high > prev1.high && current.high > prev2.high && 
          current.high > next1.high && current.high > next2.high) {
        highs.push({ price: current.high, timestamp: current.timestamp });
      }
    }
    
    return highs;
  }

  private getSignificantLows(ohlcData: OHLCData[]) {
    const lows: Array<{ price: number; timestamp: number }> = [];
    
    for (let i = 2; i < ohlcData.length - 2; i++) {
      const current = ohlcData[i];
      const prev1 = ohlcData[i - 1];
      const prev2 = ohlcData[i - 2];
      const next1 = ohlcData[i + 1];
      const next2 = ohlcData[i + 2];

      if (current.low < prev1.low && current.low < prev2.low && 
          current.low < next1.low && current.low < next2.low) {
        lows.push({ price: current.low, timestamp: current.timestamp });
      }
    }
    
    return lows;
  }

  // Chart Pattern Detection (Simplified)
  private detectTrianglePattern(ohlcData: OHLCData[]) {
    const highs = this.getSignificantHighs(ohlcData);
    const lows = this.getSignificantLows(ohlcData);

    if (highs.length < 3 || lows.length < 3) return null;

    // Simple triangle detection
    const recentHighs = highs.slice(-3);
    const recentLows = lows.slice(-3);
    
    // Check if highs are descending and lows are ascending
    const highsDescending = recentHighs[0].price > recentHighs[1].price && recentHighs[1].price > recentHighs[2].price;
    const lowsAscending = recentLows[0].price < recentLows[1].price && recentLows[1].price < recentLows[2].price;
    
    if (highsDescending && lowsAscending) {
      return {
        type: 'triangle',
        confidence: 0.7,
        description: 'Symmetrical triangle pattern detected',
        breakoutPrice: (recentHighs[2].price + recentLows[2].price) / 2
      };
    }
    
    return null;
  }

  private detectHeadAndShouldersPattern(ohlcData: OHLCData[]) {
    const highs = this.getSignificantHighs(ohlcData);
    if (highs.length < 3) return null;

    const recentHighs = highs.slice(-3);
    const [left, head, right] = recentHighs;

    // Check if middle peak is highest
    if (head.price > left.price && head.price > right.price) {
      const shoulderDiff = Math.abs(left.price - right.price) / Math.max(left.price, right.price);
      
      if (shoulderDiff < 0.05) { // 5% tolerance
        return {
          type: 'head_shoulders',
          confidence: 1 - shoulderDiff,
          description: 'Head and shoulders pattern detected',
          targetPrice: Math.min(left.price, right.price) - (head.price - Math.min(left.price, right.price))
        };
      }
    }
    
    return null;
  }

  private detectDoubleTopPattern(ohlcData: OHLCData[]) {
    const highs = this.getSignificantHighs(ohlcData);
    if (highs.length < 2) return null;

    const recentHighs = highs.slice(-2);
    const [first, second] = recentHighs;

    const priceDiff = Math.abs(first.price - second.price) / Math.max(first.price, second.price);
    
    if (priceDiff < 0.03) { // 3% tolerance
      return {
        type: 'double_top',
        confidence: 1 - priceDiff,
        description: 'Double top pattern detected',
        targetPrice: Math.min(first.price, second.price) * 0.95
      };
    }
    
    return null;
  }

  private detectDoubleBottomPattern(ohlcData: OHLCData[]) {
    const lows = this.getSignificantLows(ohlcData);
    if (lows.length < 2) return null;

    const recentLows = lows.slice(-2);
    const [first, second] = recentLows;

    const priceDiff = Math.abs(first.price - second.price) / Math.max(first.price, second.price);
    
    if (priceDiff < 0.03) { // 3% tolerance
      return {
        type: 'double_bottom',
        confidence: 1 - priceDiff,
        description: 'Double bottom pattern detected',
        targetPrice: Math.max(first.price, second.price) * 1.05
      };
    }
    
    return null;
  }

  // Momentum Analysis Methods
  private calculateMomentumScore(ohlcData: OHLCData[]) {
    const closes = ohlcData.map(c => c.close);
    const volumes = ohlcData.map(c => c.volume);
    const period = 20;
    
    if (closes.length < period * 2) return 0;
    
    // Price momentum
    const priceMomentum = (closes[closes.length - 1] - closes[closes.length - period]) / closes[closes.length - period];
    
    // Volume momentum
    const recentVolume = volumes.slice(-period).reduce((sum, v) => sum + v, 0) / period;
    const historicalVolume = volumes.slice(-period * 2, -period).reduce((sum, v) => sum + v, 0) / period;
    const volumeMomentum = (recentVolume - historicalVolume) / historicalVolume;
    
    // Trend momentum
    const trendMomentum = this.calculateTrendMomentum(closes.slice(-period));
    
    // Composite score
    return (priceMomentum * 0.5 + volumeMomentum * 0.3 + trendMomentum * 0.2) * 100;
  }

  private calculateMomentumComponents(ohlcData: OHLCData[]) {
    const closes = ohlcData.map(c => c.close);
    const volumes = ohlcData.map(c => c.volume);
    const period = 20;
    
    if (closes.length < period * 2) {
      return { priceMomentum: 0, volumeMomentum: 0, trendMomentum: 0, volatilityMomentum: 0 };
    }
    
    const priceMomentum = (closes[closes.length - 1] - closes[closes.length - period]) / closes[closes.length - period];
    
    const recentVolume = volumes.slice(-period).reduce((sum, v) => sum + v, 0) / period;
    const historicalVolume = volumes.slice(-period * 2, -period).reduce((sum, v) => sum + v, 0) / period;
    const volumeMomentum = (recentVolume - historicalVolume) / historicalVolume;
    
    const trendMomentum = this.calculateTrendMomentum(closes.slice(-period));
    
    const recentReturns = StatisticalCalculator.calculateReturns(closes.slice(-period));
    const historicalReturns = StatisticalCalculator.calculateReturns(closes.slice(-period * 2, -period));
    const recentVolatility = StatisticalCalculator.calculateStandardDeviation(recentReturns);
    const historicalVolatility = StatisticalCalculator.calculateStandardDeviation(historicalReturns);
    const volatilityMomentum = (recentVolatility - historicalVolatility) / historicalVolatility;
    
    return {
      priceMomentum: Math.round(priceMomentum * 10000) / 10000,
      volumeMomentum: Math.round(volumeMomentum * 10000) / 10000,
      trendMomentum: Math.round(trendMomentum * 10000) / 10000,
      volatilityMomentum: Math.round(volatilityMomentum * 10000) / 10000
    };
  }

  private calculateTrendMomentum(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const n = prices.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = prices.reduce((sum, p) => sum + p, 0);
    const sumXY = prices.reduce((sum, p, i) => sum + i * p, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope / prices[0]; // Normalize by first price
  }

  private detectDivergences(ohlcData: OHLCData[]) {
    // Simplified divergence detection
    const closes = ohlcData.map(c => c.close);
    const rsiValues = this.calculateRSIArray(closes, 14);
    
    const divergences = [];
    
    // Look for recent divergences in last 20 periods
    const lookback = Math.min(20, closes.length - 1);
    
    for (let i = closes.length - lookback; i < closes.length - 5; i++) {
      const priceChange = closes[i + 5] - closes[i];
      const rsiChange = rsiValues[i + 5] - rsiValues[i];
      
      // Bullish divergence: price down, RSI up
      if (priceChange < 0 && rsiChange > 0 && Math.abs(rsiChange) > 5) {
        divergences.push({
          type: 'bullish',
          strength: Math.abs(rsiChange),
          indicator: 'RSI'
        });
      }
      
      // Bearish divergence: price up, RSI down
      if (priceChange > 0 && rsiChange < 0 && Math.abs(rsiChange) > 5) {
        divergences.push({
          type: 'bearish',
          strength: Math.abs(rsiChange),
          indicator: 'RSI'
        });
      }
    }
    
    return divergences.slice(0, 3); // Return top 3
  }

  private calculateRSIArray(prices: number[], period: number): number[] {
    const rsi: number[] = [];
    
    for (let i = period; i < prices.length; i++) {
      const slice = prices.slice(i - period, i + 1);
      rsi.push(this.calculateRSI(slice, period));
    }
    
    return rsi;
  }

  private detectTrendChanges(ohlcData: OHLCData[]) {
    const closes = ohlcData.map(c => c.close);
    const trendChanges = [];
    const windowSize = 10;
    
    for (let i = windowSize; i < closes.length - windowSize; i++) {
      const beforeWindow = closes.slice(i - windowSize, i);
      const afterWindow = closes.slice(i, i + windowSize);
      
      const beforeTrend = this.calculateTrendMomentum(beforeWindow);
      const afterTrend = this.calculateTrendMomentum(afterWindow);
      
      const trendChange = Math.abs(afterTrend - beforeTrend);
      
      if (trendChange > 0.01) { // 1% threshold
        let type = 'sideways';
        if (afterTrend > 0.001) type = 'uptrend';
        else if (afterTrend < -0.001) type = 'downtrend';
        
        trendChanges.push({
          timestamp: ohlcData[i].timestamp,
          type,
          confidence: Math.min(trendChange / 0.01, 1)
        });
      }
    }
    
    return trendChanges.slice(-5); // Return last 5 changes
  }


  // Keep only the maxDrawdown method as it's still used
  private calculateMaxDrawdown(returns: number[]): number {
    let maxDrawdown = 0;
    let peak = 1;
    
    for (const return_ of returns) {
      peak = Math.max(peak, 1 + return_);
      const drawdown = (peak - (1 + return_)) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return -maxDrawdown;
  }

  // Volume Analysis Methods
  private calculateVolumePercentileRank(volumes: number[]): number {
    const currentVolume = volumes[volumes.length - 1];
    const sortedVolumes = [...volumes].sort((a, b) => a - b);
    const rank = sortedVolumes.findIndex(v => v >= currentVolume);
    return (rank / sortedVolumes.length) * 100;
  }

  private calculateVolumeTrend(volumes: number[]): string {
    if (volumes.length < 20) return 'insufficient_data';
    
    const recentAvg = volumes.slice(-10).reduce((sum, v) => sum + v, 0) / 10;
    const historicalAvg = volumes.slice(-20, -10).reduce((sum, v) => sum + v, 0) / 10;
    
    const change = (recentAvg - historicalAvg) / historicalAvg;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  private calculateVolumeProfile(ohlcData: OHLCData[]) {
    const priceVolumeMap: { [key: number]: number } = {};
    
    // Group volume by price levels
    for (const candle of ohlcData) {
      const priceLevel = Math.round(candle.close * 100) / 100; // Round to 2 decimals
      priceVolumeMap[priceLevel] = (priceVolumeMap[priceLevel] || 0) + candle.volume;
    }
    
    const totalVolume = Object.values(priceVolumeMap).reduce((sum, vol) => sum + vol, 0);
    
    const profile = Object.entries(priceVolumeMap)
      .map(([price, volume]) => ({
        priceLevel: parseFloat(price),
        volume,
        percentage: (volume / totalVolume) * 100
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10); // Top 10 volume levels
    
    return profile;
  }

  // Open Interest Analysis Methods
  private async analyzeOpenInterest(symbol: string, ohlcData: OHLCData[]) {
    if (!this.coinalyzeAPI) {
      throw new Error('Coinalyze API not available');
    }

    try {
      // Convert symbol format for Coinalyze (e.g., BTCUSDT -> BTCUSDT_PERP)
      const coinalyzeSymbol = this.convertToCoinalyzeSymbol(symbol);
      
      // Get last 1000 candles worth of OI data (matching the OHLC data timeframe)
      const now = Math.floor(Date.now() / 1000);
      const from = now - (1000 * this.getTimeframeSeconds(ohlcData));
      
      // Fetch OI history from Coinalyze
      const oiHistoryData = await this.coinalyzeAPI.getOpenInterestHistory(
        [coinalyzeSymbol],
        '1hour', // Use hourly data for better granularity
        from,
        now,
        true // Convert to USD
      );

      if (!oiHistoryData || oiHistoryData.length === 0) {
        throw new Error('No Open Interest data available');
      }

      const oiHistory = oiHistoryData[0].history;
      const currentOI = oiHistory[oiHistory.length - 1]?.value || 0;

      // Align OI data with price data by timestamp
      const alignedData = this.alignOIWithPriceData(oiHistory, ohlcData);

      // Calculate linear regression trends for different periods
      const oiTrends = this.calculateOITrends(alignedData);

      // Calculate price-OI correlation and market sentiment
      const priceOICorrelation = this.calculatePriceOICorrelation(alignedData);

      // Calculate OI change analysis
      const oiChangeAnalysis = this.calculateOIChangeAnalysis(oiHistory);
    
    return {
        currentOI,
        oiHistory: oiHistory.slice(-100), // Keep last 100 points for display
        oiTrends,
        priceOICorrelation,
        oiChangeAnalysis
      };
    } catch (error) {
      console.error('Error in Open Interest analysis:', error);
      throw error;
    }
  }

  private convertToCoinalyzeSymbol(symbol: string): string {
    // Convert standard symbol to Coinalyze format
    // BTCUSDT -> BTCUSDT_PERP
    const upperSymbol = symbol.toUpperCase();
    if (upperSymbol.includes('USDT') && !upperSymbol.includes('_PERP')) {
      return `${upperSymbol}_PERP`;
    }
    return upperSymbol;
  }

  private getTimeframeSeconds(ohlcData: OHLCData[]): number {
    if (ohlcData.length < 2) return 3600; // Default to 1 hour
    
    // Calculate timeframe from the difference between consecutive candles
    const timeDiff = ohlcData[1].timestamp - ohlcData[0].timestamp;
    return Math.floor(timeDiff / 1000); // Convert to seconds
  }

  private alignOIWithPriceData(oiHistory: Array<{ timestamp: number; value: number }>, ohlcData: OHLCData[]) {
    const alignedData: Array<{ timestamp: number; price: number; oi: number }> = [];
    
    // Create a map of OI data by timestamp for faster lookup
    const oiMap = new Map<number, number>();
    oiHistory.forEach(point => {
      // Convert to milliseconds and round to nearest hour for alignment
      const hourTimestamp = Math.floor(point.timestamp * 1000 / (1000 * 60 * 60)) * (1000 * 60 * 60);
      oiMap.set(hourTimestamp, point.value);
    });

    // Align with price data
    ohlcData.forEach(candle => {
      const hourTimestamp = Math.floor(candle.timestamp / (1000 * 60 * 60)) * (1000 * 60 * 60);
      const oiValue = oiMap.get(hourTimestamp);
      
      if (oiValue !== undefined) {
        alignedData.push({
          timestamp: candle.timestamp,
          price: candle.close,
          oi: oiValue
        });
      }
    });

    return alignedData.sort((a, b) => a.timestamp - b.timestamp);
  }

  private calculateOITrends(alignedData: Array<{ timestamp: number; price: number; oi: number }>) {
    if (alignedData.length < 10) {
      return {
        short: { slope: 0, correlation: 0, direction: 'insufficient_data' },
        medium: { slope: 0, correlation: 0, direction: 'insufficient_data' },
        long: { slope: 0, correlation: 0, direction: 'insufficient_data' }
      };
    }

    // Define periods for analysis
    const shortPeriod = Math.min(20, Math.floor(alignedData.length * 0.2)); // 20% of data or 20 points
    const mediumPeriod = Math.min(50, Math.floor(alignedData.length * 0.5)); // 50% of data or 50 points
    const longPeriod = alignedData.length; // All data

    return {
      short: this.calculateLinearRegression(alignedData.slice(-shortPeriod), 'oi'),
      medium: this.calculateLinearRegression(alignedData.slice(-mediumPeriod), 'oi'),
      long: this.calculateLinearRegression(alignedData, 'oi')
    };
  }

  private calculatePriceOICorrelation(alignedData: Array<{ timestamp: number; price: number; oi: number }>) {
    if (alignedData.length < 10) {
      return {
        correlation: 0,
        marketSentiment: 'insufficient_data',
        interpretation: 'Not enough data for correlation analysis'
      };
    }

    const prices = alignedData.map(d => d.price);
    const oiValues = alignedData.map(d => d.oi);

    // Calculate correlation coefficient
    const correlation = this.calculateCorrelation(prices, oiValues);

    // Calculate recent price and OI changes
    const recentData = alignedData.slice(-10); // Last 10 points
    const priceChange = recentData[recentData.length - 1].price - recentData[0].price;
    const oiChange = recentData[recentData.length - 1].oi - recentData[0].oi;

    // Determine market sentiment based on price and OI changes
    let marketSentiment = 'neutral';
    let interpretation = '';

    if (oiChange > 0 && priceChange > 0) {
      marketSentiment = 'longs_opening';
      interpretation = 'OI increasing with price rising - new long positions opening';
    } else if (oiChange > 0 && priceChange < 0) {
      marketSentiment = 'shorts_opening';
      interpretation = 'OI increasing with price falling - new short positions opening';
    } else if (oiChange < 0 && priceChange > 0) {
      marketSentiment = 'shorts_closing';
      interpretation = 'OI decreasing with price rising - short positions closing';
    } else if (oiChange < 0 && priceChange < 0) {
      marketSentiment = 'longs_closing';
      interpretation = 'OI decreasing with price falling - long positions closing';
    } else {
      interpretation = 'Mixed signals or sideways movement';
    }

    return {
      correlation: Math.round(correlation * 10000) / 10000,
      marketSentiment,
      interpretation
    };
  }

  private calculateOIChangeAnalysis(oiHistory: Array<{ timestamp: number; value: number }>) {
    if (oiHistory.length < 2) {
      return {
        recent24h: { change: 0, changePercent: 0 },
        recent7d: { change: 0, changePercent: 0 }
      };
    }

    const currentOI = oiHistory[oiHistory.length - 1].value;
    const now = Date.now() / 1000;

    // Find OI value 24 hours ago
    const oneDayAgo = now - (24 * 60 * 60);
    const oi24hAgo = this.findClosestOIValue(oiHistory, oneDayAgo);

    // Find OI value 7 days ago
    const sevenDaysAgo = now - (7 * 24 * 60 * 60);
    const oi7dAgo = this.findClosestOIValue(oiHistory, sevenDaysAgo);

    return {
      recent24h: {
        change: currentOI - oi24hAgo,
        changePercent: oi24hAgo > 0 ? ((currentOI - oi24hAgo) / oi24hAgo) * 100 : 0
      },
      recent7d: {
        change: currentOI - oi7dAgo,
        changePercent: oi7dAgo > 0 ? ((currentOI - oi7dAgo) / oi7dAgo) * 100 : 0
      }
    };
  }

  private findClosestOIValue(oiHistory: Array<{ timestamp: number; value: number }>, targetTimestamp: number): number {
    if (oiHistory.length === 0) return 0;

    let closest = oiHistory[0];
    let minDiff = Math.abs(oiHistory[0].timestamp - targetTimestamp);

    for (const point of oiHistory) {
      const diff = Math.abs(point.timestamp - targetTimestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }

    return closest.value;
  }

  private calculateLinearRegression(data: Array<{ timestamp: number; price: number; oi: number }>, field: 'price' | 'oi') {
    if (data.length < 2) {
      return { slope: 0, correlation: 0, direction: 'insufficient_data' };
    }

    const n = data.length;
    const x = data.map((_, i) => i); // Use index as x-axis
    const y = data.map(d => field === 'price' ? d.price : d.oi);

    // Calculate linear regression
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Calculate correlation coefficient
    const correlation = this.calculateCorrelation(x, y);

    // Determine direction
    let direction = 'sideways';
    if (slope > 0.01) direction = 'increasing';
    else if (slope < -0.01) direction = 'decreasing';
    
    return {
      slope: Math.round(slope * 10000) / 10000,
      correlation: Math.round(correlation * 10000) / 10000,
      direction
    };
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;

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

  // New Linear Regression Methods for Momentum Analysis
  private calculatePriceLinearRegression(prices: number[]) {
    if (prices.length < 2) {
      return { slope: 0, correlation: 0, direction: 'insufficient_data' };
    }

    const n = prices.length;
    const x = prices.map((_, i) => i);
    const y = prices;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) {
      return { slope: 0, correlation: 0, direction: 'sideways' };
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const correlation = this.calculateCorrelation(x, y);

    // Normalize slope by average price for better interpretation
    const avgPrice = sumY / n;
    const normalizedSlope = (slope / avgPrice) * 100; // Percentage change per period

    let direction = 'sideways';
    if (normalizedSlope > 0.1) direction = 'increasing';
    else if (normalizedSlope < -0.1) direction = 'decreasing';

    return {
      slope: Math.round(normalizedSlope * 10000) / 10000,
      correlation: Math.round(correlation * 10000) / 10000,
      direction
    };
  }

  private calculateVolumeLinearRegression(volumes: number[]) {
    if (volumes.length < 2) {
      return { slope: 0, correlation: 0, direction: 'insufficient_data' };
    }

    const n = volumes.length;
    const x = volumes.map((_, i) => i);
    const y = volumes;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) {
      return { slope: 0, correlation: 0, direction: 'sideways' };
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const correlation = this.calculateCorrelation(x, y);

    // Normalize slope by average volume
    const avgVolume = sumY / n;
    const normalizedSlope = avgVolume > 0 ? (slope / avgVolume) * 100 : 0;

    let direction = 'sideways';
    if (normalizedSlope > 1) direction = 'increasing';
    else if (normalizedSlope < -1) direction = 'decreasing';

    return {
      slope: Math.round(normalizedSlope * 10000) / 10000,
      correlation: Math.round(correlation * 10000) / 10000,
      direction
    };
  }
}
