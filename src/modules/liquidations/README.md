# Liquidation Module

A comprehensive module for monitoring cryptocurrency liquidations and open interest data in real-time.

## Features

- **Real-time Binance WebSocket**: Listens to Binance liquidation events and open interest updates
- **Coinalyze API Integration**: Fetches historical liquidation data across multiple exchanges
- **Database Storage**: Stores all liquidation and open interest data in PostgreSQL
- **Analysis Tools**: Provides comprehensive analysis of liquidation patterns and trends
- **Alerts**: Identifies high-value liquidations and unusual market activity

## Components

### Database (`database.ts`)
- Stores liquidation records with symbol, exchange, side, quantity, price, and notional value
- Tracks open interest data with timestamps
- Provides query methods for analysis and reporting

### Binance WebSocket (`binance-websocket.ts`)
- Connects to Binance futures WebSocket streams
- Listens to `!forceOrder@arr` for liquidation events
- Listens to `!openInterest@arr` for open interest updates
- Handles reconnection and error recovery

### Coinalyze API (`coinalyze-api.ts`)
- Integrates with Coinalyze API for historical data
- Fetches liquidation history across multiple exchanges
- Syncs open interest data from various sources
- Provides fallback data when WebSocket is unavailable

### Analysis Tools (`tools/LiquidationAnalysisTool.ts`)
- Analyzes liquidation patterns and trends
- Identifies most liquidated coins
- Compares exchanges and market share
- Generates alerts for high-value liquidations
- Tracks open interest changes

## Usage

### Basic Setup

```typescript
import { LiquidationModule } from './modules/liquidations/index.js';

const liquidationModule = new LiquidationModule({
  coinalyzeApiKey: process.env.COINALYZE_API_KEY,
  enableBinanceWebSocket: true,
  enableCoinalyzeSync: true,
  syncInterval: 5 * 60 * 1000, // 5 minutes
});

await liquidationModule.initialize();
```

### Query Examples

```typescript
// Get most liquidated coins in the last hour
const mostLiquidated = await liquidationModule.getTopLiquidatedCoinsLastHour(10);

// Get recent large liquidations
const largeLiquidations = await liquidationModule.getRecentLargeLiquidations(100000, 20);

// Get liquidation analysis for a specific symbol
const analysis = await liquidationModule.getLiquidationAnalysis('BTCUSDT', 'binance', '1h');

// Get open interest analysis
const oiAnalysis = await liquidationModule.getOpenInterestAnalysis('BTCUSDT');

// Get market overview
const overview = await liquidationModule.getMarketOverview('1h');

// Get liquidation alerts
const alerts = await liquidationModule.getLiquidationAlerts(500000);
```

### Configuration Options

```typescript
interface LiquidationModuleConfig {
  coinalyzeApiKey?: string;        // Coinalyze API key for historical data
  enableBinanceWebSocket?: boolean; // Enable Binance WebSocket (default: true)
  enableCoinalyzeSync?: boolean;    // Enable Coinalyze sync (default: true)
  syncInterval?: number;            // Sync interval in milliseconds (default: 5 minutes)
  dbPath?: string;                  // Custom database path
}
```

## Data Sources

### Binance WebSocket
- **Liquidations**: Real-time force order events
- **Open Interest**: Real-time open interest updates
- **Coverage**: Binance futures markets only

### Coinalyze API
- **Liquidations**: Historical data across multiple exchanges
- **Open Interest**: Current and historical open interest data
- **Coverage**: 20+ exchanges including Binance, Bybit, OKX, etc.

## Database Schema

### Liquidations Table
```sql
CREATE TABLE liquidations (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  exchange TEXT NOT NULL,
  side TEXT NOT NULL,           -- 'long' or 'short'
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  notional_value REAL NOT NULL,
  timestamp TEXT NOT NULL,
  source TEXT NOT NULL,         -- 'binance_ws' or 'coinalyze_api'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Open Interest Table
```sql
CREATE TABLE open_interest (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  exchange TEXT NOT NULL,
  value REAL NOT NULL,
  timestamp TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Analysis Capabilities

### Liquidation Analysis
- Total liquidations and notional value
- Long vs short liquidation ratios
- Largest liquidation events
- Average liquidation size
- Liquidation rate (per hour)

### Open Interest Analysis
- Current vs previous open interest
- Percentage changes
- Historical trends
- Exchange comparisons

### Market Overview
- Top liquidated coins
- Exchange market share
- High-value alerts
- Overall market statistics

## Environment Variables

Add to your `.env` file:

```bash
# Coinalyze API Configuration (Optional)
COINALYZE_API_KEY=your_coinalyze_api_key_here
```

## Testing

Run the test script to see the module in action:

```bash
tsx scripts/test-liquidations.ts
```

This will:
1. Initialize the module
2. Connect to Binance WebSocket
3. Sync data from Coinalyze
4. Display real-time analysis
5. Keep running to monitor live data

## Rate Limits

- **Binance WebSocket**: No rate limits for WebSocket connections
- **Coinalyze API**: 40 calls per minute per API key
- **Database**: PostgreSQL handles high-frequency writes efficiently

## Error Handling

- Automatic WebSocket reconnection
- Graceful API failure handling
- Database transaction safety
- Comprehensive error logging

## Performance

- Efficient PostgreSQL indexing for fast queries
- Minimal memory footprint
- Optimized WebSocket message handling
- Background data synchronization

## Use Cases

- **Trading**: Monitor liquidation events for trading opportunities
- **Risk Management**: Track open interest changes and liquidation patterns
- **Market Analysis**: Understand market sentiment and positioning
- **Alerts**: Get notified of significant liquidation events
- **Research**: Analyze historical liquidation data and trends
