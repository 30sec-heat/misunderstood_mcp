/**
 * Live Price Feed - Unified price source for strategy executor
 * Uses WebSocket (PriceStreamManager) when available, falls back to REST (PriceFetcher)
 */

import { PriceStreamManager, priceStreamManager } from './price-stream-manager.js';
import { PriceFetcher } from '../modules/quote/tools/PriceFetcher.js';

export interface LivePriceFeedOptions {
  /** Enable WebSocket streams (default: true) */
  useWebSocket?: boolean;
  /** Symbols to subscribe to when WebSocket enabled */
  symbols?: string[];
}

/** Combines WebSocket streams + REST fallback for strategy executor */
export class LivePriceFeed {
  private streamManager: PriceStreamManager;
  private priceFetcher: PriceFetcher;
  private useWebSocket: boolean;
  private subscribedSymbols: Set<string> = new Set();

  constructor(options: LivePriceFeedOptions = {}) {
    this.streamManager = priceStreamManager;
    this.priceFetcher = new PriceFetcher();
    this.useWebSocket = options.useWebSocket ?? true;
    if (options.symbols?.length) {
      this.subscribe(options.symbols);
    }
  }

  /** Subscribe symbols to WebSocket streams */
  subscribe(symbols: string[]): void {
    for (const s of symbols) {
      const sym = s.replace(/[\/:]/g, '').toUpperCase();
      const normalized = sym.endsWith('USDT') ? sym : sym + 'USDT';
      this.subscribedSymbols.add(normalized);
    }
    if (this.useWebSocket) {
      this.streamManager.subscribe(Array.from(this.subscribedSymbols));
    }
  }

  /** Get current price - from WebSocket cache if fresh, else REST */
  async getPrice(symbol: string): Promise<number | null> {
    const sym = this.norm(symbol);

    if (this.useWebSocket) {
      const cached = this.streamManager.getPrice(sym);
      if (cached != null) return cached;
    }

    const prices = await this.priceFetcher.fetchPrices(sym);
    const valid = prices.filter((p) => (p.spotPrice ?? p.perpPrice) != null);
    if (valid.length === 0) return null;
    const values = valid.map((p) => p.spotPrice ?? p.perpPrice!);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /** Subscribe to price update events (for event-driven executor) */
  onPriceUpdate(cb: (update: { symbol: string; price: number }) => void): () => void {
    const handler = (u: any) => cb({ symbol: u.symbol, price: u.price });
    this.streamManager.on('price', handler);
    return () => this.streamManager.off('price', handler);
  }

  isWebSocketConnected(): boolean {
    return this.streamManager.isConnected();
  }

  private norm(s: string): string {
    const u = s.replace(/[\/:]/g, '').toUpperCase();
    return u.endsWith('USDT') ? u : u + 'USDT';
  }

  disconnect(): void {
    this.streamManager.disconnect();
  }
}
