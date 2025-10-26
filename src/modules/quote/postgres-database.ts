import { Pool } from 'pg';
import { PostgresManager } from '../base/postgres-manager.js';

export interface PriceRecord {
  id: string;
  symbol: string;
  exchange: string;
  spot_price: number | null;
  perp_price: number | null;
  volume_24h: number | null;
  timestamp: Date;
  created_at: Date;
}

export interface ExchangeMentionRecord {
  id: string;
  symbol: string;
  exchange: string;
  message_count: number;
  recent_message: string;
  time_range: string;
  timestamp: Date;
  created_at: Date;
}

export class QuotePostgresDatabase {
  private postgresManager: PostgresManager;
  private pool: Pool | null = null;

  constructor() {
    this.postgresManager = PostgresManager.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      // Register the database
      this.postgresManager.registerDatabase({
        name: 'quote',
        host: 'localhost',
        port: 5432,
        database: 'mcpcrypto',
        user: 'postgres',
        password: '',
      });

      // Get the pool
      this.pool = await this.postgresManager.getPool('quote');

      // Create tables
      await this.createTables();
      console.log('[SUCCESS] Quote PostgreSQL database initialized');
    } catch (error) {
      console.error('[ERROR] Failed to initialize Quote PostgreSQL database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const createPricesTable = `
      CREATE TABLE IF NOT EXISTS quote_prices (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        exchange TEXT NOT NULL,
        spot_price REAL,
        perp_price REAL,
        volume_24h REAL,
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createExchangeMentionsTable = `
      CREATE TABLE IF NOT EXISTS quote_exchange_mentions (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        exchange TEXT NOT NULL,
        message_count INTEGER NOT NULL,
        recent_message TEXT NOT NULL,
        time_range TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_quote_prices_symbol ON quote_prices (symbol);
      CREATE INDEX IF NOT EXISTS idx_quote_prices_exchange ON quote_prices (exchange);
      CREATE INDEX IF NOT EXISTS idx_quote_prices_timestamp ON quote_prices (timestamp);
      CREATE INDEX IF NOT EXISTS idx_quote_exchange_mentions_symbol ON quote_exchange_mentions (symbol);
      CREATE INDEX IF NOT EXISTS idx_quote_exchange_mentions_exchange ON quote_exchange_mentions (exchange);
      CREATE INDEX IF NOT EXISTS idx_quote_exchange_mentions_timestamp ON quote_exchange_mentions (timestamp);
    `;

    await this.pool.query(createPricesTable);
    await this.pool.query(createExchangeMentionsTable);
    await this.pool.query(createIndexes);
  }

  async upsertPrice(price: Omit<PriceRecord, 'created_at'>): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO quote_prices (
        id, symbol, exchange, spot_price, perp_price, volume_24h, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        spot_price = EXCLUDED.spot_price,
        perp_price = EXCLUDED.perp_price,
        volume_24h = EXCLUDED.volume_24h,
        timestamp = EXCLUDED.timestamp
    `;

    await this.pool.query(query, [
      price.id,
      price.symbol,
      price.exchange,
      price.spot_price,
      price.perp_price,
      price.volume_24h,
      price.timestamp
    ]);
  }

  async upsertExchangeMention(mention: Omit<ExchangeMentionRecord, 'created_at'>): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO quote_exchange_mentions (
        id, symbol, exchange, message_count, recent_message, time_range, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        message_count = EXCLUDED.message_count,
        recent_message = EXCLUDED.recent_message,
        time_range = EXCLUDED.time_range,
        timestamp = EXCLUDED.timestamp
    `;

    await this.pool.query(query, [
      mention.id,
      mention.symbol,
      mention.exchange,
      mention.message_count,
      mention.recent_message,
      mention.time_range,
      mention.timestamp
    ]);
  }

  async getLatestPrices(symbol: string, limit: number = 10): Promise<PriceRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      SELECT * FROM quote_prices 
      WHERE symbol = $1 
      ORDER BY timestamp DESC 
      LIMIT $2
    `;

    const result = await this.pool.query(query, [symbol, limit]);
    return result.rows;
  }

  async getPricesByExchange(exchange: string, limit: number = 10): Promise<PriceRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      SELECT * FROM quote_prices 
      WHERE exchange = $1 
      ORDER BY timestamp DESC 
      LIMIT $2
    `;

    const result = await this.pool.query(query, [exchange, limit]);
    return result.rows;
  }

  async getExchangeMentions(symbol: string, timeRange: string = '7d'): Promise<ExchangeMentionRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      SELECT * FROM quote_exchange_mentions 
      WHERE symbol = $1 AND time_range = $2
      ORDER BY message_count DESC, timestamp DESC
    `;

    const result = await this.pool.query(query, [symbol, timeRange]);
    return result.rows;
  }

  async getPriceHistory(symbol: string, exchange?: string, timeframe?: string): Promise<PriceRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let query = 'SELECT * FROM quote_prices WHERE symbol = $1';
    const params: any[] = [symbol];

    if (exchange) {
      query += ' AND exchange = $' + (params.length + 1);
      params.push(exchange);
    }

    if (timeframe) {
      const timeFilter = this.getTimeFilter(timeframe);
      query += ' AND timestamp >= $' + (params.length + 1);
      params.push(timeFilter);
    }

    query += ' ORDER BY timestamp DESC';

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getStats(): Promise<{
    totalPrices: number;
    totalMentions: number;
    lastUpdate: string;
  }> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const pricesResult = await this.pool.query('SELECT COUNT(*) as count FROM quote_prices');
    const mentionsResult = await this.pool.query('SELECT COUNT(*) as count FROM quote_exchange_mentions');
    const lastUpdateResult = await this.pool.query('SELECT MAX(timestamp) as last_update FROM quote_prices');

    return {
      totalPrices: parseInt(pricesResult.rows[0].count),
      totalMentions: parseInt(mentionsResult.rows[0].count),
      lastUpdate: lastUpdateResult.rows[0].last_update || new Date().toISOString()
    };
  }

  private getTimeFilter(timeframe: string): string {
    const now = new Date();
    let timeAgo: Date;

    switch (timeframe) {
      case '1d':
        timeAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '3d':
        timeAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        break;
      case '7d':
        timeAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        timeAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return timeAgo.toISOString();
  }

  async cleanupOldData(): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    // Clean up old price data (keep last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await this.pool.query('DELETE FROM quote_prices WHERE timestamp < $1', [thirtyDaysAgo]);

    // Clean up old mention data (keep last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await this.pool.query('DELETE FROM quote_exchange_mentions WHERE timestamp < $1', [sevenDaysAgo]);
  }

  async close(): Promise<void> {
    // PostgreSQL connections are managed by the pool, no need to close
  }
}
