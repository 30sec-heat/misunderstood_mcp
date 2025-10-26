import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import { TelegramModule } from '../telegram/index.js';
import { RedditModule } from '../reddit/index.js';
import { TelegramPostgresDatabase } from '../telegram/postgres-database.js';
import { RedditPostgresDatabase } from '../reddit/postgres-database.js';
import { SemanticSentimentEngine, SemanticSearchQuery, SemanticMessage } from './semantic-engine.js';
import { Pool } from 'pg';

export class SentimentModule extends BaseCryptoModule {
  name = 'sentiment';
  private telegramModule: TelegramModule | null = null;
  private redditModule: RedditModule | null = null;
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
      '6h': 6,
      '24h': 24,
      '7d': 168,
      '30d': 720
    };
    return timeMap[timeRange] || 24;
  }

}
