/**
 * Strategy Automation Engine - Type Definitions
 *
 * Defines interfaces for different strategy types:
 * - ConditionalStrategy: "when X happens, do Y" (e.g., when BTC > 100k, go long)
 * - CorrelationStrategy: "when X correlates with Y, do Z"
 * - TimeBasedStrategy: "at time X, do Y"
 */

/** Base strategy metadata */
export interface BaseStrategy {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  enabled: boolean;
}

/** Condition types for price/trigger evaluation */
export type ConditionOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

export interface PriceCondition {
  type: 'price';
  operator: ConditionOperator;
  value: number;
  /** Symbol to check (e.g., BTC, ETH) */
  symbol: string;
}

export interface PercentChangeCondition {
  type: 'percent_change';
  operator: ConditionOperator;
  value: number;
  symbol: string;
  /** Time window in minutes (e.g., 60 for 1h change) */
  windowMinutes?: number;
}

export type Condition = PriceCondition | PercentChangeCondition;

/** Action to execute when condition is met */
export interface StrategyAction {
  /** Direction: long (buy) or short (sell) */
  action: 'long' | 'short';
  /** Trading symbol */
  symbol: string;
  /** Optional: exchange to use (binance, bybit, etc.) */
  exchange?: string;
  /** Optional: spot or perp/futures */
  marketType?: 'spot' | 'perp' | 'futures';
  /** Optional: position size as fraction of portfolio (0-1) or fixed amount */
  size?: number;
}

/**
 * ConditionalStrategy: "when X happens, do Y"
 * Example: When BTC > 100000, go long
 */
export interface ConditionalStrategy extends BaseStrategy {
  strategyType: 'conditional';
  condition: Condition;
  action: StrategyAction;
}

/**
 * CorrelationStrategy: "when X correlates with Y, do Z"
 * Example: When BTC and ETH move together with >0.8 correlation, go long ETH
 */
export interface CorrelationStrategy extends BaseStrategy {
  strategyType: 'correlation';
  /** Primary symbol to trade */
  symbol: string;
  /** Symbol to correlate with */
  correlateWith: string;
  /** Minimum correlation threshold (0-1) */
  correlationThreshold: number;
  /** Window for correlation calculation (minutes) */
  windowMinutes?: number;
  action: StrategyAction;
}

/**
 * TimeBasedStrategy: "at time X, do Y"
 * Example: At 9:00 UTC daily, check RSI and go long if oversold
 */
export interface TimeBasedStrategy extends BaseStrategy {
  strategyType: 'time_based';
  /** Cron expression or time string (e.g., "0 9 * * *" for 9am daily) */
  schedule: string;
  /** Optional condition to check at scheduled time */
  condition?: Condition;
  action: StrategyAction;
}

export type Strategy = ConditionalStrategy | CorrelationStrategy | TimeBasedStrategy;

/**
 * Parsed output from parseNaturalLanguageStrategy
 */
export interface ParsedStrategy {
  action: 'long' | 'short';
  symbol: string;
  condition: {
    type: 'price' | 'percent_change';
    params: Record<string, unknown>;
    /** Human-readable condition description */
    description?: string;
  };
  exchange?: string;
  marketType?: 'spot' | 'perp' | 'futures';
  timeframe?: string;
}
