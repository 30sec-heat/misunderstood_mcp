#!/usr/bin/env node

import { ForecastingModule } from '../src/modules/forecasting/index.js';
import { AnalysisModule } from '../src/modules/analysis/index.js';
import { NewsModule } from '../src/modules/news/index.js';
import { DeribitModule } from '../src/modules/deribit/index.js';

interface TestResult {
  testName: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  responseTime?: number;
}

class ComprehensiveForecastTester {
  private results: TestResult[] = [];

  private addResult(testName: string, success: boolean, message: string, data?: any, error?: string, responseTime?: number) {
    this.results.push({ testName, success, message, data, error, responseTime });
  }

  async testComprehensiveForecast() {
    console.log('[TEST] Testing Comprehensive Forecast Tool...\n');

    try {
      // Initialize modules
      console.log('[SETUP] Initializing modules...');
      const forecastingModule = new ForecastingModule();
      const analysisModule = new AnalysisModule();
      const newsModule = new NewsModule();
      
      // Initialize modules
      await forecastingModule.initialize();
      await analysisModule.initialize();
      await newsModule.initialize();

      // Wire up dependencies
      forecastingModule.setAnalysisModule(analysisModule);
      forecastingModule.setNewsModule(newsModule);

      // Try to initialize Deribit module (optional)
      try {
        const deribitModule = new DeribitModule();
        await deribitModule.initialize();
        forecastingModule.setDeribitModule(deribitModule);
        console.log('[SUCCESS] Deribit module initialized for options data');
      } catch (error) {
        console.log('[WARNING] Deribit module not available, continuing without options data');
      }

      console.log('[SUCCESS] Modules initialized successfully\n');

      // Test 1: Basic comprehensive forecast for BTC
      await this.testBasicComprehensiveForecast(forecastingModule);

      // Test 2: Comprehensive forecast with different timeframes
      await this.testMultiTimeframeForecast(forecastingModule);

      // Test 3: Comprehensive forecast without options
      await this.testForecastWithoutOptions(forecastingModule);

      // Test 4: Error handling
      await this.testErrorHandling(forecastingModule);

    } catch (error) {
      this.addResult('Module Initialization', false, 'Failed to initialize modules', undefined, String(error));
    }

    // Print results
    this.printResults();
  }

  private async testBasicComprehensiveForecast(forecastingModule: ForecastingModule) {
    const testName = 'Basic Comprehensive Forecast (BTC)';
    console.log(`[TEST] ${testName}...`);

    try {
      const startTime = Date.now();
      
      const tools = (forecastingModule as any).tools;
      const comprehensiveTool = tools.find((tool: any) => tool.name === 'forecast_comprehensive');
      
      if (!comprehensiveTool) {
        throw new Error('Comprehensive forecast tool not found');
      }

      const result = await comprehensiveTool.handler({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        predictionPeriod: '24h',
        exchange: 'binance',
        includeOptions: true,
        includeNews: true,
        confidenceLevel: 0.7
      });

      const responseTime = Date.now() - startTime;

      if (result.error) {
        this.addResult(testName, false, result.message || 'Forecast failed', result, result.error, responseTime);
      } else {
        // Validate result structure
        const hasRequiredFields = result.symbol && result.priceForecast && result.technicalAnalysis && result.overallForecast;
        
        if (hasRequiredFields) {
          this.addResult(testName, true, `Comprehensive forecast completed successfully`, {
            symbol: result.symbol,
            direction: result.overallForecast.direction,
            confidence: result.overallForecast.confidence,
            predictedPrice: result.priceForecast.predictedPrice,
            currentPrice: result.currentPrice,
            analysisTime: result.metadata.analysisTime
          }, undefined, responseTime);
        } else {
          this.addResult(testName, false, 'Result missing required fields', result, undefined, responseTime);
        }
      }

    } catch (error) {
      this.addResult(testName, false, 'Test execution failed', undefined, String(error));
    }
  }

  private async testMultiTimeframeForecast(forecastingModule: ForecastingModule) {
    const testName = 'Multi-Timeframe Forecast (ETH)';
    console.log(`[TEST] ${testName}...`);

    try {
      const startTime = Date.now();
      
      const tools = (forecastingModule as any).tools;
      const comprehensiveTool = tools.find((tool: any) => tool.name === 'forecast_comprehensive');

      const result = await comprehensiveTool.handler({
        symbol: 'ETHUSDT',
        timeframe: '4h',
        predictionPeriod: '3d',
        exchange: 'binance',
        includeOptions: true,
        includeNews: true
      });

      const responseTime = Date.now() - startTime;

      if (result.error) {
        this.addResult(testName, false, result.message || 'Multi-timeframe forecast failed', result, result.error, responseTime);
      } else {
        const hasMultiTF = result.multiTimeframeAnalysis && Object.keys(result.multiTimeframeAnalysis).length > 1;
        
        if (hasMultiTF) {
          this.addResult(testName, true, `Multi-timeframe analysis completed`, {
            timeframes: Object.keys(result.multiTimeframeAnalysis),
            overallDirection: result.overallForecast.direction,
            confidence: result.overallForecast.confidence
          }, undefined, responseTime);
        } else {
          this.addResult(testName, false, 'Multi-timeframe analysis incomplete', result, undefined, responseTime);
        }
      }

    } catch (error) {
      this.addResult(testName, false, 'Multi-timeframe test failed', undefined, String(error));
    }
  }

  private async testForecastWithoutOptions(forecastingModule: ForecastingModule) {
    const testName = 'Forecast Without Options';
    console.log(`[TEST] ${testName}...`);

    try {
      const startTime = Date.now();
      
      const tools = (forecastingModule as any).tools;
      const comprehensiveTool = tools.find((tool: any) => tool.name === 'forecast_comprehensive');

      const result = await comprehensiveTool.handler({
        symbol: 'ADAUSDT',
        timeframe: '1h',
        predictionPeriod: '24h',
        exchange: 'binance',
        includeOptions: false,
        includeNews: true
      });

      const responseTime = Date.now() - startTime;

      if (result.error) {
        this.addResult(testName, false, result.message || 'Forecast without options failed', result, result.error, responseTime);
      } else {
        const noOptions = !result.optionsAnalysis;
        const hasTechnical = result.technicalAnalysis && result.priceForecast;
        
        if (noOptions && hasTechnical) {
          this.addResult(testName, true, `Forecast completed without options data`, {
            symbol: result.symbol,
            direction: result.overallForecast.direction,
            hasOptions: !!result.optionsAnalysis,
            hasTechnical: !!result.technicalAnalysis
          }, undefined, responseTime);
        } else {
          this.addResult(testName, false, 'Forecast structure unexpected', result, undefined, responseTime);
        }
      }

    } catch (error) {
      this.addResult(testName, false, 'No-options test failed', undefined, String(error));
    }
  }

  private async testErrorHandling(forecastingModule: ForecastingModule) {
    const testName = 'Error Handling';
    console.log(`[TEST] ${testName}...`);

    try {
      const tools = (forecastingModule as any).tools;
      const comprehensiveTool = tools.find((tool: any) => tool.name === 'forecast_comprehensive');

      // Test with invalid symbol
      const result = await comprehensiveTool.handler({
        symbol: '', // Invalid symbol
        timeframe: '1h',
        predictionPeriod: '24h'
      });

      if (result.error) {
        this.addResult(testName, true, 'Error handling works correctly', { errorMessage: result.message });
      } else {
        this.addResult(testName, false, 'Should have returned error for invalid symbol', result);
      }

    } catch (error) {
      this.addResult(testName, false, 'Error handling test failed', undefined, String(error));
    }
  }

  private printResults() {
    console.log('\n' + '='.repeat(80));
    console.log('[DATA] COMPREHENSIVE FORECAST TEST RESULTS');
    console.log('='.repeat(80));

    let passed = 0;
    let failed = 0;

    this.results.forEach((result, index) => {
      const status = result.success ? '[SUCCESS] PASS' : '[ERROR] FAIL';
      const timing = result.responseTime ? ` (${result.responseTime}ms)` : '';
      
      console.log(`\n${index + 1}. ${result.testName} ${status}${timing}`);
      console.log(`   ${result.message}`);
      
      if (result.data) {
        console.log(`   Data:`, JSON.stringify(result.data, null, 2));
      }
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

      if (result.success) {
        passed++;
      } else {
        failed++;
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log(`UP: SUMMARY: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(80));

    if (failed === 0) {
      console.log('[COMPLETE] All comprehensive forecast tests passed!');
    } else {
      console.log('[WARNING] Some tests failed. Check the results above.');
    }
  }
}

// Run the tests
const tester = new ComprehensiveForecastTester();
tester.testComprehensiveForecast().catch(console.error);
