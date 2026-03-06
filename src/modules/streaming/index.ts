/**
 * Streaming Module - MCP tools for price/message stream status
 */

import { BaseCryptoModule } from '../base/module.js';
import { priceStreamManager } from '../../streaming/price-stream-manager.js';
import { messageStreamBridge } from '../../streaming/message-stream-bridge.js';

export class StreamingModule extends BaseCryptoModule {
  name = 'streaming';

  constructor() {
    super();
    this.setupTools();
  }

  async initialize(): Promise<void> {
    await super.initialize();
  }

  protected setupTools(): void {
    this.addTool({
      name: 'streaming_get_status',
      description:
        'Get status of real-time data streams: price WebSockets (Binance, Bybit) and message bridge (Telegram). Used by strategies for pricing and message-trigger monitoring.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: this.getStatus.bind(this),
    });

    this.addTool({
      name: 'streaming_subscribe_prices',
      description:
        'Subscribe to WebSocket price streams for symbols. Call before running strategies that need real-time prices. Returns subscribed symbols.',
      inputSchema: {
        type: 'object',
        properties: {
          symbols: {
            type: 'array',
            items: { type: 'string' },
            description: 'Symbols to subscribe (e.g. BTC, ETH, BTCUSDT)',
          },
        },
        required: ['symbols'],
      },
      handler: this.subscribePrices.bind(this),
    });
  }

  private async getStatus(): Promise<any> {
    return {
      priceStreams: {
        connected: priceStreamManager.isConnected(),
        subscribedSymbols: priceStreamManager.getSubscribedSymbols(),
      },
      messageBridge: {
        hasPool: messageStreamBridge.hasPool(),
      },
      message:
        'Price WebSockets feed strategy executor. Message bridge polls Telegram for message-trigger strategies.',
    };
  }

  private async subscribePrices(args: { symbols: string[] }): Promise<any> {
    const syms = args.symbols || [];
    if (syms.length === 0) {
      return { success: false, error: 'symbols array required' };
    }
    priceStreamManager.subscribe(syms);
    return {
      success: true,
      subscribed: syms,
      message: `Subscribed to ${syms.length} symbol(s). Price updates flow to strategy executor.`,
    };
  }
}
