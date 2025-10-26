import { DexScreenerDataFetcher, DexScreenerTokenProfile } from '../data/DexScreenerDataFetcher.js';

export class TokenProfileAnalysisTool {
  constructor(private dataFetcher: DexScreenerDataFetcher) {}

  async getTokenProfiles(): Promise<{
    profiles: DexScreenerTokenProfile[];
    summary: {
      totalTokens: number;
      totalVolume24h: number;
      totalMarketCap: number;
      topGainers: DexScreenerTokenProfile[];
      topLosers: DexScreenerTokenProfile[];
    };
  }> {
    const profiles = await this.dataFetcher.getTokenProfiles();
    
    const summary = {
      totalTokens: profiles.length,
      totalVolume24h: profiles.reduce((sum, profile) => sum + (profile.volume24h || 0), 0),
      totalMarketCap: profiles.reduce((sum, profile) => sum + (profile.marketCap || 0), 0),
      topGainers: profiles
        .filter(p => p.priceChange24h && p.priceChange24h > 0)
        .sort((a, b) => (b.priceChange24h || 0) - (a.priceChange24h || 0))
        .slice(0, 10),
      topLosers: profiles
        .filter(p => p.priceChange24h && p.priceChange24h < 0)
        .sort((a, b) => (a.priceChange24h || 0) - (b.priceChange24h || 0))
        .slice(0, 10)
    };

    return { profiles, summary };
  }

  async getTokenProfileByAddress(chainId: string, address: string): Promise<DexScreenerTokenProfile | null> {
    return await this.dataFetcher.getTokenProfileByAddress(address, chainId);
  }

  async getTokensByChain(chainId: string): Promise<DexScreenerTokenProfile[]> {
    // Get all token profiles and filter by chain
    const profiles = await this.dataFetcher.getTokenProfiles();
    return profiles.filter(profile => profile.chainId === chainId);
  }

  async getTopTokensByVolume(limit: number = 10): Promise<DexScreenerTokenProfile[]> {
    const profiles = await this.dataFetcher.getTokenProfiles();
    return profiles
      .filter(profile => profile.volume24h && profile.volume24h > 0)
      .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
      .slice(0, limit);
  }

  async getTopTokensByMarketCap(limit: number = 10): Promise<DexScreenerTokenProfile[]> {
    const profiles = await this.dataFetcher.getTokenProfiles();
    return profiles
      .filter(profile => profile.marketCap && profile.marketCap > 0)
      .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
      .slice(0, limit);
  }

  async getTokensByPriceRange(minPrice: number, maxPrice: number): Promise<DexScreenerTokenProfile[]> {
    const profiles = await this.dataFetcher.getTokenProfiles();
    return profiles.filter(profile => 
      profile.priceUsd && 
      profile.priceUsd >= minPrice && 
      profile.priceUsd <= maxPrice
    );
  }

  async getTokensByLiquidity(minLiquidity: number): Promise<DexScreenerTokenProfile[]> {
    const profiles = await this.dataFetcher.getTokenProfiles();
    return profiles.filter(profile => 
      profile.liquidity && 
      profile.liquidity >= minLiquidity
    );
  }

  async analyzeToken(chainId: string, address: string): Promise<{
    profile: DexScreenerTokenProfile | null;
    pairs: any[];
    orders: any[];
    analysis: {
      riskLevel: 'low' | 'medium' | 'high';
      liquidityScore: number;
      volumeScore: number;
      priceStability: number;
      marketCapRank: number;
      recommendations: string[];
    };
  }> {
    // Get token profile
    const profile = await this.getTokenProfileByAddress(chainId, address);
    
    if (!profile) {
      return {
        profile: null,
        pairs: [],
        orders: [],
        analysis: {
          riskLevel: 'high',
          liquidityScore: 0,
          volumeScore: 0,
          priceStability: 0,
          marketCapRank: 0,
          recommendations: ['Token not found or invalid address']
        }
      };
    }

    // Get related data
    const pairs = await this.dataFetcher.getTokenPairs(chainId, address);
    const orders = await this.dataFetcher.getOrders(chainId, address);

    // Calculate analysis metrics
    const liquidityScore = this.calculateLiquidityScore(profile, pairs);
    const volumeScore = this.calculateVolumeScore(profile, pairs);
    const priceStability = this.calculatePriceStability(profile);
    const marketCapRank = await this.calculateMarketCapRank(profile);
    const riskLevel = this.calculateRiskLevel(liquidityScore, volumeScore, priceStability);
    const recommendations = this.generateRecommendations(profile, liquidityScore, volumeScore, priceStability, riskLevel);

    return {
      profile,
      pairs,
      orders,
      analysis: {
        riskLevel,
        liquidityScore,
        volumeScore,
        priceStability,
        marketCapRank,
        recommendations
      }
    };
  }

  async getTokens(filters: {
    chainId?: string;
    minMarketCap?: number;
    maxMarketCap?: number;
    minPrice?: number;
    maxPrice?: number;
    minLiquidity?: number;
    maxLiquidity?: number;
    minVolume24h?: number;
    maxVolume24h?: number;
    sortBy?: 'marketCap' | 'volume24h' | 'liquidity' | 'priceChange24h';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
  } = {}): Promise<{
    tokens: DexScreenerTokenProfile[];
    summary: {
      totalTokens: number;
      filteredTokens: number;
      totalVolume24h: number;
      totalMarketCap: number;
      averagePrice: number;
      topPerformers: DexScreenerTokenProfile[];
    };
  }> {
    let tokens = await this.dataFetcher.getTokenProfiles();

    // Apply filters
    if (filters.chainId) {
      tokens = tokens.filter(token => token.chainId === filters.chainId);
    }
    
    if (filters.minMarketCap !== undefined) {
      tokens = tokens.filter(token => token.marketCap && token.marketCap >= filters.minMarketCap!);
    }
    
    if (filters.maxMarketCap !== undefined) {
      tokens = tokens.filter(token => token.marketCap && token.marketCap <= filters.maxMarketCap!);
    }
    
    if (filters.minPrice !== undefined) {
      tokens = tokens.filter(token => token.priceUsd && token.priceUsd >= filters.minPrice!);
    }
    
    if (filters.maxPrice !== undefined) {
      tokens = tokens.filter(token => token.priceUsd && token.priceUsd <= filters.maxPrice!);
    }
    
    if (filters.minLiquidity !== undefined) {
      tokens = tokens.filter(token => token.liquidity && token.liquidity >= filters.minLiquidity!);
    }
    
    if (filters.maxLiquidity !== undefined) {
      tokens = tokens.filter(token => token.liquidity && token.liquidity <= filters.maxLiquidity!);
    }
    
    if (filters.minVolume24h !== undefined) {
      tokens = tokens.filter(token => token.volume24h && token.volume24h >= filters.minVolume24h!);
    }
    
    if (filters.maxVolume24h !== undefined) {
      tokens = tokens.filter(token => token.volume24h && token.volume24h <= filters.maxVolume24h!);
    }

    // Apply sorting
    if (filters.sortBy) {
      const sortOrder = filters.sortOrder || 'desc';
      tokens.sort((a, b) => {
        const aVal = a[filters.sortBy!] || 0;
        const bVal = b[filters.sortBy!] || 0;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    // Apply limit
    const originalLength = tokens.length;
    if (filters.limit) {
      tokens = tokens.slice(0, filters.limit);
    }

    // Calculate summary
    const summary = {
      totalTokens: originalLength,
      filteredTokens: tokens.length,
      totalVolume24h: tokens.reduce((sum, token) => sum + (token.volume24h || 0), 0),
      totalMarketCap: tokens.reduce((sum, token) => sum + (token.marketCap || 0), 0),
      averagePrice: tokens.length > 0 ? tokens.reduce((sum, token) => sum + (token.priceUsd || 0), 0) / tokens.length : 0,
      topPerformers: tokens
        .filter(t => t.priceChange24h && t.priceChange24h > 0)
        .sort((a, b) => (b.priceChange24h || 0) - (a.priceChange24h || 0))
        .slice(0, 5)
    };

    return { tokens, summary };
  }

  private calculateLiquidityScore(profile: DexScreenerTokenProfile, pairs: any[]): number {
    const totalLiquidity = (profile.liquidity || 0) + pairs.reduce((sum, pair) => sum + (pair.liquidity?.usd || 0), 0);
    // Score from 0-100 based on liquidity thresholds
    if (totalLiquidity >= 1000000) return 100;
    if (totalLiquidity >= 500000) return 80;
    if (totalLiquidity >= 100000) return 60;
    if (totalLiquidity >= 50000) return 40;
    if (totalLiquidity >= 10000) return 20;
    return 10;
  }

  private calculateVolumeScore(profile: DexScreenerTokenProfile, pairs: any[]): number {
    const totalVolume = (profile.volume24h || 0) + pairs.reduce((sum, pair) => sum + (pair.volume?.h24 || 0), 0);
    // Score from 0-100 based on volume thresholds
    if (totalVolume >= 10000000) return 100;
    if (totalVolume >= 1000000) return 80;
    if (totalVolume >= 100000) return 60;
    if (totalVolume >= 10000) return 40;
    if (totalVolume >= 1000) return 20;
    return 10;
  }

  private calculatePriceStability(profile: DexScreenerTokenProfile): number {
    const priceChange = Math.abs(profile.priceChange24h || 0);
    // Higher stability = lower price change (inverted score)
    if (priceChange <= 5) return 100;
    if (priceChange <= 10) return 80;
    if (priceChange <= 20) return 60;
    if (priceChange <= 50) return 40;
    if (priceChange <= 100) return 20;
    return 10;
  }

  private async calculateMarketCapRank(profile: DexScreenerTokenProfile): Promise<number> {
    const allProfiles = await this.dataFetcher.getTokenProfiles();
    const sorted = allProfiles
      .filter(p => p.marketCap && p.marketCap > 0)
      .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    
    const rank = sorted.findIndex(p => p.address === profile.address) + 1;
    return rank || sorted.length + 1;
  }

  private calculateRiskLevel(liquidityScore: number, volumeScore: number, priceStability: number): 'low' | 'medium' | 'high' {
    const averageScore = (liquidityScore + volumeScore + priceStability) / 3;
    if (averageScore >= 70) return 'low';
    if (averageScore >= 40) return 'medium';
    return 'high';
  }

  private generateRecommendations(
    profile: DexScreenerTokenProfile, 
    liquidityScore: number, 
    volumeScore: number, 
    priceStability: number, 
    riskLevel: 'low' | 'medium' | 'high'
  ): string[] {
    const recommendations: string[] = [];

    if (liquidityScore < 40) {
      recommendations.push('Low liquidity detected - be cautious of slippage on large trades');
    }
    
    if (volumeScore < 40) {
      recommendations.push('Low trading volume - may indicate limited market interest');
    }
    
    if (priceStability < 40) {
      recommendations.push('High price volatility - consider position sizing carefully');
    }
    
    if (riskLevel === 'high') {
      recommendations.push('High risk token - only invest what you can afford to lose');
    }
    
    if (profile.marketCap && profile.marketCap < 1000000) {
      recommendations.push('Small market cap - higher risk but potential for higher returns');
    }
    
    if (liquidityScore > 70 && volumeScore > 70) {
      recommendations.push('Good liquidity and volume - suitable for larger trades');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Token shows balanced metrics - conduct further research before investing');
    }

    return recommendations;
  }
}
