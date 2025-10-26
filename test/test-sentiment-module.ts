#!/usr/bin/env tsx

import { SentimentModule } from '../src/modules/sentiment/index.js';

class SentimentModuleTester {
    private sentimentModule: SentimentModule;
    private testResults: Array<{
        testName: string;
        status: 'PASS' | 'FAIL';
        responseTime: number;
        error?: string;
        details?: any;
    }> = [];

    constructor() {
        this.sentimentModule = new SentimentModule();
    }

    async runAllTests(): Promise<void> {
        console.log('Starting Sentiment Module Tests...\n');

        try {
            await this.sentimentModule.initialize();
            console.log('Testing Sentiment Module...\n');

            // Test 1: Analyze ticker sentiment (BTC)
            await this.runTest('Analyze BTC Sentiment', async () => {
                const startTime = Date.now();
                const result = await this.sentimentModule.analyzeTickerSentiment({
                    ticker: 'BTC',
                    timeRange: '24h',
                    limit: 50
                });
                const responseTime = Date.now() - startTime;
                
                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid result format');
                }
                
                return { responseTime, sentiment: result.sentiment, mentions: result.mentions };
            });

            // Test 2: Get general vibe
            await this.runTest('Get General Vibe', async () => {
                const startTime = Date.now();
                const result = await this.sentimentModule.getGeneralVibe({
                    timeRange: '24h',
                    limit: 100
                });
                const responseTime = Date.now() - startTime;
                
                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid result format');
                }
                
                return { responseTime, vibe: result.vibe, messageCount: result.message_count };
            });

            // Test 3: Detect shilling patterns
            await this.runTest('Detect Shilling Patterns', async () => {
                const startTime = Date.now();
                const result = await this.sentimentModule.detectShilling({
                    ecosystem: 'solana',
                    timeRange: '24h',
                    limit: 100
                });
                const responseTime = Date.now() - startTime;
                
                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid result format');
                }
                
                return { responseTime, shillingScore: result.shilling_score, shillingCount: result.shilling_count };
            });

            // Test 4: Get trending topics
            await this.runTest('Get Trending Topics', async () => {
                const startTime = Date.now();
                const result = await this.sentimentModule.getTrendingTopics({
                    timeRange: '24h',
                    limit: 10
                });
                const responseTime = Date.now() - startTime;
                
                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid result format');
                }
                
                return { responseTime, topicsCount: result.topics?.length || 0, total: result.total };
            });

            // Test 5: Compare ecosystems
            await this.runTest('Compare Ecosystems', async () => {
                const startTime = Date.now();
                const result = await this.sentimentModule.compareEcosystems({
                    ecosystems: ['solana', 'ethereum'],
                    timeRange: '24h'
                });
                const responseTime = Date.now() - startTime;
                
                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid result format');
                }
                
                return { responseTime, comparisonCount: result.comparison?.length || 0 };
            });

            // Test 6: Correlate market sentiment
            await this.runTest('Correlate Market Sentiment', async () => {
                const startTime = Date.now();
                const result = await this.sentimentModule.correlateMarketSentiment({
                    topic: 'bitcoin',
                    timeRange: '24h'
                });
                const responseTime = Date.now() - startTime;
                
                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid result format');
                }
                
                return { responseTime, correlation: result.correlation, telegramSentiment: result.telegram_sentiment };
            });

            // Test 7: Analyze Reddit sentiment
            await this.runTest('Analyze Reddit Sentiment', async () => {
                const startTime = Date.now();
                const result = await this.sentimentModule.analyzeRedditSentiment({
                    ticker: 'ETH',
                    subreddit: 'all',
                    timeRange: '24h',
                    limit: 50
                });
                const responseTime = Date.now() - startTime;
                
                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid result format');
                }
                
                return { responseTime, sentiment: result.sentiment, posts: result.posts };
            });

            // Test 8: Get Reddit trending topics
            await this.runTest('Get Reddit Trending Topics', async () => {
                const startTime = Date.now();
                const result = await this.sentimentModule.getRedditTrendingTopics({
                    subreddit: 'all',
                    timeRange: '24h',
                    limit: 10
                });
                const responseTime = Date.now() - startTime;
                
                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid result format');
                }
                
                return { responseTime, topicsCount: result.topics?.length || 0, total: result.total };
            });

            // Test 9: Compare platform sentiment
            await this.runTest('Compare Platform Sentiment', async () => {
                const startTime = Date.now();
                const result = await this.sentimentModule.comparePlatformSentiment({
                    topic: 'SOL',
                    timeRange: '24h',
                    limit: 50
                });
                const responseTime = Date.now() - startTime;
                
                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid result format');
                }
                
                return { responseTime, comparison: result.comparison, telegram: result.telegram, reddit: result.reddit };
            });

            // Test 10: Extract Polymarket comments (if available)
            await this.runTest('Extract Polymarket Comments', async () => {
                const startTime = Date.now();
                const result = await this.sentimentModule.extractPolymarketComments({
                    marketId: 'test-market-id',
                    limit: 10,
                    offset: 0
                });
                const responseTime = Date.now() - startTime;
                
                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid result format');
                }
                
                return { responseTime, success: result.success, commentsCount: result.comments?.length || 0 };
            });

        } catch (error) {
            console.error('[ERROR] Module initialization failed:', error);
        }

        this.generateReport();
    }

    private async runTest(testName: string, testFn: () => Promise<any>): Promise<void> {
        try {
            console.log(`[TEST] Testing: ${testName}`);
            const result = await testFn();
            
            this.testResults.push({
                testName,
                status: 'PASS',
                responseTime: result.responseTime,
                details: result
            });
            
            console.log(`[SUCCESS] ${testName} - PASSED (${result.responseTime}ms)`);
        } catch (error) {
            this.testResults.push({
                testName,
                status: 'FAIL',
                responseTime: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            
            console.log(`[ERROR] ${testName} - FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private generateReport(): void {
        console.log('\n' + '='.repeat(60));
        console.log('[DATA] SENTIMENT MODULE TEST REPORT');
        console.log('='.repeat(60));

        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(t => t.status === 'PASS');
        const failedTests = this.testResults.filter(t => t.status === 'FAIL');
        
        console.log(`\nUP: SUMMARY:`);
        console.log(`• Total Tests: ${totalTests}`);
        console.log(`• Passed: ${passedTests.length} (${((passedTests.length / totalTests) * 100).toFixed(1)}%)`);
        console.log(`• Failed: ${failedTests.length} (${((failedTests.length / totalTests) * 100).toFixed(1)}%)`);

        if (passedTests.length > 0) {
            const avgResponseTime = passedTests.reduce((sum, test) => sum + test.responseTime, 0) / passedTests.length;
            console.log(`• Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
        }

        console.log(`\n[SUCCESS] PASSED TESTS:`);
        passedTests.forEach(test => {
            console.log(`  • ${test.testName} (${test.responseTime}ms)`);
        });

        if (failedTests.length > 0) {
            console.log(`\n[ERROR] FAILED TESTS:`);
            failedTests.forEach(test => {
                console.log(`  • ${test.testName}: ${test.error}`);
            });
        }

        // Performance analysis
        console.log(`\nLIGHTNING: PERFORMANCE ANALYSIS:`);
        const responseTimes = passedTests.map(t => t.responseTime).sort((a, b) => a - b);
        if (responseTimes.length > 0) {
            console.log(`• Fastest: ${responseTimes[0]}ms`);
            console.log(`• Slowest: ${responseTimes[responseTimes.length - 1]}ms`);
            console.log(`• Median: ${responseTimes[Math.floor(responseTimes.length / 2)]}ms`);
        }

        // Issues analysis
        const issues = [];
        if (failedTests.length > totalTests * 0.3) {
            issues.push('High failure rate (>30%) indicates potential systemic issues');
        }
        
        const slowTests = passedTests.filter(t => t.responseTime > 5000);
        if (slowTests.length > 0) {
            issues.push(`${slowTests.length} tests took >5s to complete`);
        }

        if (issues.length > 0) {
            console.log(`\n[WARNING]  POTENTIAL ISSUES:`);
            issues.forEach(issue => console.log(`  • ${issue}`));
        }

        console.log('\n' + '='.repeat(60));
    }
}

// Run tests
const tester = new SentimentModuleTester();
tester.runAllTests().catch(console.error);
