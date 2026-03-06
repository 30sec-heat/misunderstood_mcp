/**
 * Polymarket Data API client for user positions
 * Base URL: https://data-api.polymarket.com
 * Endpoint: GET /positions
 */

import axios, { AxiosError } from 'axios';

const DATA_API_BASE_URL = 'https://data-api.polymarket.com';
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
      console.warn('[DataAPI] 404:', axErr.config?.url);
    } else {
      console.error('[DataAPI] Error:', axErr.message, axErr.response?.status);
    }
  } else {
    console.error('[DataAPI] Unexpected error:', error);
  }
  return fallback;
}

export interface UserPosition {
  conditionId?: string;
  market?: string;
  title?: string;
  outcome?: string;
  size?: number;
  avgPrice?: number;
  currentPrice?: number;
  cashPnl?: number;
  percentPnl?: number;
  redeemable?: boolean;
  mergeable?: boolean;
}

/**
 * Get current positions for a user by wallet address
 * @param user - User wallet address (0x-prefixed, 40 hex chars)
 * @param options - Optional filters
 */
export async function getUserPositions(
  user: string,
  options?: {
    market?: string;
    eventId?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: 'ASC' | 'DESC';
  }
): Promise<UserPosition[]> {
  await rateLimit();
  try {
    const params: Record<string, string | number> = {
      user,
    };
    if (options?.market) params.market = options.market;
    if (options?.eventId) params.eventId = options.eventId;
    if (options?.limit != null) params.limit = options.limit;
    if (options?.offset != null) params.offset = options.offset;
    if (options?.sortBy) params.sortBy = options.sortBy;
    if (options?.sortDirection) params.sortDirection = options.sortDirection;

    const response = await axios.get<UserPosition[]>(`${DATA_API_BASE_URL}/positions`, {
      params,
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    return handleError(error, []);
  }
}
