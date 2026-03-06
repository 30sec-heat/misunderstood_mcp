import { createMCPHandler } from '../base/response-wrapper.js';
import { TradingClient } from './TradingClient.js';
import { CryptoModule } from '../../index.js';

export class TradingModule implements CryptoModule {
  public name = 'trading';
  public tools: any[] = [];

  private tradingClient: TradingClient;

  constructor() {
    this.tradingClient = new TradingClient();
  }

  async initialize(): Promise<void> {
    this.tools = [
      {
        name: 'trading_fetch_balance',
        description: 'Fetch account balance for spot or futures. Supports Binance and Bybit. Requires API keys in env (BINANCE_API_KEY/SECRET, BYBIT_API_KEY/SECRET).',
        inputSchema: {
          type: 'object',
          properties: {
            marketType: {
              type: 'string',
              enum: ['spot', 'futures'],
              description: 'Market type: spot or futures'
            },
            exchange: {
              type: 'string',
              enum: ['binance', 'bybit'],
              description: 'Exchange to query'
            }
          },
          required: ['marketType', 'exchange']
        },
        handler: this.wrapHandler(async (args: any) => {
          return await this.tradingClient.fetchBalance(
            args.exchange,
            args.marketType
          );
        })
      },
      {
        name: 'trading_fetch_balance_all',
        description: 'Fetch balances from all configured exchanges (spot + futures for each).',
        inputSchema: {
          type: 'object',
          properties: {
            exchange: {
              type: 'string',
              enum: ['binance', 'bybit'],
              description: 'Optional: fetch only for this exchange'
            }
          }
        },
        handler: this.wrapHandler(async (args: any) => {
          return await this.tradingClient.fetchBalanceAll(args?.exchange);
        })
      },
      {
        name: 'trading_create_market_order',
        description: 'Create a market order (instant buy/sell at market price). Supports Binance and Bybit spot and futures.',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Trading symbol (e.g., BTCUSDT, ETH/USDT)'
            },
            side: {
              type: 'string',
              enum: ['buy', 'sell'],
              description: 'Order side'
            },
            amount: {
              type: 'number',
              description: 'Order amount in base currency'
            },
            marketType: {
              type: 'string',
              enum: ['spot', 'futures'],
              description: 'Market type',
              default: 'spot'
            },
            exchange: {
              type: 'string',
              enum: ['binance', 'bybit'],
              description: 'Exchange to use',
              default: 'binance'
            }
          },
          required: ['symbol', 'side', 'amount']
        },
        handler: this.wrapHandler(async (args: any) => {
          return await this.tradingClient.createMarketOrder(
            args.symbol,
            args.side,
            args.amount,
            {
              marketType: args.marketType ?? 'spot',
              exchange: args.exchange ?? 'binance'
            }
          );
        })
      },
      {
        name: 'trading_create_limit_order',
        description: 'Create a limit order (buy/sell at specified price).',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Trading symbol (e.g., BTCUSDT, ETH/USDT)'
            },
            side: {
              type: 'string',
              enum: ['buy', 'sell'],
              description: 'Order side'
            },
            amount: {
              type: 'number',
              description: 'Order amount in base currency'
            },
            price: {
              type: 'number',
              description: 'Limit price'
            },
            marketType: {
              type: 'string',
              enum: ['spot', 'futures'],
              description: 'Market type',
              default: 'spot'
            },
            exchange: {
              type: 'string',
              enum: ['binance', 'bybit'],
              description: 'Exchange to use',
              default: 'binance'
            }
          },
          required: ['symbol', 'side', 'amount', 'price']
        },
        handler: this.wrapHandler(async (args: any) => {
          return await this.tradingClient.createLimitOrder(
            args.symbol,
            args.side,
            args.amount,
            args.price,
            {
              marketType: args.marketType ?? 'spot',
              exchange: args.exchange ?? 'binance'
            }
          );
        })
      },
      {
        name: 'trading_get_open_orders',
        description: 'Get open orders for a symbol.',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Trading symbol'
            },
            marketType: {
              type: 'string',
              enum: ['spot', 'futures'],
              default: 'spot'
            },
            exchange: {
              type: 'string',
              enum: ['binance', 'bybit'],
              default: 'binance'
            }
          },
          required: ['symbol']
        },
        handler: this.wrapHandler(async (args: any) => {
          return await this.tradingClient.getOpenOrders(args.symbol, {
            marketType: args.marketType ?? 'spot',
            exchange: args.exchange ?? 'binance'
          });
        })
      },
      {
        name: 'trading_cancel_order',
        description: 'Cancel an open order.',
        inputSchema: {
          type: 'object',
          properties: {
            orderId: {
              type: 'string',
              description: 'Order ID to cancel'
            },
            symbol: {
              type: 'string',
              description: 'Trading symbol of the order'
            },
            marketType: {
              type: 'string',
              enum: ['spot', 'futures'],
              default: 'spot'
            },
            exchange: {
              type: 'string',
              enum: ['binance', 'bybit'],
              default: 'binance'
            }
          },
          required: ['orderId', 'symbol']
        },
        handler: this.wrapHandler(async (args: any) => {
          return await this.tradingClient.cancelOrder(
            args.orderId,
            args.symbol,
            {
              marketType: args.marketType ?? 'spot',
              exchange: args.exchange ?? 'binance'
            }
          );
        })
      },
      {
        name: 'trading_get_positions',
        description: 'Get open futures positions. Supports Binance and Bybit.',
        inputSchema: {
          type: 'object',
          properties: {
            exchange: {
              type: 'string',
              enum: ['binance', 'bybit'],
              description: 'Exchange to query',
              default: 'binance'
            }
          }
        },
        handler: this.wrapHandler(async (args: any) => {
          return await this.tradingClient.getPositions(args?.exchange ?? 'binance');
        })
      },
      {
        name: 'trading_set_leverage',
        description: 'Set leverage for a futures symbol.',
        inputSchema: {
          type: 'object',
          properties: {
            leverage: {
              type: 'number',
              description: 'Leverage multiplier (e.g., 5 for 5x)'
            },
            symbol: {
              type: 'string',
              description: 'Trading symbol (e.g., BTCUSDT)'
            },
            exchange: {
              type: 'string',
              enum: ['binance', 'bybit'],
              default: 'binance'
            }
          },
          required: ['leverage', 'symbol']
        },
        handler: this.wrapHandler(async (args: any) => {
          return await this.tradingClient.setLeverage(
            args.leverage,
            args.symbol,
            args?.exchange ?? 'binance'
          );
        })
      }
    ];
  }

  private wrapHandler(handler: (args: any) => Promise<any>) {
    return createMCPHandler(handler);
  }
}
