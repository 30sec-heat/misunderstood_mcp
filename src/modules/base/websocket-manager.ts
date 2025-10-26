import * as WebSocket from 'ws';

export interface WebSocketConfig {
  name: string;
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export class WebSocketManager {
  private static instance: WebSocketManager;
  private connections: Map<string, WebSocket> = new Map();
  private configs: Map<string, WebSocketConfig> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  registerWebSocket(config: WebSocketConfig): void {
    this.configs.set(config.name, {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      ...config
    });
  }

  async connect(name: string): Promise<WebSocket> {
    if (this.connections.has(name)) {
      return this.connections.get(name)!;
    }

    const config = this.configs.get(name);
    if (!config) {
      throw new Error(`WebSocket ${name} not registered`);
    }

    return new Promise((resolve, reject) => {
      const ws = new (WebSocket as any)(config.url);
      
      ws.on('open', () => {
        console.log(`🔌 WebSocket connected: ${name}`);
        this.connections.set(name, ws);
        this.reconnectAttempts.set(name, 0);
        
        // Start heartbeat
        this.startHeartbeat(name, config);
        resolve(ws);
      });

      ws.on('error', (error: any) => {
        console.error(`[ERROR] WebSocket error for ${name}:`, error);
        reject(error);
      });

      ws.on('close', () => {
        console.log(`🔌 WebSocket disconnected: ${name}`);
        this.connections.delete(name);
        this.stopHeartbeat(name);
        
        // Attempt reconnection
        this.attemptReconnect(name, config);
      });
    });
  }

  private startHeartbeat(name: string, config: WebSocketConfig): void {
    if (config.heartbeatInterval && config.heartbeatInterval > 0) {
      const timer = setInterval(() => {
        const ws = this.connections.get(name);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, config.heartbeatInterval);
      
      this.heartbeatTimers.set(name, timer);
    }
  }

  private stopHeartbeat(name: string): void {
    const timer = this.heartbeatTimers.get(name);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(name);
    }
  }

  private attemptReconnect(name: string, config: WebSocketConfig): void {
    const attempts = this.reconnectAttempts.get(name) || 0;
    
    if (attempts >= (config.maxReconnectAttempts || 10)) {
      console.error(`[ERROR] Max reconnection attempts reached for ${name}`);
      return;
    }

    this.reconnectAttempts.set(name, attempts + 1);
    
    const timer = setTimeout(async () => {
      try {
        console.log(`[REFRESH] Attempting to reconnect ${name} (attempt ${attempts + 1})`);
        await this.connect(name);
      } catch (error) {
        console.error(`[ERROR] Reconnection failed for ${name}:`, error);
      }
    }, config.reconnectInterval || 5000);

    this.reconnectTimers.set(name, timer);
  }

  disconnect(name: string): void {
    const ws = this.connections.get(name);
    if (ws) {
      ws.close();
      this.connections.delete(name);
    }
    
    this.stopHeartbeat(name);
    
    const timer = this.reconnectTimers.get(name);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(name);
    }
  }

  disconnectAll(): void {
    const names = Array.from(this.connections.keys());
    names.forEach(name => this.disconnect(name));
  }

  getConnection(name: string): WebSocket | undefined {
    return this.connections.get(name);
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getConnections(): string[] {
    return Array.from(this.connections.keys());
  }

  isConnected(name: string): boolean {
    const ws = this.connections.get(name);
    return ws ? ws.readyState === WebSocket.OPEN : false;
  }
}

// Export singleton instance
export const websocketManager = WebSocketManager.getInstance();
