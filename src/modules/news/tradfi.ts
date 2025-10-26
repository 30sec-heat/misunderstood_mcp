import { BaseCryptoModule } from '../base/module.js';

interface TradFiRSSSource {
  name: string;
  url: string;
  category: 'markets' | 'regulation' | 'macro' | 'crypto' | 'institutional';
  enabled: boolean;
  description: string;
}

interface TradFiArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
  category: string;
  tags: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  relevanceScore?: number;
}

interface TradFiNewsResult {
  articles: TradFiArticle[];
  total: number;
  sources: string[];
  timeRange: string;
  query?: string;
  message?: string;
  error?: string;
}

// Free TradFi RSS sources - production-ready feeds
const TRADFI_RSS_SOURCES: TradFiRSSSource[] = [
  {
    name: 'CoinDesk',
    url: 'https://feeds.feedburner.com/CoinDesk',
    category: 'crypto',
    enabled: true,
    description: 'Cryptocurrency news and analysis'
  },
  {
    name: 'CoinTelegraph',
    url: 'https://cointelegraph.com/rss',
    category: 'crypto',
    enabled: true,
    description: 'Cryptocurrency and blockchain news'
  },
  {
    name: 'Bitcoin Magazine',
    url: 'https://bitcoinmagazine.com/rss',
    category: 'crypto',
    enabled: true,
    description: 'Bitcoin and cryptocurrency news'
  },
  {
    name: 'Decrypt',
    url: 'https://decrypt.co/feed',
    category: 'crypto',
    enabled: true,
    description: 'Cryptocurrency and DeFi news'
  },
  {
    name: 'The Block',
    url: 'https://www.theblock.co/rss.xml',
    category: 'crypto',
    enabled: true,
    description: 'Cryptocurrency and blockchain news'
  },
  {
    name: 'Yahoo Finance',
    url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=YHOO,AAPL,GOOGL,MSFT,AMZN&region=US&lang=en-US',
    category: 'markets',
    enabled: true,
    description: 'Financial headlines and market news'
  },
  {
    name: 'MarketWatch',
    url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
    category: 'markets',
    enabled: true,
    description: 'Market analysis and financial news'
  },
  {
    name: 'CNBC Markets',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',
    category: 'markets',
    enabled: true,
    description: 'CNBC financial markets news'
  },
  {
    name: 'CNBC Economy',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258',
    category: 'macro',
    enabled: true,
    description: 'Economic news and policy updates'
  },
  {
    name: 'Financial Times',
    url: 'https://www.ft.com/rss/home',
    category: 'markets',
    enabled: true,
    description: 'Financial Times global news'
  },
  {
    name: 'Seeking Alpha',
    url: 'https://seekingalpha.com/feed.xml',
    category: 'markets',
    enabled: true,
    description: 'Market analysis and commentary'
  },
  {
    name: 'Investing.com',
    url: 'https://www.investing.com/rss/news.rss',
    category: 'markets',
    enabled: true,
    description: 'Global financial news'
  },
  {
    name: 'BBC Business',
    url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    category: 'markets',
    enabled: true,
    description: 'BBC business news'
  },
  {
    name: 'Bloomberg Markets',
    url: 'https://feeds.bloomberg.com/markets/news.rss',
    category: 'markets',
    enabled: true, // Re-enabled - working as of 2025-10-18
    description: 'Bloomberg market news'
  },
  {
    name: 'Wall Street Journal',
    url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
    category: 'markets',
    enabled: true, // Re-enabled - working as of 2025-10-18
    description: 'WSJ market news'
  },
  {
    name: 'Reuters Business',
    url: 'https://feeds.reuters.com/reuters/businessNews',
    category: 'markets',
    enabled: false, // Temporarily disabled due to access issues
    description: 'Reuters business and market news'
  },
  {
    name: 'AP Business',
    url: 'https://apnews.com/apf-business.rss',
    category: 'markets',
    enabled: false, // Temporarily disabled due to access issues
    description: 'Associated Press business news'
  },
  {
    name: 'MarketWatch Top Stories',
    url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
    category: 'markets',
    enabled: true,
    description: 'MarketWatch top financial stories'
  },
  {
    name: 'InvestorPlace',
    url: 'https://investorplace.com/feed/',
    category: 'markets',
    enabled: true,
    description: 'Investment news and analysis'
  }
];

export class TradFiNewsModule extends BaseCryptoModule {
  name = 'tradfi-news';
  private rssSources: TradFiRSSSource[] = TRADFI_RSS_SOURCES;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    this.setupTools();
  }

  protected setupTools() {
    this.addTool({
      name: 'tradfi_get_news',
      description: 'Get latest TradFi news with comprehensive filtering and search capabilities',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query or symbol (e.g., "BTC", "inflation", "Fed"). Leave empty for latest news.'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of articles to return',
            default: 50
          },
          category: {
            type: 'string',
            description: 'News category filter',
            enum: ['markets', 'regulation', 'macro', 'crypto', 'institutional', 'all'],
            default: 'all'
          },
          sources: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific sources to include (optional)',
            default: []
          },
          timeRange: {
            type: 'string',
            description: 'Time range for search (only used when query is provided)',
            enum: ['1h', '6h', '24h', '7d', '30d', '90d'],
            default: '24h'
          },
          includeRelated: {
            type: 'boolean',
            description: 'Include related market news when searching by symbol',
            default: true
          }
        }
      },
      handler: this.getNews.bind(this)
    });

    this.addTool({
      name: 'tradfi_get_sources',
      description: 'Get list of available TradFi news sources and their status',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Filter by category',
            enum: ['markets', 'regulation', 'macro', 'crypto', 'institutional', 'all'],
            default: 'all'
          },
          enabledOnly: {
            type: 'boolean',
            description: 'Show only enabled sources',
            default: true
          }
        }
      },
      handler: this.getSources.bind(this)
    });
  }

  private async parseRSSFeed(feedUrl: string, sourceName: string): Promise<TradFiArticle[]> {
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetch(feedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0',
            'DNT': '1',
            'Sec-GPC': '1'
          },
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 403 || response.status === 429) {
            // Rate limited or forbidden - wait and retry
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
              continue;
            }
          }
          // Don't log 400 errors for known problematic feeds
          if (response.status !== 400 || !this.isKnownProblematicFeed(sourceName)) {
            console.warn(`RSS feed ${sourceName} returned ${response.status}: ${response.statusText}`);
          }
          return [];
        }

        const xmlText = await response.text();
        if (!xmlText || xmlText.trim().length === 0) {
          console.warn(`RSS feed ${sourceName} returned empty content`);
          return [];
        }

        return this.parseRSSXML(xmlText, sourceName);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // For network errors, retry with exponential backoff
        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    // All retries failed
    if (lastError) {
      const errorMessage = lastError.message;
      if (!errorMessage.includes('403') && !errorMessage.includes('Forbidden') && !errorMessage.includes('429')) {
        console.warn(`Failed to fetch RSS feed ${sourceName} after ${maxRetries + 1} attempts:`, errorMessage);
      }
    }
    
    return [];
  }

  private parseRSSXML(xmlText: string, sourceName: string): TradFiArticle[] {
    try {
      const items: TradFiArticle[] = [];
      
      // Try different RSS/Atom patterns
      const patterns = [
        /<item[^>]*>([\s\S]*?)<\/item>/gi,  // RSS 2.0
        /<entry[^>]*>([\s\S]*?)<\/entry>/gi, // Atom
        /<channel[^>]*>([\s\S]*?)<\/channel>/gi // RSS 1.0
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(xmlText)) !== null) {
          const itemXml = match[1];
          
          const title = this.extractXMLValue(itemXml, 'title') || 
                       this.extractXMLValue(itemXml, 'dc:title') || 
                       this.extractXMLValue(itemXml, 'atom:title') || '';
          const description = this.extractXMLValue(itemXml, 'description') || 
                             this.extractXMLValue(itemXml, 'summary') || 
                             this.extractXMLValue(itemXml, 'content:encoded') ||
                             this.extractXMLValue(itemXml, 'atom:summary') ||
                             this.extractXMLValue(itemXml, 'atom:content') || '';
          const link = this.extractXMLValue(itemXml, 'link') || 
                       this.extractXMLValue(itemXml, 'guid') || 
                       this.extractXMLValue(itemXml, 'atom:link') || '';
          const pubDate = this.extractXMLValue(itemXml, 'pubDate') || 
                         this.extractXMLValue(itemXml, 'dc:date') || 
                         this.extractXMLValue(itemXml, 'atom:published') ||
                         this.extractXMLValue(itemXml, 'atom:updated') ||
                         new Date().toISOString();

          if (title && link) {
            // Generate unique ID based on content to avoid duplicates
            const contentHash = this.simpleHash(title + link);
            const id = `${sourceName}-${contentHash}`;
            
            items.push({
              id,
              title: this.cleanHTML(title),
              description: this.cleanHTML(description),
              url: this.cleanHTML(link), // Clean the URL as well
              publishedAt: this.parseDate(pubDate),
              source: sourceName,
              category: this.getSourceCategory(sourceName),
              tags: this.extractTags(title + ' ' + description),
              sentiment: this.analyzeSentiment(title + ' ' + description)
            });
          }
        }
        
        // If we found items with this pattern, break
        if (items.length > 0) {
          break;
        }
      }

      return items;
    } catch (error) {
      console.error(`Error parsing RSS XML for ${sourceName}:`, error);
      return [];
    }
  }

  private parseDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private isKnownProblematicFeed(sourceName: string): boolean {
    // List of feeds that are known to have issues but we still want to try
    const problematicFeeds = ['Yahoo Finance', 'Bloomberg Markets', 'Wall Street Journal'];
    return problematicFeeds.includes(sourceName);
  }

  private extractXMLValue(xml: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }

  private cleanHTML(text: string): string {
    return text
      .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') // Remove CDATA wrappers
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&hellip;/g, '…')
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&lsquo;/g, "'")
      .replace(/&rsquo;/g, "'")
      .trim();
  }

  private getSourceCategory(sourceName: string): string {
    const source = this.rssSources.find(s => s.name === sourceName);
    return source?.category || 'markets';
  }

  private extractTags(text: string): string[] {
    const tags: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Common financial terms
    const financialTerms = [
      'bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'cryptocurrency',
      'stock', 'market', 'trading', 'investment', 'finance',
      'fed', 'federal reserve', 'interest rate', 'inflation',
      'regulation', 'sec', 'cfpb', 'policy', 'economy'
    ];

    financialTerms.forEach(term => {
      if (lowerText.includes(term)) {
        tags.push(term);
      }
    });

    return [...new Set(tags)]; // Remove duplicates
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const lowerText = text.toLowerCase();
    
    const positiveWords = [
      'bullish', 'surge', 'rally', 'gain', 'rise', 'increase', 'up', 'positive',
      'growth', 'profit', 'success', 'breakthrough', 'adoption', 'approval'
    ];
    
    const negativeWords = [
      'bearish', 'crash', 'fall', 'drop', 'decline', 'decrease', 'down', 'negative',
      'loss', 'failure', 'rejection', 'ban', 'regulation', 'risk', 'volatility'
    ];

    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  async getLatestNews(args: any): Promise<TradFiNewsResult> {
    try {
      const { limit = 50, category = 'all', sources = [] } = args;
      // Ensure limit is within reasonable bounds
      const safeLimit = Math.min(Math.max(limit, 1), 200);
      
      const enabledSources = this.rssSources.filter(source => 
        source.enabled && 
        (category === 'all' || source.category === category) &&
        (sources.length === 0 || sources.includes(source.name))
      );

      const allArticles: TradFiArticle[] = [];
      
      // Fetch from all enabled sources in parallel with timeout
      const fetchPromises = enabledSources.map(source => 
        Promise.race([
          this.parseRSSFeed(source.url, source.name),
          new Promise<TradFiArticle[]>((_, reject) => 
            setTimeout(() => reject(new Error('RSS fetch timeout')), 10000)
          )
        ]).catch(error => {
          console.warn(`Failed to fetch RSS from ${source.name}:`, error.message);
          return [];
        })
      );
      
      const results = await Promise.all(fetchPromises);
      
      results.forEach(articles => {
        allArticles.push(...articles);
      });

      // Sort by publication date (newest first)
      allArticles.sort((a, b) => 
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      // Limit results
      const limitedArticles = allArticles.slice(0, safeLimit);

      return {
        articles: limitedArticles,
        total: limitedArticles.length,
        sources: enabledSources.map(s => s.name),
        timeRange: 'latest',
        message: `Retrieved ${limitedArticles.length} latest TradFi news articles from ${enabledSources.length} sources`
      };
    } catch (error) {
      return {
        articles: [],
        total: 0,
        sources: [],
        timeRange: 'latest',
        error: `Failed to fetch latest TradFi news: ${error}`,
        message: 'Error retrieving latest TradFi news'
      };
    }
  }

  async searchNews(args: any): Promise<TradFiNewsResult> {
    try {
      const { query, limit = 30, category = 'all', timeRange = '24h' } = args;
      // Ensure limit is within reasonable bounds
      const safeLimit = Math.min(Math.max(limit, 1), 100);
      
      // Get latest news first
      const latestResult = await this.getLatestNews({ 
        limit: safeLimit * 2, // Get more to filter
        category,
        sources: []
      });

      // Filter by query
      const queryLower = query.toLowerCase();
      const filteredArticles = latestResult.articles.filter(article => 
        article.title.toLowerCase().includes(queryLower) ||
        article.description.toLowerCase().includes(queryLower) ||
        article.tags.some(tag => tag.toLowerCase().includes(queryLower))
      );

      // Filter by time range
      const timeRangeHours = this.parseTimeRange(timeRange);
      const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
      const timeFilteredArticles = filteredArticles.filter(article => 
        new Date(article.publishedAt) >= cutoffTime
      );

      // Limit results
      const limitedArticles = timeFilteredArticles.slice(0, safeLimit);

      return {
        articles: limitedArticles,
        total: limitedArticles.length,
        sources: latestResult.sources,
        timeRange: timeRange,
        query,
        message: `Found ${limitedArticles.length} TradFi articles matching "${query}"`
      };
    } catch (error) {
      return {
        articles: [],
        total: 0,
        sources: [],
        timeRange: args.timeRange,
        query: args.query,
        error: `Search failed: ${error}`,
        message: 'Error searching TradFi news'
      };
    }
  }

  async getNewsBySymbol(args: any): Promise<TradFiNewsResult> {
    try {
      const { symbol, limit = 20, includeRelated = true } = args;
      // Ensure limit is within reasonable bounds
      const safeLimit = Math.min(Math.max(limit, 1), 100);
      
      // Search for the symbol
      const symbolResult = await this.searchNews({
        query: symbol,
        limit: safeLimit,
        category: 'all',
        timeRange: '24h'
      });

      let relatedArticles: TradFiArticle[] = [];
      
      if (includeRelated) {
        // Get related market news
        const relatedTerms = this.getRelatedTerms(symbol);
        for (const term of relatedTerms) {
          const termResult = await this.searchNews({
            query: term,
            limit: Math.floor(safeLimit / 3),
            category: 'all',
            timeRange: '24h'
          });
          relatedArticles.push(...termResult.articles);
        }
      }

      // Combine and deduplicate
      const allArticles = [...symbolResult.articles, ...relatedArticles];
      const uniqueArticles = allArticles.filter((article, index, self) => 
        index === self.findIndex(a => a.id === article.id)
      );

      // Sort by relevance score (symbol mentions first)
      uniqueArticles.sort((a, b) => {
        const aScore = this.calculateRelevanceScore(a, symbol);
        const bScore = this.calculateRelevanceScore(b, symbol);
        return bScore - aScore;
      });

      const limitedArticles = uniqueArticles.slice(0, safeLimit);

      return {
        articles: limitedArticles,
        total: limitedArticles.length,
        sources: symbolResult.sources,
        timeRange: '24h',
        query: symbol,
        message: `Found ${limitedArticles.length} TradFi articles for ${symbol}`
      };
    } catch (error) {
      return {
        articles: [],
        total: 0,
        sources: [],
        timeRange: '24h',
        query: args.symbol,
        error: `Failed to get news for symbol: ${error}`,
        message: 'Error retrieving news for symbol'
      };
    }
  }

  async getMacroEvents(args: any): Promise<TradFiNewsResult> {
    try {
      const { limit = 20, includeCentralBank = true, includeRegulation = true } = args;
      // Ensure limit is within reasonable bounds
      const safeLimit = Math.min(Math.max(limit, 1), 100);
      
      const macroQueries = [];
      
      if (includeCentralBank) {
        macroQueries.push('federal reserve', 'fed', 'interest rate', 'monetary policy');
      }
      
      if (includeRegulation) {
        macroQueries.push('regulation', 'sec', 'cfpb', 'policy', 'compliance');
      }
      
      macroQueries.push('inflation', 'gdp', 'economy', 'macro');

      const allArticles: TradFiArticle[] = [];
      
      for (const query of macroQueries) {
        const result = await this.searchNews({
          query,
          limit: Math.floor(safeLimit / macroQueries.length),
          category: 'macro',
          timeRange: '24h'
        });
        allArticles.push(...result.articles);
      }

      // Deduplicate and sort
      const uniqueArticles = allArticles.filter((article, index, self) => 
        index === self.findIndex(a => a.id === article.id)
      );

      uniqueArticles.sort((a, b) => 
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      const limitedArticles = uniqueArticles.slice(0, safeLimit);

      return {
        articles: limitedArticles,
        total: limitedArticles.length,
        sources: [...new Set(limitedArticles.map(a => a.source))],
        timeRange: '24h',
        message: `Retrieved ${limitedArticles.length} macroeconomic news articles`
      };
    } catch (error) {
      return {
        articles: [],
        total: 0,
        sources: [],
        timeRange: '24h',
        error: `Failed to get macro events: ${error}`,
        message: 'Error retrieving macroeconomic news'
      };
    }
  }

  async getSources(args: any): Promise<any> {
    try {
      const { category = 'all', enabledOnly = true } = args;
      
      let sources = this.rssSources;
      
      if (enabledOnly) {
        sources = sources.filter(s => s.enabled);
      }
      
      if (category !== 'all') {
        sources = sources.filter(s => s.category === category);
      }

      return {
        sources: sources.map(s => ({
          name: s.name,
          category: s.category,
          description: s.description,
          enabled: s.enabled
        })),
        total: sources.length,
        message: `Found ${sources.length} TradFi news sources`
      };
    } catch (error) {
      return {
        sources: [],
        total: 0,
        error: `Failed to get sources: ${error}`,
        message: 'Error retrieving sources'
      };
    }
  }

  async getNews(args: any): Promise<TradFiNewsResult> {
    try {
      const { 
        query, 
        limit = 50, 
        category = 'all', 
        sources = [], 
        timeRange = '24h',
        includeRelated = true 
      } = args;

      // If no query provided, get latest news
      if (!query || query.trim() === '') {
        return await this.getLatestNews({ limit, category, sources });
      }

      // Check if query looks like a symbol (short, uppercase, common symbols)
      const isSymbol = /^[A-Z]{1,5}$/.test(query.trim()) || 
                      ['BTC', 'ETH', 'AAPL', 'SPY', 'TSLA', 'NVDA', 'MSFT', 'GOOGL'].includes(query.toUpperCase());

      if (isSymbol) {
        // Handle as symbol search
        return await this.getNewsBySymbol({ 
          symbol: query.toUpperCase(), 
          limit, 
          includeRelated 
        });
      }

      // Check for macro-related queries
      const macroKeywords = ['fed', 'federal reserve', 'inflation', 'interest rate', 'monetary policy', 'gdp', 'unemployment', 'cpi', 'ppi'];
      const isMacroQuery = macroKeywords.some(keyword => 
        query.toLowerCase().includes(keyword.toLowerCase())
      );

      if (isMacroQuery && category === 'all') {
        // Handle as macro events search with additional search
        const macroResult = await this.getMacroEvents({ 
          limit: Math.floor(limit * 0.7), 
          includeCentralBank: true, 
          includeRegulation: true 
        });
        
        // Also do a regular search for additional results
        const searchResult = await this.searchNews({ 
          query, 
          limit: Math.floor(limit * 0.3), 
          category: 'macro', 
          timeRange 
        });

        // Combine results
        const combinedArticles = [...macroResult.articles, ...searchResult.articles];
        const uniqueArticles = combinedArticles.filter((article, index, self) => 
          index === self.findIndex(a => a.title === article.title && a.url === article.url)
        );

        return {
          articles: uniqueArticles.slice(0, limit),
          total: uniqueArticles.length,
          sources: [...new Set([...macroResult.sources, ...searchResult.sources])],
          timeRange,
          message: `Found ${uniqueArticles.length} articles for macro query: "${query}"`
        };
      }

      // Default to search functionality
      return await this.searchNews({ query, limit, category, timeRange });

    } catch (error) {
      return {
        articles: [],
        total: 0,
        sources: [],
        timeRange: 'latest',
        error: `Failed to get news: ${error}`,
        message: 'Error retrieving news'
      };
    }
  }

  private getRelatedTerms(symbol: string): string[] {
    const relatedTerms: { [key: string]: string[] } = {
      'BTC': ['bitcoin', 'cryptocurrency', 'digital currency'],
      'ETH': ['ethereum', 'smart contracts', 'defi'],
      'AAPL': ['apple', 'tech stocks', 'nasdaq'],
      'SPY': ['sp500', 'index', 'market'],
      'TSLA': ['tesla', 'electric vehicles', 'elon musk']
    };

    return relatedTerms[symbol.toUpperCase()] || [symbol.toLowerCase()];
  }

  private calculateRelevanceScore(article: TradFiArticle, symbol: string): number {
    let score = 0;
    const text = (article.title + ' ' + article.description).toLowerCase();
    const symbolLower = symbol.toLowerCase();

    // Direct symbol mention
    if (text.includes(symbolLower)) score += 10;
    
    // Title mention gets higher score
    if (article.title.toLowerCase().includes(symbolLower)) score += 5;
    
    // Tag relevance
    if (article.tags.includes(symbolLower)) score += 3;
    
    // Recency bonus
    const hoursAgo = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 6) score += 2;
    else if (hoursAgo < 24) score += 1;

    return score;
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

  // Cleanup method
  async destroy(): Promise<void> {
    // TradFi module doesn't need cleanup, but implementing for consistency
  }
}
