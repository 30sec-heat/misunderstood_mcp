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

interface TechnicalIndicators {
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  ema20: number;
  ema50: number;
  sma20: number;
  vwap: number;
  atr: number;
}

interface ForecastResult {
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
  factors: {
    technical: number;
    volume: number;
    volatility: number;
    momentum: number;
  };
  disclaimer: string;
  timestamp: string;
}

interface CorrelationForecast {
  symbols: string[];
  currentCorrelations: { [key: string]: number };
  predictedCorrelations: { [key: string]: number };
  correlationChanges: { [key: string]: number };
  confidence: number;
  timeframe: string;
  predictionPeriod: string;
  disclaimer: string;
}

interface MarketRegime {
  regime: 'bull' | 'bear' | 'sideways' | 'volatile';
  confidence: number;
  duration: number;
  indicators: {
    trend: number;
    volatility: number;
    momentum: number;
    volume: number;
  };
  predictedChange: {
    probability: number;
    timeframe: string;
    newRegime: string;
  };
}

export class PriceForecaster {
  private readonly DISCLAIMER = "[WARNING] EXPERIMENTAL FORECASTING - NOT FINANCIAL ADVICE (NFA/DYOR) WARNING:\nThis is experimental AI-powered forecasting. Past performance does not guarantee future results. Always do your own research and never invest more than you can afford to lose.";
  private exchangeManager: ExchangeManager;

  constructor(exchangeManager: ExchangeManager) {
    this.exchangeManager = exchangeManager;
  }

  async forecastPriceMovement(args: any): Promise<any> {
    try {
      const { symbol, timeframe = '1h', predictionPeriod = '24h', exchange = 'binance', includeOptions = true, confidenceLevel = 0.7 } = args;
      
      // Get historical data
      const historicalData = await this.getHistoricalData(symbol, timeframe, exchange, 100);
      if (!historicalData || historicalData.length < 50) {
        return {
          error: 'Insufficient historical data',
          message: 'Need at least 50 data points for forecasting',
          disclaimer: this.DISCLAIMER
        };
      }

      // Calculate technical indicators
      const indicators = this.calculateTechnicalIndicators(historicalData);
      
      // Get current price
      const currentPrice = historicalData[historicalData.length - 1].close;
      
      // Perform forecasting using multiple methods
      const technicalForecast = this.technicalForecast(historicalData, indicators, predictionPeriod);
      const volumeForecast = this.volumeBasedForecast(historicalData, predictionPeriod);
      const volatilityForecast = this.volatilityBasedForecast(historicalData, predictionPeriod);
      
      // Combine forecasts with weights
      const weights = this.calculateForecastWeights(indicators, historicalData);
      const predictedPrice = 
        technicalForecast * weights.technical +
        volumeForecast * weights.volume +
        volatilityForecast * weights.volatility;

      const priceChange = predictedPrice - currentPrice;
      const priceChangePercentage = (priceChange / currentPrice) * 100;
      
      // Calculate confidence based on multiple factors
      const confidence = this.calculateConfidence(indicators, historicalData, confidenceLevel);
      
      // Determine risk level
      const riskLevel = this.assessRiskLevel(indicators, historicalData, Math.abs(priceChangePercentage));
      
      // Get options data if requested
      let optionsData = null;
      if (includeOptions && exchange === 'deribit') {
        optionsData = await this.getOptionsData(symbol);
      }

      const result: ForecastResult = {
        symbol,
        currentPrice,
        predictedPrice: Math.round(predictedPrice * 100) / 100,
        priceChange: Math.round(priceChange * 100) / 100,
        priceChangePercentage: Math.round(priceChangePercentage * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        timeframe,
        predictionPeriod,
        method: 'hybrid_technical_volume_volatility',
        riskLevel,
        factors: {
          technical: Math.round(weights.technical * 100) / 100,
          volume: Math.round(weights.volume * 100) / 100,
          volatility: Math.round(weights.volatility * 100) / 100,
          momentum: Math.round(this.calculateMomentumScore(indicators) * 100) / 100
        },
        disclaimer: this.DISCLAIMER,
        timestamp: new Date().toISOString()
      };

      return {
        forecast: result,
        optionsData,
        message: `Price forecast for ${symbol}: ${priceChangePercentage > 0 ? '+' : ''}${priceChangePercentage.toFixed(2)}% over ${predictionPeriod}`,
        disclaimer: this.DISCLAIMER
      };

    } catch (error) {
      return {
        error: `Forecasting failed: ${error}`,
        message: 'Error generating price forecast',
        disclaimer: this.DISCLAIMER
      };
    }
  }

  async forecastCorrelationChanges(args: any): Promise<any> {
    try {
      const { symbols, timeframe = '1d', predictionPeriod = '7d', exchange = 'binance' } = args;
      
      if (symbols.length < 2) {
        return {
          error: 'Need at least 2 symbols for correlation analysis',
          disclaimer: this.DISCLAIMER
        };
      }

      // Get historical data for all symbols
      const historicalDataMap = new Map();
      for (const symbol of symbols) {
        const data = await this.getHistoricalData(symbol, timeframe, exchange, 100);
        if (data && data.length >= 50) {
          historicalDataMap.set(symbol, data);
        }
      }

      if (historicalDataMap.size < 2) {
        return {
          error: 'Insufficient data for correlation analysis',
          disclaimer: this.DISCLAIMER
        };
      }

      // Calculate current correlations
      const currentCorrelations = this.calculateCorrelations(historicalDataMap);
      
      // Predict correlation changes based on recent trends
      const predictedCorrelations = this.predictCorrelationChanges(historicalDataMap, predictionPeriod);
      
      // Calculate correlation changes
      const correlationChanges: { [key: string]: number } = {};
      for (const [pair, current] of Object.entries(currentCorrelations)) {
        const predicted = predictedCorrelations[pair];
        correlationChanges[pair] = predicted - current;
      }

      // Calculate overall confidence
      const confidence = this.calculateCorrelationConfidence(historicalDataMap);

      const result: CorrelationForecast = {
        symbols,
        currentCorrelations,
        predictedCorrelations,
        correlationChanges,
        confidence: Math.round(confidence * 100) / 100,
        timeframe,
        predictionPeriod,
        disclaimer: this.DISCLAIMER
      };

      return {
        correlationForecast: result,
        message: `Correlation forecast for ${symbols.join(', ')} over ${predictionPeriod}`,
        disclaimer: this.DISCLAIMER
      };

    } catch (error) {
      return {
        error: `Correlation forecasting failed: ${error}`,
        message: 'Error generating correlation forecast',
        disclaimer: this.DISCLAIMER
      };
    }
  }

  async detectMarketRegime(args: any): Promise<any> {
    try {
      const { symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'], timeframe = '1d', lookbackPeriod = 30, exchange = 'binance' } = args;
      
      // Get historical data for all symbols
      const historicalDataMap = new Map();
      for (const symbol of symbols) {
        const data = await this.getHistoricalData(symbol, timeframe, exchange, lookbackPeriod);
        if (data && data.length >= 20) {
          historicalDataMap.set(symbol, data);
        }
      }

      if (historicalDataMap.size === 0) {
        return {
          error: 'Insufficient data for regime analysis',
          disclaimer: this.DISCLAIMER
        };
      }

      // Analyze market regime
      const regime = this.analyzeMarketRegime(historicalDataMap);
      
      // Predict regime change
      const predictedChange = this.predictRegimeChange(historicalDataMap);

      const result: MarketRegime = {
        regime: regime.type,
        confidence: Math.round(regime.confidence * 100) / 100,
        duration: regime.duration,
        indicators: {
          trend: Math.round(regime.indicators.trend * 100) / 100,
          volatility: Math.round(regime.indicators.volatility * 100) / 100,
          momentum: Math.round(regime.indicators.momentum * 100) / 100,
          volume: Math.round(regime.indicators.volume * 100) / 100
        },
        predictedChange: {
          probability: Math.round(predictedChange.probability * 100) / 100,
          timeframe: predictedChange.timeframe,
          newRegime: predictedChange.newRegime
        }
      };

      return {
        marketRegime: result,
        symbols,
        timeframe,
        lookbackPeriod,
        message: `Market regime: ${regime.type} (${Math.round(regime.confidence * 100)}% confidence)`,
        disclaimer: this.DISCLAIMER
      };

    } catch (error) {
      return {
        error: `Regime detection failed: ${error}`,
        message: 'Error detecting market regime',
        disclaimer: this.DISCLAIMER
      };
    }
  }

  async assessForecastRisk(args: any): Promise<any> {
    try {
      const { symbol, forecastPeriod = '24h', confidenceLevel = 0.7, exchange = 'binance' } = args;
      
      // Get historical data
      const historicalData = await this.getHistoricalData(symbol, '1h', exchange, 100);
      if (!historicalData || historicalData.length < 50) {
        return {
          error: 'Insufficient historical data for risk assessment',
          disclaimer: this.DISCLAIMER
        };
      }

      // Calculate risk metrics
      const riskMetrics = this.calculateRiskMetrics(historicalData, forecastPeriod);
      
      // Assess forecast reliability
      const reliability = this.assessForecastReliability(historicalData, confidenceLevel);
      
      // Calculate risk score
      const riskScore = this.calculateRiskScore(riskMetrics, reliability);

      return {
        riskAssessment: {
          symbol,
          forecastPeriod,
          confidenceLevel,
          riskScore: Math.round(riskScore * 100) / 100,
          riskLevel: this.getRiskLevel(riskScore),
          metrics: {
            volatility: Math.round(riskMetrics.volatility * 100) / 100,
            drawdown: Math.round(riskMetrics.maxDrawdown * 100) / 100,
            sharpeRatio: Math.round(riskMetrics.sharpeRatio * 100) / 100,
            var95: Math.round(riskMetrics.var95 * 100) / 100
          },
          reliability: {
            dataQuality: Math.round(reliability.dataQuality * 100) / 100,
            modelStability: Math.round(reliability.modelStability * 100) / 100,
            marketConditions: Math.round(reliability.marketConditions * 100) / 100
          },
          recommendations: this.getRiskRecommendations(riskScore, riskMetrics),
          disclaimer: this.DISCLAIMER
        },
        message: `Risk assessment for ${symbol} forecast over ${forecastPeriod}`,
        disclaimer: this.DISCLAIMER
      };

    } catch (error) {
      return {
        error: `Risk assessment failed: ${error}`,
        message: 'Error assessing forecast risk',
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

  private calculateTechnicalIndicators(data: PriceData[]): TechnicalIndicators {
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
      vwap: this.calculateVWAP(data),
      atr: this.calculateATR(highs, lows, closes, 14)
    };
  }

  private technicalForecast(data: PriceData[], indicators: TechnicalIndicators, period: string): number {
    const currentPrice = data[data.length - 1].close;
    const periodHours = this.getPeriodHours(period);
    
    // RSI-based forecast
    const rsiSignal = indicators.rsi > 70 ? -0.02 : indicators.rsi < 30 ? 0.02 : 0;
    
    // MACD-based forecast
    const macdSignal = indicators.macd > indicators.macdSignal ? 0.01 : -0.01;
    
    // Bollinger Bands-based forecast
    const bbSignal = currentPrice > indicators.bbUpper ? -0.015 : 
                    currentPrice < indicators.bbLower ? 0.015 : 0;
    
    // EMA trend
    const emaSignal = indicators.ema20 > indicators.ema50 ? 0.005 : -0.005;
    
    const totalSignal = (rsiSignal + macdSignal + bbSignal + emaSignal) * (periodHours / 24);
    return currentPrice * (1 + totalSignal);
  }

  private volumeBasedForecast(data: PriceData[], period: string): number {
    const currentPrice = data[data.length - 1].close;
    const recentVolume = data.slice(-10).reduce((sum, d) => sum + d.volume, 0) / 10;
    const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
    
    const volumeRatio = recentVolume / avgVolume;
    const volumeSignal = volumeRatio > 1.5 ? 0.01 : volumeRatio < 0.5 ? -0.01 : 0;
    
    return currentPrice * (1 + volumeSignal);
  }

  private volatilityBasedForecast(data: PriceData[], period: string): number {
    const currentPrice = data[data.length - 1].close;
    const returns = data.slice(-20).map((d, i) => 
      i > 0 ? (d.close - data[i - 1].close) / data[i - 1].close : 0
    ).slice(1);
    
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length);
    const volatilitySignal = volatility > 0.05 ? 0.005 : -0.005;
    
    return currentPrice * (1 + volatilitySignal);
  }

  private calculateForecastWeights(indicators: TechnicalIndicators, data: PriceData[]): { technical: number; volume: number; volatility: number } {
    // Dynamic weighting based on market conditions
    const rsiWeight = Math.abs(indicators.rsi - 50) / 50; // Higher weight when RSI is extreme
    const volumeWeight = data[data.length - 1].volume / data.reduce((sum, d) => sum + d.volume, 0) * data.length;
    
    const total = rsiWeight + volumeWeight + 0.3; // Base volatility weight
    
    return {
      technical: rsiWeight / total,
      volume: volumeWeight / total,
      volatility: 0.3 / total
    };
  }

  private calculateConfidence(indicators: TechnicalIndicators, data: PriceData[], baseConfidence: number): number {
    // Adjust confidence based on market conditions
    const rsiConfidence = 1 - Math.abs(indicators.rsi - 50) / 50; // Lower confidence when RSI is extreme
    const volumeConfidence = Math.min(data[data.length - 1].volume / data.reduce((sum, d) => sum + d.volume, 0) * data.length, 1);
    const trendConfidence = Math.abs(indicators.ema20 - indicators.ema50) / indicators.ema50;
    
    return Math.min(baseConfidence * (rsiConfidence + volumeConfidence + trendConfidence) / 3, 0.95);
  }

  private assessRiskLevel(indicators: TechnicalIndicators, data: PriceData[], priceChangePercent: number): 'low' | 'medium' | 'high' {
    const volatility = this.calculateVolatility(data);
    const volumeSpike = data[data.length - 1].volume / data.reduce((sum, d) => sum + d.volume, 0) * data.length;
    
    if (volatility > 0.05 || volumeSpike > 2 || Math.abs(priceChangePercent) > 10) {
      return 'high';
    } else if (volatility > 0.03 || volumeSpike > 1.5 || Math.abs(priceChangePercent) > 5) {
      return 'medium';
    }
    return 'low';
  }

  private calculateMomentumScore(indicators: TechnicalIndicators): number {
    const rsiMomentum = (indicators.rsi - 50) / 50;
    const macdMomentum = indicators.macd > indicators.macdSignal ? 1 : -1;
    const emaMomentum = (indicators.ema20 - indicators.ema50) / indicators.ema50;
    
    return (rsiMomentum + macdMomentum * 0.5 + emaMomentum * 2) / 3.5;
  }

  private async getOptionsData(symbol: string): Promise<any> {
    // Options data integration would require additional API
    const optionsData = null;
    // Would integrate with Deribit API for BTC/ETH options
    return null;
  }

  private calculateCorrelations(dataMap: Map<string, PriceData[]>): { [key: string]: number } {
    const symbols = Array.from(dataMap.keys());
    const correlations: { [key: string]: number } = {};
    
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const symbol1 = symbols[i];
        const symbol2 = symbols[j];
        const data1 = dataMap.get(symbol1)!;
        const data2 = dataMap.get(symbol2)!;
        
        const returns1 = this.calculateReturns(data1);
        const returns2 = this.calculateReturns(data2);
        
        correlations[`${symbol1}-${symbol2}`] = this.calculateCorrelation(returns1, returns2);
      }
    }
    
    return correlations;
  }

  private predictCorrelationChanges(dataMap: Map<string, PriceData[]>, period: string): { [key: string]: number } {
    // Simple correlation prediction based on recent trends
    const symbols = Array.from(dataMap.keys());
    const predictedCorrelations: { [key: string]: number } = {};
    
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const symbol1 = symbols[i];
        const symbol2 = symbols[j];
        const data1 = dataMap.get(symbol1)!;
        const data2 = dataMap.get(symbol2)!;
        
        // Calculate recent correlation trend
        const recentCorrelation = this.calculateCorrelation(
          this.calculateReturns(data1.slice(-20)),
          this.calculateReturns(data2.slice(-20))
        );
        
        const historicalCorrelation = this.calculateCorrelation(
          this.calculateReturns(data1),
          this.calculateReturns(data2)
        );
        
        // Predict based on trend
        const trend = recentCorrelation - historicalCorrelation;
        predictedCorrelations[`${symbol1}-${symbol2}`] = recentCorrelation + trend * 0.5;
      }
    }
    
    return predictedCorrelations;
  }

  private calculateCorrelationConfidence(dataMap: Map<string, PriceData[]>): number {
    // Calculate confidence based on data quality and consistency
    const symbols = Array.from(dataMap.keys());
    let totalConfidence = 0;
    let pairCount = 0;
    
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const data1 = dataMap.get(symbols[i])!;
        const data2 = dataMap.get(symbols[j])!;
        
        // Confidence based on data length and consistency
        const dataQuality = Math.min(data1.length / 100, 1);
        const consistency = this.calculateConsistency(data1, data2);
        
        totalConfidence += dataQuality * consistency;
        pairCount++;
      }
    }
    
    return pairCount > 0 ? totalConfidence / pairCount : 0;
  }

  private analyzeMarketRegime(dataMap: Map<string, PriceData[]>): any {
    const symbols = Array.from(dataMap.keys());
    let totalTrend = 0;
    let totalVolatility = 0;
    let totalMomentum = 0;
    let totalVolume = 0;
    
    for (const symbol of symbols) {
      const data = dataMap.get(symbol)!;
      const indicators = this.calculateTechnicalIndicators(data);
      
      totalTrend += (indicators.ema20 - indicators.ema50) / indicators.ema50;
      totalVolatility += this.calculateVolatility(data);
      totalMomentum += this.calculateMomentumScore(indicators);
      totalVolume += data[data.length - 1].volume / data.reduce((sum, d) => sum + d.volume, 0) * data.length;
    }
    
    const avgTrend = totalTrend / symbols.length;
    const avgVolatility = totalVolatility / symbols.length;
    const avgMomentum = totalMomentum / symbols.length;
    const avgVolume = totalVolume / symbols.length;
    
    // Determine regime
    let regime: 'bull' | 'bear' | 'sideways' | 'volatile';
    let confidence: number;
    
    if (avgVolatility > 0.05) {
      regime = 'volatile';
      confidence = 0.8;
    } else if (avgTrend > 0.02) {
      regime = 'bull';
      confidence = 0.7;
    } else if (avgTrend < -0.02) {
      regime = 'bear';
      confidence = 0.7;
    } else {
      regime = 'sideways';
      confidence = 0.6;
    }
    
    return {
      type: regime,
      confidence,
      duration: 7, // days
      indicators: {
        trend: avgTrend,
        volatility: avgVolatility,
        momentum: avgMomentum,
        volume: avgVolume
      }
    };
  }

  private predictRegimeChange(dataMap: Map<string, PriceData[]>): any {
    // Simple regime change prediction
    const currentRegime = this.analyzeMarketRegime(dataMap);
    
    return {
      probability: 0.3, // 30% chance of regime change
      timeframe: '7d',
      newRegime: currentRegime.type === 'bull' ? 'bear' : 'bull'
    };
  }

  private calculateRiskMetrics(data: PriceData[], period: string): any {
    const returns = this.calculateReturns(data);
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length);
    
    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = data[0].close;
    for (const d of data) {
      if (d.close > peak) peak = d.close;
      const drawdown = (peak - d.close) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    // Calculate Sharpe ratio (simplified)
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;
    
    // Calculate VaR (95%)
    const sortedReturns = returns.sort((a, b) => a - b);
    const var95 = sortedReturns[Math.floor(sortedReturns.length * 0.05)];
    
    return {
      volatility,
      maxDrawdown,
      sharpeRatio,
      var95
    };
  }

  private assessForecastReliability(data: PriceData[], confidenceLevel: number): any {
    const dataQuality = Math.min(data.length / 100, 1);
    const modelStability = 0.7; // Real model stability would require historical validation
    const marketConditions = 0.8; // Real market conditions would require volatility analysis
    
    return {
      dataQuality,
      modelStability,
      marketConditions
    };
  }

  private calculateRiskScore(riskMetrics: any, reliability: any): number {
    const volatilityScore = Math.min(riskMetrics.volatility * 20, 1);
    const drawdownScore = Math.min(riskMetrics.maxDrawdown * 2, 1);
    const reliabilityScore = (reliability.dataQuality + reliability.modelStability + reliability.marketConditions) / 3;
    
    return (volatilityScore + drawdownScore) / 2 * (1 - reliabilityScore);
  }

  private getRiskLevel(riskScore: number): 'low' | 'medium' | 'high' {
    if (riskScore > 0.7) return 'high';
    if (riskScore > 0.4) return 'medium';
    return 'low';
  }

  private getRiskRecommendations(riskScore: number, riskMetrics: any): string[] {
    const recommendations: string[] = [];
    
    if (riskScore > 0.7) {
      recommendations.push('High risk detected - consider reducing position size');
      recommendations.push('Monitor closely for rapid price movements');
    }
    
    if (riskMetrics.volatility > 0.05) {
      recommendations.push('High volatility environment - use stop losses');
    }
    
    if (riskMetrics.maxDrawdown > 0.2) {
      recommendations.push('Significant drawdown risk - consider hedging');
    }
    
    return recommendations;
  }

  // Helper methods for technical calculations
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

  private calculateVolatility(data: PriceData[]): number {
    const returns = this.calculateReturns(data);
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private calculateReturns(data: PriceData[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < data.length; i++) {
      returns.push((data[i].close - data[i - 1].close) / data[i - 1].close);
    }
    return returns;
  }

  private calculateCorrelation(returns1: number[], returns2: number[]): number {
    if (returns1.length !== returns2.length || returns1.length === 0) return 0;
    
    const mean1 = returns1.reduce((sum, r) => sum + r, 0) / returns1.length;
    const mean2 = returns2.reduce((sum, r) => sum + r, 0) / returns2.length;
    
    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;
    
    for (let i = 0; i < returns1.length; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }
    
    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateConsistency(data1: PriceData[], data2: PriceData[]): number {
    // Calculate consistency based on data length and price correlation
    const lengthConsistency = Math.min(data1.length, data2.length) / Math.max(data1.length, data2.length);
    const priceCorrelation = this.calculateCorrelation(
      this.calculateReturns(data1),
      this.calculateReturns(data2)
    );
    
    return (lengthConsistency + Math.abs(priceCorrelation)) / 2;
  }

  private getPeriodHours(period: string): number {
    const periodMap: { [key: string]: number } = {
      '1h': 1,
      '4h': 4,
      '8h': 8,
      '24h': 24,
      '3d': 72,
      '7d': 168
    };
    return periodMap[period] || 24;
  }
}
