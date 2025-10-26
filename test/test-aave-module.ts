import { AaveV3DataFetcher } from '../src/modules/aave/data/AaveV3DataFetcher.js';

async function testAaveModule() {
  console.log('[TEST] Testing Aave Module with @aave/client');
  console.log('============================================================');
  
  const fetcher = new AaveV3DataFetcher();
  
  try {
    console.log('[SETUP] Testing getLendingRates...');
    const lendingRates = await fetcher.getLendingRates('ethereum', 5);
    console.log('[SUCCESS] Lending rates:', lendingRates.length, 'found');
    if (lendingRates.length > 0) {
      console.log('Sample rate:', lendingRates[0]);
    }
    
    console.log('\n[SETUP] Testing getBorrowingRates...');
    const borrowingRates = await fetcher.getBorrowingRates('ethereum', 5);
    console.log('[SUCCESS] Borrowing rates:', borrowingRates.length, 'found');
    if (borrowingRates.length > 0) {
      console.log('Sample rate:', borrowingRates[0]);
    }
    
    console.log('\n[SETUP] Testing getMarketOverview...');
    const marketOverview = await fetcher.getMarketOverview('ethereum');
    console.log('[SUCCESS] Market overview:', marketOverview ? 'Success' : 'Failed');
    if (marketOverview) {
      console.log('Total TVL:', marketOverview.totalTVL);
      console.log('Top tokens:', marketOverview.topTokens.length);
    }
    
    console.log('\n[SETUP] Testing getUserPosition...');
    // Example test address - not a real user
    const userPosition = await fetcher.getUserPosition('0x742d35cc6e5c4ce3b69a2a8c7c8e5f7e9a0b1234', 'ethereum');
    console.log('[SUCCESS] User position:', userPosition ? 'Found' : 'Not found');
    
    console.log('\n[COMPLETE] Aave module test completed!');
    
  } catch (error) {
    console.error('[ERROR] Error testing Aave module:', error);
  }
}

testAaveModule();