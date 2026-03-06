#!/usr/bin/env node
/**
 * Lite HTTP API Server - Minimal modules for AI Trading Agent
 * Loads only Quote, Trading, Knowledge, Forecasting (no DB-heavy or broken deps)
 * Use: npm run server (or server-lite for explicit)
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { QuoteModule } from './src/modules/quote/index.js';
import { TradingModule } from './src/modules/trading/index.js';
import { OrderFlowModule } from './src/modules/orderflow/index.js';
import { ResearchModule } from './src/modules/research/index.js';
import { getStrategyRunner } from './src/strategy/strategy-runner.js';
import { PriceFetcher } from './src/modules/quote/tools/PriceFetcher.js';
import { ConditionalStrategyExecutor } from './src/strategy/executor.js';
import { TradingClient } from './src/modules/trading/TradingClient.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || 'localhost';

const modules = [
  new QuoteModule(),
  new TradingModule(),
  new OrderFlowModule(),
  new ResearchModule(),
];

async function initialize() {
  for (const m of modules) {
    try {
      await m.initialize();
      console.log(` ✓ ${m.name} module loaded`);
    } catch (err) {
      console.warn(` ✗ ${m.name} module failed:`, (err as Error).message);
    }
  }
}

function getTools() {
  return modules.flatMap((m) => m.tools || []);
}

async function callTool(name: string, args: any) {
  for (const m of modules) {
    const tool = (m.tools || []).find((t: any) => t.name === name);
    if (tool?.handler) {
      return await tool.handler(args);
    }
  }
  throw new Error(`Tool not found: ${name}`);
}

const app = express();
app.use(cors());
app.use(express.json());

// --- Strategy management API ---

app.get('/strategies', async (_req, res) => {
  try {
    const runner = getStrategyRunner();
    const withStatus = runner.getStrategiesWithStatus();
    const priceFetcher = new PriceFetcher();
    const list = await Promise.all(
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
          sizeType: row.strategy.sizeType,
          sizeValue: row.strategy.sizeValue,
        };
      })
    );
    res.json({ strategies: list });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/strategies/:id/run', (req, res) => {
  try {
    const { id } = req.params;
    const runner = getStrategyRunner();
    const ok = runner.startStrategy(id);
    if (ok) {
      res.json({ success: true, id, status: 'running' });
    } else {
      res.status(404).json({ error: `Strategy not found: ${id}` });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/strategies/:id/pause', (req, res) => {
  try {
    const { id } = req.params;
    const runner = getStrategyRunner();
    const ok = runner.pauseStrategy(id);
    if (ok) {
      res.json({ success: true, id, status: 'paused' });
    } else {
      res.status(404).json({ error: `Strategy not found: ${id}` });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/strategies/:id/stop', (req, res) => {
  try {
    const { id } = req.params;
    const runner = getStrategyRunner();
    const ok = runner.stopStrategy(id);
    if (ok) {
      res.json({ success: true, id, status: 'stopped' });
    } else {
      res.status(404).json({ error: `Strategy not found: ${id}` });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/tools', (_req, res) => {
  const tools = getTools();
  res.json({
    tools: tools.map((t: any) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  });
});

app.post('/tools/call', async (req, res) => {
  try {
    const { name, arguments: args } = req.body || {};
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "name" in body' });
      return;
    }
    const result = await callTool(name, args || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    modules: modules.length,
    tools: getTools().length,
  });
});

app.get('/', (_req, res) => {
  res.json({
    server: 'ai-trading-agent-lite',
    version: '1.0.0',
    tools: getTools().length,
    usage: 'npm run ysalis -- -b http://localhost:' + PORT,
    endpoints: [
      'GET /strategies',
      'POST /strategies/:id/run',
      'POST /strategies/:id/pause',
      'POST /strategies/:id/stop',
    ],
  });
});

async function main() {
  console.log('\n AI Trading Agent - Lite API Server\n');
  await initialize();

  // Strategy executor: polls runner.getStrategiesToExecute() each interval (dynamic provider)
  const runner = getStrategyRunner();
  const tradingClient = new TradingClient();
  const balanceFetcher = {
    async fetchUsdtBalance(exchange: string, marketType: string): Promise<number> {
      try {
        const bal = await tradingClient.fetchBalance(
          exchange as 'binance' | 'bybit',
          marketType as 'spot' | 'futures'
        );
        return bal.total?.USDT ?? bal.balances?.USDT?.free ?? 0;
      } catch {
        return 0;
      }
    },
  };
  const orderExecutor = async (params: any) => {
    const side = params.action === 'long' ? 'buy' : 'sell';
    const exchange = (params.exchange as 'binance' | 'bybit') || 'binance';
    const marketType = (params.marketType === 'futures' || params.marketType === 'perp') ? 'futures' : 'spot';
    await tradingClient.createMarketOrder(params.symbol, side, params.size ?? 0.001, { exchange, marketType });
    console.log(`[STRATEGY] Executed ${params.action} ${params.symbol} on ${exchange}`);
  };
  const executor = new ConditionalStrategyExecutor({
    dryRun: process.env.STRATEGY_DRY_RUN !== 'false',
    pollIntervalMs: 30_000,
    orderExecutor,
    balanceFetcher,
  });
  executor.start(() => runner.getStrategiesToExecute());

  console.log('');

  app.listen(PORT, HOST, () => {
    console.log(` HTTP API: http://${HOST}:${PORT}`);
    console.log(' Endpoints: GET /tools, POST /tools/call, GET /health');
    console.log(' Strategy: GET /strategies, POST /strategies/:id/run, /pause, /stop');
    console.log(' Run Ysalis: npm run ysalis -- -b http://localhost:' + PORT);
    console.log('\n Press Ctrl+C to stop\n');
  });
}

main().catch((err) => {
  console.error(' Failed:', err);
  process.exit(1);
});
