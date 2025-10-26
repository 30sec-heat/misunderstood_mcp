import { DeFiLlamaDataFetcher, DeFiLlamaDexOverview } from '../data/DeFiLlamaDataFetcher.js';

export class DexAnalysisTool {
  constructor(private dataFetcher: DeFiLlamaDataFetcher) {}

  async getDexOverview(args: { excludeTotalDataChart?: boolean }): Promise<any> {
    try {
      const { excludeTotalDataChart = false } = args;
      const dexData = await this.dataFetcher.getDexOverview(excludeTotalDataChart);
      
      // Sort by 24h volume descending
      const sortedDexes = dexData.sort((a, b) => b.total24h - a.total24h);
      
      return {
        dexes: sortedDexes,
        totalDexes: dexData.length,
        totalVolume24h: dexData.reduce((sum, dex) => sum + dex.total24h, 0),
        totalVolume7d: dexData.reduce((sum, dex) => sum + dex.total7d, 0),
        topDexes: sortedDexes.slice(0, 20).map(dex => ({
          name: dex.name,
          displayName: dex.displayName,
          category: dex.category,
          total24h: dex.total24h,
          total7d: dex.total7d,
          change_1d: dex.change_1d,
          change_7d: dex.change_7d,
          chains: dex.chains
        }))
      };
    } catch (error) {
      console.error('Error fetching DEX overview:', error);
      throw new Error('Failed to fetch DEX overview data');
    }
  }

  async getDexSummary(args: { protocol: string }): Promise<any> {
    try {
      const { protocol } = args;
      const [dexSummary, feesSummary] = await Promise.all([
        this.dataFetcher.getDexSummary(protocol),
        this.dataFetcher.getFeesSummary(protocol)
      ]);
      
      return {
        protocol,
        dexSummary,
        feesSummary,
        message: `DEX and fees summary for ${protocol}`
      };
    } catch (error) {
      console.error(`Error fetching DEX and fees summary for ${args.protocol}:`, error);
      throw new Error(`Failed to fetch DEX and fees summary for ${args.protocol}`);
    }
  }

  async getFeesOverview(args: { excludeTotalDataChart?: boolean }): Promise<any> {
    try {
      const { excludeTotalDataChart = false } = args;
      const feesData = await this.dataFetcher.getFeesOverview(excludeTotalDataChart);
      
      // Sort by 24h fees descending
      const sortedFees = feesData.sort((a, b) => b.total24h - a.total24h);
      
      return {
        fees: sortedFees,
        totalProtocols: feesData.length,
        totalFees24h: feesData.reduce((sum, protocol) => sum + protocol.total24h, 0),
        totalFees7d: feesData.reduce((sum, protocol) => sum + protocol.total7d, 0),
        topFees: sortedFees.slice(0, 20).map(protocol => ({
          name: protocol.name,
          displayName: protocol.displayName,
          category: protocol.category,
          total24h: protocol.total24h,
          total7d: protocol.total7d,
          change_1d: protocol.change_1d,
          change_7d: protocol.change_7d,
          chains: protocol.chains
        }))
      };
    } catch (error) {
      console.error('Error fetching fees overview:', error);
      throw new Error('Failed to fetch fees overview data');
    }
  }

  async getDexAnalysisByChain(args: { chain?: string }): Promise<any> {
    try {
      const { chain } = args;
      const dexData = await this.dataFetcher.getDexOverview();
      
      let filteredDexes = dexData;
      if (chain) {
        filteredDexes = dexData.filter(dex => 
          dex.chains.some(c => c.toLowerCase() === chain.toLowerCase())
        );
      }
      
      // Group by chain
      const chainAnalysis = dexData.reduce((acc, dex) => {
        dex.chains.forEach(chainName => {
          if (!acc[chainName]) {
            acc[chainName] = {
              dexes: [],
              totalVolume24h: 0,
              totalVolume7d: 0,
              dexCount: 0
            };
          }
          
          acc[chainName].dexes.push(dex);
          acc[chainName].totalVolume24h += dex.total24h;
          acc[chainName].totalVolume7d += dex.total7d;
          acc[chainName].dexCount++;
        });
        
        return acc;
      }, {} as Record<string, any>);
      
      // Sort chains by volume
      const sortedChains = Object.entries(chainAnalysis)
        .map(([chainName, data]) => ({
          chain: chainName,
          ...data
        }))
        .sort((a, b) => b.totalVolume24h - a.totalVolume24h);
      
      return {
        chain: chain || 'all',
        chainAnalysis: sortedChains,
        totalChains: sortedChains.length,
        message: `DEX analysis ${chain ? `for ${chain}` : 'across all chains'}`
      };
    } catch (error) {
      console.error('Error analyzing DEX by chain:', error);
      throw new Error('Failed to analyze DEX by chain');
    }
  }

  async getDexTrends(args: { timeframe?: string; limit?: number }): Promise<any> {
    try {
      const { limit = 20 } = args;
      const dexData = await this.dataFetcher.getDexOverview();
      
      // Analyze volume trends
      const volumeGrowing = dexData
        .filter(dex => dex.change_7d > 0)
        .sort((a, b) => b.change_7d - a.change_7d)
        .slice(0, limit);
      
      const volumeDeclining = dexData
        .filter(dex => dex.change_7d < 0)
        .sort((a, b) => a.change_7d - b.change_7d)
        .slice(0, limit);
      
      // Analyze by category
      const categoryAnalysis = dexData.reduce((acc, dex) => {
        const category = dex.category;
        if (!acc[category]) {
          acc[category] = {
            dexes: [],
            totalVolume24h: 0,
            totalVolume7d: 0,
            dexCount: 0
          };
        }
        
        acc[category].dexes.push(dex);
        acc[category].totalVolume24h += dex.total24h;
        acc[category].totalVolume7d += dex.total7d;
        acc[category].dexCount++;
        
        return acc;
      }, {} as Record<string, any>);
      
      // Sort categories by volume
      const sortedCategories = Object.entries(categoryAnalysis)
        .map(([category, data]) => ({
          category,
          ...data
        }))
        .sort((a, b) => b.totalVolume24h - a.totalVolume24h);
      
      return {
        volumeTrends: {
          growing: volumeGrowing.map(dex => ({
            name: dex.name,
            displayName: dex.displayName,
            change_7d: dex.change_7d,
            total24h: dex.total24h,
            category: dex.category
          })),
          declining: volumeDeclining.map(dex => ({
            name: dex.name,
            displayName: dex.displayName,
            change_7d: dex.change_7d,
            total24h: dex.total24h,
            category: dex.category
          }))
        },
        categoryAnalysis: sortedCategories,
        message: 'DEX volume trends and category analysis'
      };
    } catch (error) {
      console.error('Error fetching DEX trends:', error);
      throw new Error('Failed to fetch DEX trends');
    }
  }

  async getDexComparison(args: { dexes: string[] }): Promise<any> {
    try {
      const { dexes } = args;
      const dexData = await this.dataFetcher.getDexOverview();
      
      const comparison = dexes.map(dexName => {
        const dex = dexData.find(d => 
          d.name.toLowerCase() === dexName.toLowerCase() ||
          d.displayName.toLowerCase() === dexName.toLowerCase()
        );
        
        if (!dex) {
          return {
            name: dexName,
            found: false,
            error: 'DEX not found'
          };
        }
        
        return {
          name: dex.name,
          displayName: dex.displayName,
          category: dex.category,
          total24h: dex.total24h,
          total7d: dex.total7d,
          total30d: dex.total30d,
          change_1d: dex.change_1d,
          change_7d: dex.change_7d,
          change_1m: dex.change_1m,
          chains: dex.chains,
          found: true
        };
      });
      
      return {
        comparison,
        totalDexes: comparison.filter(d => d.found).length,
        totalVolume24h: comparison
          .filter(d => d.found)
          .reduce((sum, d) => sum + (d.total24h || 0), 0),
        message: `DEX comparison for ${dexes.join(', ')}`
      };
    } catch (error) {
      console.error(`Error comparing DEXes ${args.dexes}:`, error);
      throw new Error(`Failed to compare DEXes ${args.dexes}`);
    }
  }

  async getTopPerformingDexes(args: { metric?: string; timeframe?: string; limit?: number }): Promise<any> {
    try {
      const { metric = 'volume', timeframe = '24h', limit = 20 } = args;
      const dexData = await this.dataFetcher.getDexOverview();
      
      let sortedDexes;
      
      switch (metric) {
        case 'volume':
          if (timeframe === '24h') {
            sortedDexes = dexData.sort((a, b) => b.total24h - a.total24h);
          } else if (timeframe === '7d') {
            sortedDexes = dexData.sort((a, b) => b.total7d - a.total7d);
          } else {
            sortedDexes = dexData.sort((a, b) => b.total30d - a.total30d);
          }
          break;
        case 'growth':
          sortedDexes = dexData.sort((a, b) => b.change_7d - a.change_7d);
          break;
        case 'stability':
          // Sort by lowest volatility (most stable)
          sortedDexes = dexData.sort((a, b) => Math.abs(a.change_7d) - Math.abs(b.change_7d));
          break;
        default:
          sortedDexes = dexData.sort((a, b) => b.total24h - a.total24h);
      }
      
      return {
        metric,
        timeframe,
        dexes: sortedDexes.slice(0, limit).map(dex => ({
          name: dex.name,
          displayName: dex.displayName,
          category: dex.category,
          total24h: dex.total24h,
          total7d: dex.total7d,
          total30d: dex.total30d,
          change_1d: dex.change_1d,
          change_7d: dex.change_7d,
          change_1m: dex.change_1m,
          chains: dex.chains
        })),
        totalDexes: dexData.length,
        message: `Top performing DEXes by ${metric} over ${timeframe}`
      };
    } catch (error) {
      console.error('Error fetching top performing DEXes:', error);
      throw new Error('Failed to fetch top performing DEXes');
    }
  }

  async getDexMarketShare(): Promise<any> {
    try {
      const dexData = await this.dataFetcher.getDexOverview();
      const totalVolume24h = dexData.reduce((sum, dex) => sum + dex.total24h, 0);
      
      const marketShare = dexData.map(dex => ({
        name: dex.name,
        displayName: dex.displayName,
        category: dex.category,
        volume24h: dex.total24h,
        marketShare: (dex.total24h / totalVolume24h) * 100,
        chains: dex.chains
      })).sort((a, b) => b.marketShare - a.marketShare);
      
      // Group by category
      const categoryShare = dexData.reduce((acc, dex) => {
        const category = dex.category;
        if (!acc[category]) {
          acc[category] = {
            volume24h: 0,
            dexCount: 0,
            dexes: []
          };
        }
        
        acc[category].volume24h += dex.total24h;
        acc[category].dexCount++;
        acc[category].dexes.push({
          name: dex.name,
          volume24h: dex.total24h
        });
        
        return acc;
      }, {} as Record<string, any>);
      
      const categoryMarketShare = Object.entries(categoryShare)
        .map(([category, data]) => ({
          category,
          volume24h: data.volume24h,
          marketShare: (data.volume24h / totalVolume24h) * 100,
          dexCount: data.dexCount,
          dexes: data.dexes.sort((a: any, b: any) => b.volume24h - a.volume24h)
        }))
        .sort((a, b) => b.marketShare - a.marketShare);
      
      return {
        totalVolume24h,
        dexMarketShare: marketShare,
        categoryMarketShare,
        totalDexes: dexData.length,
        totalCategories: categoryMarketShare.length,
        message: 'DEX market share analysis'
      };
    } catch (error) {
      console.error('Error analyzing DEX market share:', error);
      throw new Error('Failed to analyze DEX market share');
    }
  }
}
