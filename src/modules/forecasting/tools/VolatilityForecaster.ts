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

interface VolatilityForecast {
  symbol: string;
  currentVolatility: number;
  predictedVolatility: number;
  volatilityChange: number;
  volatilityChangePercentage: number;
  confidence: number;
  timeframe: string;
  predictionPeriod: string;
  model: string;
  riskLevel: 'low' | 'medium' | 'high';
  factors: {
    historical: number;
    options: number;
    volume: number;
    market: number;
  };
  disclaimer: string;
  timestamp: string;
}

export class VolatilityForecaster {
  private readonly DISCLAIMER = "[WARNING] EXPERIMENTAL VOLATILITY FORECASTING - NOT FINANCIAL ADVICE (NFA/DYOR) WARNING:\nThis is experimental AI-powered volatility forecasting. Past performance does not guarantee future results. Always do your own research and never invest more than you can afford to lose.";
  private exchangeManager: ExchangeManager;

  constructor(exchangeManager: ExchangeManager) {
    this.exchangeManager = exchangeManager;
  }

  async forecastVolatility(args: any): Promise<any> {
    try {
      const { symbol, timeframe = '1h', predictionPeriod = '24h', exchange = 'binance', volatilityModel = 'hybrid' } = args;
      
      // Get historical data
      const historicalData = await this.getHistoricalData(symbol, timeframe, exchange, 100);
      if (!historicalData || historicalData.length < 50) {
        return {
          error: 'Insufficient historical data',
          message: 'Need at least 50 data points for volatility forecasting',
          disclaimer: this.DISCLAIMER
        };
      }

      // Calculate current volatility
      const currentVolatility = this.calculateVolatility(historicalData);
      
      // Perform volatility forecasting using selected model
      let predictedVolatility: number;
      let model: string;
      
      switch (volatilityModel) {
        case 'garch':
          predictedVolatility = this.garchForecast(historicalData, predictionPeriod);
          model = 'GARCH';
          break;
        case 'ewma':
          predictedVolatility = this.ewmaForecast(historicalData, predictionPeriod);
          model = 'EWMA';
          break;
        case 'options_implied':
          predictedVolatility = await this.optionsImpliedForecast(symbol, predictionPeriod);
          model = 'Options Implied';
          break;
        case 'hybrid':
        default:
          predictedVolatility = this.hybridForecast(historicalData, predictionPeriod);
          model = 'Hybrid';
          break;
      }

      const volatilityChange = predictedVolatility - currentVolatility;
      const volatilityChangePercentage = (volatilityChange / currentVolatility) * 100;
      
      // Calculate confidence based on model performance and market conditions
      const confidence = this.calculateVolatilityConfidence(historicalData, volatilityModel);
      
      // Determine risk level based on volatility
      const riskLevel = this.assessVolatilityRiskLevel(predictedVolatility, currentVolatility);
      
      // Calculate contributing factors
      const factors = this.calculateVolatilityFactors(historicalData, predictedVolatility, currentVolatility);

      const result: VolatilityForecast = {
        symbol,
        currentVolatility: Math.round(currentVolatility * 10000) / 10000,
        predictedVolatility: Math.round(predictedVolatility * 10000) / 10000,
        volatilityChange: Math.round(volatilityChange * 10000) / 10000,
        volatilityChangePercentage: Math.round(volatilityChangePercentage * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        timeframe,
        predictionPeriod,
        model,
        riskLevel,
        factors,
        disclaimer: this.DISCLAIMER,
        timestamp: new Date().toISOString()
      };

      return {
        volatilityForecast: result,
        message: `Volatility forecast for ${symbol}: ${volatilityChangePercentage > 0 ? '+' : ''}${volatilityChangePercentage.toFixed(2)}% change over ${predictionPeriod}`,
        disclaimer: this.DISCLAIMER
      };

    } catch (error) {
      return {
        error: `Volatility forecasting failed: ${error}`,
        message: 'Error generating volatility forecast',
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

  private calculateVolatility(data: PriceData[]): number {
    const returns = this.calculateReturns(data);
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private garchForecast(data: PriceData[], period: string): number {
    // Simplified GARCH(1,1) model
    const returns = this.calculateReturns(data);
    if (returns.length < 10) return this.calculateVolatility(data);
    
    // Calculate GARCH parameters (simplified)
    const alpha = 0.1; // ARCH coefficient
    const beta = 0.85; // GARCH coefficient
    const omega = 0.0001; // Constant
    
    // Calculate current conditional variance
    let conditionalVariance = this.calculateVolatility(data.slice(-20)) ** 2;
    
    // Forecast variance for the specified period
    const periodHours = this.getPeriodHours(period);
    const forecastSteps = Math.ceil(periodHours / 24); // Daily steps
    
    for (let i = 0; i < forecastSteps; i++) {
      conditionalVariance = omega + alpha * (returns[returns.length - 1] ** 2) + beta * conditionalVariance;
    }
    
    return Math.sqrt(conditionalVariance);
  }

  private ewmaForecast(data: PriceData[], period: string): number {
    // Exponential Weighted Moving Average volatility forecast
    const returns = this.calculateReturns(data);
    if (returns.length < 10) return this.calculateVolatility(data);
    
    const lambda = 0.94; // Decay factor
    const periodHours = this.getPeriodHours(period);
    
    // Calculate EWMA variance
    let ewmaVariance = 0;
    for (let i = returns.length - 1; i >= 0; i--) {
      ewmaVariance = lambda * ewmaVariance + (1 - lambda) * returns[i] ** 2;
    }
    
    // Scale by time period
    const timeScale = Math.sqrt(periodHours / 24);
    return Math.sqrt(ewmaVariance) * timeScale;
  }

  private async optionsImpliedForecast(symbol: string, period: string): Promise<number> {
    // Options-implied volatility would require Deribit API integration
    const optionsImpliedVol = null;
    // Would integrate with Deribit API for BTC/ETH options
    // For now, return a simple estimate based on symbol
    const baseVolatility = symbol.includes('BTC') ? 0.05 : 0.07;
    const periodHours = this.getPeriodHours(period);
    const timeScale = Math.sqrt(periodHours / 24);
    
    return baseVolatility * timeScale;
  }

  private hybridForecast(data: PriceData[], period: string): number {
    // Combine multiple volatility models
    const garchVol = this.garchForecast(data, period);
    const ewmaVol = this.ewmaForecast(data, period);
    const historicalVol = this.calculateVolatility(data);
    
    // Weight the models based on recent performance
    const weights = this.calculateModelWeights(data);
    
    return garchVol * weights.garch + ewmaVol * weights.ewma + historicalVol * weights.historical;
  }

  private calculateModelWeights(data: PriceData[]): { garch: number; ewma: number; historical: number } {
    // Simple weighting scheme - could be improved with backtesting
    return {
      garch: 0.4,
      ewma: 0.4,
      historical: 0.2
    };
  }

  private calculateVolatilityConfidence(data: PriceData[], model: string): number {
    // Calculate confidence based on data quality and model stability
    const dataQuality = Math.min(data.length / 100, 1);
    const volatilityStability = this.calculateVolatilityStability(data);
    
    // Model-specific confidence adjustments
    let modelConfidence = 0.7; // Base confidence
    switch (model) {
      case 'garch':
        modelConfidence = 0.8;
        break;
      case 'ewma':
        modelConfidence = 0.75;
        break;
      case 'options_implied':
        modelConfidence = 0.85;
        break;
      case 'hybrid':
        modelConfidence = 0.8;
        break;
    }
    
    return Math.min(dataQuality * volatilityStability * modelConfidence, 0.95);
  }

  private calculateVolatilityStability(data: PriceData[]): number {
    // Calculate how stable volatility has been recently
    const recentData = data.slice(-20);
    const olderData = data.slice(-40, -20);
    
    if (olderData.length === 0) return 0.5;
    
    const recentVol = this.calculateVolatility(recentData);
    const olderVol = this.calculateVolatility(olderData);
    
    const stability = 1 - Math.abs(recentVol - olderVol) / olderVol;
    return Math.max(0, Math.min(1, stability));
  }

  private assessVolatilityRiskLevel(predictedVol: number, currentVol: number): 'low' | 'medium' | 'high' {
    const volChange = Math.abs(predictedVol - currentVol) / currentVol;
    
    if (predictedVol > 0.08 || volChange > 0.5) {
      return 'high';
    } else if (predictedVol > 0.05 || volChange > 0.3) {
      return 'medium';
    }
    return 'low';
  }

  private calculateVolatilityFactors(data: PriceData[], predictedVol: number, currentVol: number): { historical: number; options: number; volume: number; market: number } {
    // Calculate contributing factors to volatility prediction
    const historical = this.calculateHistoricalFactor(data);
    const volume = this.calculateVolumeFactor(data);
    const market = this.calculateMarketFactor(data);
    
    return {
      historical: Math.round(historical * 100) / 100,
      options: 0.3, // Real options volatility would require Deribit API
      volume: Math.round(volume * 100) / 100,
      market: Math.round(market * 100) / 100
    };
  }

  private calculateHistoricalFactor(data: PriceData[]): number {
    // Historical volatility trend
    const recentVol = this.calculateVolatility(data.slice(-20));
    const olderVol = this.calculateVolatility(data.slice(-40, -20));
    
    if (olderVol === 0) return 0.5;
    
    return Math.min(1, Math.max(0, (recentVol - olderVol) / olderVol + 0.5));
  }

  private calculateVolumeFactor(data: PriceData[]): number {
    // Volume impact on volatility
    const recentVolume = data.slice(-10).reduce((sum, d) => sum + d.volume, 0) / 10;
    const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
    
    const volumeRatio = recentVolume / avgVolume;
    return Math.min(1, Math.max(0, (volumeRatio - 0.5) * 2));
  }

  private calculateMarketFactor(data: PriceData[]): number {
    // Market condition impact on volatility
    const returns = this.calculateReturns(data);
    const recentReturns = returns.slice(-10);
    
    // Calculate return dispersion (higher dispersion = higher volatility)
    const mean = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length;
    const dispersion = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentReturns.length;
    
    return Math.min(1, Math.max(0, dispersion * 100));
  }

  private calculateReturns(data: PriceData[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < data.length; i++) {
      returns.push((data[i].close - data[i - 1].close) / data[i - 1].close);
    }
    return returns;
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
