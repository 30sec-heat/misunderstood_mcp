#!/usr/bin/env tsx

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupDatabase() {
  console.log(' Setting up PostgreSQL database...');
  
  const config = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: 'postgres', // Connect to default postgres database first
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    ssl: false,
  };

  const pool = new Pool(config);
  
  try {
    // Test connection
    const client = await pool.connect();
    console.log(' Connected to PostgreSQL');
    
    // Create database if it doesn't exist
    const dbName = process.env.POSTGRES_DATABASE || 'crypto_data';
    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );
    
    if (result.rows.length === 0) {
      console.log(` Creating database: ${dbName}`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(` Database ${dbName} created successfully`);
    } else {
      console.log(` Database ${dbName} already exists`);
    }
    
    client.release();
    await pool.end();
    
    console.log(' Database setup complete!');
  } catch (error) {
    console.error(' Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();
