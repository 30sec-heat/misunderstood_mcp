# Deribit Module

The Deribit module provides comprehensive integration with the Deribit cryptocurrency options exchange API, offering advanced features for options trading analysis, Greeks calculations, large trade detection, and mispricing analysis.

## Features

### Core Functionality
- **Option Chain Retrieval**: Get complete option chains for BTC and ETH with real-time pricing
- **Greeks Calculations**: Access Delta, Gamma, Theta, Vega, and Rho for all options
- **Large Trade Detection**: Monitor and alert on unusually large trades
- **Mispricing Analysis**: Compare option prices with external probability sources (e.g., Polymarket)
- **Real-time Data Sync**: Background synchronization of options data every 5 minutes

### Advanced Analytics
- **Implied Probability Calculations**: Convert option prices to implied probabilities
- **Deviation Analysis**: Detect significant deviations between options and prediction markets
- **Trade Monitoring**: Track large trades with configurable thresholds
- **Alert System**: Comprehensive alerting for various market conditions

## API Tools

### `deribit_get_option_chain`
Retrieve option chain data for BTC or ETH with Greeks included automatically.

**Parameters:**
- `currency` (string): Base currency - 'BTC' or 'ETH' (default: 'BTC')
- `expiry` (string): Expiry date to get options for (e.g., "27DEC24"). If not provided, returns the nearest expiry.
- `include_greeks` (boolean): Include Greeks calculations (default: true)

**Example:**
```typescript
const result = await deribitModule.getOptionChain({
  currency: 'BTC',
  expiry: '27DEC24',
  include_greeks: true
});
```

### `deribit_analyze_mispricing`
Compare option prices with external probability sources to detect mispricings.

**Parameters:**
- `currency` (string): Base currency - 'BTC' or 'ETH' (default: 'BTC')
- `threshold_percentage` (number): Minimum deviation percentage to flag (default: 10)
- `expiry_filter` (string): Filter by expiry date (YYYY-MM-DD)

**Example:**
```typescript
const result = await deribitModule.analyzeMispricing({
  currency: 'BTC',
  threshold_percentage: 15,
  expiry_filter: '2024-12-27'
});
```

### `deribit_calculate_price_probabilities`
Calculate probability of BTC/ETH reaching specific price levels.

**Parameters:**
- `currency` (string): Base currency - 'BTC' or 'ETH' (default: 'BTC')
- `target_prices` (array): Array of target prices to calculate probabilities for
- `time_horizon` (number): Time horizon in days (default: 30)
- `current_price` (number): Current underlying price (optional, will fetch if not provided)

**Example:**
```typescript
const result = await deribitModule.calculatePriceProbabilities({
  currency: 'BTC',
  target_prices: [100000, 120000, 80000],
  time_horizon: 30
});
```

### `deribit_comprehensive_analysis`
Comprehensive volatility surface analysis and risk metrics calculation.

**Parameters:**
- `currency` (string): Base currency - 'BTC' or 'ETH' (default: 'BTC')
- `analysis_type` (string): Type of analysis - 'volatility_only', 'risk_only', 'comprehensive' (default: 'comprehensive')
- `portfolio_strikes` (array): Array of strike prices in portfolio (required for risk analysis)
- `portfolio_quantities` (array): Array of quantities for each strike (required for risk analysis)
- `time_horizon` (number): Risk analysis time horizon in days (default: 1)

**Example:**
```typescript
const result = await deribitModule.comprehensiveAnalysis({
  currency: 'BTC',
  analysis_type: 'comprehensive',
  portfolio_strikes: [90000, 100000, 110000],
  portfolio_quantities: [1, -2, 1],
  time_horizon: 7
});
```

### `deribit_analyze_iv`
Get comprehensive implied volatility analysis including term structure, smile, and IV vs HV comparison.

**Parameters:**
- `currency` (string): Base currency - 'BTC' or 'ETH' (default: 'BTC')

**Example:**
```typescript
const result = await deribitModule.analyzeIV({
  currency: 'BTC'
});
```

## Configuration

### Environment Variables
Add the following to your `.env` file:

```bash
# Deribit API Configuration (Optional - for options data)
# Deribit module uses public API endpoints - no credentials needed
```

### Public API Usage
The module uses Deribit's public API endpoints which don't require authentication. All options data is fetched in real-time directly from Deribit's public API.

## Database Schema

The module uses SQLite database with the following tables:

### `options`
Stores option instrument data including pricing and Greeks.

### `greeks`
Stores detailed Greeks calculations for each option.

### `trades`
Stores trade data for large trade detection.

### `alerts`
Stores generated alerts for various market conditions.

## Usage Examples

### Basic Option Chain Analysis
```typescript
import { DeribitModule } from './modules/deribit/index.js';

const deribit = new DeribitModule();
await deribit.initialize();

// Get BTC option chain
const btcOptions = await deribit.getOptionChain({ currency: 'BTC' });
console.log(`Found ${btcOptions.total_options} BTC options`);

// Get ETH option chain with Greeks
const ethOptions = await deribit.getOptionChain({ 
  currency: 'ETH', 
  include_greeks: true 
});
```

### Large Trade Monitoring
```typescript
// Monitor for trades above $2M
const largeTrades = await deribit.getLargeTrades({
  currency: 'BTC',
  threshold: 2000000,
  timeframe: '1h'
});

if (largeTrades.total_trades > 0) {
  console.log(`Alert: ${largeTrades.total_trades} large trades detected`);
}
```

### Mispricing Detection
```typescript
// Detect mispricings above 20% deviation
const mispricings = await deribit.analyzeMispricing({
  currency: 'BTC',
  threshold_percentage: 20
});

mispricings.mispricings.forEach(mispricing => {
  console.log(`${mispricing.instrument_name}: ${mispricing.deviation_percentage.toFixed(2)}% ${mispricing.alert_type}`);
});
```

### Greeks Analysis
```typescript
// Get Greeks for specific option
const greeks = await deribit.getGreeks({
  instrument_name: 'BTC-27DEC24-100000-C'
});

if (greeks.greeks) {
  console.log(`Delta: ${greeks.greeks.delta}`);
  console.log(`Gamma: ${greeks.greeks.gamma}`);
  console.log(`Theta: ${greeks.greeks.theta}`);
  console.log(`Vega: ${greeks.greeks.vega}`);
  console.log(`Rho: ${greeks.greeks.rho}`);
}
```

## Integration with Other Modules

The Deribit module is designed to integrate with other modules in the system:

### Polymarket Integration
- Compare option-implied probabilities with Polymarket prediction market odds
- Detect arbitrage opportunities between options and prediction markets
- Cross-validate market sentiment between derivatives and prediction markets

### Telegram Integration
- Send alerts for large trades and mispricings
- Provide real-time options data updates
- Share volatility surface analysis

## Performance Considerations

- **Rate Limiting**: The module implements proper rate limiting for Deribit API calls
- **Background Sync**: Data synchronization happens every 5 minutes to minimize API usage
- **Database Optimization**: Efficient indexing and query optimization for fast data retrieval
- **Memory Management**: Proper cleanup of old data to maintain performance

## Error Handling

The module includes comprehensive error handling:

- **API Failures**: Graceful handling of API timeouts and errors
- **Authentication Issues**: Automatic token refresh and re-authentication
- **Database Errors**: Proper error logging and recovery
- **Network Issues**: Retry logic for transient network problems

## Testing

Run the Deribit module tests:

```bash
npm test -- tests/deribit
```

Test the module manually:

```bash
npx tsx scripts/test-deribit.ts
```

## Dependencies

- `pg`: PostgreSQL database operations
- `axios`: HTTP client for API calls
- `fs`: File system operations
- `path`: Path utilities

## License

MIT License - see main project license for details.
