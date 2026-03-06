/**
 * Massive API client for options and stocks data.
 * Massive/Polygon API: https://massive.com/docs
 * Base URL: api.polygon.io (Polygon is the underlying provider for Massive)
 * Use MASSIVE_API_KEY from env.
 */

const BASE_URL = process.env.MASSIVE_API_BASE_URL || 'https://api.polygon.io';

function getApiKey(): string {
  const key = process.env.MASSIVE_API_KEY;
  if (!key) {
    throw new Error('MASSIVE_API_KEY is not set in environment');
  }
  return key;
}

async function fetchApi<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const apiKey = getApiKey();
  const cleaned: Record<string, string> = { apiKey };
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') cleaned[k] = String(v);
  }
  const qs = new URLSearchParams(cleaned);
  const url = `${BASE_URL}${path}?${qs.toString()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Massive API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getOptionsQuote(optionsTicker: string): Promise<unknown> {
  return fetchApi(`/v3/quotes/${encodeURIComponent(optionsTicker)}`, { limit: '1' });
}

export async function getOptionsLastTrade(optionsTicker: string): Promise<unknown> {
  return fetchApi(`/v2/last/trade/${encodeURIComponent(optionsTicker)}`);
}

export async function getOptionsSnapshot(underlying: string, contract: string): Promise<unknown> {
  return fetchApi(`/v3/snapshot/options/${encodeURIComponent(underlying)}/${encodeURIComponent(contract)}`);
}

export async function getOptionsContracts(params: {
  underlying?: string;
  expirationDate?: string;
  contractType?: string;
  limit?: number;
}): Promise<unknown> {
  const searchParams: Record<string, string | number> = {};
  if (params.underlying) searchParams.underlying_ticker = params.underlying;
  if (params.expirationDate) searchParams.expiration_date = params.expirationDate;
  if (params.contractType) searchParams.contract_type = params.contractType;
  if (params.limit) searchParams.limit = params.limit;
  return fetchApi('/v3/reference/options/contracts', searchParams);
}

export async function getStockAggs(
  ticker: string,
  from: string,
  to: string,
  timespan: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' = 'day',
  multiplier = 1
): Promise<unknown> {
  return fetchApi(
    `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/${multiplier}/${timespan}/${from}/${to}`,
    { limit: '5000' }
  );
}
