#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Environment Setup Script
 * Creates .env file from template and validates configuration
 */

const ENV_TEMPLATE = `# MCP Crypto Server Environment Configuration

# Server Configuration
NODE_ENV=production
MCP_PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,https://cursor.sh

# Database Configuration (REQUIRED)
# Configure these with your PostgreSQL credentials
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=crypto_data
POSTGRES_USER=your_postgres_username
POSTGRES_PASSWORD=your_postgres_password

# Telegram Configuration (Optional)
# Note: Session is stored in .session file, not environment variables
# Run 'npx tsx utils/telegram-auth.ts' to authenticate and create .session file
# API credentials are only needed during initial authentication
TELEGRAM_API_ID=
TELEGRAM_API_HASH=

# Polymarket API Configuration
POLYMARKET_API_BASE_URL=https://gamma-api.polymarket.com

# CoinDesk API Configuration (Optional)
COINDESK_API_KEY=your_coindesk_api_key_here

# Pyth Network Configuration
PYTH_NETWORK_RPC_URL=https://api.mainnet-beta.solana.com
PYTH_NETWORK_CLUSTER=mainnet-beta

# Exchange API Keys (Optional - for enhanced data access)
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET_KEY=your_binance_secret_key
BYBIT_API_KEY=your_bybit_api_key
BYBIT_SECRET_KEY=your_bybit_secret_key

# Deribit API Configuration (Optional - for options data)
# Deribit module uses public API endpoints - no credentials needed

# Coinalyze API Configuration (Optional - for liquidation data)
COINALYZE_API_KEY=your_coinalyze_api_key_here

# Logging Configuration
LOG_LEVEL=info
# Options: error, warn, info, debug

# Health Check Configuration
HEALTH_CHECK_INTERVAL=30000
# Health check interval in milliseconds (default: 30 seconds)

# Data Sync Configuration
POLYMARKET_SYNC_INTERVAL=86400000
# Polymarket sync interval in milliseconds (default: 24 hours)

TELEGRAM_SYNC_INTERVAL=3600000
# Telegram sync interval in milliseconds (default: 1 hour)

# Performance Configuration
MAX_CONCURRENT_REQUESTS=10
REQUEST_TIMEOUT=30000
# Request timeout in milliseconds (default: 30 seconds)

# Security Configuration
# Add any security-related environment variables here
API_RATE_LIMIT=100
# Rate limit per minute

# MCP Server Security (Auto-generated)
MCP_API_KEY=
`;

async function setupEnvironment() {
  console.log('🔧 Setting up environment configuration...');
  
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), 'env.example');
  
  try {
    // Check if .env already exists
    if (fs.existsSync(envPath)) {
      console.log('⚠️  .env file already exists');
      const response = await askQuestion('Do you want to overwrite it? (y/N): ');
      if (response.toLowerCase() !== 'y' && response.toLowerCase() !== 'yes') {
        console.log('✅ Keeping existing .env file');
        return;
      }
    }
    
    // Create .env from template
    console.log('📝 Creating .env file from template...');
    fs.writeFileSync(envPath, ENV_TEMPLATE);
    console.log('✅ .env file created successfully');
    
    // Validate required environment variables
    console.log('🔍 Validating environment configuration...');
    const requiredVars = [
      'POSTGRES_HOST',
      'POSTGRES_PORT', 
      'POSTGRES_DATABASE',
      'POSTGRES_USER',
      'POSTGRES_PASSWORD'
    ];
    
    const missingVars = [];
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    }
    
    if (missingVars.length > 0) {
      console.log('⚠️  Please update these required variables in .env:');
      missingVars.forEach(varName => {
        console.log(`   - ${varName}`);
      });
    } else {
      console.log('✅ All required environment variables are configured');
    }
    
    // Check optional configurations
    console.log('📋 Optional configurations to consider:');
    const optionalConfigs = [
      { key: 'TELEGRAM_SESSION_STRING', description: 'Telegram bot session for message monitoring' },
      { key: 'BINANCE_API_KEY', description: 'Binance API for enhanced trading data' },
      // Deribit module uses public API endpoints - no credentials needed
      { key: 'COINALYZE_API_KEY', description: 'Coinalyze API for liquidation data' },
      { key: 'MCP_API_KEY', description: 'API key for remote MCP server authentication' }
    ];
    
    optionalConfigs.forEach(config => {
      if (!process.env[config.key] || process.env[config.key]?.includes('your_')) {
        console.log(`   - ${config.key}: ${config.description}`);
      }
    });
    
    console.log('🎉 Environment setup complete!');
    console.log('💡 Edit .env file to customize your configuration');
    
  } catch (error) {
    console.error('❌ Environment setup failed:', error);
    process.exit(1);
  }
}

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupEnvironment();
}

export { setupEnvironment };
