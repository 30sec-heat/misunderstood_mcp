/**
 * Research Module - Unified search across web and database sources.
 *
 * Provides:
 * - research_search: Web (Brave/Serper/DuckDuckGo) + Database (knowledge, telegram, reddit, polymarket, strategies)
 * - knowledge_search_all: Unified database search across all internal sources
 *
 * Env: BRAVE_SEARCH_API_KEY, SERPER_API_KEY for web search.
 */

import { BaseCryptoModule } from '../base/module.js';
import { SemanticKnowledgeEngine } from '../knowledge/semantic-knowledge-engine.js';
import { loadStrategies } from '../../strategy/storage.js';

export interface ResearchResult {
  source: string;
  title: string;
  snippet: string;
  url?: string;
  timestamp?: string;
}

export class ResearchModule extends BaseCryptoModule {
  name = 'research';

  private semanticEngine: SemanticKnowledgeEngine | null = null;

  constructor() {
    super();
    this.setupTools();
  }

  async initialize(): Promise<void> {
    // Reuse knowledge pool for semantic search (from KnowledgeModule)
    try {
      const pool = await this.postgresManager.getPool('knowledge');
      if (pool && process.env.OPENAI_API_KEY) {
        this.semanticEngine = new SemanticKnowledgeEngine(pool, process.env.OPENAI_API_KEY);
        await this.semanticEngine.initialize();
      }
    } catch {
      // Knowledge pool may not exist - module init order or no DB
    }

    await super.initialize();
  }

  protected setupTools(): void {
    this.addTool({
      name: 'research_search',
      description:
        'Search across web and/or database sources. Web: Brave/Serper/DuckDuckGo. Database: knowledge base (semantic), telegram, reddit, polymarket markets, saved strategies. Returns combined results with source attribution.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          sources: {
            type: 'string',
            enum: ['web', 'database', 'both'],
            description: 'Which sources to search',
            default: 'both'
          },
          limit: {
            type: 'number',
            description: 'Maximum results per source / total',
            default: 20
          }
        },
        required: ['query']
      },
      handler: this.researchSearch.bind(this)
    });

    this.addTool({
      name: 'knowledge_search_all',
      description:
        'Search across all internal sources: knowledge files (semantic), telegram (keyword), reddit (keyword), polymarket markets, saved strategies. Returns merged, deduplicated results.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          limit: {
            type: 'number',
            description: 'Maximum total results',
            default: 50
          }
        },
        required: ['query']
      },
      handler: this.knowledgeSearchAll.bind(this)
    });
  }

  private async researchSearch(args: {
    query: string;
    sources?: 'web' | 'database' | 'both';
    limit?: number;
  }): Promise<any> {
    const { query, sources = 'both', limit = 20 } = args;
    const results: ResearchResult[] = [];
    const sourceAttribution: string[] = [];

    const includeWeb = sources === 'web' || sources === 'both';
    const includeDb = sources === 'database' || sources === 'both';
    const perSourceLimit = Math.ceil(limit / (includeWeb && includeDb ? 6 : 3));

    if (includeWeb) {
      const webResults = await this.searchWeb(query, perSourceLimit);
      results.push(...webResults);
      if (webResults.length > 0) {
        sourceAttribution.push(webResults[0].source);
      }
    }

    if (includeDb) {
      const dbResults = await this.searchDatabase(query, perSourceLimit);
      results.push(...dbResults);
      const dbSources = [...new Set(dbResults.map((r) => r.source))];
      sourceAttribution.push(...dbSources);
    }

    // Deduplicate by title+url
    const seen = new Set<string>();
    const deduped = results.filter((r) => {
      const key = `${r.source}:${r.title}:${r.url || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      query,
      results: deduped.slice(0, limit),
      sources: [...new Set(sourceAttribution)],
      total: deduped.length
    };
  }

  private async knowledgeSearchAll(args: { query: string; limit?: number }): Promise<any> {
    const { query, limit = 50 } = args;
    const allResults: ResearchResult[] = [];

    const perSource = Math.ceil(limit / 5);

    // 1. Knowledge (semantic)
    if (this.semanticEngine) {
      try {
        const semantic = await this.semanticEngine.semanticSearch({
          query,
          limit: perSource,
          semantic_similarity_threshold: 0.5
        });
        for (const r of semantic) {
          allResults.push({
            source: 'knowledge',
            title: r.document.filename,
            snippet: (r.chunk?.content || r.document.content || '').substring(0, 300),
            url: r.document.filepath,
            timestamp: r.document.indexed_at?.toString()
          });
        }
      } catch {
        // Skip on error
      }
    }

    // 2. Telegram (keyword) - use pool if available
    try {
      const telegramPool = await this.postgresManager.getPool('telegram');
      const words = query.trim().split(/\s+/).filter((w) => w.length > 0);
      if (words.length > 0) {
        const conditions = words.map((_, i) => `text ~* $${i + 1}`).join(' AND ');
        const wordPatterns = words.map((w) => `\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        const res = await telegramPool.query(
          `SELECT id, chat_id, chat_title, text, date FROM telegram_messages 
           WHERE ${conditions} ORDER BY date DESC LIMIT $${words.length + 1}`,
          [...wordPatterns, perSource]
        );
        for (const row of res.rows || []) {
          allResults.push({
            source: 'telegram',
            title: `Telegram: ${row.chat_title || 'Chat'}`,
            snippet: (row.text || '').substring(0, 300),
            url: `#telegram-${row.chat_id}-${row.id}`,
            timestamp: row.date?.toString()
          });
        }
      }
    } catch {
      // Skip - pool may not exist
    }

    // 3. Reddit (keyword)
    try {
      const redditPool = await this.postgresManager.getPool('reddit');
      const searchPattern = `%${query}%`;
      const postsRes = await redditPool.query(
        `SELECT id, title, content, permalink, created_utc FROM reddit_posts 
         WHERE title ILIKE $1 OR content ILIKE $1 ORDER BY score DESC, created_utc DESC LIMIT $2`,
        [searchPattern, perSource]
      );
      for (const row of postsRes.rows || []) {
        allResults.push({
          source: 'reddit',
          title: row.title || 'Reddit post',
          snippet: (row.content || row.title || '').substring(0, 300),
          url: row.permalink ? `https://reddit.com${row.permalink}` : undefined,
          timestamp: row.created_utc ? new Date(row.created_utc * 1000).toISOString() : undefined
        });
      }
      const commentsRes = await redditPool.query(
        `SELECT c.id, c.content, c.permalink, c.created_utc FROM reddit_comments c
         JOIN reddit_posts p ON c.post_id = p.id WHERE c.content ILIKE $1 
         ORDER BY c.score DESC LIMIT $2`,
        [searchPattern, Math.floor(perSource / 2)]
      );
      for (const row of commentsRes.rows || []) {
        allResults.push({
          source: 'reddit',
          title: 'Reddit comment',
          snippet: (row.content || '').substring(0, 300),
          url: row.permalink ? `https://reddit.com${row.permalink}` : undefined,
          timestamp: row.created_utc ? new Date(row.created_utc * 1000).toISOString() : undefined
        });
      }
    } catch {
      // Skip
    }

    // 4. Polymarket markets
    try {
      const polymarketPool = await this.postgresManager.getPool('polymarket');
      const searchPattern = `%${query}%`;
      const res = await polymarketPool.query(
        `SELECT id, question, description, created_at FROM polymarket_markets 
         WHERE question ILIKE $1 OR description ILIKE $1 
         ORDER BY volume DESC NULLS LAST LIMIT $2`,
        [searchPattern, perSource]
      );
      for (const row of res.rows || []) {
        allResults.push({
          source: 'polymarket',
          title: row.question || 'Polymarket market',
          snippet: (row.description || row.question || '').substring(0, 300),
          url: `https://polymarket.com/event/${row.id}`,
          timestamp: row.created_at?.toString()
        });
      }
    } catch {
      // Skip
    }

    // 5. Saved strategies
    try {
      const strategies = loadStrategies();
      const qLower = query.toLowerCase();
      const matches = strategies.filter(
        (s) =>
          s.id?.toLowerCase().includes(qLower) ||
          (s as any).name?.toLowerCase().includes(qLower) ||
          JSON.stringify(s).toLowerCase().includes(qLower)
      );
      for (const s of matches.slice(0, perSource)) {
        allResults.push({
          source: 'strategies',
          title: (s as any).name || s.id || 'Strategy',
          snippet: JSON.stringify((s as any).condition || s).substring(0, 300),
          timestamp: (s as any).updatedAt?.toString()
        });
      }
    } catch {
      // Skip
    }

    // Deduplicate
    const seen = new Set<string>();
    const deduped = allResults.filter((r) => {
      const key = `${r.source}:${r.title}:${r.snippet.substring(0, 50)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      query,
      results: deduped.slice(0, limit),
      sources: [...new Set(deduped.map((r) => r.source))],
      total: deduped.length
    };
  }

  private async searchWeb(query: string, limit: number): Promise<ResearchResult[]> {
    const braveKey = process.env.BRAVE_SEARCH_API_KEY;
    if (braveKey) {
      try {
        return await this.searchBrave(query, limit, braveKey);
      } catch {
        // Fall through
      }
    }

    const serperKey = process.env.SERPER_API_KEY;
    if (serperKey) {
      try {
        return await this.searchSerper(query, limit, serperKey);
      } catch {
        // Fall through
      }
    }

    try {
      return await this.searchDuckDuckGo(query, limit);
    } catch {
      return [];
    }
  }

  private async searchBrave(query: string, limit: number, apiKey: string): Promise<ResearchResult[]> {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`,
      { headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey } }
    );
    if (!res.ok) throw new Error(`Brave API: ${res.status}`);
    const data = await res.json();
    const web = data.web?.results || [];
    return web.map((r: any) => ({
      source: 'brave_web',
      title: r.title || '',
      snippet: r.description || '',
      url: r.url || '',
      timestamp: r.age
    }));
  }

  private async searchSerper(query: string, limit: number, apiKey: string): Promise<ResearchResult[]> {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({ q: query, num: limit })
    });
    if (!res.ok) throw new Error(`Serper API: ${res.status}`);
    const data = await res.json();
    const organic = data.organic || [];
    return organic.map((r: any) => ({
      source: 'serper_web',
      title: r.title || '',
      snippet: r.snippet || '',
      url: r.link || '',
      timestamp: r.date
    }));
  }

  private async searchDuckDuckGo(query: string, limit: number): Promise<ResearchResult[]> {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Ysalis/1.0; +https://github.com)' } }
    );
    if (!res.ok) throw new Error(`DuckDuckGo: ${res.status}`);
    const html = await res.text();
    const results: ResearchResult[] = [];
    // Parse result blocks - DDG HTML structure: result__a (title link), result__snippet
    const resultMatches = html.split(/result results_links/);
    for (let i = 1; i < resultMatches.length && results.length < limit; i++) {
      const block = resultMatches[i];
      const linkMatch = block.match(/class="result__a"[^>]*href="([^"]*)"/);
      const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const url = linkMatch?.[1] || '';
      const title = (titleMatch?.[1] || '').replace(/<[^>]*>/g, '').trim();
      const snippet = (snippetMatch?.[1] || '').replace(/<[^>]*>/g, '').trim();
      if (title && url && !url.startsWith('https://duckduckgo.com')) {
        results.push({ source: 'duckduckgo_web', title, snippet, url });
      }
    }
    return results;
  }

  private async searchDatabase(query: string, perSource: number): Promise<ResearchResult[]> {
    return this.knowledgeSearchAll({ query, limit: perSource * 5 }).then((r) => r.results || []);
  }
}
