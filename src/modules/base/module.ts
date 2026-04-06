import { createMCPHandler } from './response-wrapper.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown;
  handler?: (args: unknown) => Promise<unknown>;
}

export interface CryptoModule {
  name: string;
  tools: ToolDefinition[];
  initialize(): Promise<void>;
  cleanup?(): Promise<void>;
}

export abstract class BaseCryptoModule implements CryptoModule {
  abstract name: string;
  protected _tools: ToolDefinition[] = [];
  protected isInitialized = false;

  get tools() {
    return this._tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      handler: tool.handler || (() => Promise.resolve({ error: 'Handler not implemented' })),
    }));
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  protected abstract setupTools(): void;

  protected addTool(tool: ToolDefinition) {
    if (tool.handler) {
      tool.handler = createMCPHandler(tool.handler as (args: any) => Promise<any>);
    }
    this._tools.push(tool);
  }

  protected getToolHandler(toolName: string) {
    return this._tools.find((t) => t.name === toolName)?.handler;
  }

  async executeTool(toolName: string, args: unknown = {}): Promise<unknown> {
    const handler = this.getToolHandler(toolName);
    if (!handler) {
      throw new Error(`Tool ${toolName} not found in module ${this.name}`);
    }
    return handler(args);
  }

  async cleanup(): Promise<void> {
    /* override in subclasses if needed */
  }
}
