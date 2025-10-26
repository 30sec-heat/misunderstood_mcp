import { ExchangeManager } from './ExchangeManager.js';
import { DeribitModule } from '../../deribit/index.js';
import { AnalysisModule } from '../../analysis/index.js';
import { NewsModule } from '../../news/index.js';

export interface ComprehensiveForecastResult {
  symbol: string;
  exchange: string;
  timeframe: string;
  predictionPeriod: string;
  currentPrice: number;
  timestamp: number;
  
  // Price Forecasting
  priceForecast: {
    predictedPrice: number;
    priceChange: number;
    priceChangePercentage: number;
    confidence: number;
    riskLevel: string;
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    methods: {
      technical: number;
      volume: number;
      volatility: number;
      options?: number;
    };
    weights: {
      technical: number;
      volume: number;
      volatility: number;
      options?: number;
    };
  };
  
  // Volatility Forecasting
  volatilityForecast: {
    currentVolatility: number;
    predictedVolatility: number;
    volatilityChange: number;
    volatilityChangePercentage: number;
    model: string;
    confidence: number;
    riskLevel: string;
    factors: {
      historical: number;
      implied?: number;
      momentum: number;
      regime: number;
    };
  };
  
  // Multi-Timeframe Analysis
  multiTimeframeAnalysis: {
    [timeframe: string]: {
      trend: string;
      momentum: number;
      strength: number;
      keyIndicators: {
        rsi: number;
        macd: number;
        ema: number;
        vwap: number;
      };
      supportResistance: {
        nearestSupport: number | null;
        nearestResistance: number | null;
      };
    };
  };
  
  // Comprehensive Technical Analysis
  technicalAnalysis: {
    indicators: any;
    priceAction: any;
    chartPatterns: any[];
    momentum: any;
    statistics: any;
    risk: any;
    volume: any;
    summary: any;
  };
  
  // Options Analysis (if available)
  optionsAnalysis?: {
    impliedVolatility: {
      current: number;
      percentile: number;
      skew: number;
      termStructure: any[];
    };
    putCallRatio: number;
    maxPain: number;
    gammaExposure: number;
    openInterest: {
      calls: number;
      puts: number;
      ratio: number;
    };
    greeks: {
      totalDelta: number;
      totalGamma: number;
      totalTheta: number;
      totalVega: number;
    };
    expirationAnalysis: any[];
  };
  
  // News & Fundamental Analysis
  fundamentalAnalysis: {
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    sentimentScore: number;
    newsCount: number;
    keyTopics: string[];
    recentNews: Array<{
      title: string;
      summary: string;
      sentiment: string;
      impact: 'HIGH' | 'MEDIUM' | 'LOW';
      publishedAt: string;
      source: string;
    }>;
    marketMomentum: {
      bullishSignals: number;
      bearishSignals: number;
      neutralSignals: number;
      overallMomentum: string;
    };
  };
  
  // Comprehensive Summary
  overallForecast: {
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: number;
    timeHorizon: string;
    keyFactors: string[];
    riskFactors: string[];
    targetPrice?: number;
    stopLoss?: number;
    probabilityDistribution: {
      bullish: number;
      neutral: number;
      bearish: number;
    };
  };
  
  // Disclaimers and Metadata
  metadata: {
    analysisTime: number;
    dataQuality: string;
    modelVersion: string;
    disclaimer: string;
  };
}

export class ComprehensiveForecastTool {
  private readonly DISCLAIMER = 
    "[WARNING] EXPERIMENTAL FORECAST - NOT FINANCIAL ADVICE (NFA) - DO YOUR OWN RESEARCH (DYOR). " +
    "This is experimental forecasting technology and should not be used as the sole basis for trading decisions.";

  private exchangeManager: ExchangeManager;
  private deribitModule: DeribitModule | null = null;
  private analysisModule: AnalysisModule | null = null;
  private newsModule: NewsModule | null = null;

  constructor(
    exchangeManager: ExchangeManager,
    deribitModule?: DeribitModule,
    analysisModule?: AnalysisModule,
    newsModule?: NewsModule
  ) {
    this.exchangeManager = exchangeManager;
    this.deribitModule = deribitModule || null;
    this.analysisModule = analysisModule || null;
    this.newsModule = newsModule || null;
  }

  async performComprehensiveForecast(args: any): Promise<ComprehensiveForecastResult | { error: string; message: string }> {
    try {
      const { 
        symbol, 
        timeframe = '1h', 
        predictionPeriod = '24h', 
        exchange = 'binance',
        includeOptions = true,
        includeNews = true,
        confidenceLevel = 0.7
      } = args;

      if (!symbol) {
        return {
          error: 'Missing symbol parameter',
          message: 'Symbol parameter is required for comprehensive forecasting'
        };
      }

      const startTime = Date.now();
      
      // Determine timeframes to analyze based on prediction period
      const timeframes = this.getRelevantTimeframes(timeframe, predictionPeriod);
      
      // Parallel execution of all analysis components
      const [
        comprehensiveAnalysis,
        multiTimeframeData,
        optionsData,
        newsData,
        priceForecasts,
        volatilityForecast
      ] = await Promise.allSettled([
        this.getComprehensiveAnalysis(symbol, timeframe, exchange),
        this.getMultiTimeframeAnalysis(symbol, timeframes, exchange),
        includeOptions ? this.getOptionsAnalysis(symbol) : Promise.resolve(null),
        includeNews ? this.getNewsAnalysis(symbol) : Promise.resolve(null),
        this.generatePriceForecasts(symbol, timeframe, predictionPeriod, exchange, confidenceLevel),
        this.generateVolatilityForecast(symbol, timeframe, predictionPeriod, exchange)
      ]);

      // Extract results from settled promises
      const analysis = comprehensiveAnalysis.status === 'fulfilled' ? comprehensiveAnalysis.value : null;
      const multiTF = multiTimeframeData.status === 'fulfilled' ? multiTimeframeData.value : {};
      const options = optionsData.status === 'fulfilled' ? optionsData.value : null;
      const news = newsData.status === 'fulfilled' ? newsData.value : null;
      const priceForecast = priceForecasts.status === 'fulfilled' ? priceForecasts.value : null;
      const volForecast = volatilityForecast.status === 'fulfilled' ? volatilityForecast.value : null;

      if (!analysis || !priceForecast || !volForecast) {
        return {
          error: 'Insufficient data for comprehensive forecast',
          message: 'Unable to gather required analysis data'
        };
      }

      const currentPrice = analysis.currentPrice;
      
      // Combine all forecasting methods with enhanced weighting
      const combinedPriceForecast = this.combinePriceForecasts(
        priceForecast, 
        analysis, 
        options, 
        news,
        multiTF
      );

      // Generate comprehensive result
      const result: ComprehensiveForecastResult = {
        symbol,
        exchange,
        timeframe,
        predictionPeriod,
        currentPrice,
        timestamp: Date.now(),
        
        priceForecast: combinedPriceForecast,
        
        volatilityForecast: {
          currentVolatility: volForecast.currentVolatility,
          predictedVolatility: volForecast.predictedVolatility,
          volatilityChange: volForecast.volatilityChange,
          volatilityChangePercentage: volForecast.volatilityChangePercentage,
          model: volForecast.model,
          confidence: volForecast.confidence,
          riskLevel: volForecast.riskLevel,
          factors: volForecast.factors || {
            historical: 0.4,
            momentum: 0.3,
            regime: 0.3
          }
        },
        
        multiTimeframeAnalysis: multiTF,
        
        technicalAnalysis: {
          indicators: analysis.technicalIndicators,
          priceAction: analysis.priceAction,
          chartPatterns: analysis.chartPatterns,
          momentum: analysis.momentum,
          statistics: analysis.statistics,
          risk: analysis.risk,
          volume: analysis.volume,
          summary: analysis.summary
        },
        
        optionsAnalysis: options ? this.formatOptionsAnalysis(options) : undefined,
        
        fundamentalAnalysis: news ? this.formatNewsAnalysis(news, symbol) : {
          sentiment: 'NEUTRAL',
          sentimentScore: 0,
          newsCount: 0,
          keyTopics: [],
          recentNews: [],
          marketMomentum: {
            bullishSignals: 0,
            bearishSignals: 0,
            neutralSignals: 0,
            overallMomentum: 'NEUTRAL'
          }
        },
        
        overallForecast: this.generateOverallForecast(
          combinedPriceForecast,
          volForecast,
          analysis,
          options,
          news,
          multiTF,
          predictionPeriod
        ),
        
        metadata: {
          analysisTime: Date.now() - startTime,
          dataQuality: this.assessDataQuality(analysis, options, news),
          modelVersion: '2.0.0',
          disclaimer: this.DISCLAIMER
        }
      };

      return result;

    } catch (error) {
      return {
        error: 'Comprehensive forecast failed',
        message: `Error performing comprehensive forecast: ${error}`
      };
    }
  }

  private getRelevantTimeframes(baseTimeframe: string, predictionPeriod: string): string[] {
    const timeframeHierarchy = ['5m', '15m', '1h', '4h', '1d'];
    const baseIndex = timeframeHierarchy.indexOf(baseTimeframe);
    
    // Include lower timeframes for short-term trends and higher for long-term context
    const timeframes = [baseTimeframe];
    
    // Add lower timeframe for short-term signals
    if (baseIndex > 0) {
      timeframes.push(timeframeHierarchy[baseIndex - 1]);
    }
    
    // Add higher timeframe for context
    if (baseIndex < timeframeHierarchy.length - 1) {
      timeframes.push(timeframeHierarchy[baseIndex + 1]);
    }
    
    // For longer prediction periods, add daily timeframe
    if (['3d', '7d'].includes(predictionPeriod) && !timeframes.includes('1d')) {
      timeframes.push('1d');
    }
    
    return timeframes;
  }

  private async getComprehensiveAnalysis(symbol: string, timeframe: string, exchange: string) {
    if (!this.analysisModule) {
      throw new Error('Analysis module not available');
    }
    
    // Use the comprehensive analysis tool from the analysis module
    const analysisTools = (this.analysisModule as any).tools;
    const comprehensiveTool = analysisTools.find((tool: any) => tool.name === 'analysis_comprehensive');
    
    if (!comprehensiveTool) {
      throw new Error('Comprehensive analysis tool not found');
    }
    
    return await comprehensiveTool.handler({
      symbol,
      timeframe,
      exchange,
      limit: 1000,
      includeMicrostructure: true
    });
  }

  private async getMultiTimeframeAnalysis(symbol: string, timeframes: string[], exchange: string) {
    const results: any = {};
    
    // Analyze each timeframe in parallel
    const promises = timeframes.map(async (tf) => {
      try {
        if (!this.analysisModule) return null;
        
        const analysisTools = (this.analysisModule as any).tools;
        const comprehensiveTool = analysisTools.find((tool: any) => tool.name === 'analysis_comprehensive');
        
        if (!comprehensiveTool) return null;
        
        const analysis = await comprehensiveTool.handler({
          symbol,
          timeframe: tf,
          exchange,
          limit: 500
        });
        
        return {
          timeframe: tf,
          analysis
        };
      } catch (error) {
        console.warn(`Multi-timeframe analysis failed for ${tf}:`, error);
        return null;
      }
    });
    
    const settled = await Promise.allSettled(promises);
    
    settled.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        const { timeframe, analysis } = result.value;
        results[timeframe] = {
          trend: analysis.priceAction?.trend?.direction || 'NEUTRAL',
          momentum: analysis.momentum?.score || 0,
          strength: analysis.priceAction?.trend?.strength || 0,
          keyIndicators: {
            rsi: analysis.technicalIndicators?.rsi?.rsi14 || 50,
            macd: analysis.technicalIndicators?.macd?.macd || 0,
            ema: analysis.technicalIndicators?.ema?.ema20 || analysis.currentPrice,
            vwap: analysis.technicalIndicators?.vwap || analysis.currentPrice
          },
          supportResistance: {
            nearestSupport: analysis.priceAction?.nearestSupport || null,
            nearestResistance: analysis.priceAction?.nearestResistance || null
          }
        };
      }
    });
    
    return results;
  }

  private async getOptionsAnalysis(symbol: string) {
    if (!this.deribitModule) {
      return null;
    }
    
    try {
      // Get the currency from symbol (BTC or ETH)
      const currency = symbol.toUpperCase().includes('BTC') ? 'BTC' : 
                     symbol.toUpperCase().includes('ETH') ? 'ETH' : null;
      
      if (!currency) {
        return null;
      }
      
      const deribitTools = (this.deribitModule as any).tools;
      
      // Get multiple options analyses in parallel
      const [ivAnalysis, optionChain, riskMetrics] = await Promise.allSettled([
        this.callDeribitTool(deribitTools, 'deribit_analyze_iv', { currency }),
        this.callDeribitTool(deribitTools, 'deribit_get_option_chain', { currency, include_greeks: true }),
        this.callDeribitTool(deribitTools, 'deribit_calculate_risk_metrics', { 
          currency, 
          portfolio_strikes: [50000, 55000, 60000], // Example strikes
          portfolio_quantities: [1, -2, 1] // Example butterfly
        })
      ]);
      
      return {
        iv: ivAnalysis.status === 'fulfilled' ? ivAnalysis.value : null,
        chain: optionChain.status === 'fulfilled' ? optionChain.value : null,
        risk: riskMetrics.status === 'fulfilled' ? riskMetrics.value : null
      };
    } catch (error) {
      console.warn('Options analysis failed:', error);
      return null;
    }
  }

  private async callDeribitTool(tools: any[], toolName: string, args: any) {
    const tool = tools.find((t: any) => t.name === toolName);
    if (!tool) {
      throw new Error(`Deribit tool ${toolName} not found`);
    }
    return await tool.handler(args);
  }

  private async getNewsAnalysis(symbol: string) {
    if (!this.newsModule) {
      return null;
    }
    
    try {
      const newsTools = (this.newsModule as any).tools;
      const newsTool = newsTools.find((tool: any) => tool.name === 'news_get_tradfi_latest');
      
      if (!newsTool) {
        return null;
      }
      
      return await newsTool.handler({
        limit: 50,
        category: 'crypto',
        sources: []
      });
    } catch (error) {
      console.warn('News analysis failed:', error);
      return null;
    }
  }

  private async generatePriceForecasts(
    symbol: string, 
    timeframe: string, 
    predictionPeriod: string, 
    exchange: string,
    confidenceLevel: number
  ) {
    // This would call the existing price forecasting methods
    // For now, return a mock structure that matches the expected format
    return {
      predictedPrice: 0,
      priceChange: 0,
      priceChangePercentage: 0,
      confidence: confidenceLevel,
      riskLevel: 'MEDIUM',
      direction: 'NEUTRAL' as const,
      methods: {
        technical: 0,
        volume: 0,
        volatility: 0
      },
      weights: {
        technical: 0.4,
        volume: 0.3,
        volatility: 0.3
      }
    };
  }

  private async generateVolatilityForecast(
    symbol: string, 
    timeframe: string, 
    predictionPeriod: string, 
    exchange: string
  ) {
    // This would call the existing volatility forecasting methods
    return {
      currentVolatility: 0,
      predictedVolatility: 0,
      volatilityChange: 0,
      volatilityChangePercentage: 0,
      model: 'hybrid',
      confidence: 0.7,
      riskLevel: 'MEDIUM',
      factors: {
        historical: 0.4,
        momentum: 0.3,
        regime: 0.3
      }
    };
  }

  private combinePriceForecasts(
    baseForecast: any,
    analysis: any,
    options: any,
    news: any,
    multiTF: any
  ) {
    // Enhanced price forecast combination logic
    const currentPrice = analysis.currentPrice;
    
    // Base technical forecast
    let predictedPrice = currentPrice;
    let confidence = baseForecast.confidence;
    
    // Adjust based on technical indicators
    const rsi = analysis.technicalIndicators?.rsi?.rsi14 || 50;
    const macd = analysis.technicalIndicators?.macd?.histogram || 0;
    const trend = analysis.priceAction?.trend?.direction || 'NEUTRAL';
    
    // Technical adjustment
    let technicalAdjustment = 0;
    if (rsi > 70) technicalAdjustment -= 0.02; // Overbought
    if (rsi < 30) technicalAdjustment += 0.02; // Oversold
    if (macd > 0) technicalAdjustment += 0.01; // Bullish MACD
    if (macd < 0) technicalAdjustment -= 0.01; // Bearish MACD
    
    // Multi-timeframe confirmation
    let mtfConfirmation = 0;
    Object.values(multiTF).forEach((tf: any) => {
      if (tf.trend === 'BULLISH') mtfConfirmation += 0.01;
      if (tf.trend === 'BEARISH') mtfConfirmation -= 0.01;
    });
    
    // Options adjustment (if available)
    let optionsAdjustment = 0;
    if (options?.iv) {
      // High IV might suggest upcoming volatility
      if (options.iv.current > options.iv.percentile) {
        optionsAdjustment += 0.005;
      }
    }
    
    // News sentiment adjustment
    let newsAdjustment = 0;
    if (news?.sentiment === 'POSITIVE') newsAdjustment += 0.01;
    if (news?.sentiment === 'NEGATIVE') newsAdjustment -= 0.01;
    
    // Combine adjustments
    const totalAdjustment = technicalAdjustment + mtfConfirmation + optionsAdjustment + newsAdjustment;
    predictedPrice = currentPrice * (1 + totalAdjustment);
    
    const priceChange = predictedPrice - currentPrice;
    const priceChangePercentage = (priceChange / currentPrice) * 100;
    
    // Determine direction
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (Math.abs(priceChangePercentage) > 1) {
      direction = priceChangePercentage > 0 ? 'BULLISH' : 'BEARISH';
    }
    
    return {
      predictedPrice,
      priceChange,
      priceChangePercentage,
      confidence,
      riskLevel: this.assessRiskLevel(Math.abs(priceChangePercentage), confidence),
      direction,
      methods: {
        technical: currentPrice * (1 + technicalAdjustment),
        volume: currentPrice * (1 + (analysis.volume?.percentileRank || 50) / 1000),
        volatility: currentPrice * (1 + (analysis.statistics?.volatility || 0.02)),
        options: options ? currentPrice * (1 + optionsAdjustment) : undefined
      },
      weights: {
        technical: 0.4,
        volume: 0.2,
        volatility: 0.2,
        options: options ? 0.2 : undefined
      }
    };
  }

  private formatOptionsAnalysis(options: any) {
    return {
      impliedVolatility: {
        current: options.iv?.current_iv || 0,
        percentile: options.iv?.iv_percentile || 50,
        skew: options.iv?.skew || 0,
        termStructure: options.iv?.term_structure || []
      },
      putCallRatio: options.chain?.put_call_ratio || 1,
      maxPain: options.chain?.max_pain || 0,
      gammaExposure: options.chain?.gamma_exposure || 0,
      openInterest: {
        calls: options.chain?.total_call_oi || 0,
        puts: options.chain?.total_put_oi || 0,
        ratio: options.chain?.oi_ratio || 1
      },
      greeks: {
        totalDelta: options.chain?.total_delta || 0,
        totalGamma: options.chain?.total_gamma || 0,
        totalTheta: options.chain?.total_theta || 0,
        totalVega: options.chain?.total_vega || 0
      },
      expirationAnalysis: options.chain?.expiration_analysis || []
    };
  }

  private formatNewsAnalysis(news: any, symbol: string) {
    const articles = news.articles || [];
    
    // Simple sentiment analysis
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;
    
    const recentNews = articles.slice(0, 10).map((article: any) => {
      const sentiment = this.analyzeSentiment(article.title + ' ' + (article.summary || ''));
      
      if (sentiment === 'POSITIVE') positiveCount++;
      else if (sentiment === 'NEGATIVE') negativeCount++;
      else neutralCount++;
      
      return {
        title: article.title,
        summary: article.summary || article.description || '',
        sentiment,
        impact: this.assessNewsImpact(article, symbol),
        publishedAt: article.publishedAt || article.pubDate,
        source: article.source || 'Unknown'
      };
    });
    
    const totalArticles = positiveCount + negativeCount + neutralCount;
    const sentimentScore = totalArticles > 0 ? 
      (positiveCount - negativeCount) / totalArticles : 0;
    
    let overallSentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = 'NEUTRAL';
    if (sentimentScore > 0.2) overallSentiment = 'POSITIVE';
    else if (sentimentScore < -0.2) overallSentiment = 'NEGATIVE';
    
    return {
      sentiment: overallSentiment,
      sentimentScore,
      newsCount: articles.length,
      keyTopics: this.extractKeyTopics(articles),
      recentNews,
      marketMomentum: {
        bullishSignals: positiveCount,
        bearishSignals: negativeCount,
        neutralSignals: neutralCount,
        overallMomentum: overallSentiment
      }
    };
  }

  private analyzeSentiment(text: string): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
    const positiveWords = ['bullish', 'surge', 'rally', 'gains', 'up', 'rise', 'positive', 'growth', 'bull'];
    const negativeWords = ['bearish', 'crash', 'drop', 'fall', 'down', 'decline', 'negative', 'bear', 'sell'];
    
    const lowerText = text.toLowerCase();
    const positiveMatches = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeMatches = negativeWords.filter(word => lowerText.includes(word)).length;
    
    if (positiveMatches > negativeMatches) return 'POSITIVE';
    if (negativeMatches > positiveMatches) return 'NEGATIVE';
    return 'NEUTRAL';
  }

  private assessNewsImpact(article: any, symbol: string): 'HIGH' | 'MEDIUM' | 'LOW' {
    const title = (article.title || '').toLowerCase();
    const symbolBase = symbol.replace('USDT', '').replace('USD', '').toLowerCase();
    
    if (title.includes(symbolBase)) return 'HIGH';
    if (title.includes('crypto') || title.includes('bitcoin') || title.includes('ethereum')) return 'MEDIUM';
    return 'LOW';
  }

  private extractKeyTopics(articles: any[]): string[] {
    const topics = new Map<string, number>();
    const keywords = ['bitcoin', 'ethereum', 'crypto', 'defi', 'nft', 'regulation', 'adoption', 'institutional'];
    
    articles.forEach(article => {
      const text = ((article.title || '') + ' ' + (article.summary || '')).toLowerCase();
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          topics.set(keyword, (topics.get(keyword) || 0) + 1);
        }
      });
    });
    
    return Array.from(topics.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);
  }

  private generateOverallForecast(
    priceForecast: any,
    volForecast: any,
    analysis: any,
    options: any,
    news: any,
    multiTF: any,
    predictionPeriod: string
  ) {
    // Combine all signals for overall forecast
    const signals = [];
    
    // Price forecast signal
    if (Math.abs(priceForecast.priceChangePercentage) > 2) {
      signals.push({
        type: priceForecast.direction,
        weight: priceForecast.confidence,
        source: 'price_forecast'
      });
    }
    
    // Technical analysis signals
    const rsi = analysis.technicalIndicators?.rsi?.rsi14 || 50;
    if (rsi > 70) signals.push({ type: 'BEARISH', weight: 0.6, source: 'rsi_overbought' });
    if (rsi < 30) signals.push({ type: 'BULLISH', weight: 0.6, source: 'rsi_oversold' });
    
    // Multi-timeframe confirmation
    const bullishTF = Object.values(multiTF).filter((tf: any) => tf.trend === 'BULLISH').length;
    const bearishTF = Object.values(multiTF).filter((tf: any) => tf.trend === 'BEARISH').length;
    
    if (bullishTF > bearishTF) {
      signals.push({ type: 'BULLISH', weight: 0.7, source: 'multi_timeframe' });
    } else if (bearishTF > bullishTF) {
      signals.push({ type: 'BEARISH', weight: 0.7, source: 'multi_timeframe' });
    }
    
    // News sentiment
    if (news?.sentiment === 'POSITIVE') {
      signals.push({ type: 'BULLISH', weight: 0.5, source: 'news_sentiment' });
    } else if (news?.sentiment === 'NEGATIVE') {
      signals.push({ type: 'BEARISH', weight: 0.5, source: 'news_sentiment' });
    }
    
    // Calculate weighted direction
    let bullishWeight = 0;
    let bearishWeight = 0;
    
    signals.forEach(signal => {
      if (signal.type === 'BULLISH') bullishWeight += signal.weight;
      if (signal.type === 'BEARISH') bearishWeight += signal.weight;
    });
    
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 0.5;
    
    if (bullishWeight > bearishWeight + 0.5) {
      direction = 'BULLISH';
      confidence = Math.min(0.9, 0.5 + (bullishWeight - bearishWeight) / 4);
    } else if (bearishWeight > bullishWeight + 0.5) {
      direction = 'BEARISH';
      confidence = Math.min(0.9, 0.5 + (bearishWeight - bullishWeight) / 4);
    }
    
    // Key factors and risks
    const keyFactors = signals.map(s => s.source);
    const riskFactors = [];
    
    if (volForecast.predictedVolatility > volForecast.currentVolatility * 1.2) {
      riskFactors.push('Increased volatility expected');
    }
    if (options?.impliedVolatility?.current > options?.impliedVolatility?.percentile) {
      riskFactors.push('High implied volatility');
    }
    if (analysis.risk?.var95 && Math.abs(analysis.risk.var95) > 0.05) {
      riskFactors.push('High VaR indicates significant downside risk');
    }
    
    return {
      direction,
      confidence,
      timeHorizon: predictionPeriod,
      keyFactors: keyFactors.slice(0, 5),
      riskFactors: riskFactors.slice(0, 3),
      targetPrice: direction !== 'NEUTRAL' ? priceForecast.predictedPrice : undefined,
      stopLoss: direction === 'BULLISH' ? 
        analysis.priceAction?.nearestSupport : 
        analysis.priceAction?.nearestResistance,
      probabilityDistribution: {
        bullish: Math.round((bullishWeight / (bullishWeight + bearishWeight + 1)) * 100),
        neutral: Math.round((1 / (bullishWeight + bearishWeight + 1)) * 100),
        bearish: Math.round((bearishWeight / (bullishWeight + bearishWeight + 1)) * 100)
      }
    };
  }

  private assessRiskLevel(priceChangePercentage: number, confidence: number): string {
    if (priceChangePercentage > 5 || confidence < 0.5) return 'HIGH';
    if (priceChangePercentage > 2 || confidence < 0.7) return 'MEDIUM';
    return 'LOW';
  }

  private assessDataQuality(analysis: any, options: any, news: any): string {
    let score = 0;
    
    if (analysis && analysis.dataPoints > 500) score += 30;
    else if (analysis && analysis.dataPoints > 100) score += 20;
    
    if (options) score += 25;
    if (news && news.articles && news.articles.length > 10) score += 25;
    else if (news && news.articles && news.articles.length > 0) score += 15;
    
    if (analysis?.technicalIndicators) score += 20;
    
    if (score >= 80) return 'HIGH';
    if (score >= 60) return 'MEDIUM';
    return 'LOW';
  }
}
