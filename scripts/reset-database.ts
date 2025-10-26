#!/usr/bin/env tsx

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Database Reset Script
 * Drops all tables and recreates the complete schema
 * [WARNING] This will delete all data!
 */

const DROP_ALL_TABLES_SQL = `
-- Drop all tables in dependency order (foreign keys first)
DROP TABLE IF EXISTS deribit_greeks CASCADE;
DROP TABLE IF EXISTS deribit_trades CASCADE;
DROP TABLE IF EXISTS deribit_alerts CASCADE;
DROP TABLE IF EXISTS deribit_options CASCADE;
DROP TABLE IF EXISTS deribit_instruments CASCADE;

DROP TABLE IF EXISTS polymarket_price_history CASCADE;
DROP TABLE IF EXISTS polymarket_outcomes CASCADE;
DROP TABLE IF EXISTS polymarket_comments CASCADE;
DROP TABLE IF EXISTS polymarket_markets CASCADE;

DROP TABLE IF EXISTS reddit_comments CASCADE;
DROP TABLE IF EXISTS reddit_posts CASCADE;

DROP TABLE IF EXISTS telegram_messages CASCADE;
DROP TABLE IF EXISTS quote_prices CASCADE;
DROP TABLE IF EXISTS quote_exchange_mentions CASCADE;
DROP TABLE IF EXISTS liquidations CASCADE;

-- Drop functions and triggers
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
`;

async function resetDatabase() {
  console.log('  [WARNING] This will delete ALL data in the database!');
  console.log(' Resetting database schema...');
  
  const config = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'crypto_data',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };

  const pool = new Pool(config);
  
  try {
    console.log(' Connecting to database...');
    const client = await pool.connect();
    console.log(' Connected to PostgreSQL');
    
    console.log('  Dropping all existing tables...');
    await client.query(DROP_ALL_TABLES_SQL);
    console.log(' All tables dropped successfully');
    
    client.release();
    await pool.end();
    
    console.log(' Database reset complete. Run create-database-schema to recreate tables.');
  } catch (error) {
    console.error(' Database reset failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  resetDatabase();
}

export { resetDatabase };
