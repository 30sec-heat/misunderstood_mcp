import { createMCPHandler } from '../base/response-wrapper.js';
import { TradingClient } from './TradingClient.js';
import { CryptoModule } from '../../index.js';

const CLIENT_SIDE_TRADING_MSG = {
  message:
    'Order execution requires API keys. For security, keys are NEVER sent to the server. ' +
    'Use the Trading/Orders section in the webapp: add your keys to the Keys Vault (stored in your browser only), ' +
    'then place orders from the client. The server provides read-only market data only (ticker, orderbook, trades).',
  useClientSideTrading: true,
};

export class TradingModule implements CryptoModule {
  public name = 'trading';
  public tools: any[] = [];

  private tradingClient: TradingClient;

  constructor() {
    this.tradingClient = new TradingClient();
  }

  async initialize(): Promise<void> {
    this.tools = [
      // --- Read-only market data (no keys required) ---
      {
        name: 'trading_get_ticker',
        description:
          'Get current ticker (price, volume, 24h change) for a symbol. Read-only, no API keys required. Supports Binance and Bybit spot/futures.',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Trading symbol (e.g., BTCUSDT, ETH/USDT)' },
            marketType: {
              type: 'string',
              enum: ['spot', 'futures'],
              description: 'Market type',
              default: 'spot',
            },
            exchange: {
              type: 'string',
              enum: ['binance', 'bybit'],
              description: 'Exchange',
              default: 'binance',
            },
          },
          required: ['symbol'],
        },
        handler: this.wrapHandler(async (args: any) => {
          return await this.tradingClient.fetchTicker(
            args.symbol,
            args.marketType ?? 'spot',
            args.exchange ?? 'binance'
          );
        }),
      },
      {
        name: 'trading_get_orderbook',
        description:
          'Get order book (bids/asks) for a symbol. Read-only, no API keys required.',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Trading symbol' },
            limit: { type: 'number', description: 'Depth limit (default 20)', default: 20 },
            marketType: { type: 'string', enum: ['spot', 'futures'], default: 'spot' },
            exchange: { type: 'string', enum: ['binance', 'bybit'], default: 'binance' },
          },
          required: ['symbol'],
        },
        handler: this.wrapHandler(async (args: any) => {
          return await this.tradingClient.fetchOrderBook(
            args.symbol,
            args.marketType ?? 'spot',
            args.exchange ?? 'binance',
            args.limit ?? 20
          );
        }),
      },
      {
        name: 'trading_get_recent_trades',
        description:
          'Get recent trades for a symbol. Read-only, no API keys required.',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Trading symbol' },
            limit: { type: 'number', description: 'Number of trades (default 50)', default: 50 },
            marketType: { type: 'string', enum: ['spot', 'futures'], default: 'spot' },
            exchange: { type: 'string', enum: ['binance', 'bybit'], default: 'binance' },
          },
          required: ['symbol'],
        },
        handler: this.wrapHandler(async (args: any) => {
          return await this.tradingClient.fetchTrades(
            args.symbol,
            args.marketType ?? 'spot',
            args.exchange ?? 'binance',
            args.limit ?? 50
          );
        }),
      },
      // --- Private/execution tools: redirect to client-side ---
      {
        name: 'trading_fetch_balance',
        description:
          'Fetch account balance. REQUIRES API KEYS - use the webapp Keys Vault and Trading section. Server never stores keys.',
        inputSchema: {
          type: 'object',
          properties: {
            marketType: { type: 'string', enum: ['spot', 'futures'] },
            exchange: { type: 'string', enum: ['binance', 'bybit'] },
          },
          required: ['marketType', 'exchange'],
        },
        handler: this.wrapHandler(async () => CLIENT_SIDE_TRADING_MSG),
      },
      {
        name: 'trading_fetch_balance_all',
        description:
          'Fetch balances from all exchanges. Use webapp Keys Vault + Trading section.',
        inputSchema: { type: 'object', properties: { exchange: { type: 'string', enum: ['binance', 'bybit'] } } },
        handler: this.wrapHandler(async () => CLIENT_SIDE_TRADING_MSG),
      },
      {
        name: 'trading_create_market_order',
        description:
          'Create market order. Use webapp Trading section with keys in Keys Vault (browser only).',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            side: { type: 'string', enum: ['buy', 'sell'] },
            amount: { type: 'number' },
            marketType: { type: 'string', enum: ['spot', 'futures'], default: 'spot' },
            exchange: { type: 'string', enum: ['binance', 'bybit'], default: 'binance' },
          },
          required: ['symbol', 'side', 'amount'],
        },
        handler: this.wrapHandler(async () => CLIENT_SIDE_TRADING_MSG),
      },
      {
        name: 'trading_create_limit_order',
        description: 'Create limit order. Use webapp Trading section.',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            side: { type: 'string', enum: ['buy', 'sell'] },
            amount: { type: 'number' },
            price: { type: 'number' },
            marketType: { type: 'string', enum: ['spot', 'futures'], default: 'spot' },
            exchange: { type: 'string', enum: ['binance', 'bybit'], default: 'binance' },
          },
          required: ['symbol', 'side', 'amount', 'price'],
        },
        handler: this.wrapHandler(async () => CLIENT_SIDE_TRADING_MSG),
      },
      {
        name: 'trading_get_open_orders',
        description: 'Get open orders. Use webapp Trading section with Keys Vault.',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            marketType: { type: 'string', enum: ['spot', 'futures'], default: 'spot' },
            exchange: { type: 'string', enum: ['binance', 'bybit'], default: 'binance' },
          },
          required: ['symbol'],
        },
        handler: this.wrapHandler(async () => CLIENT_SIDE_TRADING_MSG),
      },
      {
        name: 'trading_cancel_order',
        description: 'Cancel order. Use webapp Trading section.',
        inputSchema: {
          type: 'object',
          properties: {
            orderId: { type: 'string' },
            symbol: { type: 'string' },
            marketType: { type: 'string', enum: ['spot', 'futures'], default: 'spot' },
            exchange: { type: 'string', enum: ['binance', 'bybit'], default: 'binance' },
          },
          required: ['orderId', 'symbol'],
        },
        handler: this.wrapHandler(async () => CLIENT_SIDE_TRADING_MSG),
      },
      {
        name: 'trading_get_positions',
        description: 'Get futures positions. Use webapp Trading section.',
        inputSchema: {
          type: 'object',
          properties: { exchange: { type: 'string', enum: ['binance', 'bybit'], default: 'binance' } },
        },
        handler: this.wrapHandler(async () => CLIENT_SIDE_TRADING_MSG),
      },
      {
        name: 'trading_set_leverage',
        description: 'Set leverage. Use webapp Trading section.',
        inputSchema: {
          type: 'object',
          properties: {
            leverage: { type: 'number' },
            symbol: { type: 'string' },
            exchange: { type: 'string', enum: ['binance', 'bybit'], default: 'binance' },
          },
          required: ['leverage', 'symbol'],
        },
        handler: this.wrapHandler(async () => CLIENT_SIDE_TRADING_MSG),
      },
    ];
  }

  private wrapHandler(handler: (args: any) => Promise<any>) {
    return createMCPHandler(handler);
  }
}
