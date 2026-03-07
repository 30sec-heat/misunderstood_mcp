#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMCPServerCore } from './src/mcp-server-core.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const MCP_PATH = '/mcp/sse';

const sessions = new Map<string, { transport: SSEServerTransport }>();

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method === 'GET' && path === MCP_PATH) {
    handleSSEConnection(req, res, url);
    return;
  }

  if (req.method === 'POST' && path === MCP_PATH) {
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      res.writeHead(400).end('Missing sessionId');
      return;
    }
    const entry = sessions.get(sessionId);
    if (!entry) {
      res.writeHead(404).end('Session not found');
      return;
    }
    entry.transport.handlePostMessage(req, res);
    return;
  }

  res.writeHead(404).end('Not found');
}

function handleSSEConnection(req: IncomingMessage, res: ServerResponse, url: URL) {
  const baseUrl = `http://${req.headers.host}`;
  const endpoint = `${baseUrl}${MCP_PATH}`;

  const core = createMCPServerCore();
  const transport = new SSEServerTransport(endpoint, res);

  transport.onclose = () => {
    sessions.delete(transport.sessionId);
  };

  sessions.set(transport.sessionId, { transport });
  core.server.connect(transport).then(() => transport.start()).catch((err) => {
    console.error('[MCP HTTP] SSE connect error:', err);
    res.writeHead(500).end(String(err));
  });
}

async function main() {
  await createMCPServerCore().initializeAllModules();
  const server = createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`MCP HTTP server listening on http://localhost:${PORT}${MCP_PATH}`);
    console.log('Claude and other clients can connect via HTTP/SSE');
  });
}

main().catch(console.error);
