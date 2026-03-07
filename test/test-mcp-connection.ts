#!/usr/bin/env node
/**
 * Test MCP Server Connection
 * Verifies that the MCP server starts correctly and responds to basic requests
 */

import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testMCPConnection(): Promise<void> {
  console.log('🧪 Testing MCP Server Connection...\n');

  let client: Client | null = null;
  
  try {
    // Create MCP client
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', join(__dirname, '..', 'mcp-server-socket.ts')],
      env: { ...process.env },
      stderr: 'pipe', // Capture stderr for debugging
    });

    client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    console.log('📡 Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected successfully!\n');

    // Test 1: List available tools
    console.log('🔧 Testing tool listing...');
    const toolsResult = await client.listTools();
    const tools = toolsResult.tools || [];
    console.log(`✅ Found ${tools.length} available tools\n`);

    if (tools.length > 0) {
      console.log('📋 Available tools:');
      tools.slice(0, 5).forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.description || 'No description'}`);
      });
      if (tools.length > 5) {
        console.log(`  ... and ${tools.length - 5} more tools`);
      }
      console.log();
    }

    // Test 2: Try calling a basic tool (if available)
    const basicTools = ['get_comprehensive_quotes', 'research_search', 'knowledge_search_all'];
    const availableTool = basicTools.find(toolName => 
      tools.some(tool => tool.name === toolName)
    );

    if (availableTool) {
      console.log(`🎯 Testing tool call: ${availableTool}...`);
      try {
        const result = await client.callTool({
          name: availableTool,
          arguments: availableTool === 'get_comprehensive_quotes' 
            ? { symbol: 'BTC' }
            : availableTool === 'research_search'
            ? { query: 'test', limit: 1 }
            : { query: 'test', limit: 1 }
        });
        
        if (result.content && result.content.length > 0) {
          console.log('✅ Tool call successful!');
          console.log(`📄 Response type: ${result.content[0].type}`);
        } else {
          console.log('⚠️  Tool call returned empty response');
        }
      } catch (toolError) {
        console.log(`⚠️  Tool call failed: ${(toolError as Error).message}`);
        console.log('   (This may be expected if APIs are not configured)');
      }
    } else {
      console.log('⚠️  No basic tools found to test');
    }

    console.log('\n🎉 MCP server test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Configure your MCP client (Cursor, Claude Desktop, etc.)');
    console.log('   2. Add API keys to .env for enhanced functionality');
    console.log('   3. Try queries like "What\'s the current Bitcoin price?"');

  } catch (error) {
    console.error('❌ MCP server test failed:', (error as Error).message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure dependencies are installed: npm install');
    console.error('   2. Check database connection: npm run test-connection');
    console.error('   3. Verify TypeScript compilation: npm run build');
    console.error('   4. Check logs in the logs/ directory');
    process.exit(1);
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        // Ignore close errors
      }
    }
  }
}

// Run the test
testMCPConnection().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});