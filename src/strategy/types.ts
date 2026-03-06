/**
 * Strategy Automation Engine - Type Definitions
 *
 * Defines interfaces for different strategy types:
 * - ConditionalStrategy: "when X happens, do Y" (e.g., when BTC > 100k, go long)
 * - CorrelationStrategy: "when X correlates with Y, do Z"
 * - TimeBasedStrategy: "at time X, do Y"
 */

/** Size type for position sizing */
export type SizeType = 'fixed' | 'percent_portfolio' | 'risk_amount';

/** Stop loss / take profit types */
export type StopTpType = 'price' | 'percent' | 'trailing' | 'indicator';
export type StopTpTypeShort = 'price' | 'percent' | 'indicator';

/** Indicator reference for data-based stop/TP (e.g. RSI < 30 exit) */
export interface IndicatorRef {
  name: 'rsi' | 'ema' | 'sma';
  condition: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
  value: number;
  period?: number;
}

export interface StopLossConfig {
  type: 'price' | 'percent' | 'trailing' | 'indicator';
  value?: number; // price level, percent, or trailing percent
  indicatorRef?: IndicatorRef;
}

export interface TakeProfitConfig {
  type: 'price' | 'percent' | 'indicator';
  value?: number;
  indicatorRef?: IndicatorRef;
}

/** Strategy runtime status */
export type StrategyStatus = 'running' | 'paused' | 'stopped';

/** Base strategy metadata */
export interface BaseStrategy {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  enabled: boolean;
  /** Runtime status (default: stopped) */
  status?: StrategyStatus;
  /** Position sizing */
  sizeType?: SizeType;
  sizeValue?: number;
  /** Stop loss config */
  stopLoss?: StopLossConfig;
  /** Take profit config */
  takeProfit?: TakeProfitConfig;
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

/**
 * MessageTriggerStrategy: "when channel X posts message matching Y, do Z"
 * Monitors Telegram (and optionally Reddit) for new messages.
 */
export interface MessageTriggerStrategy extends BaseStrategy {
  strategyType: 'message_trigger';
  /** Source: telegram, reddit */
  source: 'telegram' | 'reddit';
  /** Channel/chat IDs to monitor (e.g. Telegram chat_id) */
  chatIds?: string[];
  /** Subreddits to monitor (when source=reddit) */
  subreddits?: string[];
  /** Keywords - message must contain any of these (case-insensitive) */
  keywords?: string[];
  /** Regex pattern to match message text */
  regex?: string;
  action: StrategyAction;
}

export type Strategy = ConditionalStrategy | CorrelationStrategy | TimeBasedStrategy | MessageTriggerStrategy;

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
