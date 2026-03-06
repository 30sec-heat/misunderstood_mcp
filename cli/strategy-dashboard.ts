#!/usr/bin/env node
/**
 * Strategy Dashboard - Minimal TUI for strategy management
 * Uses chalk + readline. Run: npm run strategy-dashboard
 * Requires server to be running for API mode, or runs standalone (local strategies)
 */

import 'dotenv/config';
import * as readline from 'readline';
import chalk from 'chalk';
import { loadStrategies, getStrategyRunner } from '../src/strategy/index.js';
import { PriceFetcher } from '../src/modules/quote/tools/PriceFetcher.js';
import axios from 'axios';

const API_URL = process.env.BACKEND_URL || 'http://localhost:3000';

function printHeader() {
  console.log(chalk.bold.cyan('\n Strategy Dashboard\n'));
  console.log(chalk.gray(' Commands: list | run <id> | pause <id> | stop <id> | refresh | quit\n'));
}

async function fetchFromApi(): Promise<any[] | null> {
  try {
    const res = await axios.get(`${API_URL}/strategies`, { timeout: 5000 });
    return res.data?.strategies ?? null;
  } catch {
    return null;
  }
}

async function listStrategies(useApi: boolean): Promise<void> {
  if (useApi) {
    const list = await fetchFromApi();
    if (!list) {
      console.log(chalk.yellow(' Could not reach API at ' + API_URL + '. Run "npm run server" first.'));
      console.log(chalk.gray(' Falling back to local strategies.\n'));
      listStrategies(false);
      return;
    }
    displayStrategies(list);
    return;
  }

  const runner = getStrategyRunner();
  const strategies = loadStrategies();
  const withStatus = runner.getStrategiesWithStatus();
  const priceFetcher = new PriceFetcher();

  const rows = await Promise.all(
    withStatus.map(async (row) => {
      let unrealizedPnL: number | undefined;
      if (row.position) {
        const prices = await priceFetcher.fetchPrices(row.position.symbol);
        const valid = prices.filter((p) => (p.spotPrice ?? p.perpPrice) != null);
        const avg =
          valid.length > 0
            ? valid.reduce((a, p) => a + (p.spotPrice ?? p.perpPrice ?? 0), 0) / valid.length
            : null;
        if (avg != null) {
          unrealizedPnL = runner.getUnrealizedPnL(row.strategy.id, avg) ?? undefined;
        }
      }
      return {
        id: row.strategy.id,
        name: row.strategy.name,
        status: row.status,
        position: row.position,
        lastTrade: row.lastTrade,
        realizedPnL: row.realizedPnL,
        unrealizedPnL,
        sizeType: row.strategy.sizeType ?? 'fixed',
        sizeValue: row.strategy.sizeValue ?? row.strategy.action?.size ?? '-',
      };
    })
  );
  displayStrategies(rows);
}

function displayStrategies(rows: any[]): void {
  if (rows.length === 0) {
    console.log(chalk.gray(' No strategies. Add via: npm run agent -- -m strategy "when BTC > 100k go long"\n'));
    return;
  }

  console.log(chalk.bold(' ID                    │ Status   │ PnL Realized │ PnL Unreal │ Last Trade     │ Size'));
  console.log(chalk.gray('─'.repeat(95)));

  for (const r of rows) {
    const statusColor =
      r.status === 'running' ? chalk.green : r.status === 'paused' ? chalk.yellow : chalk.gray;
    const pnlReal =
      r.realizedPnL != null
        ? (r.realizedPnL >= 0 ? chalk.green : chalk.red)(r.realizedPnL.toFixed(2))
        : chalk.gray('-');
    const pnlUnreal =
      r.unrealizedPnL != null
        ? (r.unrealizedPnL >= 0 ? chalk.green : chalk.red)(r.unrealizedPnL.toFixed(2))
        : chalk.gray('-');
    const lastTrade = r.lastTrade
      ? `${r.lastTrade.pnl >= 0 ? '+' : ''}${r.lastTrade.pnl.toFixed(2)} (${r.lastTrade.exitReason})`
      : '-';
    const size = r.sizeType === 'fixed' ? String(r.sizeValue) : `${r.sizeType} ${r.sizeValue}`;

    console.log(
      ` ${(r.id + ' ').padEnd(22)} │ ${statusColor((r.status + ' ').padEnd(7))} │ ${String(pnlReal).padEnd(12)} │ ${String(pnlUnreal).padEnd(10)} │ ${(lastTrade + ' ').padEnd(14)} │ ${size}`
    );
  }
  console.log('');
}

async function postToApi(path: string): Promise<boolean> {
  try {
    await axios.post(`${API_URL}${path}`, {}, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function runCommand(id: string, useApi: boolean): Promise<void> {
  const runner = getStrategyRunner();
  if (useApi) {
    const ok = await postToApi(`/strategies/${id}/run`);
    if (ok) {
      console.log(chalk.green(` Started strategy: ${id}`));
    } else {
      console.log(chalk.red(` Failed to start (API error). Check server.`));
    }
  } else {
    const ok = runner.startStrategy(id);
    if (ok) {
      console.log(chalk.green(` Started strategy: ${id}`));
    } else {
      console.log(chalk.red(` Strategy not found: ${id}`));
    }
  }
}

async function pauseCommand(id: string, useApi: boolean): Promise<void> {
  const runner = getStrategyRunner();
  if (useApi) {
    const ok = await postToApi(`/strategies/${id}/pause`);
    if (ok) {
      console.log(chalk.yellow(` Paused strategy: ${id}`));
    } else {
      console.log(chalk.red(` Failed to pause (API error).`));
    }
  } else {
    const ok = runner.pauseStrategy(id);
    if (ok) {
      console.log(chalk.yellow(` Paused strategy: ${id}`));
    } else {
      console.log(chalk.red(` Strategy not found: ${id}`));
    }
  }
}

async function stopCommand(id: string, useApi: boolean): Promise<void> {
  const runner = getStrategyRunner();
  if (useApi) {
    const ok = await postToApi(`/strategies/${id}/stop`);
    if (ok) {
      console.log(chalk.gray(` Stopped strategy: ${id}`));
    } else {
      console.log(chalk.red(` Failed to stop (API error).`));
    }
  } else {
    const ok = runner.stopStrategy(id);
    if (ok) {
      console.log(chalk.gray(` Stopped strategy: ${id}`));
    } else {
      console.log(chalk.red(` Strategy not found: ${id}`));
    }
  }
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('> '),
  });

  let useApi = true;

  const processInput = async (line: string) => {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const arg = parts[1];

    switch (cmd) {
      case 'list':
      case 'l':
        await listStrategies(useApi);
        if (useApi) {
          const ok = await fetchFromApi();
          if (!ok) useApi = false;
        }
        break;
      case 'run':
      case 'r':
        if (!arg) {
          console.log(chalk.yellow(' Usage: run <strategy-id>'));
        } else {
          await runCommand(arg, useApi);
        }
        break;
      case 'pause':
      case 'p':
        if (!arg) {
          console.log(chalk.yellow(' Usage: pause <strategy-id>'));
        } else {
          await pauseCommand(arg, useApi);
        }
        break;
      case 'stop':
      case 's':
        if (!arg) {
          console.log(chalk.yellow(' Usage: stop <strategy-id>'));
        } else {
          await stopCommand(arg, useApi);
        }
        break;
      case 'refresh':
        await listStrategies(useApi);
        break;
      case 'quit':
      case 'q':
      case 'exit':
        console.log(chalk.cyan('\n Bye.\n'));
        process.exit(0);
      case '':
        break;
      default:
        console.log(chalk.yellow(' Unknown command. Use: list, run <id>, pause <id>, stop <id>, refresh, quit'));
    }
    rl.prompt();
  };

  printHeader();
  await listStrategies(useApi);
  const apiOk = await fetchFromApi();
  if (!apiOk) useApi = false;

  rl.on('line', (line) => {
    processInput(line).catch((err) => {
      console.error(chalk.red(' Error:'), (err as Error).message);
      rl.prompt();
    });
  });

  rl.on('close', () => process.exit(0));

  rl.prompt();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
