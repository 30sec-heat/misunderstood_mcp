#!/usr/bin/env npx tsx

import { spawn, ChildProcess } from 'child_process';
import { writeFileSync } from 'fs';

interface ToolTest {
  name: string;
  tool: string;
  args: any;
  description: string;
  expectedFields?: string[];
}

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'error';
  message: string;
  duration: number;
  details?: any;
}

class CryptoToolsTester {
  private results: TestResult[] = [];

  async runTests(): Promise<void> {
    console.log('💰 Crypto Tools Functionality Test');
    console.log('=' .repeat(50));
    console.log(`⏰ Started: ${new Date().toLocaleString()}`);
    console.log('=' .repeat(50));

    const toolTests: ToolTest[] = [
      // Market Data Tools
      {
        name: 'Bitcoin Price Quote',
        tool: 'quote_get_price',
        args: { symbol: 'BTC' },
        description: 'Get Bitcoin current price',
        expectedFields: ['price', 'symbol']
      },
      {
        name: 'Ethereum Price Quote',
        tool: 'quote_get_price',
        args: { symbol: 'ETH' },
        description: 'Get Ethereum current price',
        expectedFields: ['price', 'symbol']
      },
      
      // News Tools
      {
        name: 'Crypto News Search',
        tool: 'news_search',
        args: { query: 'bitcoin', limit: 5 },
        description: 'Search for Bitcoin news',
        expectedFields: ['results']
      },
      {
        name: 'Breaking News',
        tool: 'breaking_news_get_latest',
        args: { limit: 3 },
        description: 'Get latest breaking crypto news',
        expectedFields: ['news']
      },
      
      // Sentiment Analysis
      {
        name: 'Sentiment Health Check',
        tool: 'sentiment_get_health',
        args: {},
        description: 'Check sentiment data sources availability',
        expectedFields: ['availability']
      },
      {
        name: 'Bitcoin Sentiment',
        tool: 'sentiment_get_symbol_sentiment',
        args: { symbol: 'BTC', time_range: '24h' },
        description: 'Get Bitcoin sentiment analysis',
        expectedFields: ['symbol', 'score']
      },
      
      // DeFi Tools
      {
        name: 'Uniswap TVL Analysis',
        tool: 'defillama_get_tvl_analysis',
        args: { protocol: 'uniswap' },
        description: 'Get Uniswap TVL data',
        expectedFields: ['protocol', 'tvl']
      },
      {
        name: 'DeFi Yield Analysis',
        tool: 'defillama_get_yield_analysis',
        args: { chain: 'ethereum', limit: 5 },
        description: 'Get DeFi yield opportunities',
        expectedFields: ['pools']
      },
      
      // DEX Tools
      {
        name: 'ETH/USDC Pair Analysis',
        tool: 'dexscreener_get_pair_analysis',
        args: { address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640' },
        description: 'Analyze ETH/USDC pair on Uniswap V3',
        expectedFields: ['pair', 'price']
      },
      
      // Aave Tools
      {
        name: 'Aave Rates Analysis',
        tool: 'aave_get_consolidated_rates_analysis',
        args: { assets: ['USDC', 'ETH'], market: 'main' },
        description: 'Get Aave lending rates',
        expectedFields: ['rates']
      },
      
      // Economic Data
      {
        name: 'Economic Tickers',
        tool: 'get_econ_tickers',
        args: { category: 'inflation' },
        description: 'Get inflation economic indicators',
        expectedFields: ['tickers']
      },
      
      // Liquidations
      {
        name: 'Liquidation Analysis',
        tool: 'liquidations_get_analysis',
        args: { symbol: 'BTC', timeframe: '24h' },
        description: 'Get Bitcoin liquidation data',
        expectedFields: ['symbol', 'liquidations']
      },
      
      // Trading Tools
      {
        name: 'Trading Signals',
        tool: 'trading_get_signals',
        args: { symbol: 'BTC', timeframe: '1h' },
        description: 'Get Bitcoin trading signals',
        expectedFields: ['signals']
      }
    ];

    console.log(`🧪 Testing ${toolTests.length} crypto tools...\n`);

    for (const test of toolTests) {
      await this.testCryptoTool(test);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.printSummary();
  }

  private async testCryptoTool(test: ToolTest): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🔧 Testing: ${test.description}`);

      const serverProcess = spawn('npm', ['run', 'mcp-server'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let response = '';
      let ready = false;
      let serverOutput = '';

      // Collect server output for debugging
      serverProcess.stderr!.on('data', (data) => {
        serverOutput += data.toString();
      });

      // Wait for server ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Server ready timeout'));
        }, 30000);

        const checkReady = (data: Buffer) => {
          const output = data.toString();
          serverOutput += output;
          if (output.includes('Server is ready to receive MCP requests') || 
              output.includes('Waiting for MCP client connections')) {
            ready = true;
            clearTimeout(timeout);
            resolve();
          }
        };

        serverProcess.stdout!.on('data', checkReady);
        serverProcess.stderr!.on('data', checkReady);

        serverProcess.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      if (ready) {
        // Send tool call message
        const message = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: test.tool,
            arguments: test.args
          }
        };

        const messageStr = JSON.stringify(message) + '\n';
        serverProcess.stdin!.write(messageStr);

        // Wait for response
        const responseReceived = await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => resolve(false), 15000); // 15 second timeout

          serverProcess.stdout!.on('data', (data) => {
            response += data.toString();
            // Look for JSON-RPC response
            if (response.includes('"jsonrpc"') && response.includes('"id"')) {
              clearTimeout(timeout);
              resolve(true);
            }
          });
        });

        const duration = Date.now() - startTime;

        if (responseReceived) {
          // Try to parse the response
          try {
            const lines = response.split('\n').filter(line => line.trim());
            let parsedResponse = null;
            
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.jsonrpc && parsed.id === message.id) {
                  parsedResponse = parsed;
                  break;
                }
              } catch (e) {
                // Skip non-JSON lines
              }
            }

            if (parsedResponse) {
              // Check for errors
              if (parsedResponse.error) {
                this.results.push({
                  name: test.name,
                  status: 'failed',
                  message: `Tool returned error: ${parsedResponse.error.message || parsedResponse.error}`,
                  duration,
                  details: { 
                    request: message,
                    response: parsedResponse,
                    tool: test.tool
                  }
                });

                console.log(`   ❌ ${test.name} - Error: ${parsedResponse.error.message || parsedResponse.error}`);
              } else if (parsedResponse.result) {
                // Check if response has expected fields
                const result = parsedResponse.result;
                const content = result.content || [];
                
                let hasExpectedData = true;
                let dataPreview = '';
                
                if (content.length > 0 && content[0].text) {
                  try {
                    const textData = JSON.parse(content[0].text);
                    dataPreview = JSON.stringify(textData).substring(0, 200) + '...';
                    
                    // Check for expected fields if specified
                    if (test.expectedFields) {
                      for (const field of test.expectedFields) {
                        if (!(field in textData)) {
                          hasExpectedData = false;
                          break;
                        }
                      }
                    }
                  } catch (e) {
                    dataPreview = content[0].text.substring(0, 200) + '...';
                  }
                } else {
                  hasExpectedData = false;
                  dataPreview = 'No content in response';
                }

                this.results.push({
                  name: test.name,
                  status: hasExpectedData ? 'passed' : 'failed',
                  message: hasExpectedData ? 
                    `Tool executed successfully` : 
                    `Tool executed but missing expected data fields`,
                  duration,
                  details: { 
                    request: message,
                    response_preview: dataPreview,
                    has_expected_fields: hasExpectedData,
                    expected_fields: test.expectedFields,
                    tool: test.tool
                  }
                });

                console.log(`   ${hasExpectedData ? '✅' : '⚠️'} ${test.name} - ${duration}ms`);
                console.log(`   📄 Response: ${dataPreview}`);
              } else {
                this.results.push({
                  name: test.name,
                  status: 'failed',
                  message: 'Tool response missing result field',
                  duration,
                  details: { 
                    request: message,
                    response: parsedResponse,
                    tool: test.tool
                  }
                });

                console.log(`   ❌ ${test.name} - No result in response`);
              }
            } else {
              this.results.push({
                name: test.name,
                status: 'failed',
                message: 'Could not parse MCP response',
                duration,
                details: { 
                  request: message,
                  raw_response: response.substring(0, 500),
                  tool: test.tool
                }
              });

              console.log(`   ❌ ${test.name} - Could not parse response`);
            }
          } catch (parseError: any) {
            this.results.push({
              name: test.name,
              status: 'failed',
              message: `Response parse error: ${parseError.message}`,
              duration,
              details: { 
                request: message,
                raw_response: response.substring(0, 500),
                parse_error: parseError.message,
                tool: test.tool
              }
            });

            console.log(`   ❌ ${test.name} - Parse error: ${parseError.message}`);
          }
        } else {
          this.results.push({
            name: test.name,
            status: 'failed',
            message: 'No response received within timeout',
            duration,
            details: { 
              request: message,
              partial_response: response.substring(0, 200),
              server_output: serverOutput.substring(0, 500),
              tool: test.tool
            }
          });

          console.log(`   ❌ ${test.name} - No response received`);
        }
      }

      // Cleanup
      serverProcess.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          serverProcess.kill('SIGKILL');
          resolve();
        }, 3000);
        
        serverProcess.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.push({
        name: test.name,
        status: 'error',
        message: `Test error: ${error.message}`,
        duration,
        details: { 
          request_args: test.args,
          error: error.message,
          tool: test.tool
        }
      });

      console.log(`   💥 ${test.name} - Error: ${error.message}`);
    }
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📋 CRYPTO TOOLS TEST SUMMARY');
    console.log('='.repeat(50));
    
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const errors = this.results.filter(r => r.status === 'error').length;
    const total = this.results.length;
    
    console.log(`📊 Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed} (${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%)`);
    console.log(`❌ Failed: ${failed} (${total > 0 ? ((failed / total) * 100).toFixed(1) : 0}%)`);
    console.log(`💥 Errors: ${errors} (${total > 0 ? ((errors / total) * 100).toFixed(1) : 0}%)`);
    
    if (total > 0) {
      const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / total;
      console.log(`⏱️  Average Duration: ${avgDuration.toFixed(0)}ms`);
    }
    
    // Categorize results
    const categories: Record<string, TestResult[]> = {};
    this.results.forEach(result => {
      const tool = result.details?.tool || 'unknown';
      const category = this.categorizeByTool(tool);
      if (!categories[category]) categories[category] = [];
      categories[category].push(result);
    });
    
    console.log('\n📋 RESULTS BY CATEGORY:');
    Object.entries(categories).forEach(([category, results]) => {
      const categoryPassed = results.filter(r => r.status === 'passed').length;
      const categoryTotal = results.length;
      const percentage = categoryTotal > 0 ? ((categoryPassed / categoryTotal) * 100).toFixed(0) : '0';
      
      console.log(`${category}: ${categoryPassed}/${categoryTotal} (${percentage}%)`);
      results.forEach(result => {
        const icon = result.status === 'passed' ? '✅' : 
                     result.status === 'failed' ? '❌' : '💥';
        console.log(`   ${icon} ${result.name}: ${result.message}`);
      });
    });
    
    // Overall assessment
    console.log('\n🎯 CRYPTO TOOLS ASSESSMENT:');
    if (passed === total && total > 0) {
      console.log('🎉 All crypto tools are working correctly!');
    } else if (passed > total * 0.8) {
      console.log(`🟢 Most crypto tools (${passed}/${total}) are working. Minor issues detected.`);
    } else if (passed > total * 0.5) {
      console.log(`🟡 Some crypto tools (${passed}/${total}) are working. Moderate issues detected.`);
    } else {
      console.log(`🔴 Few crypto tools (${passed}/${total}) are working. Significant issues detected.`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`🏁 Test completed at ${new Date().toLocaleString()}`);
    console.log('='.repeat(50));

    // Save results to file
    const resultsFile = {
      timestamp: new Date().toISOString(),
      summary: { total, passed, failed, errors },
      categories,
      results: this.results
    };
    
    writeFileSync('crypto-tools-test-results.json', JSON.stringify(resultsFile, null, 2));
    console.log('💾 Results saved to crypto-tools-test-results.json');
  }

  private categorizeByTool(tool: string): string {
    if (tool.includes('quote') || tool.includes('price')) return 'Market Data';
    if (tool.includes('news') || tool.includes('breaking')) return 'News & Research';
    if (tool.includes('sentiment')) return 'Sentiment Analysis';
    if (tool.includes('defillama') || tool.includes('aave')) return 'DeFi Protocols';
    if (tool.includes('dexscreener')) return 'DEX Analysis';
    if (tool.includes('liquidation')) return 'Liquidations';
    if (tool.includes('trading')) return 'Trading';
    if (tool.includes('econ')) return 'Economic Data';
    return 'Other';
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new CryptoToolsTester();
  
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Test interrupted by user');
    process.exit(130);
  });
  
  tester.runTests().catch((error) => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
}

export { CryptoToolsTester };