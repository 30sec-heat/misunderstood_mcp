/**
 * Streaming / Real-time data for automated strategies
 *
 * - PriceStreamManager: WebSocket price/ticker streams (Binance, Bybit)
 * - LivePriceFeed: Unified feed (WebSocket + REST fallback)
 * - MessageStreamBridge: Telegram/message monitoring for message-triggered strategies
 */

export {
  PriceStreamManager,
  priceStreamManager,
  type PriceUpdate,
  type KlineUpdate,
} from './price-stream-manager.js';

export {
  LivePriceFeed,
  type LivePriceFeedOptions,
} from './live-price-feed.js';

export {
  MessageStreamBridge,
  messageStreamBridge,
  type MessageEvent,
  type MessageFilter,
} from './message-stream-bridge.js';
