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

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || 'localhost';

const modules = [
  new QuoteModule(),
  new TradingModule(),
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
    usage: 'npm run agent -- -b http://localhost:' + PORT,
  });
});

async function main() {
  console.log('\n AI Trading Agent - Lite API Server\n');
  await initialize();
  console.log('');

  app.listen(PORT, HOST, () => {
    console.log(` HTTP API: http://${HOST}:${PORT}`);
    console.log(' Endpoints: GET /tools, POST /tools/call, GET /health');
    console.log(' Run agent: npm run agent -- -b http://localhost:' + PORT);
    console.log('\n Press Ctrl+C to stop\n');
  });
}

main().catch((err) => {
  console.error(' Failed:', err);
  process.exit(1);
});
