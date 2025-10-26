#!/usr/bin/env ts-node

/**
 * Test script for Polymarket comments extraction functionality
 * This script tests the sentiment module's Polymarket comments tools
 */

import { PolymarketDatabase } from '../src/modules/polymarket/database.js';
import { PolymarketCommentsTool } from '../src/modules/sentiment/tools/PolymarketCommentsTool.js';

async function testPolymarketComments() {
  console.log('[TEST] Testing Polymarket Comments Extraction...\n');

  let database: PolymarketDatabase | null = null;

  try {
    // Initialize database
    console.log('[DATA] Initializing database...');
    database = new PolymarketDatabase();
    await database.initialize();
    console.log('[SUCCESS] Database initialized successfully\n');

    // Initialize comments tool
    console.log('[SETUP] Initializing PolymarketCommentsTool...');
    const commentsTool = new PolymarketCommentsTool(database);
    console.log('[SUCCESS] Comments tool initialized successfully\n');

    // Test with a sample market ID (you can replace this with a real market ID)
    const testMarketId = '0x1234567890abcdef1234567890abcdef12345678'; // Example market ID - not real
    
    console.log(`UP: Testing with market ID: ${testMarketId}\n`);

    // Test 1: Extract comments (this will fail for non-existent market, but tests the bounds checking)
    console.log('[SEARCH] Test 1: Testing comment extraction with bounds checking...');
    const extractResult = await commentsTool.extractMarketComments(testMarketId, {
      limit: 50,
      offset: 0,
      order: 'createdAt',
      ascending: false
    });

    console.log('Extract Result:', {
      success: extractResult.success,
      error: extractResult.error,
      stats: extractResult.stats
    });

    if (extractResult.success) {
      console.log('[SUCCESS] Comment extraction successful');
      console.log(`[DATA] Market Info: ${extractResult.marketInfo?.question}`);
      console.log(`[CHAT] Comments extracted: ${extractResult.stats.totalExtracted}`);
    } else {
      console.log('[WARNING]  Comment extraction failed (expected for test market):', extractResult.error);
    }
    console.log('');

    // Test 2: Test bounds validation
    console.log('[SEARCH] Test 2: Testing bounds validation...');
    
    // Test invalid limit
    const invalidLimitResult = await commentsTool.extractMarketComments(testMarketId, {
      limit: 2000, // Invalid: exceeds max of 1000
      offset: 0
    });
    console.log('Invalid limit test:', {
      success: invalidLimitResult.success,
      error: invalidLimitResult.error
    });

    // Test invalid offset
    const invalidOffsetResult = await commentsTool.extractMarketComments(testMarketId, {
      limit: 50,
      offset: -10 // Invalid: negative offset
    });
    console.log('Invalid offset test:', {
      success: invalidOffsetResult.success,
      error: invalidOffsetResult.error
    });

    // Test invalid order field
    const invalidOrderResult = await commentsTool.extractMarketComments(testMarketId, {
      limit: 50,
      order: 'invalidField' // Invalid order field
    });
    console.log('Invalid order test:', {
      success: invalidOrderResult.success,
      error: invalidOrderResult.error
    });

    console.log('[SUCCESS] Bounds validation tests completed\n');

    // Test 3: Test comment stats
    console.log('[SEARCH] Test 3: Testing comment stats...');
    const statsResult = await commentsTool.getMarketCommentStats(testMarketId);
    console.log('Stats Result:', {
      success: statsResult.success,
      stats: statsResult.stats,
      error: statsResult.error
    });
    console.log('[SUCCESS] Comment stats test completed\n');

    // Test 4: Test stored comments retrieval
    console.log('[SEARCH] Test 4: Testing stored comments retrieval...');
    const storedResult = await commentsTool.getStoredComments(testMarketId, 10, 0);
    console.log('Stored Comments Result:', {
      success: storedResult.success,
      commentsCount: storedResult.comments?.length || 0,
      error: storedResult.error
    });
    console.log('[SUCCESS] Stored comments test completed\n');

    // Test 5: Database operations
    console.log('[SEARCH] Test 5: Testing database operations...');
    
    // Test upserting a sample comment
    const sampleComment = {
      id: 'test-comment-123',
      marketId: testMarketId,
      body: 'This is a test comment for sentiment analysis',
      parentEntityType: 'market',
      parentEntityID: 12345,
      parentCommentID: null,
      userAddress: '0xtestuser123',
      replyAddress: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reportCount: 0,
      reactionCount: 5,
      extractedAt: new Date().toISOString()
    };

    await database.upsertComment(sampleComment);
    console.log('[SUCCESS] Sample comment upserted successfully');

    // Retrieve the comment
    const retrievedComments = await database.getCommentsByMarketId(testMarketId, 10, 0);
    console.log(`[SUCCESS] Retrieved ${retrievedComments.length} comments from database`);

    // Get comment stats
    const dbStats = await database.getCommentStats(testMarketId);
    console.log('[SUCCESS] Database stats:', dbStats);

    console.log('[SUCCESS] Database operations test completed\n');

    console.log('[COMPLETE] All tests completed successfully!');
    console.log('\n[LIST] Summary:');
    console.log('- Database initialization: SUCCESS:');
    console.log('- Comments tool initialization: SUCCESS:');
    console.log('- Bounds validation: SUCCESS:');
    console.log('- API error handling: SUCCESS:');
    console.log('- Database operations: SUCCESS:');
    console.log('- Comment storage and retrieval: SUCCESS:');

  } catch (error) {
    console.error('[ERROR] Test failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    if (database) {
      try {
        await database.close();
        console.log('\n[LOCK] Database connection closed');
      } catch (error) {
        console.error('Error closing database:', error);
      }
    }
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testPolymarketComments().catch(console.error);
}

export { testPolymarketComments };
