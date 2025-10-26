import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import { TelegramModule } from '../telegram/index.js';
import { TradFiNewsModule } from './tradfi.js';

interface CoinDeskArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
  category: string;
  tags: string[];
}

interface TelegramNewsResult {
  messages: Array<{
    id: number;
    chat_id: string;
    chat_title: string;
    username: string;
    message_text: string;
    timestamp: string;
  }>;
  total: number;
  query: string;
  timeRange: string;
}

export class NewsModule extends BaseCryptoModule {
  name = 'news';
  private telegramModule: TelegramModule | null = null;
  private tradFiModule: TradFiNewsModule | null = null;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    this.setupTools();
    
    // Don't create new instances - these will be set by the main server
    // Initialize TradFi module for RSS news
    this.tradFiModule = new TradFiNewsModule();
    await this.tradFiModule.initialize();
  }

  setTelegramModule(telegramModule: TelegramModule): void {
    this.telegramModule = telegramModule;
  }

  protected setupTools() {
    // Consolidated tool 1: Get latest news from all sources
    this.addTool({
      name: 'news_get_latest',
      description: 'Get latest news from all sources (RSS feeds, CoinDesk, TradFi) with filtering options',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of articles to return',
            default: 50
          },
          category: {
            type: 'string',
            description: 'News category filter',
            enum: ['markets', 'regulation', 'macro', 'crypto', 'institutional', 'defi', 'nft', 'technology', 'all'],
            default: 'all'
          },
          sources: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific sources to include (optional). Available: RSS feeds, CoinDesk, TradFi sources',
            default: []
          },
          timeRange: {
            type: 'string',
            description: 'Time range for articles',
            enum: ['1h', '6h', '24h', '7d', '30d'],
            default: '24h'
          }
        }
      },
      handler: this.getLatestNews.bind(this)
    });

    // Consolidated tool 2: Search across all sources
    this.addTool({
      name: 'news_search',
      description: 'Search for news across all sources (RSS feeds, Telegram, Reddit DB) by keywords with comprehensive filtering',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query or keywords'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results',
            default: 30
          },
          timeRange: {
            type: 'string',
            description: 'Time range for search',
            enum: ['1h', '6h', '24h', '7d', '30d', '90d'],
            default: '24h'
          },
          sources: {
            type: 'array',
            items: { 
              type: 'string',
              enum: ['rss', 'telegram', 'reddit', 'coindesk', 'tradfi', 'all']
            },
            description: 'Sources to search in',
            default: ['all']
          },
          category: {
            type: 'string',
            description: 'News category filter',
            enum: ['markets', 'regulation', 'macro', 'crypto', 'institutional', 'defi', 'nft', 'technology', 'all'],
            default: 'all'
          },
          symbol: {
            type: 'string',
            description: 'Specific symbol/ticker to focus on (optional)'
          }
        },
        required: ['query']
      },
      handler: this.searchNews.bind(this)
    });
  }

  private async fetchCoinDeskNews(query?: string, limit: number = 20): Promise<CoinDeskArticle[]> {
    try {
      // Ensure limit is within reasonable bounds
      const safeLimit = Math.min(Math.max(limit, 1), 100);
      
      // Use TradFi module to fetch CoinDesk RSS feed if available
      if (this.tradFiModule) {
        try {
          const result = await this.tradFiModule.getLatestNews({
            sources: ['CoinDesk'],
            limit: safeLimit,
            category: 'crypto',
            timeRange: '24h'
          });
          
          // Convert TradFi articles to CoinDesk format
          return result.articles.map(article => ({
            id: article.id,
            title: article.title,
            description: article.description || '',
            url: article.url,
            publishedAt: article.publishedAt,
            source: 'CoinDesk',
            category: 'crypto',
            tags: article.tags || []
          }));
        } catch (tradFiError) {
          console.warn('TradFi CoinDesk fetch error:', tradFiError);
        }
      }
      
      // Fallback: Direct RSS parsing if TradFi module fails
      const rssUrl = 'https://feeds.feedburner.com/CoinDesk';
      const response = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MCPCryptoBot/1.0)'
        }
      });
      
      if (!response.ok) {
        throw new Error(`RSS fetch failed: ${response.status}`);
      }
      
      const xmlText = await response.text();
      return this.parseRSSXML(xmlText, safeLimit, query);
      
    } catch (error) {
      console.error('CoinDesk RSS error:', error);
      return [];
    }
  }

  private parseRSSXML(xmlText: string, limit: number, query?: string): CoinDeskArticle[] {
    try {
      const articles: CoinDeskArticle[] = [];
      
      // Extract items from RSS feed
      const itemPattern = /<item[^>]*>([\s\S]*?)<\/item>/gi;
      let match;
      
      while ((match = itemPattern.exec(xmlText)) !== null && articles.length < limit) {
        const itemXml = match[1];
        
        const title = this.extractXMLValue(itemXml, 'title') || '';
        const description = this.extractXMLValue(itemXml, 'description') || '';
        const link = this.extractXMLValue(itemXml, 'link') || this.extractXMLValue(itemXml, 'guid') || '';
        const pubDate = this.extractXMLValue(itemXml, 'pubDate') || new Date().toISOString();
        
        if (title && link) {
          // Filter by query if provided
          if (!query || 
              title.toLowerCase().includes(query.toLowerCase()) || 
              description.toLowerCase().includes(query.toLowerCase())) {
            
            articles.push({
              id: `coindesk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              title: this.cleanText(title),
              description: this.cleanText(description),
              url: link,
              publishedAt: this.parseDate(pubDate),
              source: 'CoinDesk',
              category: 'crypto',
              tags: this.extractTags(title + ' ' + description)
            });
          }
        }
      }
      
      return articles;
    } catch (error) {
      console.error('RSS XML parsing error:', error);
      return [];
    }
  }

  private extractXMLValue(xml: string, tagName: string): string {
    const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = xml.match(pattern);
    return match ? match[1].trim() : '';
  }

  private cleanText(text: string): string {
    return text
      .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  private parseDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  private extractTags(text: string): string[] {
    const tags: string[] = [];
    const cryptoTerms = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'blockchain', 'defi', 'nft', 'web3', 'solana', 'sol'];
    
    for (const term of cryptoTerms) {
      if (text.toLowerCase().includes(term)) {
        tags.push(term);
      }
    }
    
    return [...new Set(tags)];
  }

  private getFallbackCoinDeskNews(query?: string, limit: number = 20): CoinDeskArticle[] {
    // Fallback to RSS feed if API fails
    try {
      const rssUrl = 'https://feeds.feedburner.com/CoinDesk';
      // This would need to be implemented with RSS parsing
      // For now, return empty array to avoid mock data
      return [];
    } catch (error) {
      console.error('Fallback CoinDesk RSS error:', error);
      return [];
    }
  }

  private async getLatestNews(args: any) {
    try {
      const { limit = 50, category = 'all', sources = [], timeRange = '24h' } = args;
      const safeLimit = Math.min(Math.max(limit, 1), 200);
      
      const allArticles: any[] = [];
      const sourcesUsed: string[] = [];
      
      // Get TradFi RSS articles if no specific sources or if RSS/TradFi is requested
      if (sources.length === 0 || sources.includes('rss') || sources.includes('tradfi') || sources.includes('all')) {
        if (this.tradFiModule) {
          try {
            const tradFiResult = await this.tradFiModule.getLatestNews({
              limit: Math.floor(safeLimit * 0.7), // 70% from TradFi sources
              category: category === 'all' ? 'all' : category,
              sources: []
            });
            allArticles.push(...tradFiResult.articles.map((article: any) => ({
              ...article,
              source_type: 'rss'
            })));
            sourcesUsed.push(...tradFiResult.sources);
          } catch (error) {
            console.warn('TradFi module error:', error);
          }
        }
      }

      // Get CoinDesk articles if no specific sources or if CoinDesk is requested
      if (sources.length === 0 || sources.includes('coindesk') || sources.includes('all')) {
        try {
          const coinDeskArticles = await this.fetchCoinDeskNews(category, Math.floor(safeLimit * 0.3));
          allArticles.push(...coinDeskArticles.map(article => ({
            ...article,
            source_type: 'coindesk'
          })));
          if (coinDeskArticles.length > 0) {
            sourcesUsed.push('CoinDesk');
          }
        } catch (error) {
          console.warn('CoinDesk fetch error:', error);
        }
      }

      // Filter by time range
      const timeRangeHours = this.parseTimeRange(timeRange);
      const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
      const timeFilteredArticles = allArticles.filter(article => 
        new Date(article.publishedAt) >= cutoffTime
      );

      // Sort by publication date (newest first)
      timeFilteredArticles.sort((a, b) => 
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      // Limit results
      const limitedArticles = timeFilteredArticles.slice(0, safeLimit);
      
      return {
        articles: limitedArticles,
        total: limitedArticles.length,
        category,
        sources: [...new Set(sourcesUsed)],
        timeRange,
        message: `Retrieved ${limitedArticles.length} latest news articles from ${sourcesUsed.length} sources`
      };
    } catch (error) {
      return {
        articles: [],
        total: 0,
        sources: [],
        error: `Failed to fetch latest news: ${error}`,
        message: 'Error retrieving latest news'
      };
    }
  }

  private async searchNews(args: any) {
    try {
      const { 
        query, 
        limit = 30, 
        timeRange = '24h', 
        sources = ['all'], 
        category = 'all',
        symbol 
      } = args;
      
      const safeLimit = Math.min(Math.max(limit, 1), 200);
      const searchQuery = symbol ? `${query} ${symbol}` : query;
      
      const allResults: any[] = [];
      const sourcesUsed: string[] = [];
      let telegramResults: any[] = [];
      let rssResults: any[] = [];
      let coinDeskResults: any[] = [];

      // Search RSS/TradFi sources
      if (sources.includes('all') || sources.includes('rss') || sources.includes('tradfi')) {
        if (this.tradFiModule) {
          try {
            const tradFiResult = await this.tradFiModule.searchNews({
              query: searchQuery,
              limit: Math.floor(safeLimit * 0.5),
              category: category === 'all' ? 'all' : category,
              timeRange
            });
            rssResults = tradFiResult.articles.map((article: any) => ({
              ...article,
              source_type: 'rss',
              result_type: 'article'
            }));
            allResults.push(...rssResults);
            sourcesUsed.push(...tradFiResult.sources);
          } catch (error) {
            console.warn('TradFi search error:', error);
          }
        }
      }

      // Search CoinDesk
      if (sources.includes('all') || sources.includes('coindesk')) {
        try {
          const coinDeskArticles = await this.fetchCoinDeskNews(searchQuery, Math.floor(safeLimit * 0.2));
          coinDeskResults = coinDeskArticles.map(article => ({
            ...article,
            source_type: 'coindesk',
            result_type: 'article'
          }));
          allResults.push(...coinDeskResults);
          if (coinDeskResults.length > 0) {
            sourcesUsed.push('CoinDesk');
          }
        } catch (error) {
          console.warn('CoinDesk search error:', error);
        }
      }

      // Search Telegram
      if (sources.includes('all') || sources.includes('telegram')) {
        if (this.telegramModule) {
          try {
            const telegramData = symbol 
              ? await this.telegramModule.searchTokenMentions({
                  tokenSymbol: symbol,
                  timeRange,
                  limit: Math.floor(safeLimit * 0.3)
                })
              : await this.telegramModule.searchMessages({
                  query: searchQuery,
                  timeRange,
                  limit: Math.floor(safeLimit * 0.3)
                });
            
            const messages = (telegramData as any).messages || (telegramData as any).mentions || [];
            telegramResults = messages.map((msg: any) => ({
              id: `telegram-${msg.id}`,
              title: `Telegram: ${msg.message_text?.substring(0, 100) || ''}...`,
              description: msg.message_text || '',
              url: `#telegram-${msg.chat_id}-${msg.id}`,
              publishedAt: msg.timestamp,
              source: `Telegram: ${msg.chat_title || 'Unknown'}`,
              category: 'telegram',
              tags: [symbol || query].filter(Boolean),
              source_type: 'telegram',
              result_type: 'message',
              chat_id: msg.chat_id,
              username: msg.username
            }));
            allResults.push(...telegramResults);
            if (telegramResults.length > 0) {
              sourcesUsed.push('Telegram');
            }
          } catch (error) {
            console.warn('Telegram search error:', error);
          }
        }
      }

      // TODO: Add Reddit search when Reddit module is available
      if (sources.includes('all') || sources.includes('reddit')) {
        // Placeholder for Reddit search
        // if (this.redditModule) { ... }
      }

      // Filter by time range
      const timeRangeHours = this.parseTimeRange(timeRange);
      const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
      const timeFilteredResults = allResults.filter(result => 
        new Date(result.publishedAt || result.timestamp || Date.now()) >= cutoffTime
      );

      // Sort by relevance and recency
      timeFilteredResults.sort((a, b) => {
        // Prioritize exact matches in title
        const aExactMatch = (a.title || '').toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
        const bExactMatch = (b.title || '').toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
        
        if (aExactMatch !== bExactMatch) {
          return bExactMatch - aExactMatch;
        }
        
        // Then sort by recency
        const aTime = new Date(a.publishedAt || a.timestamp || 0).getTime();
        const bTime = new Date(b.publishedAt || b.timestamp || 0).getTime();
        return bTime - aTime;
      });

      // Limit results
      const limitedResults = timeFilteredResults.slice(0, safeLimit);

      return {
        results: limitedResults,
        summary: {
          rss_articles: rssResults.length,
          coindesk_articles: coinDeskResults.length,
          telegram_messages: telegramResults.length,
          total: limitedResults.length
        },
        query: searchQuery,
        timeRange,
        sources: [...new Set(sourcesUsed)],
        category,
        symbol,
        message: `Found ${limitedResults.length} results across ${sourcesUsed.length} sources for "${searchQuery}"`
      };
    } catch (error) {
      return {
        results: [],
        summary: { rss_articles: 0, coindesk_articles: 0, telegram_messages: 0, total: 0 },
        query: args.query,
        timeRange: args.timeRange,
        sources: [],
        error: `Search failed: ${error}`,
        message: 'Error searching across sources'
      };
    }
  }


  // Parse time range string to hours
  private parseTimeRange(timeRange: string): number {
    const timeRangeMap: { [key: string]: number } = {
      '1h': 1,
      '6h': 6,
      '24h': 24,
      '7d': 24 * 7,
      '30d': 24 * 30,
      '90d': 24 * 90
    };
    
    return timeRangeMap[timeRange] || 24; // Default to 24 hours
  }

  async destroy(): Promise<void> {
    if (this.telegramModule) {
      await this.telegramModule.destroy();
    }
    if (this.tradFiModule) {
      await this.tradFiModule.destroy();
    }
  }
}
