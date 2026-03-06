import axios, { AxiosInstance } from 'axios';
import { LiquidationPostgresDatabase, LiquidationRecord, OpenInterestRecord } from './postgres-database.js';

/** Coinalyze API interval values */
export const COINALYZE_INTERVALS = ['1min', '5min', '15min', '30min', '1hour', '2hour', '4hour', '6hour', '12hour', 'daily'] as const;
export type CoinalyzeInterval = typeof COINALYZE_INTERVALS[number];

/** Maps common exchange names to Coinalyze exchange codes (from /exchanges) */
const EXCHANGE_CODE_MAP: Record<string, string> = {
  binance: 'A',
  bybit: '0',
  okx: '1',
  dydx: '2',
  bitmex: '3',
  deribit: '4',
  bingx: '5',
  gate: '6',
  kucoin: '7',
  bitfinex: '8',
  kraken: '9',
  coinbase: '10',
};

export interface CoinalyzeExchange {
  name: string;
  code: string;
}

export interface CoinalyzeFutureMarket {
  symbol: string;
  exchange: string;
  symbol_on_exchange: string;
  base_asset: string;
  quote_asset: string;
  is_perpetual: boolean;
  margined: 'STABLE' | 'COIN';
  expire_at: number;
  oi_lq_vol_denominated_in: 'BASE_ASSET' | 'QUOTE_ASSET';
  has_long_short_ratio_data: boolean;
  has_ohlcv_data: boolean;
  has_buy_sell_data: boolean;
}

export interface CoinalyzeSpotMarket {
  symbol: string;
  exchange: string;
  symbol_on_exchange: string;
  base_asset: string;
  quote_asset: string;
  has_buy_sell_data: boolean;
}

/** API returns { t, l, s } for liquidations - l=longs volume, s=shorts volume */
export interface CoinalyzeLiquidationBar {
  t: number;
  l: number;
  s: number;
}

export interface CoinalyzeLiquidationData {
  symbol: string;
  history: CoinalyzeLiquidationBar[];
}

export interface CoinalyzeOpenInterestData {
  symbol: string;
  value: number;
  update: number;
}

/** API returns OHLC format { t, o, h, l, c } - we normalize to timestamp + open_interest (c) */
export interface CoinalyzeOICandlestick {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export interface CoinalyzeOIBar {
  timestamp: number;
  open_interest: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

export interface CoinalyzeOpenInterestHistory {
  symbol: string;
  history: CoinalyzeOIBar[];
}

/** API funding rate history format */
export interface CoinalyzeFundingBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export interface CoinalyzeFundingHistory {
  symbol: string;
  history: Array<{ timestamp: number; funding_rate: number; open?: number; high?: number; low?: number; close?: number }>;
}

export class CoinalyzeAPI {
  private api: AxiosInstance;
  private apiKey: string;
  private db: LiquidationPostgresDatabase;
  private baseUrl: string = 'https://api.coinalyze.net/v1';

  /** Rate limit: 40 requests per minute per API key */
  private readonly RATE_LIMIT_PER_MINUTE = 40;
  private requestCount = 0;
  private rateLimitResetAt = Date.now() + 60000;

  constructor(apiKey: string, db: LiquidationPostgresDatabase) {
    this.apiKey = apiKey;
    this.db = db;
    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for rate limit handling
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10) * 1000;
          console.warn(`[Coinalyze] Rate limited (429). Waiting ${retryAfter}ms...`);
          await this.delay(Math.min(retryAfter, 60000));
          return this.api.request(error.config);
        }
        throw error;
      }
    );
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    if (now >= this.rateLimitResetAt) {
      this.requestCount = 0;
      this.rateLimitResetAt = now + 60000;
    }
    if (this.requestCount >= this.RATE_LIMIT_PER_MINUTE) {
      const waitMs = this.rateLimitResetAt - now;
      if (waitMs > 0) {
        console.warn(`[Coinalyze] Rate limit approaching, waiting ${Math.ceil(waitMs / 1000)}s`);
        await this.delay(waitMs);
      }
      this.requestCount = 0;
      this.rateLimitResetAt = Date.now() + 60000;
    }
    this.requestCount++;
  }

  /** Resolve symbol+exchange to Coinalyze format (e.g. BTCUSDT + binance -> BTCUSDT_PERP.A) */
  async resolveCoinalyzeSymbol(symbol: string, exchange: string = 'binance'): Promise<string> {
    const normalizedSymbol = symbol.toUpperCase().replace(/\//g, '');
    const baseSymbol = normalizedSymbol.includes('USDT') ? normalizedSymbol : `${normalizedSymbol}USDT`;
    const perpSymbol = baseSymbol.includes('_PERP') ? baseSymbol : `${baseSymbol}_PERP`;
    const exchangeCode = EXCHANGE_CODE_MAP[exchange.toLowerCase()];
    return exchangeCode ? `${perpSymbol}.${exchangeCode}` : `${perpSymbol}.A`;
  }

  private getIntervalSeconds(interval: string): number {
    return this.getTimeframeSeconds(interval);
  }

  /** Map user timeframe (1h, 4h) to Coinalyze interval (1hour, 4hour) */
  static normalizeInterval(tf: string): string {
    const map: Record<string, string> = {
      '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min',
      '1h': '1hour', '2h': '2hour', '4h': '4hour', '6h': '6hour', '12h': '12hour',
      '1d': 'daily', '1w': 'daily'
    };
    return map[tf.toLowerCase()] || (tf.endsWith('min') || tf.endsWith('hour') || tf === 'daily' ? tf : '1hour');
  }

  async getSupportedExchanges(): Promise<CoinalyzeExchange[]> {
    await this.checkRateLimit();
    try {
      const response = await this.api.get('/exchanges', { params: { api_key: this.apiKey } });
      return response.data;
    } catch (error) {
      console.error('Error fetching supported exchanges:', error);
      throw error;
    }
  }

  async getFutureMarkets(): Promise<CoinalyzeFutureMarket[]> {
    await this.checkRateLimit();
    try {
      const response = await this.api.get('/future-markets', { params: { api_key: this.apiKey } });
      return response.data;
    } catch (error) {
      console.error('Error fetching future markets:', error);
      throw error;
    }
  }

  async getSpotMarkets(): Promise<CoinalyzeSpotMarket[]> {
    await this.checkRateLimit();
    try {
      const response = await this.api.get('/spot-markets', { params: { api_key: this.apiKey } });
      return response.data;
    } catch (error) {
      console.error('Error fetching spot markets:', error);
      throw error;
    }
  }

  async getCurrentOpenInterest(symbols: string[], convertToUsd: boolean = false): Promise<CoinalyzeOpenInterestData[]> {
    await this.checkRateLimit();
    try {
      const response = await this.api.get('/open-interest', {
        params: { api_key: this.apiKey, symbols: symbols.join(','), convert_to_usd: convertToUsd ? 'true' : 'false' }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching current open interest:', error);
      throw error;
    }
  }

  /** API returns OHLC { t, o, h, l, c } - we normalize to timestamp + open_interest */
  async getOpenInterestHistory(
    symbols: string[],
    interval: CoinalyzeInterval | string,
    from: number,
    to: number,
    convertToUsd: boolean = false
  ): Promise<CoinalyzeOpenInterestHistory[]> {
    await this.checkRateLimit();
    try {
      const response = await this.api.get('/open-interest-history', {
        params: { api_key: this.apiKey, symbols: symbols.join(','), interval, from, to, convert_to_usd: convertToUsd ? 'true' : 'false' }
      });
      const raw = response.data || [];
      return raw.map((item: { symbol: string; history?: Array<{ t: number; o: number; h: number; l: number; c: number }> }) => ({
        symbol: item.symbol,
        history: (item.history || []).map((b: { t: number; o: number; h: number; l: number; c: number }) => ({
          timestamp: b.t,
          open_interest: b.c,
          open: b.o,
          high: b.h,
          low: b.l,
          close: b.c
        }))
      }));
    } catch (error) {
      console.error('Error fetching open interest history:', error);
      throw error;
    }
  }

  /** Optional in-memory cache for OI history (5 min TTL) to reduce repeated API calls */
  private oiHistoryCache = new Map<string, { data: CoinalyzeOIBar[]; expires: number }>();
  private readonly OI_CACHE_TTL_MS = 5 * 60 * 1000;

  /** Fetch 1000+ OI bars with pagination. Coinalyze returns ~1500-2000 per request for intraday. */
  async getOpenInterestHistoryBulk(
    symbol: string,
    exchange: string,
    interval: CoinalyzeInterval | string,
    limit: number = 1000,
    convertToUsd: boolean = true
  ): Promise<CoinalyzeOIBar[]> {
    const cacheKey = `${symbol}:${exchange}:${interval}:${limit}`;
    const cached = this.oiHistoryCache.get(cacheKey);
    if (cached && Date.now() < cached.expires) return cached.data;
    const coinalyzeSymbol = await this.resolveCoinalyzeSymbol(symbol, exchange);
    const intervalSec = this.getIntervalSeconds(interval);
    const now = Math.floor(Date.now() / 1000);
    const totalSec = limit * intervalSec;
    let from = now - totalSec;
    const to = now;
    const allBars: CoinalyzeOIBar[] = [];
    const maxPerReq = 2000;

    while (allBars.length < limit) {
      const batchTo = Math.min(to, from + maxPerReq * intervalSec);
      const results = await this.getOpenInterestHistory([coinalyzeSymbol], interval, from, batchTo, convertToUsd);
      if (!results.length || !results[0].history?.length) break;
      for (const bar of results[0].history) {
        if (allBars.length >= limit) break;
        allBars.push(bar);
      }
      if (results[0].history.length < maxPerReq) break;
      from = results[0].history[results[0].history.length - 1].timestamp + intervalSec;
      if (from >= to) break;
      await this.delay(1600);
    }
    const result = allBars.slice(-limit).sort((a, b) => a.timestamp - b.timestamp);
    this.oiHistoryCache.set(cacheKey, { data: result, expires: Date.now() + this.OI_CACHE_TTL_MS });
    return result;
  }

  async getFundingRateHistory(
    symbols: string[],
    interval: CoinalyzeInterval | string,
    from: number,
    to: number
  ): Promise<CoinalyzeFundingHistory[]> {
    await this.checkRateLimit();
    try {
      const response = await this.api.get('/funding-rate-history', {
        params: { api_key: this.apiKey, symbols: symbols.join(','), interval, from, to }
      });
      const raw = response.data || [];
      return raw.map((item: { symbol: string; history?: Array<{ t: number; o: number; h: number; l: number; c: number }> }) => ({
        symbol: item.symbol,
        history: (item.history || []).map((b: { t: number; o: number; h: number; l: number; c: number }) => ({
          timestamp: b.t,
          funding_rate: b.c,
          open: b.o,
          high: b.h,
          low: b.l,
          close: b.c
        }))
      }));
    } catch (error) {
      console.error('Error fetching funding rate history:', error);
      throw error;
    }
  }

  async getLiquidationHistory(
    symbols: string[],
    interval: string,
    from: number,
    to: number,
    convertToUsd: boolean = false
  ): Promise<CoinalyzeLiquidationData[]> {
    await this.checkRateLimit();
    try {
      const response = await this.api.get('/liquidation-history', {
        params: { api_key: this.apiKey, symbols: symbols.join(','), interval, from, to, convert_to_usd: convertToUsd ? 'true' : 'false' }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching liquidation history:', error);
      throw error;
    }
  }

  /** Historic liquidations aggregated by symbol, exchange, time (long/short volumes). */
  async getLiquidationHistoryBulk(
    symbol: string,
    exchange: string,
    interval: CoinalyzeInterval | string,
    limit: number = 500,
    convertToUsd: boolean = true
  ): Promise<Array<{ timestamp: number; long_volume: number; short_volume: number; total_volume: number }>> {
    const coinalyzeSymbol = await this.resolveCoinalyzeSymbol(symbol, exchange);
    const intervalSec = this.getIntervalSeconds(interval);
    const now = Math.floor(Date.now() / 1000);
    const from = now - limit * intervalSec;
    const results = await this.getLiquidationHistory([coinalyzeSymbol], interval, from, now, convertToUsd);
    if (!results.length || !results[0].history?.length) return [];
    return results[0].history.map((bar: CoinalyzeLiquidationBar) => ({
      timestamp: bar.t,
      long_volume: bar.l,
      short_volume: bar.s,
      total_volume: bar.l + bar.s
    }));
  }

  async syncLiquidationData(symbols: string[], timeframe: string = '1hour'): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const from = this.getTimeframeSeconds(timeframe);
      const liquidationData = await this.getLiquidationHistory(symbols, timeframe, now - from, now, true);

      for (const data of liquidationData) {
        for (const point of data.history) {
          const ts = point.t;
          const iso = new Date(ts * 1000).toISOString();
          if (point.l > 0) {
            await this.db.addLiquidation({
              id: `coinalyze_${data.symbol}_${ts}_long`,
              symbol: data.symbol,
              exchange: 'coinalyze',
              side: 'long',
              quantity: point.l,
              price: 0,
              notional_value: point.l,
              timestamp: iso,
              source: 'coinalyze_api'
            });
          }
          if (point.s > 0) {
            await this.db.addLiquidation({
              id: `coinalyze_${data.symbol}_${ts}_short`,
              symbol: data.symbol,
              exchange: 'coinalyze',
              side: 'short',
              quantity: point.s,
              price: 0,
              notional_value: point.s,
              timestamp: iso,
              source: 'coinalyze_api'
            });
          }
        }
      }
      console.log(`Synced liquidation data for ${symbols.length} symbols from Coinalyze`);
    } catch (error) {
      console.error('Error syncing liquidation data:', error);
      throw error;
    }
  }

  async syncOpenInterestData(symbols: string[]): Promise<void> {
    try {
      const openInterestData = await this.getCurrentOpenInterest(symbols, true);
      
      for (const data of openInterestData) {
        const openInterest: Omit<OpenInterestRecord, 'id' | 'created_at'> = {
          symbol: data.symbol,
          exchange: 'coinalyze',
          value: data.value,
          timestamp: new Date(data.update * 1000).toISOString(),
          source: 'coinalyze_api'
        };

        await this.db.addOpenInterest(openInterest);
      }

      console.log(`Synced open interest data for ${symbols.length} symbols from Coinalyze`);
    } catch (error) {
      console.error('Error syncing open interest data:', error);
      throw error;
    }
  }

  async syncHistoricalOpenInterest(
    symbols: string[],
    timeframe: string = '1hour',
    days: number = 7
  ): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const from = now - (days * 24 * 60 * 60);
      
      const openInterestHistory = await this.getOpenInterestHistory(symbols, timeframe, from, now, true);
      
      for (const data of openInterestHistory) {
        for (const point of data.history) {
          const openInterest: Omit<OpenInterestRecord, 'id' | 'created_at'> = {
            symbol: data.symbol,
            exchange: 'coinalyze',
            value: point.open_interest,
            timestamp: new Date(point.timestamp * 1000).toISOString(),
            source: 'coinalyze_api'
          };
          await this.db.addOpenInterest(openInterest);
        }
      }

      console.log(`Synced historical open interest data for ${symbols.length} symbols from Coinalyze`);
    } catch (error) {
      console.error('Error syncing historical open interest data:', error);
      throw error;
    }
  }

  private getTimeframeSeconds(timeframe: string): number {
    switch (timeframe) {
      case '1min': return 60;
      case '5min': return 5 * 60;
      case '15min': return 15 * 60;
      case '30min': return 30 * 60;
      case '1hour': return 60 * 60;
      case '2hour': return 2 * 60 * 60;
      case '4hour': return 4 * 60 * 60;
      case '6hour': return 6 * 60 * 60;
      case '12hour': return 12 * 60 * 60;
      case 'daily': return 24 * 60 * 60;
      default: return 60 * 60; // Default to 1 hour
    }
  }

  async getPopularSymbols(limit: number = 20): Promise<string[]> {
    try {
      const futureMarkets = await this.getFutureMarkets();
      const spotMarkets = await this.getSpotMarkets();
      
      // Combine and deduplicate symbols
      const allSymbols = new Set<string>();
      
      futureMarkets.forEach(market => {
        allSymbols.add(market.symbol);
      });
      
      spotMarkets.forEach(market => {
        allSymbols.add(market.symbol);
      });
      
      return Array.from(allSymbols).slice(0, limit);
    } catch (error) {
      console.error('Error getting popular symbols:', error);
      // Return default popular symbols if API fails
      return [
        'BTCUSDT_PERP',
        'ETHUSDT_PERP',
        'ADAUSDT_PERP',
        'SOLUSDT_PERP',
        'DOTUSDT_PERP',
        'LINKUSDT_PERP',
        'LTCUSDT_PERP',
        'BCHUSDT_PERP',
        'XRPUSDT_PERP',
        'AVAXUSDT_PERP'
      ].slice(0, limit);
    }
  }
}
