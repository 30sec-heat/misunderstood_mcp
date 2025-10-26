import { ForecastingModule } from '../src/modules/forecasting/index.js';

interface TestResult {
  testName: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  responseTime?: number;
}

class ForecastingModuleTester {
  private results: TestResult[] = [];

  private addResult(testName: string, success: boolean, message: string, data?: any, error?: string, responseTime?: number) {
    this.results.push({ testName, success, message, data, error, responseTime });
  }

  async testForecastingModule() {
    console.log('Testing Forecasting Module...\n');
    
    const module = new ForecastingModule();
    await module.initialize();

    try {
      // Test 1: Price Movement Forecast
      console.log('1. Testing price movement forecast...');
      const startTime1 = Date.now();
      const priceResult = await module.priceForecaster.forecastPriceMovement({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        predictionPeriod: '24h',
        exchange: 'binance',
        confidenceLevel: 0.7
      });
      const responseTime1 = Date.now() - startTime1;
      
      this.addResult(
        'Price Movement Forecast',
        !priceResult.error,
        priceResult.error ? 'Price forecast failed' : 'Price forecast successful',
        priceResult.forecast,
        priceResult.error,
        responseTime1
      );
      console.log(`✓ Price forecast: ${priceResult.error ? 'FAILED' : 'SUCCESS'} (${responseTime1}ms)`);

      // Test 2: Volatility Forecast
      console.log('\n2. Testing volatility forecast...');
      const startTime2 = Date.now();
      const volatilityResult = await module.volatilityForecaster.forecastVolatility({
        symbol: 'ETHUSDT',
        timeframe: '1h',
        predictionPeriod: '24h',
        exchange: 'binance',
        volatilityModel: 'hybrid'
      });
      const responseTime2 = Date.now() - startTime2;
      
      this.addResult(
        'Volatility Forecast',
        !volatilityResult.error,
        volatilityResult.error ? 'Volatility forecast failed' : 'Volatility forecast successful',
        volatilityResult.volatilityForecast,
        volatilityResult.error,
        responseTime2
      );
      console.log(`✓ Volatility forecast: ${volatilityResult.error ? 'FAILED' : 'SUCCESS'} (${responseTime2}ms)`);

      // Test 3: Technical Price Forecast
      console.log('\n3. Testing technical price forecast...');
      const startTime3 = Date.now();
      const technicalResult = await module.technicalForecaster.technicalPriceForecast({
        symbol: 'ADAUSDT',
        timeframe: '1h',
        predictionPeriod: '24h',
        indicators: ['rsi', 'macd', 'bb', 'ema'],
        patternRecognition: true,
        exchange: 'binance'
      });
      const responseTime3 = Date.now() - startTime3;
      
      this.addResult(
        'Technical Price Forecast',
        !technicalResult.error,
        technicalResult.error ? 'Technical forecast failed' : 'Technical forecast successful',
        technicalResult.technicalForecast,
        technicalResult.error,
        responseTime3
      );
      console.log(`✓ Technical forecast: ${technicalResult.error ? 'FAILED' : 'SUCCESS'} (${responseTime3}ms)`);

      // Test 4: Options Analysis
      console.log('\n4. Testing options analysis...');
      const startTime4 = Date.now();
      const optionsResult = await module.optionsAnalyzer.analyzeOptionsData({
        symbol: 'BTCUSDT',
        exchange: 'deribit',
        analysisType: 'implied_volatility',
        expirationRange: '30d'
      });
      const responseTime4 = Date.now() - startTime4;
      
      this.addResult(
        'Options Analysis',
        !optionsResult.error,
        optionsResult.error ? 'Options analysis failed' : 'Options analysis successful',
        optionsResult.optionsAnalysis,
        optionsResult.error,
        responseTime4
      );
      console.log(`✓ Options analysis: ${optionsResult.error ? 'FAILED' : 'SUCCESS'} (${responseTime4}ms)`);

      // Test 5: Correlation Forecast
      console.log('\n5. Testing correlation forecast...');
      const startTime5 = Date.now();
      const correlationResult = await module.priceForecaster.forecastCorrelationChanges({
        symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
        timeframe: '1d',
        predictionPeriod: '7d',
        exchange: 'binance'
      });
      const responseTime5 = Date.now() - startTime5;
      
      this.addResult(
        'Correlation Forecast',
        !correlationResult.error,
        correlationResult.error ? 'Correlation forecast failed' : 'Correlation forecast successful',
        correlationResult.correlationForecast,
        correlationResult.error,
        responseTime5
      );
      console.log(`✓ Correlation forecast: ${correlationResult.error ? 'FAILED' : 'SUCCESS'} (${responseTime5}ms)`);

      // Test 6: Market Regime Detection
      console.log('\n6. Testing market regime detection...');
      const startTime6 = Date.now();
      const regimeResult = await module.priceForecaster.detectMarketRegime({
        symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
        timeframe: '1d',
        lookbackPeriod: 30,
        exchange: 'binance'
      });
      const responseTime6 = Date.now() - startTime6;
      
      this.addResult(
        'Market Regime Detection',
        !regimeResult.error,
        regimeResult.error ? 'Regime detection failed' : 'Regime detection successful',
        regimeResult.marketRegime,
        regimeResult.error,
        responseTime6
      );
      console.log(`✓ Market regime detection: ${regimeResult.error ? 'FAILED' : 'SUCCESS'} (${responseTime6}ms)`);

      // Test 7: Forecast Risk Assessment
      console.log('\n7. Testing forecast risk assessment...');
      const startTime7 = Date.now();
      const riskResult = await module.priceForecaster.assessForecastRisk({
        symbol: 'BTCUSDT',
        forecastPeriod: '24h',
        confidenceLevel: 0.7,
        exchange: 'binance'
      });
      const responseTime7 = Date.now() - startTime7;
      
      this.addResult(
        'Forecast Risk Assessment',
        !riskResult.error,
        riskResult.error ? 'Risk assessment failed' : 'Risk assessment successful',
        riskResult.riskAssessment,
        riskResult.error,
        responseTime7
      );
      console.log(`✓ Risk assessment: ${riskResult.error ? 'FAILED' : 'SUCCESS'} (${responseTime7}ms)`);

      // Test 8: Data Quality Check
      console.log('\n8. Testing data quality...');
      const dataQualityIssues = [];
      
      // Check if forecasts have proper structure
      if (priceResult.forecast) {
        if (!priceResult.forecast.symbol) dataQualityIssues.push('Missing symbol in price forecast');
        if (!priceResult.forecast.currentPrice) dataQualityIssues.push('Missing current price');
        if (!priceResult.forecast.predictedPrice) dataQualityIssues.push('Missing predicted price');
        if (!priceResult.forecast.confidence) dataQualityIssues.push('Missing confidence');
        if (!priceResult.forecast.disclaimer) dataQualityIssues.push('Missing disclaimer');
      }
      
      if (volatilityResult.volatilityForecast) {
        if (!volatilityResult.volatilityForecast.symbol) dataQualityIssues.push('Missing symbol in volatility forecast');
        if (!volatilityResult.volatilityForecast.currentVolatility) dataQualityIssues.push('Missing current volatility');
        if (!volatilityResult.volatilityForecast.predictedVolatility) dataQualityIssues.push('Missing predicted volatility');
      }
      
      this.addResult(
        'Data Quality Check',
        dataQualityIssues.length === 0,
        dataQualityIssues.length === 0 ? 'All forecasts have proper structure' : `Found ${dataQualityIssues.length} data quality issues`,
        { issues: dataQualityIssues }
      );
      console.log(`✓ Data quality: ${dataQualityIssues.length === 0 ? 'PASSED' : 'FAILED'}`);

      // Test 9: Performance Check
      console.log('\n9. Testing performance...');
      const avgResponseTime = (responseTime1 + responseTime2 + responseTime3 + responseTime4 + responseTime5 + responseTime6 + responseTime7) / 7;
      const performanceIssues = [];
      
      if (avgResponseTime > 10000) performanceIssues.push('Average response time > 10s');
      if (responseTime1 > 15000) performanceIssues.push('Price forecast > 15s');
      if (responseTime2 > 15000) performanceIssues.push('Volatility forecast > 15s');
      if (responseTime3 > 15000) performanceIssues.push('Technical forecast > 15s');
      
      this.addResult(
        'Performance Check',
        performanceIssues.length === 0,
        performanceIssues.length === 0 ? `Average response time: ${avgResponseTime.toFixed(0)}ms` : `Performance issues: ${performanceIssues.length}`,
        { avgResponseTime, issues: performanceIssues }
      );
      console.log(`✓ Performance: ${performanceIssues.length === 0 ? 'PASSED' : 'FAILED'} (avg: ${avgResponseTime.toFixed(0)}ms)`);

    } catch (error) {
      this.addResult('Forecasting Module Test', false, 'Module test failed', null, String(error));
      console.error('✗ Module test failed:', error);
    } finally {
      await module.destroy();
    }
  }

  generateReport() {
    console.log('\n\n=== FORECASTING MODULE TEST REPORT ===\n');
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.log('FAILED TESTS:');
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`✗ ${result.testName}: ${result.message}`);
        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }
        if (result.responseTime) {
          console.log(`  Response Time: ${result.responseTime}ms`);
        }
      });
      console.log('');
    }

    console.log('PASSED TESTS:');
    this.results.filter(r => r.success).forEach(result => {
      console.log(`✓ ${result.testName}: ${result.message}`);
      if (result.responseTime) {
        console.log(`  Response Time: ${result.responseTime}ms`);
      }
    });

    // Save detailed results
    const fs = require('fs');
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed,
        failed,
        successRate: (passed / total) * 100
      },
      results: this.results
    };

    fs.writeFileSync(
      './test-results/forecasting-test-results.json',
      JSON.stringify(reportData, null, 2)
    );

    console.log('\nDetailed results saved to: test/module-test-results/forecasting-test-results.json');
  }

  async runAllTests() {
    console.log('Starting Forecasting Module Tests...\n');
    
    await this.testForecastingModule();
    this.generateReport();
  }
}

// Run the tests
async function main() {
  const tester = new ForecastingModuleTester();
  await tester.runAllTests();
}

main().catch(console.error);
