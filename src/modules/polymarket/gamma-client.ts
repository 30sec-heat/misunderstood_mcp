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

export interface SearchMarketResult {
  id: string;
  question: string;
  eventTitle?: string;
  endDate?: string;
  volume?: string;
  odds?: Array<{ outcome: string; price: number; probability: number }>;
}

interface PublicSearchResponse {
  events?: GammaEvent[] | null;
  pagination?: { hasMore?: boolean; totalResults?: number };
}

/**
 * Search markets by query using Gamma API public-search.
 * Falls back to fetching trending events and filtering client-side if search fails.
 */
export async function searchMarkets(
  query: string,
  limit: number = 10,
  includeOdds: boolean = true
): Promise<SearchMarketResult[]> {
  await rateLimit();
  const q = query.trim();
  if (!q) return [];

  try {
    const response = await axios.get<PublicSearchResponse>(`${GAMMA_BASE_URL}/public-search`, {
      params: {
        q,
        limit_per_type: Math.min(limit * 3, 50),
        search_tags: false,
        search_profiles: false,
        events_status: 'open',
      },
    });

    const events = response.data?.events;
    if (!Array.isArray(events) || events.length === 0) {
      return searchMarketsFallback(q, limit, includeOdds);
    }

    const results: SearchMarketResult[] = [];
    for (const event of events) {
      const markets = event.markets || [];
      for (const m of markets) {
        if (results.length >= limit) break;
        if (m.closed || m.archived) continue;

        const market: SearchMarketResult = {
          id: m.id,
          question: m.question || event.title || 'Unknown',
          eventTitle: event.title,
          endDate: m.endDate || event.endDate,
          volume: m.volume,
        };
        if (includeOdds && m.outcomePrices && m.outcomes) {
          try {
            const prices = JSON.parse(m.outcomePrices) as string[];
            const outcomes = JSON.parse(m.outcomes) as string[];
            market.odds = outcomes.map((name, i) => ({
              outcome: name,
              price: parseFloat(prices[i] || '0'),
              probability: parseFloat(prices[i] || '0'),
            }));
          } catch {
            /* ignore parse errors */
          }
        }
        results.push(market);
      }
    }
    return results;
  } catch (error) {
    return searchMarketsFallback(q, limit, includeOdds);
  }
}

async function searchMarketsFallback(
  query: string,
  limit: number,
  includeOdds: boolean
): Promise<SearchMarketResult[]> {
  const events = await getTrendingMarkets(50, 'volume');
  const q = query.toLowerCase();
  const results: SearchMarketResult[] = [];

  for (const event of events) {
    if (results.length >= limit) break;
    const markets = event.markets || [];
    for (const m of markets) {
      if (results.length >= limit) break;
      if (m.closed || m.archived) continue;

      const matchText = `${event.title || ''} ${m.question || ''} ${m.description || ''} ${(event.tags || []).map((t: { label?: string }) => t.label).join(' ')}`.toLowerCase();
      if (!matchText.includes(q)) continue;

      const market: SearchMarketResult = {
        id: m.id,
        question: m.question || event.title || 'Unknown',
        eventTitle: event.title,
        endDate: m.endDate || event.endDate,
        volume: m.volume,
      };
      if (includeOdds && m.outcomePrices && m.outcomes) {
        try {
          const prices = JSON.parse(m.outcomePrices) as string[];
          const outcomes = JSON.parse(m.outcomes) as string[];
          market.odds = outcomes.map((name, i) => ({
            outcome: name,
            price: parseFloat(prices[i] || '0'),
            probability: parseFloat(prices[i] || '0'),
          }));
        } catch {
          /* ignore */
        }
      }
      results.push(market);
    }
  }
  return results;
}
