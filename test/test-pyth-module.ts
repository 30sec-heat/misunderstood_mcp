import { PythNetworkModule } from '../src/modules/pyth/index.js';
import fs from 'fs';
import path from 'path';

class PythModuleTester {
  private pythModule: PythNetworkModule;
  private results: any[] = [];

  constructor() {
    this.pythModule = new PythNetworkModule();
  }

  async runTests() {
    console.log('[SEARCH] Testing Pyth Network Module...\n');
    
    try {
      await this.pythModule.initialize();
      console.log('[SUCCESS] Pyth Network module initialized successfully\n');
    } catch (error) {
      console.error('[ERROR] Failed to initialize Pyth Network module:', error);
      return;
    }

    // Define all Pyth tools with test parameters
    const pythTools = [
      {
        name: 'pyth_get_price',
        description: 'Get real-time price for a specific symbol from Pyth Network',
        testParams: { symbol: 'Crypto.BTC/USD' }
      },
      {
        name: 'pyth_get_tradfi_prices',
        description: 'Get real-time TradFi asset prices for a specific category',
        testParams: { category: 'crypto' }
      },
      {
        name: 'pyth_get_available_symbols',
        description: 'Get list of available symbols on Pyth Network with search capability',
        testParams: { search: 'BTC', category: 'crypto' }
      },
      {
        name: 'pyth_refresh_feeds_cache',
        description: 'Refresh the Pyth price feeds cache',
        testParams: {}
      },
      {
        name: 'pyth_get_feeds_stats',
        description: 'Get statistics about available Pyth price feeds',
        testParams: {}
      },
      {
        name: 'pyth_get_historical_data',
        description: 'Get historical price data for a symbol',
        testParams: { 
          symbol: 'Crypto.BTC/USD', 
          resolution: '1D', 
          from: Math.floor(Date.now() / 1000) - 86400 * 7, // 7 days ago
          to: Math.floor(Date.now() / 1000) 
        }
      },
      {
        name: 'pyth_get_latest_updates',
        description: 'Get latest price updates for specific price feed IDs',
        testParams: { 
          ids: ['0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'] // BTC/USD feed ID
        }
      },
      {
        name: 'pyth_search_symbols',
        description: 'Search for symbols with advanced filtering',
        testParams: { query: 'BTC', asset_type: 'crypto' }
      },
      {
        name: 'pyth_get_symbols_by_asset_type',
        description: 'Get all symbols filtered by asset type',
        testParams: { asset_type: 'crypto' }
      },
      {
        name: 'pyth_get_symbols_by_country',
        description: 'Get all symbols filtered by country',
        testParams: { country: 'US' }
      },
      {
        name: 'pyth_advanced_symbol_search',
        description: 'Advanced symbol search with multiple filters',
        testParams: { symbol: 'BTC', asset_type: 'crypto' }
      }
    ];

    // Test each tool
    for (const tool of pythTools) {
      await this.testTool(tool.name, tool.description, tool.testParams);
    }

    // Save results
    await this.saveResults();
    
    console.log('\n[TARGET] Pyth Network Module Testing Complete!');
    console.log(`[DATA] Tested ${pythTools.length} tools`);
    console.log(`[SUCCESS] Successful: ${this.results.filter(r => r.success).length}`);
    console.log(`[ERROR] Failed: ${this.results.filter(r => !r.success).length}`);
  }

  private async testTool(toolName: string, description: string, testParams: any) {
    console.log(`[SETUP] Testing Pyth.${toolName}`);
    console.log('─'.repeat(80));
    console.log(`[LIST] Description: ${description}`);
    
    // Audit parameters
    const auditIssues = this.auditParameters(testParams, toolName);
    if (auditIssues.length > 0) {
      console.log(`[LIST] Audit: [ERROR] Issues found`);
      console.log(`[WARNING]  Issues: ${auditIssues.join(', ')}`);
    } else {
      console.log(`[LIST] Audit: [SUCCESS] Proper parameters`);
    }

    console.log(` Request: ${JSON.stringify(testParams, null, 2)}`);

    let response: any;
    let success = false;
    const startTime = Date.now();

    try {
      // Execute the tool
      const toolHandler = this.pythModule.getToolHandler(toolName);
      if (!toolHandler) {
        throw new Error(`Tool ${toolName} not found`);
      }

      response = await toolHandler(testParams);
      success = true;
    } catch (error: any) {
      response = {
        error: error.message,
        message: `Error executing ${toolName}`
      };
      success = false;
    }

    const duration = Date.now() - startTime;

    console.log(` Response: ${JSON.stringify(response, null, 2)}`);
    console.log(`⏱  Duration: ${duration}ms`);

    if (success) {
      console.log('[SUCCESS] Success');
    } else {
      console.log(`[ERROR] Error: ${response.error || 'Unknown error'}`);
    }

    // Store result
    this.results.push({
      toolName,
      description,
      testParams,
      response,
      success,
      duration,
      auditIssues,
      timestamp: new Date().toISOString()
    });

    console.log('');
  }

  private auditParameters(params: any, toolName: string): string[] {
    const issues: string[] = [];

    // Check for missing limit parameter in tools that return arrays
    const arrayReturningTools = [
      'pyth_get_available_symbols',
      'pyth_get_tradfi_prices',
      'pyth_search_symbols',
      'pyth_get_symbols_by_asset_type',
      'pyth_get_symbols_by_country',
      'pyth_advanced_symbol_search'
    ];

    if (arrayReturningTools.includes(toolName) && !params.limit) {
      issues.push('Missing limit parameter for data retrieval');
    }

    // Check for missing timeRange parameter in time-based queries
    const timeBasedTools = [
      'pyth_get_historical_data'
    ];

    if (timeBasedTools.includes(toolName) && !params.from && !params.to) {
      issues.push('Missing from/to parameters for time-based queries');
    }

    // Check for missing required parameters
    if (toolName === 'pyth_get_price' && !params.symbol) {
      issues.push('Missing required symbol parameter');
    }

    if (toolName === 'pyth_get_tradfi_prices' && !params.category) {
      issues.push('Missing required category parameter');
    }

    if (toolName === 'pyth_get_latest_updates' && (!params.ids || !Array.isArray(params.ids))) {
      issues.push('Missing or invalid ids parameter (must be array)');
    }

    return issues;
  }

  private async saveResults() {
    const resultsDir = path.join(process.cwd(), 'test', 'module-test-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const resultsFile = path.join(resultsDir, 'pyth-test-results.json');
    const detailedResultsFile = path.join(resultsDir, 'pyth-detailed-results.json');

    // Save summary results
    const summary = {
      module: 'Pyth Network',
      totalTools: this.results.length,
      successfulTools: this.results.filter(r => r.success).length,
      failedTools: this.results.filter(r => !r.success).length,
      averageDuration: this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length,
      timestamp: new Date().toISOString(),
      results: this.results.map(r => ({
        toolName: r.toolName,
        success: r.success,
        duration: r.duration,
        hasData: r.success && r.response && !r.response.error,
        auditIssues: r.auditIssues
      }))
    };

    fs.writeFileSync(resultsFile, JSON.stringify(summary, null, 2));

    // Save detailed results
    fs.writeFileSync(detailedResultsFile, JSON.stringify({
      module: 'Pyth Network',
      timestamp: new Date().toISOString(),
      results: this.results
    }, null, 2));

    console.log(` Results saved to:`);
    console.log(`   Summary: ${resultsFile}`);
    console.log(`   Detailed: ${detailedResultsFile}`);
  }
}

// Run the tests
const tester = new PythModuleTester();
tester.runTests().catch(console.error);
