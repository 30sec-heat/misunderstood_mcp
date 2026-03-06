/**
 * Strategy Automation Engine
 *
 * - Strategy types: ConditionalStrategy, CorrelationStrategy, TimeBasedStrategy
 * - NL Parser: parseNaturalLanguageStrategy(userInput) -> structured strategy
 * - Executor: ExecuteConditionalStrategy with polling and dry-run
 * - Storage: strategies.json
 */

export * from './types.js';
export {
  parseNaturalLanguageStrategy,
  parsedToConditionalStrategy,
} from './nl-parser.js';
export {
  ConditionalStrategyExecutor,
  executeConditionalStrategy,
  logOnlyExecutor,
  type OrderExecutor,
  type OrderParams,
  type ExecutorOptions,
} from './executor.js';
export {
  loadStrategies,
  saveStrategies,
  upsertStrategy,
  removeStrategy,
  getStrategy,
} from './storage.js';
