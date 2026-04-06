/**
 * Shared MCP server: Deribit tools only (public REST API).
 * Used by stdio (mcp-server-socket.ts) and HTTP/SSE (mcp-server-http.ts).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { DeribitModule } from './modules/deribit/index.js';
import type { CryptoModule } from './modules/base/module.js';

export type { CryptoModule };

export interface MCPServerCore {
  server: Server;
  getAllTools: () => any[];
  getModules: () => Map<string, CryptoModule>;
  initializeAllModules: () => Promise<void>;
}

export function createMCPServerCore(): MCPServerCore {
  const server = new Server(
    {
      name: 'mcp-deribit-server',
      version: '1.0.0',
      description: 'MCP server exposing Deribit options and volatility tools (public API)',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const modules: Map<string, CryptoModule> = new Map();
  let allTools: any[] = [];
  let isInitialized = false;

  async function initializeAllModules() {
    if (isInitialized) return;

    try {
      const deribit = new DeribitModule();
      await deribit.initialize();
      modules.set('deribit', deribit);
      allTools = [...(deribit.tools || [])];
    } catch (error) {
      console.error('[MCP] deribit module init failed:', error);
    }

    isInitialized = true;
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    if (!isInitialized) await initializeAllModules();
    return {
      tools: allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (!isInitialized) await initializeAllModules();

    const tool = allTools.find((t) => t.name === name);
    if (!tool) throw new Error(`Tool not found: ${name}`);

    return await tool.handler(args);
  });

  return {
    server,
    getAllTools: () => allTools,
    getModules: () => modules,
    initializeAllModules,
  };
}
