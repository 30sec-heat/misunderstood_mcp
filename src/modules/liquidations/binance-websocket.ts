import WebSocket from 'ws';
import { LiquidationPostgresDatabase, LiquidationRecord, OpenInterestRecord } from './postgres-database.js';

export interface BinanceLiquidationEvent {
  e: string; // Event type
  E: number; // Event time
  o: {
    s: string; // Symbol
    S: string; // Side (BUY/SELL)
    o: string; // Order type
    f: string; // Time in force
    q: string; // Quantity
    p: string; // Price
    ap: string; // Average price
    X: string; // Order status
    l: string; // Last filled quantity
    z: string; // Cumulative filled quantity
    T: number; // Trade time
  };
}

export interface BinanceOpenInterestEvent {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  oi: string; // Open interest
  hi: string; // High interest
  li: string; // Low interest
  c: string; // Change
  V: string; // Volume
  Q: string; // Quote volume
  O: number; // Open time
  C: number; // Close time
  F: number; // First trade ID
  L: number; // Last trade ID
  n: number; // Number of trades
  bo: string; // Base open interest
  qo: string; // Quote open interest
  b: string; // Bid price
  a: string; // Ask price
  B: string; // Bid quantity
  A: string; // Ask quantity
  T: number; // Trade time
  E2: number; // Event time
}

export class BinanceWebSocketListener {
  private ws: WebSocket | null = null;
  private db: LiquidationPostgresDatabase;
  private reconnectInterval: number = 5000;
  private maxReconnectAttempts: number = 10;
  private reconnectAttempts: number = 0;
  private isConnected: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private minLiquidationThreshold: number = 20000; // $20k USD minimum

  constructor(db: LiquidationPostgresDatabase) {
    this.db = db;
  }

  async connect(): Promise<void> {
    try {
      this.ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');
      
      this.ws!.on('open', () => {
        console.log('Binance liquidation WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
      });

      this.ws!.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleLiquidationEvent(message);
        } catch (error) {
          console.error('Error parsing Binance liquidation message:', error);
        }
      });

      this.ws!.on('close', (code: number, reason: string) => {
        console.log(`Binance liquidation WebSocket closed: ${code} ${reason}`);
        this.isConnected = false;
        this.stopHeartbeat();
        this.handleReconnect();
      });

      this.ws!.on('error', (error: Error) => {
        console.error('Binance liquidation WebSocket error:', error);
        this.isConnected = false;
        this.handleReconnect();
      });

    } catch (error) {
      console.error('Failed to connect to Binance liquidation WebSocket:', error);
      this.handleReconnect();
    }
  }

  private handleLiquidationEvent(event: BinanceLiquidationEvent): void {
    try {
      if (event.e === 'forceOrder') {
        const notionalValue = parseFloat(event.o.q) * parseFloat(event.o.p);
        
        // Only process liquidations above threshold to reduce noise
        if (notionalValue < this.minLiquidationThreshold) {
          return;
        }
        
        const liquidation: Omit<LiquidationRecord, 'created_at'> = {
          id: `${event.E}_${event.o.s}_${event.o.T}`,
          symbol: event.o.s,
          exchange: 'binance',
          side: event.o.S === 'BUY' ? 'short' : 'long', // BUY means short liquidation, SELL means long liquidation
          quantity: parseFloat(event.o.q),
          price: parseFloat(event.o.p),
          notional_value: notionalValue,
          timestamp: new Date(event.E).toISOString(),
          source: 'binance_ws'
        };

        this.db.addLiquidation(liquidation).catch(error => {
          console.error('Error saving liquidation to database:', error);
        });

        console.log(`💥 Large Liquidation: ${liquidation.symbol} ${liquidation.side} ${liquidation.quantity} @ ${liquidation.price} ($${liquidation.notional_value.toLocaleString()})`);
      }
    } catch (error) {
      console.error('Error handling liquidation event:', error);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect to Binance liquidation WebSocket (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.error('Max reconnection attempts reached for Binance liquidation WebSocket');
    }
  }

  async connectOpenInterest(): Promise<void> {
    try {
      const openInterestWs = new WebSocket('wss://fstream.binance.com/ws/!openInterest@arr');
      
      openInterestWs.on('open', () => {
        console.log('Binance open interest WebSocket connected');
      });

      openInterestWs.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleOpenInterestEvent(message);
        } catch (error) {
          console.error('Error parsing Binance open interest message:', error);
        }
      });

      openInterestWs.on('close', (code: number, reason: string) => {
        console.log(`Binance open interest WebSocket closed: ${code} ${reason}`);
      });

      openInterestWs.on('error', (error: Error) => {
        console.error('Binance open interest WebSocket error:', error);
      });

    } catch (error) {
      console.error('Failed to connect to Binance open interest WebSocket:', error);
    }
  }

  private handleOpenInterestEvent(event: BinanceOpenInterestEvent): void {
    try {
      if (event.e === 'openInterest') {
        const openInterest: Omit<OpenInterestRecord, 'id' | 'created_at'> = {
          symbol: event.s,
          exchange: 'binance',
          value: parseFloat(event.oi),
          timestamp: new Date(event.E).toISOString(),
          source: 'binance_ws'
        };

        this.db.addOpenInterest(openInterest).catch(error => {
          console.error('Error saving open interest to database:', error);
        });
      }
    } catch (error) {
      console.error('Error handling open interest event:', error);
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  isWebSocketConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}
