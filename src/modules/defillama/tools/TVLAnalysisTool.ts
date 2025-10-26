import { DeFiLlamaDataFetcher, DeFiLlamaProtocol, DeFiLlamaChain } from '../data/DeFiLlamaDataFetcher.js';

export class TVLAnalysisTool {
  constructor(private dataFetcher: DeFiLlamaDataFetcher) {}

  async getProtocols(args: { limit?: number; category?: string } = {}): Promise<any> {
    try {
      const { limit = 50, category } = args;
      const safeLimit = Math.min(Math.max(limit, 1), 200); // MCP optimized limits
      
      const protocols = await this.dataFetcher.getProtocols();
      
      // Filter by category if specified
      let filteredProtocols = protocols;
      if (category) {
        filteredProtocols = protocols.filter(p => 
          p.category && p.category.toLowerCase().includes(category.toLowerCase())
        );
      }
      
      // Sort by TVL descending
      const sortedProtocols = filteredProtocols.sort((a, b) => b.tvl - a.tvl);
      
      // Apply limit
      const limitedProtocols = sortedProtocols.slice(0, safeLimit);
      
      return {
        protocols: limitedProtocols.map(p => ({
          name: p.name,
          symbol: p.symbol,
          tvl: p.tvl,
          change_1d: p.change_1d,
          change_7d: p.change_7d,
          category: p.category,
          chains: p.chains,
          id: p.id
        })),
        totalProtocols: filteredProtocols.length,
        totalTVL: filteredProtocols.reduce((sum, protocol) => sum + protocol.tvl, 0),
        limit: safeLimit,
        category: category || 'all',
        message: `Found ${limitedProtocols.length} protocols${category ? ` in ${category} category` : ''} (limited to ${safeLimit})`
      };
    } catch (error) {
      console.error('Error fetching protocols:', error);
      throw new Error('Failed to fetch protocols data');
    }
  }

  async getProtocolTVL(args: { protocol: string; limit?: number }): Promise<any> {
    try {
      const { protocol, limit = 30 } = args;
      const safeLimit = Math.min(Math.max(limit, 1), 100); // MCP optimized limits
      
      const data = await this.dataFetcher.getProtocolTVL(protocol);
      
      // Apply limit to historical data if it's an array
      let limitedData = data;
      if (Array.isArray(data)) {
        limitedData = data.slice(-safeLimit); // Get most recent data points
      } else if (data && typeof data === 'object' && data.chainTvls) {
        // If it's the full protocol response, limit the historical data
        const limitedChainTvls: any = {};
        for (const [chain, chainData] of Object.entries(data.chainTvls)) {
          if (chainData && typeof chainData === 'object' && (chainData as any).tvl && Array.isArray((chainData as any).tvl)) {
            limitedChainTvls[chain] = {
              ...chainData,
              tvl: (chainData as any).tvl.slice(-safeLimit)
            };
          } else {
            limitedChainTvls[chain] = chainData;
          }
        }
        limitedData = {
          ...data,
          chainTvls: limitedChainTvls
        };
      }
      
      return {
        protocol,
        data: limitedData,
        limit: safeLimit,
        message: `Historical TVL data for ${protocol} (limited to ${safeLimit} data points)`
      };
    } catch (error) {
      console.error(`Error fetching TVL for protocol ${args.protocol}:`, error);
      throw new Error(`Failed to fetch TVL data for protocol ${args.protocol}`);
    }
  }

  async getChainsTVL(args: { limit?: number } = {}): Promise<any> {
    try {
      const { limit = 30 } = args;
      const safeLimit = Math.min(Math.max(limit, 1), 100); // MCP optimized limits
      
      const chains = await this.dataFetcher.getChainsTVL();
      
      // Sort by TVL descending
      const sortedChains = chains.sort((a, b) => b.tvl - a.tvl);
      
      // Apply limit
      const limitedChains = sortedChains.slice(0, safeLimit);
      
      return {
        chains: limitedChains.map(c => ({
          name: c.name,
          tokenSymbol: c.tokenSymbol,
          tvl: c.tvl,
          change_1d: c.change_1d,
          change_7d: c.change_7d,
          gecko_id: (c as any).gecko_id,
          cmcId: c.cmcId,
          chainId: (c as any).chainId
        })),
        totalChains: chains.length,
        totalTVL: chains.reduce((sum, chain) => sum + chain.tvl, 0),
        limit: safeLimit,
        message: `Found ${limitedChains.length} chains (limited to ${safeLimit})`
      };
    } catch (error) {
      console.error('Error fetching chains TVL:', error);
      throw new Error('Failed to fetch chains TVL data');
    }
  }

  async getChainTVLHistory(args: { chain: string; limit?: number }): Promise<any> {
    try {
      const { chain, limit = 30 } = args;
      const safeLimit = Math.min(Math.max(limit, 1), 100); // MCP optimized limits
      
      const data = await this.dataFetcher.getChainTVLHistory(chain);
      
      // Apply limit to historical data
      let limitedData = data;
      if (Array.isArray(data)) {
        limitedData = data.slice(-safeLimit); // Get most recent data points
      }
      
      return {
        chain,
        data: limitedData,
        limit: safeLimit,
        message: `Historical TVL data for ${chain} (limited to ${safeLimit} data points)`
      };
    } catch (error) {
      console.error(`Error fetching TVL history for chain ${args.chain}:`, error);
      throw new Error(`Failed to fetch TVL history for chain ${args.chain}`);
    }
  }

  async getProtocolCurrentTVL(args: { protocol: string }): Promise<any> {
    try {
      const { protocol } = args;
      const tvl = await this.dataFetcher.getProtocolCurrentTVL(protocol);
      
      return {
        protocol,
        currentTVL: tvl,
        message: `Current TVL for ${protocol}: $${tvl.toLocaleString()}`
      };
    } catch (error) {
      console.error(`Error fetching current TVL for protocol ${args.protocol}:`, error);
      throw new Error(`Failed to fetch current TVL for protocol ${args.protocol}`);
    }
  }

  async getTopProtocolsByCategory(args: { category?: string; limit?: number }): Promise<any> {
    try {
      const { category, limit = 10 } = args;
      const protocols = await this.dataFetcher.getProtocols();
      
      let filteredProtocols = protocols;
      if (category) {
        filteredProtocols = protocols.filter(p => 
          p.category.toLowerCase().includes(category.toLowerCase())
        );
      }
      
      const sortedProtocols = filteredProtocols
        .sort((a, b) => b.tvl - a.tvl)
        .slice(0, limit);
      
      return {
        category: category || 'all',
        protocols: sortedProtocols.map(p => ({
          name: p.name,
          symbol: p.symbol,
          tvl: p.tvl,
          change_1d: p.change_1d,
          change_7d: p.change_7d,
          category: p.category,
          chains: p.chains
        })),
        totalProtocols: filteredProtocols.length
      };
    } catch (error) {
      console.error('Error fetching top protocols by category:', error);
      throw new Error('Failed to fetch top protocols by category');
    }
  }

  async getTVLComparison(args: { protocols: string[] }): Promise<any> {
    try {
      const { protocols } = args;
      const allProtocols = await this.dataFetcher.getProtocols();
      
      const comparisonData = protocols.map(protocolName => {
        const protocol = allProtocols.find(p => 
          p.name.toLowerCase() === protocolName.toLowerCase() ||
          p.symbol.toLowerCase() === protocolName.toLowerCase()
        );
        
        if (!protocol) {
          return {
            name: protocolName,
            found: false,
            error: 'Protocol not found'
          };
        }
        
        return {
          name: protocol.name,
          symbol: protocol.symbol,
          tvl: protocol.tvl,
          change_1d: protocol.change_1d,
          change_7d: protocol.change_7d,
          category: protocol.category,
          chains: protocol.chains,
          found: true
        };
      });
      
      return {
        comparison: comparisonData,
        totalTVL: comparisonData
          .filter(p => p.found)
          .reduce((sum, p) => sum + (p.tvl || 0), 0)
      };
    } catch (error) {
      console.error('Error comparing protocols:', error);
      throw new Error('Failed to compare protocols');
    }
  }

  async getTVLTrends(args: { timeframe?: string; limit?: number }): Promise<any> {
    try {
      const { limit = 20 } = args;
      const protocols = await this.dataFetcher.getProtocols();
      
      // Get protocols with highest positive 7-day change
      const trendingUp = protocols
        .filter(p => p.change_7d > 0)
        .sort((a, b) => b.change_7d - a.change_7d)
        .slice(0, limit);
      
      // Get protocols with highest negative 7-day change
      const trendingDown = protocols
        .filter(p => p.change_7d < 0)
        .sort((a, b) => a.change_7d - b.change_7d)
        .slice(0, limit);
      
      return {
        trendingUp: trendingUp.map(p => ({
          name: p.name,
          symbol: p.symbol,
          tvl: p.tvl,
          change_7d: p.change_7d,
          category: p.category
        })),
        trendingDown: trendingDown.map(p => ({
          name: p.name,
          symbol: p.symbol,
          tvl: p.tvl,
          change_7d: p.change_7d,
          category: p.category
        })),
        timeframe: '7d'
      };
    } catch (error) {
      console.error('Error fetching TVL trends:', error);
      throw new Error('Failed to fetch TVL trends');
    }
  }
}
