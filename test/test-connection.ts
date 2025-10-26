#!/usr/bin/env tsx

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Connection Test Script
 * Tests database connectivity and basic functionality
 */

async function testConnection() {
  console.log('🔍 Testing database connection...');
  
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
    console.log('📊 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Test basic query
    const result = await client.query('SELECT version()');
    console.log('📋 PostgreSQL version:', result.rows[0].version);
    
    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log(`✅ Found ${tablesResult.rows.length} tables in database`);
      console.log('📋 Tables:', tablesResult.rows.map(r => r.table_name).join(', '));
    } else {
      console.log('⚠️  No tables found - tables will be created when modules initialize');
    }
    
    // Test MCP server modules
    console.log('🧪 Testing MCP server modules...');
    try {
      // Import and test a module
      const { PolymarketModule } = await import('../src/modules/polymarket/index.js');
      const module = new PolymarketModule();
      console.log('✅ Polymarket module loaded successfully');
    } catch (error) {
      console.log('⚠️  Module test failed (this might be expected):', error.message);
    }
    
    client.release();
    await pool.end();
    
    console.log('🎉 Connection test completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testConnection().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { testConnection };
