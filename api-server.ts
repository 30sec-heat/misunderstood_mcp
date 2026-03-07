#!/usr/bin/env node
/**
 * MCP Web Platform API Server
 * - Serves webapp static files
 * - GET /api/tools - returns all MCP tools with enabled state
 * - POST /api/tools/:name/enable, POST /api/tools/:name/disable
 * - POST /api/tools/call - execute a tool (read-only tools only; trading execution is client-side)
 * - POST /api/trading/relay - relay pre-signed requests to exchanges (server never stores keys)
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getToolRegistry } from './src/api/tool-registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '5174', 10);
const HOST = process.env.HOST || 'localhost';

// Allowed exchange API domains for relay (no keys stored - client signs, we forward)
const ALLOWED_RELAY_HOSTS = [
  'api.binance.com',
  'api1.binance.com',
  'api2.binance.com',
  'api3.binance.com',
  'fapi.binance.com',
  'dapi.binance.com',
  'api.bybit.com',
  'api.bytick.com',
];

const app = express();
app.use(cors());
app.use(express.json());

// Tool registry with enabled state (in-memory for anonymous; extend for DB later)
const toolRegistry = getToolRegistry();

// --- API: Tools ---

/** GET /api/tools - returns all tools with enabled boolean */
app.get('/api/tools', async (req, res) => {
  try {
    const enabledHeader = req.headers['x-enabled-tools'] as string | undefined;
    const enabledList = enabledHeader ? enabledHeader.split(',').map((s) => s.trim()).filter(Boolean) : null;

    const tools = await toolRegistry.listTools(enabledList);
    res.json({ tools });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/tools/:name/enable */
app.post('/api/tools/:name/enable', (req, res) => {
  const { name } = req.params;
  toolRegistry.setEnabled(name, true);
  res.json({ success: true, name, enabled: true });
});

/** POST /api/tools/:name/disable */
app.post('/api/tools/:name/disable', (req, res) => {
  const { name } = req.params;
  toolRegistry.setEnabled(name, false);
  res.json({ success: true, name, enabled: false });
});

/** POST /api/tools/call - execute a tool */
app.post('/api/tools/call', async (req, res) => {
  try {
    const { name, arguments: args } = req.body || {};
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "name" in body' });
      return;
    }
    const result = await toolRegistry.callTool(name, args || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// --- API: Trading relay (client signs in browser, we forward; server never stores keys) ---

app.post('/api/trading/relay', async (req, res) => {
  try {
    const { url, method = 'GET', headers = {}, body } = req.body || {};
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Missing "url" in body' });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      res.status(400).json({ error: 'Invalid URL' });
      return;
    }

    if (!ALLOWED_RELAY_HOSTS.includes(parsed.hostname)) {
      res.status(403).json({
        error: `Relay only allows: ${ALLOWED_RELAY_HOSTS.join(', ')}`,
      });
      return;
    }

    const relayHeaders: Record<string, string> = { ...(headers as Record<string, string>) };
    if (!relayHeaders['Content-Type'] && body) {
      relayHeaders['Content-Type'] = typeof body === 'string' && body.startsWith('{')
        ? 'application/json'
        : 'application/x-www-form-urlencoded';
    }

    const fetchOpts: RequestInit = {
      method: (method as string) || 'GET',
      headers: relayHeaders,
    };
    if (body && (method === 'POST' || method === 'PUT')) {
      fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const resp = await fetch(url, fetchOpts);
    const text = await resp.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    res.status(resp.status).json(json);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// --- Health ---
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', server: 'mcp-web-platform' });
});

// --- Serve webapp ---
const webappDist = path.join(__dirname, 'webapp', 'dist');
app.use(express.static(webappDist));
app.get('*', (req, res) => {
  // Don't serve SPA for API routes
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.sendFile(path.join(webappDist, 'index.html'));
});

async function main() {
  await toolRegistry.initialize();
  console.log(`\n MCP Web Platform API Server`);
  console.log(` Tools loaded: ${(await toolRegistry.listTools()).length}`);
  app.listen(PORT, HOST, () => {
    console.log(` HTTP: http://${HOST}:${PORT}`);
    console.log(` API: GET /api/tools, POST /api/tools/:name/enable|disable, POST /api/tools/call`);
    console.log(` Trading relay: POST /api/trading/relay (client signs, server forwards)`);
    console.log(`\n Press Ctrl+C to stop\n`);
  });
}

main().catch((err) => {
  console.error(' Failed:', err);
  process.exit(1);
});
