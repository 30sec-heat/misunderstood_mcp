import { Pool } from 'pg';
import { PostgresManager } from '../base/postgres-manager.js';

export interface RedditPost {
  id: string;
  title: string;
  content: string;
  author: string;
  subreddit: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  url: string;
  permalink: string;
  flair: string;
  is_self: boolean;
  domain: string;
  created_at: Date;
  updated_at: Date;
}

export interface RedditComment {
  id: string;
  post_id: string;
  parent_id: string;
  author: string;
  content: string;
  score: number;
  created_utc: number;
  permalink: string;
  depth: number;
  is_submitter: boolean;
  created_at: Date;
}

export class RedditPostgresDatabase {
  private postgresManager: PostgresManager;
  private pool: Pool | null = null;

  constructor() {
    this.postgresManager = PostgresManager.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      // Register the database
      this.postgresManager.registerDatabase({
        name: 'reddit',
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DATABASE || 'mcpcrypto',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
      });

      // Get the pool
      this.pool = await this.postgresManager.getPool('reddit');

      // Create tables
      await this.createTables();
      console.log('[SUCCESS] Reddit PostgreSQL database initialized');
    } catch (error) {
      console.error('[ERROR] Failed to initialize Reddit PostgreSQL database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const createPostsTable = `
      CREATE TABLE IF NOT EXISTS reddit_posts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        author TEXT,
        subreddit TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        upvote_ratio REAL DEFAULT 0,
        num_comments INTEGER DEFAULT 0,
        created_utc INTEGER NOT NULL,
        url TEXT,
        permalink TEXT,
        flair TEXT,
        is_self BOOLEAN DEFAULT FALSE,
        domain TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createCommentsTable = `
      CREATE TABLE IF NOT EXISTS reddit_comments (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        parent_id TEXT,
        author TEXT,
        content TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        created_utc INTEGER NOT NULL,
        permalink TEXT,
        depth INTEGER DEFAULT 0,
        is_submitter BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES reddit_posts (id)
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_reddit_posts_subreddit ON reddit_posts(subreddit);
      CREATE INDEX IF NOT EXISTS idx_reddit_posts_created_utc ON reddit_posts(created_utc);
      CREATE INDEX IF NOT EXISTS idx_reddit_posts_title ON reddit_posts(title);
      CREATE INDEX IF NOT EXISTS idx_reddit_comments_post_id ON reddit_comments(post_id);
      CREATE INDEX IF NOT EXISTS idx_reddit_comments_created_utc ON reddit_comments(created_utc);
      CREATE INDEX IF NOT EXISTS idx_reddit_comments_content ON reddit_comments(content);
    `;

    await this.pool.query(createPostsTable);
    await this.pool.query(createCommentsTable);
    await this.pool.query(createIndexes);
  }

  async upsertPost(post: Omit<RedditPost, 'created_at' | 'updated_at'>): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO reddit_posts (
        id, title, content, author, subreddit, score, upvote_ratio, num_comments,
        created_utc, url, permalink, flair, is_self, domain, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        author = EXCLUDED.author,
        score = EXCLUDED.score,
        upvote_ratio = EXCLUDED.upvote_ratio,
        num_comments = EXCLUDED.num_comments,
        url = EXCLUDED.url,
        permalink = EXCLUDED.permalink,
        flair = EXCLUDED.flair,
        is_self = EXCLUDED.is_self,
        domain = EXCLUDED.domain,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.pool.query(query, [
      post.id,
      post.title,
      post.content,
      post.author,
      post.subreddit,
      post.score,
      post.upvote_ratio,
      post.num_comments,
      post.created_utc,
      post.url,
      post.permalink,
      post.flair,
      post.is_self,
      post.domain
    ]);
  }

  async upsertComment(comment: Omit<RedditComment, 'created_at'>): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO reddit_comments (
        id, post_id, parent_id, author, content, score, created_utc,
        permalink, depth, is_submitter
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        score = EXCLUDED.score,
        permalink = EXCLUDED.permalink,
        depth = EXCLUDED.depth,
        is_submitter = EXCLUDED.is_submitter
    `;

    await this.pool.query(query, [
      comment.id,
      comment.post_id,
      comment.parent_id,
      comment.author,
      comment.content,
      comment.score,
      comment.created_utc,
      comment.permalink,
      comment.depth,
      comment.is_submitter
    ]);
  }

  async searchPosts(query: string, subreddit?: string, timeRange?: string, limit: number = 50): Promise<RedditPost[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let sql = `
      SELECT * FROM reddit_posts 
      WHERE (title ILIKE $1 OR content ILIKE $1)
    `;
    const params: any[] = [`%${query}%`];

    if (timeRange) {
      const timeThreshold = this.getTimeRangeSeconds(timeRange);
      sql += ` AND created_utc > $${params.length + 1}`;
      params.push(timeThreshold);
    }

    if (subreddit && subreddit !== 'all') {
      sql += ` AND subreddit = $${params.length + 1}`;
      params.push(subreddit);
    }

    sql += ` ORDER BY score DESC, created_utc DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async getTrendingTopics(subreddit?: string, timeRange?: string, limit: number = 20): Promise<Array<{ topic: string; count: number }>> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let sql = `SELECT title FROM reddit_posts WHERE 1=1`;
    const params: any[] = [];

    if (timeRange) {
      const timeThreshold = this.getTimeRangeSeconds(timeRange);
      sql += ` AND created_utc > $${params.length + 1}`;
      params.push(timeThreshold);
    }

    if (subreddit && subreddit !== 'all') {
      sql += ` AND subreddit = $${params.length + 1}`;
      params.push(subreddit);
    }

    sql += ` ORDER BY score DESC LIMIT 1000`;

    const result = await this.pool.query(sql, params);
    
    // Extract trending topics (simple keyword extraction)
    const topicCounts = new Map<string, number>();
    result.rows.forEach((post: any) => {
      const words = post.title.toLowerCase().split(/\s+/);
      words.forEach((word: string) => {
        // Filter for potential crypto/trading topics
        if (word.length > 3 &&
            !word.includes('http') &&
            !word.includes('www') &&
            !word.includes('@') &&
            /^[a-zA-Z0-9$]+$/.test(word)) {
          topicCounts.set(word, (topicCounts.get(word) || 0) + 1);
        }
      });
    });
    
    // Sort by frequency and return top topics
    return Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([topic, count]) => ({ topic, count }));
  }

  async getHotPosts(subreddit?: string, limit: number = 25): Promise<RedditPost[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let sql = `SELECT * FROM reddit_posts WHERE 1=1`;
    const params: any[] = [];

    if (subreddit && subreddit !== 'all') {
      sql += ` AND subreddit = $${params.length + 1}`;
      params.push(subreddit);
    }

    sql += ` ORDER BY score DESC, created_utc DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async getRecentPosts(limit: number = 25, subreddit?: string): Promise<RedditPost[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let sql = `SELECT * FROM reddit_posts WHERE 1=1`;
    const params: any[] = [];

    if (subreddit && subreddit !== 'all') {
      sql += ` AND subreddit = $${params.length + 1}`;
      params.push(subreddit);
    }

    sql += ` ORDER BY created_utc DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async getPostComments(postId: string, limit: number = 100): Promise<RedditComment[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      SELECT * FROM reddit_comments 
      WHERE post_id = $1 
      ORDER BY score DESC, created_utc DESC 
      LIMIT $2
    `;

    const result = await this.pool.query(query, [postId, limit]);
    return result.rows;
  }

  async searchComments(query: string, subreddit?: string, timeRange?: string, limit: number = 50): Promise<RedditComment[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let sql = `
      SELECT c.*, p.subreddit 
      FROM reddit_comments c
      JOIN reddit_posts p ON c.post_id = p.id
      WHERE c.content ILIKE $1
    `;
    const params: any[] = [`%${query}%`];

    if (timeRange) {
      const timeThreshold = this.getTimeRangeSeconds(timeRange);
      sql += ` AND c.created_utc > $${params.length + 1}`;
      params.push(timeThreshold);
    }

    if (subreddit && subreddit !== 'all') {
      sql += ` AND p.subreddit = $${params.length + 1}`;
      params.push(subreddit);
    }

    sql += ` ORDER BY c.score DESC, c.created_utc DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async getLatestPostTime(subreddit: string): Promise<number> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `SELECT MAX(created_utc) as latest_time FROM reddit_posts WHERE subreddit = $1`;
    const result = await this.pool.query(query, [subreddit]);
    return result.rows[0]?.latest_time || 0;
  }

  private getTimeRangeMs(timeRange: string): number {
    const now = Date.now();
    switch (timeRange) {
      case '1h': return now - (60 * 60 * 1000);
      case '6h': return now - (6 * 60 * 60 * 1000);
      case '24h': return now - (24 * 60 * 60 * 1000);
      case '7d': return now - (7 * 24 * 60 * 60 * 1000);
      case '30d': return now - (30 * 24 * 60 * 60 * 1000);
      default: return now - (24 * 60 * 60 * 1000);
    }
  }

  private getTimeRangeSeconds(timeRange: string): number {
    const now = Math.floor(Date.now() / 1000);
    switch (timeRange) {
      case '1h': return now - (60 * 60);
      case '6h': return now - (6 * 60 * 60);
      case '24h': return now - (24 * 60 * 60);
      case '7d': return now - (7 * 24 * 60 * 60);
      case '30d': return now - (30 * 24 * 60 * 60);
      default: return now - (24 * 60 * 60);
    }
  }

  async getStats(): Promise<{
    totalPosts: number;
    totalComments: number;
    lastUpdate: string;
  }> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const postsResult = await this.pool.query('SELECT COUNT(*) as count FROM reddit_posts');
    const commentsResult = await this.pool.query('SELECT COUNT(*) as count FROM reddit_comments');
    const lastUpdateResult = await this.pool.query('SELECT MAX(updated_at) as last_update FROM reddit_posts');

    return {
      totalPosts: parseInt(postsResult.rows[0].count),
      totalComments: parseInt(commentsResult.rows[0].count),
      lastUpdate: lastUpdateResult.rows[0].last_update || new Date().toISOString()
    };
  }

  // Direct query methods for better performance
  async query(sql: string, params: any[] = []): Promise<any> {
    if (!this.pool) throw new Error('Database pool not initialized');
    return await this.pool.query(sql, params);
  }

  async run(sql: string, params: any[] = []): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');
    await this.pool.query(sql, params);
  }

  async get(sql: string, params: any[] = []): Promise<any> {
    if (!this.pool) throw new Error('Database pool not initialized');
    const result = await this.pool.query(sql, params);
    return result.rows[0] || null;
  }

  async all(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.pool) throw new Error('Database pool not initialized');
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  // Legacy compatibility - use query() method instead

  async close(): Promise<void> {
    // PostgreSQL connections are managed by the pool, no need to close
  }
}
