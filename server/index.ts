#!/usr/bin/env node
/**
 * Backend API server - MCP SSE + REST API for webapp
 * - GET/POST /mcp/sse - MCP over HTTP/SSE
 * - GET /api/tools - list tools with enabled state
 * - POST /api/tools/:id/toggle - enable/disable tool
 * - GET /api/data/:module - proxy to modules (server-side API keys)
 * - POST /api/execute-order - forward pre-signed payload (no API keys on server)
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMCPServerCore } from '../src/mcp-server-core.js';
import { dataProxy } from './data-proxy.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const WEBAPP_ORIGIN = process.env.WEBAPP_ORIGIN || 'http://localhost:5173';
const MCP_PATH = '/mcp/sse';

const sessions = new Map<string, { transport: SSEServerTransport }>();

// In-memory tool enabled state (per session - use sessionId or userId in production)
const toolEnabledState = new Map<string, Set<string>>();
const DEFAULT_SESSION = 'default';

function getEnabledTools(sessionId: string): Set<string> {
  if (!toolEnabledState.has(sessionId)) {
    toolEnabledState.set(sessionId, new Set<string>());
  }
  return toolEnabledState.get(sessionId)!;
}

const app = express();
app.use(cors({ origin: WEBAPP_ORIGIN, credentials: true }));

// MCP POST must run BEFORE body parser so handlePostMessage can read raw body
app.post(MCP_PATH, (req, res) => {
  const sessionId = (req.query.sessionId as string) || '';
  if (!sessionId) {
    res.status(400).end('Missing sessionId');
    return;
  }
  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).end('Session not found');
    return;
  }
  session.transport.handlePostMessage(req as unknown as IncomingMessage, res as unknown as ServerResponse).catch((err) => {
    console.error('[MCP] POST error:', err);
    res.status(500).end(String(err));
  });
});

app.use(express.json());

// MCP SSE
app.get(MCP_PATH, (req, res) => {
  const baseUrl = `http://${req.headers.host || 'localhost:' + PORT}`;
  const endpoint = `${baseUrl}${MCP_PATH}`;

  const transport = new SSEServerTransport(endpoint, res as unknown as ServerResponse);
  const core = createMCPServerCore();

  transport.onclose = () => sessions.delete(transport.sessionId);

  core.server
    .connect(transport)
    .catch((err) => {
      console.error('[MCP] Connect error:', err);
      res.status(500).end(String(err));
    });

  sessions.set(transport.sessionId, { transport });
});

// REST API
app.get('/api/tools', async (req, res) => {
  try {
    const core = createMCPServerCore();
    await core.initializeAllModules();
    const tools = core.getAllTools();
    const sessionId = (req.query.sessionId as string) || (req.headers['x-session-id'] as string) || DEFAULT_SESSION;
    const enabled = getEnabledTools(sessionId);

    const list = tools.map((t) => ({
      id: t.name,
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      enabled: enabled.has(t.name),
    }));

    res.json({ tools: list });
  } catch (err) {
    console.error('[API] GET /api/tools:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/tools/:id/toggle', (req, res) => {
  const { id } = req.params;
  const sessionId = (req.body?.sessionId as string) || (req.headers['x-session-id'] as string) || DEFAULT_SESSION;
  const enabled = getEnabledTools(sessionId);

  if (enabled.has(id)) {
    enabled.delete(id);
  } else {
    enabled.add(id);
  }

  res.json({ id, enabled: enabled.has(id) });
});

app.get('/api/data/:module', async (req, res) => {
  try {
    const { module: moduleName } = req.params;
    const result = await dataProxy(moduleName, req.query);
    res.json(result);
  } catch (err) {
    console.error('[API] GET /api/data/:module:', err);
    res.status(500).json({ error: String(err) });
  }
});

/**
 * Execute order - ACCEPTS pre-signed payload from client.
 * Server NEVER stores or receives trading API keys.
 * Body: { provider: string, payload: object }
 * - payload is pre-signed by client using client-side API keys
 * - Server forwards to exchange or client calls exchange directly from browser
 */
app.post('/api/execute-order', (req, res) => {
  const { provider, payload } = req.body || {};
  if (!provider || !payload) {
    res.status(400).json({ error: 'provider and payload required' });
    return;
  }

  // Server does NOT have API keys - this endpoint either:
  // 1) Forwards the pre-signed payload to the exchange (if exchange supports it)
  // 2) Returns instructions for client to call exchange directly from browser
  res.json({
    received: true,
    provider,
    message: 'Pre-signed payload received. In production, forward to exchange or have client call exchange directly. API keys never touch the server.',
  });
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Backend API server on http://localhost:${PORT}`);
  console.log(`  MCP SSE: http://localhost:${PORT}${MCP_PATH}`);
  console.log(`  API:     http://localhost:${PORT}/api/*`);
  console.log(`  CORS:    ${WEBAPP_ORIGIN}`);
});
