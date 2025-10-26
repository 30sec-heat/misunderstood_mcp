import { Pool } from 'pg';
import { PostgresManager } from '../base/postgres-manager.js';

export interface OptionRecord {
  instrument_name: string;
  currency: string;
  option_type: 'call' | 'put';
  strike: number;
  expiry: string;
  underlying_index: string;
  underlying_price: number;
  mark_price: number;
  bid_price: number;
  ask_price: number;
  last_price: number;
  volume: number;
  open_interest: number;
  iv: number;
  index_price: number;
  timestamp: string;
  created_at: Date;
  updated_at: Date;
}

export interface TradeRecord {
  trade_id: string;
  instrument_name: string;
  direction: 'buy' | 'sell';
  amount: number;
  price: number;
  trade_seq: number;
  timestamp: string;
  notional_value: number;
  created_at: Date;
}

export interface GreeksRecord {
  instrument_name: string;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  timestamp: string;
  created_at: Date;
  updated_at: Date;
}

export interface AlertRecord {
  id: string;
  alert_type: 'large_trade' | 'mispricing';
  instrument_name: string;
  message: string;
  data: string; // JSON string
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  acknowledged: boolean;
  created_at: Date;
}

export class DeribitPostgresDatabase {
  private postgresManager: PostgresManager;
  private pool: Pool | null = null;

  constructor() {
    this.postgresManager = PostgresManager.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      // Register the database
      this.postgresManager.registerDatabase({
        name: 'deribit',
        host: 'localhost',
        port: 5432,
        database: 'mcpcrypto',
        user: 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
      });

      // Get the pool
      this.pool = await this.postgresManager.getPool('deribit');

      // Create tables
      await this.createTables();
      console.log('[SUCCESS] Deribit PostgreSQL database initialized');
    } catch (error) {
      console.error('[ERROR] Failed to initialize Deribit PostgreSQL database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const createOptionsTable = `
      CREATE TABLE IF NOT EXISTS deribit_options (
        instrument_name TEXT PRIMARY KEY,
        currency TEXT NOT NULL,
        option_type TEXT NOT NULL,
        strike REAL NOT NULL,
        expiry TEXT NOT NULL,
        underlying_index TEXT NOT NULL,
        underlying_price REAL NOT NULL,
        mark_price REAL NOT NULL,
        bid_price REAL NOT NULL,
        ask_price REAL NOT NULL,
        last_price REAL NOT NULL,
        volume REAL NOT NULL,
        open_interest REAL NOT NULL,
        iv REAL NOT NULL,
        index_price REAL NOT NULL,
        timestamp TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createGreeksTable = `
      CREATE TABLE IF NOT EXISTS deribit_greeks (
        instrument_name TEXT PRIMARY KEY,
        delta REAL NOT NULL,
        gamma REAL NOT NULL,
        theta REAL NOT NULL,
        vega REAL NOT NULL,
        rho REAL NOT NULL,
        timestamp TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (instrument_name) REFERENCES deribit_options (instrument_name)
      );
    `;

    const createTradesTable = `
      CREATE TABLE IF NOT EXISTS deribit_trades (
        trade_id TEXT PRIMARY KEY,
        instrument_name TEXT NOT NULL,
        direction TEXT NOT NULL,
        amount REAL NOT NULL,
        price REAL NOT NULL,
        trade_seq INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        notional_value REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (instrument_name) REFERENCES deribit_options (instrument_name)
      );
    `;

    const createAlertsTable = `
      CREATE TABLE IF NOT EXISTS deribit_alerts (
        id TEXT PRIMARY KEY,
        alert_type TEXT NOT NULL,
        instrument_name TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT NOT NULL,
        severity TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        acknowledged BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_deribit_options_currency ON deribit_options (currency);
      CREATE INDEX IF NOT EXISTS idx_deribit_options_expiry ON deribit_options (expiry);
      CREATE INDEX IF NOT EXISTS idx_deribit_options_strike ON deribit_options (strike);
      CREATE INDEX IF NOT EXISTS idx_deribit_trades_timestamp ON deribit_trades (timestamp);
      CREATE INDEX IF NOT EXISTS idx_deribit_trades_instrument ON deribit_trades (instrument_name);
      CREATE INDEX IF NOT EXISTS idx_deribit_trades_notional ON deribit_trades (notional_value);
      CREATE INDEX IF NOT EXISTS idx_deribit_alerts_type ON deribit_alerts (alert_type);
      CREATE INDEX IF NOT EXISTS idx_deribit_alerts_timestamp ON deribit_alerts (timestamp);
    `;

    await this.pool.query(createOptionsTable);
    await this.pool.query(createGreeksTable);
    await this.pool.query(createTradesTable);
    await this.pool.query(createAlertsTable);
    await this.pool.query(createIndexes);
  }

  async upsertOption(option: Omit<OptionRecord, 'created_at' | 'updated_at'>): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO deribit_options (
        instrument_name, currency, option_type, strike, expiry, underlying_index,
        underlying_price, mark_price, bid_price, ask_price, last_price,
        volume, open_interest, iv, index_price, timestamp, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
      ON CONFLICT (instrument_name) DO UPDATE SET
        currency = EXCLUDED.currency,
        option_type = EXCLUDED.option_type,
        strike = EXCLUDED.strike,
        expiry = EXCLUDED.expiry,
        underlying_index = EXCLUDED.underlying_index,
        underlying_price = EXCLUDED.underlying_price,
        mark_price = EXCLUDED.mark_price,
        bid_price = EXCLUDED.bid_price,
        ask_price = EXCLUDED.ask_price,
        last_price = EXCLUDED.last_price,
        volume = EXCLUDED.volume,
        open_interest = EXCLUDED.open_interest,
        iv = EXCLUDED.iv,
        index_price = EXCLUDED.index_price,
        timestamp = EXCLUDED.timestamp,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.pool.query(query, [
      option.instrument_name,
      option.currency,
      option.option_type,
      option.strike,
      option.expiry,
      option.underlying_index,
      option.underlying_price,
      option.mark_price,
      option.bid_price,
      option.ask_price,
      option.last_price,
      option.volume,
      option.open_interest,
      option.iv,
      option.index_price,
      option.timestamp
    ]);
  }

  async upsertGreeks(greeks: Omit<GreeksRecord, 'created_at' | 'updated_at'>): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO deribit_greeks (
        instrument_name, delta, gamma, theta, vega, rho, timestamp, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (instrument_name) DO UPDATE SET
        delta = EXCLUDED.delta,
        gamma = EXCLUDED.gamma,
        theta = EXCLUDED.theta,
        vega = EXCLUDED.vega,
        rho = EXCLUDED.rho,
        timestamp = EXCLUDED.timestamp,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.pool.query(query, [
      greeks.instrument_name,
      greeks.delta,
      greeks.gamma,
      greeks.theta,
      greeks.vega,
      greeks.rho,
      greeks.timestamp
    ]);
  }

  async addTrade(trade: Omit<TradeRecord, 'created_at'>): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO deribit_trades (
        trade_id, instrument_name, direction, amount, price, trade_seq,
        timestamp, notional_value
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (trade_id) DO UPDATE SET
        direction = EXCLUDED.direction,
        amount = EXCLUDED.amount,
        price = EXCLUDED.price,
        trade_seq = EXCLUDED.trade_seq,
        timestamp = EXCLUDED.timestamp,
        notional_value = EXCLUDED.notional_value
    `;

    await this.pool.query(query, [
      trade.trade_id,
      trade.instrument_name,
      trade.direction,
      trade.amount,
      trade.price,
      trade.trade_seq,
      trade.timestamp,
      trade.notional_value
    ]);
  }

  async addAlert(alert: Omit<AlertRecord, 'created_at'>): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO deribit_alerts (
        id, alert_type, instrument_name, message, data, severity, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await this.pool.query(query, [
      alert.id,
      alert.alert_type,
      alert.instrument_name,
      alert.message,
      alert.data,
      alert.severity,
      alert.timestamp
    ]);
  }

  async getOptionsByCurrency(currency: string, expiryFilter?: string): Promise<OptionRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let query = 'SELECT * FROM deribit_options WHERE currency = $1';
    const params: any[] = [currency];

    if (expiryFilter) {
      query += ' AND expiry = $2';
      params.push(expiryFilter);
    }

    query += ' ORDER BY expiry, strike';

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getOptionByInstrument(instrumentName: string): Promise<OptionRecord | null> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = 'SELECT * FROM deribit_options WHERE instrument_name = $1';
    const result = await this.pool.query(query, [instrumentName]);
    return result.rows[0] || null;
  }

  async getGreeksByInstrument(instrumentName: string): Promise<GreeksRecord | null> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = 'SELECT * FROM deribit_greeks WHERE instrument_name = $1';
    const result = await this.pool.query(query, [instrumentName]);
    return result.rows[0] || null;
  }

  async getGreeksByCurrency(currency: string): Promise<GreeksRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      SELECT g.* FROM deribit_greeks g
      JOIN deribit_options o ON g.instrument_name = o.instrument_name
      WHERE o.currency = $1
      ORDER BY o.expiry, o.strike
    `;
    const result = await this.pool.query(query, [currency]);
    return result.rows;
  }

  async getLargeTrades(currency: string, threshold: number, timeframe: string): Promise<TradeRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const timeFilter = this.getTimeFilter(timeframe);
    
    const query = `
      SELECT t.* FROM deribit_trades t
      JOIN deribit_options o ON t.instrument_name = o.instrument_name
      WHERE o.currency = $1 AND t.notional_value >= $2 AND t.timestamp >= $3
      ORDER BY t.notional_value DESC, t.timestamp DESC
    `;

    const result = await this.pool.query(query, [currency, threshold, timeFilter]);
    return result.rows;
  }

  async getAlerts(alertType: string, limit: number): Promise<AlertRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let query = 'SELECT * FROM deribit_alerts';
    const params: any[] = [];

    if (alertType !== 'all') {
      query += ' WHERE alert_type = $1';
      params.push(alertType);
    }

    query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getStats(): Promise<{
    totalOptions: number;
    totalTrades: number;
    totalAlerts: number;
    lastUpdate: string;
  }> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const optionsResult = await this.pool.query('SELECT COUNT(*) as count FROM deribit_options');
    const tradesResult = await this.pool.query('SELECT COUNT(*) as count FROM deribit_trades');
    const alertsResult = await this.pool.query('SELECT COUNT(*) as count FROM deribit_alerts');
    const lastUpdateResult = await this.pool.query('SELECT MAX(updated_at) as last_update FROM deribit_options');

    return {
      totalOptions: parseInt(optionsResult.rows[0].count),
      totalTrades: parseInt(tradesResult.rows[0].count),
      totalAlerts: parseInt(alertsResult.rows[0].count),
      lastUpdate: lastUpdateResult.rows[0].last_update || new Date().toISOString()
    };
  }

  private getTimeFilter(timeframe: string): string {
    const now = new Date();
    let timeAgo: Date;

    switch (timeframe) {
      case '1h':
        timeAgo = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '4h':
        timeAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
        break;
      case '1d':
        timeAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      default:
        timeAgo = new Date(now.getTime() - 60 * 60 * 1000); // Default to 1 hour
    }

    return timeAgo.toISOString();
  }

  async cleanupOldData(): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    // Clean up old trades (keep last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await this.pool.query('DELETE FROM deribit_trades WHERE timestamp < $1', [thirtyDaysAgo]);

    // Clean up old alerts (keep last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await this.pool.query('DELETE FROM deribit_alerts WHERE timestamp < $1', [sevenDaysAgo]);
  }

  async close(): Promise<void> {
    // PostgreSQL connections are managed by the pool, no need to close
  }
}
