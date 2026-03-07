/**
 * Tool registry for the web platform API.
 * Loads modules with dynamic import to avoid broken dependencies (e.g. Aave).
 * Falls back to minimal set if full MCP core fails.
 */

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  enabled: boolean;
}

export interface ToolRegistry {
  initialize(): Promise<void>;
  listTools(enabledFilter?: string[] | null): Promise<ToolInfo[]>;
  setEnabled(name: string, enabled: boolean): void;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}

const enabledState = new Map<string, boolean>();

async function loadMinimalModules(): Promise<{ getAllTools: () => any[] }> {
  const allTools: any[] = [];
  const modulesToTry = [
    ['quote', () => import('../modules/quote/index.js')],
    ['chart', () => import('../modules/chart/index.js')],
    ['config', () => import('../modules/config/index.js')],
    ['trading', () => import('../modules/trading/index.js')],
    ['knowledge', () => import('../modules/knowledge/index.js')],
  ] as const;

  for (const [name, imp] of modulesToTry) {
    try {
      const mod = await imp();
      const M = mod[Object.keys(mod)[0] as keyof typeof mod];
      if (M && typeof M === 'function') {
        const instance = new (M as new () => { tools: any[]; initialize(): Promise<void> })();
        await instance.initialize();
        const tools = instance.tools || [];
        allTools.push(...tools);
        console.log(`[API] Loaded ${tools.length} tools from ${name}`);
      }
    } catch (e) {
      console.warn(`[API] Skipped ${name} module:`, (e as Error).message);
    }
  }

  return {
    getAllTools: () => allTools,
  };
}

export function getToolRegistry(): ToolRegistry {
  let core: { getAllTools: () => any[] } | null = null;

  return {
    async initialize() {
      try {
        const { createMCPServerCore } = await import('../mcp-server-core.js');
        const mcp = createMCPServerCore();
        await mcp.initializeAllModules();
        core = mcp;
        console.log(`[API] Loaded ${mcp.getAllTools().length} tools from MCP core`);
      } catch (e) {
        console.warn('[API] MCP core failed, using minimal modules:', (e as Error).message);
        core = await loadMinimalModules();
      }
    },

    async listTools(enabledFilter: string[] | null = null): Promise<ToolInfo[]> {
      if (!core) throw new Error('Tool registry not initialized');
      const tools = core.getAllTools();

      return tools.map((t) => {
        let enabled = true;
        if (enabledFilter) {
          enabled = enabledFilter.includes(t.name);
        } else {
          enabled = enabledState.has(t.name) ? !!enabledState.get(t.name) : true;
        }
        return {
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          enabled,
        };
      });
    },

    setEnabled(name: string, enabled: boolean) {
      enabledState.set(name, enabled);
    },

    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      if (!core) throw new Error('Tool registry not initialized');
      const tools = core.getAllTools();
      const tool = tools.find((t) => t.name === name);
      if (!tool) throw new Error(`Tool not found: ${name}`);
      return tool.handler(args);
    },
  };
}
