#!/usr/bin/env tsx

import { LiquidationModule } from '../src/modules/liquidations/index.js';

async function testLiquidationModule() {
  console.log('Starting liquidation module test...');
  
  // Initialize the module (reads COINALYZE_API_KEY from environment)
  const liquidationModule = new LiquidationModule({
    enableBinanceWebSocket: true,
    enableCoinalyzeSync: true,
    syncInterval: 60000, // 1 minute for testing
  });

  try {
    // Initialize the module
    await liquidationModule.initialize();
    console.log('[SUCCESS] Liquidation module initialized successfully');

    // Wait a bit for WebSocket to connect and start receiving data
    console.log('⏳ Waiting for WebSocket connection and initial data...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Test basic functionality
    console.log('\n[DATA] Testing basic functionality...');

    // Get module stats
    const stats = await liquidationModule.getStats();
    console.log('UP: Module Stats:', stats);

    // Get most liquidated coins in the last hour
    const mostLiquidated = await liquidationModule.getMostLiquidatedCoinsData('1h', 5);
    console.log('\n[FIRE] Most Liquidated Coins (Last Hour):');
    mostLiquidated.forEach((coin, index) => {
      console.log(`${index + 1}. ${coin.symbol}: $${coin.totalNotionalValue.toLocaleString()} (${coin.totalLiquidations} liquidations)`);
    });

    // Get recent large liquidations
    const largeLiquidations = await liquidationModule.getLargestLiquidations(10, '1h');
    const filteredLarge = largeLiquidations.filter(liq => liq.notional_value >= 50000);
    console.log('\n💥 Recent Large Liquidations (>$50k):');
    filteredLarge.forEach((liq, index) => {
      console.log(`${index + 1}. ${liq.symbol} ${liq.side}: $${liq.notional_value.toLocaleString()} @ $${liq.price}`);
    });

    // Get exchange comparison
    const exchangeComparison = await liquidationModule.getExchangeComparisonData('1h');
    console.log('\n🏢 Exchange Comparison (Last Hour):');
    exchangeComparison.forEach((exchange, index) => {
      console.log(`${index + 1}. ${exchange.exchange}: $${exchange.totalNotionalValue.toLocaleString()} (${exchange.marketShare.toFixed(1)}% market share)`);
    });

    // Get liquidation alerts
    const alerts = await liquidationModule.getLiquidationAlertsData(100000);
    console.log('\n[ALERT] Liquidation Alerts (>$100k):');
    if (alerts.length > 0) {
      alerts.forEach((alert, index) => {
        console.log(`${index + 1}. ${alert.symbol} on ${alert.exchange}: $${alert.total_notional.toLocaleString()}`);
      });
    } else {
      console.log('No high-value liquidation alerts in the last 15 minutes');
    }

    // Test specific symbol analysis if we have data
    if (mostLiquidated.length > 0) {
      const testSymbol = mostLiquidated[0].symbol;
      console.log(`\n[SEARCH] Detailed Analysis for ${testSymbol}:`);
      
      const symbolAnalysis = await liquidationModule.getLiquidationAnalysis(testSymbol, undefined, '1h');
      console.log('Analysis:', JSON.stringify(symbolAnalysis, null, 2));
    }

    // Get market overview
    const stats = await liquidationModule.getStats();
    console.log('\n🌐 Market Overview:');
    console.log(`Total liquidations: ${stats.totalLiquidations}`);
    console.log(`Total notional value: $${stats.totalNotionalValue.toLocaleString()}`);
    console.log(`WebSocket connected: ${liquidationModule.isWebSocketConnected()}`);

    console.log('\n[SUCCESS] All tests completed successfully!');
    console.log('\n[INFO] The module is now running and will continue to:');
    console.log('   - Listen to Binance liquidation WebSocket');
    console.log('   - Sync data from Coinalyze API');
    console.log('   - Store all liquidation and open interest data');
    console.log('   - Provide real-time analysis capabilities');

  } catch (error) {
    console.error('[ERROR] Error during testing:', error);
  } finally {
    // Keep the module running for demonstration
    console.log('\n[REFRESH] Module will continue running... Press Ctrl+C to stop');
    
    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down liquidation module...');
      await liquidationModule.destroy();
      process.exit(0);
    });

    // Keep the process alive
    setInterval(() => {
      // Periodic status update
      if (liquidationModule.isWebSocketConnected()) {
        console.log('📡 WebSocket connected, monitoring liquidations...');
      } else {
        console.log('[WARNING]  WebSocket disconnected, attempting reconnection...');
      }
    }, 30000); // Every 30 seconds
  }
}

// Run the test
testLiquidationModule().catch(console.error);
