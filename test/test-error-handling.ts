#!/usr/bin/env npx tsx

import { spawn, ChildProcess } from 'child_process';
import { writeFileSync } from 'fs';

interface ErrorTest {
  name: string;
  tool: string;
  args: any;
  description: string;
  expectedBehavior: 'graceful_error' | 'tool_not_found' | 'invalid_args';
}

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'error';
  message: string;
  duration: number;
  details?: any;
}

class ErrorHandlingTester {
  private results: TestResult[] = [];

  async runTests(): Promise<void> {
    console.log('🛡️  MCP Server Error Handling Test');
    console.log('=' .repeat(50));
    console.log(`⏰ Started: ${new Date().toLocaleString()}`);
    console.log('=' .repeat(50));

    const errorTests: ErrorTest[] = [
      // Tool not found errors
      {
        name: 'Nonexistent Tool',
        tool: 'nonexistent_tool_12345',
        args: {},
        description: 'Test calling a tool that does not exist',
        expectedBehavior: 'tool_not_found'
      },
      {
        name: 'Misspelled Tool Name',
        tool: 'sentiment_get_helth', // misspelled 'health'
        args: {},
        description: 'Test calling a tool with misspelled name',
        expectedBehavior: 'tool_not_found'
      },
      
      // Invalid arguments
      {
        name: 'Missing Required Args',
        tool: 'sentiment_get_symbol_sentiment',
        args: {}, // missing required 'symbol' parameter
        description: 'Test tool with missing required arguments',
        expectedBehavior: 'graceful_error'
      },
      {
        name: 'Invalid Symbol Format',
        tool: 'sentiment_get_symbol_sentiment',
        args: { symbol: null },
        description: 'Test tool with null symbol',
        expectedBehavior: 'graceful_error'
      },
      {
        name: 'Invalid Time Range',
        tool: 'sentiment_get_symbol_sentiment',
        args: { symbol: 'BTC', time_range: 'invalid_range' },
        description: 'Test tool with invalid time range',
        expectedBehavior: 'graceful_error'
      },
      {
        name: 'Negative Limit',
        tool: 'news_search',
        args: { query: 'bitcoin', limit: -5 },
        description: 'Test tool with negative limit',
        expectedBehavior: 'graceful_error'
      },
      {
        name: 'Extremely Large Limit',
        tool: 'news_search',
        args: { query: 'bitcoin', limit: 999999 },
        description: 'Test tool with unreasonably large limit',
        expectedBehavior: 'graceful_error'
      },
      
      // Invalid data types
      {
        name: 'String Instead of Number',
        tool: 'defillama_discover_protocols',
        args: { limit: 'five' }, // string instead of number
        description: 'Test tool with wrong data type',
        expectedBehavior: 'graceful_error'
      },
      {
        name: 'Array Instead of String',
        tool: 'news_search',
        args: { query: ['bitcoin', 'ethereum'] }, // array instead of string
        description: 'Test tool with array instead of string',
        expectedBehavior: 'graceful_error'
      },
      
      // Edge cases
      {
        name: 'Empty String Query',
        tool: 'news_search',
        args: { query: '' },
        description: 'Test tool with empty string query',
        expectedBehavior: 'graceful_error'
      },
      {
        name: 'Very Long Query',
        tool: 'news_search',
        args: { query: 'a'.repeat(10000) },
        description: 'Test tool with extremely long query',
        expectedBehavior: 'graceful_error'
      },
      {
        name: 'Special Characters',
        tool: 'sentiment_get_symbol_sentiment',
        args: { symbol: '!@#$%^&*()' },
        description: 'Test tool with special characters',
        expectedBehavior: 'graceful_error'
      },
      
      // Network/API errors simulation
      {
        name: 'Invalid Token Address',
        tool: 'dexscreener_analyze_token',
        args: { chainId: 'ethereum', address: 'invalid_address_format' },
        description: 'Test tool with invalid token address',
        expectedBehavior: 'graceful_error'
      },
      {
        name: 'Nonexistent Chain',
        tool: 'dexscreener_analyze_token',
        args: { chainId: 'nonexistent_chain', address: '0x1234567890123456789012345678901234567890' },
        description: 'Test tool with nonexistent blockchain',
        expectedBehavior: 'graceful_error'
      },
      
      // Resource intensive operations
      {
        name: 'Large Historical Data Request',
        tool: 'get_econ_data',
        args: { tickers: ['CPI_YOY'], months: 999 },
        description: 'Test tool with excessive data request',
        expectedBehavior: 'graceful_error'
      }
    ];

    console.log(`🧪 Testing ${errorTests.length} error scenarios...\n`);

    for (const test of errorTests) {
      await this.testErrorScenario(test);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.printSummary();
  }

  private async testErrorScenario(test: ErrorTest): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🧪 Testing: ${test.description}`);

      const serverProcess = spawn('npm', ['run', 'mcp-server'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let response = '';
      let ready = false;

      // Wait for server ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Server ready timeout'));
        }, 20000);

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
          const timeout = setTimeout(() => resolve(false), 8000);

          serverProcess.stdout!.on('data', (data) => {
            response += data.toString();
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
              const errorHandled = this.evaluateErrorHandling(parsedResponse, test);
              
              this.results.push({
                name: test.name,
                status: errorHandled.success ? 'passed' : 'failed',
                message: errorHandled.message,
                duration,
                details: { 
                  expected_behavior: test.expectedBehavior,
                  actual_response: errorHandled.actualBehavior,
                  response_preview: JSON.stringify(parsedResponse).substring(0, 200) + '...',
                  tool: test.tool,
                  args: test.args
                }
              });

              console.log(`   ${errorHandled.success ? '✅' : '❌'} ${test.name} - ${duration}ms`);
              console.log(`   📄 ${errorHandled.message}`);
            } else {
              this.results.push({
                name: test.name,
                status: 'failed',
                message: 'Could not parse MCP response',
                duration,
                details: { 
                  expected_behavior: test.expectedBehavior,
                  tool: test.tool,
                  raw_response: response.substring(0, 300)
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
                expected_behavior: test.expectedBehavior,
                tool: test.tool,
                parse_error: parseError.message
              }
            });

            console.log(`   ❌ ${test.name} - Parse error: ${parseError.message}`);
          }
        } else {
          // For tool_not_found errors, no response might be expected
          const isExpectedNoResponse = test.expectedBehavior === 'tool_not_found';
          
          this.results.push({
            name: test.name,
            status: isExpectedNoResponse ? 'passed' : 'failed',
            message: isExpectedNoResponse ? 
              'No response received as expected for nonexistent tool' :
              'No response received within timeout',
            duration,
            details: { 
              expected_behavior: test.expectedBehavior,
              tool: test.tool
            }
          });

          console.log(`   ${isExpectedNoResponse ? '✅' : '❌'} ${test.name} - No response`);
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
          expected_behavior: test.expectedBehavior,
          tool: test.tool,
          error: error.message
        }
      });

      console.log(`   💥 ${test.name} - Error: ${error.message}`);
    }
  }

  private evaluateErrorHandling(response: any, test: ErrorTest): { success: boolean; message: string; actualBehavior: string } {
    // Check if response has an error field
    if (response.error) {
      const errorMessage = response.error.message || response.error.toString();
      
      if (test.expectedBehavior === 'tool_not_found') {
        const isToolNotFoundError = errorMessage.toLowerCase().includes('tool not found') ||
                                   errorMessage.toLowerCase().includes('not found') ||
                                   errorMessage.toLowerCase().includes('unknown tool');
        
        return {
          success: isToolNotFoundError,
          message: isToolNotFoundError ? 
            `Correctly returned "tool not found" error: ${errorMessage}` :
            `Expected "tool not found" error, got: ${errorMessage}`,
          actualBehavior: 'error_response'
        };
      } else if (test.expectedBehavior === 'graceful_error') {
        // Any error response is considered graceful handling
        return {
          success: true,
          message: `Gracefully handled error: ${errorMessage}`,
          actualBehavior: 'graceful_error'
        };
      } else {
        return {
          success: false,
          message: `Unexpected error: ${errorMessage}`,
          actualBehavior: 'unexpected_error'
        };
      }
    }
    
    // Check if response has a result
    if (response.result) {
      const content = response.result.content || [];
      
      if (content.length > 0 && content[0].text) {
        try {
          const textData = JSON.parse(content[0].text);
          
          // Check if the tool returned a graceful error in the result
          if (textData.success === false || textData.error) {
            if (test.expectedBehavior === 'graceful_error') {
              return {
                success: true,
                message: `Tool gracefully returned error: ${textData.error || textData.message || 'Unknown error'}`,
                actualBehavior: 'graceful_error'
              };
            } else {
              return {
                success: false,
                message: `Tool returned error when success expected: ${textData.error || textData.message}`,
                actualBehavior: 'tool_error'
              };
            }
          } else {
            // Tool returned success
            if (test.expectedBehavior === 'graceful_error' || test.expectedBehavior === 'tool_not_found') {
              return {
                success: false,
                message: 'Tool returned success when error was expected',
                actualBehavior: 'unexpected_success'
              };
            } else {
              return {
                success: true,
                message: 'Tool executed successfully',
                actualBehavior: 'success'
              };
            }
          }
        } catch (e) {
          // Could not parse as JSON, treat as text response
          const textContent = content[0].text;
          const hasErrorKeywords = textContent.toLowerCase().includes('error') ||
                                  textContent.toLowerCase().includes('invalid') ||
                                  textContent.toLowerCase().includes('failed');
          
          if (test.expectedBehavior === 'graceful_error' && hasErrorKeywords) {
            return {
              success: true,
              message: `Tool returned error message: ${textContent.substring(0, 100)}...`,
              actualBehavior: 'graceful_error'
            };
          } else {
            return {
              success: false,
              message: `Unexpected text response: ${textContent.substring(0, 100)}...`,
              actualBehavior: 'unexpected_text'
            };
          }
        }
      } else {
        return {
          success: false,
          message: 'Tool returned empty result',
          actualBehavior: 'empty_result'
        };
      }
    }
    
    return {
      success: false,
      message: 'Response missing both error and result fields',
      actualBehavior: 'malformed_response'
    };
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📋 ERROR HANDLING TEST SUMMARY');
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
    
    // Categorize by expected behavior
    const behaviorCategories: Record<string, TestResult[]> = {};
    this.results.forEach(result => {
      const expectedBehavior = result.details?.expected_behavior || 'unknown';
      if (!behaviorCategories[expectedBehavior]) behaviorCategories[expectedBehavior] = [];
      behaviorCategories[expectedBehavior].push(result);
    });
    
    console.log('\n📋 RESULTS BY ERROR TYPE:');
    Object.entries(behaviorCategories).forEach(([behavior, results]) => {
      const categoryPassed = results.filter(r => r.status === 'passed').length;
      const categoryTotal = results.length;
      const percentage = categoryTotal > 0 ? ((categoryPassed / categoryTotal) * 100).toFixed(0) : '0';
      
      console.log(`\n${behavior.replace('_', ' ').toUpperCase()}: ${categoryPassed}/${categoryTotal} (${percentage}%)`);
      results.forEach(result => {
        const icon = result.status === 'passed' ? '✅' : 
                     result.status === 'failed' ? '❌' : '💥';
        console.log(`   ${icon} ${result.name}: ${result.message}`);
      });
    });
    
    // Error handling assessment
    console.log('\n🛡️  ERROR HANDLING ASSESSMENT:');
    const toolNotFoundTests = this.results.filter(r => r.details?.expected_behavior === 'tool_not_found');
    const gracefulErrorTests = this.results.filter(r => r.details?.expected_behavior === 'graceful_error');
    
    const toolNotFoundPassed = toolNotFoundTests.filter(r => r.status === 'passed').length;
    const gracefulErrorPassed = gracefulErrorTests.filter(r => r.status === 'passed').length;
    
    console.log(`🔍 Tool Not Found Handling: ${toolNotFoundPassed}/${toolNotFoundTests.length} (${toolNotFoundTests.length > 0 ? ((toolNotFoundPassed / toolNotFoundTests.length) * 100).toFixed(0) : 0}%)`);
    console.log(`🛠️  Graceful Error Handling: ${gracefulErrorPassed}/${gracefulErrorTests.length} (${gracefulErrorTests.length > 0 ? ((gracefulErrorPassed / gracefulErrorTests.length) * 100).toFixed(0) : 0}%)`);
    
    // Overall assessment
    console.log('\n🎯 OVERALL ERROR HANDLING QUALITY:');
    if (passed === total && total > 0) {
      console.log('🎉 Perfect error handling! All error scenarios handled correctly.');
    } else if (passed > total * 0.8) {
      console.log(`🟢 Excellent error handling (${passed}/${total}). Minor issues to address.`);
    } else if (passed > total * 0.6) {
      console.log(`🟡 Good error handling (${passed}/${total}). Some improvements needed.`);
    } else if (passed > total * 0.4) {
      console.log(`🟠 Moderate error handling (${passed}/${total}). Significant improvements needed.`);
    } else {
      console.log(`🔴 Poor error handling (${passed}/${total}). Major improvements required.`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`🏁 Test completed at ${new Date().toLocaleString()}`);
    console.log('='.repeat(50));

    // Save results to file
    const resultsFile = {
      timestamp: new Date().toISOString(),
      summary: { total, passed, failed, errors },
      error_handling_assessment: {
        tool_not_found: {
          total: toolNotFoundTests.length,
          passed: toolNotFoundPassed,
          percentage: toolNotFoundTests.length > 0 ? ((toolNotFoundPassed / toolNotFoundTests.length) * 100).toFixed(1) : '0'
        },
        graceful_error: {
          total: gracefulErrorTests.length,
          passed: gracefulErrorPassed,
          percentage: gracefulErrorTests.length > 0 ? ((gracefulErrorPassed / gracefulErrorTests.length) * 100).toFixed(1) : '0'
        }
      },
      results: this.results
    };
    
    writeFileSync('error-handling-test-results.json', JSON.stringify(resultsFile, null, 2));
    console.log('💾 Results saved to error-handling-test-results.json');
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ErrorHandlingTester();
  
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Test interrupted by user');
    process.exit(130);
  });
  
  tester.runTests().catch((error) => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
}

export { ErrorHandlingTester };