/**
 * Direct Deribit API Client
 * Fetches real-time options data without needing database
 */

import axios from 'axios';

interface DeribitSummary {
  timestamp?: number;
  bid_price?: number;
  ask_price?: number;
  mark_price?: number;
  mark_iv?: number;
  last_price?: number;
  open_interest?: number;
  volume?: number;
  volume_usd?: number;
  bid_iv?: number;
  ask_iv?: number;
  interest_rate?: number;
  // Fallback properties for alternative API field names
  best_bid_price?: number;
  best_ask_price?: number;
  mid_price?: number;
  implied_volatility?: number;
  last?: number;
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
    rho?: number;
  };
  stats?: {
    volume?: number;
    price_change?: number;
    high?: number;
    low?: number;
  };
}

export interface DeribitOption {
  instrument_name: string;
  underlying_price: number;
  underlying_index: string;
  timestamp: number;
  strike: number;
  option_type: 'call' | 'put';
  bid_price: number;
  ask_price: number;
  mark_price: number;
  mark_iv: number;
  last_price: number | null;
  open_interest: number;
  volume: number;
  volume_usd: number | null;
  bid_iv: number | null;
  ask_iv: number | null;
  interest_rate: number;
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
  };
  stats: {
    volume_24h: number;
    price_change: number;
    high: number;
    low: number;
  };
}

export class DeribitAPIClient {
  private baseUrl = 'https://www.deribit.com/api/v2/public';
  
  /**
   * Get options for a currency with current market data
   * @param currency - BTC or ETH
   * @param expiry - Optional expiry filter (e.g., "27DEC24")
   */
  async getOptionsChain(currency: 'BTC' | 'ETH', expiry?: string): Promise<{
    options: DeribitOption[];
    spot_price: number;
    index_name: string;
    timestamp: Date;
  }> {
    try {
      console.log(`Fetching options chain for ${currency}...`);
      
      // First get the index price
      const indexResponse = await axios.get(`${this.baseUrl}/get_index_price`, {
        params: { index_name: `${currency.toLowerCase()}_usd` }
      });
      
      const spotPrice = indexResponse.data.result.index_price;
      console.log(`Spot price for ${currency}: $${spotPrice}`);
      
      // Get all active option instruments
      const instrumentsResponse = await axios.get(`${this.baseUrl}/get_instruments`, {
        params: {
          currency: currency,
          kind: 'option',
          expired: false
        }
      });
      
      let instruments = instrumentsResponse.data.result;
      console.log(`Found ${instruments.length} option instruments`);
      
      // Filter by expiry if provided
      if (expiry) {
        instruments = instruments.filter((inst: any) => 
          inst.instrument_name.includes(expiry.toUpperCase())
        );
        console.log(`Filtered to ${instruments.length} instruments for expiry ${expiry}`);
      }
      
      // Get order book summaries for all options (includes IV but NOT Greeks)
      const summaryResponse = await axios.get(`${this.baseUrl}/get_book_summary_by_currency`, {
        params: {
          currency: currency,
          kind: 'option'
        }
      });
      
      let summaries = summaryResponse.data.result;
      
      // Filter summaries by expiry if provided
      if (expiry) {
        summaries = summaries.filter((summary: any) => 
          summary.instrument_name.includes(expiry.toUpperCase())
        );
      }
      
      console.log(`Found ${summaries.length} option summaries`);
      
      const summaryMap = new Map(summaries.map((s: any) => [s.instrument_name, s]));
      
      // Get Greeks data for a small sample of the most liquid options
      // Focus on near-the-money options for better Greeks data
      const currentPrice = spotPrice;
      const nearMoneyInstruments = instruments
        .filter((inst: any) => {
          const summary = summaryMap.get(inst.instrument_name);
          if (!summary || !(summary as any).mark_price || (summary as any).mark_price <= 0) return false;
          
          // Parse strike price from instrument name
          const parts = inst.instrument_name.split('-');
          const strike = parseFloat(parts[2]);
          
          // Only get Greeks for options within 20% of current price (most liquid)
          const moneyness = Math.abs(strike - currentPrice) / currentPrice;
          return moneyness <= 0.2;
        })
        .slice(0, 20); // Limit to 20 most relevant options
      
      console.log(`Fetching Greeks for ${nearMoneyInstruments.length} near-the-money options...`);
      
      const greeksMap = new Map();
      
      // Fetch Greeks sequentially to avoid rate limits and ensure reliability
      for (const inst of nearMoneyInstruments) {
        try {
          const tickerResponse = await axios.get(`${this.baseUrl}/ticker`, {
            params: { instrument_name: inst.instrument_name }
          });
          const ticker = tickerResponse.data.result;
          
          if (ticker.greeks) {
            greeksMap.set(inst.instrument_name, ticker.greeks);
            console.log(`✓ Got Greeks for ${inst.instrument_name}: δ=${ticker.greeks.delta?.toFixed(4)}`);
          }
          
          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.warn(`Failed to get Greeks for ${inst.instrument_name}:`, error instanceof Error ? error.message : String(error));
        }
      }
      
      // Parse and combine data
      const options: DeribitOption[] = instruments.map((inst: any) => {
        const summary: DeribitSummary = summaryMap.get(inst.instrument_name) || {};
        const greeks = greeksMap.get(inst.instrument_name);
        
        // Parse instrument name (e.g., "BTC-29DEC23-50000-C")
        const parts = inst.instrument_name.split('-');
        const strike = parseFloat(parts[2]);
        const optionType = parts[3] === 'C' ? 'call' : 'put';
        
        // Extract pricing data from summary
        const bidPrice = summary.bid_price || summary.best_bid_price || 0;
        const askPrice = summary.ask_price || summary.best_ask_price || 0;
        const markPrice = summary.mark_price || summary.mid_price || 0;
        
        return {
          instrument_name: inst.instrument_name,
          underlying_price: spotPrice,
          underlying_index: inst.underlying_index,
          timestamp: summary.timestamp || Date.now(),
          strike: strike,
          option_type: optionType,
          bid_price: bidPrice,
          ask_price: askPrice,
          mark_price: markPrice,
          mark_iv: summary.mark_iv || summary.implied_volatility || 0,
          last_price: summary.last_price || summary.last || 0,
          open_interest: summary.open_interest || 0,
          volume: summary.volume || 0,
          volume_usd: summary.volume_usd,
          bid_iv: summary.bid_iv,
          ask_iv: summary.ask_iv,
          interest_rate: summary.interest_rate || 0,
          greeks: {
            delta: greeks?.delta || 0,
            gamma: greeks?.gamma || 0,
            theta: greeks?.theta || 0,
            vega: greeks?.vega || 0,
            rho: greeks?.rho || 0
          },
          stats: {
            volume_24h: summary.stats?.volume || 0,
            price_change: summary.stats?.price_change || 0,
            high: summary.stats?.high || 0,
            low: summary.stats?.low || 0
          }
        };
      });
      
      // Validate data before returning
      const validOptions = options.filter(option =>
        option.underlying_price > 0 &&
        option.strike > 0 &&
        option.instrument_name.length > 0
      );
      
      if (validOptions.length === 0) {
        throw new Error('No valid options data received from Deribit API');
      }
      
      console.log(`[SUCCESS] Fetched ${validOptions.length} valid options with prices`);
      
      const optionsWithGreeks = validOptions.filter(opt => 
        opt.greeks.delta !== 0 || opt.greeks.gamma !== 0 || opt.greeks.theta !== 0 || opt.greeks.vega !== 0
      );
      
      console.log(`Greeks map size: ${greeksMap.size}`);
      console.log(`Returning ${validOptions.length} total options, ${optionsWithGreeks.length} with Greeks data`);
      
      return {
        options: validOptions,
        spot_price: spotPrice,
        index_name: `${currency.toLowerCase()}_usd`,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('Error fetching Deribit options:', error);
      throw error;
    }
  }
  
  /**
   * Get volatility index
   */
  async getVolatilityIndex(currency: 'BTC' | 'ETH'): Promise<number> {
    try {
      const response = await axios.get(`${this.baseUrl}/get_volatility_index_data`, {
        params: {
          currency: currency,
          resolution: '1D',
          count: 1
        }
      });
      
      const data = response.data.result.data;
      return data[data.length - 1][4]; // Close value
      
    } catch (error) {
      console.error('Error fetching volatility index:', error);
      throw error;
    }
  }
  
  /**
   * Get historical volatility
   */
  async getHistoricalVolatility(currency: 'BTC' | 'ETH'): Promise<{
    hv_30d: number;
    hv_60d: number;
    hv_90d: number;
  }> {
    try {
      const response = await axios.get(`${this.baseUrl}/get_historical_volatility`, {
        params: { currency: currency }
      });
      
      const result = response.data.result;
      return {
        hv_30d: result[0][1] / 100, // Convert from percentage
        hv_60d: result[1][1] / 100,
        hv_90d: result[2][1] / 100
      };
      
    } catch (error) {
      console.error('Error fetching historical volatility:', error);
      // Return defaults if API fails
      return {
        hv_30d: 0.6,
        hv_60d: 0.65,
        hv_90d: 0.7
      };
    }
  }
}
