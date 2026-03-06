import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import { TelegramModule } from '../telegram/index.js';
import { RedditModule } from '../reddit/index.js';
import { NewsModule } from '../news/index.js';
import { TelegramPostgresDatabase } from '../telegram/postgres-database.js';
import { RedditPostgresDatabase } from '../reddit/postgres-database.js';
import { SemanticSentimentEngine, SemanticSearchQuery, SemanticMessage } from './semantic-engine.js';
import { getSymbolAliases } from './symbol-mapping.js';
import { Pool } from 'pg';

export class SentimentModule extends BaseCryptoModule {
  name = 'sentiment';
  private telegramModule: TelegramModule | null = null;
  private redditModule: RedditModule | null = null;
  private newsModule: NewsModule | null = null;
  private telegramDatabase: TelegramPostgresDatabase | null = null;
  private redditDatabase: RedditPostgresDatabase | null = null;
  private telegramPool: Pool | null = null;
  private redditPool: Pool | null = null;
  private semanticEngine: SemanticSentimentEngine | null = null;

  protected setupTools() {
    this.addTool({
      name: 'sentiment_get_sentiment_messages',
      description: 'Search for messages across Telegram, Reddit, and Polymarket databases for a keyword and return raw messages for LLM sentiment analysis',
      inputSchema: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'Keyword to search for (flexible matching - can be ticker, topic, or any term)'
          },
          timeRange: {
            type: 'string',
            description: 'Time range for analysis',
            enum: ['1h', '6h', '24h', '7d'],
            default: '24h'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of messages to return per source',
            default: 100
          },
          sources: {
            type: 'array',
            description: 'Sources to search in',
            items: {
              type: 'string',
            enum: ['telegram', 'reddit']
          },
          default: ['telegram', 'reddit']
          }
        },
        required: ['keyword']
      },
      handler: this.getSentimentMessages.bind(this)
    });

    this.addTool({
      name: 'sentiment_get_trending_and_vibe',
      description: 'Get trending topics and general market vibe from all sources (merged trending topics and general vibe)',
      inputSchema: {
        type: 'object',
        properties: {
          timeRange: {
            type: 'string',
            description: 'Time range for analysis',
            enum: ['1h', '6h', '24h', '7d'],
            default: '24h'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of messages/topics to analyze',
            default: 200
          }
        }
      },
      handler: this.getTrendingAndVibe.bind(this)
    });

    // New semantic sentiment tools
    this.addTool({
      name: 'sentiment_semantic_search',
      description: 'Search for messages using semantic similarity and contextual understanding',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Semantic search query (e.g., "bullish bitcoin sentiment", "fear uncertainty doubt")'
          },
          semantic_similarity_threshold: {
            type: 'number',
            description: 'Minimum semantic similarity score (0-1)',
            default: 0.7
          },
          sentiment_filter: {
            type: 'string',
            description: 'Filter by sentiment direction',
            enum: ['bullish', 'bearish', 'neutral']
          },
          time_range: {
            type: 'string',
            description: 'Time range for search',
            enum: ['1h', '6h', '24h', '7d', '30d'],
            default: '24h'
          },
          sources: {
            type: 'array',
            description: 'Sources to search in',
            items: {
              type: 'string',
              enum: ['telegram', 'reddit']
            },
            default: ['telegram', 'reddit']
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results',
            default: 50
          }
        },
        required: ['query']
      },
      handler: this.semanticSearch.bind(this)
    });

    this.addTool({
      name: 'sentiment_get_semantic_trends',
      description: 'Get intelligent topic clustering and trend analysis using semantic understanding',
      inputSchema: {
        type: 'object',
        properties: {
          time_range: {
            type: 'string',
            description: 'Time range for trend analysis',
            enum: ['1h', '6h', '24h', '7d', '30d'],
            default: '24h'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of trends to return',
            default: 10
          }
        }
      },
      handler: this.getSemanticTrends.bind(this)
    });

    this.addTool({
      name: 'sentiment_analyze_cross_platform',
      description: 'Analyze sentiment correlation and influence flow across platforms',
      inputSchema: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Topic or entity to analyze (e.g., "bitcoin", "ethereum")'
          },
          time_range: {
            type: 'string',
            description: 'Time range for analysis',
            enum: ['1h', '6h', '24h', '7d'],
            default: '24h'
          },
          correlation_threshold: {
            type: 'number',
            description: 'Minimum correlation score to report',
            default: 0.6
          }
        },
        required: ['topic']
      },
      handler: this.analyzeCrossPlatformSentiment.bind(this)
    });

    // Unified advanced search tool
    this.addTool({
      name: 'sentiment_advanced_search',
      description: 'Advanced search with multiple strategies: semantic (conceptual), keyword (precise), or hybrid (balanced)',
      inputSchema: {
        type: 'object',
        properties: {
          search_type: {
            type: 'string',
            description: 'Search strategy to use',
            enum: ['semantic', 'keyword', 'hybrid'],
            default: 'semantic'
          },
          query: {
            type: 'string',
            description: 'Search query - semantic query for semantic/hybrid search, or main topic for keyword search'
          },
          keywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Keywords for keyword/hybrid search (e.g., ["bitcoin", "pump", "moon"])'
          },
          semantic_similarity_threshold: {
            type: 'number',
            description: 'Minimum semantic similarity score for semantic/hybrid search (0-1)',
            default: 0.7
          },
          keyword_match_mode: {
            type: 'string',
            description: 'For keyword/hybrid search: match any keyword or all keywords',
            enum: ['any', 'all'],
            default: 'any'
          },
          case_sensitive: {
            type: 'boolean',
            description: 'Whether keyword matching should be case-sensitive',
            default: false
          },
          sentiment_filter: {
            type: 'string',
            description: 'Filter by sentiment direction (semantic search only)',
            enum: ['bullish', 'bearish', 'neutral']
          },
          time_range: {
            type: 'string',
            description: 'Time range for search',
            enum: ['1h', '6h', '24h', '7d', '30d'],
            default: '24h'
          },
          sources: {
            type: 'array',
            description: 'Sources to search in',
            items: {
              type: 'string',
              enum: ['telegram', 'reddit']
            },
            default: ['telegram', 'reddit']
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results',
            default: 50
          }
        },
        required: ['search_type']
      },
      handler: this.advancedSearch.bind(this)
    });

    // Sentiment expansion tools
    this.addTool({
      name: 'sentiment_get_health',
      description: 'Returns availability status of Telegram, Reddit, and semantic engine data sources',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      },
      handler: this.getHealth.bind(this)
    });

    this.addTool({
      name: 'sentiment_get_symbol_sentiment',
      description: 'Get symbol-specific sentiment (BTC, ETH, SOL, etc.) using keyword/semantic search for ticker mentions',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Ticker symbol (e.g. BTC, ETH, SOL)' },
          time_range: { type: 'string', enum: ['1h', '4h', '24h', '7d'], default: '24h' },
          limit: { type: 'number', description: 'Max results to analyze', default: 100 }
        },
        required: ['symbol']
      },
      handler: this.getSymbolSentiment.bind(this)
    });

    this.addTool({
      name: 'sentiment_get_time_windowed',
      description: 'Return sentiment aggregated for 1h, 4h, 24h, 7d time windows',
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Topic or keyword to analyze', default: 'crypto' },
          limit: { type: 'number', default: 200 }
        }
      },
      handler: this.getTimeWindowed.bind(this)
    });

    this.addTool({
      name: 'sentiment_get_unified_score',
      description: 'Aggregate sentiment from Telegram + Reddit (News optional). Weighted avg, normalized to [-1, 1]',
      inputSchema: {
        type: 'object',
        properties: {
          time_range: { type: 'string', enum: ['1h', '4h', '24h', '7d'], default: '24h' },
          include_news: { type: 'boolean', default: true },
          limit: { type: 'number', default: 500 }
        }
      },
      handler: this.getUnifiedScore.bind(this)
    });

    this.addTool({
      name: 'sentiment_detect_extremes',
      description: 'Detect fear/greed spikes (score > 0.8 or < -0.8). Return extreme_events with timestamp, score, direction',
      inputSchema: {
        type: 'object',
        properties: {
          time_range: { type: 'string', enum: ['1h', '4h', '24h', '7d'], default: '24h' },
          threshold: { type: 'number', description: 'Absolute score threshold', default: 0.8 }
        }
      },
      handler: this.detectExtremes.bind(this)
    });

    this.addTool({
      name: 'sentiment_query_by_topic',
      description: 'Topic/keyword semantic search with optional sentiment filter',
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Topic or keyword to search' },
          sentiment_filter: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
          time_range: { type: 'string', enum: ['1h', '4h', '24h', '7d'], default: '24h' },
          limit: { type: 'number', default: 50 }
        },
        required: ['topic']
      },
      handler: this.queryByTopic.bind(this)
    });

    this.addTool({
      name: 'sentiment_get_historical',
      description: 'Historical sentiment snapshots (coming soon - no DB migration yet)',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          days: { type: 'number', default: 7 }
        }
      },
      handler: this.getHistorical.bind(this)
    });
  }

  async initialize(): Promise<void> {
    this.setupTools();
    
    try {
      // Initialize direct database connections
      console.log('📊 Initializing sentiment database connections...');
      
      // Initialize Telegram database connection
      this.telegramDatabase = new TelegramPostgresDatabase();
      await this.telegramDatabase.initialize();
      this.telegramPool = await this.postgresManager.getPool('telegram');
      console.log('✅ Telegram database connection initialized');
      
      // Initialize Reddit database connection
      this.redditDatabase = new RedditPostgresDatabase();
      await this.redditDatabase.initialize();
      this.redditPool = await this.postgresManager.getPool('reddit');
      console.log('✅ Reddit database connection initialized');
      
      // Initialize semantic sentiment engine
      console.log('🧠 Initializing semantic sentiment engine...');
      if (this.telegramPool) {
        this.semanticEngine = new SemanticSentimentEngine(this.telegramPool);
        await this.semanticEngine.initialize();
        console.log('✅ Semantic sentiment engine initialized');
      } else {
        console.warn('⚠️ Cannot initialize semantic engine without database connection');
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to initialize database connections:', error instanceof Error ? error.message : String(error));
    }
    
    
    console.log('✅ Sentiment module initialized successfully');
  }

  setTelegramModule(telegramModule: TelegramModule): void {
    this.telegramModule = telegramModule;
    // Get the database reference from the Telegram module
    if (telegramModule) {
      this.telegramDatabase = telegramModule.getTelegramDatabase();
    }
  }


  setRedditModule(redditModule: RedditModule): void {
    this.redditModule = redditModule;
  }

  setNewsModule(newsModule: NewsModule | null): void {
    this.newsModule = newsModule;
  }

  /** Get availability of all sentiment data sources. Used for error handling. */
  private getAvailability(): { telegram: boolean; reddit: boolean; semantic_engine: boolean } {
    return {
      telegram: !!this.telegramPool,
      reddit: !!this.redditPool,
      semantic_engine: !!this.semanticEngine && !!this.telegramPool
    };
  }

  // Method to check module dependencies status
  getDependencyStatus() {
    return {
      telegram: {
        available: !!this.telegramModule,
        database: !!this.telegramDatabase,
        pool: !!this.telegramPool
      },
      reddit: {
        available: !!this.redditModule,
        database: !!this.redditDatabase,
        pool: !!this.redditPool
      },
    };
  }

  // Ensure database connections are initialized (for lazy loading)
  private async ensureDatabaseConnections(): Promise<void> {
    if (!this.telegramPool || !this.redditPool) {
      console.log('📊 Ensuring sentiment database connections...');
      
      // Initialize Telegram database connection
      if (!this.telegramPool) {
        this.telegramDatabase = new TelegramPostgresDatabase();
        await this.telegramDatabase.initialize();
        this.telegramPool = await this.postgresManager.getPool('telegram');
        console.log('✅ Telegram database connection ensured');
      }
      
      // Initialize Reddit database connection
      if (!this.redditPool) {
        this.redditDatabase = new RedditPostgresDatabase();
        await this.redditDatabase.initialize();
        this.redditPool = await this.postgresManager.getPool('reddit');
        console.log('✅ Reddit database connection ensured');
      }
    }
  }

  // Direct database query methods
  private async searchTelegramMessages(query: string, limit: number = 100): Promise<any[]> {
    if (!this.telegramPool) return [];
    
    try {
      const sql = `
        SELECT id, message_id, chat_id, chat_title, user_id, username, text, date, created_at
        FROM telegram_messages
        WHERE LOWER(text) LIKE LOWER($1)
        ORDER BY date DESC
        LIMIT $2
      `;
      const result = await this.telegramPool.query(sql, [`%${query}%`, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error searching Telegram messages:', error);
      return [];
    }
  }

  private async getRecentTelegramMessages(limit: number = 100): Promise<any[]> {
    if (!this.telegramPool) return [];
    
    try {
      const sql = `
        SELECT id, message_id, chat_id, chat_title, user_id, username, text, date, created_at
        FROM telegram_messages
        ORDER BY date DESC
        LIMIT $1
      `;
      const result = await this.telegramPool.query(sql, [limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting recent Telegram messages:', error);
      return [];
    }
  }

  private async searchRedditPosts(query: string, limit: number = 100): Promise<any[]> {
    if (!this.redditPool) return [];
    
    try {
      const sql = `
        SELECT id, title, content, author, subreddit, score, upvote_ratio, num_comments, created_utc, url, permalink, flair, is_self, domain, created_at, updated_at
        FROM reddit_posts
        WHERE LOWER(title) LIKE LOWER($1) OR LOWER(content) LIKE LOWER($1)
        ORDER BY created_utc DESC
        LIMIT $2
      `;
      const result = await this.redditPool.query(sql, [`%${query}%`, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error searching Reddit posts:', error);
      return [];
    }
  }

  private async getRecentRedditPosts(limit: number = 100): Promise<any[]> {
    if (!this.redditPool) return [];
    
    try {
      const sql = `
        SELECT id, title, content, author, subreddit, score, upvote_ratio, num_comments, created_utc, url, permalink, flair, is_self, domain, created_at, updated_at
        FROM reddit_posts
        ORDER BY created_utc DESC
        LIMIT $1
      `;
      const result = await this.redditPool.query(sql, [limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting recent Reddit posts:', error);
      return [];
    }
  }

  private async searchRedditComments(query: string, limit: number = 50): Promise<any[]> {
    if (!this.redditPool) return [];
    
    try {
      const sql = `
        SELECT c.id, c.content, c.score, c.author, c.created_utc, c.parent_id, p.subreddit
        FROM reddit_comments c
        JOIN reddit_posts p ON c.post_id = p.id
        WHERE LOWER(c.content) LIKE LOWER($1)
        AND c.score > 1
        ORDER BY c.score DESC, c.created_utc DESC
        LIMIT $2
      `;
      const result = await this.redditPool.query(sql, [`%${query}%`, limit]);
      return result.rows.map(row => ({
        id: row.id,
        text: row.content,
        content: row.content,
        score: row.score,
        author: row.author,
        created_utc: row.created_utc,
        parent_id: row.parent_id,
        subreddit: row.subreddit,
        created_at: new Date(row.created_utc * 1000).toISOString()
      }));
    } catch (error) {
      console.error('Error searching Reddit comments:', error);
      return [];
    }
  }

  private async searchPolymarketComments(query: string, limit: number = 50): Promise<any[]> {
    // Polymarket functionality not yet implemented
    return [];
  }

  // New main method: get sentiment messages for a keyword from all sources
  private async getSentimentMessages(args: any) {
    try {
      const { keyword, timeRange = '24h', limit = 100, sources = ['telegram', 'reddit'] } = args;
      
      // Validate inputs
      if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
        return {
          success: false,
          error: 'Invalid keyword parameter',
          message: 'Keyword must be a non-empty string',
          data: { keyword: '', messages: [] }
        };
      }
      
      // Ensure limit is within reasonable bounds
      const safeLimit = Math.min(Math.max(parseInt(limit) || 100, 1), 500);
      const allMessages = [];
      
      // Search Telegram if requested
      if (sources.includes('telegram') && this.telegramPool) {
        try {
          const telegramMessages = await this.searchTelegramMessages(keyword.trim(), safeLimit);
          allMessages.push(...telegramMessages.map(msg => ({
            id: msg.id,
            source: 'telegram',
            text: msg.text || msg.message_text || msg.sanitized_text,
            date: msg.date,
            created_at: msg.created_at,
            metadata: {
              chat_title: msg.chat_title,
              username: msg.username,
              chat_id: msg.chat_id
            }
          })));
        } catch (error) {
          console.error('Error fetching Telegram messages:', error);
        }
      }
      
      // Search Reddit if requested
      if (sources.includes('reddit') && this.redditPool) {
        try {
          const redditPosts = await this.searchRedditPosts(keyword.trim(), Math.floor(safeLimit * 0.7));
          const redditComments = await this.searchRedditComments(keyword.trim(), Math.floor(safeLimit * 0.3));
          
          allMessages.push(...redditPosts.map(post => ({
            id: post.id,
            source: 'reddit',
            text: post.title + (post.content ? '\n\n' + post.content : ''),
            date: new Date(post.created_utc * 1000).toISOString(),
            created_at: post.created_at,
            metadata: {
              subreddit: post.subreddit,
              author: post.author,
              score: post.score,
              upvote_ratio: post.upvote_ratio,
              url: post.url,
              type: 'post'
            }
          })));
          
          allMessages.push(...redditComments.map(comment => ({
            id: comment.id,
            source: 'reddit',
            text: comment.body,
            date: new Date(comment.created_utc * 1000).toISOString(),
            created_at: comment.created_at,
            metadata: {
              subreddit: comment.subreddit,
              author: comment.author,
              score: comment.score,
              upvote_ratio: comment.upvote_ratio,
              parent_id: comment.parent_id,
              type: 'comment'
            }
          })));
        } catch (error) {
          console.error('Error fetching Reddit data:', error);
        }
      }
      

      return {
        success: true,
        message: `Retrieved ${allMessages.length} messages for keyword "${keyword}" from ${sources.join(', ')}`,
        data: {
          keyword: keyword.trim(),
          timeRange,
          totalMessages: allMessages.length,
          sources: {
            telegram: allMessages.filter(m => m.source === 'telegram').length,
            reddit: allMessages.filter(m => m.source === 'reddit').length,
          },
          messages: allMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch messages: ${error}`,
        message: 'Error fetching sentiment messages',
        data: { keyword: args.keyword, messages: [] }
      };
    }
  }

  // Merged trending topics and general vibe method
  private async getTrendingAndVibe(args: any) {
    try {
      const { timeRange = '24h', limit = 200 } = args;
      const allMessages = [];
      
      // Fetch from Telegram
      if (this.telegramPool) {
        try {
          const telegramMessages = await this.getRecentTelegramMessages(Math.floor(limit * 0.4));
          allMessages.push(...telegramMessages.map(msg => ({
            id: msg.id,
            source: 'telegram',
            text: msg.text || msg.message_text || msg.sanitized_text,
            date: msg.date,
            created_at: msg.created_at,
            metadata: {
              chat_title: msg.chat_title,
              username: msg.username,
              chat_id: msg.chat_id
            }
          })));
        } catch (error) {
          console.error('Error fetching Telegram messages:', error);
        }
      }
      
      // Fetch from Reddit
      if (this.redditPool) {
        try {
          const redditPosts = await this.getRecentRedditPosts(Math.floor(limit * 0.3));
          allMessages.push(...redditPosts.map(post => ({
            id: post.id,
            source: 'reddit',
            text: post.title + (post.content ? '\n\n' + post.content : ''),
            date: new Date(post.created_utc * 1000).toISOString(),
            created_at: post.created_at,
            metadata: {
              subreddit: post.subreddit,
              author: post.author,
              score: post.score,
              upvote_ratio: post.upvote_ratio,
              url: post.url,
              type: 'post'
            }
          })));
        } catch (error) {
          console.error('Error fetching Reddit posts:', error);
        }
      }
      
      // Fetch from Polymarket (if available)
      // Polymarket functionality not yet implemented
      /*
      if (this.polymarketCommentsTool) {
        try {
          const polymarketComments = await this.getRecentPolymarketComments(Math.floor(limit * 0.3));
          allMessages.push(...polymarketComments.map(comment => ({
            id: comment.id,
            source: 'polymarket',
            text: comment.text || comment.content,
            date: comment.createdAt || comment.created_at,
            created_at: comment.created_at,
            metadata: {
              market_id: comment.market_id,
              user_id: comment.user_id,
              reaction_count: comment.reaction_count,
              report_count: comment.report_count
            }
          })));
        } catch (error) {
          console.error('Error fetching Polymarket comments:', error);
        }
      }
      */

      // Extract trending topics from all messages
      const cryptoTerms = ['btc', 'bitcoin', 'eth', 'ethereum', 'sol', 'solana', 'bnb', 'binance', 'ada', 'cardano', 'dot', 'polkadot', 'avax', 'avalanche', 'matic', 'polygon', 'link', 'chainlink', 'uni', 'uniswap'];
      const termCounts: { [key: string]: number } = {};
      
      allMessages.forEach(msg => {
        const text = msg.text?.toLowerCase() || '';
        cryptoTerms.forEach(term => {
          if (text.includes(term)) {
            termCounts[term] = (termCounts[term] || 0) + 1;
          }
        });
      });
      
      const trendingTopics = Object.entries(termCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([term, count]) => ({ term, mentions: count }));

      return {
        success: true,
        message: `Retrieved ${allMessages.length} messages and identified ${trendingTopics.length} trending topics`,
        data: {
          timeRange,
          totalMessages: allMessages.length,
          sources: {
            telegram: allMessages.filter(m => m.source === 'telegram').length,
            reddit: allMessages.filter(m => m.source === 'reddit').length,
          },
          trendingTopics,
          messages: allMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch trending and vibe data: ${error}`,
        message: 'Error fetching trending topics and general vibe',
        data: { messages: [], trendingTopics: [] }
      };
    }
  }

  // New semantic sentiment methods
  private async semanticSearch(args: any) {
    try {
      if (!this.semanticEngine) {
        return {
          success: false,
          error: 'Semantic engine not initialized',
          message: 'Semantic search requires the semantic engine to be properly initialized',
          data: { query: args.query, results: [] }
        };
      }

      const query: SemanticSearchQuery = {
        query: args.query,
        semantic_similarity_threshold: args.semantic_similarity_threshold || 0.7,
        sentiment_filter: args.sentiment_filter,
        time_range: args.time_range || '24h',
        sources: args.sources || ['telegram', 'reddit'],
        limit: args.limit || 50
      };

      // First, process recent messages through semantic engine
      await this.processRecentMessagesForSemantics(query.time_range);

      const results = await this.semanticEngine.semanticSearch(query);

      return {
        success: true,
        message: `Found ${results.length} semantically similar messages for "${args.query}"`,
        data: {
          query: args.query,
          semantic_similarity_threshold: query.semantic_similarity_threshold,
          sentiment_filter: query.sentiment_filter,
          time_range: query.time_range,
          total_results: results.length,
          results: results.map(msg => ({
            id: msg.id,
            source: msg.source,
            text: msg.text,
            date: msg.date,
            sentiment_score: msg.semantic_score,
            metadata: msg.metadata
          }))
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Semantic search failed: ${error}`,
        message: 'Error performing semantic search',
        data: { query: args.query, results: [] }
      };
    }
  }

  private async getSemanticTrends(args: any) {
    try {
      if (!this.semanticEngine) {
        return {
          success: false,
          error: 'Semantic engine not initialized',
          message: 'Semantic trends require the semantic engine to be properly initialized',
          data: { trends: [], summary: {} }
        };
      }

      const timeRange = args.time_range || '24h';
      const limit = args.limit || 10;

      // Process recent messages for semantic analysis
      await this.processRecentMessagesForSemantics(timeRange);

      const trends = await this.semanticEngine.getSemanticTrends(timeRange, limit);

      return {
        success: true,
        message: `Identified ${trends.trends.length} semantic trends over ${timeRange}`,
        data: trends
      };
    } catch (error) {
      return {
        success: false,
        error: `Semantic trends analysis failed: ${error}`,
        message: 'Error analyzing semantic trends',
        data: { trends: [], summary: {} }
      };
    }
  }

  private async advancedSearch(args: any) {
    try {
      if (!this.semanticEngine) {
        return {
          success: false,
          error: 'Semantic engine not initialized',
          message: 'Advanced search requires the semantic engine to be properly initialized',
          data: { search_type: args.search_type, results: [] }
        };
      }

      const searchType = args.search_type || 'semantic';
      
      // Process recent messages first
      await this.processRecentMessagesForSemantics(args.time_range || '24h');

      switch (searchType) {
        case 'semantic':
          return await this.handleSemanticSearch(args);
        
        case 'keyword':
          return await this.handleKeywordSearch(args);
        
        case 'hybrid':
          return await this.handleHybridSearch(args);
        
        default:
          return {
            success: false,
            error: 'Invalid search type',
            message: 'Search type must be one of: semantic, keyword, hybrid',
            data: { search_type: searchType, results: [] }
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Advanced search failed: ${error}`,
        message: 'Error performing advanced search',
        data: { search_type: args.search_type, results: [] }
      };
    }
  }

  private async handleSemanticSearch(args: any) {
    if (!args.query) {
      return {
        success: false,
        error: 'Query required for semantic search',
        message: 'Semantic search requires a query parameter',
        data: { search_type: 'semantic', results: [] }
      };
    }

    const query = {
      query: args.query,
      semantic_similarity_threshold: args.semantic_similarity_threshold || 0.7,
      sentiment_filter: args.sentiment_filter,
      time_range: args.time_range || '24h',
      sources: args.sources || ['telegram', 'reddit'],
      limit: args.limit || 50
    };

    const results = await this.semanticEngine.semanticSearch(query);

    return {
      success: true,
      message: `Found ${results.length} semantically similar messages for "${args.query}"`,
      data: {
        search_type: 'semantic',
        query: args.query,
        semantic_similarity_threshold: query.semantic_similarity_threshold,
        sentiment_filter: query.sentiment_filter,
        time_range: query.time_range,
        total_results: results.length,
        results: results.map(msg => ({
          id: msg.id,
          source: msg.source,
          text: msg.text,
          date: msg.date,
          sentiment_score: msg.semantic_score,
          metadata: msg.metadata
        }))
      }
    };
  }

  private async handleKeywordSearch(args: any) {
    const keywords = args.keywords || [];
    if (keywords.length === 0) {
      return {
        success: false,
        error: 'Keywords required for keyword search',
        message: 'Keyword search requires at least one keyword',
        data: { search_type: 'keyword', results: [] }
      };
    }

    const results = await this.semanticEngine.searchByKeywords(keywords, {
      match_mode: args.keyword_match_mode || 'any',
      case_sensitive: args.case_sensitive || false,
      time_range: args.time_range || '24h',
      sources: args.sources || ['telegram', 'reddit'],
      limit: args.limit || 100
    });

    return {
      success: true,
      message: `Found ${results.total_results} messages matching keywords: ${keywords.join(', ')}`,
      data: {
        search_type: 'keyword',
        ...results
      }
    };
  }

  private async handleHybridSearch(args: any) {
    const query = args.query || '';
    const keywords = args.keywords || [];
    
    if (!query.trim() || keywords.length === 0) {
      return {
        success: false,
        error: 'Query and keywords required for hybrid search',
        message: 'Hybrid search requires both query and keywords parameters',
        data: { search_type: 'hybrid', results: [] }
      };
    }

    const results = await this.semanticEngine.searchHybrid(query, keywords, {
      keyword_match_mode: args.keyword_match_mode || 'any',
      similarity_threshold: args.semantic_similarity_threshold || 0.5,
      time_range: args.time_range || '24h',
      sources: args.sources || ['telegram', 'reddit'],
      limit: args.limit || 50
    });

    return {
      success: true,
      message: `Found ${results.total_results} messages using hybrid search for "${query}" with keywords: ${keywords.join(', ')}`,
      data: {
        search_type: 'hybrid',
        ...results
      }
    };
  }

  private async analyzeCrossPlatformSentiment(args: any) {
    try {
      if (!this.semanticEngine) {
        return {
          success: false,
          error: 'Semantic engine not initialized',
          message: 'Cross-platform analysis requires the semantic engine to be properly initialized',
          data: { correlations: [], analysis: {} }
        };
      }

      const topic = args.topic;
      const timeRange = args.time_range || '24h';
      const correlationThreshold = args.correlation_threshold || 0.6;

      // Search for topic-related messages across platforms
      const telegramQuery: SemanticSearchQuery = {
        query: topic,
        time_range: timeRange,
        sources: ['telegram'],
        limit: 200
      };

      const redditQuery: SemanticSearchQuery = {
        query: topic,
        time_range: timeRange,
        sources: ['reddit'],
        limit: 200
      };

      await this.processRecentMessagesForSemantics(timeRange);

      const telegramResults = await this.semanticEngine.semanticSearch(telegramQuery);
      const redditResults = await this.semanticEngine.semanticSearch(redditQuery);

      // Calculate cross-platform sentiment correlation
      const telegramSentiment = telegramResults.reduce((sum, msg) => sum + (msg.semantic_score || 0), 0) / telegramResults.length || 0;
      const redditSentiment = redditResults.reduce((sum, msg) => sum + (msg.semantic_score || 0), 0) / redditResults.length || 0;

      // Analyze sentiment distribution over time
      const timeSlots = this.createTimeSlots(timeRange);
      const telegramTimeSeries = this.createSentimentTimeSeries(telegramResults, timeSlots);
      const redditTimeSeries = this.createSentimentTimeSeries(redditResults, timeSlots);

      // Calculate correlation coefficient
      const correlation = this.calculateCorrelation(telegramTimeSeries, redditTimeSeries);

      // Detect influence direction (which platform leads sentiment changes)
      const influenceAnalysis = this.analyzeInfluenceDirection(telegramTimeSeries, redditTimeSeries);

      return {
        success: true,
        message: `Analyzed cross-platform sentiment for "${topic}" with correlation ${correlation.toFixed(3)}`,
        data: {
          topic,
          time_range: timeRange,
          platform_sentiment: {
            telegram: {
              average_sentiment: telegramSentiment,
              message_count: telegramResults.length,
              sentiment_distribution: this.calculateSentimentDistribution(telegramResults)
            },
            reddit: {
              average_sentiment: redditSentiment,
              message_count: redditResults.length,
              sentiment_distribution: this.calculateSentimentDistribution(redditResults)
            }
          },
          correlation: {
            coefficient: correlation,
            strength: this.interpretCorrelationStrength(correlation),
            significant: Math.abs(correlation) >= correlationThreshold
          },
          influence_analysis: influenceAnalysis,
          time_series: {
            telegram: telegramTimeSeries,
            reddit: redditTimeSeries
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Cross-platform analysis failed: ${error}`,
        message: 'Error analyzing cross-platform sentiment',
        data: { correlations: [], analysis: {} }
      };
    }
  }

  private async processRecentMessagesForSemantics(timeRange: string): Promise<void> {
    if (!this.semanticEngine) return;

    try {
      // Get recent messages from both platforms
      const limit = 500; // Process more messages for better semantic analysis
      
      if (this.telegramPool) {
        const telegramMessages = await this.getRecentTelegramMessages(limit);
        for (const msg of telegramMessages) {
          await this.semanticEngine.processMessage(msg, 'telegram');
        }
      }

      if (this.redditPool) {
        const redditPosts = await this.getRecentRedditPosts(Math.floor(limit * 0.7));
        for (const post of redditPosts) {
          await this.semanticEngine.processMessage(post, 'reddit');
        }
      }
    } catch (error) {
      console.error('Error processing messages for semantics:', error);
    }
  }

  private createTimeSlots(timeRange: string): Date[] {
    const now = new Date();
    const slots: Date[] = [];
    const timeRangeHours = this.parseTimeRangeToHours(timeRange);
    const slotCount = Math.min(24, timeRangeHours); // Max 24 slots for granularity
    const slotDuration = (timeRangeHours * 60 * 60 * 1000) / slotCount;

    for (let i = 0; i < slotCount; i++) {
      const slotTime = new Date(now.getTime() - (slotCount - i) * slotDuration);
      slots.push(slotTime);
    }

    return slots;
  }

  private createSentimentTimeSeries(messages: SemanticMessage[], timeSlots: Date[]): number[] {
    const timeSeries: number[] = new Array(timeSlots.length).fill(0);
    const counts: number[] = new Array(timeSlots.length).fill(0);

    messages.forEach(msg => {
      const msgTime = new Date(msg.date);
      
      // Find the appropriate time slot
      for (let i = 0; i < timeSlots.length - 1; i++) {
        if (msgTime >= timeSlots[i] && msgTime < timeSlots[i + 1]) {
          timeSeries[i] += msg.semantic_score || 0;
          counts[i]++;
          break;
        }
      }
      
      // Handle last slot
      if (msgTime >= timeSlots[timeSlots.length - 1]) {
        timeSeries[timeSlots.length - 1] += msg.semantic_score || 0;
        counts[timeSlots.length - 1]++;
      }
    });

    // Calculate averages
    return timeSeries.map((sum, i) => counts[i] > 0 ? sum / counts[i] : 0);
  }

  private calculateCorrelation(series1: number[], series2: number[]): number {
    if (series1.length !== series2.length || series1.length === 0) return 0;

    const mean1 = series1.reduce((sum, val) => sum + val, 0) / series1.length;
    const mean2 = series2.reduce((sum, val) => sum + val, 0) / series2.length;

    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;

    for (let i = 0; i < series1.length; i++) {
      const diff1 = series1[i] - mean1;
      const diff2 = series2[i] - mean2;
      
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator > 0 ? numerator / denominator : 0;
  }

  private analyzeInfluenceDirection(series1: number[], series2: number[]): any {
    // Simple lead-lag analysis
    let telegramLeads = 0;
    let redditLeads = 0;
    let simultaneous = 0;

    for (let i = 1; i < series1.length; i++) {
      const telegramChange = series1[i] - series1[i - 1];
      const redditChange = series2[i] - series2[i - 1];

      if (Math.abs(telegramChange) > 0.1 && Math.abs(redditChange) > 0.1) {
        if (Math.sign(telegramChange) === Math.sign(redditChange)) {
          // Same direction changes - check timing
          if (Math.abs(telegramChange) > Math.abs(redditChange)) {
            telegramLeads++;
          } else if (Math.abs(redditChange) > Math.abs(telegramChange)) {
            redditLeads++;
          } else {
            simultaneous++;
          }
        }
      }
    }

    const total = telegramLeads + redditLeads + simultaneous;
    
    return {
      telegram_leads: total > 0 ? telegramLeads / total : 0,
      reddit_leads: total > 0 ? redditLeads / total : 0,
      simultaneous: total > 0 ? simultaneous / total : 0,
      dominant_platform: telegramLeads > redditLeads ? 'telegram' : redditLeads > telegramLeads ? 'reddit' : 'balanced',
      confidence: total > 5 ? Math.min(1, total / 20) : 0.1
    };
  }

  private calculateSentimentDistribution(messages: SemanticMessage[]): any {
    const bullish = messages.filter(m => (m.semantic_score || 0) > 0.1).length;
    const bearish = messages.filter(m => (m.semantic_score || 0) < -0.1).length;
    const neutral = messages.length - bullish - bearish;

    return {
      bullish: messages.length > 0 ? bullish / messages.length : 0,
      bearish: messages.length > 0 ? bearish / messages.length : 0,
      neutral: messages.length > 0 ? neutral / messages.length : 0,
      total_messages: messages.length
    };
  }

  private interpretCorrelationStrength(correlation: number): string {
    const abs = Math.abs(correlation);
    if (abs >= 0.8) return 'very strong';
    if (abs >= 0.6) return 'strong';
    if (abs >= 0.4) return 'moderate';
    if (abs >= 0.2) return 'weak';
    return 'very weak';
  }

  private parseTimeRangeToHours(timeRange: string): number {
    const timeMap: { [key: string]: number } = {
      '1h': 1,
      '4h': 4,
      '6h': 6,
      '24h': 24,
      '7d': 168,
      '30d': 720
    };
    return timeMap[timeRange] || 24;
  }

  // ---- Sentiment expansion handlers ----

  private async getHealth(): Promise<any> {
    const availability = this.getAvailability();
    return {
      success: true,
      availability: {
        telegram: availability.telegram,
        reddit: availability.reddit,
        semantic_engine: availability.semantic_engine
      },
      message: 'Health check complete'
    };
  }

  private async getSymbolSentiment(args: any): Promise<any> {
    const availability = this.getAvailability();
    const symbol = (args.symbol || '').toString().trim().toUpperCase();
    if (!symbol) {
      return {
        success: false,
        error: 'INVALID_SYMBOL',
        availability,
        message: 'Symbol is required'
      };
    }

    if (!availability.telegram && !availability.reddit) {
      return {
        success: false,
        error: 'TELEGRAM_DB_UNAVAILABLE',
        availability,
        message: 'No sentiment data sources available (Telegram and Reddit DBs unavailable)'
      };
    }

    const timeRange = args.time_range || '24h';
    const limit = Math.min(Math.max(parseInt(args.limit) || 100, 1), 500);
    const aliases = getSymbolAliases(symbol);

    try {
      const perSource: Record<string, { score: number; mention_count: number; samples: number }> = {};
      let totalScore = 0;
      let totalWeight = 0;

      if (this.semanticEngine && availability.telegram) {
        await this.processRecentMessagesForSemantics(timeRange);
        const kwResult = await this.semanticEngine.searchByKeywords(aliases, {
          time_range: timeRange,
          sources: ['telegram', 'reddit'],
          limit,
          match_mode: 'any'
        });
        const messages = kwResult.messages;
        const tg = messages.filter(m => m.source === 'telegram');
        const rd = messages.filter(m => m.source === 'reddit');
        if (tg.length > 0) {
          const tgScore = tg.reduce((s, m) => s + (m.sentiment_score || 0), 0) / tg.length;
          perSource.telegram = { score: tgScore, mention_count: tg.length, samples: tg.length };
          totalScore += tgScore * Math.min(tg.length, 10);
          totalWeight += Math.min(tg.length, 10);
        }
        if (rd.length > 0) {
          const rdScore = rd.reduce((s, m) => s + (m.sentiment_score || 0), 0) / rd.length;
          perSource.reddit = { score: rdScore, mention_count: rd.length, samples: rd.length };
          totalScore += rdScore * Math.min(rd.length, 10);
          totalWeight += Math.min(rd.length, 10);
        }
      } else {
        if (availability.telegram && this.telegramPool) {
          const tgMsgs: any[] = [];
          for (const kw of aliases.slice(0, 3)) {
            const rows = await this.searchTelegramMessages(kw, Math.ceil(limit / aliases.length));
            tgMsgs.push(...rows);
          }
          const unique = Array.from(new Map(tgMsgs.map(m => [m.id, m])).values());
          const scores = unique.map(m => this.lexiconScore(m.text || ''));
          const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          perSource.telegram = { score: avgScore, mention_count: unique.length, samples: unique.length };
          if (unique.length > 0) {
            totalScore += avgScore * Math.min(unique.length, 10);
            totalWeight += Math.min(unique.length, 10);
          }
        }
        if (availability.reddit && this.redditPool) {
          const rdMsgs: any[] = [];
          for (const kw of aliases.slice(0, 3)) {
            const posts = await this.searchRedditPosts(kw, Math.ceil(limit / 2));
            const comments = await this.searchRedditComments(kw, Math.ceil(limit / 2));
            rdMsgs.push(...posts.map(p => ({ ...p, text: (p.title || '') + ' ' + (p.content || '') })));
            rdMsgs.push(...comments.map(c => ({ ...c, text: c.content || c.text || '' })));
          }
          const unique = Array.from(new Map(rdMsgs.map(m => [m.id, m])).values());
          const scores = unique.map(m => this.lexiconScore(m.text || ''));
          const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          perSource.reddit = { score: avgScore, mention_count: unique.length, samples: unique.length };
          if (unique.length > 0) {
            totalScore += avgScore * Math.min(unique.length, 10);
            totalWeight += Math.min(unique.length, 10);
          }
        }
      }

      const score = totalWeight > 0 ? totalScore / totalWeight : 0;
      const normalized = Math.max(-1, Math.min(1, score));

      return {
        success: true,
        symbol,
        score: Math.round(normalized * 1000) / 1000,
        per_source: perSource,
        mention_count: Object.values(perSource).reduce((s, p) => s + p.mention_count, 0),
        time_range: timeRange
      };
    } catch (err) {
      return {
        success: false,
        error: 'FETCH_FAILED',
        availability,
        message: String(err)
      };
    }
  }

  private lexiconScore(text: string): number {
    const bullish = ['moon', 'bullish', 'pump', 'buy', 'hodl', 'accumulate', 'rocket', 'lambo', 'wagmi'];
    const bearish = ['dump', 'bearish', 'crash', 'sell', 'rekt', 'fud', 'scam', 'rug', 'capitulation'];
    const t = text.toLowerCase();
    let s = 0;
    bullish.forEach(w => { if (t.includes(w)) s += 0.4; });
    bearish.forEach(w => { if (t.includes(w)) s -= 0.4; });
    return Math.max(-1, Math.min(1, s));
  }

  private async getTimeWindowed(args: any): Promise<any> {
    const availability = this.getAvailability();
    if (!availability.telegram && !availability.reddit) {
      return {
        success: false,
        error: 'TELEGRAM_DB_UNAVAILABLE',
        availability,
        windows: {}
      };
    }

    const topic = (args.topic || 'crypto').toString();
    const limit = Math.min(Math.max(parseInt(args.limit) || 200, 1), 500);
    const windows = ['1h', '4h', '24h', '7d'] as const;

    try {
      const results: Record<string, { score: number; sample_count: number }> = {};
      for (const w of windows) {
        const data = await this.fetchSentimentForTopic(topic, w, limit);
        results[w] = { score: data.score, sample_count: data.count };
      }
      return {
        success: true,
        topic,
        windows: results,
        availability
      };
    } catch (err) {
      return {
        success: false,
        error: 'FETCH_FAILED',
        availability,
        message: String(err)
      };
    }
  }

  private async fetchSentimentForTopic(topic: string, timeRange: string, limit: number): Promise<{ score: number; count: number }> {
    if (this.semanticEngine && this.telegramPool) {
      await this.processRecentMessagesForSemantics(timeRange);
      const results = await this.semanticEngine.semanticSearch({
        query: topic,
        time_range: timeRange,
        sources: ['telegram', 'reddit'],
        limit
      });
      const count = results.length;
      const score = count > 0
        ? results.reduce((s, m) => s + (m.semantic_score || 0), 0) / count
        : 0;
      return { score: Math.max(-1, Math.min(1, score)), count };
    }

    const all: Array<{ score: number }> = [];
    if (this.telegramPool) {
      const rows = await this.searchTelegramMessages(topic, limit);
      rows.forEach(r => all.push({ score: this.lexiconScore(r.text || '') }));
    }
    if (this.redditPool) {
      const posts = await this.searchRedditPosts(topic, Math.ceil(limit / 2));
      const comments = await this.searchRedditComments(topic, Math.ceil(limit / 2));
      posts.forEach(p => all.push({ score: this.lexiconScore((p.title || '') + ' ' + (p.content || '')) }));
      comments.forEach(c => all.push({ score: this.lexiconScore(c.content || c.text || '') }));
    }
    const count = all.length;
    const score = count > 0 ? all.reduce((s, m) => s + m.score, 0) / count : 0;
    return { score: Math.max(-1, Math.min(1, score)), count };
  }

  private async getUnifiedScore(args: any): Promise<any> {
    const availability = this.getAvailability();
    if (!availability.telegram && !availability.reddit) {
      return {
        success: false,
        error: 'TELEGRAM_DB_UNAVAILABLE',
        availability,
        unified_score: 0,
        per_source_scores: {},
        sample_count: 0
      };
    }

    const timeRange = args.time_range || '24h';
    const includeNews = args.include_news !== false;
    const limit = Math.min(Math.max(parseInt(args.limit) || 500, 1), 1000);

    try {
      const perSourceScores: Record<string, { score: number; count: number; weight: number }> = {};
      const weights = { telegram: 0.4, reddit: 0.4, news: 0.2 };

      if (availability.telegram && this.telegramPool) {
        const msgs = await this.getRecentTelegramMessages(Math.ceil(limit * 0.5));
        const scores = msgs.map(m => this.lexiconScore(m.text || ''));
        const count = scores.length;
        const avg = count > 0 ? scores.reduce((a, b) => a + b, 0) / count : 0;
        perSourceScores.telegram = { score: avg, count, weight: weights.telegram };
      }

      if (availability.reddit && this.redditPool) {
        const posts = await this.getRecentRedditPosts(Math.ceil(limit * 0.5));
        const scores = posts.map(p => this.lexiconScore((p.title || '') + ' ' + (p.content || '')));
        const count = scores.length;
        const avg = count > 0 ? scores.reduce((a, b) => a + b, 0) / count : 0;
        perSourceScores.reddit = { score: avg, count, weight: weights.reddit };
      }

      if (includeNews && this.newsModule) {
        try {
          const newsResult = await this.newsModule.executeTool('news_search', {
            query: 'crypto market',
            timeRange,
            limit: 30
          });
          const articles = (newsResult as any).results || [];
          const scores = articles.map((a: any) => this.lexiconScore((a.title || '') + ' ' + (a.description || '')));
          const count = scores.length;
          const avg = count > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / count : 0;
          perSourceScores.news = { score: avg, count, weight: weights.news };
        } catch {
          perSourceScores.news = { score: 0, count: 0, weight: 0 };
        }
      }

      let weightedSum = 0;
      let totalWeight = 0;
      for (const [k, v] of Object.entries(perSourceScores)) {
        if (v.count > 0 && v.weight > 0) {
          weightedSum += v.score * v.weight;
          totalWeight += v.weight;
        }
      }
      const unifiedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
      const normalized = Math.max(-1, Math.min(1, unifiedScore));
      const sampleCount = Object.values(perSourceScores).reduce((s, v) => s + v.count, 0);

      return {
        success: true,
        unified_score: Math.round(normalized * 1000) / 1000,
        per_source_scores: Object.fromEntries(
          Object.entries(perSourceScores).map(([k, v]) => [k, { score: v.score, count: v.count }])
        ),
        sample_count: sampleCount,
        availability
      };
    } catch (err) {
      return {
        success: false,
        error: 'FETCH_FAILED',
        availability,
        unified_score: 0,
        per_source_scores: {},
        sample_count: 0,
        message: String(err)
      };
    }
  }

  private async detectExtremes(args: any): Promise<any> {
    const availability = this.getAvailability();
    if (!availability.telegram && !availability.reddit) {
      return {
        success: false,
        error: 'TELEGRAM_DB_UNAVAILABLE',
        availability,
        extreme_events: []
      };
    }

    const timeRange = args.time_range || '24h';
    const threshold = Math.min(1, Math.max(0.1, parseFloat(args.threshold) || 0.8));

    try {
      const events: Array<{ timestamp: string; score: number; direction: 'fear' | 'greed' }> = [];
      let messages: Array<{ date: Date; score: number }> = [];

      if (this.semanticEngine && this.telegramPool) {
        await this.processRecentMessagesForSemantics(timeRange);
        const results = await this.semanticEngine.semanticSearch({
          query: 'crypto market sentiment',
          time_range: timeRange,
          sources: ['telegram', 'reddit'],
          limit: 500
        });
        messages = results
          .filter(m => m.semantic_score !== undefined && m.semantic_score !== null)
          .map(m => ({ date: new Date(m.date), score: m.semantic_score! }));
      } else {
        if (this.telegramPool) {
          const rows = await this.getRecentTelegramMessages(300);
          messages.push(...rows.map(r => ({
            date: new Date(r.date),
            score: this.lexiconScore(r.text || '')
          })));
        }
        if (this.redditPool) {
          const rows = await this.getRecentRedditPosts(200);
          messages.push(...rows.map(r => ({
            date: new Date(r.created_utc ? r.created_utc * 1000 : r.created_at),
            score: this.lexiconScore((r.title || '') + ' ' + (r.content || ''))
          })));
        }
      }

      for (const m of messages) {
        if (m.score >= threshold) {
          events.push({
            timestamp: m.date.toISOString(),
            score: m.score,
            direction: 'greed'
          });
        } else if (m.score <= -threshold) {
          events.push({
            timestamp: m.date.toISOString(),
            score: m.score,
            direction: 'fear'
          });
        }
      }

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        success: true,
        extreme_events: events.slice(0, 50),
        threshold,
        time_range: timeRange,
        availability
      };
    } catch (err) {
      return {
        success: false,
        error: 'FETCH_FAILED',
        availability,
        extreme_events: [],
        message: String(err)
      };
    }
  }

  private async queryByTopic(args: any): Promise<any> {
    const availability = this.getAvailability();
    const topic = (args.topic || '').toString().trim();
    if (!topic) {
      return {
        success: false,
        error: 'INVALID_TOPIC',
        availability,
        results: []
      };
    }

    if (!availability.telegram && !availability.reddit) {
      return {
        success: false,
        error: 'TELEGRAM_DB_UNAVAILABLE',
        availability,
        results: []
      };
    }

    const timeRange = args.time_range || '24h';
    const limit = Math.min(Math.max(parseInt(args.limit) || 50, 1), 200);

    try {
      if (this.semanticEngine && this.telegramPool) {
        await this.processRecentMessagesForSemantics(timeRange);
        const results = await this.semanticEngine.semanticSearch({
          query: topic,
          sentiment_filter: args.sentiment_filter,
          time_range: timeRange,
          sources: ['telegram', 'reddit'],
          limit
        });
        return {
          success: true,
          topic,
          time_range: timeRange,
          total_results: results.length,
          results: results.map(m => ({
            id: m.id,
            source: m.source,
            text: m.text?.substring(0, 300),
            date: m.date,
            sentiment_score: m.semantic_score
          })),
          availability
        };
      }

      const all: any[] = [];
      if (this.telegramPool) {
        const rows = await this.searchTelegramMessages(topic, limit);
        rows.forEach(r => all.push({
          id: r.id,
          source: 'telegram',
          text: (r.text || '').substring(0, 300),
          date: r.date,
          sentiment_score: this.lexiconScore(r.text || '')
        }));
      }
      if (this.redditPool) {
        const posts = await this.searchRedditPosts(topic, Math.ceil(limit / 2));
        const comments = await this.searchRedditComments(topic, Math.ceil(limit / 2));
        posts.forEach(p => all.push({
          id: p.id,
          source: 'reddit',
          text: ((p.title || '') + ' ' + (p.content || '')).substring(0, 300),
          date: new Date(p.created_utc * 1000),
          sentiment_score: this.lexiconScore((p.title || '') + ' ' + (p.content || ''))
        }));
        comments.forEach(c => all.push({
          id: c.id,
          source: 'reddit',
          text: (c.content || c.text || '').substring(0, 300),
          date: new Date(c.created_utc * 1000),
          sentiment_score: this.lexiconScore(c.content || c.text || '')
        }));
      }

      all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        success: true,
        topic,
        time_range: timeRange,
        total_results: all.length,
        results: all.slice(0, limit),
        availability
      };
    } catch (err) {
      return {
        success: false,
        error: 'FETCH_FAILED',
        availability,
        results: [],
        message: String(err)
      };
    }
  }

  private async getHistorical(_args: any): Promise<any> {
    return {
      success: true,
      message: 'Coming soon - sentiment_snapshots table not yet implemented',
      data: [],
      historical_scores: []
    };
  }

}
