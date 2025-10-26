import { DexScreenerDataFetcher, DexScreenerOrder } from '../data/DexScreenerDataFetcher.js';

export class OrderAnalysisTool {
  constructor(private dataFetcher: DexScreenerDataFetcher) {}

  async getOrders(chainId: string, tokenAddress: string): Promise<{
    orders: DexScreenerOrder[];
    summary: {
      totalOrders: number;
      totalVolume24h: number;
      totalMarketCap: number;
      topVolumePairs: DexScreenerOrder[];
      topGainers: DexScreenerOrder[];
      topLosers: DexScreenerOrder[];
    };
  }> {
    const orders = await this.dataFetcher.getOrders(chainId, tokenAddress);
    
    const summary = {
      totalOrders: orders.length,
      totalVolume24h: orders.reduce((sum, order) => sum + order.volume.h24, 0),
      totalMarketCap: orders.reduce((sum, order) => sum + (order.marketCap || 0), 0),
      topVolumePairs: orders
        .sort((a, b) => b.volume.h24 - a.volume.h24)
        .slice(0, 10),
      topGainers: orders
        .filter(o => o.priceChange.h24 > 0)
        .sort((a, b) => b.priceChange.h24 - a.priceChange.h24)
        .slice(0, 10),
      topLosers: orders
        .filter(o => o.priceChange.h24 < 0)
        .sort((a, b) => a.priceChange.h24 - b.priceChange.h24)
        .slice(0, 10)
    };

    return { orders, summary };
  }

  async getOrdersByVolume(chainId: string, tokenAddress: string, minVolume: number): Promise<DexScreenerOrder[]> {
    const orders = await this.dataFetcher.getOrders(chainId, tokenAddress);
    return orders.filter(order => order.volume.h24 >= minVolume);
  }

  async getOrdersByLiquidity(chainId: string, tokenAddress: string, minLiquidity: number): Promise<DexScreenerOrder[]> {
    const orders = await this.dataFetcher.getOrders(chainId, tokenAddress);
    return orders.filter(order => 
      order.liquidity && 
      order.liquidity.usd >= minLiquidity
    );
  }

  async getOrdersByPriceChange(chainId: string, tokenAddress: string, minChange: number): Promise<DexScreenerOrder[]> {
    const orders = await this.dataFetcher.getOrders(chainId, tokenAddress);
    return orders.filter(order => Math.abs(order.priceChange.h24) >= minChange);
  }

  async getOrdersByDex(chainId: string, tokenAddress: string, dexId: string): Promise<DexScreenerOrder[]> {
    const orders = await this.dataFetcher.getOrders(chainId, tokenAddress);
    return orders.filter(order => order.dexId === dexId);
  }

  async getTopOrdersByVolume(chainId: string, tokenAddress: string, limit: number = 10): Promise<DexScreenerOrder[]> {
    const orders = await this.dataFetcher.getOrders(chainId, tokenAddress);
    return orders
      .sort((a, b) => b.volume.h24 - a.volume.h24)
      .slice(0, limit);
  }

  async getTopOrdersByLiquidity(chainId: string, tokenAddress: string, limit: number = 10): Promise<DexScreenerOrder[]> {
    const orders = await this.dataFetcher.getOrders(chainId, tokenAddress);
    return orders
      .filter(order => order.liquidity)
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
      .slice(0, limit);
  }

  async getOrdersByTimeframe(chainId: string, tokenAddress: string, timeframe: 'm5' | 'h1' | 'h6' | 'h24'): Promise<DexScreenerOrder[]> {
    const orders = await this.dataFetcher.getOrders(chainId, tokenAddress);
    return orders.filter(order => {
      const volume = order.volume[timeframe];
      return volume && volume > 0;
    });
  }

  async getOrdersWithFilters(filters: {
    chainId: string;
    tokenAddress: string;
    minVolume?: number;
    maxVolume?: number;
    minLiquidity?: number;
    maxLiquidity?: number;
    minPriceChange?: number;
    maxPriceChange?: number;
    dexId?: string;
    timeframe?: 'm5' | 'h1' | 'h6' | 'h24';
    sortBy?: 'volume' | 'liquidity' | 'priceChange';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
  }): Promise<{
    orders: DexScreenerOrder[];
    summary: {
      totalOrders: number;
      filteredOrders: number;
      totalVolume24h: number;
      totalLiquidity: number;
      averagePriceChange: number;
      topPerformers: DexScreenerOrder[];
      topByVolume: DexScreenerOrder[];
    };
  }> {
    let orders = await this.dataFetcher.getOrders(filters.chainId, filters.tokenAddress);

    // Apply filters
    if (filters.minVolume !== undefined) {
      orders = orders.filter(order => order.volume.h24 >= filters.minVolume!);
    }
    
    if (filters.maxVolume !== undefined) {
      orders = orders.filter(order => order.volume.h24 <= filters.maxVolume!);
    }
    
    if (filters.minLiquidity !== undefined) {
      orders = orders.filter(order => order.liquidity && order.liquidity.usd >= filters.minLiquidity!);
    }
    
    if (filters.maxLiquidity !== undefined) {
      orders = orders.filter(order => order.liquidity && order.liquidity.usd <= filters.maxLiquidity!);
    }
    
    if (filters.minPriceChange !== undefined) {
      orders = orders.filter(order => order.priceChange.h24 >= filters.minPriceChange!);
    }
    
    if (filters.maxPriceChange !== undefined) {
      orders = orders.filter(order => order.priceChange.h24 <= filters.maxPriceChange!);
    }
    
    if (filters.dexId) {
      orders = orders.filter(order => order.dexId === filters.dexId);
    }
    
    if (filters.timeframe) {
      orders = orders.filter(order => {
        const volume = order.volume[filters.timeframe!];
        return volume && volume > 0;
      });
    }

    // Apply sorting
    if (filters.sortBy) {
      const sortOrder = filters.sortOrder || 'desc';
      orders.sort((a, b) => {
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
          default:
            aVal = a.volume.h24;
            bVal = b.volume.h24;
        }
        
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    // Apply limit
    const originalLength = orders.length;
    if (filters.limit) {
      orders = orders.slice(0, filters.limit);
    }

    // Calculate summary
    const summary = {
      totalOrders: originalLength,
      filteredOrders: orders.length,
      totalVolume24h: orders.reduce((sum, order) => sum + order.volume.h24, 0),
      totalLiquidity: orders.reduce((sum, order) => sum + (order.liquidity?.usd || 0), 0),
      averagePriceChange: orders.length > 0 ? orders.reduce((sum, order) => sum + order.priceChange.h24, 0) / orders.length : 0,
      topPerformers: orders
        .filter(o => o.priceChange.h24 > 0)
        .sort((a, b) => b.priceChange.h24 - a.priceChange.h24)
        .slice(0, 5),
      topByVolume: orders
        .sort((a, b) => b.volume.h24 - a.volume.h24)
        .slice(0, 5)
    };

    return { orders, summary };
  }
}
