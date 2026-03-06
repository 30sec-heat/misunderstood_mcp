/**
 * Social search module - search for coin/token mentions across social and news sources.
 *
 * Free tier: Uses News module (RSS, Telegram) when available. For Twitter-like results,
 * set BRAVE_SEARCH_API_KEY or SERPER_API_KEY. Twitter Premium API would give better
 * native Twitter results.
 *
 * Documentation: Free options use RSS feeds and Telegram; web search (Brave/Serper)
 * can find Twitter/X mentions. Nitter API is no longer viable (2024).
 */

import { BaseCryptoModule } from '../base/module.js';

interface SocialMention {
  title: string;
  snippet: string;
  url: string;
  source: string;
  publishedAt?: string;
}

interface CoinMentionsResult {
  mentions: SocialMention[];
  query: string;
  sources: string[];
  sentimentSummary?: string;
  note?: string;
  error?: string;
}

export class SocialModule extends BaseCryptoModule {
  name = 'social';
  private newsModule: any = null;

  constructor() {
    super();
    this.setupTools();
  }

  setNewsModule(module: any): void {
    this.newsModule = module;
  }

  protected setupTools() {
    this.addTool({
      name: 'social_search_coin_mentions',
      description:
        'Search for coin/token mentions on social and news sources. Free: uses News module (RSS, Telegram, Reddit). With BRAVE_SEARCH_API_KEY or SERPER_API_KEY: includes web search for Twitter/X and other sites. Note: Twitter Premium API gives better native Twitter results.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Coin symbol or name to search (e.g. "SOL", "Bonk", "JUP")',
          },
          limit: {
            type: 'number',
            description: 'Max results',
            default: 20,
          },
          timeRange: {
            type: 'string',
            enum: ['1h', '6h', '24h', '7d', '30d'],
            description: 'Time range for mentions',
            default: '24h',
          },
        },
        required: ['query'],
      },
      handler: async (args: { query: string; limit?: number; timeRange?: string }) =>
        this.searchCoinMentions(args),
    });
  }

  private async searchCoinMentions(args: {
    query: string;
    limit?: number;
    timeRange?: string;
  }): Promise<CoinMentionsResult> {
    const { query, limit = 20, timeRange = '24h' } = args;
    const mentions: SocialMention[] = [];
    const sources: string[] = [];
    const notes: string[] = [];

    // 1. Try Brave Search API if key is set
    const braveKey = process.env.BRAVE_SEARCH_API_KEY;
    if (braveKey) {
      try {
        const braveResults = await this.searchBrave(query, limit, braveKey);
        mentions.push(...braveResults);
        sources.push('brave_web');
      } catch (e) {
        notes.push(`Brave search: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 2. Try Serper API if key is set (and no Brave results yet)
    const serperKey = process.env.SERPER_API_KEY;
    if (serperKey && mentions.length === 0) {
      try {
        const serperResults = await this.searchSerper(query, limit, serperKey);
        mentions.push(...serperResults);
        sources.push('serper_web');
      } catch (e) {
        notes.push(`Serper search: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 3. Use News module for RSS/Telegram when available (free)
    if (this.newsModule?.executeTool) {
      try {
        const newsResult = await this.newsModule.executeTool('news_search', {
          query,
          limit: Math.min(limit, 30),
          timeRange,
          sources: ['all'],
        });
        const results = (newsResult as any)?.results || [];
        for (const r of results) {
          mentions.push({
            title: r.title || '',
            snippet: r.description || r.message_text || '',
            url: r.url || '#',
            source: r.source || r.source_type || 'news',
            publishedAt: r.publishedAt || r.timestamp,
          });
        }
        if (results.length > 0) {
          sources.push('news_rss_telegram');
        }
      } catch (e) {
        notes.push(`News search: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Sort by recency and dedupe by url
    const seen = new Set<string>();
    const unique = mentions.filter((m) => {
      const key = m.url || m.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    });

    const limited = unique.slice(0, limit);

    // Simple sentiment summary (keyword-based)
    const sentimentSummary = this.computeSentimentSummary(limited);

    let note = '';
    if (sources.length === 0) {
      note =
        'No API keys or News module. Set BRAVE_SEARCH_API_KEY or SERPER_API_KEY for web search, or ensure News module is loaded for RSS/Telegram. Twitter Premium API gives better Twitter-specific results.';
    } else if (!braveKey && !serperKey) {
      note = 'Using News module (RSS, Telegram) only. Set BRAVE_SEARCH_API_KEY or SERPER_API_KEY for Twitter/web search.';
    }
    if (notes.length > 0) {
      note += ' ' + notes.join(' ');
    }

    return {
      mentions: limited,
      query,
      sources: [...new Set(sources)],
      sentimentSummary,
      note: note.trim() || undefined,
    };
  }

  private async searchBrave(query: string, limit: number, apiKey: string): Promise<SocialMention[]> {
    const searchQuery = `${query} crypto OR ${query} token site:x.com OR site:twitter.com`;
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=${limit}`,
      {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': apiKey,
        },
      }
    );
    if (!res.ok) throw new Error(`Brave API: ${res.status}`);
    const data = await res.json();
    const web = data.web?.results || [];
    return web.map((r: any) => ({
      title: r.title || '',
      snippet: r.description || '',
      url: r.url || '',
      source: 'brave_web',
      publishedAt: r.age,
    }));
  }

  private async searchSerper(query: string, limit: number, apiKey: string): Promise<SocialMention[]> {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        q: `${query} crypto token`,
        num: limit,
      }),
    });
    if (!res.ok) throw new Error(`Serper API: ${res.status}`);
    const data = await res.json();
    const organic = data.organic || [];
    return organic.map((r: any) => ({
      title: r.title || '',
      snippet: r.snippet || '',
      url: r.link || '',
      source: 'serper_web',
      publishedAt: r.date,
    }));
  }

  private computeSentimentSummary(mentions: SocialMention[]): string {
    const positive = ['moon', 'pump', 'bullish', 'buy', 'gain', 'rally', 'surge', '🚀', '📈'];
    const negative = ['dump', 'bearish', 'sell', 'crash', 'drop', 'scam', 'rug', '📉'];
    let pos = 0,
      neg = 0;
    const text = mentions.map((m) => `${m.title} ${m.snippet}`).join(' ').toLowerCase();
    for (const w of positive) if (text.includes(w)) pos++;
    for (const w of negative) if (text.includes(w)) neg++;
    if (pos > neg) return 'Leaning positive';
    if (neg > pos) return 'Leaning negative';
    return 'Neutral';
  }
}
