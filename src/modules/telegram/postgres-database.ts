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
      
      return result.rows.map(row => ({
        id: row.id,
        messageId: row.message_id,
        chatId: row.chat_id,
        chatTitle: row.chat_title,
        userId: row.user_id,
        username: row.username,
        text: row.text,
        date: row.date,
        createdAt: row.created_at
      }));
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
      
      return result.rows.map(row => ({
        id: row.id,
        messageId: row.message_id,
        chatId: row.chat_id,
        chatTitle: row.chat_title,
        userId: row.user_id,
        username: row.username,
        text: row.text,
        date: row.date,
        createdAt: row.created_at
      }));
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
    
    return result.rows.map(row => ({
      id: row.id,
      messageId: row.message_id,
      chatId: row.chat_id,
      chatTitle: row.chat_title,
      userId: row.user_id,
      username: row.username,
      text: row.text,
      date: row.date,
      createdAt: row.created_at
    }));
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
