import { Pool } from 'pg';
import { PostgresManager } from '../base/postgres-manager.js';

export interface TelegramMessage {
  id: number;
  messageId: number;
  chatId: number;
  chatTitle: string;
  userId: number;
  username: string;
  text: string;
  date: Date;
  createdAt: Date;
}

export class TelegramPostgresDatabase {
  private postgresManager: PostgresManager;
  private pool: Pool | null = null;

  constructor() {
    this.postgresManager = PostgresManager.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      // Register the database
      this.postgresManager.registerDatabase({
        name: 'telegram',
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DATABASE || 'mcpcrypto',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
      });

      // Get the pool
      this.pool = await this.postgresManager.getPool('telegram');

      // Create tables
      await this.createTables();
      console.log('[SUCCESS] Telegram PostgreSQL database initialized');
    } catch (error) {
      console.error('[ERROR] Failed to initialize Telegram PostgreSQL database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS telegram_messages (
        id SERIAL PRIMARY KEY,
        message_id BIGINT,
        chat_id BIGINT,
        chat_title VARCHAR(255),
        user_id BIGINT,
        username VARCHAR(255),
        text TEXT,
        date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat_id ON telegram_messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_telegram_messages_date ON telegram_messages(date);
      CREATE INDEX IF NOT EXISTS idx_telegram_messages_text ON telegram_messages USING gin(to_tsvector('english', text));
    `;

    await this.pool.query(createTablesSQL);
  }

  async insertMessage(message: TelegramMessage): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO telegram_messages (message_id, chat_id, chat_title, user_id, username, text, date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT DO NOTHING
    `;

    await this.pool.query(query, [
      message.messageId,
      message.chatId,
      message.chatTitle,
      message.userId,
      message.username,
      message.text,
      message.date
    ]);
  }

  async searchMessages(query: string, limit: number = 100): Promise<TelegramMessage[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    // Split query into words and search for exact word matches only
    const words = query.trim().split(/\s+/).filter(word => word.length > 0);
    
    if (words.length === 0) {
      return [];
    }

    // For single word searches, use word boundary matching
    if (words.length === 1) {
      const sql = `
        SELECT id, message_id, chat_id, chat_title, user_id, username, text, date, created_at
        FROM telegram_messages
        WHERE text ~* $1
        ORDER BY date DESC
        LIMIT $2
      `;
      
      // Use word boundary regex for exact word matching
      const wordPattern = `\\b${words[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`;
      const result = await this.pool.query(sql, [wordPattern, limit]);
      return result.rows.map(row => this.mapRowToMessage(row));
    } else {
      // For multiple words, search for all words (AND condition)
      const conditions = words.map((_, index) => `text ~* $${index + 1}`).join(' AND ');
      const sql = `
        SELECT id, message_id, chat_id, chat_title, user_id, username, text, date, created_at
        FROM telegram_messages
        WHERE ${conditions}
        ORDER BY date DESC
        LIMIT $${words.length + 1}
      `;
      
      const wordPatterns = words.map(word => `\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      const result = await this.pool.query(sql, [...wordPatterns, limit]);
      return result.rows.map(row => this.mapRowToMessage(row));
    }
  }

  async getRecentMessages(chatId?: number, limit: number = 100): Promise<TelegramMessage[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let sql = `
      SELECT id, message_id, chat_id, chat_title, user_id, username, text, date, created_at
      FROM telegram_messages
    `;
    const params: any[] = [];

    if (chatId) {
      sql += ` WHERE chat_id = $1`;
      params.push(chatId);
    }

    sql += ` ORDER BY date DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.pool.query(sql, params);

    return result.rows.map(row => this.mapRowToMessage(row));
  }

  /**
   * Get messages for a chat by chat ID (numeric) or chat title (partial match).
   */
  async getMessagesByChat(
    chatIdOrUsername: string,
    limit: number = 50,
    since?: Date
  ): Promise<TelegramMessage[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const isNumeric = /^\d+$/.test(chatIdOrUsername.trim());
    let sql = `
      SELECT id, message_id, chat_id, chat_title, user_id, username, text, date, created_at
      FROM telegram_messages
      WHERE
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (isNumeric) {
      sql += ` chat_id = $${paramIndex}`;
      params.push(parseInt(chatIdOrUsername, 10));
      paramIndex++;
    } else {
      sql += ` LOWER(chat_title) LIKE LOWER($${paramIndex})`;
      params.push(`%${chatIdOrUsername.trim()}%`);
      paramIndex++;
    }

    if (since) {
      sql += ` AND date >= $${paramIndex}`;
      params.push(since);
      paramIndex++;
    }

    sql += ` ORDER BY date DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.pool.query(sql, params);
    return result.rows.map(row => this.mapRowToMessage(row));
  }

  /**
   * Get messages within a time range, optionally filtered by chat.
   */
  async getMessagesInTimeRange(
    hoursBack: number,
    limit: number = 100,
    chatIdOrUsername?: string
  ): Promise<TelegramMessage[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let sql = `
      SELECT id, message_id, chat_id, chat_title, user_id, username, text, date, created_at
      FROM telegram_messages
      WHERE date >= NOW() - INTERVAL '1 hour' * $1
    `;
    const params: any[] = [hoursBack];
    let paramIndex = 2;

    if (chatIdOrUsername) {
      const isNumeric = /^\d+$/.test(chatIdOrUsername.trim());
      if (isNumeric) {
        sql += ` AND chat_id = $${paramIndex}`;
        params.push(parseInt(chatIdOrUsername, 10));
      } else {
        sql += ` AND LOWER(chat_title) LIKE LOWER($${paramIndex})`;
        params.push(`%${chatIdOrUsername.trim()}%`);
      }
      paramIndex++;
    }

    sql += ` ORDER BY date DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.pool.query(sql, params);
    return result.rows.map(row => this.mapRowToMessage(row));
  }

  /**
   * Keyword search with optional time range and chat filter.
   */
  async searchMessagesWithFilters(
    query: string,
    limit: number = 50,
    options?: { timeRangeHours?: number; chatId?: string }
  ): Promise<TelegramMessage[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const words = query.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return [];

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    words.forEach(word => {
      const pattern = `\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`;
      conditions.push(`text ~* $${paramIndex}`);
      params.push(pattern);
      paramIndex++;
    });

    let sql = `
      SELECT id, message_id, chat_id, chat_title, user_id, username, text, date, created_at
      FROM telegram_messages
      WHERE ${conditions.join(' AND ')}
    `;

    if (options?.timeRangeHours) {
      sql += ` AND date >= NOW() - INTERVAL '1 hour' * $${paramIndex}`;
      params.push(options.timeRangeHours);
      paramIndex++;
    }

    if (options?.chatId) {
      const isNumeric = /^\d+$/.test(options.chatId.trim());
      if (isNumeric) {
        sql += ` AND chat_id = $${paramIndex}`;
        params.push(parseInt(options.chatId, 10));
      } else {
        sql += ` AND LOWER(chat_title) LIKE LOWER($${paramIndex})`;
        params.push(`%${options.chatId.trim()}%`);
      }
      paramIndex++;
    }

    sql += ` ORDER BY date DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.pool.query(sql, params);
    return result.rows.map(row => this.mapRowToMessage(row));
  }

  private mapRowToMessage(row: any): TelegramMessage {
    return {
      id: row.id,
      messageId: row.message_id,
      chatId: row.chat_id,
      chatTitle: row.chat_title,
      userId: row.user_id,
      username: row.username,
      text: row.text,
      date: row.date,
      createdAt: row.created_at
    };
  }

  async getMessageCount(): Promise<number> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const result = await this.pool.query('SELECT COUNT(*) as count FROM telegram_messages');
    return parseInt(result.rows[0].count);
  }

  // Legacy compatibility - use query() method instead

  async close(): Promise<void> {
    // PostgreSQL connections are managed by the pool, no need to close
  }
}
