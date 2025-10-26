import { LiquidationPostgresDatabase, LiquidationStats } from '../postgres-database.js';

export interface LiquidationAnalysisResult {
  symbol: string;
  exchange: string;
  totalLiquidations: number;
  totalNotionalValue: number;
  longLiquidations: number;
  shortLiquidations: number;
  largestLiquidation: number;
  averageLiquidationSize: number;
  liquidationRate: number; // liquidations per hour
  timeframe: string;
  periodStart: string;
  periodEnd: string;
}

export interface OpenInterestAnalysisResult {
  symbol: string;
  exchange: string;
  currentOpenInterest: number;
  previousOpenInterest: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface MarketLiquidationSummary {
  symbol: string;
  totalLiquidations: number;
  totalNotionalValue: number;
  longLiquidations: number;
  shortLiquidations: number;
  largestLiquidation: number;
  averageLiquidationSize: number;
  liquidationRate: number;
  dominantSide: 'long' | 'short' | 'balanced';
  riskLevel: 'low' | 'medium' | 'high';
}

export class LiquidationAnalysisTool {
  private db: LiquidationPostgresDatabase;

  constructor(db: LiquidationPostgresDatabase) {
    this.db = db;
  }

  async getLiquidationAnalysis(
    symbol?: string,
    exchange?: string,
    timeframe: string = '1h',
    minUsdValue?: number
  ): Promise<LiquidationAnalysisResult[]> {
    const stats = await this.db.getLiquidationStats(symbol, exchange, timeframe, minUsdValue);
    
    return stats.map(stat => ({
      symbol: stat.symbol,
      exchange: stat.exchange,
      totalLiquidations: stat.total_liquidations,
      totalNotionalValue: stat.total_notional,
      longLiquidations: stat.long_liquidations,
      shortLiquidations: stat.short_liquidations,
      largestLiquidation: stat.largest_liquidation,
      averageLiquidationSize: stat.total_notional / stat.total_liquidations,
      liquidationRate: this.calculateLiquidationRate(stat.total_liquidations, timeframe),
      timeframe: stat.timeframe,
      periodStart: stat.period_start,
      periodEnd: stat.period_end
    }));
  }

  async getMostLiquidatedCoins(timeframe: string = '1h', limit: number = 10, minUsdValue?: number): Promise<MarketLiquidationSummary[]> {
    const stats = await this.db.getMostLiquidatedCoins(timeframe, limit, minUsdValue);
    
    return stats.map(stat => {
      const dominantSide = this.determineDominantSide(stat.long_liquidations, stat.short_liquidations);
      const riskLevel = this.assessRiskLevel(stat.total_notional, stat.largest_liquidation, stat.total_liquidations);
      
      return {
        symbol: stat.symbol,
        totalLiquidations: stat.total_liquidations,
        totalNotionalValue: stat.total_notional,
        longLiquidations: stat.long_liquidations,
        shortLiquidations: stat.short_liquidations,
        largestLiquidation: stat.largest_liquidation,
        averageLiquidationSize: stat.total_notional / stat.total_liquidations,
        liquidationRate: this.calculateLiquidationRate(stat.total_liquidations, timeframe),
        dominantSide,
        riskLevel
      };
    });
  }

  async getOpenInterestAnalysis(symbol: string, exchange?: string): Promise<OpenInterestAnalysisResult[]> {
    const currentData = await this.db.getCurrentOpenInterest(symbol, exchange);
    const historyData = await this.db.getOpenInterestHistory(symbol, exchange, '1h');
    
    if (!currentData || historyData.length < 2) {
      return [];
    }

    const previousData = historyData[1]; // Second most recent
    
    const change = currentData.value - previousData.value;
    const changePercent = (change / previousData.value) * 100;
    
    return [{
      symbol: currentData.symbol,
      exchange: currentData.exchange,
      currentOpenInterest: currentData.value,
      previousOpenInterest: previousData.value,
      change,
      changePercent,
      timestamp: currentData.timestamp
    }];
  }

  async getLiquidationTrends(symbol: string, timeframe: string = '1h', periods: number = 24, minUsdValue?: number): Promise<{
    period: string;
    liquidations: number;
    notionalValue: number;
    longLiquidations: number;
    shortLiquidations: number;
  }[]> {
    const liquidations = await this.db.getLiquidationsBySymbol(symbol, timeframe, undefined, minUsdValue);
    
    // Group liquidations by time periods
    const periodGroups = new Map<string, {
      liquidations: number;
      notionalValue: number;
      longLiquidations: number;
      shortLiquidations: number;
    }>();
    
    liquidations.forEach(liquidation => {
      const period = this.getTimePeriod(liquidation.timestamp, timeframe);
      
      if (!periodGroups.has(period)) {
        periodGroups.set(period, {
          liquidations: 0,
          notionalValue: 0,
          longLiquidations: 0,
          shortLiquidations: 0
        });
      }
      
      const group = periodGroups.get(period)!;
      group.liquidations++;
      group.notionalValue += liquidation.notional_value;
      
      if (liquidation.side === 'long') {
        group.longLiquidations++;
      } else {
        group.shortLiquidations++;
      }
    });
    
    return Array.from(periodGroups.entries())
      .map(([period, data]) => ({
        period,
        ...data
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-periods);
  }

  async getLiquidationAlerts(threshold: number = 1000000, minUsdValue?: number): Promise<LiquidationStats[]> {
    const stats = await this.db.getLiquidationStats(undefined, undefined, '15m', minUsdValue);
    
    return stats.filter(stat => 
      stat.total_notional >= threshold || 
      stat.largest_liquidation >= threshold / 10
    );
  }

  async getExchangeComparison(timeframe: string = '1h', minUsdValue?: number): Promise<{
    exchange: string;
    totalLiquidations: number;
    totalNotionalValue: number;
    averageLiquidationSize: number;
    marketShare: number;
  }[]> {
    const stats = await this.db.getLiquidationStats(undefined, undefined, timeframe, minUsdValue);
    
    const exchangeGroups = new Map<string, {
      totalLiquidations: number;
      totalNotionalValue: number;
    }>();
    
    stats.forEach(stat => {
      if (!exchangeGroups.has(stat.exchange)) {
        exchangeGroups.set(stat.exchange, {
          totalLiquidations: 0,
          totalNotionalValue: 0
        });
      }
      
      const group = exchangeGroups.get(stat.exchange)!;
      group.totalLiquidations += stat.total_liquidations;
      group.totalNotionalValue += stat.total_notional;
    });
    
    const totalNotional = Array.from(exchangeGroups.values())
      .reduce((sum, group) => sum + group.totalNotionalValue, 0);
    
    return Array.from(exchangeGroups.entries())
      .map(([exchange, data]) => ({
        exchange,
        totalLiquidations: data.totalLiquidations,
        totalNotionalValue: data.totalNotionalValue,
        averageLiquidationSize: data.totalNotionalValue / data.totalLiquidations,
        marketShare: (data.totalNotionalValue / totalNotional) * 100
      }))
      .sort((a, b) => b.totalNotionalValue - a.totalNotionalValue);
  }

  private calculateLiquidationRate(liquidations: number, timeframe: string): number {
    const timeframeHours = this.getTimeframeHours(timeframe);
    return liquidations / timeframeHours;
  }

  private getTimeframeHours(timeframe: string): number {
    switch (timeframe) {
      case '5m': return 5 / 60;
      case '15m': return 15 / 60;
      case '1h': return 1;
      case '4h': return 4;
      case '1d': return 24;
      case '1w': return 168;
      default: return 1;
    }
  }

  private determineDominantSide(longLiquidations: number, shortLiquidations: number): 'long' | 'short' | 'balanced' {
    const total = longLiquidations + shortLiquidations;
    if (total === 0) return 'balanced';
    
    const longRatio = longLiquidations / total;
    const shortRatio = shortLiquidations / total;
    
    if (longRatio > 0.6) return 'long';
    if (shortRatio > 0.6) return 'short';
    return 'balanced';
  }

  private assessRiskLevel(
    totalNotional: number,
    largestLiquidation: number,
    totalLiquidations: number
  ): 'low' | 'medium' | 'high' {
    const averageLiquidation = totalNotional / totalLiquidations;
    const largestRatio = largestLiquidation / totalNotional;
    
    if (totalNotional > 10000000 || largestRatio > 0.1) {
      return 'high';
    } else if (totalNotional > 1000000 || largestRatio > 0.05) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private getTimePeriod(timestamp: string, timeframe: string): string {
    const date = new Date(timestamp);
    
    switch (timeframe) {
      case '5m':
        const minutes = Math.floor(date.getMinutes() / 5) * 5;
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      case '15m':
        const minutes15 = Math.floor(date.getMinutes() / 15) * 15;
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(minutes15).padStart(2, '0')}`;
      case '1h':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
      case '4h':
        const hours4 = Math.floor(date.getHours() / 4) * 4;
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(hours4).padStart(2, '0')}:00`;
      case '1d':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      default:
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
    }
  }
}
