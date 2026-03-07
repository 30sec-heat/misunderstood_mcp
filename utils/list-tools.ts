#!/usr/bin/env npx tsx

import { spawn, ChildProcess } from 'child_process';

class ToolLister {
  async listAllTools(): Promise<void> {
    console.log('🛠️  MCP Server Tool Inventory');
    console.log('=' .repeat(50));
    console.log(`⏰ Started: ${new Date().toLocaleString()}`);
    console.log('=' .repeat(50));

    try {
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
        // Send tools list request
        const message = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        };

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

        if (responseReceived) {
          // Parse and display tools
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

          if (parsedResponse && parsedResponse.result && parsedResponse.result.tools) {
            const tools = parsedResponse.result.tools;
            console.log(`📊 Found ${tools.length} tools\n`);

            // Categorize tools
            const categories: Record<string, any[]> = {};
            tools.forEach((tool: any) => {
              const category = this.categorizeByName(tool.name);
              if (!categories[category]) categories[category] = [];
              categories[category].push(tool);
            });

            // Display by category
            Object.entries(categories).forEach(([category, categoryTools]) => {
              console.log(`\n📋 ${category.toUpperCase()} (${categoryTools.length} tools):`);
              console.log('-'.repeat(40));
              
              categoryTools.forEach((tool: any) => {
                console.log(`🔧 ${tool.name}`);
                console.log(`   Description: ${tool.description}`);
                
                // Show input schema briefly
                if (tool.inputSchema && tool.inputSchema.properties) {
                  const params = Object.keys(tool.inputSchema.properties);
                  const required = tool.inputSchema.required || [];
                  console.log(`   Parameters: ${params.map(p => required.includes(p) ? `${p}*` : p).join(', ')}`);
                }
                console.log('');
              });
            });

            // Summary
            console.log('\n' + '='.repeat(50));
            console.log('📊 SUMMARY BY CATEGORY:');
            Object.entries(categories).forEach(([category, categoryTools]) => {
              console.log(`${category}: ${categoryTools.length} tools`);
            });

          } else {
            console.log('❌ Could not parse tools list response');
          }
        } else {
          console.log('❌ No response received from server');
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
      console.error('💥 Error listing tools:', error.message);
    }
  }

  private categorizeByName(toolName: string): string {
    const name = toolName.toLowerCase();
    
    if (name.includes('polymarket')) return 'Polymarket';
    if (name.includes('sentiment')) return 'Sentiment Analysis';
    if (name.includes('news')) return 'News & Research';
    if (name.includes('chart')) return 'Chart Analysis';
    if (name.includes('econ')) return 'Economic Data';
    if (name.includes('performance')) return 'Performance';
    if (name.includes('telegram')) return 'Telegram';
    if (name.includes('reddit')) return 'Reddit';
    if (name.includes('aave')) return 'Aave DeFi';
    if (name.includes('defillama')) return 'DeFiLlama';
    if (name.includes('dexscreener')) return 'DEX Screener';
    if (name.includes('quote')) return 'Price Quotes';
    if (name.includes('alpha')) return 'Alpha Scanner';
    if (name.includes('deribit')) return 'Deribit Options';
    if (name.includes('knowledge')) return 'Knowledge Base';
    if (name.includes('trading')) return 'Trading';
    if (name.includes('orderflow')) return 'Order Flow';
    if (name.includes('solana')) return 'Solana';
    if (name.includes('social')) return 'Social Media';
    if (name.includes('research')) return 'Research';
    if (name.includes('earnings')) return 'Earnings';
    if (name.includes('massive')) return 'Massive';
    if (name.includes('breaking')) return 'Breaking News';
    if (name.includes('config')) return 'Configuration';
    if (name.includes('streaming')) return 'Streaming';
    if (name.includes('liquidation')) return 'Liquidations';
    if (name.includes('analysis')) return 'Analysis';
    if (name.includes('forecast')) return 'Forecasting';
    
    return 'Other';
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const lister = new ToolLister();
  
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Interrupted by user');
    process.exit(130);
  });
  
  lister.listAllTools().catch((error) => {
    console.error('💥 Tool listing crashed:', error);
    process.exit(1);
  });
}

export { ToolLister };