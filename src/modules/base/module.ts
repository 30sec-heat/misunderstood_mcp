import { CryptoModule } from '../../index';
// DatabaseManager removed - using PostgreSQL directly
import { PostgresManager } from './postgres-manager.js';
import { websocketManager, WebSocketConfig } from './websocket-manager.js';
import { createMCPHandler } from './response-wrapper.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler?: (args: any) => Promise<any>;
}

export abstract class BaseCryptoModule implements CryptoModule {
  abstract name: string;
  protected _tools: ToolDefinition[] = [];
  protected isInitialized: boolean = false;
  protected postgresManager: PostgresManager;

  constructor() {
    this.postgresManager = PostgresManager.getInstance();
    // Don't call setupTools() here - let derived classes call it after initializing properties
  }

  get tools() {
    return this._tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      handler: tool.handler || (() => Promise.resolve({ error: 'Handler not implemented' })),
    }));
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    // Tools are already set up in constructor
    this.isInitialized = true;
  }

  protected abstract setupTools(): void;

  protected addTool(tool: ToolDefinition) {
    // Wrap the handler to ensure MCP-compliant responses
    if (tool.handler) {
      tool.handler = createMCPHandler(tool.handler);
    }
    this._tools.push(tool);
  }

  protected getToolHandler(toolName: string) {
    return this._tools.find(tool => tool.name === toolName)?.handler;
  }

  async executeTool(toolName: string, args: any = {}): Promise<any> {
    const handler = this.getToolHandler(toolName);
    if (!handler) {
      throw new Error(`Tool ${toolName} not found in module ${this.name}`);
    }
    return await handler(args);
  }

  // Database management helpers - using PostgreSQL directly
  protected registerDatabase(config: any): void {
    // DatabaseManager removed - using PostgreSQL directly
  }

  protected async getDatabase(name: string): Promise<any> {
    // DatabaseManager removed - using PostgreSQL directly
    return null;
  }

  // WebSocket management helpers
  protected registerWebSocket(config: WebSocketConfig): void {
    websocketManager.registerWebSocket(config);
  }

  protected async getWebSocket(name: string): Promise<any> {
    return await websocketManager.connect(name);
  }

  protected getWebSocketConnection(name: string): any {
    return websocketManager.getConnection(name);
  }

  protected isWebSocketConnected(name: string): boolean {
    return websocketManager.isConnected(name);
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    // Override in subclasses for specific cleanup
  }
}
