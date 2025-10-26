import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import { DataSourceManager } from './data/DataSourceManager.js';
import { IndicatorManager } from './indicators/IndicatorManager.js';

export class ChartModule extends BaseCryptoModule {
  name = 'chart';
  private dataSourceManager: DataSourceManager;
  private indicatorManager: IndicatorManager;

  constructor() {
    super();
    this.dataSourceManager = new DataSourceManager();
    this.indicatorManager = new IndicatorManager();
  }

  protected setupTools() {
    this.addTool({
      name: 'chart_get_ohlcv',
      description: 'Get OHLCV (Open, High, Low, Close, Volume) data for charting',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTCUSDT)'
          },
          interval: {
            type: 'string',
            description: 'Candlestick interval',
            enum: ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '3d', '1w', '1M'],
            default: '1h'
          },
          limit: {
            type: 'number',
            description: 'Number of candles to return',
            default: 1000
          },
          exchange: {
            type: 'string',
            description: 'Exchange to query',
            enum: ['binance', 'bybit', 'auto'],
            default: 'auto'
          }
        },
        required: ['symbol']
      },
      handler: this.getOHLCV.bind(this)
    });

    this.addTool({
      name: 'chart_get_technical_indicators',
      description: 'Calculate technical indicators for a trading pair',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTCUSDT)'
          },
          indicators: {
            type: 'object',
            description: 'Technical indicators to calculate with their parameters',
            properties: {
              sma: {
                type: 'array',
                items: { type: 'number' },
                description: 'Simple Moving Average periods (e.g., [20, 50, 200])'
              },
              ema: {
                type: 'array',
                items: { type: 'number' },
                description: 'Exponential Moving Average periods (e.g., [12, 26])'
              },
              rsi: {
                type: 'array',
                items: { type: 'number' },
                description: 'RSI periods (e.g., [14])'
              },
              vwap: {
                type: 'object',
                description: 'VWAP indicator (no parameters needed)'
              }
            }
          },
          interval: {
            type: 'string',
            description: 'Candlestick interval',
            enum: ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '3d', '1w'],
            default: '1h'
          },
          limit: {
            type: 'number',
            description: 'Number of candles to fetch',
            default: 200
          }
        },
        required: ['symbol']
      },
      handler: this.getTechnicalIndicators.bind(this)
    });

    this.addTool({
      name: 'chart_get_multi_timeframe_indicators',
      description: 'Calculate technical indicators across multiple timeframes for a symbol',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTCUSDT)'
          },
          timeframes: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '3d', '1w']
            },
            description: 'Timeframes to calculate indicators for',
            default: ['1h', '4h', '1d']
          },
          indicators: {
            type: 'object',
            description: 'Technical indicators to calculate',
            properties: {
              sma: {
                type: 'array',
                items: { type: 'number' },
                description: 'SMA periods'
              },
              ema: {
                type: 'array',
                items: { type: 'number' },
                description: 'EMA periods'
              },
              rsi: {
                type: 'array',
                items: { type: 'number' },
                description: 'RSI periods'
              },
              vwap: {
                type: 'object',
                description: 'VWAP indicator'
              },
              volumeVolatility: {
                type: 'object',
                properties: {
                  period: { type: 'number', description: 'Period for volume volatility calculation', default: 20 }
                },
                description: 'Volume volatility indicator'
              },
              percentile: {
                type: 'object',
                properties: {
                  metric: { type: 'string', enum: ['volume', 'price', 'high', 'low', 'close', 'range'], default: 'volume' },
                  period: { type: 'number', description: 'Period for percentile calculation', default: 1000 }
                },
                description: 'Percentile indicator'
              },
              marketHeat: {
                type: 'object',
                properties: {
                  period: { type: 'number', description: 'Period for heat calculation', default: 20 },
                  lookback: { type: 'number', description: 'Lookback period for overall heat', default: 100 }
                },
                description: 'Market heat indicator'
              }
            },
            default: { 
              sma: [20, 50], 
              ema: [12, 26], 
              rsi: [14], 
              vwap: {},
              volumeVolatility: { period: 20 },
              percentile: { metric: 'volume', period: 1000 },
              marketHeat: { period: 20, lookback: 100 }
            }
          },
          limit: {
            type: 'number',
            description: 'Number of candles to fetch per timeframe (defaults to 1000 for percentile analysis)',
            default: 1000
          }
        },
        required: ['symbol']
      },
      handler: this.getMultiTimeframeIndicators.bind(this)
    });

    this.addTool({
      name: 'chart_get_statistical_analysis',
      description: 'Calculate comprehensive statistical analysis across multiple timeframes',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTCUSDT)'
          },
          timeframes: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '3d', '1w']
            },
            description: 'Timeframes to analyze statistical metrics',
            default: ['1h', '4h', '1d']
          },
          period: {
            type: 'number',
            description: 'Period for statistical calculations',
            default: 20
          },
          lookback: {
            type: 'number',
            description: 'Lookback period for overall analysis',
            default: 100
          },
          limit: {
            type: 'number',
            description: 'Number of candles to fetch per timeframe (defaults to 1000 for percentile analysis)',
            default: 1000
          }
        },
        required: ['symbol']
      },
      handler: this.getStatisticalAnalysis.bind(this)
    });

    this.addTool({
      name: 'chart_get_support_resistance',
      description: 'Identify support and resistance levels',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTCUSDT)'
          },
          timeframe: {
            type: 'string',
            description: 'Timeframe for analysis',
            enum: ['1h', '4h', '1d', '1w'],
            default: '1d'
          },
          lookback: {
            type: 'number',
            description: 'Number of periods to look back',
            default: 100
          }
        },
        required: ['symbol']
      },
      handler: this.getSupportResistance.bind(this)
    });
  }

  private async getOHLCV(args: any) {
    try {
      const { symbol, interval, limit, exchange } = args;
      // Ensure limit is within reasonable bounds
      const safeLimit = Math.min(Math.max(limit || 1000, 1), 1000);
      
      const result = await this.dataSourceManager.fetchOHLCData(
        symbol,
        interval,
        safeLimit,
        3
      );

      return {
        symbol,
        interval,
        exchange: result.exchange,
        candles: result.data,
        count: result.data.length,
        message: `Successfully fetched ${result.data.length} candles for ${symbol} from ${result.exchange}`
      };
    } catch (error: any) {
      return {
        symbol: args.symbol,
        interval: args.interval,
        candles: [],
        error: error.message,
        message: `Failed to fetch OHLCV data: ${error.message}`
      };
    }
  }

  private async getTechnicalIndicators(args: any) {
    try {
      const { symbol, indicators, interval, limit } = args;
      // Ensure limit is within reasonable bounds
      const safeLimit = Math.min(Math.max(limit || 200, 1), 1000);
      
      // Fetch OHLC data
      const ohlcResult = await this.dataSourceManager.fetchOHLCData(
        symbol,
        interval,
        safeLimit,
        3
      );

      if (ohlcResult.data.length === 0) {
        return {
          symbol,
          indicators: {},
          error: 'No data available',
          message: `No OHLC data found for ${symbol}`
        };
      }

      // Calculate indicators
      const calculatedIndicators = await this.indicatorManager.calculateIndicators(
        ohlcResult.data,
        symbol,
        interval,
        indicators || this.indicatorManager.getDefaultIndicatorParams()
      );

      return {
        symbol,
        interval,
        exchange: ohlcResult.exchange,
        dataPoints: ohlcResult.data.length,
        indicators: calculatedIndicators,
        message: `Successfully calculated indicators for ${symbol} using ${ohlcResult.data.length} data points`
      };
    } catch (error: any) {
      return {
        symbol: args.symbol,
        indicators: {},
        error: error.message,
        message: `Failed to calculate technical indicators: ${error.message}`
      };
    }
  }

  private async getMultiTimeframeIndicators(args: any) {
    try {
      const { symbol, timeframes, indicators, limit } = args;
      // Ensure limit is within reasonable bounds
      const safeLimit = Math.min(Math.max(limit || 1000, 1), 1000);
      const results: any = {};

      // Process each timeframe
      for (const timeframe of timeframes) {
        try {
          // Fetch OHLC data for this timeframe
          const ohlcResult = await this.dataSourceManager.fetchOHLCData(
            symbol,
            timeframe,
            safeLimit,
            3
          );

          if (ohlcResult.data.length === 0) {
            results[timeframe] = {
              error: 'No data available',
              message: `No OHLC data found for ${symbol} on ${timeframe}`
            };
            continue;
          }

          // Calculate indicators for this timeframe
          const calculatedIndicators = await this.indicatorManager.calculateIndicators(
            ohlcResult.data,
            symbol,
            timeframe,
            indicators || this.indicatorManager.getDefaultIndicatorParams()
          );

          results[timeframe] = {
            exchange: ohlcResult.exchange,
            dataPoints: ohlcResult.data.length,
            indicators: calculatedIndicators,
            message: `Successfully calculated indicators for ${symbol} on ${timeframe}`
          };
        } catch (error: any) {
          results[timeframe] = {
            error: error.message,
            message: `Failed to calculate indicators for ${timeframe}: ${error.message}`
          };
        }
      }

      return {
        symbol,
        timeframes: results,
        message: `Multi-timeframe analysis completed for ${symbol}`
      };
    } catch (error: any) {
      return {
        symbol: args.symbol,
        timeframes: {},
        error: error.message,
        message: `Failed to perform multi-timeframe analysis: ${error.message}`
      };
    }
  }

  private async getStatisticalAnalysis(args: any) {
    try {
      const { symbol, timeframes, period, lookback, limit } = args;
      // Ensure limit is within reasonable bounds
      const safeLimit = Math.min(Math.max(limit || 1000, 1), 1000);
      const results: any = {};

      // Process each timeframe
      for (const timeframe of timeframes) {
        try {
          // Fetch OHLC data for this timeframe
          const ohlcResult = await this.dataSourceManager.fetchOHLCData(
            symbol,
            timeframe,
            safeLimit,
            3
          );

          if (ohlcResult.data.length === 0) {
            results[timeframe] = {
              error: 'No data available',
              message: `No OHLC data found for ${symbol} on ${timeframe}`
            };
            continue;
          }

          // Calculate statistical analysis indicators
          const statisticalIndicators = await this.indicatorManager.calculateIndicators(
            ohlcResult.data,
            symbol,
            timeframe,
            {
              volumeVolatility: { period },
              percentile: { metric: 'volume', period: Math.min(safeLimit, 1000) },
              marketHeat: { period, lookback }
            }
          );

          // Get the latest values
          const latestValues: any = {};
          for (const [indicatorName, indicatorData] of Object.entries(statisticalIndicators)) {
            if (Array.isArray(indicatorData) && indicatorData.length > 0) {
              const latest = indicatorData[indicatorData.length - 1];
              if (typeof latest === 'object' && latest !== null) {
                latestValues[indicatorName] = latest;
              } else {
                latestValues[indicatorName] = latest;
              }
            }
          }

          // Calculate statistical summary
          const statisticalSummary = this.calculateStatisticalSummary(latestValues);

          results[timeframe] = {
            exchange: ohlcResult.exchange,
            dataPoints: ohlcResult.data.length,
            indicators: statisticalIndicators,
            latestValues,
            statisticalSummary,
            message: `Statistical analysis completed for ${symbol} on ${timeframe}`
          };
        } catch (error: any) {
          results[timeframe] = {
            error: error.message,
            message: `Failed to calculate statistical analysis for ${timeframe}: ${error.message}`
          };
        }
      }

      // Calculate overall statistical score across timeframes
      const overallStatistical = this.calculateOverallStatisticalScore(results);

      return {
        symbol,
        timeframes: results,
        overallStatistical,
        message: `Comprehensive statistical analysis completed for ${symbol}`
      };
    } catch (error: any) {
      return {
        symbol: args.symbol,
        timeframes: {},
        error: error.message,
        message: `Failed to perform statistical analysis: ${error.message}`
      };
    }
  }

  private calculateStatisticalSummary(latestValues: any): any {
    const summary: any = {
      overallHeat: 0,
      volumeHeat: 0,
      priceHeat: 0,
      volatilityHeat: 0,
      trendHeat: 0,
      heatLevel: 'neutral',
      volumeVolatility: 0,
      volumePercentile: 0,
      volumeHeatScore: 0
    };

    // Extract heat scores
    if (latestValues.marketHeat) {
      summary.overallHeat = latestValues.marketHeat.overallHeat || 0;
      summary.volumeHeat = latestValues.marketHeat.volumeHeat || 0;
      summary.priceHeat = latestValues.marketHeat.priceHeat || 0;
      summary.volatilityHeat = latestValues.marketHeat.volatilityHeat || 0;
      summary.trendHeat = latestValues.marketHeat.trendHeat || 0;
    }

    // Extract volume volatility data
    if (latestValues.volumeVolatility) {
      summary.volumeVolatility = latestValues.volumeVolatility.values || 0;
      summary.volumePercentile = latestValues.volumeVolatility.percentile || 0;
      summary.volumeHeatScore = latestValues.volumeVolatility.heatScore || 0;
    }

    // Extract percentile data
    if (latestValues.percentile) {
      summary.percentileValue = latestValues.percentile.values || 0;
      summary.percentileMetric = latestValues.percentile.metric || 'volume';
    }

    // Determine heat level
    if (summary.overallHeat >= 80) {
      summary.heatLevel = 'extreme';
    } else if (summary.overallHeat >= 60) {
      summary.heatLevel = 'high';
    } else if (summary.overallHeat >= 40) {
      summary.heatLevel = 'moderate';
    } else if (summary.overallHeat >= 20) {
      summary.heatLevel = 'low';
    } else {
      summary.heatLevel = 'cold';
    }

    return summary;
  }

  private calculateOverallStatisticalScore(timeframeResults: any): any {
    const validTimeframes = Object.values(timeframeResults).filter((result: any) => 
      result.statisticalSummary && !result.error
    ) as any[];

    if (validTimeframes.length === 0) {
      return { overallHeat: 0, heatLevel: 'unknown', timeframes: 0 };
    }

    // Calculate weighted average based on timeframe importance
    const timeframeWeights: { [key: string]: number } = {
      '1m': 0.1, '5m': 0.15, '15m': 0.2, '30m': 0.25,
      '1h': 0.3, '2h': 0.25, '4h': 0.2, '6h': 0.15, '12h': 0.1,
      '1d': 0.4, '3d': 0.3, '1w': 0.2
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const result of validTimeframes) {
      const timeframe = Object.keys(timeframeResults).find(tf => 
        timeframeResults[tf] === result
      );
      const weight = timeframe ? timeframeWeights[timeframe] || 0.1 : 0.1;
      
      weightedSum += result.statisticalSummary.overallHeat * weight;
      totalWeight += weight;
    }

    const overallHeat = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Determine overall heat level
    let heatLevel = 'neutral';
    if (overallHeat >= 80) {
      heatLevel = 'extreme';
    } else if (overallHeat >= 60) {
      heatLevel = 'high';
    } else if (overallHeat >= 40) {
      heatLevel = 'moderate';
    } else if (overallHeat >= 20) {
      heatLevel = 'low';
    } else {
      heatLevel = 'cold';
    }

    return {
      overallHeat: Math.round(overallHeat * 100) / 100,
      heatLevel,
      timeframes: validTimeframes.length,
      analysis: `Market is ${heatLevel} with ${overallHeat.toFixed(1)} statistical score`
    };
  }

  private async getSupportResistance(args: any) {
    try {
      const { symbol, timeframe, lookback } = args;
      // Ensure lookback is within reasonable bounds
      const safeLookback = Math.min(Math.max(lookback || 100, 1), 1000);
      
      // Fetch OHLC data
      const ohlcResult = await this.dataSourceManager.fetchOHLCData(
        symbol,
        timeframe,
        safeLookback,
        3
      );

      if (ohlcResult.data.length === 0) {
        return {
          symbol,
          support: [],
          resistance: [],
          error: 'No data available',
          message: `No OHLC data found for ${symbol}`
        };
      }

      // Simple support/resistance calculation based on highs and lows
      const highs = ohlcResult.data.map(candle => candle.high);
      const lows = ohlcResult.data.map(candle => candle.low);
      
      // Find significant levels (simplified approach)
      const maxHigh = Math.max(...highs);
      const minLow = Math.min(...lows);
      const range = maxHigh - minLow;
      
      // Simple resistance levels (top 20% of range)
      const resistance = [
        maxHigh,
        maxHigh - (range * 0.1),
        maxHigh - (range * 0.2)
      ].filter(level => level > 0);

      // Simple support levels (bottom 20% of range)
      const support = [
        minLow,
        minLow + (range * 0.1),
        minLow + (range * 0.2)
      ].filter(level => level > 0);

      return {
        symbol,
        timeframe,
        exchange: ohlcResult.exchange,
        dataPoints: ohlcResult.data.length,
        support,
        resistance,
        priceRange: { high: maxHigh, low: minLow, range },
        message: `Support/resistance analysis completed for ${symbol} on ${timeframe}`
      };
    } catch (error: any) {
      return {
        symbol: args.symbol,
        support: [],
        resistance: [],
        error: error.message,
        message: `Failed to calculate support/resistance: ${error.message}`
      };
    }
  }
}
