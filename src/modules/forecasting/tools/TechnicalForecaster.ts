import axios from 'axios';
import { ExchangeManager } from './ExchangeManager.js';

interface PriceData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TechnicalForecast {
  symbol: string;
  currentPrice: number;
  predictedPrice: number;
  priceChange: number;
  priceChangePercentage: number;
  confidence: number;
  timeframe: string;
  predictionPeriod: string;
  method: string;
  riskLevel: 'low' | 'medium' | 'high';
  indicators: {
    rsi: number;
    macd: number;
    bb: number;
    ema: number;
    sma: number;
    vwap: number;
    stoch: number;
    atr: number;
    adx: number;
  };
  patterns: {
    detected: string[];
    strength: number;
    reliability: number;
  };
  supportResistance: {
    support: number;
    resistance: number;
    strength: number;
  };
  disclaimer: string;
  timestamp: string;
}

export class TechnicalForecaster {
  private readonly DISCLAIMER = "[WARNING] EXPERIMENTAL TECHNICAL FORECASTING - NOT FINANCIAL ADVICE (NFA/DYOR) WARNING:\nThis is experimental AI-powered technical forecasting. Past performance does not guarantee future results. Always do your own research and never invest more than you can afford to lose.";
  private exchangeManager: ExchangeManager;

  constructor(exchangeManager: ExchangeManager) {
    this.exchangeManager = exchangeManager;
  }

  async technicalPriceForecast(args: any): Promise<any> {
    try {
      const { symbol, timeframe = '1h', predictionPeriod = '24h', indicators = ['rsi', 'macd', 'bb', 'ema'], patternRecognition = true, exchange = 'binance' } = args;
      
      // Get historical data
      const historicalData = await this.getHistoricalData(symbol, timeframe, exchange, 100);
      if (!historicalData || historicalData.length < 50) {
        return {
          error: 'Insufficient historical data',
          message: 'Need at least 50 data points for technical forecasting',
          disclaimer: this.DISCLAIMER
        };
      }

      // Calculate technical indicators
      const technicalIndicators = this.calculateAllIndicators(historicalData);
      
      // Get current price
      const currentPrice = historicalData[historicalData.length - 1].close;
      
      // Perform technical forecasting
      const predictedPrice = this.performTechnicalForecast(historicalData, technicalIndicators, indicators, predictionPeriod);
      
      const priceChange = predictedPrice - currentPrice;
      const priceChangePercentage = (priceChange / currentPrice) * 100;
      
      // Calculate confidence based on indicator alignment
      const confidence = this.calculateTechnicalConfidence(technicalIndicators, indicators);
      
      // Determine risk level
      const riskLevel = this.assessTechnicalRiskLevel(technicalIndicators, Math.abs(priceChangePercentage));
      
      // Detect chart patterns if requested
      let patterns = { detected: [] as string[], strength: 0, reliability: 0 };
      if (patternRecognition) {
        patterns = this.detectChartPatterns(historicalData);
      }
      
      // Calculate support and resistance levels
      const supportResistance = this.calculateSupportResistance(historicalData);
      
      // Filter indicators based on request
      const filteredIndicators = this.filterIndicators(technicalIndicators, indicators);

      const result: TechnicalForecast = {
        symbol,
        currentPrice,
        predictedPrice: Math.round(predictedPrice * 100) / 100,
        priceChange: Math.round(priceChange * 100) / 100,
        priceChangePercentage: Math.round(priceChangePercentage * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        timeframe,
        predictionPeriod,
        method: 'technical_indicators',
        riskLevel,
        indicators: filteredIndicators,
        patterns,
        supportResistance,
        disclaimer: this.DISCLAIMER,
        timestamp: new Date().toISOString()
      };

      return {
        technicalForecast: result,
        message: `Technical forecast for ${symbol}: ${priceChangePercentage > 0 ? '+' : ''}${priceChangePercentage.toFixed(2)}% over ${predictionPeriod}`,
        disclaimer: this.DISCLAIMER
      };

    } catch (error) {
      return {
        error: `Technical forecasting failed: ${error}`,
        message: 'Error generating technical forecast',
        disclaimer: this.DISCLAIMER
      };
    }
  }

  private async getHistoricalData(symbol: string, timeframe: string, exchange: string, limit: number): Promise<PriceData[]> {
    try {
      const safeLimit = Math.min(Math.max(limit, 1), 1000);
      
      const ohlcv = await this.exchangeManager.fetchOHLCV(symbol, timeframe, safeLimit);
      
      if (!ohlcv || ohlcv.length === 0) {
        return [];
      }
      
      return ohlcv.map(([timestamp, open, high, low, close, volume]: [number, number, number, number, number, number]) => ({
        timestamp,
        open,
        high,
        low,
        close,
        volume
      }));
    } catch (error) {
      console.error(`Failed to get historical data for ${symbol}:`, error);
      return [];
    }
  }

  private calculateAllIndicators(data: PriceData[]): any {
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);

    return {
      rsi: this.calculateRSI(closes, 14),
      macd: this.calculateMACD(closes)[0],
      macdSignal: this.calculateMACD(closes)[1],
      macdHistogram: this.calculateMACD(closes)[2],
      bbUpper: this.calculateBollingerBands(closes, 20, 2)[0],
      bbMiddle: this.calculateBollingerBands(closes, 20, 2)[1],
      bbLower: this.calculateBollingerBands(closes, 20, 2)[2],
      ema20: this.calculateEMA(closes, 20),
      ema50: this.calculateEMA(closes, 50),
      sma20: this.calculateSMA(closes, 20),
      sma50: this.calculateSMA(closes, 50),
      vwap: this.calculateVWAP(data),
      stochK: this.calculateStochastic(highs, lows, closes, 14)[0],
      stochD: this.calculateStochastic(highs, lows, closes, 14)[1],
      atr: this.calculateATR(highs, lows, closes, 14),
      adx: this.calculateADX(highs, lows, closes, 14)
    };
  }

  private performTechnicalForecast(data: PriceData[], indicators: any, requestedIndicators: string[], period: string): number {
    const currentPrice = data[data.length - 1].close;
    const periodHours = this.getPeriodHours(period);
    
    let totalSignal = 0;
    let signalCount = 0;
    
    // RSI signal
    if (requestedIndicators.includes('rsi')) {
      const rsiSignal = indicators.rsi > 70 ? -0.02 : indicators.rsi < 30 ? 0.02 : 0;
      totalSignal += rsiSignal;
      signalCount++;
    }
    
    // MACD signal
    if (requestedIndicators.includes('macd')) {
      const macdSignal = indicators.macd > indicators.macdSignal ? 0.01 : -0.01;
      totalSignal += macdSignal;
      signalCount++;
    }
    
    // Bollinger Bands signal
    if (requestedIndicators.includes('bb')) {
      const bbSignal = currentPrice > indicators.bbUpper ? -0.015 : 
                      currentPrice < indicators.bbLower ? 0.015 : 0;
      totalSignal += bbSignal;
      signalCount++;
    }
    
    // EMA signal
    if (requestedIndicators.includes('ema')) {
      const emaSignal = indicators.ema20 > indicators.ema50 ? 0.005 : -0.005;
      totalSignal += emaSignal;
      signalCount++;
    }
    
    // SMA signal
    if (requestedIndicators.includes('sma')) {
      const smaSignal = currentPrice > indicators.sma20 ? 0.005 : -0.005;
      totalSignal += smaSignal;
      signalCount++;
    }
    
    // VWAP signal
    if (requestedIndicators.includes('vwap')) {
      const vwapSignal = currentPrice > indicators.vwap ? 0.005 : -0.005;
      totalSignal += vwapSignal;
      signalCount++;
    }
    
    // Stochastic signal
    if (requestedIndicators.includes('stoch')) {
      const stochSignal = indicators.stochK > 80 ? -0.01 : indicators.stochK < 20 ? 0.01 : 0;
      totalSignal += stochSignal;
      signalCount++;
    }
    
    // ATR signal (volatility-based)
    if (requestedIndicators.includes('atr')) {
      const atrSignal = indicators.atr > currentPrice * 0.03 ? 0.005 : -0.005;
      totalSignal += atrSignal;
      signalCount++;
    }
    
    // ADX signal (trend strength)
    if (requestedIndicators.includes('adx')) {
      const adxSignal = indicators.adx > 25 ? 0.005 : -0.005;
      totalSignal += adxSignal;
      signalCount++;
    }
    
    // Calculate average signal
    const avgSignal = signalCount > 0 ? totalSignal / signalCount : 0;
    
    // Scale by time period
    const timeScale = periodHours / 24;
    const finalSignal = avgSignal * timeScale;
    
    return currentPrice * (1 + finalSignal);
  }

  private calculateTechnicalConfidence(indicators: any, requestedIndicators: string[]): number {
    let totalConfidence = 0;
    let indicatorCount = 0;
    
    // RSI confidence
    if (requestedIndicators.includes('rsi')) {
      const rsiConfidence = 1 - Math.abs(indicators.rsi - 50) / 50;
      totalConfidence += rsiConfidence;
      indicatorCount++;
    }
    
    // MACD confidence
    if (requestedIndicators.includes('macd')) {
      const macdConfidence = Math.abs(indicators.macd - indicators.macdSignal) / Math.abs(indicators.macd);
      totalConfidence += Math.min(macdConfidence, 1);
      indicatorCount++;
    }
    
    // Bollinger Bands confidence
    if (requestedIndicators.includes('bb')) {
      const bbWidth = (indicators.bbUpper - indicators.bbLower) / indicators.bbMiddle;
      const bbConfidence = Math.min(bbWidth * 10, 1);
      totalConfidence += bbConfidence;
      indicatorCount++;
    }
    
    // EMA confidence
    if (requestedIndicators.includes('ema')) {
      const emaConfidence = Math.abs(indicators.ema20 - indicators.ema50) / indicators.ema50;
      totalConfidence += Math.min(emaConfidence * 20, 1);
      indicatorCount++;
    }
    
    // Default confidence for other indicators
    const defaultConfidence = 0.7;
    const remainingIndicators = requestedIndicators.length - indicatorCount;
    totalConfidence += remainingIndicators * defaultConfidence;
    indicatorCount += remainingIndicators;
    
    return indicatorCount > 0 ? totalConfidence / indicatorCount : 0.5;
  }

  private assessTechnicalRiskLevel(indicators: any, priceChangePercent: number): 'low' | 'medium' | 'high' {
    const volatility = indicators.atr / 100; // Normalize ATR
    const rsiExtreme = Math.abs(indicators.rsi - 50) / 50;
    
    if (volatility > 0.05 || rsiExtreme > 0.8 || priceChangePercent > 10) {
      return 'high';
    } else if (volatility > 0.03 || rsiExtreme > 0.6 || priceChangePercent > 5) {
      return 'medium';
    }
    return 'low';
  }

  private detectChartPatterns(data: PriceData[]): { detected: string[]; strength: number; reliability: number } {
    const patterns: string[] = [];
    let strength = 0;
    let reliability = 0;
    
    // Simple pattern detection
    const recentData = data.slice(-20);
    const highs = recentData.map(d => d.high);
    const lows = recentData.map(d => d.low);
    const closes = recentData.map(d => d.close);
    
    // Detect double top
    if (this.detectDoubleTop(highs)) {
      patterns.push('double_top');
      strength += 0.7;
      reliability += 0.6;
    }
    
    // Detect double bottom
    if (this.detectDoubleBottom(lows)) {
      patterns.push('double_bottom');
      strength += 0.7;
      reliability += 0.6;
    }
    
    // Detect head and shoulders
    if (this.detectHeadAndShoulders(highs)) {
      patterns.push('head_and_shoulders');
      strength += 0.8;
      reliability += 0.7;
    }
    
    // Detect triangle
    if (this.detectTriangle(highs, lows)) {
      patterns.push('triangle');
      strength += 0.6;
      reliability += 0.5;
    }
    
    // Detect flag
    if (this.detectFlag(closes)) {
      patterns.push('flag');
      strength += 0.5;
      reliability += 0.4;
    }
    
    return {
      detected: patterns,
      strength: Math.min(strength, 1),
      reliability: Math.min(reliability, 1)
    };
  }

  private calculateSupportResistance(data: PriceData[]): { support: number; resistance: number; strength: number } {
    const recentData = data.slice(-50);
    const highs = recentData.map(d => d.high);
    const lows = recentData.map(d => d.low);
    
    // Find resistance (local maxima)
    const resistance = Math.max(...highs);
    
    // Find support (local minima)
    const support = Math.min(...lows);
    
    // Calculate strength based on how many times levels were tested
    const strength = this.calculateLevelStrength(recentData, support, resistance);
    
    return {
      support: Math.round(support * 100) / 100,
      resistance: Math.round(resistance * 100) / 100,
      strength: Math.round(strength * 100) / 100
    };
  }

  private filterIndicators(indicators: any, requestedIndicators: string[]): any {
    const filtered: any = {};
    
    for (const indicator of requestedIndicators) {
      switch (indicator) {
        case 'rsi':
          filtered.rsi = Math.round(indicators.rsi * 100) / 100;
          break;
        case 'macd':
          filtered.macd = Math.round(indicators.macd * 100) / 100;
          break;
        case 'bb':
          filtered.bb = Math.round((indicators.bbUpper - indicators.bbLower) / indicators.bbMiddle * 100) / 100;
          break;
        case 'ema':
          filtered.ema = Math.round((indicators.ema20 - indicators.ema50) / indicators.ema50 * 100) / 100;
          break;
        case 'sma':
          filtered.sma = Math.round(indicators.sma20 * 100) / 100;
          break;
        case 'vwap':
          filtered.vwap = Math.round(indicators.vwap * 100) / 100;
          break;
        case 'stoch':
          filtered.stoch = Math.round(indicators.stochK * 100) / 100;
          break;
        case 'atr':
          filtered.atr = Math.round(indicators.atr * 100) / 100;
          break;
        case 'adx':
          filtered.adx = Math.round(indicators.adx * 100) / 100;
          break;
      }
    }
    
    return filtered;
  }

  // Pattern detection methods
  private detectDoubleTop(highs: number[]): boolean {
    if (highs.length < 10) return false;
    
    const max1 = Math.max(...highs.slice(0, 5));
    const max2 = Math.max(...highs.slice(5, 10));
    
    return Math.abs(max1 - max2) / max1 < 0.02; // Within 2%
  }

  private detectDoubleBottom(lows: number[]): boolean {
    if (lows.length < 10) return false;
    
    const min1 = Math.min(...lows.slice(0, 5));
    const min2 = Math.min(...lows.slice(5, 10));
    
    return Math.abs(min1 - min2) / min1 < 0.02; // Within 2%
  }

  private detectHeadAndShoulders(highs: number[]): boolean {
    if (highs.length < 15) return false;
    
    const leftShoulder = Math.max(...highs.slice(0, 5));
    const head = Math.max(...highs.slice(5, 10));
    const rightShoulder = Math.max(...highs.slice(10, 15));
    
    return head > leftShoulder && head > rightShoulder && 
           Math.abs(leftShoulder - rightShoulder) / leftShoulder < 0.05;
  }

  private detectTriangle(highs: number[], lows: number[]): boolean {
    if (highs.length < 10) return false;
    
    const firstHalfHighs = highs.slice(0, 5);
    const secondHalfHighs = highs.slice(5, 10);
    const firstHalfLows = lows.slice(0, 5);
    const secondHalfLows = lows.slice(5, 10);
    
    const highTrend = (Math.max(...secondHalfHighs) - Math.max(...firstHalfHighs)) / Math.max(...firstHalfHighs);
    const lowTrend = (Math.min(...secondHalfLows) - Math.min(...firstHalfLows)) / Math.min(...firstHalfLows);
    
    return Math.abs(highTrend) < 0.05 && Math.abs(lowTrend) < 0.05;
  }

  private detectFlag(closes: number[]): boolean {
    if (closes.length < 10) return false;
    
    const firstHalf = closes.slice(0, 5);
    const secondHalf = closes.slice(5, 10);
    
    const firstTrend = (firstHalf[firstHalf.length - 1] - firstHalf[0]) / firstHalf[0];
    const secondTrend = (secondHalf[secondHalf.length - 1] - secondHalf[0]) / secondHalf[0];
    
    return Math.abs(firstTrend) > 0.02 && Math.abs(secondTrend) < 0.01;
  }

  private calculateLevelStrength(data: PriceData[], support: number, resistance: number): number {
    let supportTests = 0;
    let resistanceTests = 0;
    
    for (const d of data) {
      if (Math.abs(d.low - support) / support < 0.01) supportTests++;
      if (Math.abs(d.high - resistance) / resistance < 0.01) resistanceTests++;
    }
    
    return Math.min((supportTests + resistanceTests) / 10, 1);
  }

  // Technical indicator calculation methods
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): [number, number, number] {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    const signal = this.calculateEMA([macd], 9);
    const histogram = macd - signal;
    
    return [macd, signal, histogram];
  }

  private calculateBollingerBands(prices: number[], period: number, stdDev: number): [number, number, number] {
    const sma = this.calculateSMA(prices, period);
    const recentPrices = prices.slice(-period);
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return [sma + (stdDev * standardDeviation), sma, sma - (stdDev * standardDeviation)];
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const recentPrices = prices.slice(-period);
    return recentPrices.reduce((sum, price) => sum + price, 0) / period;
  }

  private calculateVWAP(data: PriceData[]): number {
    let totalVolume = 0;
    let totalVolumePrice = 0;
    
    for (const d of data) {
      const typicalPrice = (d.high + d.low + d.close) / 3;
      totalVolumePrice += typicalPrice * d.volume;
      totalVolume += d.volume;
    }
    
    return totalVolume > 0 ? totalVolumePrice / totalVolume : 0;
  }

  private calculateStochastic(highs: number[], lows: number[], closes: number[], period: number): [number, number] {
    if (highs.length < period) return [50, 50];
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    const d = k; // Simplified - would normally be SMA of K values
    
    return [k, d];
  }

  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    if (highs.length < period + 1) return 0;
    
    let totalTR = 0;
    
    for (let i = 1; i <= period; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      totalTR += tr;
    }
    
    return totalTR / period;
  }

  private calculateADX(highs: number[], lows: number[], closes: number[], period: number): number {
    if (highs.length < period + 1) return 0;
    
    // Simplified ADX calculation
    let totalDM = 0;
    let totalTR = 0;
    
    for (let i = 1; i <= period; i++) {
      const dm = Math.max(highs[i] - highs[i - 1], lows[i - 1] - lows[i], 0);
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      
      totalDM += dm;
      totalTR += tr;
    }
    
    const di = totalTR > 0 ? (totalDM / totalTR) * 100 : 0;
    return Math.min(di, 100);
  }

  private getPeriodHours(period: string): number {
    const periodMap: { [key: string]: number } = {
      '1h': 1,
      '4h': 4,
      '8h': 8,
      '24h': 24,
      '3d': 72
    };
    return periodMap[period] || 24;
  }
}
