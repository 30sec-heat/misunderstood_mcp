import { Pool, Client } from 'pg';
import * as path from 'path';
import * as fs from 'fs';

export interface PostgresConfig {
  name: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

export class PostgresManager {
  private static instance: PostgresManager;
  private pools: Map<string, Pool> = new Map();
  private configs: Map<string, PostgresConfig> = new Map();

  private constructor() {
    // Ensure data directory exists for migrations
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  static getInstance(): PostgresManager {
    if (!PostgresManager.instance) {
      PostgresManager.instance = new PostgresManager();
    }
    return PostgresManager.instance;
  }

  registerDatabase(config: PostgresConfig): void {
    this.configs.set(config.name, config);
    
    // Get database config from environment variables
    const dbConfig = {
      host: config.host || process.env.POSTGRES_HOST || 'localhost',
      port: config.port || parseInt(process.env.POSTGRES_PORT || '5432'),
      database: config.database || process.env.POSTGRES_DATABASE || 'crypto_data',
      user: config.user || process.env.POSTGRES_USER || 'postgres',
      password: config.password || process.env.POSTGRES_PASSWORD || 'password',
      ssl: config.ssl || false,
    };
    
    const pool = new Pool(dbConfig);
    
    this.pools.set(config.name, pool);
    // Database registered successfully
  }

  async getPool(name: string): Promise<Pool> {
    const pool = this.pools.get(name);
    if (!pool) {
      throw new Error(`Database pool '${name}' not found`);
    }
    return pool;
  }

  async query(name: string, text: string, params?: any[]): Promise<any> {
    const pool = await this.getPool(name);
    return pool.query(text, params);
  }

  async executeTransaction(name: string, queries: Array<{text: string, params?: any[]}>): Promise<void> {
    const pool = await this.getPool(name);
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const query of queries) {
        await client.query(query.text, query.params);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createTables(name: string): Promise<void> {
    // Schema creation is handled by individual modules during initialization
    // This method is kept for compatibility
  }

  async getClient(name: string = 'default'): Promise<any> {
    const pool = await this.getPool(name);
    return pool.connect();
  }

  async closeAll(): Promise<void> {
    for (const [name, pool] of this.pools) {
      await pool.end();
      console.log(`[LOCK] Closed database pool: ${name}`);
    }
    this.pools.clear();
    this.configs.clear();
  }
}