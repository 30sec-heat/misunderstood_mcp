/**
 * Price Stream Manager - WebSocket-based real-time price/OHLC feeds
 * Subscribes to Binance and Bybit WebSocket streams for ticker and kline data.
 * Used by strategy executor for event-driven condition evaluation.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
  source: 'binance_spot' | 'binance_futures' | 'bybit_spot' | 'bybit_futures';
}

export interface KlineUpdate {
  symbol: string;
  interval: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  closed: boolean;
  source: string;
}

type KlineInterval = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '1d';

/** Singleton: manages WebSocket connections and caches latest prices/OHLC */
export class PriceStreamManager extends EventEmitter {
  private static instance: PriceStreamManager | null = null;
  private binanceSpotWs: WebSocket | null = null;
  private binanceFuturesWs: WebSocket | null = null;
  private bybitSpotWs: WebSocket | null = null;
  private bybitFuturesWs: WebSocket | null = null;
  private priceCache: Map<string, PriceUpdate> = new Map();
  private klineCache: Map<string, KlineUpdate> = new Map();
  private subscribedSymbols: Set<string> = new Set();
  private interval: KlineInterval = '1m';
  private reconnectAttempts = 0;
  private readonly maxReconnect = 10;

  static getInstance(): PriceStreamManager {
    if (!PriceStreamManager.instance) {
      PriceStreamManager.instance = new PriceStreamManager();
    }
    return PriceStreamManager.instance;
  }

  /** Subscribe to price updates for symbols. Adds to existing subscriptions. */
  subscribe(symbols: string[], options?: { interval?: KlineInterval }): void {
    if (options?.interval) this.interval = options.interval;
    for (const s of symbols) {
      const sym = s.replace(/[\/:]/g, '').toUpperCase().replace('USDT', '') + 'USDT';
      this.subscribedSymbols.add(sym);
    }
    this.connect();
  }

  /** Get cached price for symbol (any exchange) */
  getPrice(symbol: string): number | null {
    const sym = symbol.replace(/[\/:]/g, '').toUpperCase();
    const keys = [sym, sym + 'USDT', sym.replace('USDT', '') + 'USDT'];
    for (const k of keys) {
      const hit = this.priceCache.get(k);
      if (hit) return hit.price;
      for (const [cachedKey, v] of this.priceCache) {
        if (cachedKey.replace('USDT', '') === k.replace('USDT', '')) return v.price;
      }
    }
    return null;
  }

  /** Get cached kline for symbol */
  getKline(symbol: string, interval?: string): KlineUpdate | null {
    const sym = this.normSymbol(symbol);
    const int = interval || this.interval;
    return this.klineCache.get(`${sym}_${int}`) ?? null;
  }

  /** Get latest price from any connected source, or null if stale (>60s) */
  getFreshPrice(symbol: string): number | null {
    const p = this.getPrice(symbol);
    if (!p) return null;
    const sym = this.normSymbol(symbol);
    for (const [k, v] of this.priceCache) {
      if (k.includes(sym.replace('USDT', ''))) {
        if (Date.now() - v.timestamp < 60_000) return v.price;
        return null;
      }
    }
    return p;
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }

  isConnected(): boolean {
    return (
      (this.binanceSpotWs?.readyState === WebSocket.OPEN) ||
      (this.binanceFuturesWs?.readyState === WebSocket.OPEN) ||
      (this.bybitSpotWs?.readyState === WebSocket.OPEN) ||
      (this.bybitFuturesWs?.readyState === WebSocket.OPEN)
    );
  }

  private normSymbol(s: string): string {
    const u = s.replace(/[\/:]/g, '').toUpperCase();
    return u.endsWith('USDT') ? u : u + 'USDT';
  }

  private connect(): void {
    const syms = Array.from(this.subscribedSymbols);
    if (syms.length === 0) return;

    const streams = syms
      .map((s) => `${s.toLowerCase()}@trade`)
      .join('/');
    const binanceSpotUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    const binanceFuturesStreams = syms
      .map((s) => `${s.toLowerCase()}@aggTrade`)
      .join('/');
    const binanceFuturesUrl = `wss://fstream.binance.com/stream?streams=${binanceFuturesStreams}`;

    if (!this.binanceSpotWs || this.binanceSpotWs.readyState !== WebSocket.OPEN) {
      try {
        this.binanceSpotWs = new WebSocket(binanceSpotUrl);
        this.binanceSpotWs.on('message', (data) => this.handleBinanceSpot(data, 'binance_spot'));
        this.binanceSpotWs.on('close', () => this.handleClose('binance_spot'));
        this.binanceSpotWs.on('error', () => {});
      } catch (_) {}
    }

    if (!this.binanceFuturesWs || this.binanceFuturesWs.readyState !== WebSocket.OPEN) {
      try {
        this.binanceFuturesWs = new WebSocket(binanceFuturesUrl);
        this.binanceFuturesWs.on('message', (data) => this.handleBinanceFutures(data, 'binance_futures'));
        this.binanceFuturesWs.on('close', () => this.handleClose('binance_futures'));
        this.binanceFuturesWs.on('error', () => {});
      } catch (_) {}
    }

    // Bybit: subscribe via JSON
    const bybitLinearUrl = 'wss://stream.bybit.com/v5/public/linear';
    if (!this.bybitFuturesWs || this.bybitFuturesWs.readyState !== WebSocket.OPEN) {
      try {
        this.bybitFuturesWs = new WebSocket(bybitLinearUrl);
        this.bybitFuturesWs.on('open', () => {
          const args = syms.map((s) => `tickers.${s}`);
          this.bybitFuturesWs?.send(JSON.stringify({ op: 'subscribe', args }));
        });
        this.bybitFuturesWs.on('message', (data) => this.handleBybitTicker(data, 'bybit_futures'));
        this.bybitFuturesWs.on('close', () => this.handleClose('bybit_futures'));
        this.bybitFuturesWs.on('error', () => {});
      } catch (_) {}
    }
  }

  private handleBinanceSpot(data: WebSocket.Data, source: string): void {
    try {
      const msg = JSON.parse(data.toString());
      const stream = msg.stream || '';
      const d = msg.data || msg;
      const sym = (d.s || stream.split('@')[0] || '').toUpperCase();
      const price = parseFloat(d.p || d.price || d.c || 0);
      if (sym && price > 0) {
        const update: PriceUpdate = { symbol: sym, price, timestamp: Date.now(), source: source as any };
        this.priceCache.set(sym, update);
        this.emit('price', update);
      }
    } catch (_) {}
  }

  private handleBinanceFutures(data: WebSocket.Data, source: string): void {
    try {
      const msg = JSON.parse(data.toString());
      const stream = msg.stream || '';
      const d = msg.data || msg;
      const sym = (d.s || stream.split('@')[0] || '').toUpperCase();
      const price = parseFloat(d.p || 0);
      if (sym && price > 0) {
        const update: PriceUpdate = { symbol: sym, price, timestamp: Date.now(), source: source as any };
        this.priceCache.set(sym, update);
        this.emit('price', update);
      }
    } catch (_) {}
  }

  private handleBybitTicker(data: WebSocket.Data, source: string): void {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.topic?.startsWith('tickers.')) {
        const sym = (msg.data?.symbol || msg.topic.replace('tickers.', '') || '').toUpperCase();
        const price = parseFloat(msg.data?.lastPrice || 0);
        if (sym && price > 0) {
          const update: PriceUpdate = { symbol: sym, price, timestamp: Date.now(), source: source as any };
          this.priceCache.set(sym, update);
          this.emit('price', update);
        }
      }
    } catch (_) {}
  }

  private handleClose(which: string): void {
    if (this.reconnectAttempts < this.maxReconnect) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), 5000);
    }
  }

  disconnect(): void {
    for (const ws of [this.binanceSpotWs, this.binanceFuturesWs, this.bybitSpotWs, this.bybitFuturesWs]) {
      if (ws) {
        ws.close();
      }
    }
    this.binanceSpotWs = null;
    this.binanceFuturesWs = null;
    this.bybitSpotWs = null;
    this.bybitFuturesWs = null;
    PriceStreamManager.instance = null;
  }
}

export const priceStreamManager = PriceStreamManager.getInstance();
