#!/usr/bin/env node
/**
 * MCP server — stdio transport (Cursor, Claude Desktop, etc.)
 */
import dotenv from 'dotenv';
dotenv.config();

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMCPServerCore } from './src/mcp-server-core.js';

async function shutdown(modules: ReturnType<typeof createMCPServerCore>['getModules'], signal: string) {
  console.error(`\n${signal}, shutting down...`);
  for (const mod of modules().values()) {
    try {
      await mod.cleanup?.();
    } catch (e) {
      console.error(`cleanup ${mod.name}:`, e);
    }
  }
  process.exit(0);
}

async function main() {
  const core = createMCPServerCore();
  await core.initializeAllModules();
  const toolCount = core.getAllTools().length;
  console.error(`[mcp-deribit] ${toolCount} tools ready (stdio)`);

  const transport = new StdioServerTransport();
  transport.onerror = (err) => console.error('[mcp-deribit] transport error:', err);
  await core.server.connect(transport);

  const mods = core.getModules;
  process.on('SIGINT', () => void shutdown(mods, 'SIGINT'));
  process.on('SIGTERM', () => void shutdown(mods, 'SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
