/**
 * Polymarket CLOB API client for price history
 * Base URL: https://clob.polymarket.com
 * Endpoint: GET /prices-history
 */

import axios, { AxiosError } from 'axios';

const CLOB_BASE_URL = 'https://clob.polymarket.com';
const RATE_LIMIT_MS = 100;
let lastCallTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastCallTime = Date.now();
}

function handleError<T>(error: unknown, fallback: T): T {
  if (axios.isAxiosError(error)) {
    const axErr = error as AxiosError;
    if (axErr.response?.status === 404) {
      console.warn('[CLOB] 404:', axErr.config?.url);
    } else {
      console.error('[CLOB] Error:', axErr.message, axErr.response?.status);
    }
  } else {
    console.error('[CLOB] Unexpected error:', error);
  }
  return fallback;
}

export interface PriceHistoryPoint {
  t: number;  // Unix timestamp
  p: number;  // Price
}

export interface PriceHistoryResponse {
  history?: PriceHistoryPoint[];
}

/**
 * Get price history for a market (condition ID)
 * @param market - Market condition ID / asset id (required)
 * @param interval - One of: max, all, 1m, 1h, 6h, 1d, 1w
 * @param startTs - Optional start unix timestamp
 * @param endTs - Optional end unix timestamp
 */
export async function getPriceHistory(
  market: string,
  interval: 'max' | 'all' | '1m' | '1h' | '6h' | '1d' | '1w' = '1d',
  startTs?: number,
  endTs?: number
): Promise<PriceHistoryPoint[]> {
  await rateLimit();
  try {
    const params: Record<string, string | number> = {
      market,
      interval,
    };
    if (startTs != null) params.startTs = startTs;
    if (endTs != null) params.endTs = endTs;

    const response = await axios.get<PriceHistoryResponse>(`${CLOB_BASE_URL}/prices-history`, {
      params,
    });
    const history = response.data?.history;
    return Array.isArray(history) ? history : [];
  } catch (error) {
    return handleError(error, []);
  }
}
