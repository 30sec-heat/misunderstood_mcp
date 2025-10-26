#!/usr/bin/env tsx

import { QuoteModule } from '../src/modules/quote/index.js';

class QuoteModuleTester {
    private quoteModule: QuoteModule;
    private testResults: Array<{
        testName: string;
        status: 'PASS' | 'FAIL';
        responseTime: number;
        error?: string;
        details?: any;
    }> = [];

    constructor() {
        this.quoteModule = new QuoteModule();
    }

    async runAllTests(): Promise<void> {
        console.log('Starting Quote Module Tests...\n');

        try {
            await this.quoteModule.initialize();
            console.log('Testing Quote Module...\n');

            // Test 1: Get quotes for BTC
            await this.runTest('Get BTC Quotes', async () => {
                const startTime = Date.now();
                const result = await this.quoteModule.getQuotes('BTC');
                const responseTime = Date.now() - startTime;
                
                if (!result || result.length === 0) {
                    throw new Error('No quotes returned');
                }

                // Check if we have at least some valid data
                const validQuotes = result.filter(q => q.spotPrice !== null || q.perpPrice !== null);
                if (validQuotes.length === 0) {
                    throw new Error('No valid price data found');
                }

                return { responseTime, quoteCount: result.length, validQuotes: validQuotes.length };
            });

            // Test 2: Get quote analysis for ETH
            await this.runTest('Get ETH Quote Analysis', async () => {
                const startTime = Date.now();
                const result = await this.quoteModule.getQuoteAnalysis('ETH');
                const responseTime = Date.now() - startTime;
                
                if (!result || !result.symbol) {
                    throw new Error('Invalid analysis result');
                }

                return { responseTime, symbol: result.symbol, averagePrice: result.averagePrice };
            });

            // Test 3: Detect arbitrage for ADA
            await this.runTest('Detect ADA Arbitrage', async () => {
                const startTime = Date.now();
                const result = await this.quoteModule.detectArbitrage('ADA');
                const responseTime = Date.now() - startTime;
                
                return { responseTime, opportunities: result.length };
            });

            // Test 4: Compare exchanges for SOL
            await this.runTest('Compare Exchanges for SOL', async () => {
                const startTime = Date.now();
                const result = await this.quoteModule.compareExchanges('SOL');
                const responseTime = Date.now() - startTime;
                
                if (!result || !result.bestPrice) {
                    throw new Error('Invalid comparison result');
                }

                return { responseTime, bestPrice: result.bestPrice.price, spread: result.priceSpread };
            });

            // Test 5: Get price dislocation for DOGE
            await this.runTest('Get DOGE Price Dislocation', async () => {
                const startTime = Date.now();
                const result = await this.quoteModule.getPriceDislocation('DOGE', 0.01);
                const responseTime = Date.now() - startTime;
                
                if (!result || !result.symbol) {
                    throw new Error('Invalid dislocation result');
                }

                return { responseTime, symbol: result.symbol, severity: result.dislocationSeverity };
            });

            // Test 6: Get supported exchanges
            await this.runTest('Get Supported Exchanges', async () => {
                const startTime = Date.now();
                const result = this.quoteModule.getSupportedExchanges();
                const responseTime = Date.now() - startTime;
                
                if (!result || result.length === 0) {
                    throw new Error('No supported exchanges returned');
                }

                return { responseTime, exchangeCount: result.length, exchanges: result };
            });

            // Test 7: Check symbol availability
            await this.runTest('Check BTC Availability on Binance', async () => {
                const startTime = Date.now();
                const result = await this.quoteModule.isSymbolAvailable('BTC', 'BINANCE');
                const responseTime = Date.now() - startTime;
                
                return { responseTime, isAvailable: result };
            });

            // Test 8: Get exchange market data
            await this.runTest('Get BTC Market Data from Coinbase', async () => {
                const startTime = Date.now();
                const result = await this.quoteModule.getExchangeMarketData('BTC', 'COINBASE');
                const responseTime = Date.now() - startTime;
                
                if (!result) {
                    throw new Error('No market data returned');
                }

                return { responseTime, price: result.price, volume: result.volume24h };
            });

            // Test 9: Get listings for ADA
            await this.runTest('Get ADA Listings', async () => {
                const startTime = Date.now();
                const result = await this.quoteModule.getListings('ADA');
                const responseTime = Date.now() - startTime;
                
                if (!result || result.length === 0) {
                    throw new Error('No listings returned');
                }

                const listedExchanges = result.filter(l => l.isListed);
                return { responseTime, totalExchanges: result.length, listedExchanges: listedExchanges.length };
            });

            // Test 10: Performance test
            await this.runTest('Performance Test', async () => {
                const symbols = ['BTC', 'ETH', 'ADA', 'SOL', 'DOGE'];
                const startTime = Date.now();
                const results = await Promise.all(
                    symbols.map(symbol => this.quoteModule.getQuotes(symbol))
                );
                const responseTime = Date.now() - startTime;
                
                const totalQuotes = results.reduce((sum, quotes) => sum + quotes.length, 0);
                const avgResponseTime = responseTime / symbols.length;
                
                return { 
                    responseTime, 
                    avgResponseTime, 
                    totalQuotes, 
                    symbolsProcessed: symbols.length 
                };
            });

        } catch (error) {
            console.error('[ERROR] Test suite failed:', error);
        }

        this.generateReport();
    }

    private async runTest(testName: string, testFn: () => Promise<any>): Promise<void> {
        try {
            console.log(`${this.testResults.length + 1}. Testing ${testName}...`);
            const result = await testFn();
            console.log(`✓ ${testName}: SUCCESS (${result.responseTime}ms)`);
            
            this.testResults.push({
                testName,
                status: 'PASS',
                responseTime: result.responseTime,
                details: result
            });
        } catch (error) {
            console.log(`✗ ${testName}: FAILED - ${error instanceof Error ? error.message : 'Unknown error'}`);
            
            this.testResults.push({
                testName,
                status: 'FAIL',
                responseTime: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private generateReport(): void {
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const total = this.testResults.length;
        const successRate = total > 0 ? (passed / total) * 100 : 0;

        console.log('\n=== QUOTE MODULE TEST REPORT ===\n');
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Success Rate: ${successRate.toFixed(1)}%\n`);

        if (passed > 0) {
            console.log('PASSED TESTS:');
            this.testResults
                .filter(r => r.status === 'PASS')
                .forEach(result => {
                    console.log(`✓ ${result.testName}: ${result.details ? JSON.stringify(result.details) : 'Success'}`);
                    console.log(`  Response Time: ${result.responseTime}ms`);
                });
            console.log('');
        }

        if (failed > 0) {
            console.log('FAILED TESTS:');
            this.testResults
                .filter(r => r.status === 'FAIL')
                .forEach(result => {
                    console.log(`✗ ${result.testName}: ${result.error}`);
                });
            console.log('');
        }

        // Performance summary
        const avgResponseTime = this.testResults
            .filter(r => r.status === 'PASS' && r.responseTime > 0)
            .reduce((sum, r) => sum + r.responseTime, 0) / passed;

        if (avgResponseTime > 0) {
            console.log(`Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
        }

        // Data quality check
        console.log('\n=== DATA QUALITY ANALYSIS ===');
        const dataQualityIssues = this.identifyDataQualityIssues();
        if (dataQualityIssues.length === 0) {
            console.log('[SUCCESS] Data Quality: PASSED');
        } else {
            console.log('[WARNING] Data Quality Issues:');
            dataQualityIssues.forEach(issue => console.log(`• ${issue}`));
        }
    }

    private identifyDataQualityIssues(): string[] {
        const issues: string[] = [];
        
        // Check for common issues
        const failedTests = this.testResults.filter(r => r.status === 'FAIL');
        
        if (failedTests.length > this.testResults.length * 0.3) {
            issues.push('High failure rate (>30%) indicates potential systemic issues');
        }

        const slowTests = this.testResults.filter(r => r.status === 'PASS' && r.responseTime > 5000);
        if (slowTests.length > 0) {
            issues.push(`${slowTests.length} tests took longer than 5 seconds`);
        }

        return issues;
    }
}

async function main() {
    const tester = new QuoteModuleTester();
    await tester.runAllTests();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
