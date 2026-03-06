/**
 * Data source for OHLCV chart data.
 * Uses ExchangeManager to fetch from Binance, Bybit, etc.
 */

import { ExchangeManager } from '../../forecasting/tools/ExchangeManager.js';

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FetchOHLCResult {
  exchange: string;
  data: OHLCVData[];
}

export class DataSourceManager {
  private exchangeManager: ExchangeManager;

  constructor() {
    this.exchangeManager = new ExchangeManager();
  }

  /**
   * Fetch OHLCV data for a symbol.
   * @param symbol - e.g. BTCUSDT, BTC/USDT, BTC
   * @param timeframe - e.g. 1m, 5m, 1h, 1d
   * @param limit - number of candles
   * @param _retries - unused, for API compatibility
   */
  async fetchOHLCData(
    symbol: string,
    timeframe: string,
    limit: number,
    _retries = 3
  ): Promise<FetchOHLCResult> {
    const normalized = this.normalizeSymbol(symbol);
    const ohlcv = await this.exchangeManager.fetchOHLCV(normalized, timeframe, limit);

    const data: OHLCVData[] = ohlcv.map((c: number[]) => ({
      timestamp: c[0],
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5] ?? 0,
    }));

    return {
      exchange: 'binance', // ExchangeManager uses first successful exchange
      data,
    };
  }

  private normalizeSymbol(symbol: string): string {
    const s = symbol.replace(/\//g, '').toUpperCase();
    if (s.endsWith('USDT')) return s;
    return `${s}USDT`;
  }

  destroy(): void {
    this.exchangeManager.destroy();
  }
}
