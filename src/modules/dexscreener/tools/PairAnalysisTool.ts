import { DexScreenerDataFetcher, DexScreenerPair } from '../data/DexScreenerDataFetcher.js';

export class PairAnalysisTool {
  constructor(private dataFetcher: DexScreenerDataFetcher) {}

  async getPair(chainId: string, pairId: string): Promise<DexScreenerPair | null> {
    return await this.dataFetcher.getPair(chainId, pairId);
  }

  async getTokenPairs(chainId: string, tokenAddress: string): Promise<{
    pairs: DexScreenerPair[];
    summary: {
      totalPairs: number;
      totalVolume24h: number;
      totalLiquidity: number;
      topVolumePairs: DexScreenerPair[];
      topLiquidityPairs: DexScreenerPair[];
      topGainers: DexScreenerPair[];
      topLosers: DexScreenerPair[];
    };
  }> {
    const allPairs = await this.dataFetcher.getTokenPairs(chainId, tokenAddress);
    // Filter by chainId if specified
    const pairs = allPairs.filter(pair => pair.chainId === chainId);
    
    const summary = {
      totalPairs: pairs.length,
      totalVolume24h: pairs.reduce((sum, pair) => sum + pair.volume.h24, 0),
      totalLiquidity: pairs.reduce((sum, pair) => sum + (pair.liquidity?.usd || 0), 0),
      topVolumePairs: pairs
        .sort((a, b) => b.volume.h24 - a.volume.h24)
        .slice(0, 10),
      topLiquidityPairs: pairs
        .filter(p => p.liquidity)
        .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
        .slice(0, 10),
      topGainers: pairs
        .filter(p => p.priceChange.h24 > 0)
        .sort((a, b) => b.priceChange.h24 - a.priceChange.h24)
        .slice(0, 10),
      topLosers: pairs
        .filter(p => p.priceChange.h24 < 0)
        .sort((a, b) => a.priceChange.h24 - b.priceChange.h24)
        .slice(0, 10)
    };

    return { pairs, summary };
  }

  async searchPairs(query: string): Promise<{
    results: DexScreenerPair[];
    summary: {
      totalResults: number;
      totalVolume24h: number;
      totalLiquidity: number;
      topVolumePairs: DexScreenerPair[];
      topLiquidityPairs: DexScreenerPair[];
    };
  }> {
    const results = await this.dataFetcher.searchPairs(query);
    
    const summary = {
      totalResults: results.length,
      totalVolume24h: results.reduce((sum, result) => sum + result.volume.h24, 0),
      totalLiquidity: results.reduce((sum, result) => sum + (result.liquidity?.usd || 0), 0),
      topVolumePairs: results
        .sort((a, b) => b.volume.h24 - a.volume.h24)
        .slice(0, 10),
      topLiquidityPairs: results
        .filter(r => r.liquidity)
        .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
        .slice(0, 10)
    };

    return { results, summary };
  }

  async getPairsByVolume(chainId: string, tokenAddress: string, minVolume: number): Promise<DexScreenerPair[]> {
    const allPairs = await this.dataFetcher.getTokenPairs(chainId, tokenAddress);
    return allPairs
      .filter(pair => pair.chainId === chainId && pair.volume.h24 >= minVolume);
  }

  async getPairsByLiquidity(chainId: string, tokenAddress: string, minLiquidity: number): Promise<DexScreenerPair[]> {
    const allPairs = await this.dataFetcher.getTokenPairs(chainId, tokenAddress);
    return allPairs.filter(pair => 
      pair.chainId === chainId &&
      pair.liquidity && 
      pair.liquidity.usd >= minLiquidity
    );
  }

  async getPairsByDex(chainId: string, tokenAddress: string, dexId: string): Promise<DexScreenerPair[]> {
    const allPairs = await this.dataFetcher.getTokenPairs(chainId, tokenAddress);
    return allPairs.filter(pair => pair.chainId === chainId && pair.dexId === dexId);
  }

  async getTopPairsByVolume(chainId: string, tokenAddress: string, limit: number = 10): Promise<DexScreenerPair[]> {
    const allPairs = await this.dataFetcher.getTokenPairs(chainId, tokenAddress);
    return allPairs
      .filter(pair => pair.chainId === chainId)
      .sort((a, b) => b.volume.h24 - a.volume.h24)
      .slice(0, limit);
  }

  async getTopPairsByLiquidity(chainId: string, tokenAddress: string, limit: number = 10): Promise<DexScreenerPair[]> {
    const allPairs = await this.dataFetcher.getTokenPairs(chainId, tokenAddress);
    return allPairs
      .filter(pair => pair.chainId === chainId && pair.liquidity)
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
      .slice(0, limit);
  }

  async getPairsByPriceChange(chainId: string, tokenAddress: string, minChange: number): Promise<DexScreenerPair[]> {
    const allPairs = await this.dataFetcher.getTokenPairs(chainId, tokenAddress);
    return allPairs.filter(pair => pair.chainId === chainId && Math.abs(pair.priceChange.h24) >= minChange);
  }

  async getPairsByTimeframe(chainId: string, tokenAddress: string, timeframe: 'm5' | 'h1' | 'h6' | 'h24'): Promise<DexScreenerPair[]> {
    const allPairs = await this.dataFetcher.getTokenPairs(chainId, tokenAddress);
    return allPairs.filter(pair => {
      const volume = pair.volume[timeframe];
      return pair.chainId === chainId && volume && volume > 0;
    });
  }

  async getRecentPairs(chainId: string, tokenAddress: string, hoursAgo: number = 24): Promise<DexScreenerPair[]> {
    const allPairs = await this.dataFetcher.getTokenPairs(chainId, tokenAddress);
    const cutoffTime = Date.now() - (hoursAgo * 60 * 60 * 1000);
    return allPairs.filter(pair => 
      pair.chainId === chainId &&
      pair.pairCreatedAt && 
      pair.pairCreatedAt >= cutoffTime
    );
  }

  async getPairsWithFilters(filters: {
    chainId?: string;
    tokenAddress?: string;
    minVolume?: number;
    maxVolume?: number;
    minLiquidity?: number;
    maxLiquidity?: number;
    minPriceChange?: number;
    maxPriceChange?: number;
    dexId?: string;
    timeframe?: 'm5' | 'h1' | 'h6' | 'h24';
    hoursAgo?: number;
    sortBy?: 'volume' | 'liquidity' | 'priceChange' | 'age';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
  } = {}): Promise<{
    pairs: DexScreenerPair[];
    summary: {
      totalPairs: number;
      filteredPairs: number;
      totalVolume24h: number;
      totalLiquidity: number;
      averagePriceChange: number;
      topPerformers: DexScreenerPair[];
      topByVolume: DexScreenerPair[];
      recentPairs: DexScreenerPair[];
    };
  }> {
    let pairs: DexScreenerPair[] = [];

    // Get pairs based on whether we have specific token or general search
    if (filters.chainId && filters.tokenAddress) {
      pairs = await this.dataFetcher.getTokenPairs(filters.chainId, filters.tokenAddress);
      pairs = pairs.filter(pair => pair.chainId === filters.chainId);
    } else if (filters.chainId) {
      // For general chain searches, get popular pairs from that chain
      pairs = await this.dataFetcher.getChainPairs(filters.chainId);
    } else {
      // For completely general searches, get trending pairs
      pairs = await this.dataFetcher.getTrendingPairs();
    }

    // Apply filters
    if (filters.minVolume !== undefined) {
      pairs = pairs.filter(pair => pair.volume.h24 >= filters.minVolume!);
    }
    
    if (filters.maxVolume !== undefined) {
      pairs = pairs.filter(pair => pair.volume.h24 <= filters.maxVolume!);
    }
    
    if (filters.minLiquidity !== undefined) {
      pairs = pairs.filter(pair => pair.liquidity && pair.liquidity.usd >= filters.minLiquidity!);
    }
    
    if (filters.maxLiquidity !== undefined) {
      pairs = pairs.filter(pair => pair.liquidity && pair.liquidity.usd <= filters.maxLiquidity!);
    }
    
    if (filters.minPriceChange !== undefined) {
      pairs = pairs.filter(pair => pair.priceChange.h24 >= filters.minPriceChange!);
    }
    
    if (filters.maxPriceChange !== undefined) {
      pairs = pairs.filter(pair => pair.priceChange.h24 <= filters.maxPriceChange!);
    }
    
    if (filters.dexId) {
      pairs = pairs.filter(pair => pair.dexId === filters.dexId);
    }
    
    if (filters.timeframe) {
      pairs = pairs.filter(pair => {
        const volume = pair.volume[filters.timeframe!];
        return volume && volume > 0;
      });
    }
    
    if (filters.hoursAgo !== undefined) {
      const cutoffTime = Date.now() - (filters.hoursAgo * 60 * 60 * 1000);
      pairs = pairs.filter(pair => 
        pair.pairCreatedAt && pair.pairCreatedAt >= cutoffTime
      );
    }

    // Apply sorting
    if (filters.sortBy) {
      const sortOrder = filters.sortOrder || 'desc';
      pairs.sort((a, b) => {
        let aVal: number, bVal: number;
        
        switch (filters.sortBy) {
          case 'volume':
            aVal = a.volume.h24;
            bVal = b.volume.h24;
            break;
          case 'liquidity':
            aVal = a.liquidity?.usd || 0;
            bVal = b.liquidity?.usd || 0;
            break;
          case 'priceChange':
            aVal = a.priceChange.h24;
            bVal = b.priceChange.h24;
            break;
          case 'age':
            aVal = a.pairCreatedAt || 0;
            bVal = b.pairCreatedAt || 0;
            break;
          default:
            aVal = a.volume.h24;
            bVal = b.volume.h24;
        }
        
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    // Apply limit
    const originalLength = pairs.length;
    if (filters.limit) {
      pairs = pairs.slice(0, filters.limit);
    }

    // Calculate summary
    const summary = {
      totalPairs: originalLength,
      filteredPairs: pairs.length,
      totalVolume24h: pairs.reduce((sum, pair) => sum + pair.volume.h24, 0),
      totalLiquidity: pairs.reduce((sum, pair) => sum + (pair.liquidity?.usd || 0), 0),
      averagePriceChange: pairs.length > 0 ? pairs.reduce((sum, pair) => sum + pair.priceChange.h24, 0) / pairs.length : 0,
      topPerformers: pairs
        .filter(p => p.priceChange.h24 > 0)
        .sort((a, b) => b.priceChange.h24 - a.priceChange.h24)
        .slice(0, 5),
      topByVolume: pairs
        .sort((a, b) => b.volume.h24 - a.volume.h24)
        .slice(0, 5),
      recentPairs: pairs
        .filter(p => p.pairCreatedAt)
        .sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0))
        .slice(0, 5)
    };

    return { pairs, summary };
  }
}
