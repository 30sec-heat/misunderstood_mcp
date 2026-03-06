/**
 * Natural Language Strategy Parser
 *
 * Uses OpenAI API to extract structured strategy from natural language input.
 * Example: "I notice bitcoin goes up when xyz... it would be nice to take a long"
 * -> { action: 'long', symbol: 'BTC', condition: { type, params }, ... }
 */

import OpenAI from 'openai';
import type {
  ParsedStrategy,
  ConditionalStrategy,
  Condition,
  PriceCondition,
  PercentChangeCondition,
  ConditionOperator,
} from './types.js';

const SYSTEM_PROMPT = `You are a trading strategy extractor. Given natural language input about a trading idea, extract structured strategy data.

Extract:
1. action: "long" (buy, go long, bullish) or "short" (sell, go short, bearish)
2. symbol: Normalize to ticker (BTC, ETH, SOL, etc.). "bitcoin" -> "BTC", "ethereum" -> "ETH"
3. condition: The trigger/condition that would execute the trade
   - type "price": When price crosses a level (e.g., "when BTC > 100k" -> operator: "gt", value: 100000)
   - type "percent_change": When price moves X% (e.g., "when ETH drops 5%" -> operator: "lt", value: -5, params may include windowMinutes)
   - Operators: gt (>), gte (>=), lt (<), lte (<=), eq (=)
4. exchange: Only if user specifies an exchange
5. marketType: spot, perp, or futures - only if mentioned (leveraged/shorting implies perp)
6. timeframe: Only if user specifies a timeframe

If the condition is vague or unclear, infer the most likely interpretation. For "goes up" without a level, use a reasonable percent_change (e.g., >2% in 24h).
Always return valid JSON.`;

/**
 * Parses natural language input into a structured strategy using OpenAI.
 *
 * @param userInput - Natural language strategy description
 * @param apiKey - OpenAI API key (defaults to process.env.OPENAI_API_KEY)
 * @returns Parsed strategy or throws on error
 */
export async function parseNaturalLanguageStrategy(
  userInput: string,
  apiKey?: string
): Promise<ParsedStrategy> {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      'OPENAI_API_KEY is required for parseNaturalLanguageStrategy. Set it in env or pass as second argument.'
    );
  }

  const openai = new OpenAI({ apiKey: key });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Extract the trading strategy from this input. Return valid JSON only.\n\nInput: ${userInput}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned empty response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Failed to parse OpenAI response as JSON: ${content}`);
  }

  return validateAndNormalizeParsedStrategy(parsed);
}

/**
 * Convert ParsedStrategy to ConditionalStrategy for storage/execution.
 */
export function parsedToConditionalStrategy(
  parsed: ParsedStrategy,
  options?: { id?: string; name?: string }
): ConditionalStrategy {
  const now = new Date().toISOString();
  const id = options?.id ?? `strat-${Date.now()}`;
  const name = options?.name ?? `Strategy ${parsed.symbol} ${parsed.action}`;

  const condition = parsedConditionToCondition(parsed);
  const action = {
    action: parsed.action,
    symbol: parsed.symbol,
    exchange: parsed.exchange,
    marketType: parsed.marketType,
  };

  return {
    id,
    name,
    strategyType: 'conditional',
    condition,
    action,
    createdAt: now,
    updatedAt: now,
    enabled: true,
  };
}

function parsedConditionToCondition(parsed: ParsedStrategy): Condition {
  const params = parsed.condition.params;
  const op = (params.operator as string)?.toLowerCase() as ConditionOperator | undefined;
  const operator = ['gt', 'gte', 'lt', 'lte', 'eq'].includes(op ?? '') ? op! : 'gt';
  const value = typeof params.value === 'number' ? params.value : Number(params.value) || 0;

  if (parsed.condition.type === 'price') {
    return {
      type: 'price',
      operator,
      value,
      symbol: parsed.symbol,
    } as PriceCondition;
  }

  const windowMinutes =
    typeof params.windowMinutes === 'number'
      ? params.windowMinutes
      : parsed.timeframe === '1h'
        ? 60
        : parsed.timeframe === '4h'
          ? 240
          : parsed.timeframe === '1d'
            ? 1440
            : 60;

  return {
    type: 'percent_change',
    operator,
    value,
    symbol: parsed.symbol,
    windowMinutes,
  } as PercentChangeCondition;
}

function validateAndNormalizeParsedStrategy(raw: unknown): ParsedStrategy {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid parsed strategy: not an object');
  }

  const obj = raw as Record<string, unknown>;

  const action = obj.action;
  if (action !== 'long' && action !== 'short') {
    throw new Error(`Invalid action: ${action}. Must be 'long' or 'short'.`);
  }

  let symbol = String(obj.symbol || 'BTC').toUpperCase();
  // Normalize common names to tickers
  const symbolMap: Record<string, string> = {
    BITCOIN: 'BTC',
    ETHEREUM: 'ETH',
    SOLANA: 'SOL',
  };
  symbol = symbolMap[symbol] || symbol;

  const condition = obj.condition;
  if (!condition || typeof condition !== 'object') {
    throw new Error('Invalid condition: must be an object with type and params');
  }

  const cond = condition as Record<string, unknown>;
  const condType = cond.type;
  if (condType !== 'price' && condType !== 'percent_change') {
    throw new Error(`Invalid condition type: ${condType}. Use 'price' or 'percent_change'.`);
  }

  const params = cond.params;
  if (!params || typeof params !== 'object') {
    throw new Error('Invalid condition: params must be an object');
  }

  const result: ParsedStrategy = {
    action,
    symbol,
    condition: {
      type: condType,
      params: params as Record<string, unknown>,
      description: typeof cond.description === 'string' ? cond.description : undefined,
    },
  };

  if (typeof obj.exchange === 'string' && obj.exchange) {
    result.exchange = obj.exchange.toLowerCase();
  }

  const mt = obj.marketType;
  if (mt === 'spot' || mt === 'perp' || mt === 'futures') {
    result.marketType = mt;
  }

  if (typeof obj.timeframe === 'string' && obj.timeframe) {
    result.timeframe = obj.timeframe;
  }

  return result;
}
