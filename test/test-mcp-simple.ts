#!/usr/bin/env npx tsx

import { spawn, ChildProcess } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'error';
  message: string;
  duration: number;
  details?: any;
}

class SimpleMCPTester {
  private results: TestResult[] = [];

  async runTests(): Promise<void> {
    console.log('🧪 MCP Server Simple Test Suite');
    console.log('=' .repeat(50));
    console.log(`⏰ Started: ${new Date().toLocaleString()}`);
    console.log('=' .repeat(50));

    // Test 1: Server startup
    await this.testServerStartup();
    
    // Test 2: Test via direct stdio communication
    await this.testDirectCommunication();
    
    this.printSummary();
  }

  private async testServerStartup(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('\n🚀 Test 1: Server Startup');
      console.log('-'.repeat(30));

      const serverProcess = spawn('npm', ['run', 'mcp-server'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let output = '';
      let errorOutput = '';

      // Collect output
      serverProcess.stdout!.on('data', (data) => {
        output += data.toString();
      });

      serverProcess.stderr!.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Wait for server to be ready or timeout
      const isReady = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 30000); // 30 second timeout

        const checkReady = () => {
          if (output.includes('Server is ready to receive MCP requests') || 
              output.includes('Waiting for MCP client connections') ||
              errorOutput.includes('Server is ready to receive MCP requests') ||
              errorOutput.includes('Waiting for MCP client connections')) {
            clearTimeout(timeout);
            resolve(true);
          }
        };

        serverProcess.stdout!.on('data', checkReady);
        serverProcess.stderr!.on('data', checkReady);

        serverProcess.on('error', (error) => {
          clearTimeout(timeout);
          console.log('Process error:', error.message);
          resolve(false);
        });

        serverProcess.on('exit', (code) => {
          clearTimeout(timeout);
          console.log(`Process exited with code: ${code}`);
          resolve(false);
        });
      });

      // Kill the server process
      serverProcess.kill('SIGTERM');
      
      // Wait for process to exit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          serverProcess.kill('SIGKILL');
          resolve();
        }, 5000);
        
        serverProcess.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      const duration = Date.now() - startTime;

      if (isReady) {
        // Count tools from output
        const toolMatches = output.match(/Added (\d+) tools from/g) || [];
        const totalTools = toolMatches.reduce((sum, match) => {
          const count = parseInt(match.match(/(\d+)/)?.[1] || '0');
          return sum + count;
        }, 0);

        this.results.push({
          name: 'Server Startup',
          status: 'passed',
          message: `Server started successfully with ${totalTools} tools`,
          duration,
          details: { 
            tools_loaded: totalTools,
            startup_output: output.substring(0, 500) + '...'
          }
        });

        console.log('✅ Server startup successful');
        console.log(`📊 Tools loaded: ${totalTools}`);
        
        // Show module initialization summary
        const moduleMatches = output.match(/Added \d+ tools from \w+ module/g) || [];
        console.log('📋 Module summary:');
        moduleMatches.slice(0, 10).forEach(match => {
          console.log(`   ${match}`);
        });
        if (moduleMatches.length > 10) {
          console.log(`   ... and ${moduleMatches.length - 10} more modules`);
        }

      } else {
        this.results.push({
          name: 'Server Startup',
          status: 'failed',
          message: 'Server failed to start or signal ready state',
          duration,
          details: { 
            output: output.substring(0, 1000),
            error_output: errorOutput.substring(0, 1000)
          }
        });

        console.log('❌ Server startup failed');
        console.log('📄 Output preview:', output.substring(0, 200));
        console.log('📄 Error preview:', errorOutput.substring(0, 200));
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.push({
        name: 'Server Startup',
        status: 'error',
        message: `Test error: ${error.message}`,
        duration,
        details: error
      });

      console.log('💥 Test error:', error.message);
    }
  }

  private async testDirectCommunication(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('\n📡 Test 2: MCP Protocol Communication');
      console.log('-'.repeat(40));

      // Test basic MCP protocol messages
      const testMessages = [
        {
          name: 'List Tools',
          message: {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
            params: {}
          }
        }
      ];

      for (const test of testMessages) {
        await this.testMCPMessage(test.name, test.message);
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.push({
        name: 'Direct Communication',
        status: 'error',
        message: `Communication test error: ${error.message}`,
        duration,
        details: error
      });

      console.log('💥 Communication test error:', error.message);
    }
  }

  private async testMCPMessage(testName: string, message: any): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🔧 Testing: ${testName}`);

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
        }, 30000);

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
        // Send MCP message
        const messageStr = JSON.stringify(message) + '\n';
        serverProcess.stdin!.write(messageStr);

        // Wait for response
        const responseReceived = await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => resolve(false), 10000);

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
              const toolCount = parsedResponse.result?.tools?.length || 0;
              
              this.results.push({
                name: `MCP: ${testName}`,
                status: 'passed',
                message: `Received valid MCP response${toolCount > 0 ? ` with ${toolCount} tools` : ''}`,
                duration,
                details: { 
                  request: message,
                  response_preview: JSON.stringify(parsedResponse).substring(0, 200) + '...',
                  tool_count: toolCount
                }
              });

              console.log(`   ✅ ${testName} - ${duration}ms`);
              if (toolCount > 0) {
                console.log(`   📊 Response contains ${toolCount} tools`);
              }
            } else {
              this.results.push({
                name: `MCP: ${testName}`,
                status: 'failed',
                message: 'Could not parse MCP response',
                duration,
                details: { 
                  request: message,
                  raw_response: response.substring(0, 500)
                }
              });

              console.log(`   ❌ ${testName} - Could not parse response`);
            }
          } catch (parseError: any) {
            this.results.push({
              name: `MCP: ${testName}`,
              status: 'failed',
              message: `Response parse error: ${parseError.message}`,
              duration,
              details: { 
                request: message,
                raw_response: response.substring(0, 500)
              }
            });

            console.log(`   ❌ ${testName} - Parse error: ${parseError.message}`);
          }
        } else {
          this.results.push({
            name: `MCP: ${testName}`,
            status: 'failed',
            message: 'No response received within timeout',
            duration,
            details: { 
              request: message,
              partial_response: response.substring(0, 200)
            }
          });

          console.log(`   ❌ ${testName} - No response received`);
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
        name: `MCP: ${testName}`,
        status: 'error',
        message: `Test error: ${error.message}`,
        duration,
        details: { request: message, error: error.message }
      });

      console.log(`   💥 ${testName} - Error: ${error.message}`);
    }
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📋 TEST SUMMARY');
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
    
    // Show results details
    console.log('\n📋 DETAILED RESULTS:');
    this.results.forEach(result => {
      const icon = result.status === 'passed' ? '✅' : 
                   result.status === 'failed' ? '❌' : '💥';
      console.log(`${icon} ${result.name}: ${result.message} (${result.duration}ms)`);
    });
    
    // Overall assessment
    console.log('\n🎯 ASSESSMENT:');
    if (passed === total && total > 0) {
      console.log('🎉 All tests passed! MCP server is working correctly.');
    } else if (passed > 0) {
      console.log(`⚠️  ${passed}/${total} tests passed. Some issues found but server is partially functional.`);
    } else {
      console.log('🚨 No tests passed. MCP server has significant issues.');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`🏁 Test completed at ${new Date().toLocaleString()}`);
    console.log('='.repeat(50));

    // Save results to file
    const resultsFile = {
      timestamp: new Date().toISOString(),
      summary: { total, passed, failed, errors },
      results: this.results
    };
    
    writeFileSync('mcp-test-results.json', JSON.stringify(resultsFile, null, 2));
    console.log('💾 Results saved to mcp-test-results.json');
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new SimpleMCPTester();
  
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Test interrupted by user');
    process.exit(130);
  });
  
  tester.runTests().catch((error) => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
}

export { SimpleMCPTester };