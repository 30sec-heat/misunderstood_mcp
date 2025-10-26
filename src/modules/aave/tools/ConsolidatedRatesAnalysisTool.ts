import { AaveV3DataFetcher } from '../data/AaveV3DataFetcher.js';

interface LendingRates {
  token: string;
  chain: string;
  lendingRate: number;
  borrowingRate: number;
  utilizationRate: number;
  totalSupply: number;
  totalBorrowed: number;
  liquidity: number;
  price: number;
  lastUpdated: string;
}

interface RateHistory {
  token: string;
  chain: string;
  period: string;
  rates: Array<{
    date: string;
    lendingRate: number;
    borrowingRate: number;
    utilizationRate: number;
  }>;
  trends: {
    lendingTrend: 'increasing' | 'decreasing' | 'stable';
    borrowingTrend: 'increasing' | 'decreasing' | 'stable';
    utilizationTrend: 'increasing' | 'decreasing' | 'stable';
  };
  lastUpdated: string;
}

interface ConsolidatedRatesResponse {
  lendingRates: LendingRates[];
  borrowingRates: LendingRates[];
  rateHistory?: RateHistory;
  chain: string;
  asset?: string;
  totalTokens: number;
  message: string;
  lastUpdated: string;
}

export class ConsolidatedRatesAnalysisTool {
  constructor(private dataFetcher: AaveV3DataFetcher) {}

  async getAllRatesAndHistory(args: any): Promise<any> {
    try {
      const { 
        chain = 'ethereum', 
        asset, 
        includeHistory = true, 
        historyPeriod = '30d',
        limit = 20 
      } = args;
      
      // Get lending rates
      const lendingRatesData = await this.dataFetcher.getLendingRates(chain);
      const borrowingRatesData = await this.dataFetcher.getBorrowingRates(chain);
      
      // Filter by asset if specified
      const filteredLendingRates = asset ? 
        lendingRatesData.filter(rate => rate.token.toLowerCase() === asset.toLowerCase()) :
        lendingRatesData.slice(0, limit);
      
      const filteredBorrowingRates = asset ? 
        borrowingRatesData.filter(rate => rate.token.toLowerCase() === asset.toLowerCase()) :
        borrowingRatesData.slice(0, limit);

      // Format lending rates
      const lendingRates: LendingRates[] = filteredLendingRates.map(data => ({
        token: data.token,
        chain: data.chain,
        lendingRate: Math.round(data.lendingRate * 10000) / 10000,
        borrowingRate: Math.round(data.borrowingRate * 10000) / 10000,
        utilizationRate: Math.round(data.utilizationRate * 100) / 100,
        totalSupply: Math.round(data.totalSupply * 100) / 100,
        totalBorrowed: Math.round(data.totalBorrowed * 100) / 100,
        liquidity: Math.round(data.liquidity * 100) / 100,
        price: Math.round(data.price * 100) / 100,
        lastUpdated: data.lastUpdated
      }));

      // Format borrowing rates (same structure as lending rates)
      const borrowingRates: LendingRates[] = filteredBorrowingRates.map(data => ({
        token: data.token,
        chain: data.chain,
        lendingRate: Math.round(data.lendingRate * 10000) / 10000,
        borrowingRate: Math.round(data.borrowingRate * 10000) / 10000,
        utilizationRate: Math.round(data.utilizationRate * 100) / 100,
        totalSupply: Math.round(data.totalSupply * 100) / 100,
        totalBorrowed: Math.round(data.totalBorrowed * 100) / 100,
        liquidity: Math.round(data.liquidity * 100) / 100,
        price: Math.round(data.price * 100) / 100,
        lastUpdated: data.lastUpdated
      }));

      let rateHistory: RateHistory | undefined;

      // Get rate history if requested and asset is specified
      if (includeHistory && asset) {
        try {
          const historyData = await this.dataFetcher.getRateHistory(chain, asset, historyPeriod);
          
          if (historyData && historyData.length > 0) {
            // Calculate trends
            const firstRate = historyData[0];
            const lastRate = historyData[historyData.length - 1];
            
            const lendingTrend = this.calculateTrend(firstRate.lendingRate, lastRate.lendingRate);
            const borrowingTrend = this.calculateTrend(firstRate.borrowingRate, lastRate.borrowingRate);
            const utilizationTrend = this.calculateTrend(firstRate.utilizationRate, lastRate.utilizationRate);

            rateHistory = {
              token: asset,
              chain,
              period: historyPeriod,
              rates: historyData.map(data => ({
                date: data.date,
                lendingRate: Math.round(data.lendingRate * 10000) / 10000,
                borrowingRate: Math.round(data.borrowingRate * 10000) / 10000,
                utilizationRate: Math.round(data.utilizationRate * 100) / 100
              })),
              trends: {
                lendingTrend,
                borrowingTrend,
                utilizationTrend
              },
              lastUpdated: new Date().toISOString()
            };
          }
        } catch (historyError) {
          console.warn('Failed to fetch rate history:', historyError);
        }
      }

      const response: ConsolidatedRatesResponse = {
        lendingRates,
        borrowingRates,
        rateHistory,
        chain,
        asset,
        totalTokens: Math.max(lendingRates.length, borrowingRates.length),
        message: asset ? 
          `Retrieved rates and history for ${asset} on ${chain}` :
          `Retrieved rates for ${Math.max(lendingRates.length, borrowingRates.length)} tokens on ${chain}`,
        lastUpdated: new Date().toISOString()
      };

      return response;

    } catch (error) {
      return {
        error: `Failed to get rates and history: ${error}`,
        message: 'Error retrieving consolidated rates data'
      };
    }
  }

  private calculateTrend(firstValue: number, lastValue: number): 'increasing' | 'decreasing' | 'stable' {
    const threshold = 0.001; // 0.1% threshold for stability
    const change = (lastValue - firstValue) / firstValue;
    
    if (Math.abs(change) < threshold) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }
}
