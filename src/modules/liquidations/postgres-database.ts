import { Pool } from 'pg';
import { PostgresManager } from '../base/postgres-manager.js';

export interface LiquidationRecord {
  id: string;
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  quantity: number;
  price: number;
  notional_value: number;
  timestamp: string;
  source: 'binance_ws' | 'coinalyze_api';
  created_at: Date;
}

export interface OpenInterestRecord {
  id: number;
  symbol: string;
  exchange: string;
  value: number;
  timestamp: string;
  source: 'binance_ws' | 'coinalyze_api';
  created_at: Date;
}

export interface LiquidationStats {
  symbol: string;
  exchange: string;
  total_liquidations: number;
  total_notional: number;
  long_liquidations: number;
  short_liquidations: number;
  largest_liquidation: number;
  timeframe: string;
  period_start: string;
  period_end: string;
}

export class LiquidationPostgresDatabase {
  private postgresManager: PostgresManager;
  private pool: Pool | null = null;

  constructor() {
    this.postgresManager = PostgresManager.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      // Register the database
      this.postgresManager.registerDatabase({
        name: 'liquidations',
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DATABASE || 'mcp_crypto',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
      });

      // Get the pool
      this.pool = await this.postgresManager.getPool('liquidations');

      // Create tables
      await this.createTables();
      console.log('[SUCCESS] Liquidations PostgreSQL database initialized');
    } catch (error) {
      console.error('[ERROR] Failed to initialize Liquidations PostgreSQL database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const createLiquidationsTable = `
      CREATE TABLE IF NOT EXISTS liquidations (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        exchange TEXT NOT NULL,
        side TEXT NOT NULL,
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        notional_value REAL NOT NULL,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createOpenInterestTable = `
      CREATE TABLE IF NOT EXISTS open_interest (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        exchange TEXT NOT NULL,
        value REAL NOT NULL,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createLiquidationStatsTable = `
      CREATE TABLE IF NOT EXISTS liquidation_stats (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        exchange TEXT NOT NULL,
        total_liquidations INTEGER NOT NULL,
        total_notional REAL NOT NULL,
        long_liquidations INTEGER NOT NULL,
        short_liquidations INTEGER NOT NULL,
        largest_liquidation REAL NOT NULL,
        timeframe TEXT NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_liquidations_symbol ON liquidations (symbol);
      CREATE INDEX IF NOT EXISTS idx_liquidations_exchange ON liquidations (exchange);
      CREATE INDEX IF NOT EXISTS idx_liquidations_timestamp ON liquidations (timestamp);
      CREATE INDEX IF NOT EXISTS idx_liquidations_side ON liquidations (side);
      CREATE INDEX IF NOT EXISTS idx_liquidations_notional ON liquidations (notional_value);
      CREATE INDEX IF NOT EXISTS idx_open_interest_symbol ON open_interest (symbol);
      CREATE INDEX IF NOT EXISTS idx_open_interest_exchange ON open_interest (exchange);
      CREATE INDEX IF NOT EXISTS idx_open_interest_timestamp ON open_interest (timestamp);
      CREATE INDEX IF NOT EXISTS idx_stats_symbol ON liquidation_stats (symbol);
      CREATE INDEX IF NOT EXISTS idx_stats_exchange ON liquidation_stats (exchange);
      CREATE INDEX IF NOT EXISTS idx_stats_timeframe ON liquidation_stats (timeframe);
    `;

    await this.pool.query(createLiquidationsTable);
    await this.pool.query(createOpenInterestTable);
    await this.pool.query(createLiquidationStatsTable);
    await this.pool.query(createIndexes);
  }

  async addLiquidation(liquidation: Omit<LiquidationRecord, 'created_at'>): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO liquidations (
        id, symbol, exchange, side, quantity, price, notional_value, timestamp, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        symbol = EXCLUDED.symbol,
        exchange = EXCLUDED.exchange,
        side = EXCLUDED.side,
        quantity = EXCLUDED.quantity,
        price = EXCLUDED.price,
        notional_value = EXCLUDED.notional_value,
        timestamp = EXCLUDED.timestamp,
        source = EXCLUDED.source
    `;

    await this.pool.query(query, [
      liquidation.id,
      liquidation.symbol,
      liquidation.exchange,
      liquidation.side,
      liquidation.quantity,
      liquidation.price,
      liquidation.notional_value,
      liquidation.timestamp,
      liquidation.source
    ]);
  }

  async addOpenInterest(openInterest: Omit<OpenInterestRecord, 'id' | 'created_at'>): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO open_interest (
        symbol, exchange, value, timestamp, source
      ) VALUES ($1, $2, $3, $4, $5)
    `;

    await this.pool.query(query, [
      openInterest.symbol,
      openInterest.exchange,
      openInterest.value,
      openInterest.timestamp,
      openInterest.source
    ]);
  }

  async getLiquidationsBySymbol(symbol: string, timeframe?: string, limit?: number, minUsdValue?: number): Promise<LiquidationRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let query = 'SELECT * FROM liquidations WHERE symbol = $1';
    const params: any[] = [symbol];

    if (timeframe) {
      const timeFilter = this.getTimeFilter(timeframe);
      query += ' AND timestamp >= $' + (params.length + 1);
      params.push(timeFilter);
    }

    if (minUsdValue) {
      query += ' AND notional_value >= $' + (params.length + 1);
      params.push(minUsdValue);
    }

    query += ' ORDER BY timestamp DESC';

    if (limit) {
      query += ' LIMIT $' + (params.length + 1);
      params.push(limit);
    }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getLiquidationsByExchange(exchange: string, timeframe?: string, limit?: number, minUsdValue?: number): Promise<LiquidationRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let query = 'SELECT * FROM liquidations WHERE exchange = $1';
    const params: any[] = [exchange];

    if (timeframe) {
      const timeFilter = this.getTimeFilter(timeframe);
      query += ' AND timestamp >= $' + (params.length + 1);
      params.push(timeFilter);
    }

    if (minUsdValue) {
      query += ' AND notional_value >= $' + (params.length + 1);
      params.push(minUsdValue);
    }

    query += ' ORDER BY timestamp DESC';

    if (limit) {
      query += ' LIMIT $' + (params.length + 1);
      params.push(limit);
    }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getLargestLiquidations(limit: number = 10, timeframe?: string, minUsdValue?: number): Promise<LiquidationRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let query = 'SELECT * FROM liquidations';
    const params: any[] = [];

    if (timeframe) {
      const timeFilter = this.getTimeFilter(timeframe);
      query += ' WHERE timestamp >= $1';
      params.push(timeFilter);
    }

    if (minUsdValue) {
      if (timeframe) {
        query += ' AND notional_value >= $' + (params.length + 1);
      } else {
        query += ' WHERE notional_value >= $1';
      }
      params.push(minUsdValue);
    }

    query += ' ORDER BY notional_value DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getLiquidationStats(symbol?: string, exchange?: string, timeframe: string = '1h', minUsdValue?: number): Promise<LiquidationStats[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const timeFilter = this.getTimeFilter(timeframe);
    
    let query = `
      SELECT 
        symbol,
        exchange,
        COUNT(*) as total_liquidations,
        SUM(notional_value) as total_notional,
        SUM(CASE WHEN side = 'long' THEN 1 ELSE 0 END) as long_liquidations,
        SUM(CASE WHEN side = 'short' THEN 1 ELSE 0 END) as short_liquidations,
        MAX(notional_value) as largest_liquidation,
        $1 as timeframe,
        $2 as period_start,
        NOW() as period_end
      FROM liquidations 
      WHERE timestamp >= $3
    `;
    
    const params: any[] = [timeframe, timeFilter, timeFilter];

    if (symbol) {
      query += ' AND symbol = $' + (params.length + 1);
      params.push(symbol);
    }

    if (exchange) {
      query += ' AND exchange = $' + (params.length + 1);
      params.push(exchange);
    }

    if (minUsdValue) {
      query += ' AND notional_value >= $' + (params.length + 1);
      params.push(minUsdValue);
    }

    query += ' GROUP BY symbol, exchange ORDER BY total_notional DESC';

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getOpenInterestHistory(symbol: string, exchange?: string, timeframe?: string): Promise<OpenInterestRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let query = 'SELECT * FROM open_interest WHERE symbol = $1';
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

  async getCurrentOpenInterest(symbol: string, exchange?: string): Promise<OpenInterestRecord | null> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let query = 'SELECT * FROM open_interest WHERE symbol = $1';
    const params: any[] = [symbol];

    if (exchange) {
      query += ' AND exchange = $' + (params.length + 1);
      params.push(exchange);
    }

    query += ' ORDER BY timestamp DESC LIMIT 1';

    const result = await this.pool.query(query, params);
    return result.rows[0] || null;
  }

  async getMostLiquidatedCoins(timeframe: string = '1h', limit: number = 10, minUsdValue?: number): Promise<LiquidationStats[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const timeFilter = this.getTimeFilter(timeframe);
    
    let query = `
      SELECT 
        symbol,
        'all' as exchange,
        COUNT(*) as total_liquidations,
        SUM(notional_value) as total_notional,
        SUM(CASE WHEN side = 'long' THEN 1 ELSE 0 END) as long_liquidations,
        SUM(CASE WHEN side = 'short' THEN 1 ELSE 0 END) as short_liquidations,
        MAX(notional_value) as largest_liquidation,
        $1 as timeframe,
        $2 as period_start,
        NOW() as period_end
      FROM liquidations 
      WHERE timestamp >= $3
    `;
    
    const params: any[] = [timeframe, timeFilter, timeFilter];

    if (minUsdValue) {
      query += ' AND notional_value >= $' + (params.length + 1);
      params.push(minUsdValue);
    }

    query += ' GROUP BY symbol ORDER BY total_notional DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getStats(): Promise<{
    totalLiquidations: number;
    totalOpenInterestRecords: number;
    totalNotionalValue: number;
    lastUpdate: string;
  }> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const liquidationsResult = await this.pool.query('SELECT COUNT(*) as count FROM liquidations');
    const openInterestResult = await this.pool.query('SELECT COUNT(*) as count FROM open_interest');
    const totalNotionalResult = await this.pool.query('SELECT SUM(notional_value) as total FROM liquidations');
    const lastUpdateResult = await this.pool.query('SELECT MAX(timestamp) as last_update FROM liquidations');

    return {
      totalLiquidations: parseInt(liquidationsResult.rows[0].count),
      totalOpenInterestRecords: parseInt(openInterestResult.rows[0].count),
      totalNotionalValue: parseFloat(totalNotionalResult.rows[0].total) || 0,
      lastUpdate: lastUpdateResult.rows[0].last_update || new Date().toISOString()
    };
  }

  private getTimeFilter(timeframe: string): string {
    const now = new Date();
    let timeAgo: Date;

    switch (timeframe) {
      case '5m':
        timeAgo = new Date(now.getTime() - 5 * 60 * 1000);
        break;
      case '15m':
        timeAgo = new Date(now.getTime() - 15 * 60 * 1000);
        break;
      case '1h':
        timeAgo = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '4h':
        timeAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
        break;
      case '1d':
        timeAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '1w':
        timeAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeAgo = new Date(now.getTime() - 60 * 60 * 1000); // Default to 1 hour
    }

    return timeAgo.toISOString();
  }

  async cleanupOldData(): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    // Clean up old liquidations (keep last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await this.pool.query('DELETE FROM liquidations WHERE timestamp < $1', [thirtyDaysAgo]);

    // Clean up old open interest data (keep last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await this.pool.query('DELETE FROM open_interest WHERE timestamp < $1', [sevenDaysAgo]);

    // Clean up old stats (keep last 30 days)
    await this.pool.query('DELETE FROM liquidation_stats WHERE period_end < $1', [thirtyDaysAgo]);
  }

  async close(): Promise<void> {
    // PostgreSQL connections are managed by the pool, no need to close
  }
}
