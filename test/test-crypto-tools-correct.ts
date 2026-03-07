#!/usr/bin/env npx tsx

import { spawn, ChildProcess } from 'child_process';
import { writeFileSync } from 'fs';

interface ToolTest {
  name: string;
  tool: string;
  args: any;
  description: string;
  category: string;
}

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'error';
  message: string;
  duration: number;
  details?: any;
}

class CryptoToolsCorrectTester {
  private results: TestResult[] = [];

  async runTests(): Promise<void> {
    console.log('💰 Crypto Tools Functionality Test (Correct Tool Names)');
    console.log('=' .repeat(60));
    console.log(`⏰ Started: ${new Date().toLocaleString()}`);
    console.log('=' .repeat(60));

    const toolTests: ToolTest[] = [
      // Price Quotes
      {
        name: 'Bitcoin Price Quote',
        tool: 'quote_get_price',
        args: { symbol: 'BTC' },
        description: 'Get Bitcoin current price',
        category: 'Market Data'
      },
      
      // News & Research
      {
        name: 'Crypto News Search',
        tool: 'news_search',
        args: { query: 'bitcoin', limit: 5 },
        description: 'Search for Bitcoin news',
        category: 'News'
      },
      {
        name: 'Latest News',
        tool: 'news_get_latest',
        args: { limit: 3, category: 'crypto' },
        description: 'Get latest crypto news',
        category: 'News'
      },
      
      // Sentiment Analysis
      {
        name: 'Sentiment Health Check',
        tool: 'sentiment_get_health',
        args: {},
        description: 'Check sentiment data sources availability',
        category: 'Sentiment'
      },
      {
        name: 'Bitcoin Sentiment',
        tool: 'sentiment_get_symbol_sentiment',
        args: { symbol: 'BTC', time_range: '24h' },
        description: 'Get Bitcoin sentiment analysis',
        category: 'Sentiment'
      },
      {
        name: 'Unified Sentiment Score',
        tool: 'sentiment_get_unified_score',
        args: { time_range: '24h' },
        description: 'Get unified market sentiment score',
        category: 'Sentiment'
      },
      
      // DeFi - DeFiLlama
      {
        name: 'DeFiLlama Protocols',
        tool: 'defillama_discover_protocols',
        args: { limit: 5 },
        description: 'Discover DeFi protocols',
        category: 'DeFi'
      },
      {
        name: 'DeFiLlama Chains',
        tool: 'defillama_get_chains',
        args: { limit: 10 },
        description: 'Get blockchain TVL data',
        category: 'DeFi'
      },
      
      // DeFi - Aave
      {
        name: 'Aave Rates Analysis',
        tool: 'aave_get_all_rates_and_history',
        args: { chain: 'ethereum', asset: 'USDC' },
        description: 'Get Aave lending rates',
        category: 'DeFi'
      },
      
      // DEX Analysis
      {
        name: 'DEX Token Analysis',
        tool: 'dexscreener_analyze_token',
        args: { chainId: 'ethereum', address: '0xA0b86a33E6441b8C4505B6B0b6b4B8C4505B6B0b' },
        description: 'Analyze token on DEX',
        category: 'DEX'
      },
      
      // Economic Data
      {
        name: 'Economic Indicators',
        tool: 'get_econ_tickers',
        args: { category: 'inflation' },
        description: 'Get inflation economic indicators',
        category: 'Economic'
      },
      {
        name: 'Economic Data',
        tool: 'get_econ_data',
        args: { tickers: ['CPI_YOY'], months: 3 },
        description: 'Get CPI inflation data',
        category: 'Economic'
      },
      
      // Liquidations
      {
        name: 'Liquidation Analysis',
        tool: 'liquidations_comprehensive_analysis',
        args: { symbol: 'BTC', timeframe: '24h' },
        description: 'Get Bitcoin liquidation data',
        category: 'Liquidations'
      },
      
      // Options - Deribit
      {
        name: 'Deribit Options Analysis',
        tool: 'deribit_options_analyzer',
        args: { underlying: 'BTC', expiry: '28MAR25' },
        description: 'Analyze Bitcoin options',
        category: 'Options'
      },
      
      // Solana
      {
        name: 'Solana Token Search',
        tool: 'solana_search_token_by_name',
        args: { query: 'SOL', limit: 5 },
        description: 'Search Solana tokens',
        category: 'Solana'
      },
      
      // Analysis
      {
        name: 'Comprehensive Analysis',
        tool: 'analysis_comprehensive',
        args: { symbol: 'BTC', timeframe: '1h' },
        description: 'Comprehensive Bitcoin analysis',
        category: 'Analysis'
      },
      
      // Forecasting
      {
        name: 'Price Forecast',
        tool: 'forecast_comprehensive',
        args: { symbol: 'BTC', timeframe: '1h', predictionPeriod: '24h' },
        description: 'Bitcoin price forecast',
        category: 'Forecasting'
      },
      
      // Polymarket
      {
        name: 'Polymarket Search',
        tool: 'polymarket_search_markets',
        args: { query: 'bitcoin', limit: 3 },
        description: 'Search prediction markets',
        category: 'Prediction Markets'
      },
      
      // Knowledge Base
      {
        name: 'Knowledge Search',
        tool: 'knowledge_search',
        args: { query: 'trading', limit: 3 },
        description: 'Search knowledge base',
        category: 'Knowledge'
      }
    ];

    console.log(`🧪 Testing ${toolTests.length} crypto tools...\n`);

    for (const test of toolTests) {
      await this.testCryptoTool(test);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
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

      // Wait for server ready (shorter timeout for faster testing)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Server ready timeout'));
        }, 20000); // 20 second timeout

        const checkReady = (data: Buffer) => {
          const output = data.toString();
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
          const timeout = setTimeout(() => resolve(false), 10000); // 10 second timeout

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
                  message: `Tool error: ${parsedResponse.error.message || parsedResponse.error}`,
                  duration,
                  details: { 
                    category: test.category,
                    tool: test.tool,
                    error: parsedResponse.error
                  }
                });

                console.log(`   ❌ ${test.name} - Error: ${parsedResponse.error.message || parsedResponse.error}`);
              } else if (parsedResponse.result) {
                // Check if response has content
                const result = parsedResponse.result;
                const content = result.content || [];
                
                let dataPreview = '';
                let hasData = false;
                
                if (content.length > 0 && content[0].text) {
                  try {
                    const textData = JSON.parse(content[0].text);
                    dataPreview = JSON.stringify(textData).substring(0, 150) + '...';
                    hasData = true;
                    
                    // Check for common success indicators
                    if (textData.success === false) {
                      hasData = false;
                    }
                  } catch (e) {
                    dataPreview = content[0].text.substring(0, 150) + '...';
                    hasData = content[0].text.length > 10; // Has some content
                  }
                } else {
                  dataPreview = 'No content in response';
                }

                this.results.push({
                  name: test.name,
                  status: hasData ? 'passed' : 'failed',
                  message: hasData ? 
                    `Tool executed successfully` : 
                    `Tool executed but returned no useful data`,
                  duration,
                  details: { 
                    category: test.category,
                    tool: test.tool,
                    response_preview: dataPreview,
                    has_data: hasData
                  }
                });

                console.log(`   ${hasData ? '✅' : '⚠️'} ${test.name} - ${duration}ms`);
                console.log(`   📄 ${dataPreview}`);
              } else {
                this.results.push({
                  name: test.name,
                  status: 'failed',
                  message: 'Tool response missing result field',
                  duration,
                  details: { 
                    category: test.category,
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
                  category: test.category,
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
                category: test.category,
                tool: test.tool,
                parse_error: parseError.message
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
              category: test.category,
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
        }, 2000);
        
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
          category: test.category,
          tool: test.tool,
          error: error.message
        }
      });

      console.log(`   💥 ${test.name} - Error: ${error.message}`);
    }
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📋 CRYPTO TOOLS TEST SUMMARY');
    console.log('='.repeat(60));
    
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
      const category = result.details?.category || 'Unknown';
      if (!categories[category]) categories[category] = [];
      categories[category].push(result);
    });
    
    console.log('\n📋 RESULTS BY CATEGORY:');
    Object.entries(categories).forEach(([category, results]) => {
      const categoryPassed = results.filter(r => r.status === 'passed').length;
      const categoryTotal = results.length;
      const percentage = categoryTotal > 0 ? ((categoryPassed / categoryTotal) * 100).toFixed(0) : '0';
      
      console.log(`\n${category}: ${categoryPassed}/${categoryTotal} (${percentage}%)`);
      results.forEach(result => {
        const icon = result.status === 'passed' ? '✅' : 
                     result.status === 'failed' ? '❌' : '💥';
        console.log(`   ${icon} ${result.name}: ${result.message} (${result.duration}ms)`);
      });
    });
    
    // Key findings
    console.log('\n🔍 KEY FINDINGS:');
    const workingCategories = Object.entries(categories).filter(([_, results]) => 
      results.some(r => r.status === 'passed')
    );
    const brokenCategories = Object.entries(categories).filter(([_, results]) => 
      results.every(r => r.status !== 'passed')
    );
    
    if (workingCategories.length > 0) {
      console.log(`✅ Working categories: ${workingCategories.map(([cat]) => cat).join(', ')}`);
    }
    if (brokenCategories.length > 0) {
      console.log(`❌ Non-working categories: ${brokenCategories.map(([cat]) => cat).join(', ')}`);
    }
    
    // Overall assessment
    console.log('\n🎯 CRYPTO TOOLS ASSESSMENT:');
    if (passed === total && total > 0) {
      console.log('🎉 All crypto tools are working perfectly!');
    } else if (passed > total * 0.8) {
      console.log(`🟢 Most crypto tools (${passed}/${total}) are working. Excellent functionality.`);
    } else if (passed > total * 0.6) {
      console.log(`🟡 Good crypto tools coverage (${passed}/${total}) working. Some issues to address.`);
    } else if (passed > total * 0.3) {
      console.log(`🟠 Moderate crypto tools functionality (${passed}/${total}) working. Significant issues.`);
    } else {
      console.log(`🔴 Limited crypto tools functionality (${passed}/${total}) working. Major issues detected.`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`🏁 Test completed at ${new Date().toLocaleString()}`);
    console.log('='.repeat(60));

    // Save results to file
    const resultsFile = {
      timestamp: new Date().toISOString(),
      summary: { total, passed, failed, errors },
      categories: Object.fromEntries(
        Object.entries(categories).map(([cat, results]) => [
          cat, 
          {
            total: results.length,
            passed: results.filter(r => r.status === 'passed').length,
            failed: results.filter(r => r.status === 'failed').length,
            errors: results.filter(r => r.status === 'error').length
          }
        ])
      ),
      results: this.results
    };
    
    writeFileSync('crypto-tools-test-results-correct.json', JSON.stringify(resultsFile, null, 2));
    console.log('💾 Results saved to crypto-tools-test-results-correct.json');
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new CryptoToolsCorrectTester();
  
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Test interrupted by user');
    process.exit(130);
  });
  
  tester.runTests().catch((error) => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
}

export { CryptoToolsCorrectTester };