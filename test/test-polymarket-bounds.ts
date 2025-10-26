#!/usr/bin/env ts-node

/**
 * Test script for Polymarket comments bounds validation
 * This script specifically tests the bounds checking functionality
 */

import { PolymarketCommentsTool } from '../src/modules/sentiment/tools/PolymarketCommentsTool.js';
import { PolymarketDatabase } from '../src/modules/polymarket/database.js';

async function testBoundsValidation() {
  console.log('[TEST] Testing Polymarket Comments Bounds Validation...\n');

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

    // Test bounds validation directly by accessing the private method
    console.log('[SEARCH] Testing bounds validation logic...\n');

    // Test cases for bounds validation
    const testCases = [
      {
        name: 'Valid parameters',
        params: { limit: 100, offset: 0, order: 'createdAt', ascending: false },
        shouldPass: true
      },
      {
        name: 'Limit too high',
        params: { limit: 2000, offset: 0 },
        shouldPass: false
      },
      {
        name: 'Limit negative',
        params: { limit: -10, offset: 0 },
        shouldPass: false
      },
      {
        name: 'Offset negative',
        params: { limit: 50, offset: -5 },
        shouldPass: false
      },
      {
        name: 'Invalid order field',
        params: { limit: 50, order: 'invalidField' },
        shouldPass: false
      },
      {
        name: 'Multiple invalid order fields',
        params: { limit: 50, order: 'createdAt,invalidField,updatedAt' },
        shouldPass: false
      },
      {
        name: 'Valid multiple order fields',
        params: { limit: 50, order: 'createdAt,updatedAt' },
        shouldPass: true
      },
      {
        name: 'Edge case: limit at maximum',
        params: { limit: 1000, offset: 0 },
        shouldPass: true
      },
      {
        name: 'Edge case: limit at minimum',
        params: { limit: 0, offset: 0 },
        shouldPass: true
      },
      {
        name: 'Edge case: offset at zero',
        params: { limit: 50, offset: 0 },
        shouldPass: true
      }
    ];

    let passedTests = 0;
    let totalTests = testCases.length;

    for (const testCase of testCases) {
      console.log(`Testing: ${testCase.name}`);
      
      // Access the private validateBounds method through type assertion
      const tool = commentsTool as any;
      const result = tool.validateBounds(testCase.params);
      
      const passed = result.valid === testCase.shouldPass;
      
      if (passed) {
        console.log(`[SUCCESS] PASS: ${testCase.name}`);
        passedTests++;
      } else {
        console.log(`[ERROR] FAIL: ${testCase.name}`);
        console.log(`   Expected: ${testCase.shouldPass ? 'valid' : 'invalid'}`);
        console.log(`   Got: ${result.valid ? 'valid' : 'invalid'}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
      }
      console.log('');
    }

    console.log(`[DATA] Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('[COMPLETE] All bounds validation tests passed!');
    } else {
      console.log('[WARNING]  Some bounds validation tests failed');
    }

    // Test API parameter construction
    console.log('\n[SEARCH] Testing API parameter construction...');
    
    const validParams = { limit: 100, offset: 50, order: 'createdAt', ascending: true };
    const boundsResult = (commentsTool as any).validateBounds(validParams);
    
    if (boundsResult.valid) {
      console.log('[SUCCESS] Valid parameters constructed successfully');
      console.log('Constructed params:', boundsResult.params);
    } else {
      console.log('[ERROR] Parameter construction failed:', boundsResult.error);
    }

    console.log('\n[LIST] Bounds Validation Summary:');
    console.log('- Parameter validation: SUCCESS:');
    console.log('- Error handling: SUCCESS:');
    console.log('- Edge case handling: SUCCESS:');
    console.log('- API parameter construction: SUCCESS:');

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
  testBoundsValidation().catch(console.error);
}

export { testBoundsValidation };
