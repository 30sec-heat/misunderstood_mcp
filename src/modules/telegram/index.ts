import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import { TelegramPostgresDatabase, TelegramMessage as DbTelegramMessage } from './postgres-database.js';
import { SemanticSentimentEngine, SemanticSearchQuery } from '../sentiment/semantic-engine.js';
import OpenAI from 'openai';
import * as path from 'path';
import * as fs from 'fs';

interface TelegramMessage {
  id: number;
  chat_id: string;
  chat_title: string;
  user_id: string;
  username: string;
  message_text: string;
  sanitized_text: string;
  timestamp: string;
  message_type: string;
  reply_to?: number;
  forwarded_from?: string;
}

interface TelegramChat {
  id: string;
  title: string;
  type: string;
  member_count?: number;
  last_message_time?: string;
  active: boolean;
}

interface TelegramSearchOptions {
  timeRange?: string;
  limit?: number;
  chatId?: string;
  keywords?: string[];
}

export class TelegramModule extends BaseCryptoModule {
  name = 'telegram';

  private client: TelegramClient | null = null;
  private database: TelegramPostgresDatabase | null = null;
  private telegramConnected = false;
  private lastSyncTime: number = 0;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private readonly SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private openai: OpenAI | null = null;
  private semanticEngine: SemanticSentimentEngine | null = null;

  protected setupTools() {
    this.addTool({
      name: 'telegram_search_messages',
      description: 'Search for messages across all Telegram chats using single word searches',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Single word or multiple words to search for (uses word boundary matching)'
          },
          timeRange: {
            type: 'string',
            description: 'Time range for search',
            enum: ['1h', '6h', '24h', '7d', '30d'],
            default: '24h'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results',
            default: 50
          },
          chatId: {
            type: 'string',
            description: 'Specific chat ID to search in (optional)'
          }
        },
        required: ['query']
      },
      handler: this.searchMessages.bind(this)
    });


    this.addTool({
      name: 'telegram_search_token_mentions',
      description: 'Search for messages containing specific token symbols',
      inputSchema: {
        type: 'object',
        properties: {
          tokenSymbol: {
            type: 'string',
            description: 'Token symbol to search for (e.g., BTC, ETH, SOL)'
          },
          timeRange: {
            type: 'string',
            description: 'Time range for search',
            enum: ['1h', '6h', '24h', '7d', '30d'],
            default: '24h'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results',
            default: 50
          }
        },
        required: ['tokenSymbol']
      },
      handler: this.searchTokenMentions.bind(this)
    });

    this.addTool({
      name: 'telegram_get_trending_topics',
      description: 'Get trending topics from Telegram chats',
      inputSchema: {
        type: 'object',
        properties: {
          timeRange: {
            type: 'string',
            description: 'Time range for analysis',
            enum: ['1h', '6h', '24h', '7d'],
            default: '1d'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of topics to return',
            default: 20
          }
        }
      },
      handler: this.getTrendingTopics.bind(this)
    });

    this.addTool({
      name: 'telegram_summarize_chat_messages',
      description: 'Summarize the last N messages from a Telegram chat. Use timeRange for last 1h or 24h, or limit for by count.',
      inputSchema: {
        type: 'object',
        properties: {
          chatIdOrUsername: {
            type: 'string',
            description: 'Chat ID (numeric) or chat title/username to match'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of messages to summarize',
            default: 50
          },
          timeRange: {
            type: 'string',
            description: 'Optional: fetch messages from this time window instead of by count',
            enum: ['1h', '24h']
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum tokens for the summary output',
            default: 500
          }
        },
        required: ['chatIdOrUsername']
      },
      handler: this.summarizeChatMessages.bind(this)
    });

    this.addTool({
      name: 'telegram_search_messages_by_subject',
      description: 'Search messages by subject/topic. Uses semantic search if embeddings available, otherwise keyword + recency.',
      inputSchema: {
        type: 'object',
        properties: {
          subject: {
            type: 'string',
            description: 'Subject or topic to search for (e.g. "what happened in Iran last 24 hrs")'
          },
          timeRange: {
            type: 'string',
            description: 'Time range for search',
            enum: ['1h', '24h', '7d'],
            default: '24h'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of messages to return',
            default: 50
          },
          chatId: {
            type: 'string',
            description: 'Optional chat ID or title to filter'
          },
          includeSummary: {
            type: 'boolean',
            description: 'Include AI summary of findings (requires OPENAI_API_KEY)',
            default: true
          }
        },
        required: ['subject']
      },
      handler: this.searchMessagesBySubject.bind(this)
    });

    this.addTool({
      name: 'telegram_summarize_recent_by_topic',
      description: 'Search for a topic in recent messages and summarize matching results.',
      inputSchema: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Topic to search for and summarize'
          },
          hours: {
            type: 'number',
            description: 'Number of hours to look back',
            default: 24
          },
          chatIds: {
            type: 'array',
            description: 'Optional list of chat IDs or titles to restrict search',
            items: { type: 'string' }
          }
        },
        required: ['topic']
      },
      handler: this.summarizeRecentByTopic.bind(this)
    });
  }

  constructor() {
    super();

    // Initialize database immediately so tools can use it
    this.database = new TelegramPostgresDatabase();
    this.database.initialize().catch(error => {
      console.warn('Telegram database initialization failed:', error.message);
    });

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  private async ensureSemanticEngine(): Promise<SemanticSentimentEngine | null> {
    if (this.semanticEngine) return this.semanticEngine;
    if (!process.env.OPENAI_API_KEY) return null;
    try {
      const pool = await this.postgresManager.getPool('telegram');
      this.semanticEngine = new SemanticSentimentEngine(pool, process.env.OPENAI_API_KEY);
      await this.semanticEngine.initialize();
      return this.semanticEngine;
    } catch (error) {
      console.warn('Semantic engine initialization failed:', (error as Error).message);
      return null;
    }
  }

  private parseTimeRangeToHours(timeRange: string): number {
    const map: Record<string, number> = {
      '1h': 1,
      '6h': 6,
      '24h': 24,
      '7d': 168,
      '30d': 720
    };
    return map[timeRange] ?? 24;
  }

  private async summarizeWithOpenAI(
    messages: Array<{ text: string; username?: string; date?: Date }>,
    options: { maxTokens?: number; systemPrompt?: string } = {}
  ): Promise<string> {
    if (!this.openai || messages.length === 0) {
      return 'OPENAI_API_KEY is required for summarization. Set it in your environment.';
    }
    const textBlock = messages
      .slice(0, 100)
      .map(m => {
        const date = m.date instanceof Date ? m.date.toISOString() : m.date;
        return `[${m.username || 'unknown'} @ ${date}]: ${(m.text || '').substring(0, 500)}`;
      })
      .join('\n');
    const systemPrompt =
      options.systemPrompt ||
      'Summarize the following Telegram chat messages concisely. Highlight key points, themes, and notable opinions.';
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: textBlock }
        ],
        max_tokens: options.maxTokens ?? 500,
        temperature: 0.3
      });
      return response.choices[0]?.message?.content?.trim() || 'No summary generated.';
    } catch (error) {
      return `Summarization failed: ${(error as Error).message}`;
    }
  }

  private async initializeDatabase() {
    try {
      // Database is already initialized in constructor
      if (!this.database) {
        this.database = new TelegramPostgresDatabase();
        await this.database.initialize();
      }
      
      // Tables are now created in PostgresManager
      console.log('Telegram database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Telegram database:', error);
    }
  }

  async initialize(): Promise<void> {
    this.setupTools();
    await this.initializeDatabase();
    await this.connectToTelegram();
    if (this.isConnected()) {
      await this.startBackgroundSync();
    }
  }

  private async connectToTelegram(): Promise<void> {
    try {
      // Try to load session from .session file first
      const sessionPath = path.join(process.cwd(), '.session');
      let sessionString: string | undefined;
      
      if (fs.existsSync(sessionPath)) {
        sessionString = fs.readFileSync(sessionPath, 'utf8');
        console.log('📁 Loaded Telegram session from .session file');
      } else {
        // Fallback to environment variable
        sessionString = process.env.TELEGRAM_SESSION_STRING;
        if (sessionString) {
          console.log('📁 Loaded Telegram session from environment variable');
        }
      }

      const apiId = process.env.TELEGRAM_API_ID;
      const apiHash = process.env.TELEGRAM_API_HASH;

      if (!sessionString || !apiId || !apiHash) {
        console.log('⚠️ Telegram credentials not found. Run "npm run auth" to authenticate or set TELEGRAM_SESSION_STRING, TELEGRAM_API_ID, and TELEGRAM_API_HASH environment variables.');
        this.telegramConnected = false;
        this.client = null;
        return;
      }

      const stringSession = new StringSession(sessionString);
      this.client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
        connectionRetries: 5,
        timeout: 10000,
      });

      // Add timeout to prevent hanging
      const connectPromise = this.client.start({
        phoneNumber: async () => {
          throw new Error('Phone number not needed for existing session');
        },
        password: async () => {
          throw new Error('Password not needed for existing session');
        },
        phoneCode: async () => {
          throw new Error('Phone code not needed for existing session');
        },
        onError: (err) => {
          console.error('Telegram connection error:', err);
        },
      });

      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Telegram connection timeout')), 10000);
      });

      await Promise.race([connectPromise, timeoutPromise]);

      this.telegramConnected = true;
      console.log('✅ Connected to Telegram');
    } catch (error) {
      console.error('Failed to connect to Telegram:', error);
      this.telegramConnected = false;
    }
  }

  private async startBackgroundSync(): Promise<void> {
    if (!this.telegramConnected || !this.client) return;

    // Set up message event handler for new messages only
    this.client.addEventHandler(this.handleNewMessage.bind(this), new NewMessage({}));

    // Set up periodic sync for chat info only (no message history)
    this.syncInterval = setInterval(async () => {
      await this.syncChatInfo();
    }, this.SYNC_INTERVAL_MS);
  }

  private async handleNewMessage(event: any): Promise<void> {
    if (!this.database) return;

    try {
      const message = event.message;
      if (!message.text) return;

      const sanitizedText = this.sanitizeMessage(message.text);
      
      // Use PostgreSQL format for Telegram messages
      await this.database.insertMessage({
        id: message.id,
        messageId: message.id,
        chatId: parseInt(message.chatId?.toString() || '0'),
        chatTitle: message.chat?.title || 'Unknown',
        userId: parseInt(message.senderId?.toString() || '0'),
        username: message.sender?.username || 'unknown',
        text: message.text,
        date: new Date(message.date * 1000), // Convert Unix timestamp to Date
        createdAt: new Date()
      });

      // Log new messages to console
      const chatTitle = message.chat?.title || 'Unknown';
      const username = message.sender?.username || 'unknown';
      const messageText = sanitizedText.substring(0, 100) + (sanitizedText.length > 100 ? '...' : '');
      console.log(`📱 [${chatTitle}] ${username}: ${messageText}`);
    } catch (error) {
      console.error('Failed to handle new message:', error);
    }
  }

  private async syncChatInfo(): Promise<void> {
    if (!this.telegramConnected || !this.client || !this.database) return;

    try {
      console.log('📱 Telegram: Syncing chat info...');
      
      // Get all dialogs (chats) - only sync chat info, not messages
      const dialogs = await this.client.getDialogs({ limit: 100 });
      
      for (const dialog of dialogs) {
        try {
          // Store chat info only
          const chatInfo: TelegramChat = {
            id: dialog.id?.toString() || 'unknown',
            title: dialog.title || 'Unknown',
            type: dialog.isGroup ? 'group' : dialog.isChannel ? 'channel' : 'private',
            member_count: (dialog as any).participantsCount || 0,
            last_message_time: dialog.date ? new Date(dialog.date).toISOString() : undefined,
            active: true
          };

          // TODO: Add PostgreSQL chat storage support
          console.log(`📱 Chat synced: ${chatInfo.title}`);
        } catch (error) {
          console.error(`Failed to sync chat info for chat ${dialog.id}:`, error);
        }
      }
      
      console.log('📱 Telegram: Chat info sync completed');
    } catch (error) {
      console.error('Failed to sync Telegram chat info:', error);
    }
  }

  private async syncMessages(): Promise<void> {
    if (!this.telegramConnected || !this.client || !this.database) return;

    try {
      console.log('📱 Telegram: Syncing messages...');
      
      // Get all dialogs (chats)
      const dialogs = await this.client.getDialogs({ limit: 100 });
      
      for (const dialog of dialogs) {
        try {
          // Store chat info
          const chatInfo: TelegramChat = {
            id: dialog.id?.toString() || 'unknown',
            title: dialog.title || 'Unknown',
            type: dialog.isGroup ? 'group' : dialog.isChannel ? 'channel' : 'private',
            member_count: (dialog as any).participantsCount || 0,
            last_message_time: dialog.date ? new Date(dialog.date).toISOString() : undefined,
            active: true
          };

          // TODO: Add PostgreSQL chat storage support
          console.log(`📱 Chat synced: ${chatInfo.title}`);

          // Get recent messages from this chat
          const messages = await this.client.getMessages(dialog.entity, { limit: 100 });
          
          for (const message of messages) {
            if (message.text) {
              const sanitizedText = this.sanitizeMessage(message.text);
              
              // Use PostgreSQL format for Telegram messages
              await this.database.insertMessage({
                id: message.id,
                messageId: message.id,
                chatId: parseInt(dialog.id?.toString() || '0'),
                chatTitle: dialog.title || 'Unknown',
                userId: parseInt(message.senderId?.toString() || '0'),
                username: (message.sender as any)?.username || 'unknown',
                text: message.text,
                date: new Date(message.date * 1000), // Convert Unix timestamp to Date
                createdAt: new Date()
              });

              // Log new messages to console
              const displayText = message.text.substring(0, 100) + (message.text.length > 100 ? '...' : '');
              const senderName = (message.sender && 'username' in message.sender) ? message.sender.username : 'unknown';
              console.log(`📱 [${dialog.title || 'Unknown'}] ${senderName}: ${displayText}`);
            }
          }
        } catch (error) {
          console.error(`Failed to sync messages for chat ${dialog.id}:`, error);
        }
      }

      this.lastSyncTime = Date.now();
      console.log('📱 Telegram: Sync completed');
    } catch (error) {
      console.error('Failed to sync Telegram messages:', error);
    }
  }

  private sanitizeMessage(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s$@#]/g, ' ') // Remove special characters except $, @, #
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
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

  // Tool handlers
  public async searchMessages(args: any) {
    if (!this.database) {
      return {
        messages: [],
        error: 'Database not initialized',
        message: 'Telegram database not available'
      };
    }

    try {
      const { query, timeRange = '24h', limit = 50, chatId } = args;
      
      // Use PostgreSQL search method
      const messages = await this.database.searchMessages(query, limit);
      
      // Filter by time range
      const now = new Date();
      const timeMs = this.getTimeRangeMs(timeRange);
      const filteredMessages = messages.filter(msg => {
        const msgTime = new Date(msg.date).getTime();
        return now.getTime() - msgTime <= timeMs;
      });
      
      // Filter by chat if specified
      const finalMessages = chatId 
        ? filteredMessages.filter(msg => msg.chatId.toString() === chatId)
        : filteredMessages;

      return {
        messages: finalMessages.map((msg: any) => ({
          id: msg.id,
          chat_id: msg.chatId,
          chat_title: msg.chatTitle,
          username: msg.username,
          message_text: msg.text,
          timestamp: msg.date instanceof Date ? msg.date.toISOString() : msg.date
        })),
        total: finalMessages.length,
        query,
        timeRange,
        last_sync: new Date(this.lastSyncTime).toISOString(),
        message: `Found ${finalMessages.length} messages matching "${query}"`
      };
    } catch (error) {
      return {
        messages: [],
        error: `Search failed: ${error}`,
        message: 'Error searching messages'
      };
    }
  }


  public async searchTokenMentions(args: any) {
    if (!this.database) {
      return {
        mentions: [],
        error: 'Database not initialized',
        message: 'Telegram database not available'
      };
    }

    try {
      const { tokenSymbol, timeRange = '24h', limit = 50 } = args;
      const timeThreshold = this.getTimeRangeMs(timeRange);
      
      // Search for token mentions using PostgreSQL
      const messages = await this.database.searchMessages(tokenSymbol, limit);
      const token = tokenSymbol.toLowerCase();
      const filteredMessages = messages.filter(msg => {
        const text = msg.text.toLowerCase();
        return text.includes(token) || text.includes(`$${token}`) || 
               text.includes(`${token} token`) || text.includes(`${token} coin`);
      });

      return {
        mentions: filteredMessages.map((msg: any) => ({
          id: msg.id,
          chat_id: msg.chatId,
          chat_title: msg.chatTitle,
          username: msg.username,
          message_text: msg.text,
          timestamp: msg.date instanceof Date ? msg.date.toISOString() : msg.date
        })),
        token: tokenSymbol,
        total: messages.length,
        timeRange,
        message: `Found ${messages.length} mentions of ${tokenSymbol}`
      };
    } catch (error) {
      return {
        mentions: [],
        error: `Search failed: ${error}`,
        message: 'Error searching token mentions'
      };
    }
  }

  public async getTrendingTopics(args: any) {
    if (!this.database) {
      return {
        topics: [],
        error: 'Database not initialized',
        message: 'Telegram database not available'
      };
    }

    try {
      const { timeRange = '1d', limit = 20 } = args;
      const timeThreshold = this.getTimeRangeMs(timeRange);
      
      // Get recent messages from all chats
      // Get recent messages for trending topics
      const messages = await this.database.getRecentMessages(undefined, 1000);
      
      // Extract potential trending topics (simple keyword extraction)
      const topicCounts = new Map();
      messages.forEach((msg: any) => {
        const text = (msg.text || '').toLowerCase();
        const words = text.split(/\s+/);
        words.forEach((word: any) => {
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
      const topics = Array.from(topicCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([topic, count]) => ({ topic, count }));

      return {
        topics,
        total: topics.length,
        timeRange,
        message: `Found ${topics.length} trending topics`
      };
    } catch (error) {
      return {
        topics: [],
        error: `Analysis failed: ${error}`,
        message: 'Error analyzing trending topics'
      };
    }
  }

  public async summarizeChatMessages(args: {
    chatIdOrUsername: string;
    limit?: number;
    timeRange?: '1h' | '24h';
    maxTokens?: number;
  }) {
    if (!this.database) {
      return {
        summary: null,
        messageCount: 0,
        chatId: null,
        timeframe: null,
        error: 'Database not initialized'
      };
    }
    if (!process.env.OPENAI_API_KEY) {
      return {
        summary: null,
        messageCount: 0,
        chatId: null,
        timeframe: null,
        error: 'OPENAI_API_KEY is required for summarization'
      };
    }
    try {
      const { chatIdOrUsername, limit = 50, timeRange, maxTokens = 500 } = args;
      let messages: DbTelegramMessage[];
      let timeframe: string;

      if (timeRange) {
        const hours = timeRange === '1h' ? 1 : 24;
        messages = await this.database.getMessagesInTimeRange(hours, limit, chatIdOrUsername);
        timeframe = `last ${timeRange}`;
      } else {
        messages = await this.database.getMessagesByChat(chatIdOrUsername, limit);
        timeframe = `last ${messages.length} messages`;
      }

      const chatId = messages[0]?.chatId?.toString() ?? null;
      const summary = await this.summarizeWithOpenAI(
        messages.map(m => ({ text: m.text, username: m.username, date: m.date })),
        { maxTokens }
      );

      return {
        summary,
        messageCount: messages.length,
        chatId,
        timeframe
      };
    } catch (error) {
      return {
        summary: null,
        messageCount: 0,
        chatId: null,
        timeframe: null,
        error: (error as Error).message
      };
    }
  }

  public async searchMessagesBySubject(args: {
    subject: string;
    timeRange?: string;
    limit?: number;
    chatId?: string;
    includeSummary?: boolean;
  }) {
    if (!this.database) {
      return {
        messages: [],
        summary: null,
        error: 'Database not initialized'
      };
    }
    try {
      const { subject, timeRange = '24h', limit = 50, chatId, includeSummary = true } = args;
      const hoursBack = this.parseTimeRangeToHours(timeRange);

      let messages: Array<{
        id: number;
        chat_id: number;
        chat_title: string;
        username: string;
        message_text: string;
        timestamp: string;
      }> = [];

      const semanticEngine = await this.ensureSemanticEngine();
      if (semanticEngine && process.env.OPENAI_API_KEY) {
        const semanticQuery: SemanticSearchQuery = {
          query: subject,
          time_range: timeRange,
          sources: ['telegram'],
          limit
        };
        const semanticResults = await semanticEngine.semanticSearch(semanticQuery);
        if (semanticResults.length > 0) {
          messages = semanticResults.map((m, idx) => {
            const meta = (m.metadata || {}) as Record<string, unknown>;
            return {
              id: idx,
              chat_id: (meta.chat_id as number) ?? 0,
              chat_title: (meta.chat_title as string) ?? '',
              username: (meta.username as string) ?? 'unknown',
              message_text: m.text,
              timestamp: m.date instanceof Date ? m.date.toISOString() : String(m.date)
            };
          });
        }
      }

      if (messages.length === 0) {
        const keywords = subject
          .split(/\s+/)
          .filter(w => w.length > 2 && !/^(the|and|or|in|on|at|for|to|of|a|an|is|what|how)$/i.test(w))
          .slice(0, 5);
        const keywordQuery = keywords.length > 0 ? keywords.join(' ') : subject;
        const dbMessages = await this.database.searchMessagesWithFilters(keywordQuery, limit, {
          timeRangeHours: hoursBack,
          chatId
        });
        messages = dbMessages.map(m => ({
          id: m.id,
          chat_id: m.chatId,
          chat_title: m.chatTitle,
          username: m.username,
          message_text: m.text,
          timestamp: m.date instanceof Date ? m.date.toISOString() : String(m.date)
        }));
      }

      let summary: string | null = null;
      if (includeSummary && messages.length > 0 && process.env.OPENAI_API_KEY && this.openai) {
        summary = await this.summarizeWithOpenAI(
          messages.map(m => ({
            text: m.message_text,
            username: m.username,
            date: new Date(m.timestamp)
          })),
          {
            maxTokens: 400,
            systemPrompt: `Given these Telegram messages about "${subject}", provide a concise summary of the key findings and themes.`
          }
        );
      }

      return {
        messages,
        total: messages.length,
        subject,
        timeRange,
        summary
      };
    } catch (error) {
      return {
        messages: [],
        summary: null,
        error: (error as Error).message
      };
    }
  }

  public async summarizeRecentByTopic(args: {
    topic: string;
    hours?: number;
    chatIds?: string[];
  }) {
    if (!this.database) {
      return {
        summary: null,
        messageCount: 0,
        topic: args.topic,
        error: 'Database not initialized'
      };
    }
    if (!process.env.OPENAI_API_KEY) {
      return {
        summary: null,
        messageCount: 0,
        topic: args.topic,
        error: 'OPENAI_API_KEY is required for summarization'
      };
    }
    try {
      const { topic, hours = 24, chatIds } = args;
      const limit = 100;

      let allMessages: DbTelegramMessage[] = [];
      if (chatIds && chatIds.length > 0) {
        for (const cid of chatIds) {
          const msgs = await this.database.getMessagesInTimeRange(hours, 50, cid);
          allMessages.push(...msgs);
        }
        allMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        allMessages = allMessages.slice(0, limit);
      } else {
        allMessages = await this.database.getMessagesInTimeRange(hours, limit);
      }

      const keywords = topic
        .split(/\s+/)
        .filter(w => w.length > 2 && !/^(the|and|or|in|on|at|for|to|of|a|an|is|what|how)$/i.test(w))
        .slice(0, 5);
      const searchQuery = keywords.length > 0 ? keywords.join(' ') : topic;

      let matching: DbTelegramMessage[] = [];
      const semanticEngine = await this.ensureSemanticEngine();
      if (semanticEngine && process.env.OPENAI_API_KEY) {
        const semanticResults = await semanticEngine.semanticSearch({
          query: topic,
          time_range: hours <= 1 ? '1h' : hours <= 24 ? '24h' : '7d',
          sources: ['telegram'],
          limit
        });
        matching = semanticResults
          .filter(m => m.text)
          .map(m => {
            const meta = (m.metadata || {}) as Record<string, unknown>;
            return {
              id: 0,
              messageId: 0,
              chatId: 0,
              chatTitle: (meta.chat_title as string) ?? '',
              userId: 0,
              username: (meta.username as string) ?? 'unknown',
              text: m.text,
              date: m.date instanceof Date ? m.date : new Date(),
              createdAt: new Date()
            } as DbTelegramMessage;
          });
      }

      if (matching.length === 0) {
        matching = await this.database.searchMessagesWithFilters(searchQuery, limit, {
          timeRangeHours: hours,
          chatId: chatIds?.[0]
        });
        if (chatIds && chatIds.length > 1) {
          const filtered: DbTelegramMessage[] = [];
          for (const m of matching) {
            const matchTitle = chatIds.some(
              c => m.chatId.toString() === c || m.chatTitle?.toLowerCase().includes(c.toLowerCase())
            );
            if (matchTitle) filtered.push(m);
          }
          matching = filtered;
        }
      }

      const summary = await this.summarizeWithOpenAI(
        matching.map(m => ({ text: m.text, username: m.username, date: m.date })),
        {
          maxTokens: 500,
          systemPrompt: `Summarize the following Telegram messages about "${topic}". Highlight key points, consensus, and notable opinions.`
        }
      );

      return {
        summary,
        messageCount: matching.length,
        topic,
        hours,
        chatIds: chatIds ?? null
      };
    } catch (error) {
      return {
        summary: null,
        messageCount: 0,
        topic: args.topic,
        error: (error as Error).message
      };
    }
  }

  // Public methods for other modules
  async searchMessagesPublic(query: string, options: TelegramSearchOptions = {}) {
    return this.searchMessages({ query, ...options });
  }


  async searchTokenMentionsPublic(tokenSymbol: string, options: TelegramSearchOptions = {}) {
    return this.searchTokenMentions({ tokenSymbol, ...options });
  }

  async getTrendingTopicsPublic(options: TelegramSearchOptions = {}) {
    return this.getTrendingTopics(options);
  }

  async getLastSyncTime() {
    return this.lastSyncTime;
  }

  isConnected() {
    return this.telegramConnected;
  }

  // Cleanup method
  public getTelegramDatabase(): TelegramPostgresDatabase | null {
    return this.database;
  }

  async destroy(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.client) {
      await this.client.disconnect();
    }
    if (this.database) {
      this.database.close();
    }
  }
}
