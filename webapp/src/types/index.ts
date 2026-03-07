// MCP Tool types
export interface MCPTool {
  id: string;
  name: string;
  description: string;
  module: string;
  enabled: boolean;
  inputSchema?: Record<string, unknown>;
}

export interface MCPModule {
  id: string;
  name: string;
  tools: MCPTool[];
  enabled: boolean;
}

// Data Explorer types
export interface DataModule {
  id: string;
  name: string;
  description: string;
  endpoints: string[];
}

export interface DataRecord {
  [key: string]: string | number | boolean | null;
}

// Settings - API keys (client-side only, localStorage)
export interface StoredAPIKey {
  id: string;
  name: string;
  service: string;
  maskedValue: string; // e.g., "sk-***xyz"
  createdAt: string;
}

// Agent chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: string[];
}
