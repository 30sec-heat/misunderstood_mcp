# Streaming Architecture for Automated Strategies

Real-time data feeds for strategy execution. Supports **price/OHLC WebSockets** and **message monitoring** (Telegram).

## Components

### PriceStreamManager
- WebSocket connections to Binance (spot + futures) and Bybit (linear) for ticker data
- In-memory price cache updated in real-time
- Call `subscribe(symbols)` to add symbols; `getPrice(symbol)` for latest price
- Emits `price` events for reactive strategies

### LivePriceFeed
- Wraps PriceStreamManager + REST fallback (PriceFetcher)
- Strategy executor uses this: WebSocket when connected, REST when stale/missing
- `subscribe(symbols)` - starts WebSocket streams for those symbols
- `getPrice(symbol)` - returns cached or fetches via REST

### MessageStreamBridge
- Polls `telegram_messages` for new rows
- `getMatchingMessagesSince(filter, since)` - messages matching chatIds/keywords/regex
- Used by MessageTriggerStrategy: "when channel X posts Y, execute Z"
- Requires `setPool(pgPool)` with Telegram DB pool

## Strategy Types

### ConditionalStrategy (price-based)
- `condition.type: 'price' | 'percent_change'`
- Evaluated each poll using LivePriceFeed (WebSocket-first)
- When condition met → execute action

### MessageTriggerStrategy (message-based)
- `strategyType: 'message_trigger'`
- `source: 'telegram'`
- `chatIds`, `keywords`, `regex` - filter for matching messages
- When new message matches → execute action

## Example strategies.json

```json
{
  "strategies": [
    {
      "id": "btc-100k-long",
      "strategyType": "conditional",
      "condition": { "type": "price", "operator": "gt", "value": 100000, "symbol": "BTC" },
      "action": { "action": "long", "symbol": "BTC", "exchange": "binance", "marketType": "spot" },
      "enabled": true
    },
    {
      "id": "tg-pump-alert",
      "strategyType": "message_trigger",
      "source": "telegram",
      "chatIds": ["-1001234567890"],
      "keywords": ["pump", "moon", "buy signal"],
      "action": { "action": "long", "symbol": "BTC", "exchange": "binance", "marketType": "spot", "size": 0.001 },
      "enabled": true
    }
  ]
}
```

## Server Integration

The server-lite (and automated-backend) wires:
1. **LivePriceFeed** - subscribes to symbols from active strategies
2. **MessageStreamBridge** - gets Telegram pool, polls for new messages
3. **Executor** - checks both price and message triggers each poll

Restart server after adding strategies. WebSocket streams connect automatically for symbols in use.
