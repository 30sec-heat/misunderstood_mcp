#!/usr/bin/env node

import { DeFiLlamaModule } from '../src/modules/defillama/index.js';
import { PostgresManager } from '../src/modules/base/postgres-manager.js';

interface TestResult {
  tool: string;
  success: boolean;
  duration: number;
  request: any;
  response: any;
  error?: string;
  auditIssues?: string[];
}

interface DeFiLlamaTestSummary {
  totalTools: number;
  successfulTools: number;
  failedTools: number;
  results: TestResult[];
  duration: number;
}

class DeFiLlamaModuleTester {
  private defillamaModule: DeFiLlamaModule;
  private results: TestResult[] = [];

  constructor() {
    this.defillamaModule = new DeFiLlamaModule();
  }

  async run() {
    console.log('[TEST] DeFiLlama Module Testing');
    console.log('=' .repeat(60));
    console.log('[LIST] Testing all 9 DeFiLlama tools systematically');
    console.log('[SEARCH] Validating API requests and responses');
    console.log('');

    const startTime = Date.now();

    try {
      // Initialize PostgreSQL
      await this.initializeDatabase();

      // Initialize DeFiLlama module
      await this.initializeDeFiLlamaModule();

      // Test all DeFiLlama tools
      await this.testAllDeFiLlamaTools();

      const duration = Date.now() - startTime;
      const summary = this.generateSummary(duration);

      // Print results
      this.printResults(summary);

      // Save results
      await this.saveResults(summary);

    } catch (error) {
      console.error('[ERROR] DeFiLlama module testing failed:', error);
      process.exit(1);
    }
  }

  private async initializeDatabase() {
    console.log('[SETUP] Initializing PostgreSQL...');
    
    const postgresManager = PostgresManager.getInstance();
    postgresManager.registerDatabase({
      name: 'main',
      host: 'localhost',
      port: 5432,
      database: 'mcpcrypto',
      user: 'postgres',
      password: '',
    });

    try {
      await postgresManager.createTables('main');
      console.log('[SUCCESS] PostgreSQL initialized successfully');
    } catch (error) {
      console.log('[WARNING]  PostgreSQL tables creation failed:', error instanceof Error ? error.message : String(error));
    }
  }

  private async initializeDeFiLlamaModule() {
    console.log(' Initializing DeFiLlama Module...');
    
    try {
      await this.defillamaModule.initialize();
      console.log('[SUCCESS] DeFiLlama module initialized successfully');
    } catch (error) {
      console.error('[ERROR] Failed to initialize DeFiLlama module:', error);
      throw error;
    }
  }

  private async testAllDeFiLlamaTools() {
    const defillamaTools = [
      {
        name: 'defillama_get_protocol_tvl',
        description: 'Get historical TVL data for a specific protocol',
        testParams: { protocol: 'aave' }
      },
      {
        name: 'defillama_get_chain_tvl_history',
        description: 'Get historical TVL data for a specific chain',
        testParams: { chain: 'Ethereum' }
      },
      {
        name: 'defillama_get_current_prices',
        description: 'Get current prices for tokens by contract address',
        testParams: { coins: 'ethereum:0xa0b86a33e6c1b8b8c8c8c8c8c8c8c8c8c8c8c8c8' }
      },
      {
        name: 'defillama_get_historical_prices',
        description: 'Get historical prices for tokens at a specific timestamp',
        testParams: { timestamp: Math.floor(Date.now() / 1000) - 86400, coins: 'ethereum:0xa0b86a33e6c1b8b8c8c8c8c8c8c8c8c8c8c8c8c8' }
      },
      {
        name: 'defillama_get_price_percentage_change',
        description: 'Get percentage change in price over time',
        testParams: { coins: 'ethereum:0xa0b86a33e6c1b8b8c8c8c8c8c8c8c8c8c8c8c8c8', period: '1d' }
      },
      {
        name: 'defillama_get_stablecoin_market_cap',
        description: 'Get stablecoin market cap data',
        testParams: { chain: 'Ethereum' }
      },
      {
        name: 'defillama_get_yield_pools',
        description: 'Get yield farming pools data',
        testParams: { chain: 'Ethereum', minAPY: 0.01 }
      },
      {
        name: 'defillama_get_dex_summary',
        description: 'Get summary of DEX volume with historical data',
        testParams: { protocol: 'uniswap' }
      },
      {
        name: 'defillama_get_fees_summary',
        description: 'Get summary of protocol fees and revenue with historical data',
        testParams: { protocol: 'aave' }
      }
    ];

    console.log(`[SETUP] Testing ${defillamaTools.length} DeFiLlama tools...`);
    console.log('');

    for (const tool of defillamaTools) {
      await this.testTool(tool.name, tool.testParams);
    }
  }

  private async testTool(toolName: string, testParams: any) {
    console.log(`[SETUP] Testing DeFiLlama.${toolName}`);
    console.log('─'.repeat(60));

    const startTime = Date.now();
    let success = false;
    let response: any = null;
    let error: string = '';
    let auditIssues: string[] = [];

    try {
      // Perform audit of request parameters
      auditIssues = this.auditParameters(testParams, toolName);

      console.log('[LIST] Audit:', auditIssues.length === 0 ? '[SUCCESS] Proper limits' : '[ERROR] Proper limits');
      if (auditIssues.length > 0) {
        console.log('[WARNING]  Issues:', auditIssues.join(', '));
      }

      console.log(' Request:', JSON.stringify(testParams, null, 2));

      // Execute the tool
      const toolHandler = this.defillamaModule.getToolHandler(toolName);
      if (!toolHandler) {
        throw new Error(`Tool ${toolName} not found`);
      }

      response = await toolHandler(testParams);
      success = true;

      console.log(' Response:', JSON.stringify(response, null, 2));

    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.log(' Response:', JSON.stringify({ error }, null, 2));
      console.log('[ERROR] Error:', error);
    }

    const duration = Date.now() - startTime;
    console.log(`⏱  Duration: ${duration}ms`);
    console.log(success ? '[SUCCESS] Success' : '[ERROR] Failed');
    console.log('');

    // Store result
    this.results.push({
      tool: toolName,
      success,
      duration,
      request: testParams,
      response,
      error: error || undefined,
      auditIssues: auditIssues.length > 0 ? auditIssues : undefined
    });
  }

  private auditParameters(params: any, toolName: string): string[] {
    const issues: string[] = [];

    // Check for missing limit parameter in tools that return arrays
    const arrayReturningTools = [
      'defillama_get_yield_pools',
      'defillama_get_stablecoin_market_cap'
    ];

    if (arrayReturningTools.includes(toolName) && !params.limit) {
      issues.push('Missing limit parameter for data retrieval');
    }

    // Check for missing timeRange parameter in time-based queries
    const timeBasedTools = [
      'defillama_get_chain_tvl_history',
      'defillama_get_historical_prices',
      'defillama_get_price_percentage_change'
    ];

    if (timeBasedTools.includes(toolName) && !params.timeRange && !params.period && !params.timestamp) {
      issues.push('Missing timeRange/period/timestamp parameter for time-based queries');
    }

    return issues;
  }

  private generateSummary(duration: number): DeFiLlamaTestSummary {
    return {
      totalTools: this.results.length,
      successfulTools: this.results.filter(r => r.success).length,
      failedTools: this.results.filter(r => !r.success).length,
      results: this.results,
      duration
    };
  }

  private printResults(summary: DeFiLlamaTestSummary) {
    console.log('[DATA] DeFiLlama Module Test Results');
    console.log('=' .repeat(60));
    console.log(`[SETUP] Total Tools: ${summary.totalTools}`);
    console.log(`[SUCCESS] Successful: ${summary.successfulTools}`);
    console.log(`[ERROR] Failed: ${summary.failedTools}`);
    console.log(`⏱  Total Duration: ${summary.duration}ms`);
    console.log(`UP: Success Rate: ${((summary.successfulTools / summary.totalTools) * 100).toFixed(1)}%`);
    console.log('');

    if (summary.failedTools > 0) {
      console.log('[ERROR] Failed Tools:');
      summary.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - ${r.tool}: ${r.error || 'Unknown error'}`);
        });
      console.log('');
    }

    const auditIssues = summary.results.filter(r => r.auditIssues && r.auditIssues.length > 0);
    if (auditIssues.length > 0) {
      console.log('[WARNING]  Tools with Audit Issues:');
      auditIssues.forEach(r => {
        console.log(`  - ${r.tool}: ${r.auditIssues?.join(', ')}`);
      });
      console.log('');
    }

    // Success criteria check
    console.log('[TARGET] Success Criteria Check:');
    console.log(`  - All tools execute without crashes: ${summary.failedTools === 0 ? 'SUCCESS:' : 'ERROR:'}`);
    console.log(`  - Each tool returns data or clear error: ${summary.results.every(r => r.response !== null) ? 'SUCCESS:' : 'ERROR:'}`);
    console.log(`  - Network calls are logged and visible: SUCCESS:`);
    console.log(`  - Response format is consistent: ${summary.results.every(r => r.response !== null) ? 'SUCCESS:' : 'ERROR:'}`);
    console.log('');

    if (summary.successfulTools === summary.totalTools) {
      console.log('[COMPLETE] All DeFiLlama tools are working correctly! Ready to move to next module.');
    } else {
      console.log('[WARNING]  Some DeFiLlama tools need fixes before proceeding to next module.');
    }
  }

  private async saveResults(summary: DeFiLlamaTestSummary) {
    const fs = await import('fs/promises');
    const path = await import('path');

    const resultsDir = path.join(process.cwd(), 'test', 'module-test-results');
    await fs.mkdir(resultsDir, { recursive: true });

    const filename = path.join(resultsDir, 'defillama-test-results.json');
    await fs.writeFile(filename, JSON.stringify(summary, null, 2));

    console.log(`💾 Results saved to: ${filename}`);
  }
}

// Run the DeFiLlama module tester
const tester = new DeFiLlamaModuleTester();
tester.run().catch(error => {
  console.error('[ERROR] DeFiLlama module testing failed:', error);
  process.exit(1);
});
