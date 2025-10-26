#!/usr/bin/env node

import { DexScreenerModule } from '../src/modules/dexscreener/index.js';

async function testDexScreener() {
  console.log('Testing DexScreener Module...');
  
  const module = new DexScreenerModule();
  await module.initialize();
  
  console.log(`Module initialized: ${module.name}`);
  console.log(`Available tools: ${module.tools.length}`);
  
  // List all available tools
  console.log('\nAvailable DexScreener tools:');
  module.tools.forEach(tool => {
    console.log(`- ${tool.name}: ${tool.description}`);
  });
  
  // Test a simple tool
  try {
    const searchTool = module.tools.find(t => t.name === 'dexscreener_search_pairs');
    if (searchTool && searchTool.handler) {
      console.log('\nTesting search pairs tool...');
      const result = await searchTool.handler({ query: 'ethereum' });
      console.log('Search result:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('Error testing search tool:', error);
  }
  
  console.log('\nDexScreener module test completed!');
}

testDexScreener().catch(console.error);
