#!/usr/bin/env node
/**
 * MCP Crypto Server - HTTP/SSE transport
 * Claude and other clients connect via HTTP/SSE at GET /mcp/sse
 */

import dotenv from 'dotenv';
dotenv.config();

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMCPServerCore } from './src/mcp-server-core.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const MCP_PATH = '/mcp/sse';

const sessions = new Map<string, { transport: SSEServerTransport }>();

function handleGet(req: IncomingMessage, res: ServerResponse) {
  if (req.url !== MCP_PATH && req.url !== MCP_PATH + '/') {
    res.writeHead(404).end('Not Found');
    return;
  }

  const baseUrl = `http://${req.headers.host || 'localhost:' + PORT}`;
  const endpoint = `${baseUrl}${MCP_PATH}`;

  const transport = new SSEServerTransport(endpoint, res);
  const core = createMCPServerCore();

  transport.onclose = () => {
    sessions.delete(transport.sessionId);
  };

  core.server.connect(transport).catch((err) => {
    console.error('[MCP HTTP] Connect error:', err);
    res.writeHead(500).end(String(err));
    return;
  });

  sessions.set(transport.sessionId, { transport });
}

function handlePost(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  if (url.pathname !== MCP_PATH && url.pathname !== MCP_PATH + '/') {
    res.writeHead(404).end('Not Found');
    return;
  }

  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) {
    res.writeHead(400).end('Missing sessionId');
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    res.writeHead(404).end('Session not found');
    return;
  }

  session.transport.handlePostMessage(req, res).catch((err) => {
    console.error('[MCP HTTP] POST error:', err);
    res.writeHead(500).end(String(err));
  });
}

const server = createServer((req, res) => {
  if (req.method === 'GET') handleGet(req, res);
  else if (req.method === 'POST') handlePost(req, res);
  else res.writeHead(405).end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`MCP Crypto Server (HTTP/SSE) listening on http://localhost:${PORT}${MCP_PATH}`);
  console.log('Claude and other clients can connect via SSE');
});
