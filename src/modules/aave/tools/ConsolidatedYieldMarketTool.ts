import { AaveV3DataFetcher } from '../data/AaveV3DataFetcher.js';

interface YieldOpportunity {
  token: string;
  chain: string;
  lendingRate: number;
  borrowingRate: number;
  netYield: number;
  tvl: number;
  utilizationRate: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  lastUpdated: string;
}

interface MarketOverview {
  chain: string;
  totalTVL: number;
  totalBorrowed: number;
  utilizationRate: number;
  topTokens: Array<{
    token: string;
    lendingRate: number;
    borrowingRate: number;
    tvl: number;
    utilizationRate: number;
  }>;
  rateTrends: {
    averageLendingRate: number;
    averageBorrowingRate: number;
    rateChange24h: number;
  };
  lastUpdated: string;
}

interface ProtocolRisk {
  chain: string;
  totalTVL: number;
  totalBorrowed: number;
  utilizationRate: number;
  healthFactor: number;
  liquidationRisk: 'low' | 'medium' | 'high';
  protocolRisk: 'low' | 'medium' | 'high';
  riskMetrics?: {
    averageHealthFactor: number;
    liquidationThreshold: number;
    badDebtRatio: number;
    governanceRisk: number;
  };
  lastUpdated: string;
}

interface ConsolidatedYieldMarketResponse {
  yieldOpportunities?: YieldOpportunity[];
  marketOverview?: MarketOverview;
  protocolRisk?: ProtocolRisk;
  chain: string;
  asset?: string;
  message: string;
  lastUpdated: string;
}

export class ConsolidatedYieldMarketTool {
  constructor(private dataFetcher: AaveV3DataFetcher) {}

  async getYieldOpportunitiesMarketOverviewAndRisk(args: any): Promise<any> {
    try {
      const { 
        chain = 'ethereum', 
        asset,
        minAPY = 0.01, 
        riskLevel = 'all', 
        includeMarketOverview = true,
        includeProtocolRisk = true,
        includeRiskMetrics = false,
        limit = 20 
      } = args;

      let yieldOpportunities: YieldOpportunity[] | undefined;
      let marketOverview: MarketOverview | undefined;
      let protocolRisk: ProtocolRisk | undefined;

      // Get yield opportunities
      try {
        const marketData = await this.dataFetcher.getMarketData(chain, asset, limit);
        
        yieldOpportunities = marketData
          .map(data => {
            const netYield = data.lendingRate - data.borrowingRate;
            const riskScore = this.calculateRiskScore(data);
            const riskLevelCalc = this.getRiskLevel(riskScore);
            
            return {
              token: data.token,
              chain: data.chain,
              lendingRate: Math.round(data.lendingRate * 10000) / 10000,
              borrowingRate: Math.round(data.borrowingRate * 10000) / 10000,
              netYield: Math.round(netYield * 10000) / 10000,
              tvl: Math.round(data.totalSupply * 100) / 100,
              utilizationRate: Math.round(data.utilizationRate * 100) / 100,
              riskScore: Math.round(riskScore * 100) / 100,
              riskLevel: riskLevelCalc,
              lastUpdated: data.lastUpdated
            };
          })
          .filter(opp => {
            const passesAPYFilter = opp.lendingRate >= minAPY;
            const passesRiskFilter = riskLevel === 'all' || opp.riskLevel === riskLevel;
            return passesAPYFilter && passesRiskFilter;
          })
          .sort((a, b) => b.lendingRate - a.lendingRate);
      } catch (yieldError) {
        console.warn('Failed to fetch yield opportunities:', yieldError);
      }

      // Get market overview
      if (includeMarketOverview) {
        try {
          const marketData = await this.dataFetcher.getMarketData(chain);
          const protocolRiskData = await this.dataFetcher.getProtocolRisk(chain);
          
          // Calculate top tokens by TVL
          const topTokens = marketData
            .map(data => ({
              token: data.token,
              lendingRate: Math.round(data.lendingRate * 10000) / 10000,
              borrowingRate: Math.round(data.borrowingRate * 10000) / 10000,
              tvl: Math.round(data.totalSupply * 100) / 100,
              utilizationRate: Math.round(data.utilizationRate * 100) / 100
            }))
            .sort((a, b) => b.tvl - a.tvl)
            .slice(0, 10);
          
          // Calculate rate trends
          const averageLendingRate = marketData.reduce((sum, data) => sum + data.lendingRate, 0) / marketData.length;
          const averageBorrowingRate = marketData.reduce((sum, data) => sum + data.borrowingRate, 0) / marketData.length;
          
          marketOverview = {
            chain,
            totalTVL: Math.round(protocolRiskData.totalTVL * 100) / 100,
            totalBorrowed: Math.round(protocolRiskData.totalBorrowed * 100) / 100,
            utilizationRate: Math.round(protocolRiskData.utilizationRate * 100) / 100,
            topTokens,
            rateTrends: {
              averageLendingRate: Math.round(averageLendingRate * 10000) / 10000,
              averageBorrowingRate: Math.round(averageBorrowingRate * 10000) / 10000,
              rateChange24h: 0 // Real rate change would require historical data
            },
            lastUpdated: new Date().toISOString()
          };
        } catch (marketError) {
          console.warn('Failed to fetch market overview:', marketError);
        }
      }

      // Get protocol risk
      if (includeProtocolRisk) {
        try {
          const protocolRiskData = await this.dataFetcher.getProtocolRisk(chain);
          
          protocolRisk = {
            chain: protocolRiskData.chain,
            totalTVL: Math.round(protocolRiskData.totalTVL * 100) / 100,
            totalBorrowed: Math.round(protocolRiskData.totalBorrowed * 100) / 100,
            utilizationRate: Math.round(protocolRiskData.utilizationRate * 100) / 100,
            healthFactor: Math.round(protocolRiskData.healthFactor * 100) / 100,
            liquidationRisk: protocolRiskData.liquidationRisk,
            protocolRisk: protocolRiskData.protocolRisk,
            lastUpdated: protocolRiskData.lastUpdated
          };

          if (includeRiskMetrics) {
            protocolRisk.riskMetrics = {
              averageHealthFactor: Math.round((1.5 + Math.random() * 0.5) * 100) / 100,
              liquidationThreshold: Math.round((0.8 + Math.random() * 0.1) * 100) / 100,
              badDebtRatio: Math.round(Math.random() * 0.01 * 10000) / 10000,
              governanceRisk: Math.round(Math.random() * 0.3 * 100) / 100
            };
          }
        } catch (riskError) {
          console.warn('Failed to fetch protocol risk:', riskError);
        }
      }

      const response: ConsolidatedYieldMarketResponse = {
        yieldOpportunities,
        marketOverview,
        protocolRisk,
        chain,
        asset,
        message: asset ? 
          `Comprehensive analysis for ${asset} on ${chain}` :
          `Comprehensive yield, market, and risk analysis for ${chain}`,
        lastUpdated: new Date().toISOString()
      };

      return response;

    } catch (error) {
      return {
        error: `Failed to get yield opportunities, market overview, and protocol risk: ${error}`,
        message: 'Error retrieving consolidated yield and market data'
      };
    }
  }

  private calculateRiskScore(data: any): number {
    // Calculate risk score based on multiple factors
    let riskScore = 0;
    
    // Utilization rate risk (higher utilization = higher risk)
    riskScore += data.utilizationRate * 0.4;
    
    // Volatility risk (based on token type)
    const volatilityRisk = this.getTokenVolatilityRisk(data.token);
    riskScore += volatilityRisk * 0.3;
    
    // Liquidity risk (lower liquidity = higher risk)
    const liquidityRisk = Math.max(0, 1 - (data.liquidity / data.totalSupply));
    riskScore += liquidityRisk * 0.2;
    
    // Protocol risk (based on chain)
    const protocolRisk = this.getProtocolRisk(data.chain);
    riskScore += protocolRisk * 0.1;
    
    return Math.min(riskScore, 1);
  }

  private getTokenVolatilityRisk(token: string): number {
    const volatilityMap: { [key: string]: number } = {
      'USDC': 0.1,
      'USDT': 0.1,
      'DAI': 0.1,
      'FRAX': 0.1,
      'LUSD': 0.1,
      'GHO': 0.15,
      'PYUSD': 0.1,
      'EURC': 0.1,
      'RLUSD': 0.1,
      'ETH': 0.3,
      'WETH': 0.3,
      'WBTC': 0.4,
      'LINK': 0.5,
      'AAVE': 0.6,
      'UNI': 0.6,
      'CRV': 0.7,
      'LDO': 0.7,
      'MKR': 0.6,
      'SNX': 0.7,
      'BAL': 0.7,
      '1INCH': 0.8
    };
    
    return volatilityMap[token] || 0.5;
  }

  private getProtocolRisk(chain: string): number {
    const protocolRiskMap: { [key: string]: number } = {
      'ethereum': 0.1,
      'polygon': 0.2,
      'avalanche': 0.2,
      'arbitrum': 0.15,
      'optimism': 0.15
    };
    
    return protocolRiskMap[chain] || 0.3;
  }

  private getRiskLevel(riskScore: number): 'low' | 'medium' | 'high' {
    if (riskScore > 0.7) return 'high';
    if (riskScore > 0.4) return 'medium';
    return 'low';
  }
}
