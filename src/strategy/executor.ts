/**
 * Strategy Executor
 *
 * Polls/subscribes to price and condition. When condition is met,
 * calls trading module to place order. Supports dry-run mode (log only).
 */

import { PriceFetcher } from '../modules/quote/tools/PriceFetcher.js';
import type {
  ConditionalStrategy,
  Strategy,
  StrategyAction,
  Condition,
  PriceCondition,
  PercentChangeCondition,
} from './types.js';

export interface OrderParams {
  action: 'long' | 'short';
  symbol: string;
  exchange?: string;
  marketType?: 'spot' | 'perp' | 'futures';
  size?: number;
}

export type OrderExecutor = (params: OrderParams) => Promise<void>;

/** Default executor: log only (dry-run behavior) */
export const logOnlyExecutor: OrderExecutor = async (params) => {
  console.log(
    `[STRATEGY EXECUTOR] Would place order: ${params.action} ${params.symbol} on ${params.exchange || 'default'} (${params.marketType || 'spot'})`
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
}

export class ConditionalStrategyExecutor {
  private priceFetcher: PriceFetcher;
  private pollIntervalMs: number;
  private dryRun: boolean;
  private orderExecutor: OrderExecutor;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastPrices: Map<string, number> = new Map();
  private priceHistory: Map<string, number[]> = new Map();

  constructor(options: ExecutorOptions = {}) {
    this.priceFetcher = new PriceFetcher();
    this.pollIntervalMs = options.pollIntervalMs ?? 30_000;
    this.dryRun = options.dryRun ?? true;
    this.orderExecutor = options.orderExecutor ?? logOnlyExecutor;
  }

  /**
   * Start polling for conditional strategies. When condition is met, executes order.
   */
  start(strategies: ConditionalStrategy[]): void {
    if (this.intervalId) {
      console.warn('[STRATEGY EXECUTOR] Already running, ignoring start()');
      return;
    }

    const enabled = strategies.filter((s) => s.enabled);
    if (enabled.length === 0) {
      console.log('[STRATEGY EXECUTOR] No enabled strategies to run');
      return;
    }

    console.log(
      `[STRATEGY EXECUTOR] Starting with ${enabled.length} strategy(ies), dryRun=${this.dryRun}`
    );

    const check = () => this.checkConditions(enabled);
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

  /**
   * Check conditions for all strategies and execute when met.
   */
  private async checkConditions(strategies: ConditionalStrategy[]): Promise<void> {
    for (const strategy of strategies) {
      try {
        const met = await this.evaluateCondition(strategy.condition);
        if (met) {
          await this.executeAction(strategy.action, strategy.id);
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
   * Evaluate a condition against current market data.
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
      case 'gt':
        return price > val;
      case 'gte':
        return price >= val;
      case 'lt':
        return price < val;
      case 'lte':
        return price <= val;
      case 'eq':
        return Math.abs(price - val) < price * 0.001; // ~0.1% tolerance
      default:
        return false;
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
    if (history.length > maxLen) {
      history = history.slice(-maxLen);
    }
    this.priceHistory.set(historyKey, history);

    if (history.length < 2) return false;

    const oldPrice = history[0];
    const change = oldPrice !== 0 ? ((price - oldPrice) / oldPrice) * 100 : 0;

    const op = condition.operator;
    const val = condition.value;

    switch (op) {
      case 'gt':
        return change > val;
      case 'gte':
        return change >= val;
      case 'lt':
        return change < val;
      case 'lte':
        return change <= val;
      case 'eq':
        return Math.abs(change - val) < 0.01;
      default:
        return false;
    }
  }

  private async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const prices = await this.priceFetcher.fetchPrices(symbol);
      const valid = prices.filter(
        (p) => (p.spotPrice ?? p.perpPrice) != null
      );
      if (valid.length === 0) return null;

      const values = valid.map((p) => p.spotPrice ?? p.perpPrice!).filter(Boolean);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return avg;
    } catch {
      return null;
    }
  }

  private async executeAction(action: StrategyAction, strategyId: string): Promise<void> {
    const params: OrderParams = {
      action: action.action,
      symbol: action.symbol,
      exchange: action.exchange,
      marketType: action.marketType ?? 'spot',
      size: action.size,
    };

    if (this.dryRun) {
      console.log(
        `[STRATEGY EXECUTOR] [DRY-RUN] Condition met for strategy ${strategyId}. Would execute:`,
        params
      );
    }

    await this.orderExecutor(params);
  }

  /**
   * Execute a single strategy check once (for manual/testing).
   */
  async executeOnce(strategy: ConditionalStrategy): Promise<boolean> {
    const met = await this.evaluateCondition(strategy.condition);
    if (met) {
      await this.executeAction(strategy.action, strategy.id);
      return true;
    }
    return false;
  }
}

/**
 * Execute a conditional strategy: start polling and run until stopped.
 *
 * @param strategies - Conditional strategies to monitor
 * @param options - Executor options (dryRun, pollIntervalMs, etc.)
 * @returns Executor instance (call .stop() to halt)
 */
export function executeConditionalStrategy(
  strategies: ConditionalStrategy[],
  options: ExecutorOptions = {}
): ConditionalStrategyExecutor {
  const executor = new ConditionalStrategyExecutor(options);
  executor.start(strategies);
  return executor;
}
