import axios, { AxiosInstance } from 'axios';
import { LiquidationPostgresDatabase, LiquidationRecord, OpenInterestRecord } from './postgres-database.js';

export interface CoinalyzeExchange {
  name: string;
  code: string;
}

export interface CoinalyzeFutureMarket {
  symbol: string;
  exchange: string;
  symbol_on_exchange: string;
  base_asset: string;
  quote_asset: string;
  is_perpetual: boolean;
  margined: 'STABLE' | 'COIN';
  expire_at: number;
  oi_lq_vol_denominated_in: 'BASE_ASSET' | 'QUOTE_ASSET';
  has_long_short_ratio_data: boolean;
  has_ohlcv_data: boolean;
  has_buy_sell_data: boolean;
}

export interface CoinalyzeSpotMarket {
  symbol: string;
  exchange: string;
  symbol_on_exchange: string;
  base_asset: string;
  quote_asset: string;
  has_buy_sell_data: boolean;
}

export interface CoinalyzeLiquidationData {
  symbol: string;
  history: Array<{
    timestamp: number;
    value: number;
  }>;
}

export interface CoinalyzeOpenInterestData {
  symbol: string;
  value: number;
  update: number;
}

export interface CoinalyzeOpenInterestHistory {
  symbol: string;
  history: Array<{
    timestamp: number;
    value: number;
  }>;
}

export class CoinalyzeAPI {
  private api: AxiosInstance;
  private apiKey: string;
  private db: LiquidationPostgresDatabase;
  private baseUrl: string = 'https://api.coinalyze.net';

  constructor(apiKey: string, db: LiquidationPostgresDatabase) {
    this.apiKey = apiKey;
    this.db = db;
    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getSupportedExchanges(): Promise<CoinalyzeExchange[]> {
    try {
      const response = await this.api.get('/exchanges', {
        params: { api_key: this.apiKey }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching supported exchanges:', error);
      throw error;
    }
  }

  async getFutureMarkets(): Promise<CoinalyzeFutureMarket[]> {
    try {
      const response = await this.api.get('/future-markets', {
        params: { api_key: this.apiKey }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching future markets:', error);
      throw error;
    }
  }

  async getSpotMarkets(): Promise<CoinalyzeSpotMarket[]> {
    try {
      const response = await this.api.get('/spot-markets', {
        params: { api_key: this.apiKey }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching spot markets:', error);
      throw error;
    }
  }

  async getCurrentOpenInterest(symbols: string[], convertToUsd: boolean = false): Promise<CoinalyzeOpenInterestData[]> {
    try {
      const response = await this.api.get('/open-interest', {
        params: {
          api_key: this.apiKey,
          symbols: symbols.join(','),
          convert_to_usd: convertToUsd ? 'true' : 'false'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching current open interest:', error);
      throw error;
    }
  }

  async getOpenInterestHistory(
    symbols: string[],
    interval: string,
    from: number,
    to: number,
    convertToUsd: boolean = false
  ): Promise<CoinalyzeOpenInterestHistory[]> {
    try {
      const response = await this.api.get('/open-interest-history', {
        params: {
          api_key: this.apiKey,
          symbols: symbols.join(','),
          interval,
          from,
          to,
          convert_to_usd: convertToUsd ? 'true' : 'false'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching open interest history:', error);
      throw error;
    }
  }

  async getLiquidationHistory(
    symbols: string[],
    interval: string,
    from: number,
    to: number,
    convertToUsd: boolean = false
  ): Promise<CoinalyzeLiquidationData[]> {
    try {
      const response = await this.api.get('/liquidation-history', {
        params: {
          api_key: this.apiKey,
          symbols: symbols.join(','),
          interval,
          from,
          to,
          convert_to_usd: convertToUsd ? 'true' : 'false'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching liquidation history:', error);
      throw error;
    }
  }

  async syncLiquidationData(symbols: string[], timeframe: string = '1hour'): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const from = this.getTimeframeSeconds(timeframe);
      
      const liquidationData = await this.getLiquidationHistory(symbols, timeframe, now - from, now, true);
      
      for (const data of liquidationData) {
        for (const point of data.history) {
          // Coinalyze liquidation data is in coins, not USD
          // We need to estimate USD value based on current price
          // Note: No USD threshold filtering here since we don't have USD values
          const liquidation: Omit<LiquidationRecord, 'created_at'> = {
            id: `coinalyze_${data.symbol}_${point.timestamp}`,
            symbol: data.symbol,
            exchange: 'coinalyze',
            side: 'long', // Coinalyze doesn't provide side information, defaulting to long
            quantity: point.value,
            price: 0, // We don't have price data from Coinalyze
            notional_value: point.value, // This is in coins, not USD
            timestamp: new Date(point.timestamp * 1000).toISOString(),
            source: 'coinalyze_api'
          };

          await this.db.addLiquidation(liquidation);
        }
      }

      console.log(`Synced liquidation data for ${symbols.length} symbols from Coinalyze`);
    } catch (error) {
      console.error('Error syncing liquidation data:', error);
      throw error;
    }
  }

  async syncOpenInterestData(symbols: string[]): Promise<void> {
    try {
      const openInterestData = await this.getCurrentOpenInterest(symbols, true);
      
      for (const data of openInterestData) {
        const openInterest: Omit<OpenInterestRecord, 'id' | 'created_at'> = {
          symbol: data.symbol,
          exchange: 'coinalyze',
          value: data.value,
          timestamp: new Date(data.update * 1000).toISOString(),
          source: 'coinalyze_api'
        };

        await this.db.addOpenInterest(openInterest);
      }

      console.log(`Synced open interest data for ${symbols.length} symbols from Coinalyze`);
    } catch (error) {
      console.error('Error syncing open interest data:', error);
      throw error;
    }
  }

  async syncHistoricalOpenInterest(
    symbols: string[],
    timeframe: string = '1hour',
    days: number = 7
  ): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const from = now - (days * 24 * 60 * 60);
      
      const openInterestHistory = await this.getOpenInterestHistory(symbols, timeframe, from, now, true);
      
      for (const data of openInterestHistory) {
        for (const point of data.history) {
          const openInterest: Omit<OpenInterestRecord, 'id' | 'created_at'> = {
            symbol: data.symbol,
            exchange: 'coinalyze',
            value: point.value,
            timestamp: new Date(point.timestamp * 1000).toISOString(),
            source: 'coinalyze_api'
          };

          await this.db.addOpenInterest(openInterest);
        }
      }

      console.log(`Synced historical open interest data for ${symbols.length} symbols from Coinalyze`);
    } catch (error) {
      console.error('Error syncing historical open interest data:', error);
      throw error;
    }
  }

  private getTimeframeSeconds(timeframe: string): number {
    switch (timeframe) {
      case '1min': return 60;
      case '5min': return 5 * 60;
      case '15min': return 15 * 60;
      case '30min': return 30 * 60;
      case '1hour': return 60 * 60;
      case '2hour': return 2 * 60 * 60;
      case '4hour': return 4 * 60 * 60;
      case '6hour': return 6 * 60 * 60;
      case '12hour': return 12 * 60 * 60;
      case 'daily': return 24 * 60 * 60;
      default: return 60 * 60; // Default to 1 hour
    }
  }

  async getPopularSymbols(limit: number = 20): Promise<string[]> {
    try {
      const futureMarkets = await this.getFutureMarkets();
      const spotMarkets = await this.getSpotMarkets();
      
      // Combine and deduplicate symbols
      const allSymbols = new Set<string>();
      
      futureMarkets.forEach(market => {
        allSymbols.add(market.symbol);
      });
      
      spotMarkets.forEach(market => {
        allSymbols.add(market.symbol);
      });
      
      return Array.from(allSymbols).slice(0, limit);
    } catch (error) {
      console.error('Error getting popular symbols:', error);
      // Return default popular symbols if API fails
      return [
        'BTCUSDT_PERP',
        'ETHUSDT_PERP',
        'ADAUSDT_PERP',
        'SOLUSDT_PERP',
        'DOTUSDT_PERP',
        'LINKUSDT_PERP',
        'LTCUSDT_PERP',
        'BCHUSDT_PERP',
        'XRPUSDT_PERP',
        'AVAXUSDT_PERP'
      ].slice(0, limit);
    }
  }
}
