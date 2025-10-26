#!/usr/bin/env tsx

import { SentimentModule } from '../src/modules/sentiment/index.js';
import { TelegramModule } from '../src/modules/telegram/index.js';
import { RedditModule } from '../src/modules/reddit/index.js';

async function testSemanticSentiment() {
    console.log('[BRAIN] Testing Enhanced Semantic Sentiment Module\n');
    
    try {
        // Initialize dependencies
        console.log('MOBILE: Initializing Telegram Module...');
        const telegramModule = new TelegramModule();
        await telegramModule.initialize();
        console.log('[SUCCESS] Telegram Module initialized');
        
        console.log('MOBILE: Initializing Reddit Module...');
        const redditModule = new RedditModule();
        await redditModule.initialize();
        console.log('[SUCCESS] Reddit Module initialized');
        
        // Initialize enhanced sentiment module
        console.log('[BRAIN] Initializing Enhanced Sentiment Module...');
        const sentimentModule = new SentimentModule();
        
        // Inject dependencies
        sentimentModule.setTelegramModule(telegramModule);
        sentimentModule.setRedditModule(redditModule);
        
        await sentimentModule.initialize();
        console.log('[SUCCESS] Enhanced Sentiment Module initialized with semantic engine\n');
        
        // Test 1: Semantic Search
        console.log('[SEARCH] Testing Semantic Search...');
        console.log('Query: "bullish bitcoin sentiment moon rocket"');
        const semanticSearchResult = await (sentimentModule as any).semanticSearch({
            query: 'bullish bitcoin sentiment moon rocket',
            semantic_similarity_threshold: 0.6,
            time_range: '24h',
            limit: 10
        });
        console.log('Result:', JSON.stringify(semanticSearchResult, null, 2));
        console.log('');
        
        // Test 2: Semantic Trends Analysis
        console.log('[DATA] Testing Semantic Trends Analysis...');
        const trendsResult = await (sentimentModule as any).getSemanticTrends({
            time_range: '24h',
            limit: 5
        });
        console.log('Result:', JSON.stringify(trendsResult, null, 2));
        console.log('');
        
        // Test 3: Cross-Platform Sentiment Correlation
        console.log(' Testing Cross-Platform Sentiment Analysis...');
        console.log('Topic: "bitcoin"');
        const crossPlatformResult = await (sentimentModule as any).analyzeCrossPlatformSentiment({
            topic: 'bitcoin',
            time_range: '24h',
            correlation_threshold: 0.5
        });
        console.log('Result:', JSON.stringify(crossPlatformResult, null, 2));
        console.log('');
        
        // Test 4: Compare with traditional keyword search
        console.log(' Comparing Semantic vs Traditional Search...');
        
        // Traditional keyword search
        console.log('Traditional keyword search for "bitcoin":');
        const traditionalResult = await (sentimentModule as any).getSentimentMessages({
            keyword: 'bitcoin',
            timeRange: '24h',
            limit: 5
        });
        console.log('Traditional results:', traditionalResult.data.totalMessages, 'messages');
        
        // Semantic search for related concepts
        console.log('Semantic search for "digital gold store of value":');
        const semanticResult = await (sentimentModule as any).semanticSearch({
            query: 'digital gold store of value',
            semantic_similarity_threshold: 0.6,
            time_range: '24h',
            limit: 5
        });
        console.log('Semantic results:', semanticResult.data?.total_results || 0, 'messages');
        console.log('');
        
        // Test 5: Demonstrate contextual understanding
        console.log('[TARGET] Testing Contextual Sentiment Understanding...');
        
        const contextualQueries = [
            'fear uncertainty doubt crypto markets',
            'diamond hands hodl strategy',
            'institutional adoption mainstream',
            'bubble crash bear market'
        ];
        
        for (const query of contextualQueries) {
            console.log(`\nQuery: "${query}"`);
            const result = await (sentimentModule as any).semanticSearch({
                query,
                semantic_similarity_threshold: 0.5,
                time_range: '24h',
                limit: 3
            });
            
            if (result.success && result.data.results.length > 0) {
                console.log(`Found ${result.data.results.length} semantically related messages`);
                result.data.results.forEach((msg: any, index: number) => {
                    console.log(`  ${index + 1}. [${msg.source}] Sentiment: ${msg.sentiment_score?.toFixed(2) || 'N/A'}`);
                    console.log(`     "${msg.text.substring(0, 100)}..."`);
                });
            } else {
                console.log('No semantically similar messages found');
            }
        }
        
        console.log('\n[SUCCESS] Semantic Sentiment Testing Complete!');
        console.log('\nUP: Key Improvements Demonstrated:');
        console.log('  • Semantic understanding beyond keyword matching');
        console.log('  • Contextual sentiment scoring with crypto-specific lexicon');
        console.log('  • Intelligent topic clustering and trend detection');
        console.log('  • Cross-platform sentiment correlation analysis');
        console.log('  • Influence direction detection between platforms');
        
    } catch (error) {
        console.error('[ERROR] Error during testing:', error);
        console.error('Stack trace:', error instanceof Error ? error.stack : String(error));
    }
}

// Run the test
testSemanticSentiment().catch(console.error);


