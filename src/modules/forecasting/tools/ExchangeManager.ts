import * as ccxt from 'ccxt';

export class ExchangeManager {
  private exchanges: { [key: string]: ccxt.Exchange };
  private priorityExchanges = ['coinbase', 'mexc', 'bitget', 'kucoin', 'gate'];

  constructor() {
    this.exchanges = {
      'coinbase': new ccxt.coinbase(),
      'mexc': new ccxt.mexc(),
      'bitget': new ccxt.bitget(),
      'kucoin': new ccxt.kucoin(),
      'gate': new ccxt.gate(),
      'binance': new ccxt.binance(),
      'bybit': new ccxt.bybit(),
      'okx': new ccxt.okx(),
      'kraken': new ccxt.kraken()
    };
  }

  private mapSymbol(symbol: string, exchangeName: string): string {
    // Map common symbols to exchange-specific formats
    const baseSymbol = symbol.replace('USDT', '').replace('USD', '');
    
    switch (exchangeName) {
      case 'coinbase':
        return `${baseSymbol}-USD`;
      case 'kraken':
        return `${baseSymbol}USD`;
      case 'mexc':
      case 'bitget':
      case 'kucoin':
      case 'gate':
        return symbol; // These use standard USDT format
      case 'binance':
      case 'bybit':
      case 'okx':
        return symbol; // These use standard USDT format
      default:
        return symbol;
    }
  }

  /**
   * Get timeframe duration in milliseconds for pagination
   */
  private getTimeframeMs(timeframe: string): number {
    const match = timeframe.match(/^(\d+)(m|h|d|w)$/);
    if (!match) return 60 * 1000; // default 1m
    const num = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
    };
    return num * (multipliers[unit] || 60 * 1000);
  }

  /**
   * Fetch OHLCV with pagination for limits > 1000.
   * Most exchanges return max 1000 candles per request; this fetches in batches.
   */
  async fetchOHLCVPaginated(
    symbol: string,
    timeframe: string,
    limit: number,
    exchangeName?: string
  ): Promise<{ data: number[][]; exchange: string }> {
    const maxPerRequest = 1000;
    // Prefer Binance for OHLCV (1000 limit, reliable); fall back to others
    const ohlcvExchanges = ['binance', ...this.priorityExchanges.filter((e) => e !== 'binance')];
    const exchangesToTry = exchangeName
      ? [exchangeName.toLowerCase()]
      : ohlcvExchanges;

    for (const ex of exchangesToTry) {
      const exchange = this.exchanges[ex];
      if (!exchange) continue;

      try {
        const mappedSymbol = this.mapSymbol(symbol, ex);
        let allCandles: number[][] = [];
        let since: number | undefined;
        const timeframeMs = this.getTimeframeMs(timeframe);
        const maxIterations = Math.ceil(limit / Math.min(maxPerRequest, 100)) + 2;
        let iterations = 0;

        while (allCandles.length < limit && iterations < maxIterations) {
          iterations++;
          const batchLimit = Math.min(maxPerRequest, limit - allCandles.length);
          const batch = await exchange.fetchOHLCV(
            mappedSymbol,
            timeframe,
            since,
            batchLimit
          );

          if (!batch || batch.length === 0) break;

          // Merge: CCXT returns chronological (oldest first)
          const byTs = new Map<number, number[]>();
          for (const c of allCandles) byTs.set(c[0], c);
          for (const c of batch) byTs.set(c[0], c);
          allCandles = Array.from(byTs.values()).sort((a, b) => a[0] - b[0]);

          if (allCandles.length >= limit) break;

          // Next batch: fetch older data (before our oldest candle)
          const oldestInBatch = Math.min(...batch.map((c) => c[0]));
          since = oldestInBatch - timeframeMs;
        }

        if (allCandles.length > 0) {
          allCandles.sort((a, b) => a[0] - b[0]);
          const result = allCandles.slice(-limit);
          return { data: result, exchange: ex };
        }
      } catch (error) {
        console.warn(`Exchange ${ex} failed for ${symbol}:`, error instanceof Error ? error.message : String(error));
      }
    }
    return { data: [], exchange: '' };
  }

  async fetchOHLCV(
    symbol: string,
    timeframe: string,
    limit: number,
    exchangeName?: string
  ): Promise<any[]> {
    const safeLimit = Math.min(Math.max(limit || 100, 1), 5000);
    if (safeLimit <= 1000) {
      const exchangesToTry = exchangeName
        ? [exchangeName.toLowerCase()]
        : this.priorityExchanges;
      for (const ex of exchangesToTry) {
        try {
          const exchange = this.exchanges[ex];
          if (!exchange) continue;
          const mappedSymbol = this.mapSymbol(symbol, ex);
          const ohlcv = await exchange.fetchOHLCV(mappedSymbol, timeframe, undefined, safeLimit);
          if (ohlcv && ohlcv.length > 0) {
            console.log(`✓ Successfully fetched data from ${ex} for ${mappedSymbol}`);
            return ohlcv;
          }
        } catch (error) {
          console.warn(`Exchange ${ex} failed for ${symbol}:`, error instanceof Error ? error.message : String(error));
        }
      }
      return [];
    }
    const { data } = await this.fetchOHLCVPaginated(symbol, timeframe, safeLimit, exchangeName);
    return data;
  }

  destroy() {
    // Close exchange connections
    Object.values(this.exchanges).forEach(exchange => {
      if (exchange && typeof exchange.close === 'function') {
        try {
          exchange.close();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  }
}
