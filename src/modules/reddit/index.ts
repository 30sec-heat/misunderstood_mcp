import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import { RedditPostgresDatabase, RedditPost, RedditComment } from './postgres-database.js';
import axios from 'axios';

// Interfaces are now imported from postgres-database.ts

interface RedditSearchOptions {
  timeRange?: string;
  subreddit?: string;
  keywords?: string[];
}

export class RedditModule extends BaseCryptoModule {
  name = 'reddit';
  
  private database: RedditPostgresDatabase | null = null;
  private lastSyncTime: number = 0;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private readonly SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
  private readonly RATE_LIMIT_QPM = 100; // 100 queries per minute
  private requestCount = 0;
  private rateLimitResetTime = Date.now() + 60000; // 1 minute
  private readonly MONITORED_SUBREDDITS = ['CryptoCurrency', 'wallstreetbets', 'Bitcoin', 'ethereum', 'solana', 'CryptoMoonShots'];
  private isSyncing = false; // Flag to prevent concurrent sync operations

  protected setupTools() {
    // No tools exposed - this module only provides backend data collection
    // All search and sentiment functionality is now handled by the sentiment module
  }

  constructor() {
    super();
    
    // Initialize database immediately so other modules can use it
    this.database = new RedditPostgresDatabase();
    this.database.initialize().catch(error => {
      console.warn('Reddit database initialization failed:', error.message);
    });
    
    // Set up tools after properties are initialized
    this.setupTools();
  }

  private async initializeDatabase() {
    // Database is already initialized in constructor
    if (!this.database) {
      this.database = new RedditPostgresDatabase();
      await this.database.initialize();
    }
  }

  async initialize(): Promise<void> {
    this.setupTools();
    await this.initializeDatabase();
    await this.startBackgroundSync();
  }

  private async startBackgroundSync(): Promise<void> {
    // Initial sync
    await this.syncSubreddits();
    
    // Set up periodic sync
    this.syncInterval = setInterval(async () => {
      await this.syncSubreddits();
    }, this.SYNC_INTERVAL_MS);
  }

  private async syncSubreddits(): Promise<void> {
    if (!this.database) return;
    
    // Prevent concurrent sync operations
    if (this.isSyncing) {
      console.log('🔴 Reddit sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;
    try {
      console.log('🔴 Syncing Reddit data...');
      
      for (const subreddit of this.MONITORED_SUBREDDITS) {
        await this.syncSubreddit(subreddit);
        // Respect rate limits
        await this.respectRateLimit();
      }
      
      this.lastSyncTime = Date.now();
      console.log(`🔴 Reddit: Sync completed. Monitored subreddits: ${this.MONITORED_SUBREDDITS.join(', ')}`);
    } catch (error) {
      console.error('Failed to sync Reddit data:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncSubreddit(subreddit: string): Promise<void> {
    try {
      // Get the most recent post timestamp from database to avoid fetching old posts
      const latestTime = this.database ? await this.database.getLatestPostTime(subreddit) : 0;
      
      // Only fetch posts newer than our latest stored post (with 1 hour buffer)
      const cutoffTime = latestTime - (60 * 60); // 1 hour buffer
      
      // Get hot posts (most relevant for trending topics)
      const hotPosts = await this.fetchRedditData(`/r/${subreddit}/hot.json?limit=25`);
      if (hotPosts?.data?.children) {
        const filteredHotPosts = hotPosts.data.children
          .map((item: any) => item.data)
          .filter((post: any) => post.created_utc > cutoffTime);
        if (filteredHotPosts.length > 0) {
          await this.storePosts(filteredHotPosts);
        }
      }

      // Get new posts (for fresh content)
      const newPosts = await this.fetchRedditData(`/r/${subreddit}/new.json?limit=25`);
      if (newPosts?.data?.children) {
        const filteredNewPosts = newPosts.data.children
          .map((item: any) => item.data)
          .filter((post: any) => post.created_utc > cutoffTime);
        if (filteredNewPosts.length > 0) {
          await this.storePosts(filteredNewPosts);
        }
      }

      // Get top posts from today (for high-engagement content)
      const topPosts = await this.fetchRedditData(`/r/${subreddit}/top.json?limit=25&t=day`);
      if (topPosts?.data?.children) {
        const filteredTopPosts = topPosts.data.children
          .map((item: any) => item.data)
          .filter((post: any) => post.created_utc > cutoffTime);
        if (filteredTopPosts.length > 0) {
          await this.storePosts(filteredTopPosts);
        }
      }

    } catch (error) {
      console.error(`Failed to sync subreddit ${subreddit}:`, error);
    }
  }

  private async fetchRedditData(endpoint: string, retries: number = 3): Promise<any> {
    const url = `https://www.reddit.com${endpoint}`;
    
    try {
      await this.respectRateLimit();
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'CryptoSentimentBot/1.0 by YourUsername'
        },
        timeout: 10000
      });
      
      this.requestCount++;
      return response.data;
    } catch (error: any) {
      if (retries > 0 && (error.code === 'ECONNRESET' || error.response?.status >= 500)) {
        console.warn(`Reddit API error, retrying... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.fetchRedditData(endpoint, retries - 1);
      }
      
      console.error(`Failed to fetch Reddit data from ${url}:`, error.message);
      return null;
    }
  }

  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter every minute
    if (now > this.rateLimitResetTime) {
      this.requestCount = 0;
      this.rateLimitResetTime = now + 60000;
    }
    
    // If we're approaching the rate limit, wait
    if (this.requestCount >= this.RATE_LIMIT_QPM - 5) {
      const waitTime = this.rateLimitResetTime - now;
      if (waitTime > 0) {
        console.log(`🔴 Reddit: Rate limit approaching, waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.rateLimitResetTime = Date.now() + 60000;
      }
    }
  }

  private async storePosts(posts: any[]): Promise<void> {
    if (!this.database || posts.length === 0) return;

    for (const post of posts) {
      try {
        const redditPost: RedditPost = {
          id: post.id,
          title: post.title,
          content: post.selftext || null,
          author: post.author,
          subreddit: post.subreddit,
          score: post.score,
          upvote_ratio: post.upvote_ratio,
          num_comments: post.num_comments,
          created_utc: post.created_utc,
          url: post.url,
          permalink: post.permalink,
          flair: post.link_flair_text,
          is_self: post.is_self,
          domain: post.domain,
          created_at: new Date(),
          updated_at: new Date()
        };

        await this.database.upsertPost(redditPost);

        // Fetch and store top comments for posts with high engagement
        if (post.num_comments > 10 && post.score > 50) {
          await this.fetchAndStoreComments(post.id, post.subreddit);
        }
      } catch (error) {
        console.error(`Failed to store Reddit post ${post.id}:`, error);
      }
    }
  }

  private async fetchAndStoreComments(postId: string, subreddit: string): Promise<void> {
    try {
      const commentsData = await this.fetchRedditData(`/r/${subreddit}/comments/${postId}.json?limit=50`);
      if (commentsData && commentsData.length > 1) {
        const comments = this.extractComments(commentsData[1].data.children, postId);
        await this.storeComments(comments);
      }
    } catch (error) {
      console.error(`Failed to fetch comments for post ${postId}:`, error);
    }
  }

  private extractComments(commentChildren: any[], postId: string, depth: number = 0): RedditComment[] {
    const comments: RedditComment[] = [];
    
    for (const child of commentChildren) {
      if (child.kind === 't1' && child.data) {
        const comment = child.data;
        
        comments.push({
          id: comment.id,
          post_id: postId,
          author: comment.author,
          content: comment.body,
          score: comment.score,
          created_utc: comment.created_utc,
          parent_id: comment.parent_id,
          permalink: comment.permalink || '',
          depth: depth,
          is_submitter: comment.is_submitter,
          created_at: new Date()
        });

        // Recursively extract replies (limit depth to avoid infinite recursion)
        if (comment.replies && comment.replies.data && comment.replies.data.children && depth < 3) {
          comments.push(...this.extractComments(comment.replies.data.children, postId, depth + 1));
        }
      }
    }
    
    return comments;
  }

  private async storeComments(comments: RedditComment[]): Promise<void> {
    if (!this.database || comments.length === 0) return;

    for (const comment of comments) {
      try {
        await this.database.upsertComment(comment);
      } catch (error) {
        console.error(`Failed to store Reddit comment ${comment.id}:`, error);
      }
    }
  }

  // Database access methods for other modules (like sentiment module)
  public getRedditDatabase(): RedditPostgresDatabase | null {
    return this.database;
  }

  // Cleanup method
  async destroy(): Promise<void> {
    console.log('🔴 RedditModule: Cleaning up...');
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Wait for any ongoing sync to complete
    if (this.isSyncing) {
      console.log('🔴 RedditModule: Waiting for sync to complete...');
      while (this.isSyncing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    if (this.database) {
      await this.database.close();
      this.database = null;
    }
    
    console.log('🔴 RedditModule: Cleanup completed');
  }
}