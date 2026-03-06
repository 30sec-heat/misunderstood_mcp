import { BaseCryptoModule } from '../base/module.js';

/**
 * Breaking News / Crypto News API module.
 * Uses Crypto News API (cryptonews-api.com) - ticker news, general news, sentiment filtering.
 * Uses CRYPTO_NEWS_API_KEY from env.
 * API: https://cryptonews-api.com/documentation
 */

const BASE_URL = 'https://cryptonews-api.com/api/v1';

function getApiKey(): string {
  const key = process.env.CRYPTO_NEWS_API_KEY;
  if (!key) {
    throw new Error('CRYPTO_NEWS_API_KEY is not set in environment');
  }
  return key;
}

async function fetchNewsApi(params: Record<string, string | number | undefined>): Promise<unknown> {
  const token = getApiKey();
  const cleaned: Record<string, string> = { token };
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') cleaned[k] = String(v);
  }
  const qs = new URLSearchParams(cleaned);
  const url = `${BASE_URL}?${qs.toString()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Crypto News API error ${res.status}: ${text}`);
  }
  return res.json();
}

export class BreakingNewsModule extends BaseCryptoModule {
  name = 'breaking_news';

  constructor() {
    super();
    this.setupTools();
  }

  protected setupTools() {
    this.addTool({
      name: 'news_breaking_crypto',
      description: 'Get breaking crypto news. Optionally filter by symbol/ticker and sentiment.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Crypto ticker (e.g., BTC, ETH). Omit for general crypto news.',
          },
          limit: {
            type: 'number',
            description: 'Max number of articles (1-100)',
            default: 20,
          },
          sentiment: {
            type: 'string',
            enum: ['positive', 'negative', 'neutral'],
            description: 'Filter by sentiment',
          },
        },
      },
      handler: this.getBreakingCrypto.bind(this),
    });

    this.addTool({
      name: 'news_search_crypto',
      description: 'Search crypto news by query/keywords via Crypto News API.',
      inputSchema: {
        type: 'object',
        properties: {
          searchQuery: {
            type: 'string',
            description: 'Search query or keywords',
          },
          limit: {
            type: 'number',
            description: 'Max results (1-100)',
            default: 20,
          },
        },
        required: ['searchQuery'],
      },
      handler: this.searchNews.bind(this),
    });
  }

  private async getBreakingCrypto(args: { symbol?: string; limit?: number; sentiment?: string }) {
    const items = Math.min(Math.max(args.limit ?? 20, 1), 100);
    return fetchNewsApi({
      tickers: args.symbol || undefined,
      items,
      sentiment: args.sentiment,
    });
  }

  private async searchNews(args: { searchQuery: string; limit?: number }) {
    const items = Math.min(Math.max(args.limit ?? 20, 1), 100);
    return fetchNewsApi({
      tickers: args.searchQuery,
      items,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }
}
