import { BaseCryptoModule } from '../base/module.js';
import * as massiveClient from './client.js';

/**
 * Massive API module - Options and stocks data (quotes, snapshots, contracts, OHLC).
 * Uses MASSIVE_API_KEY from env.
 * API: https://massive.com/docs (Polygon.io)
 */
export class MassiveModule extends BaseCryptoModule {
  name = 'massive';

  constructor() {
    super();
    this.setupTools();
  }

  protected setupTools() {
    this.addTool({
      name: 'massive_options_quote',
      description: 'Get options quote for an options ticker.',
      inputSchema: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'Options ticker (e.g., O:AAPL251219C00150000)',
          },
        },
        required: ['ticker'],
      },
      handler: async (args: { ticker: string }) => massiveClient.getOptionsQuote(args.ticker),
    });

    this.addTool({
      name: 'massive_options_snapshot',
      description: 'Get options snapshot for an underlying and contract.',
      inputSchema: {
        type: 'object',
        properties: {
          underlying: {
            type: 'string',
            description: 'Underlying stock ticker (e.g., AAPL)',
          },
          contract: {
            type: 'string',
            description: 'Contract identifier',
          },
        },
        required: ['underlying', 'contract'],
      },
      handler: async (args: { underlying: string; contract: string }) =>
        massiveClient.getOptionsSnapshot(args.underlying, args.contract),
    });

    this.addTool({
      name: 'massive_options_contracts',
      description: 'Get options contracts. Filter by underlying and/or expiry.',
      inputSchema: {
        type: 'object',
        properties: {
          underlying: {
            type: 'string',
            description: 'Underlying stock ticker',
          },
          expiry: {
            type: 'string',
            description: 'Expiration date (YYYY-MM-DD)',
          },
          limit: {
            type: 'number',
            description: 'Max results',
            default: 100,
          },
        },
      },
      handler: async (args: { underlying?: string; expiry?: string; limit?: number }) =>
        massiveClient.getOptionsContracts({
          underlying: args.underlying,
          expirationDate: args.expiry,
          limit: args.limit ?? 100,
        }),
    });

    this.addTool({
      name: 'massive_stock_aggs',
      description: 'Get stock OHLC aggregates (bars) for a ticker over a date range.',
      inputSchema: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'Stock ticker (e.g., AAPL)',
          },
          from: {
            type: 'string',
            description: 'Start date (YYYY-MM-DD or Unix ms)',
          },
          to: {
            type: 'string',
            description: 'End date (YYYY-MM-DD or Unix ms)',
          },
          timespan: {
            type: 'string',
            enum: ['minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'],
            description: 'Bar timespan',
            default: 'day',
          },
        },
        required: ['ticker', 'from', 'to'],
      },
      handler: async (args: { ticker: string; from: string; to: string; timespan?: string }) =>
        massiveClient.getStockAggs(
          args.ticker,
          args.from,
          args.to,
          (args.timespan as 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year') || 'day'
        ),
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }
}
