/**
 * Data proxy - fetches external data using server-side API keys from env.
 * NEVER accepts or stores trading/exchange API keys - those are client-side only.
 */

import axios from 'axios';

const POLYMARKET_GAMMA = process.env.POLYMARKET_API_BASE_URL || 'https://gamma-api.polymarket.com';
const PYTH_API = 'https://hermes.pyth.network/v2';
const CRYPTO_NEWS_API = 'https://cryptonews-api.com/api/v1';
const EARNINGSFEED_BASE = process.env.EARNINGSFEED_API_BASE_URL || 'https://earningsfeed.com';
const MASSIVE_BASE = process.env.MASSIVE_API_BASE_URL || 'https://api.polygon.io';

function toStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? '' : (v ?? '');
}

export async function dataProxy(moduleName: string, query: Record<string, string | string[] | undefined>): Promise<any> {
  const q: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) q[k] = toStr(v);
  switch (moduleName.toLowerCase()) {
    case 'polymarket':
      return fetchPolymarket(q);
    case 'news':
    case 'breaking_news':
      return fetchNews(q);
    case 'pyth':
    case 'econ_data':
      return fetchPyth(q);
    case 'earningsfeed':
      return fetchEarningsFeed(q);
    case 'massive':
      return fetchMassive(q);
    default:
      return {
        error: `Module "${moduleName}" not supported for data proxy`,
        supported: ['polymarket', 'news', 'breaking_news', 'pyth', 'econ_data', 'earningsfeed', 'massive'],
      };
  }
}

async function fetchPolymarket(query: Record<string, string>) {
  const { limit = '20', offset = '0', closed = 'false' } = query;
  const url = `${POLYMARKET_GAMMA}/markets?limit=${limit}&offset=${offset}&closed=${closed}`;
  const { data } = await axios.get(url, { timeout: 15000 });
  return { data, source: 'polymarket' };
}

async function fetchNews(query: Record<string, string>) {
  const key = process.env.CRYPTO_NEWS_API_KEY;
  if (!key) {
    return { error: 'CRYPTO_NEWS_API_KEY not set in backend env', supported: false };
  }
  const { tickers = 'BTC', items = '10' } = query;
  const url = `${CRYPTO_NEWS_API}/news?tickers=${tickers}&items=${items}&token=${key}`;
  const { data } = await axios.get(url, { timeout: 15000 });
  return { data, source: 'crypto_news' };
}

async function fetchPyth(query: Record<string, string>) {
  const { ids } = query;
  if (!ids) {
    return { error: 'ids required (comma-separated Pyth price feed IDs)' };
  }
  const url = `${PYTH_API}/updates/price/latest?ids=${encodeURIComponent(ids)}`;
  const { data } = await axios.get(url, { timeout: 15000 });
  return { data, source: 'pyth' };
}

async function fetchEarningsFeed(query: Record<string, string>) {
  const key = process.env.EARNINGSFEED_API_KEY;
  if (!key) {
    return { error: 'EARNINGSFEED_API_KEY not set in backend env', supported: false };
  }
  const { ticker, endpoint = 'company' } = query;
  if (!ticker) {
    return { error: 'ticker required' };
  }
  const url = `${EARNINGSFEED_BASE}/api/${endpoint}/${ticker}?token=${key}`;
  const { data } = await axios.get(url, { timeout: 15000 });
  return { data, source: 'earningsfeed' };
}

async function fetchMassive(query: Record<string, string>) {
  const key = process.env.MASSIVE_API_KEY;
  if (!key) {
    return { error: 'MASSIVE_API_KEY not set in backend env', supported: false };
  }
  const { ticker = 'AAPL', endpoint = 'snapshot' } = query;
  const url = `${MASSIVE_BASE}/v2/${endpoint}/stocks/${ticker}?apiKey=${key}`;
  const { data } = await axios.get(url, { timeout: 15000 });
  return { data, source: 'massive' };
}
