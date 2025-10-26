#!/usr/bin/env tsx

/**
 * Reddit Module Test Script
 * Tests all Reddit module functionality including database operations and tools
 */

import { RedditModule } from '../src/modules/reddit/index.js';
import { RedditPostgresDatabase } from '../src/modules/reddit/postgres-database.js';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
  data?: any;
}

class RedditModuleTester {
  private redditModule: RedditModule;
  private database: RedditPostgresDatabase;
  private results: TestResult[] = [];

  constructor() {
    this.redditModule = new RedditModule();
    this.database = new RedditPostgresDatabase();
  }

  async runAllTests(): Promise<void> {
    console.log('🔴 Starting Reddit Module Tests...\n');

    try {
      // Initialize database and module
      await this.testDatabaseInitialization();
      await this.testModuleInitialization();
      
      // Test database operations
      await this.testDatabaseSchema();
      await this.testPostStorage();
      await this.testCommentStorage();
      await this.testDataRetrieval();
      
      // Test module tools
      await this.testSearchPostsTool();
      await this.testGetTrendingTopicsTool();
      await this.testAnalyzeSentimentTool();
      await this.testGetHotPostsTool();
      await this.testGetPostCommentsTool();
      await this.testSearchCommentsTool();
      
      // Test error handling
      await this.testErrorHandling();
      
      // Test database stats
      await this.testDatabaseStats();
      
    } catch (error) {
      console.error('[ERROR] Test suite failed:', error);
    } finally {
      await this.cleanup();
      this.printResults();
    }
  }

  private async testDatabaseInitialization(): Promise<void> {
    const start = Date.now();
    try {
      await this.database.initialize();
      this.addResult('Database Initialization', 'PASS', 'Database initialized successfully', Date.now() - start);
    } catch (error) {
      this.addResult('Database Initialization', 'FAIL', `Failed to initialize database: ${error}`, Date.now() - start);
    }
  }

  private async testModuleInitialization(): Promise<void> {
    const start = Date.now();
    try {
      await this.redditModule.initialize();
      this.addResult('Module Initialization', 'PASS', 'Reddit module initialized successfully', Date.now() - start);
    } catch (error) {
      this.addResult('Module Initialization', 'FAIL', `Failed to initialize module: ${error}`, Date.now() - start);
    }
  }

  private async testDatabaseSchema(): Promise<void> {
    const start = Date.now();
    try {
      // Test if tables exist by querying them
      const postsQuery = 'SELECT COUNT(*) FROM reddit_posts';
      const commentsQuery = 'SELECT COUNT(*) FROM reddit_comments';
      
      await this.database.all(postsQuery);
      await this.database.all(commentsQuery);
      
      this.addResult('Database Schema', 'PASS', 'Tables created successfully', Date.now() - start);
    } catch (error) {
      this.addResult('Database Schema', 'FAIL', `Schema test failed: ${error}`, Date.now() - start);
    }
  }

  private async testPostStorage(): Promise<void> {
    const start = Date.now();
    try {
      const testPost = {
        id: 'test_post_123',
        title: 'Test Reddit Post',
        content: 'This is a test post content for testing purposes.',
        author: 'testuser',
        subreddit: 'CryptoCurrency',
        score: 100,
        upvote_ratio: 0.85,
        num_comments: 25,
        created_utc: Math.floor(Date.now() / 1000),
        url: 'https://reddit.com/r/CryptoCurrency/test',
        permalink: '/r/CryptoCurrency/comments/test_post_123/',
        flair: 'Discussion',
        is_self: true,
        domain: 'self.CryptoCurrency'
      };

      await this.database.upsertPost(testPost);
      
      // Verify the post was stored
      const posts = await this.database.searchPosts('Test Reddit Post', 'CryptoCurrency', '24h', 1);
      
      if (posts.length > 0 && posts[0].id === testPost.id) {
        this.addResult('Post Storage', 'PASS', 'Post stored and retrieved successfully', Date.now() - start, { postId: testPost.id });
      } else {
        this.addResult('Post Storage', 'FAIL', 'Post not found after storage', Date.now() - start);
      }
    } catch (error) {
      this.addResult('Post Storage', 'FAIL', `Post storage failed: ${error}`, Date.now() - start);
    }
  }

  private async testCommentStorage(): Promise<void> {
    const start = Date.now();
    try {
      const testComment = {
        id: 'test_comment_456',
        post_id: 'test_post_123',
        parent_id: 'test_post_123',
        author: 'commenter',
        content: 'This is a test comment for testing purposes.',
        score: 50,
        created_utc: Math.floor(Date.now() / 1000),
        permalink: '/r/CryptoCurrency/comments/test_post_123/test_comment_456/',
        depth: 0,
        is_submitter: false
      };

      await this.database.upsertComment(testComment);
      
      // Verify the comment was stored
      const comments = await this.database.getPostComments('test_post_123', 10);
      
      if (comments.length > 0 && comments.some(c => c.id === testComment.id)) {
        this.addResult('Comment Storage', 'PASS', 'Comment stored and retrieved successfully', Date.now() - start, { commentId: testComment.id });
      } else {
        this.addResult('Comment Storage', 'FAIL', 'Comment not found after storage', Date.now() - start);
      }
    } catch (error) {
      this.addResult('Comment Storage', 'FAIL', `Comment storage failed: ${error}`, Date.now() - start);
    }
  }

  private async testDataRetrieval(): Promise<void> {
    const start = Date.now();
    try {
      // Test various retrieval methods
      const hotPosts = await this.database.getHotPosts('CryptoCurrency', 5);
      const trendingTopics = await this.database.getTrendingTopics('CryptoCurrency', '24h', 5);
      const searchResults = await this.database.searchPosts('test', 'CryptoCurrency', '24h', 5);
      const commentSearch = await this.database.searchComments('test', 'CryptoCurrency', '24h', 5);
      
      this.addResult('Data Retrieval', 'PASS', 'All retrieval methods working', Date.now() - start, {
        hotPosts: hotPosts.length,
        trendingTopics: trendingTopics.length,
        searchResults: searchResults.length,
        commentSearch: commentSearch.length
      });
    } catch (error) {
      this.addResult('Data Retrieval', 'FAIL', `Data retrieval failed: ${error}`, Date.now() - start);
    }
  }

  private async testSearchPostsTool(): Promise<void> {
    const start = Date.now();
    try {
      const result = await this.redditModule.searchPosts({
        query: 'test',
        subreddit: 'CryptoCurrency',
        timeRange: '24h',
        limit: 5
      });

      if (result.posts && Array.isArray(result.posts)) {
        this.addResult('Search Posts Tool', 'PASS', `Found ${result.posts.length} posts`, Date.now() - start, result);
      } else {
        this.addResult('Search Posts Tool', 'FAIL', 'Invalid response format', Date.now() - start);
      }
    } catch (error) {
      this.addResult('Search Posts Tool', 'FAIL', `Tool failed: ${error}`, Date.now() - start);
    }
  }

  private async testGetTrendingTopicsTool(): Promise<void> {
    const start = Date.now();
    try {
      const result = await this.redditModule.getTrendingTopics({
        subreddit: 'CryptoCurrency',
        timeRange: '24h',
        limit: 10
      });

      if (result.topics && Array.isArray(result.topics)) {
        this.addResult('Get Trending Topics Tool', 'PASS', `Found ${result.topics.length} topics`, Date.now() - start, result);
      } else {
        this.addResult('Get Trending Topics Tool', 'FAIL', 'Invalid response format', Date.now() - start);
      }
    } catch (error) {
      this.addResult('Get Trending Topics Tool', 'FAIL', `Tool failed: ${error}`, Date.now() - start);
    }
  }

  private async testAnalyzeSentimentTool(): Promise<void> {
    const start = Date.now();
    try {
      const result = await this.redditModule.analyzeSentiment({
        topic: 'Bitcoin',
        subreddit: 'CryptoCurrency',
        timeRange: '24h',
        limit: 50
      });

      if (result.topic && typeof result.sentiment === 'string') {
        this.addResult('Analyze Sentiment Tool', 'PASS', `Sentiment: ${result.sentiment}`, Date.now() - start, result);
      } else {
        this.addResult('Analyze Sentiment Tool', 'FAIL', 'Invalid response format', Date.now() - start);
      }
    } catch (error) {
      this.addResult('Analyze Sentiment Tool', 'FAIL', `Tool failed: ${error}`, Date.now() - start);
    }
  }

  private async testGetHotPostsTool(): Promise<void> {
    const start = Date.now();
    try {
      const result = await this.redditModule.getHotPosts({
        subreddit: 'CryptoCurrency',
        limit: 10
      });

      if (result.posts && Array.isArray(result.posts)) {
        this.addResult('Get Hot Posts Tool', 'PASS', `Retrieved ${result.posts.length} hot posts`, Date.now() - start, result);
      } else {
        this.addResult('Get Hot Posts Tool', 'FAIL', 'Invalid response format', Date.now() - start);
      }
    } catch (error) {
      this.addResult('Get Hot Posts Tool', 'FAIL', `Tool failed: ${error}`, Date.now() - start);
    }
  }

  private async testGetPostCommentsTool(): Promise<void> {
    const start = Date.now();
    try {
      const result = await this.redditModule.getPostComments({
        postId: 'test_post_123',
        limit: 10
      });

      if (result.comments && Array.isArray(result.comments)) {
        this.addResult('Get Post Comments Tool', 'PASS', `Retrieved ${result.comments.length} comments`, Date.now() - start, result);
      } else {
        this.addResult('Get Post Comments Tool', 'FAIL', 'Invalid response format', Date.now() - start);
      }
    } catch (error) {
      this.addResult('Get Post Comments Tool', 'FAIL', `Tool failed: ${error}`, Date.now() - start);
    }
  }

  private async testSearchCommentsTool(): Promise<void> {
    const start = Date.now();
    try {
      const result = await this.redditModule.searchComments({
        query: 'test',
        subreddit: 'CryptoCurrency',
        timeRange: '24h',
        limit: 5
      });

      if (result.comments && Array.isArray(result.comments)) {
        this.addResult('Search Comments Tool', 'PASS', `Found ${result.comments.length} comments`, Date.now() - start, result);
      } else {
        this.addResult('Search Comments Tool', 'FAIL', 'Invalid response format', Date.now() - start);
      }
    } catch (error) {
      this.addResult('Search Comments Tool', 'FAIL', `Tool failed: ${error}`, Date.now() - start);
    }
  }

  private async testErrorHandling(): Promise<void> {
    const start = Date.now();
    try {
      // Test with invalid parameters
      const result = await this.redditModule.searchPosts({
        query: '',
        subreddit: 'InvalidSubreddit',
        timeRange: 'invalid',
        limit: -1
      });

      // Should handle gracefully
      if (result.posts && Array.isArray(result.posts)) {
        this.addResult('Error Handling', 'PASS', 'Handled invalid parameters gracefully', Date.now() - start);
      } else {
        this.addResult('Error Handling', 'FAIL', 'Did not handle invalid parameters properly', Date.now() - start);
      }
    } catch (error) {
      this.addResult('Error Handling', 'FAIL', `Error handling failed: ${error}`, Date.now() - start);
    }
  }

  private async testDatabaseStats(): Promise<void> {
    const start = Date.now();
    try {
      const stats = await this.database.getStats();
      
      if (typeof stats.totalPosts === 'number' && typeof stats.totalComments === 'number') {
        this.addResult('Database Stats', 'PASS', `Posts: ${stats.totalPosts}, Comments: ${stats.totalComments}`, Date.now() - start, stats);
      } else {
        this.addResult('Database Stats', 'FAIL', 'Invalid stats format', Date.now() - start);
      }
    } catch (error) {
      this.addResult('Database Stats', 'FAIL', `Stats retrieval failed: ${error}`, Date.now() - start);
    }
  }

  private addResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, duration?: number, data?: any): void {
    this.results.push({ test, status, message, duration, data });
    
    const statusIcon = status === 'PASS' ? 'SUCCESS:' : status === 'FAIL' ? 'ERROR:' : '⏭';
    const durationStr = duration ? ` (${duration}ms)` : '';
    console.log(`${statusIcon} ${test}: ${message}${durationStr}`);
  }

  private printResults(): void {
    console.log('\n🔴 Reddit Module Test Results Summary:');
    console.log('=====================================');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`[SUCCESS] Passed: ${passed}`);
    console.log(`[ERROR] Failed: ${failed}`);
    console.log(`⏭ Skipped: ${skipped}`);
    
    if (failed > 0) {
      console.log('\n[ERROR] Failed Tests:');
      this.results.filter(r => r.status === 'FAIL').forEach(result => {
        console.log(`  - ${result.test}: ${result.message}`);
      });
    }
    
    console.log('\n[DATA] Available Reddit Tools:');
    console.log('========================');
    console.log('1. reddit_search_posts - Search posts across monitored subreddits');
    console.log('2. reddit_get_trending_topics - Get trending topics from posts');
    console.log('3. reddit_analyze_sentiment - Analyze sentiment for specific topics');
    console.log('4. reddit_get_hot_posts - Get hot posts from monitored subreddits');
    console.log('5. reddit_get_post_comments - Get comments for a specific post');
    console.log('6. reddit_search_comments - Search comments for specific topics');
    
    console.log('\n[DB] Database Schema:');
    console.log('===================');
    console.log('Tables: reddit_posts, reddit_comments');
    console.log('Indexes: subreddit, created_utc, title, content');
    console.log('Features: UPSERT operations, foreign key relationships');
  }

  private async cleanup(): Promise<void> {
    try {
      // Clean up test data
      await this.database.run('DELETE FROM reddit_comments WHERE id LIKE $1', ['test_%']);
      await this.database.run('DELETE FROM reddit_posts WHERE id LIKE $1', ['test_%']);
      
      await this.redditModule.destroy();
      await this.database.close();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

// Run the tests
async function main() {
  const tester = new RedditModuleTester();
  await tester.runAllTests();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { RedditModuleTester };
