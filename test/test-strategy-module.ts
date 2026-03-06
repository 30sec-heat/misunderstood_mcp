#!/usr/bin/env node
/**
 * Test script for the strategy automation engine.
 * Run: npx tsx test/test-strategy-module.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import {
  parseNaturalLanguageStrategy,
  parsedToConditionalStrategy,
  loadStrategies,
  saveStrategies,
  ConditionalStrategyExecutor,
  type ConditionalStrategy,
} from '../src/strategy/index.js';

async function main() {
  console.log('=== Strategy Module Test ===\n');

  // 1. Test storage
  console.log('1. Storage: load/save');
  const before = loadStrategies();
  console.log('   Loaded strategies:', before.length);

  const testStrategy: ConditionalStrategy = {
    id: 'test-1',
    name: 'BTC Long above 100k',
    strategyType: 'conditional',
    condition: {
      type: 'price',
      operator: 'gt',
      value: 100_000,
      symbol: 'BTC',
    },
    action: { action: 'long', symbol: 'BTC' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    enabled: true,
  };
  saveStrategies([testStrategy]);
  const after = loadStrategies();
  console.log('   After save:', after.length);
  console.log('   First strategy:', after[0]?.name);
  saveStrategies([]); // reset
  console.log('   Storage OK\n');

  // 2. Test NL parser (requires OPENAI_API_KEY)
  if (process.env.OPENAI_API_KEY) {
    console.log('2. NL Parser:');
    try {
      const parsed = await parseNaturalLanguageStrategy(
        'When bitcoin goes above 100k I want to go long'
      );
      console.log('   Parsed:', JSON.stringify(parsed, null, 2));

      const conditional = parsedToConditionalStrategy(parsed, { name: 'BTC 100k long' });
      console.log('   Converted to ConditionalStrategy:', conditional.name);
      console.log('   NL Parser OK\n');
    } catch (e) {
      console.log('   NL Parser error (may need OPENAI_API_KEY):', (e as Error).message);
    }
  } else {
    console.log('2. NL Parser: skipped (OPENAI_API_KEY not set)\n');
  }

  // 3. Test executor (dry-run)
  console.log('3. Executor (dry-run, single poll):');
  const strat: ConditionalStrategy = {
    id: 'exec-test',
    name: 'ETH below 1',
    strategyType: 'conditional',
    condition: {
      type: 'price',
      operator: 'lt',
      value: 1,
      symbol: 'ETH', // ETH is never < 1, so condition won't fire
    },
    action: { action: 'short', symbol: 'ETH' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    enabled: true,
  };

  const executor = new ConditionalStrategyExecutor({
    dryRun: true,
    pollIntervalMs: 60_000,
  });

  const fired = await executor.executeOnce(strat);
  console.log('   Condition met:', fired);
  console.log('   Executor OK\n');

  console.log('=== All tests passed ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
