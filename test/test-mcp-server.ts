#!/usr/bin/env tsx

import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'error';
  message: string;
  duration: number;
  details?: any;
}

class MCPServerTester {
  private client: Client | null = null;
  private serverProcess: ChildProcess | null = null;
  private transport: StdioClientTransport | null = null;
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting MCP Server Comprehensive Test Suite');
    console.log('=' .repeat(60));
    console.log(`⏰ Started: ${new Date().toLocaleString()}`);
    console.log('=' .repeat(60));

    try {
      // Test 1: Server startup and connection
      await this.testServerStartup();

      if (this.client) {
        // Test 2: Tool listing
        await this.testToolListing();

        // Test 3: Test key crypto tools
        await this.testCryptoTools();

        // Test 4: Test error handling
        await this.testErrorHandling();

        // Test 5: Test performance
        await this.testPerformance();
      }

    } catch (error) {
      console.error('❌ Test suite failed:', error);
    } finally {
      await this.cleanup();
      this.printSummary();
    }
  }

  private async testServerStartup(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('\n🚀 Test 1: Server Startup and Connection');
      console.log('-'.repeat(40));

      // Start the MCP server process
      this.serverProcess = spawn('npm', ['run', 'mcp-server'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      // Wait for server to initialize
      await this.waitForServerReady();

      // Create MCP client
      this.client = new Client(
        {
          name: 'mcp-test-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Create transport with server parameters
      this.transport = new StdioClientTransport();
      
      // Connect client with the server process
      await this.client.connect(this.transport);

      const duration = Date.now() - startTime;
      this.results.push({
        name: 'Server Startup and Connection',
        status: 'passed',
        message: 'Successfully started server and established MCP connection',
        duration,
      });

      console.log('✅ Server startup and connection successful');

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.push({
        name: 'Server Startup and Connection',
        status: 'failed',
        message: `Failed to start server or connect: ${error.message}`,
        duration,
        details: error
      });

      console.log('❌ Server startup failed:', error.message);
      throw error;
    }
  }

  private async waitForServerReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout (30s)'));
      }, 30000);

      let output = '';
      
      this.serverProcess!.stderr!.on('data', (data) => {
        output += data.toString();
        if (output.includes('Server is ready to receive MCP requests') || 
            output.includes('Waiting for MCP client connections')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      this.serverProcess!.stdout!.on('data', (data) => {
        output += data.toString();
        if (output.includes('Server is ready to receive MCP requests') || 
            output.includes('Waiting for MCP client connections')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      this.serverProcess!.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.serverProcess!.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });
    });
  }

  private async testToolListing(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('\n🛠️  Test 2: Tool Listing');
      console.log('-'.repeat(40));

      const response = await this.client!.request(
        { method: 'tools/list' },
        ListToolsRequestSchema
      );

      const tools = response.tools || [];
      const duration = Date.now() - startTime;

      console.log(`📊 Found ${tools.length} tools`);
      
      // Categorize tools
      const categories = this.categorizeTools(tools);
      console.log('📋 Tool categories:');
      Object.entries(categories).forEach(([category, count]) => {
        console.log(`   ${category}: ${count} tools`);
      });

      // Sample some tool names
      console.log('🔧 Sample tools:');
      tools.slice(0, 10).forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description?.substring(0, 60)}...`);
      });

      this.results.push({
        name: 'Tool Listing',
        status: 'passed',
        message: `Successfully retrieved ${tools.length} tools`,
        duration,
        details: { tool_count: tools.length, categories }
      });

      console.log('✅ Tool listing successful');

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.push({
        name: 'Tool Listing',
        status: 'failed',
        message: `Failed to list tools: ${error.message}`,
        duration,
        details: error
      });

      console.log('❌ Tool listing failed:', error.message);
    }
  }

  private categorizeTools(tools: any[]): Record<string, number> {
    const categories: Record<string, number> = {};
    
    tools.forEach(tool => {
      const name = tool.name.toLowerCase();
      let category = 'other';
      
      if (name.includes('quote') || name.includes('price')) category = 'market_data';
      else if (name.includes('news') || name.includes('breaking')) category = 'news';
      else if (name.includes('sentiment') || name.includes('social')) category = 'sentiment';
      else if (name.includes('trade') || name.includes('order')) category = 'trading';
      else if (name.includes('defi') || name.includes('aave') || name.includes('defillama')) category = 'defi';
      else if (name.includes('chart') || name.includes('analysis')) category = 'analysis';
      else if (name.includes('forecast') || name.includes('predict')) category = 'forecasting';
      else if (name.includes('liquidation')) category = 'liquidations';
      else if (name.includes('dex') || name.includes('token')) category = 'dex';
      else if (name.includes('config') || name.includes('health')) category = 'system';
      
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return categories;
  }

  private async testCryptoTools(): Promise<void> {
    console.log('\n💰 Test 3: Key Crypto Tools');
    console.log('-'.repeat(40));

    const keyTools = [
      {
        name: 'quote_get_price',
        args: { symbol: 'BTC' },
        description: 'Get Bitcoin price'
      },
      {
        name: 'news_search',
        args: { query: 'bitcoin', limit: 5 },
        description: 'Search crypto news'
      },
      {
        name: 'sentiment_get_health',
        args: {},
        description: 'Check sentiment data sources'
      },
      {
        name: 'defillama_get_tvl_analysis',
        args: { protocol: 'uniswap' },
        description: 'Get DeFi TVL data'
      },
      {
        name: 'dexscreener_get_pair_analysis',
        args: { address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640' },
        description: 'Get DEX pair analysis'
      }
    ];

    for (const tool of keyTools) {
      await this.testSingleTool(tool.name, tool.args, tool.description);
    }
  }

  private async testSingleTool(toolName: string, args: any, description: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🔧 Testing: ${description}`);
      
      const response = await this.client!.request(
        {
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          }
        },
        CallToolRequestSchema
      );

      const duration = Date.now() - startTime;
      
      // Check if response has content
      const hasContent = response.content && response.content.length > 0;
      const contentPreview = hasContent ? 
        JSON.stringify(response.content[0]).substring(0, 100) + '...' : 
        'No content';

      this.results.push({
        name: `Tool: ${toolName}`,
        status: 'passed',
        message: `Tool executed successfully in ${duration}ms`,
        duration,
        details: { args, response_preview: contentPreview }
      });

      console.log(`   ✅ ${toolName} - ${duration}ms`);
      console.log(`   📄 Response preview: ${contentPreview}`);

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.push({
        name: `Tool: ${toolName}`,
        status: 'failed',
        message: `Tool execution failed: ${error.message}`,
        duration,
        details: { args, error: error.message }
      });

      console.log(`   ❌ ${toolName} failed: ${error.message}`);
    }
  }

  private async testErrorHandling(): Promise<void> {
    console.log('\n🛡️  Test 4: Error Handling');
    console.log('-'.repeat(40));

    const errorTests = [
      {
        name: 'nonexistent_tool',
        args: {},
        description: 'Test nonexistent tool'
      },
      {
        name: 'quote_get_price',
        args: { symbol: 'INVALID_SYMBOL_12345' },
        description: 'Test invalid symbol'
      },
      {
        name: 'quote_get_price',
        args: { symbol: null },
        description: 'Test null arguments'
      }
    ];

    for (const test of errorTests) {
      await this.testErrorCase(test.name, test.args, test.description);
    }
  }

  private async testErrorCase(toolName: string, args: any, description: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🧪 Testing: ${description}`);
      
      const response = await this.client!.request(
        {
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          }
        },
        CallToolRequestSchema
      );

      const duration = Date.now() - startTime;
      
      // For error cases, we expect either an error or a graceful error response
      const isGracefulError = response.content && 
        response.content.some((c: any) => 
          c.text && (c.text.includes('error') || c.text.includes('failed'))
        );

      this.results.push({
        name: `Error Test: ${description}`,
        status: isGracefulError ? 'passed' : 'failed',
        message: isGracefulError ? 
          'Server handled error gracefully' : 
          'Server did not handle error as expected',
        duration,
        details: { args, response }
      });

      console.log(`   ${isGracefulError ? '✅' : '⚠️'} ${description} - ${duration}ms`);

    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // For some error cases, throwing an exception is expected
      const isExpectedError = toolName === 'nonexistent_tool';
      
      this.results.push({
        name: `Error Test: ${description}`,
        status: isExpectedError ? 'passed' : 'failed',
        message: isExpectedError ? 
          'Server correctly threw error for invalid tool' : 
          `Unexpected error: ${error.message}`,
        duration,
        details: { args, error: error.message }
      });

      console.log(`   ${isExpectedError ? '✅' : '❌'} ${description} - Error: ${error.message}`);
    }
  }

  private async testPerformance(): Promise<void> {
    console.log('\n⚡ Test 5: Performance');
    console.log('-'.repeat(40));

    const performanceTests = [
      {
        name: 'quote_get_price',
        args: { symbol: 'ETH' },
        description: 'Quick price lookup'
      },
      {
        name: 'sentiment_get_health',
        args: {},
        description: 'Health check'
      }
    ];

    const iterations = 3;
    
    for (const test of performanceTests) {
      const times: number[] = [];
      
      console.log(`🏃 Performance test: ${test.description} (${iterations} iterations)`);
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        try {
          await this.client!.request(
            {
              method: 'tools/call',
              params: {
                name: test.name,
                arguments: test.args
              }
            },
            CallToolRequestSchema
          );
          
          const duration = Date.now() - startTime;
          times.push(duration);
          console.log(`   Iteration ${i + 1}: ${duration}ms`);
          
        } catch (error: any) {
          console.log(`   Iteration ${i + 1}: Error - ${error.message}`);
        }
      }
      
      if (times.length > 0) {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        
        this.results.push({
          name: `Performance: ${test.description}`,
          status: avgTime < 5000 ? 'passed' : 'failed', // 5 second threshold
          message: `Average response time: ${avgTime.toFixed(0)}ms`,
          duration: avgTime,
          details: { min: minTime, max: maxTime, avg: avgTime, iterations: times.length }
        });
        
        console.log(`   📊 Average: ${avgTime.toFixed(0)}ms, Min: ${minTime}ms, Max: ${maxTime}ms`);
      }
    }
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up...');
    
    try {
      if (this.client) {
        await this.client.close();
      }
      
      if (this.transport) {
        await this.transport.close();
      }
      
      if (this.serverProcess) {
        this.serverProcess.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            this.serverProcess!.kill('SIGKILL');
            resolve();
          }, 5000);
          
          this.serverProcess!.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      
      console.log('✅ Cleanup completed');
    } catch (error: any) {
      console.log('⚠️  Cleanup error:', error.message);
    }
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(60));
    
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const errors = this.results.filter(r => r.status === 'error').length;
    const total = this.results.length;
    
    console.log(`📊 Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)`);
    console.log(`💥 Errors: ${errors} (${((errors / total) * 100).toFixed(1)}%)`);
    
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / total;
    console.log(`⏱️  Average Duration: ${avgDuration.toFixed(0)}ms`);
    
    // Show failed tests
    const failedTests = this.results.filter(r => r.status === 'failed' || r.status === 'error');
    if (failedTests.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      failedTests.forEach(test => {
        console.log(`   • ${test.name}: ${test.message}`);
      });
    }
    
    // Show performance summary
    const perfTests = this.results.filter(r => r.name.startsWith('Performance:'));
    if (perfTests.length > 0) {
      console.log('\n⚡ PERFORMANCE SUMMARY:');
      perfTests.forEach(test => {
        const details = test.details as any;
        console.log(`   • ${test.name}: ${test.message} (min: ${details.min}ms, max: ${details.max}ms)`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`🏁 Test completed at ${new Date().toLocaleString()}`);
    console.log('='.repeat(60));
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new MCPServerTester();
  
  process.on('SIGINT', async () => {
    console.log('\n\n⚠️  Test interrupted by user');
    await tester['cleanup']();
    process.exit(130);
  });
  
  tester.runAllTests().catch((error) => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
}

export { MCPServerTester };