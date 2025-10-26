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

  async fetchOHLCV(symbol: string, timeframe: string, limit: number): Promise<any[]> {
    // Try exchanges in priority order with fallback
    for (const exchangeName of this.priorityExchanges) {
      try {
        const exchange = this.exchanges[exchangeName];
        const mappedSymbol = this.mapSymbol(symbol, exchangeName);
        const ohlcv = await exchange.fetchOHLCV(mappedSymbol, timeframe, undefined, limit);
        if (ohlcv && ohlcv.length > 0) {
          console.log(`✓ Successfully fetched data from ${exchangeName} for ${mappedSymbol}`);
          return ohlcv;
        }
      } catch (error) {
        // Continue to next exchange
        console.warn(`Exchange ${exchangeName} failed for ${symbol}:`, error instanceof Error ? error.message : String(error));
      }
    }
    return [];
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
