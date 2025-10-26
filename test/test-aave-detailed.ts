import { AaveV3DataFetcher } from '../src/modules/aave/data/AaveV3DataFetcher.js';
import fs from 'fs';

async function testAaveModuleDetailed() {
  console.log('[TEST] Testing Aave Module with @aave/client - Detailed Output');
  console.log('============================================================');
  
  const fetcher = new AaveV3DataFetcher();
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {}
  };
  
  try {
    console.log('[SETUP] Testing getLendingRates...');
    const lendingRates = await fetcher.getLendingRates('ethereum', 5);
    results.tests.lendingRates = {
      success: true,
      count: lendingRates.length,
      data: lendingRates
    };
    console.log('[SUCCESS] Lending rates:', lendingRates.length, 'found');
    if (lendingRates.length > 0) {
      console.log('Sample rate:', JSON.stringify(lendingRates[0], null, 2));
    }
    
    console.log('\n[SETUP] Testing getBorrowingRates...');
    const borrowingRates = await fetcher.getBorrowingRates('ethereum', 5);
    results.tests.borrowingRates = {
      success: true,
      count: borrowingRates.length,
      data: borrowingRates
    };
    console.log('[SUCCESS] Borrowing rates:', borrowingRates.length, 'found');
    if (borrowingRates.length > 0) {
      console.log('Sample rate:', JSON.stringify(borrowingRates[0], null, 2));
    }
    
    console.log('\n[SETUP] Testing getMarketOverview...');
    const marketOverview = await fetcher.getMarketOverview('ethereum');
    results.tests.marketOverview = {
      success: !!marketOverview,
      data: marketOverview
    };
    console.log('[SUCCESS] Market overview:', marketOverview ? 'Success' : 'Failed');
    if (marketOverview) {
      console.log('Total TVL:', marketOverview.totalTVL);
      console.log('Top tokens:', marketOverview.topTokens.length);
      console.log('Market data:', JSON.stringify(marketOverview, null, 2));
    }
    
    console.log('\n[SETUP] Testing getUserPosition...');
    // Example test address - not a real user
    const userPosition = await fetcher.getUserPosition('0x742d35cc6e5c4ce3b69a2a8c7c8e5f7e9a0b1234', 'ethereum');
    results.tests.userPosition = {
      success: !!userPosition,
      data: userPosition
    };
    console.log('[SUCCESS] User position:', userPosition ? 'Found' : 'Not found');
    if (userPosition) {
      console.log('User data:', JSON.stringify(userPosition, null, 2));
    }
    
    console.log('\n[SETUP] Testing getUserSupplies...');
    // Example test address - not a real user
    const userSupplies = await fetcher.getUserSupplies('0x742d35cc6e5c4ce3b69a2a8c7c8e5f7e9a0b1234', 'ethereum');
    results.tests.userSupplies = {
      success: true,
      count: userSupplies.length,
      data: userSupplies
    };
    console.log('[SUCCESS] User supplies:', userSupplies.length, 'found');
    if (userSupplies.length > 0) {
      console.log('Sample supply:', JSON.stringify(userSupplies[0], null, 2));
    }
    
    console.log('\n[SETUP] Testing getUserBorrows...');
    const userBorrows = await fetcher.getUserBorrows('0x742d35cc6e5c4ce3b69a2a8c7c8e5f7e9a0b1234', 'ethereum');
    results.tests.userBorrows = {
      success: true,
      count: userBorrows.length,
      data: userBorrows
    };
    console.log('[SUCCESS] User borrows:', userBorrows.length, 'found');
    if (userBorrows.length > 0) {
      console.log('Sample borrow:', JSON.stringify(userBorrows[0], null, 2));
    }
    
    console.log('\n[SETUP] Testing getCollateralFactors...');
    const collateralFactors = await fetcher.getCollateralFactors('ethereum');
    results.tests.collateralFactors = {
      success: true,
      count: collateralFactors.length,
      data: collateralFactors
    };
    console.log('[SUCCESS] Collateral factors:', collateralFactors.length, 'found');
    if (collateralFactors.length > 0) {
      console.log('Sample factor:', JSON.stringify(collateralFactors[0], null, 2));
    }
    
    console.log('\n[SETUP] Testing getProtocolRisk...');
    const protocolRisk = await fetcher.getProtocolRisk('ethereum');
    results.tests.protocolRisk = {
      success: true,
      data: protocolRisk
    };
    console.log('[SUCCESS] Protocol risk:', 'Success');
    console.log('Risk data:', JSON.stringify(protocolRisk, null, 2));
    
    console.log('\n[SETUP] Testing getTokenMetrics...');
    const tokenMetrics = await fetcher.getTokenMetrics('USDC', 'ethereum');
    results.tests.tokenMetrics = {
      success: true,
      data: tokenMetrics
    };
    console.log('[SUCCESS] Token metrics:', 'Success');
    console.log('Metrics data:', JSON.stringify(tokenMetrics, null, 2));
    
    console.log('\n[COMPLETE] Aave module detailed test completed!');
    
    // Save results to JSON file
    const outputPath = './test-results/aave-detailed-results.json';
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`💾 Detailed results saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('[ERROR] Error testing Aave module:', error);
    results.error = {
      message: error.message,
      stack: error.stack
    };
    
    // Save error results
    const outputPath = './test-results/aave-detailed-results.json';
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  }
}

testAaveModuleDetailed();
