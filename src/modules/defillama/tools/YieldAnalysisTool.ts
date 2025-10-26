import { DeFiLlamaDataFetcher, DeFiLlamaYieldPool } from '../data/DeFiLlamaDataFetcher.js';

export class YieldAnalysisTool {
  constructor(private dataFetcher: DeFiLlamaDataFetcher) {}

  async getYieldPools(args: { chain?: string; minAPY?: number; limit?: number } = {}): Promise<any> {
    try {
      const { chain = 'Ethereum', minAPY = 0.01, limit = 20 } = args;
      const safeLimit = Math.min(Math.max(limit, 1), 100); // MCP optimized limits
      
      const poolsResponse = await this.dataFetcher.getYieldPools();
      
      // Handle API response structure: { status: "success", data: [...] }
      const pools = (poolsResponse as any)?.data || poolsResponse || [];
      
      // Ensure pools is an array
      if (!Array.isArray(pools)) {
        console.warn('getYieldPools returned non-array data, returning empty result');
        return {
          pools: [],
          totalPools: 0,
          totalTVL: 0,
          topPools: [],
          message: 'No yield pools data available',
          lastUpdated: new Date().toISOString()
        };
      }
      
      // Filter by chain and minAPY
      const filteredPools = pools.filter(pool => {
        const chainMatch = !chain || pool.chain?.toLowerCase() === chain.toLowerCase();
        const apyMatch = pool.apy >= minAPY;
        return chainMatch && apyMatch;
      });
      
      // Sort by APY descending
      const sortedPools = filteredPools.sort((a, b) => b.apy - a.apy);
      
      // Apply limit
      const limitedPools = sortedPools.slice(0, safeLimit);
      
      return {
        pools: limitedPools.map(pool => ({
          project: pool.project,
          symbol: pool.symbol,
          apy: pool.apy,
          apyBase: pool.apyBase,
          apyReward: pool.apyReward,
          tvlUsd: pool.tvlUsd,
          chain: pool.chain,
          url: pool.url,
          pool: pool.pool
        })),
        totalPools: pools.length,
        filteredPools: filteredPools.length,
        totalTVL: pools.reduce((sum, pool) => sum + pool.tvlUsd, 0),
        limit: safeLimit,
        chain: chain || 'all',
        minAPY,
        message: `Found ${limitedPools.length} yield pools${chain ? ` on ${chain}` : ''} (limited to ${safeLimit})`
      };
    } catch (error) {
      console.error('Error fetching yield pools:', error);
      throw new Error('Failed to fetch yield pools data');
    }
  }

  async getPoolChart(args: { pool: string }): Promise<any> {
    try {
      const { pool } = args;
      const chartData = await this.dataFetcher.getPoolChart(pool);
      
      return {
        pool,
        chartData,
        message: `Historical APY and TVL data for pool ${pool}`
      };
    } catch (error) {
      console.error(`Error fetching pool chart for ${args.pool}:`, error);
      throw new Error(`Failed to fetch pool chart for ${args.pool}`);
    }
  }

  async getTopYieldPools(args: { chain?: string; minTVL?: number; limit?: number }): Promise<any> {
    try {
      const { chain, minTVL = 1000000, limit = 20 } = args;
      const pools = await this.dataFetcher.getYieldPools();
      
      let filteredPools = pools.filter(pool => pool.tvlUsd >= minTVL);
      
      if (chain) {
        filteredPools = filteredPools.filter(pool => 
          pool.chain.toLowerCase() === chain.toLowerCase()
        );
      }
      
      const sortedPools = filteredPools
        .sort((a, b) => b.apy - a.apy)
        .slice(0, limit);
      
      return {
        chain: chain || 'all',
        minTVL,
        pools: sortedPools.map(pool => ({
          project: pool.project,
          symbol: pool.symbol,
          apy: pool.apy,
          apyBase: pool.apyBase,
          apyReward: pool.apyReward,
          tvlUsd: pool.tvlUsd,
          chain: pool.chain,
          url: pool.url
        })),
        totalPools: filteredPools.length
      };
    } catch (error) {
      console.error('Error fetching top yield pools:', error);
      throw new Error('Failed to fetch top yield pools');
    }
  }

  async getYieldAnalysisByChain(args: { chain?: string }): Promise<any> {
    try {
      const { chain } = args;
      const pools = await this.dataFetcher.getYieldPools();
      
      let filteredPools = pools;
      if (chain) {
        filteredPools = pools.filter(pool => 
          pool.chain.toLowerCase() === chain.toLowerCase()
        );
      }
      
      // Group by chain
      const chainAnalysis = filteredPools.reduce((acc, pool) => {
        const chainName = pool.chain;
        if (!acc[chainName]) {
          acc[chainName] = {
            pools: [],
            totalTVL: 0,
            averageAPY: 0,
            maxAPY: 0,
            minAPY: Infinity
          };
        }
        
        acc[chainName].pools.push(pool);
        acc[chainName].totalTVL += pool.tvlUsd;
        acc[chainName].maxAPY = Math.max(acc[chainName].maxAPY, pool.apy);
        acc[chainName].minAPY = Math.min(acc[chainName].minAPY, pool.apy);
        
        return acc;
      }, {} as Record<string, any>);
      
      // Calculate average APY for each chain
      Object.keys(chainAnalysis).forEach(chainName => {
        const chainData = chainAnalysis[chainName];
        const totalAPY = chainData.pools.reduce((sum: number, pool: DeFiLlamaYieldPool) => sum + pool.apy, 0);
        chainData.averageAPY = totalAPY / chainData.pools.length;
        chainData.poolCount = chainData.pools.length;
        
        if (chainData.minAPY === Infinity) {
          chainData.minAPY = 0;
        }
      });
      
      // Sort chains by total TVL
      const sortedChains = Object.entries(chainAnalysis)
        .map(([chainName, data]) => ({
          chain: chainName,
          ...data
        }))
        .sort((a, b) => b.totalTVL - a.totalTVL);
      
      return {
        chain: chain || 'all',
        chainAnalysis: sortedChains,
        totalChains: sortedChains.length,
        message: `Yield analysis ${chain ? `for ${chain}` : 'across all chains'}`
      };
    } catch (error) {
      console.error('Error analyzing yield by chain:', error);
      throw new Error('Failed to analyze yield by chain');
    }
  }

  async getYieldTrends(args: { timeframe?: string; limit?: number }): Promise<any> {
    try {
      const { limit = 20 } = args;
      const pools = await this.dataFetcher.getYieldPools();
      
      // Analyze APY trends
      const highAPYPools = pools
        .filter(pool => pool.apy > 10) // APY > 10%
        .sort((a, b) => b.apy - a.apy)
        .slice(0, limit);
      
      const stableAPYPools = pools
        .filter(pool => pool.apy > 0 && pool.apy < 20) // Moderate APY
        .sort((a, b) => b.tvlUsd - a.tvlUsd) // Sort by TVL for stability
        .slice(0, limit);
      
      // Analyze by project
      const projectAnalysis = pools.reduce((acc, pool) => {
        const project = pool.project;
        if (!acc[project]) {
          acc[project] = {
            pools: [],
            totalTVL: 0,
            averageAPY: 0,
            maxAPY: 0
          };
        }
        
        acc[project].pools.push(pool);
        acc[project].totalTVL += pool.tvlUsd;
        acc[project].maxAPY = Math.max(acc[project].maxAPY, pool.apy);
        
        return acc;
      }, {} as Record<string, any>);
      
      // Calculate average APY for each project
      Object.keys(projectAnalysis).forEach(project => {
        const projectData = projectAnalysis[project];
        const totalAPY = projectData.pools.reduce((sum: number, pool: DeFiLlamaYieldPool) => sum + pool.apy, 0);
        projectData.averageAPY = totalAPY / projectData.pools.length;
        projectData.poolCount = projectData.pools.length;
      });
      
      // Sort projects by total TVL
      const topProjects = Object.entries(projectAnalysis)
        .map(([project, data]) => ({
          project,
          ...data
        }))
        .sort((a, b) => b.totalTVL - a.totalTVL)
        .slice(0, limit);
      
      return {
        highAPYPools: highAPYPools.map(pool => ({
          project: pool.project,
          symbol: pool.symbol,
          apy: pool.apy,
          tvlUsd: pool.tvlUsd,
          chain: pool.chain
        })),
        stableAPYPools: stableAPYPools.map(pool => ({
          project: pool.project,
          symbol: pool.symbol,
          apy: pool.apy,
          tvlUsd: pool.tvlUsd,
          chain: pool.chain
        })),
        topProjects,
        message: 'Yield farming trends and analysis'
      };
    } catch (error) {
      console.error('Error fetching yield trends:', error);
      throw new Error('Failed to fetch yield trends');
    }
  }

  async getYieldComparison(args: { projects: string[] }): Promise<any> {
    try {
      const { projects } = args;
      const pools = await this.dataFetcher.getYieldPools();
      
      const comparison = projects.map(projectName => {
        const projectPools = pools.filter(pool => 
          pool.project.toLowerCase() === projectName.toLowerCase()
        );
        
        if (projectPools.length === 0) {
          return {
            project: projectName,
            found: false,
            error: 'Project not found'
          };
        }
        
        const totalTVL = projectPools.reduce((sum, pool) => sum + pool.tvlUsd, 0);
        const averageAPY = projectPools.reduce((sum, pool) => sum + pool.apy, 0) / projectPools.length;
        const maxAPY = Math.max(...projectPools.map(pool => pool.apy));
        const minAPY = Math.min(...projectPools.map(pool => pool.apy));
        
        return {
          project: projectName,
          poolCount: projectPools.length,
          totalTVL,
          averageAPY,
          maxAPY,
          minAPY,
          chains: [...new Set(projectPools.map(pool => pool.chain))],
          topPools: projectPools
            .sort((a, b) => b.apy - a.apy)
            .slice(0, 5)
            .map(pool => ({
              symbol: pool.symbol,
              apy: pool.apy,
              tvlUsd: pool.tvlUsd,
              chain: pool.chain
            })),
          found: true
        };
      });
      
      return {
        comparison,
        totalProjects: comparison.filter(p => p.found).length,
        message: `Yield comparison for ${projects.join(', ')}`
      };
    } catch (error) {
      console.error(`Error comparing yield projects ${args.projects}:`, error);
      throw new Error(`Failed to compare yield projects ${args.projects}`);
    }
  }

  async getYieldOpportunities(args: { minAPY?: number; maxRisk?: string; limit?: number }): Promise<any> {
    try {
      const { minAPY = 5, maxRisk = 'medium', limit = 20 } = args;
      const pools = await this.dataFetcher.getYieldPools();
      
      // Filter pools based on criteria
      let filteredPools = pools.filter(pool => pool.apy >= minAPY);
      
      // Risk assessment based on TVL and project
      const riskAssessment = (pool: DeFiLlamaYieldPool) => {
        let riskScore = 0;
        
        // TVL-based risk
        if (pool.tvlUsd < 100000) riskScore += 3; // High risk for low TVL
        else if (pool.tvlUsd < 1000000) riskScore += 2; // Medium risk
        else if (pool.tvlUsd < 10000000) riskScore += 1; // Low risk
        
        // APY-based risk (very high APY might indicate higher risk)
        if (pool.apy > 50) riskScore += 2;
        else if (pool.apy > 20) riskScore += 1;
        
        // Project-based risk (well-known projects are lower risk)
        const establishedProjects = ['aave', 'compound', 'uniswap', 'curve', 'balancer', 'yearn'];
        if (!establishedProjects.includes(pool.project.toLowerCase())) {
          riskScore += 1;
        }
        
        if (riskScore <= 1) return 'low';
        if (riskScore <= 3) return 'medium';
        return 'high';
      };
      
      // Apply risk filter
      if (maxRisk === 'low') {
        filteredPools = filteredPools.filter(pool => riskAssessment(pool) === 'low');
      } else if (maxRisk === 'medium') {
        filteredPools = filteredPools.filter(pool => 
          ['low', 'medium'].includes(riskAssessment(pool))
        );
      }
      
      // Sort by APY descending
      const sortedPools = filteredPools
        .sort((a, b) => b.apy - a.apy)
        .slice(0, limit);
      
      return {
        criteria: {
          minAPY,
          maxRisk,
          limit
        },
        opportunities: sortedPools.map(pool => ({
          project: pool.project,
          symbol: pool.symbol,
          apy: pool.apy,
          apyBase: pool.apyBase,
          apyReward: pool.apyReward,
          tvlUsd: pool.tvlUsd,
          chain: pool.chain,
          risk: riskAssessment(pool),
          url: pool.url
        })),
        totalOpportunities: filteredPools.length,
        message: `Yield opportunities with APY >= ${minAPY}% and risk <= ${maxRisk}`
      };
    } catch (error) {
      console.error('Error fetching yield opportunities:', error);
      throw new Error('Failed to fetch yield opportunities');
    }
  }
}
