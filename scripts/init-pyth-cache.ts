#!/usr/bin/env tsx

import { pythFeedsManager } from '../src/helpers/pyth-feeds-cache.js';

console.log(' Initializing Pyth price feeds cache...');

async function main() {
  try {
    const cache = await pythFeedsManager.refreshCache();
    
    console.log(' Pyth feeds cache initialized successfully!');
    console.log(` Total feeds: ${cache.totalFeeds}`);
    console.log(' Categories:');
    console.log(`  • Crypto: ${cache.categories.crypto.length}`);
    console.log(`  • Equity: ${cache.categories.equity.length}`);
    console.log(`  • FX: ${cache.categories.fx.length}`);
    console.log(`  • Commodity: ${cache.categories.commodity.length}`);
    console.log(`  • Bond: ${cache.categories.bond.length}`);
    console.log(`  • Economic: ${cache.categories.economic.length}`);
    console.log(`  • Other: ${cache.categories.other.length}`);
    console.log(`🕒 Last updated: ${new Date(cache.lastUpdated).toISOString()}`);
    
    // Show some popular examples
    console.log('\n Popular feeds examples:');
    const popular = [
      ...cache.categories.crypto.slice(0, 3),
      ...cache.categories.equity.slice(0, 3),
      ...cache.categories.fx.slice(0, 2)
    ];
    
    popular.forEach(feed => {
      console.log(`  • ${feed.display_symbol} (${feed.asset_type})`);
    });
    
  } catch (error) {
    console.error(' Failed to initialize Pyth feeds cache:', error);
    process.exit(1);
  }
}

main();
