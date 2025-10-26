import { Pool } from 'pg';
import { PostgresManager } from '../base/postgres-manager.js';

export interface MarketRecord {
  id: string;
  question: string;
  description: string;
  image: string;
  endDate: string;
  closed: boolean;
  archived: boolean;
  active: boolean;
  volume: number;
  liquidity: number;
  createdAt: string;
  updatedAt: string;
  lastSynced: string;
}

export interface OutcomeRecord {
  id: number;
  marketId: string;
  name: string;
  price: number;
  probability: number;
  createdAt: string;
  updatedAt: string;
}

export interface PriceHistoryRecord {
  id: number;
  marketId: string;
  outcomeName: string;
  price: number;
  volume: number;
  timestamp: string;
}


export class PolymarketPostgresDatabase {
  private postgresManager: PostgresManager;
  private pool: Pool | null = null;

  constructor() {
    this.postgresManager = PostgresManager.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      // Register the database
      this.postgresManager.registerDatabase({
        name: 'polymarket',
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DATABASE || 'mcp_crypto',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
      });

      // Get the pool
      this.pool = await this.postgresManager.getPool('polymarket');

      // Create tables
      await this.createTables();
      console.log('[SUCCESS] Polymarket PostgreSQL database initialized');
    } catch (error) {
      console.error('[ERROR] Failed to initialize Polymarket PostgreSQL database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const createTablesSQL = `
      -- Markets table
      CREATE TABLE IF NOT EXISTS polymarket_markets (
        id VARCHAR(255) PRIMARY KEY,
        question TEXT,
        description TEXT,
        image TEXT,
        end_date TIMESTAMP,
        closed BOOLEAN DEFAULT FALSE,
        archived BOOLEAN DEFAULT FALSE,
        active BOOLEAN DEFAULT TRUE,
        volume DECIMAL(20,8) DEFAULT 0,
        liquidity DECIMAL(20,8) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Outcomes table
      CREATE TABLE IF NOT EXISTS polymarket_outcomes (
        id SERIAL PRIMARY KEY,
        market_id VARCHAR(255) REFERENCES polymarket_markets(id),
        name VARCHAR(255),
        price DECIMAL(10,6) DEFAULT 0,
        probability DECIMAL(10,6) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Price history table
      CREATE TABLE IF NOT EXISTS polymarket_price_history (
        id SERIAL PRIMARY KEY,
        market_id VARCHAR(255) REFERENCES polymarket_markets(id),
        outcome_name VARCHAR(255),
        price DECIMAL(10,6) DEFAULT 0,
        volume DECIMAL(20,8) DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );


      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_polymarket_markets_active ON polymarket_markets(active);
      CREATE INDEX IF NOT EXISTS idx_polymarket_markets_end_date ON polymarket_markets(end_date);
      CREATE INDEX IF NOT EXISTS idx_polymarket_outcomes_market_id ON polymarket_outcomes(market_id);
      CREATE INDEX IF NOT EXISTS idx_polymarket_price_history_market_id ON polymarket_price_history(market_id);
    `;

    await this.pool.query(createTablesSQL);
  }

  async upsertMarket(market: MarketRecord): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO polymarket_markets (
        id, question, description, image, end_date, closed, archived, active,
        volume, liquidity, created_at, updated_at, last_synced
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        question = EXCLUDED.question,
        description = EXCLUDED.description,
        image = EXCLUDED.image,
        end_date = EXCLUDED.end_date,
        closed = EXCLUDED.closed,
        archived = EXCLUDED.archived,
        active = EXCLUDED.active,
        volume = EXCLUDED.volume,
        liquidity = EXCLUDED.liquidity,
        updated_at = EXCLUDED.updated_at,
        last_synced = EXCLUDED.last_synced
    `;

    await this.pool.query(query, [
      market.id,
      market.question,
      market.description,
      market.image,
      market.endDate,
      market.closed,
      market.archived,
      market.active,
      market.volume,
      market.liquidity,
      market.createdAt,
      market.updatedAt,
      market.lastSynced
    ]);
  }

  async getActiveMarkets(limit: number = 50, category?: string): Promise<MarketRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let query = `
      SELECT id, question, description, image, end_date, closed, archived, active,
             volume, liquidity, created_at, updated_at, last_synced
      FROM polymarket_markets
      WHERE active = true AND closed = false AND archived = false
    `;

    const params: any[] = [];

    if (category) {
      query += ` AND question ILIKE $${params.length + 1}`;
      params.push(`%${category}%`);
    }

    query += ` ORDER BY volume DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.pool.query(query, params);
    
    return result.rows.map(row => ({
      id: row.id,
      question: row.question,
      description: row.description,
      image: row.image,
      endDate: row.end_date,
      closed: row.closed,
      archived: row.archived,
      active: row.active,
      volume: parseFloat(row.volume),
      liquidity: parseFloat(row.liquidity),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastSynced: row.last_synced
    }));
  }

  async getMarketById(marketId: string): Promise<MarketRecord | null> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      SELECT id, question, description, image, end_date, closed, archived, active,
             volume, liquidity, created_at, updated_at, last_synced
      FROM polymarket_markets
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [marketId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      question: row.question,
      description: row.description,
      image: row.image,
      endDate: row.end_date,
      closed: row.closed,
      archived: row.archived,
      active: row.active,
      volume: parseFloat(row.volume),
      liquidity: parseFloat(row.liquidity),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastSynced: row.last_synced
    };
  }

  async upsertOutcomes(marketId: string, outcomes: Array<{name: string, price: number, probability: number}>): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    // Delete existing outcomes for this market
    await this.pool.query('DELETE FROM polymarket_outcomes WHERE market_id = $1', [marketId]);

    // Insert new outcomes
    for (const outcome of outcomes) {
      await this.pool.query(
        'INSERT INTO polymarket_outcomes (market_id, name, price, probability) VALUES ($1, $2, $3, $4)',
        [marketId, outcome.name, outcome.price, outcome.probability]
      );
    }
  }

  async getOutcomesByMarketId(marketId: string): Promise<OutcomeRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      SELECT id, market_id, name, price, probability, created_at, updated_at
      FROM polymarket_outcomes
      WHERE market_id = $1
      ORDER BY name
    `;

    const result = await this.pool.query(query, [marketId]);
    
    return result.rows.map(row => ({
      id: row.id,
      marketId: row.market_id,
      name: row.name,
      price: parseFloat(row.price),
      probability: parseFloat(row.probability),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async addPriceHistory(marketId: string, outcomeName: string, price: number, volume: number): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    await this.pool.query(
      'INSERT INTO polymarket_price_history (market_id, outcome_name, price, volume) VALUES ($1, $2, $3, $4)',
      [marketId, outcomeName, price, volume]
    );
  }

  async getPriceHistory(marketId: string, timeframe: string = '1d'): Promise<PriceHistoryRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let timeFilter = '';
    const params: any[] = [marketId];

    switch (timeframe) {
      case '1h':
        timeFilter = 'AND timestamp >= NOW() - INTERVAL \'1 hour\'';
        break;
      case '4h':
        timeFilter = 'AND timestamp >= NOW() - INTERVAL \'4 hours\'';
        break;
      case '1d':
        timeFilter = 'AND timestamp >= NOW() - INTERVAL \'1 day\'';
        break;
      case '1w':
        timeFilter = 'AND timestamp >= NOW() - INTERVAL \'1 week\'';
        break;
    }

    const query = `
      SELECT id, market_id, outcome_name, price, volume, timestamp
      FROM polymarket_price_history
      WHERE market_id = $1 ${timeFilter}
      ORDER BY timestamp DESC
    `;

    const result = await this.pool.query(query, params);
    
    return result.rows.map(row => ({
      id: row.id,
      marketId: row.market_id,
      outcomeName: row.outcome_name,
      price: parseFloat(row.price),
      volume: parseFloat(row.volume),
      timestamp: row.timestamp
    }));
  }




  async getStats(): Promise<{activeMarkets: number, totalMarkets: number}> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const result = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE active = true AND closed = false) as active_markets,
        COUNT(*) as total_markets
      FROM polymarket_markets
    `);

    const row = result.rows[0];
    return {
      activeMarkets: parseInt(row.active_markets),
      totalMarkets: parseInt(row.total_markets)
    };
  }

  async getAllMarkets(limit: number = 50, category?: string): Promise<MarketRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let query = `
      SELECT id, question, description, image, end_date, closed, archived, active,
             volume, liquidity, created_at, updated_at, last_synced
      FROM polymarket_markets
    `;

    const params: any[] = [];

    if (category) {
      query += ` WHERE question ILIKE $${params.length + 1}`;
      params.push(`%${category}%`);
    }

    query += ` ORDER BY volume DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.pool.query(query, params);
    
    return result.rows.map(row => ({
      id: row.id,
      question: row.question,
      description: row.description,
      image: row.image,
      endDate: row.end_date,
      closed: row.closed,
      archived: row.archived,
      active: row.active,
      volume: parseFloat(row.volume),
      liquidity: parseFloat(row.liquidity),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastSynced: row.last_synced
    }));
  }

  async getClosedMarkets(limit: number = 50, category?: string): Promise<MarketRecord[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    let query = `
      SELECT id, question, description, image, end_date, closed, archived, active,
             volume, liquidity, created_at, updated_at, last_synced
      FROM polymarket_markets
      WHERE closed = true
    `;

    const params: any[] = [];

    if (category) {
      query += ` AND question ILIKE $${params.length + 1}`;
      params.push(`%${category}%`);
    }

    query += ` ORDER BY volume DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.pool.query(query, params);
    
    return result.rows.map(row => ({
      id: row.id,
      question: row.question,
      description: row.description,
      image: row.image,
      endDate: row.end_date,
      closed: row.closed,
      archived: row.archived,
      active: row.active,
      volume: parseFloat(row.volume),
      liquidity: parseFloat(row.liquidity),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastSynced: row.last_synced
    }));
  }

  async cleanupOldData(): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    // Clean up old price history (keep last 30 days)
    await this.pool.query(`
      DELETE FROM polymarket_price_history 
      WHERE timestamp < NOW() - INTERVAL '30 days'
    `);

  }


  async close(): Promise<void> {
    // PostgreSQL connections are managed by the pool, no need to close
  }
}
