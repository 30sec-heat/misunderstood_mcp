import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import { ExchangeManager } from '../forecasting/tools/ExchangeManager.js';
import { getOrderFlowGlossary } from './glossary.js';
import { detectFairValueGaps } from './fvg-detector.js';
import { computeSymbolCorrelation } from './correlation.js';
import type { OHLCVBar } from './fvg-detector.js';

const SUPPORTED_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];
const SUPPORTED_EXCHANGES = ['coinbase', 'mexc', 'bitget', 'kucoin', 'gate', 'binance', 'bybit', 'okx', 'kraken'];

function normalizeSymbol(symbol: string): string {
  const s = symbol.replace(/\//g, '').toUpperCase();
  if (s.endsWith('USDT')) return s;
  return `${s}USDT`;
}

function rawToOHLCVBar(c: number[]): OHLCVBar {
  return {
    timestamp: c[0],
    open: c[1],
    high: c[2],
    low: c[3],
    close: c[4],
    volume: c[5] ?? 0,
  };
}

export class OrderFlowModule extends BaseCryptoModule {
  name = 'orderflow';
  private exchangeManager: ExchangeManager;

  constructor() {
    super();
    this.exchangeManager = new ExchangeManager();
    this.setupTools();
  }

  protected setupTools(): void {
    // 1. get_ohlcv_history
    this.addTool({
      name: 'get_ohlcv_history',
      description:
        'Fetch large amounts of historical OHLCV bars (up to 1000+) with pagination. Supports multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d). Returns structured bars with timestamp, o, h, l, c, v.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTCUSDT, BTC/USDT, ETH)',
          },
          timeframe: {
            type: 'string',
            description: 'Candlestick timeframe',
            enum: SUPPORTED_TIMEFRAMES,
            default: '1h',
          },
          limit: {
            type: 'number',
            description: 'Number of bars to fetch (up to 5000 with pagination)',
            default: 1000,
          },
          exchange: {
            type: 'string',
            description: 'Optional exchange to use (otherwise auto-select)',
            enum: SUPPORTED_EXCHANGES,
          },
        },
        required: ['symbol'],
      },
      handler: this.getOHLCVHistory.bind(this),
    });

    // 2. get_orderflow_glossary
    this.addTool({
      name: 'get_orderflow_glossary',
      description:
        'Returns structured order flow terminology and concepts for LLM context: FVG, liquidity pools, order blocks, BOS, CHoCH, imbalance zones, etc.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: this.getGlossary.bind(this),
    });

    // 3. technical_detect_fvg
    this.addTool({
      name: 'technical_detect_fvg',
      description:
        'Detect Fair Value Gaps (FVGs) on OHLCV history. Bull FVG: low of candle 3 > high of candle 1. Bear FVG: high of candle 3 < low of candle 1. Returns FVGs with price levels and strength.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol (e.g., BTCUSDT)',
          },
          timeframe: {
            type: 'string',
            description: 'Timeframe for analysis',
            enum: SUPPORTED_TIMEFRAMES,
            default: '1h',
          },
          limit: {
            type: 'number',
            description: 'Number of candles to fetch for FVG detection',
            default: 500,
          },
          exchange: {
            type: 'string',
            description: 'Optional exchange',
            enum: SUPPORTED_EXCHANGES,
          },
        },
        required: ['symbol'],
      },
      handler: this.detectFVG.bind(this),
    });

    // 4. get_symbol_correlation
    this.addTool({
      name: 'get_symbol_correlation',
      description:
        'Compute Pearson correlation of returns between two symbols. Uses OHLCV close prices, computes returns, then correlates. Useful for pair trading and diversification.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol1: {
            type: 'string',
            description: 'First symbol (e.g., BTCUSDT)',
          },
          symbol2: {
            type: 'string',
            description: 'Second symbol (e.g., ETHUSDT)',
          },
          timeframe: {
            type: 'string',
            description: 'Timeframe for price data',
            enum: SUPPORTED_TIMEFRAMES,
            default: '1h',
          },
          limit: {
            type: 'number',
            description: 'Number of candles to use',
            default: 500,
          },
          exchange: {
            type: 'string',
            description: 'Optional exchange',
            enum: SUPPORTED_EXCHANGES,
          },
        },
        required: ['symbol1', 'symbol2'],
      },
      handler: this.getCorrelation.bind(this),
    });
  }

  private async getOHLCVHistory(args: {
    symbol: string;
    timeframe?: string;
    limit?: number;
    exchange?: string;
  }) {
    const symbol = normalizeSymbol(args.symbol);
    const timeframe = args.timeframe || '1h';
    const limit = Math.min(Math.max(args.limit || 1000, 1), 5000);
    const exchange = args.exchange;

    const { data, exchange: usedExchange } = await this.exchangeManager.fetchOHLCVPaginated(
      symbol,
      timeframe,
      limit,
      exchange
    );

    const bars = data.map((c) => ({
      timestamp: c[0],
      o: c[1],
      h: c[2],
      l: c[3],
      c: c[4],
      v: c[5] ?? 0,
    }));

    return {
      symbol,
      timeframe,
      exchange: usedExchange,
      bars,
      count: bars.length,
      message: `Fetched ${bars.length} OHLCV bars for ${symbol} from ${usedExchange || 'auto'}`,
    };
  }

  private async getGlossary() {
    const { terms, count } = getOrderFlowGlossary();
    return {
      glossary: terms,
      count,
      message: `Order flow glossary: ${count} terms for LLM context`,
    };
  }

  private async detectFVG(args: {
    symbol: string;
    timeframe?: string;
    limit?: number;
    exchange?: string;
  }) {
    const symbol = normalizeSymbol(args.symbol);
    const timeframe = args.timeframe || '1h';
    const limit = Math.min(Math.max(args.limit || 500, 10), 2000);
    const exchange = args.exchange;

    const raw = await this.exchangeManager.fetchOHLCV(symbol, timeframe, limit, exchange);
    const ohlcv: OHLCVBar[] = raw.map(rawToOHLCVBar);

    const fvgs = detectFairValueGaps(ohlcv);

    const bullFvgs = fvgs.filter((f) => f.type === 'bull');
    const bearFvgs = fvgs.filter((f) => f.type === 'bear');

    return {
      symbol,
      timeframe,
      totalFvgs: fvgs.length,
      bullFvgs,
      bearFvgs,
      candleCount: ohlcv.length,
      message: `Detected ${fvgs.length} FVGs (${bullFvgs.length} bull, ${bearFvgs.length} bear) on ${ohlcv.length} candles`,
    };
  }

  private async getCorrelation(args: {
    symbol1: string;
    symbol2: string;
    timeframe?: string;
    limit?: number;
    exchange?: string;
  }) {
    const s1 = normalizeSymbol(args.symbol1);
    const s2 = normalizeSymbol(args.symbol2);
    const timeframe = args.timeframe || '1h';
    const limit = Math.min(Math.max(args.limit || 500, 10), 2000);
    const exchange = args.exchange;

    const [raw1, raw2] = await Promise.all([
      this.exchangeManager.fetchOHLCV(s1, timeframe, limit, exchange),
      this.exchangeManager.fetchOHLCV(s2, timeframe, limit, exchange),
    ]);

    const ohlcv1: OHLCVBar[] = raw1.map(rawToOHLCVBar);
    const ohlcv2: OHLCVBar[] = raw2.map(rawToOHLCVBar);

    const result = computeSymbolCorrelation(ohlcv1, ohlcv2, s1, s2);

    return {
      ...result,
      timeframe,
      message: `Pearson correlation (${result.period} overlapping returns): ${result.correlation}`,
    };
  }

  async cleanup(): Promise<void> {
    if (this.exchangeManager && typeof this.exchangeManager.destroy === 'function') {
      this.exchangeManager.destroy();
    }
    await super.cleanup();
  }
}
