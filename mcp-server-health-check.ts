#!/usr/bin/env npx tsx

/**
 * MCP Crypto Server Health Check
 * 
 * A comprehensive test script to verify MCP server functionality.
 * This script tests server startup, tool availability, and basic functionality.
 */

import { spawn, ChildProcess } from 'child_process';
import { writeFileSync } from 'fs';

interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  duration?: number;
  details?: any;
}

class MCPHealthChecker {
  private results: HealthCheckResult[] = [];
  private serverProcess: ChildProcess | null = null;

  async runHealthCheck(): Promise<void> {
    console.log('🏥 MCP Crypto Server Health Check');
    console.log('=' .repeat(60));
    console.log(`⏰ Started: ${new Date().toLocaleString()}`);
    console.log('=' .repeat(60));

    // Test 1: Server Startup
    await this.testServerStartup();
    
    // Test 2: Tool Availability
    await this.testToolAvailability();
    
    // Test 3: Basic Tool Functionality
    await this.testBasicFunctionality();
    
    // Test 4: Error Handling
    await this.testErrorHandling();

    this.generateHealthReport();
  }

  private async testServerStartup(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('\n🚀 Testing Server Startup...');
      
      this.serverProcess = spawn('npm', ['run', 'mcp-server'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let output = '';
      let errorOutput = '';

      this.serverProcess.stdout!.on('data', (data) => {
        output += data.toString();
      });

      this.serverProcess.stderr!.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Wait for server to be ready
      const isReady = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 20000);

        const checkReady = () => {
          if (output.includes('Server is ready to receive MCP requests') || 
              output.includes('Waiting for MCP client connections')) {
            clearTimeout(timeout);
            resolve(true);
          }
        };

        this.serverProcess!.stdout!.on('data', checkReady);
        this.serverProcess!.stderr!.on('data', checkReady);

        this.serverProcess!.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      });

      const duration = Date.now() - startTime;

      if (isReady) {
        const toolMatches = output.match(/Added (\d+) tools from/g) || [];
        const totalTools = toolMatches.reduce((sum, match) => {
          const count = parseInt(match.match(/(\d+)/)?.[1] || '0');
          return sum + count;
        }, 0);

        this.results.push({
          component: 'Server Startup',
          status: totalTools >= 100 ? 'healthy' : totalTools >= 50 ? 'warning' : 'critical',
          message: `Server started with ${totalTools} tools loaded`,
          duration,
          details: { tools_loaded: totalTools }
        });

        console.log(`   ✅ Server started successfully (${duration}ms)`);
        console.log(`   📊 Tools loaded: ${totalTools}`);
      } else {
        this.results.push({
          component: 'Server Startup',
          status: 'critical',
          message: 'Server failed to start or signal ready state',
          duration,
          details: { error_output: errorOutput.substring(0, 500) }
        });

        console.log('   ❌ Server startup failed');
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.push({
        component: 'Server Startup',
        status: 'critical',
        message: `Startup error: ${error.message}`,
        duration,
        details: error
      });

      console.log('   💥 Startup error:', error.message);
    }
  }

  private async testToolAvailability(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('\n🔧 Testing Tool Availability...');

      if (!this.serverProcess) {
        this.results.push({
          component: 'Tool Availability',
          status: 'critical',
          message: 'No server process available for testing',
          duration: 0
        });
        return;
      }

      // Send tools/list request
      const listRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };

      let response = '';
      const messageStr = JSON.stringify(listRequest) + '\n';
      this.serverProcess.stdin!.write(messageStr);

      // Wait for response
      const responseReceived = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 10000);

        this.serverProcess!.stdout!.on('data', (data) => {
          response += data.toString();
          if (response.includes('"jsonrpc"') && response.includes('"tools"')) {
            clearTimeout(timeout);
            resolve(true);
          }
        });
      });

      const duration = Date.now() - startTime;

      if (responseReceived) {
        try {
          const lines = response.split('\n').filter(line => line.trim());
          let parsedResponse = null;
          
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.jsonrpc && parsed.id === listRequest.id) {
                parsedResponse = parsed;
                break;
              }
            } catch (e) {
              // Skip non-JSON lines
            }
          }

          if (parsedResponse && parsedResponse.result?.tools) {
            const toolCount = parsedResponse.result.tools.length;
            
            this.results.push({
              component: 'Tool Availability',
              status: toolCount >= 100 ? 'healthy' : toolCount >= 50 ? 'warning' : 'critical',
              message: `${toolCount} tools available via MCP protocol`,
              duration,
              details: { tool_count: toolCount }
            });

            console.log(`   ✅ ${toolCount} tools available (${duration}ms)`);
          } else {
            this.results.push({
              component: 'Tool Availability',
              status: 'critical',
              message: 'Could not parse tools list response',
              duration
            });

            console.log('   ❌ Could not parse tools list');
          }
        } catch (parseError: any) {
          this.results.push({
            component: 'Tool Availability',
            status: 'critical',
            message: `Response parse error: ${parseError.message}`,
            duration
          });

          console.log('   ❌ Parse error:', parseError.message);
        }
      } else {
        this.results.push({
          component: 'Tool Availability',
          status: 'critical',
          message: 'No response received within timeout',
          duration
        });

        console.log('   ❌ No response received');
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.push({
        component: 'Tool Availability',
        status: 'critical',
        message: `Tool availability test error: ${error.message}`,
        duration,
        details: error
      });

      console.log('   💥 Test error:', error.message);
    }
  }

  private async testBasicFunctionality(): Promise<void> {
    console.log('\n🧪 Testing Basic Tool Functionality...');

    // Test a few key tools
    const testTools = [
      {
        name: 'sentiment_health_check',
        args: {},
        description: 'Sentiment health check'
      },
      {
        name: 'news_search',
        args: { query: 'bitcoin', limit: 5 },
        description: 'News search'
      },
      {
        name: 'defillama_get_protocols',
        args: { limit: 5 },
        description: 'DeFi protocols'
      }
    ];

    for (const tool of testTools) {
      await this.testSingleTool(tool.name, tool.args, tool.description);
    }
  }

  private async testSingleTool(toolName: string, args: any, description: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (!this.serverProcess) {
        this.results.push({
          component: `Tool: ${description}`,
          status: 'critical',
          message: 'No server process available',
          duration: 0
        });
        return;
      }

      const toolRequest = {
        jsonrpc: '2.0',
        id: Math.floor(Math.random() * 1000),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      let response = '';
      const messageStr = JSON.stringify(toolRequest) + '\n';
      this.serverProcess.stdin!.write(messageStr);

      // Wait for response
      const responseReceived = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 15000);

        this.serverProcess!.stdout!.on('data', (data) => {
          response += data.toString();
          if (response.includes(`"id":${toolRequest.id}`) && 
              (response.includes('"result"') || response.includes('"error"'))) {
            clearTimeout(timeout);
            resolve(true);
          }
        });
      });

      const duration = Date.now() - startTime;

      if (responseReceived) {
        try {
          const lines = response.split('\n').filter(line => line.trim());
          let parsedResponse = null;
          
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.jsonrpc && parsed.id === toolRequest.id) {
                parsedResponse = parsed;
                break;
              }
            } catch (e) {
              // Skip non-JSON lines
            }
          }

          if (parsedResponse) {
            if (parsedResponse.result) {
              this.results.push({
                component: `Tool: ${description}`,
                status: 'healthy',
                message: 'Tool executed successfully',
                duration,
                details: { tool_name: toolName }
              });

              console.log(`   ✅ ${description} - Success (${duration}ms)`);
            } else if (parsedResponse.error) {
              this.results.push({
                component: `Tool: ${description}`,
                status: 'warning',
                message: `Tool error: ${parsedResponse.error.message}`,
                duration,
                details: { tool_name: toolName, error: parsedResponse.error }
              });

              console.log(`   ⚠️  ${description} - Error: ${parsedResponse.error.message} (${duration}ms)`);
            }
          } else {
            this.results.push({
              component: `Tool: ${description}`,
              status: 'critical',
              message: 'Could not parse tool response',
              duration
            });

            console.log(`   ❌ ${description} - Parse error (${duration}ms)`);
          }
        } catch (parseError: any) {
          this.results.push({
            component: `Tool: ${description}`,
            status: 'critical',
            message: `Response parse error: ${parseError.message}`,
            duration
          });

          console.log(`   ❌ ${description} - Parse error: ${parseError.message} (${duration}ms)`);
        }
      } else {
        this.results.push({
          component: `Tool: ${description}`,
          status: 'critical',
          message: 'No response received within timeout',
          duration
        });

        console.log(`   ❌ ${description} - Timeout (${duration}ms)`);
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.push({
        component: `Tool: ${description}`,
        status: 'critical',
        message: `Tool test error: ${error.message}`,
        duration,
        details: { tool_name: toolName, error: error.message }
      });

      console.log(`   💥 ${description} - Error: ${error.message} (${duration}ms)`);
    }
  }

  private async testErrorHandling(): Promise<void> {
    console.log('\n🛡️  Testing Error Handling...');

    // Test nonexistent tool
    await this.testSingleTool('nonexistent_tool', {}, 'Nonexistent tool handling');
  }

  private generateHealthReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('🏥 HEALTH CHECK REPORT');
    console.log('='.repeat(60));

    const healthy = this.results.filter(r => r.status === 'healthy').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    const critical = this.results.filter(r => r.status === 'critical').length;
    const total = this.results.length;

    console.log(`📊 Total Components Tested: ${total}`);
    console.log(`✅ Healthy: ${healthy} (${total > 0 ? ((healthy / total) * 100).toFixed(1) : 0}%)`);
    console.log(`⚠️  Warnings: ${warnings} (${total > 0 ? ((warnings / total) * 100).toFixed(1) : 0}%)`);
    console.log(`🚨 Critical: ${critical} (${total > 0 ? ((critical / total) * 100).toFixed(1) : 0}%)`);

    if (total > 0) {
      const avgDuration = this.results
        .filter(r => r.duration)
        .reduce((sum, r) => sum + (r.duration || 0), 0) / 
        this.results.filter(r => r.duration).length;
      console.log(`⏱️  Average Response Time: ${avgDuration.toFixed(0)}ms`);
    }

    console.log('\n📋 COMPONENT STATUS:');
    this.results.forEach(result => {
      const icon = result.status === 'healthy' ? '✅' : 
                   result.status === 'warning' ? '⚠️ ' : '🚨';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`${icon} ${result.component}: ${result.message}${duration}`);
    });

    // Overall health assessment
    console.log('\n🎯 OVERALL HEALTH ASSESSMENT:');
    if (critical === 0 && warnings <= 1) {
      console.log('🟢 HEALTHY - MCP server is operating normally');
    } else if (critical === 0 && warnings <= 3) {
      console.log('🟡 WARNING - MCP server is functional with minor issues');
    } else if (critical <= 2) {
      console.log('🟠 DEGRADED - MCP server has significant issues but may be partially functional');
    } else {
      console.log('🔴 CRITICAL - MCP server has major issues and may not be functional');
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (critical > 0) {
      console.log('   • Address critical issues immediately');
      console.log('   • Check server logs for detailed error information');
      console.log('   • Verify environment configuration and dependencies');
    }
    if (warnings > 0) {
      console.log('   • Review warning components for potential improvements');
      console.log('   • Monitor performance and error rates');
    }
    if (healthy === total) {
      console.log('   • All systems operational - continue monitoring');
      console.log('   • Consider performance optimization if needed');
    }

    console.log('\n' + '='.repeat(60));
    console.log(`🏁 Health check completed at ${new Date().toLocaleString()}`);
    console.log('='.repeat(60));

    // Cleanup server process
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
    }

    // Save results
    const healthReport = {
      timestamp: new Date().toISOString(),
      summary: { total, healthy, warnings, critical },
      overall_status: critical === 0 && warnings <= 1 ? 'healthy' : 
                     critical === 0 && warnings <= 3 ? 'warning' :
                     critical <= 2 ? 'degraded' : 'critical',
      results: this.results
    };

    writeFileSync('mcp-health-check-results.json', JSON.stringify(healthReport, null, 2));
    console.log('💾 Health check results saved to mcp-health-check-results.json');
  }
}

// Run health check if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new MCPHealthChecker();
  
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Health check interrupted by user');
    process.exit(130);
  });
  
  checker.runHealthCheck().catch((error) => {
    console.error('💥 Health check crashed:', error);
    process.exit(1);
  });
}

export { MCPHealthChecker };