import { BaseCryptoModule } from '../base/module.js';
import { EarningsFeed } from 'earningsfeed';

/**
 * Earnings Feed API module - SEC filings, insider transactions, institutional holdings, company profiles.
 * Uses EARNINGSFEED_API_KEY from env.
 * API: https://earningsfeed.com/api/docs
 */
export class EarningsFeedModule extends BaseCryptoModule {
  name = 'earningsfeed';
  private client: EarningsFeed | null = null;

  constructor() {
    super();
    this.setupTools();
  }

  private getClient(): EarningsFeed {
    const apiKey = process.env.EARNINGSFEED_API_KEY;
    if (!apiKey) {
      throw new Error('EARNINGSFEED_API_KEY is not set in environment');
    }
    if (!this.client) {
      this.client = new EarningsFeed(apiKey, {
        baseUrl: process.env.EARNINGSFEED_API_BASE_URL || 'https://earningsfeed.com',
        timeout: 30000,
      });
    }
    return this.client;
  }

  protected setupTools() {
    this.addTool({
      name: 'earningsfeed_get_filings',
      description: 'Get SEC filings (10-K, 10-Q, 8-K, etc.) for a ticker. Filter by form type and limit results.',
      inputSchema: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'Stock ticker symbol (e.g., AAPL, MSFT)',
          },
          formType: {
            type: 'string',
            description: 'Filter by SEC form type (e.g., 10-K, 10-Q, 8-K, 4)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of filings to return',
            default: 25,
          },
        },
        required: ['ticker'],
      },
      handler: this.getFilings.bind(this),
    });

    this.addTool({
      name: 'earningsfeed_insider_transactions',
      description: 'Get insider transactions (Form 3/4/5) for a ticker.',
      inputSchema: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'Stock ticker symbol',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of transactions to return',
            default: 50,
          },
        },
        required: ['ticker'],
      },
      handler: this.getInsiderTransactions.bind(this),
    });

    this.addTool({
      name: 'earningsfeed_institutional_holdings',
      description: 'Get institutional holdings (13F) for a ticker.',
      inputSchema: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'Stock ticker symbol',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of holdings to return',
            default: 50,
          },
        },
        required: ['ticker'],
      },
      handler: this.getInstitutionalHoldings.bind(this),
    });

    this.addTool({
      name: 'earningsfeed_company_profile',
      description: 'Get company profile for a ticker (description, tickers, SIC codes, addresses, etc.).',
      inputSchema: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'Stock ticker symbol',
          },
        },
        required: ['ticker'],
      },
      handler: this.getCompanyProfile.bind(this),
    });
  }

  private async getFilings(args: { ticker: string; formType?: string; limit?: number }) {
    const client = this.getClient();
    const limit = Math.min(args.limit ?? 25, 100);
    const forms = args.formType ? (Array.isArray(args.formType) ? args.formType : [args.formType]) : undefined;
    const res = await client.filings.list({
      ticker: args.ticker.toUpperCase(),
      forms,
      limit,
    });
    return {
      items: res.items,
      total: res.items.length,
      hasMore: res.hasMore,
      ticker: args.ticker,
    };
  }

  private async getInsiderTransactions(args: { ticker: string; limit?: number }) {
    const client = this.getClient();
    const limit = Math.min(args.limit ?? 50, 100);
    const res = await client.insider.list({
      ticker: args.ticker.toUpperCase(),
      limit,
    });
    return {
      items: res.items,
      total: res.items.length,
      hasMore: res.hasMore,
      ticker: args.ticker,
    };
  }

  private async getInstitutionalHoldings(args: { ticker: string; limit?: number }) {
    const client = this.getClient();
    const limit = Math.min(args.limit ?? 50, 100);
    const res = await client.institutional.list({
      ticker: args.ticker.toUpperCase(),
      limit,
    });
    return {
      items: res.items,
      total: res.items.length,
      hasMore: res.hasMore,
      ticker: args.ticker,
    };
  }

  private async getCompanyProfile(args: { ticker: string }) {
    const client = this.getClient();
    const searchRes = await client.companies.search({
      ticker: args.ticker.toUpperCase(),
      limit: 1,
    });
    if (!searchRes.items.length) {
      return { error: `No company found for ticker ${args.ticker}` };
    }
    const match = searchRes.items[0];
    const profile = await client.companies.get(match.cik);
    return profile;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }
}
