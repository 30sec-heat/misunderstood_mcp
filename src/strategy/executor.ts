/**
 * Strategy Executor
 *
 * Polls/subscribes to price and condition. When condition is met,
 * calls trading module to place order. Supports dry-run mode (log only).
 * Enhanced: per-strategy sizing, stop loss, take profit (price/percent/trailing/indicator).
 */

import { PriceFetcher } from '../modules/quote/tools/PriceFetcher.js';
import type {
  ConditionalStrategy,
  Condition,
  PriceCondition,
  PercentChangeCondition,
  IndicatorRef,
} from './types.js';
import { getStrategyRunner } from './strategy-runner.js';

export interface OrderParams {
  action: 'long' | 'short';
  symbol: string;
  exchange?: string;
  marketType?: 'spot' | 'perp' | 'futures';
  size?: number;
}

export type OrderExecutor = (params: OrderParams) => Promise<void>;

/** Balance fetcher for percent_portfolio sizing */
export interface BalanceFetcher {
  fetchUsdtBalance(exchange: string, marketType: string): Promise<number>;
}

/** Default executor: log only (dry-run behavior) */
export const logOnlyExecutor: OrderExecutor = async (params) => {
  console.log(
    `[STRATEGY EXECUTOR] Would place order: ${params.action} ${params.symbol} on ${params.exchange || 'default'} (${params.marketType || 'spot'}) size=${params.size}`
  );
};

export interface ExecutorOptions {
  /** Poll interval in ms (default: 30000 = 30s) */
  pollIntervalMs?: number;
  /** Dry-run: log instead of execute (default: true) */
  dryRun?: boolean;
  /** Custom order executor (default: logOnlyExecutor in dry-run) */
  orderExecutor?: OrderExecutor;
  /** strategies.json path (for loading) */
  strategiesPath?: string;
  /** Balance fetcher for percent_portfolio sizing */
  balanceFetcher?: BalanceFetcher;
}

/** Simple RSI from OHLCV close prices */
function calculateRSI(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export class ConditionalStrategyExecutor {
  private priceFetcher: PriceFetcher;
  private pollIntervalMs: number;
  private dryRun: boolean;
  private orderExecutor: OrderExecutor;
  private balanceFetcher: BalanceFetcher | null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastPrices: Map<string, number> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private ohlcvCache: Map<string, { data: number[][]; ts: number }> = new Map();
  private ohlcvCacheMs = 60_000; // 1 min cache

  constructor(options: ExecutorOptions = {}) {
    this.priceFetcher = new PriceFetcher();
    this.pollIntervalMs = options.pollIntervalMs ?? 30_000;
    this.dryRun = options.dryRun ?? true;
    this.orderExecutor = options.orderExecutor ?? logOnlyExecutor;
    this.balanceFetcher = options.balanceFetcher ?? null;
  }

  /**
   * Start polling for conditional strategies. When condition is met, executes order.
   * Also checks stop/TP for open positions.
   * @param strategiesOrProvider - Fixed list of strategies, or a function that returns current list (for dynamic strategies)
   */
  start(strategiesOrProvider: ConditionalStrategy[] | (() => ConditionalStrategy[])): void {
    if (this.intervalId) {
      console.warn('[STRATEGY EXECUTOR] Already running, ignoring start()');
      return;
    }

    const getStrategies =
      typeof strategiesOrProvider === 'function'
        ? strategiesOrProvider
        : () => strategiesOrProvider;

    const check = () => {
      const strategies = getStrategies().filter((s) => s.enabled);
      if (strategies.length > 0) {
        this.checkAll(strategies);
      }
    };

    const initial = getStrategies().filter((s) => s.enabled);
    console.log(
      `[STRATEGY EXECUTOR] Starting (${initial.length} strategy/ies active), dryRun=${this.dryRun}`
    );

    check(); // run immediately
    this.intervalId = setInterval(check, this.pollIntervalMs);
  }

  /**
   * Stop polling.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[STRATEGY EXECUTOR] Stopped');
    }
  }

  private async checkAll(strategies: ConditionalStrategy[]): Promise<void> {
    const runner = getStrategyRunner();
    for (const strategy of strategies) {
      try {
        const position = runner.getPosition(strategy.id);
        if (position) {
          await this.checkStopTakeProfit(strategy, position);
        } else {
          const met = await this.evaluateCondition(strategy.condition);
          if (met) {
            await this.executeAction(strategy);
          }
        }
      } catch (err) {
        console.error(
          `[STRATEGY EXECUTOR] Error checking strategy ${strategy.id}:`,
          err
        );
      }
    }
  }

  /**
   * Check stop loss / take profit for an open position.
   */
  private async checkStopTakeProfit(
    strategy: ConditionalStrategy,
    position: { strategyId: string; symbol: string; side: 'long' | 'short'; entryPrice: number; size: number; trailingHigh?: number; trailingLow?: number }
  ): Promise<void> {
    const price = await this.getCurrentPrice(position.symbol);
    if (price === null) return;

    const runner = getStrategyRunner();
    const exchange = strategy.action.exchange ?? 'binance';
    const marketType = strategy.action.marketType ?? 'spot';

    // Check stop loss
    const sl = strategy.stopLoss;
    if (sl) {
      let slHit = false;
      if (sl.type === 'price' && sl.value != null) {
        if (position.side === 'long' && price <= sl.value) slHit = true;
        if (position.side === 'short' && price >= sl.value) slHit = true;
      } else if (sl.type === 'percent' && sl.value != null) {
        const pct = (sl.value / 100) * position.entryPrice;
        if (position.side === 'long' && price <= position.entryPrice - pct) slHit = true;
        if (position.side === 'short' && price >= position.entryPrice + pct) slHit = true;
      } else if (sl.type === 'trailing' && sl.value != null) {
        const trailPct = sl.value / 100;
        if (position.side === 'long') {
          const high = Math.max(position.trailingHigh ?? price, price);
          runner.updateTrailingLevel(position.strategyId, high, undefined);
          const trailLevel = high * (1 - trailPct);
          if (price <= trailLevel) slHit = true;
        } else {
          const low = Math.min(position.trailingLow ?? price, price);
          runner.updateTrailingLevel(position.strategyId, undefined, low);
          const trailLevel = low * (1 + trailPct);
          if (price >= trailLevel) slHit = true;
        }
      } else if (sl.type === 'indicator' && sl.indicatorRef) {
        const hit = await this.evaluateIndicatorCondition(sl.indicatorRef, position.symbol);
        if (hit) slHit = true;
      }
      if (slHit) {
        await this.closePosition(strategy, position, price, 'stop_loss');
        return;
      }
    }

    // Check take profit
    const tp = strategy.takeProfit;
    if (tp) {
      let tpHit = false;
      if (tp.type === 'price' && tp.value != null) {
        if (position.side === 'long' && price >= tp.value) tpHit = true;
        if (position.side === 'short' && price <= tp.value) tpHit = true;
      } else if (tp.type === 'percent' && tp.value != null) {
        const pct = (tp.value / 100) * position.entryPrice;
        if (position.side === 'long' && price >= position.entryPrice + pct) tpHit = true;
        if (position.side === 'short' && price <= position.entryPrice - pct) tpHit = true;
      } else if (tp.type === 'indicator' && tp.indicatorRef) {
        const hit = await this.evaluateIndicatorCondition(tp.indicatorRef, position.symbol);
        if (hit) tpHit = true;
      }
      if (tpHit) {
        await this.closePosition(strategy, position, price, 'take_profit');
      }
    }
  }

  private async evaluateIndicatorCondition(
    ref: IndicatorRef,
    symbol: string
  ): Promise<boolean> {
    if (ref.name !== 'rsi') return false;
    const rsi = await this.fetchRSI(symbol, ref.period ?? 14);
    if (rsi === null) return false;
    const op = ref.condition;
    const val = ref.value;
    switch (op) {
      case 'lt': return rsi < val;
      case 'lte': return rsi <= val;
      case 'gt': return rsi > val;
      case 'gte': return rsi >= val;
      case 'eq': return Math.abs(rsi - val) < 0.5;
      default: return false;
    }
  }

  private async fetchRSI(symbol: string, period: number): Promise<number | null> {
    const key = `${symbol}-${period}`;
    const cached = this.ohlcvCache.get(key);
    if (cached && Date.now() - cached.ts < this.ohlcvCacheMs) {
      const closes = cached.data.map((r) => r[4]);
      return calculateRSI(closes, period);
    }
    try {
      const { ExchangeManager } = await import('../modules/forecasting/tools/ExchangeManager.js');
      const em = new ExchangeManager();
      const sym = symbol.includes('USDT') ? symbol : `${symbol}USDT`;
      const ohlcv = await em.fetchOHLCV(sym, '1h', period + 20);
      em.destroy?.();
      if (!ohlcv || !Array.isArray(ohlcv) || ohlcv.length < period + 5) return null;
      const data = ohlcv.map((c: number[]) => c);
      this.ohlcvCache.set(key, { data, ts: Date.now() });
      const closes = data.map((r: number[]) => r[4]);
      return calculateRSI(closes, period);
    } catch {
      return null;
    }
  }

  private async closePosition(
    strategy: ConditionalStrategy,
    position: { strategyId: string; symbol: string; side: 'long' | 'short'; size: number },
    exitPrice: number,
    reason: 'stop_loss' | 'take_profit' | 'indicator'
  ): Promise<void> {
    const runner = getStrategyRunner();
    const closeAction = position.side === 'long' ? 'short' : 'long';
    const params: OrderParams = {
      action: closeAction as 'long' | 'short',
      symbol: position.symbol,
      exchange: strategy.action.exchange as string | undefined,
      marketType: (strategy.action.marketType ?? 'spot') as 'spot' | 'perp' | 'futures',
      size: position.size,
    };
    if (this.dryRun) {
      console.log(`[STRATEGY EXECUTOR] [DRY-RUN] Would close position: ${reason} at ${exitPrice}`);
    } else {
      await this.orderExecutor(params);
    }
    runner.recordExit(strategy.id, exitPrice, reason);
  }

  /**
   * Check conditions for entry (no position).
   */
  private async evaluateCondition(condition: Condition): Promise<boolean> {
    if (condition.type === 'price') {
      return this.evaluatePriceCondition(condition);
    }
    if (condition.type === 'percent_change') {
      return this.evaluatePercentChangeCondition(condition);
    }
    return false;
  }

  private async evaluatePriceCondition(
    condition: PriceCondition
  ): Promise<boolean> {
    const price = await this.getCurrentPrice(condition.symbol);
    if (price === null) return false;
    this.lastPrices.set(condition.symbol, price);
    const op = condition.operator;
    const val = condition.value;
    switch (op) {
      case 'gt': return price > val;
      case 'gte': return price >= val;
      case 'lt': return price < val;
      case 'lte': return price <= val;
      case 'eq': return Math.abs(price - val) < price * 0.001;
      default: return false;
    }
  }

  private async evaluatePercentChangeCondition(
    condition: PercentChangeCondition
  ): Promise<boolean> {
    const symbol = condition.symbol;
    const price = await this.getCurrentPrice(symbol);
    if (price === null) return false;
    const window = condition.windowMinutes ?? 60;
    const historyKey = `${symbol}-${window}`;
    let history = this.priceHistory.get(historyKey) ?? [];
    history.push(price);
    const maxLen = Math.max(2, Math.ceil((window * 60 * 1000) / this.pollIntervalMs));
    if (history.length > maxLen) history = history.slice(-maxLen);
    this.priceHistory.set(historyKey, history);
    if (history.length < 2) return false;
    const oldPrice = history[0];
    const change = oldPrice !== 0 ? ((price - oldPrice) / oldPrice) * 100 : 0;
    const op = condition.operator;
    const val = condition.value;
    switch (op) {
      case 'gt': return change > val;
      case 'gte': return change >= val;
      case 'lt': return change < val;
      case 'lte': return change <= val;
      case 'eq': return Math.abs(change - val) < 0.01;
      default: return false;
    }
  }

  private async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const prices = await this.priceFetcher.fetchPrices(symbol);
      const valid = prices.filter((p) => (p.spotPrice ?? p.perpPrice) != null);
      if (valid.length === 0) return null;
      const values = valid.map((p) => p.spotPrice ?? p.perpPrice!).filter(Boolean);
      return values.reduce((a, b) => a + b, 0) / values.length;
    } catch {
      return null;
    }
  }

  /**
   * Compute order size from strategy sizeType/sizeValue.
   */
  private async computeSize(strategy: ConditionalStrategy): Promise<number> {
    const sizeType = strategy.sizeType ?? 'fixed';
    const sizeValue = strategy.sizeValue ?? strategy.action.size ?? 0.001;
    const symbol = strategy.action.symbol;

    if (sizeType === 'fixed') {
      return sizeValue;
    }

    if (sizeType === 'percent_portfolio' && this.balanceFetcher) {
      const exchange = (strategy.action.exchange ?? 'binance') as string;
      const marketType = (strategy.action.marketType ?? 'spot') as string;
      const balance = await this.balanceFetcher.fetchUsdtBalance(exchange, marketType);
      const price = await this.getCurrentPrice(symbol);
      if (!price || price <= 0) return sizeValue;
      const notional = balance * (sizeValue / 100);
      return notional / price;
    }

    if (sizeType === 'risk_amount' && this.balanceFetcher) {
      const stopPct = strategy.stopLoss?.type === 'percent' ? (strategy.stopLoss.value ?? 2) / 100 : 0.02;
      const riskPerUnit = await this.getCurrentPrice(symbol);
      if (!riskPerUnit || riskPerUnit <= 0) return sizeValue;
      const riskPerUnitAmount = riskPerUnit * stopPct;
      if (riskPerUnitAmount <= 0) return sizeValue;
      return sizeValue / riskPerUnitAmount;
    }

    return sizeValue;
  }

  private async executeAction(strategy: ConditionalStrategy): Promise<void> {
    const size = await this.computeSize(strategy);
    const action = strategy.action;
    const params: OrderParams = {
      action: action.action,
      symbol: action.symbol,
      exchange: action.exchange,
      marketType: action.marketType ?? 'spot',
      size,
    };

    if (this.dryRun) {
      console.log(
        `[STRATEGY EXECUTOR] [DRY-RUN] Condition met for strategy ${strategy.id}. Would execute:`,
        params
      );
      return;
    }

    const price = await this.getCurrentPrice(action.symbol);
    await this.orderExecutor(params);

    if (price != null) {
      const runner = getStrategyRunner();
      runner.recordEntry(strategy.id, {
        symbol: action.symbol,
        side: action.action,
        entryPrice: price,
        size,
        exchange: action.exchange,
        marketType: action.marketType,
      });
    }
  }

  /**
   * Execute a single strategy check once (for manual/testing).
   */
  async executeOnce(strategy: ConditionalStrategy): Promise<boolean> {
    const runner = getStrategyRunner();
    const position = runner.getPosition(strategy.id);
    if (position) {
      await this.checkStopTakeProfit(strategy, position);
      return false;
    }
    const met = await this.evaluateCondition(strategy.condition);
    if (met) {
      await this.executeAction(strategy);
      return true;
    }
    return false;
  }
}

/**
 * Execute a conditional strategy: start polling and run until stopped.
 * @param strategiesOrProvider - Fixed list or function returning current strategies (for dynamic)
 */
export function executeConditionalStrategy(
  strategiesOrProvider: ConditionalStrategy[] | (() => ConditionalStrategy[]),
  options: ExecutorOptions = {}
): ConditionalStrategyExecutor {
  const executor = new ConditionalStrategyExecutor(options);
  executor.start(strategiesOrProvider);
  return executor;
}
