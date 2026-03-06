/**
 * Polymarket Gamma API client
 * Base URL: https://gamma-api.polymarket.com
 * Handles rate limiting (100ms between calls) and errors gracefully.
 */

import axios, { AxiosError } from 'axios';

const GAMMA_BASE_URL = 'https://gamma-api.polymarket.com';
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
      console.warn('[Gamma] 404:', axErr.config?.url);
    } else {
      console.error('[Gamma] Error:', axErr.message, axErr.response?.status);
    }
  } else {
    console.error('[Gamma] Unexpected error:', error);
  }
  return fallback;
}

export interface GammaEvent {
  id: string;
  title: string;
  description?: string;
  image?: string;
  slug?: string;
  endDate?: string;
  closed?: boolean;
  archived?: boolean;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  markets?: Array<{
    id: string;
    question: string;
    description?: string;
    image?: string;
    endDate?: string;
    closed?: boolean;
    archived?: boolean;
    outcomes?: string;
    outcomePrices?: string;
    volume?: string;
    liquidity?: string;
    active?: boolean;
  }>;
  tags?: Array<{ id: string; label: string; slug: string }>;
}

export interface GammaTag {
  id: string;
  label: string;
  slug: string;
}

export interface GammaComment {
  id: string;
  body: string;
  user_address?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get trending markets (sorted by volume or liquidity)
 */
export async function getTrendingMarkets(
  limit: number = 20,
  sortBy: 'volume' | 'liquidity' | 'created' = 'volume'
): Promise<GammaEvent[]> {
  await rateLimit();
  try {
    const order = sortBy === 'volume' ? 'volume' : sortBy === 'liquidity' ? 'liquidity' : 'start_date';
    const response = await axios.get<GammaEvent[]>(`${GAMMA_BASE_URL}/events`, {
      params: {
        closed: false,
        active: true,
        limit,
        order: order || 'volume',
        ascending: false,
      },
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    return handleError(error, []);
  }
}

/**
 * Get markets by category (tag slug)
 */
export async function getMarketsByCategory(
  category: string,
  limit: number = 20
): Promise<GammaEvent[]> {
  await rateLimit();
  try {
    // First get tag by slug for tag_id
    const tags = await getTags();
    const tag = tags.find(t => t.slug?.toLowerCase() === category.toLowerCase() || t.label?.toLowerCase() === category.toLowerCase());
    const tagId = tag?.id;

    const params: Record<string, unknown> = {
      closed: false,
      limit,
      order: 'volume',
      ascending: false,
    };
    if (tagId) params.tag_id = tagId;

    const response = await axios.get<GammaEvent[]>(`${GAMMA_BASE_URL}/events`, { params });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    return handleError(error, []);
  }
}

/**
 * Get markets ending soon (within N days)
 */
export async function getEndingSoon(
  limit: number = 20,
  withinDays: number = 7
): Promise<GammaEvent[]> {
  await rateLimit();
  try {
    const now = new Date();
    const endMin = now.toISOString();
    const endMax = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000).toISOString();

    const response = await axios.get<GammaEvent[]>(`${GAMMA_BASE_URL}/events`, {
      params: {
        closed: false,
        active: true,
        limit,
        order: 'end_date',
        ascending: true,
        end_date_min: endMin,
        end_date_max: endMax,
      },
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    return handleError(error, []);
  }
}

/**
 * Get market/event details by ID (event ID or market condition ID)
 */
export async function getMarketDetails(marketId: string): Promise<GammaEvent | Record<string, unknown> | null> {
  await rateLimit();
  try {
    // Try as event ID first
    const eventRes = await axios.get<GammaEvent>(`${GAMMA_BASE_URL}/events/${marketId}`);
    if (eventRes.data) return eventRes.data;
  } catch {
    // Not found as event, try as market
  }
  await rateLimit();
  try {
    const marketRes = await axios.get(`${GAMMA_BASE_URL}/markets/${marketId}`);
    return marketRes.data;
  } catch (error) {
    return handleError(error, null);
  }
}

/**
 * Get resolved events
 */
export async function getResolvedEvents(limit: number = 20): Promise<GammaEvent[]> {
  await rateLimit();
  try {
    const response = await axios.get<GammaEvent[]>(`${GAMMA_BASE_URL}/events`, {
      params: {
        closed: true,
        limit,
        order: 'end_date',
        ascending: false,
      },
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    return handleError(error, []);
  }
}

/**
 * Get upcoming resolutions (ending within N days, not yet closed)
 */
export async function getUpcomingResolutions(
  limit: number = 20,
  withinDays: number = 7
): Promise<GammaEvent[]> {
  return getEndingSoon(limit, withinDays);
}

/**
 * Get comments for event or market
 * parent_entity_type: "Event" or "market", parent_entity_id: event/market id
 */
export async function getMarketComments(
  eventId?: string,
  marketId?: string,
  limit: number = 20
): Promise<GammaComment[]> {
  await rateLimit();
  try {
    const entityType = eventId ? 'Event' : 'market';
    const entityId = eventId || marketId;
    if (!entityId) return [];

    const response = await axios.get<GammaComment[]>(`${GAMMA_BASE_URL}/comments`, {
      params: {
        parent_entity_type: entityType,
        parent_entity_id: entityId,
        limit,
        order: 'created_at',
        ascending: false,
      },
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    return handleError(error, []);
  }
}

/**
 * Get all tags for category mapping
 */
export async function getTags(): Promise<GammaTag[]> {
  await rateLimit();
  try {
    const response = await axios.get<GammaTag[]>(`${GAMMA_BASE_URL}/tags`);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    return handleError(error, []);
  }
}
