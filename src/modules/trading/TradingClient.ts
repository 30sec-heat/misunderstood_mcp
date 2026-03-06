import * as ccxt from 'ccxt';

export type ExchangeId = 'binance' | 'bybit';
export type MarketType = 'spot' | 'futures';

export interface TradingOptions {
  marketType?: MarketType;
  exchange?: ExchangeId;
}

export interface OrderOptions {
  marketType?: MarketType;
  exchange?: ExchangeId;
}

export interface BalanceResult {
  exchange: string;
  marketType: MarketType;
  balances: Record<string, { free: number; used: number; total: number }>;
  total?: Record<string, number>;
}

/**
 * Trading client using CCXT for Binance and Bybit (spot + futures).
 * - Binance futures: options.defaultType = 'future'
 * - Bybit perpetuals: options.defaultType = 'swap'
 */
export class TradingClient {
  private exchanges: Map<string, ccxt.Exchange> = new Map();
  private initialized = false;

  private getExchangeKey(exchange: ExchangeId, marketType: MarketType): string {
    return `${exchange}_${marketType}`;
  }

  private createExchange(exchangeId: ExchangeId, marketType: MarketType): ccxt.Exchange | null {
    const apiKey = exchangeId === 'binance'
      ? process.env.BINANCE_API_KEY
      : process.env.BYBIT_API_KEY;
    const secret = exchangeId === 'binance'
      ? process.env.BINANCE_SECRET_KEY
      : process.env.BYBIT_SECRET_KEY;

    if (!apiKey || !secret) {
      return null;
    }

    const commonConfig = {
      apiKey,
      secret,
      enableRateLimit: true,
      timeout: 30000,
    };

    if (exchangeId === 'binance') {
      return new ccxt.binance({
        ...commonConfig,
        options: marketType === 'futures' ? { defaultType: 'future' } : { defaultType: 'spot' },
      } as any) as ccxt.Exchange;
    }

    if (exchangeId === 'bybit') {
      return new ccxt.bybit({
        ...commonConfig,
        options: marketType === 'futures' ? { defaultType: 'swap' } : { defaultType: 'spot' },
      } as any) as ccxt.Exchange;
    }

    return null;
  }

  private getOrCreateExchange(exchange: ExchangeId, marketType: MarketType): ccxt.Exchange | null {
    const key = this.getExchangeKey(exchange, marketType);
    let ex = this.exchanges.get(key);
    if (!ex) {
      ex = this.createExchange(exchange, marketType);
      if (ex) {
        this.exchanges.set(key, ex);
      }
    }
    return ex ?? null;
  }

  private normalizeSymbol(symbol: string, marketType: MarketType): string {
    // Accept BTCUSDT, BTC/USDT, BTC-USDT
    const cleaned = symbol.replace(/-/g, '/').toUpperCase();
    if (cleaned.includes('/')) {
      return cleaned;
    }
    // BTCUSDT -> BTC/USDT, for futures add :USDT for perpetuals
    if (cleaned.endsWith('USDT')) {
      const base = cleaned.slice(0, -4);
      return marketType === 'futures' ? `${base}/USDT:USDT` : `${base}/USDT`;
    }
    return `${cleaned}/USDT`;
  }

  private getExchange(exchange: ExchangeId, marketType: MarketType): ccxt.Exchange {
    const ex = this.getOrCreateExchange(exchange, marketType);
    if (!ex) {
      const envVars = exchange === 'binance' ? 'BINANCE_API_KEY, BINANCE_SECRET_KEY' : 'BYBIT_API_KEY, BYBIT_SECRET_KEY';
      throw new Error(`Exchange ${exchange} ${marketType} not configured. Set ${envVars} in environment.`);
    }
    return ex;
  }

  async fetchBalance(exchange: ExchangeId, marketType: MarketType): Promise<BalanceResult> {
    const ex = this.getExchange(exchange, marketType);
    const balance = await ex.fetchBalance();
    const result: BalanceResult = {
      exchange,
      marketType,
      balances: {},
      total: balance.total as unknown as Record<string, number> | undefined,
    };

    if (balance.free && typeof balance.free === 'object') {
      const free = balance.free as unknown as Record<string, number>;
      const used = (balance.used as unknown as Record<string, number>) ?? {};
      const total = (balance.total as unknown as Record<string, number>) ?? {};
      for (const [currency, amount] of Object.entries(free)) {
        const usedVal = used[currency] ?? 0;
        const totalVal = total[currency] ?? amount + usedVal;
        if (amount > 0 || usedVal > 0 || totalVal > 0) {
          result.balances[currency] = { free: amount, used: usedVal, total: totalVal };
        }
      }
    }

    return result;
  }

  async fetchBalanceAll(exchange?: ExchangeId): Promise<BalanceResult[]> {
    const exchanges: ExchangeId[] = exchange ? [exchange] : ['binance', 'bybit'];
    const results: BalanceResult[] = [];

    for (const ex of exchanges) {
      for (const marketType of ['spot', 'futures'] as MarketType[]) {
        try {
          const exInst = this.getOrCreateExchange(ex, marketType);
          if (exInst) {
            const bal = await this.fetchBalance(ex, marketType);
            results.push(bal);
          }
        } catch (err) {
          // Skip if not configured or error
        }
      }
    }

    return results;
  }

  async createMarketOrder(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    options?: OrderOptions
  ): Promise<ccxt.Order> {
    const exchange = options?.exchange ?? 'binance';
    const marketType = options?.marketType ?? 'spot';
    const ex = this.getExchange(exchange, marketType);
    const normalizedSymbol = this.normalizeSymbol(symbol, marketType);
    return ex.createMarketOrder(normalizedSymbol, side, amount);
  }

  async createLimitOrder(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    price: number,
    options?: OrderOptions
  ): Promise<ccxt.Order> {
    const exchange = options?.exchange ?? 'binance';
    const marketType = options?.marketType ?? 'spot';
    const ex = this.getExchange(exchange, marketType);
    const normalizedSymbol = this.normalizeSymbol(symbol, marketType);
    return ex.createLimitOrder(normalizedSymbol, side, amount, price);
  }

  async getOpenOrders(
    symbol: string,
    options?: OrderOptions
  ): Promise<ccxt.Order[]> {
    const exchange = options?.exchange ?? 'binance';
    const marketType = options?.marketType ?? 'spot';
    const ex = this.getExchange(exchange, marketType);
    const normalizedSymbol = this.normalizeSymbol(symbol, marketType);
    return ex.fetchOpenOrders(normalizedSymbol);
  }

  async cancelOrder(
    orderId: string,
    symbol: string,
    options?: OrderOptions
  ): Promise<ccxt.Order> {
    const exchange = options?.exchange ?? 'binance';
    const marketType = options?.marketType ?? 'spot';
    const ex = this.getExchange(exchange, marketType);
    const normalizedSymbol = this.normalizeSymbol(symbol, marketType);
    return ex.cancelOrder(orderId, normalizedSymbol);
  }

  async getPositions(exchange: ExchangeId = 'binance'): Promise<any[]> {
    const ex = this.getExchange(exchange, 'futures');
    const positions = await ex.fetchPositions();
    return positions.filter((p: any) => {
      const contracts = p.contracts ?? p.contract;
      return contracts != null && Number(contracts) !== 0;
    });
  }

  async setLeverage(
    leverage: number,
    symbol: string,
    exchange: ExchangeId = 'binance'
  ): Promise<any> {
    const ex = this.getExchange(exchange, 'futures');
    const normalizedSymbol = this.normalizeSymbol(symbol, 'futures');
    return ex.setLeverage(leverage, normalizedSymbol);
  }

  getSupportedExchanges(): string[] {
    const supported: string[] = [];
    if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET_KEY) {
      supported.push('binance');
    }
    if (process.env.BYBIT_API_KEY && process.env.BYBIT_SECRET_KEY) {
      supported.push('bybit');
    }
    return supported;
  }

  close(): void {
    for (const ex of this.exchanges.values()) {
      try {
        if (typeof ex.close === 'function') {
          ex.close();
        }
      } catch {
        // ignore
      }
    }
    this.exchanges.clear();
    this.initialized = false;
  }
}
