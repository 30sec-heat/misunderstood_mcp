#!/usr/bin/env node
/**
 * Automated Backend - strategy executor only (no full backend)
 * Monitors saved strategies and executes when conditions are met
 * Use --dry-run (default) to log only; --live for real orders
 */

import 'dotenv/config';
import {
  loadStrategies,
  type ConditionalStrategy,
  ConditionalStrategyExecutor,
  type OrderExecutor,
  type OrderParams,
} from './src/strategy/index.js';
import { TradingClient } from './src/modules/trading/TradingClient.js';

/** Default to dry-run for safety. Use --live to execute real orders. */
const DRY_RUN = !process.argv.includes('--live');
const POLL_MS = parseInt(process.env.STRATEGY_POLL_MS || '30000', 10);

/** Creates an OrderExecutor that places real market orders via TradingClient */
function createTradingOrderExecutor(): OrderExecutor {
  const client = new TradingClient();

  return async (params: OrderParams): Promise<void> => {
    const exchange = (params.exchange as 'binance' | 'bybit') || 'binance';
    const marketType = params.marketType === 'futures' || params.marketType === 'perp' ? 'futures' : 'spot';
    const side = params.action === 'long' ? 'buy' : 'sell';
    const amount = params.size ?? 0.001; // Default tiny size for safety

    await client.createMarketOrder(params.symbol, side, amount, {
      exchange,
      marketType,
    });
    console.log(`[AUTOMATED] Executed ${params.action} ${params.symbol} on ${exchange} ${marketType}`);
  };
}

async function main() {
  console.log('========================================');
  console.log('  Automated Trading Backend');
  console.log(`  Dry-run: ${DRY_RUN}  |  Poll: ${POLL_MS}ms`);
  console.log('========================================\n');

  const all = loadStrategies();
  const conditional = all.filter(
    (s): s is ConditionalStrategy => s.strategyType === 'conditional' && s.enabled
  );

  if (conditional.length === 0) {
    console.log(' No enabled conditional strategies in strategies.json.');
    console.log(' Use the CLI agent to create strategies: npm run agent -- -m strategy');
    console.log(' Or add strategies manually to strategies.json');
    process.stdin.resume();
    return;
  }

  const orderExecutor: OrderExecutor = DRY_RUN
    ? async (params) => {
        console.log(
          `[DRY-RUN] Would execute: ${params.action} ${params.symbol} on ${params.exchange || 'binance'} (${params.marketType || 'spot'})`
        );
      }
    : createTradingOrderExecutor();

  const executor = new ConditionalStrategyExecutor({
    pollIntervalMs: POLL_MS,
    dryRun: DRY_RUN,
    orderExecutor,
  });

  executor.start(conditional);
  console.log(` Running ${conditional.length} strategy(ies).\n`);

  const shutdown = () => {
    console.log('\n Shutting down...');
    executor.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.stdin.resume();
}

main().catch((err) => {
  console.error(' Fatal:', err);
  process.exit(1);
});
