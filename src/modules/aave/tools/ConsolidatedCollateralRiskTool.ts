import { AaveV3DataFetcher } from '../data/AaveV3DataFetcher.js';

interface CollateralFactor {
  token: string;
  chain: string;
  collateralFactor: number;
  liquidationThreshold: number;
  liquidationPenalty: number;
  lastUpdated: string;
}

interface CollateralHealth {
  userAddress: string;
  chain: string;
  totalCollateralValue: number;
  totalBorrowedValue: number;
  healthFactor: number;
  collateralRatio: number;
  liquidationRisk: 'low' | 'medium' | 'high';
  recommendations: string[];
  lastUpdated: string;
}

interface LiquidationRisk {
  userAddress: string;
  chain: string;
  currentHealthFactor: number;
  liquidationPrice: number;
  scenarios: Array<{
    priceDrop: number;
    newHealthFactor: number;
    liquidationRisk: 'low' | 'medium' | 'high';
  }>;
  recommendations: string[];
  lastUpdated: string;
}

interface ConsolidatedCollateralRiskResponse {
  collateralFactors?: CollateralFactor[];
  collateralHealth?: CollateralHealth;
  liquidationRisk?: LiquidationRisk;
  chain: string;
  userAddress?: string;
  asset?: string;
  message: string;
  lastUpdated: string;
}

export class ConsolidatedCollateralRiskTool {
  constructor(private dataFetcher: AaveV3DataFetcher) {}

  async getCollateralHealthAndLiquidationRisk(args: any): Promise<any> {
    try {
      const { 
        userAddress, 
        chain = 'ethereum', 
        asset,
        includeFactors = false,
        scenarios = [0.1, 0.2, 0.3],
        includeRecommendations = true 
      } = args;

      let collateralFactors: CollateralFactor[] | undefined;
      let collateralHealth: CollateralHealth | undefined;
      let liquidationRisk: LiquidationRisk | undefined;

      // Get collateral factors if requested or if no user address provided
      if (includeFactors || !userAddress) {
        try {
          const factorsData = await this.dataFetcher.getCollateralFactors(chain);
          
          // Filter by asset if specified
          const filteredFactors = asset ? 
            factorsData.filter(factor => factor.token.toLowerCase() === asset.toLowerCase()) :
            factorsData;

          collateralFactors = filteredFactors.map(data => ({
            token: data.token,
            chain: data.chain,
            collateralFactor: Math.round(data.ltv * 100) / 100,
            liquidationThreshold: Math.round(data.liquidationThreshold * 100) / 100,
            liquidationPenalty: Math.round(data.liquidationPenalty * 100) / 100,
            lastUpdated: data.lastUpdated
          }));
        } catch (factorsError) {
          console.warn('Failed to fetch collateral factors:', factorsError);
        }
      }

      // Get user-specific data if user address is provided
      if (userAddress) {
        try {
          // Get collateral health
          const userPosition = await this.getUserPosition(userAddress, chain);
          
          if (userPosition) {
            const totalCollateralValue = userPosition.totalCollateralValue;
            const totalBorrowedValue = userPosition.totalBorrowedValue;
            const collateralRatio = totalBorrowedValue / totalCollateralValue;
            const healthFactor = totalCollateralValue / totalBorrowedValue;
            
            let liquidationRiskLevel: 'low' | 'medium' | 'high' = 'low';
            if (healthFactor < 1.5) liquidationRiskLevel = 'high';
            else if (healthFactor < 2.0) liquidationRiskLevel = 'medium';
            
            const recommendations: string[] = [];
            if (includeRecommendations) {
              if (healthFactor < 2.0) {
                recommendations.push('Consider adding more collateral to improve health factor');
              }
              if (collateralRatio > 0.8) {
                recommendations.push('High collateral utilization - consider reducing borrowed amount');
              }
              if (liquidationRiskLevel === 'high') {
                recommendations.push('URGENT: Health factor below 1.5 - risk of liquidation');
              }
              if (liquidationRiskLevel === 'medium') {
                recommendations.push('Monitor health factor closely - approaching liquidation risk');
              }
              recommendations.push('Monitor health factor regularly and maintain buffer above 1.5');
            }

            collateralHealth = {
              userAddress,
              chain,
              totalCollateralValue: Math.round(totalCollateralValue * 100) / 100,
              totalBorrowedValue: Math.round(totalBorrowedValue * 100) / 100,
              healthFactor: Math.round(healthFactor * 100) / 100,
              collateralRatio: Math.round(collateralRatio * 100) / 100,
              liquidationRisk: liquidationRiskLevel,
              recommendations,
              lastUpdated: new Date().toISOString()
            };

            // Calculate liquidation risk scenarios
            const currentHealthFactor = userPosition.healthFactor || healthFactor;
            const liquidationPrice = userPosition.liquidationThreshold || 0;
            
            const scenarioAnalysis = scenarios.map((priceDrop: number) => {
              const newHealthFactor = currentHealthFactor * (1 - priceDrop);
              let scenarioLiquidationRisk: 'low' | 'medium' | 'high' = 'low';
              
              if (newHealthFactor < 1.5) scenarioLiquidationRisk = 'high';
              else if (newHealthFactor < 2.0) scenarioLiquidationRisk = 'medium';
              
              return {
                priceDrop: Math.round(priceDrop * 100) / 100,
                newHealthFactor: Math.round(newHealthFactor * 100) / 100,
                liquidationRisk: scenarioLiquidationRisk
              };
            });

            const liquidationRecommendations: string[] = [];
            if (includeRecommendations) {
              if (currentHealthFactor < 2.0) {
                liquidationRecommendations.push('Consider adding more collateral to improve health factor');
              }
              if (scenarioAnalysis.some((s: any) => s.liquidationRisk === 'high')) {
                liquidationRecommendations.push('High risk of liquidation in market downturns');
              }
              liquidationRecommendations.push('Monitor health factor regularly and maintain buffer above 1.5');
            }

            liquidationRisk = {
              userAddress,
              chain,
              currentHealthFactor: Math.round(currentHealthFactor * 100) / 100,
              liquidationPrice: Math.round(liquidationPrice * 100) / 100,
              scenarios: scenarioAnalysis,
              recommendations: liquidationRecommendations,
              lastUpdated: new Date().toISOString()
            };
          }
        } catch (userError) {
          console.warn('Failed to fetch user position data:', userError);
        }
      }

      const response: ConsolidatedCollateralRiskResponse = {
        collateralFactors,
        collateralHealth,
        liquidationRisk,
        chain,
        userAddress,
        asset,
        message: userAddress ? 
          `Collateral health and liquidation risk analysis for ${userAddress} on ${chain}` :
          `Collateral factors retrieved for ${chain}`,
        lastUpdated: new Date().toISOString()
      };

      return response;

    } catch (error) {
      return {
        error: `Failed to get collateral health and liquidation risk: ${error}`,
        message: 'Error retrieving consolidated collateral and risk data'
      };
    }
  }

  private async getUserPosition(userAddress: string, chain: string): Promise<any> {
    try {
      // Get user position data from Aave v3 API
      const userPosition = await this.dataFetcher.getUserPosition(userAddress, chain);
      
      if (!userPosition) {
        return null;
      }

      return {
        totalCollateralValue: userPosition.totalCollateralBase,
        totalBorrowedValue: userPosition.totalDebtBase,
        healthFactor: userPosition.healthFactor,
        netWorth: userPosition.netWorth,
        availableBorrows: userPosition.availableBorrowsBase,
        liquidationThreshold: userPosition.currentLiquidationThreshold
      };
    } catch (error) {
      console.error('Failed to get user position:', error);
      return null;
    }
  }
}
