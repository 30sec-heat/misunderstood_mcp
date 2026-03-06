#!/usr/bin/env node
/**
 * HTTP API Server for AI Trading Agent
 * Exposes /tools and /tools/call for CLI agent --backend-url
 * Also runs the crypto backend (data sync, modules)
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { cryptoBackend } from './backend.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || 'localhost';

const app = express();
app.use(cors());
app.use(express.json());

// GET /tools - list available MCP tools
app.get('/tools', async (_req, res) => {
  try {
    const tools = cryptoBackend.getTools();
    res.json({
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// POST /tools/call - execute a tool
app.post('/tools/call', async (req, res) => {
  try {
    const { name, arguments: args } = req.body || {};
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "name" in body' });
      return;
    }
    const result = await cryptoBackend.callTool(name, args || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error',
      message: 'Tool execution failed',
    });
  }
});

// GET /health - service status
app.get('/health', (_req, res) => {
  try {
    const status = cryptoBackend.getServiceStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// GET / - server info
app.get('/', (_req, res) => {
  try {
    const info = cryptoBackend.getServerInfo();
    res.json(info);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

async function main() {
  console.log(' Starting Crypto Backend...');
  await cryptoBackend.initialize();
  console.log(' Crypto Backend initialized.');

  app.listen(PORT, HOST, () => {
    console.log(` HTTP API listening on http://${HOST}:${PORT}`);
    console.log(' Endpoints: GET /tools, POST /tools/call, GET /health');
    console.log(' Use: npm run agent -- --backend-url http://localhost:' + PORT);
    console.log(' Press Ctrl+C to stop');
  });
}

main().catch((err) => {
  console.error(' Failed to start server:', err);
  process.exit(1);
});
