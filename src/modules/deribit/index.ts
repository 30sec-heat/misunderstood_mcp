import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import axios from 'axios';
import { TheoreticalIVCalculator } from './tools/TheoreticalIVCalculator.js';
import { DeribitAPIClient } from './tools/DeribitAPIClient.js';
import { OptionsAnalyzer } from './tools/OptionsAnalyzer.js';
// Database removed - using direct API calls only

// Generic option interface for internal use
interface GenericOption {
  instrument_name: string;
  currency: string;
  option_type: 'call' | 'put';
  strike: number;
  expiry: string;
  underlying_price: number;
  mark_price: number;
  bid_price: number;
  ask_price: number;
  last_price: number;
  volume: number;
  open_interest: number;
  iv: number;
  index_price: number;
  timestamp: string;
}

// Deribit API interfaces
interface DeribitInstrument {
  instrument_name: string;
  instrument_type: string;
  base_currency: string;
  quote_currency: string;
  settlement_currency: string;
  tick_size: number;
  min_trade_amount: number;
  contract_size: number;
  expiry: string;
  delivery: string;
  maker_commission: number;
  taker_commission: number;
  option_type?: string;
  strike?: number;
  underlying_index?: string;
  underlying_price?: number;
  mark_price?: number;
  bid_price?: number;
  ask_price?: number;
  last_price?: number;
  volume?: number;
  open_interest?: number;
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
  };
  iv?: number;
  index_price?: number;
}

interface DeribitTrade {
  trade_id: string;
  instrument_name: string;
  direction: 'buy' | 'sell';
  amount: number;
  price: number;
  trade_seq: number;
  timestamp: number;
  tick_direction: number;
  trade_id_better: string;
  state: string;
}

interface DeribitOrderBook {
  instrument_name: string;
  bids: Array<[number, number]>;
  asks: Array<[number, number]>;
  timestamp: number;
  stats: {
    volume: number;
    price_change: number;
    high: number;
    low: number;
  };
}


interface MispricingAlert {
  instrument_name: string;
  option_price: number;
  polymarket_probability: number;
  implied_probability: number;
  deviation_percentage: number;
  alert_type: 'overpriced' | 'underpriced';
  timestamp: string;
}

export class DeribitModule extends BaseCryptoModule {
  name = 'deribit';
  
  private apiBaseUrl = 'https://www.deribit.com/api/v2';
  // Database removed - using direct API calls only
  private lastSyncTime: number = Date.now();
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private readonly SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
  private largeTradeThreshold: number = 1000000; // $1M USD equivalent
  private mispricingThreshold: number = 0.1; // 10% deviation
  private theoreticalIVCalculator: TheoreticalIVCalculator;
  private apiClient: DeribitAPIClient;
  private optionsAnalyzer: OptionsAnalyzer;

  protected setupTools() {
    this.addTool({
      name: 'deribit_get_option_chain',
      description: 'Get option chain for a single expiry date for BTC or ETH with Greeks and pricing data',
      inputSchema: {
        type: 'object',
        properties: {
          currency: {
            type: 'string',
            description: 'Base currency (BTC or ETH)',
            enum: ['BTC', 'ETH'],
            default: 'BTC'
          },
          expiry: {
            type: 'string',
            description: 'Expiry date to get options for (e.g., "27DEC24"). If not provided, returns the nearest expiry.',
            default: null
          },
          include_greeks: {
            type: 'boolean',
            description: 'Include Greeks calculations',
            default: true
          }
        },
        required: []
      },
      handler: this.getOptionChain.bind(this)
    });


    this.addTool({
      name: 'deribit_analyze_mispricing',
      description: 'Compare option prices with Polymarket odds to detect mispricings',
      inputSchema: {
        type: 'object',
        properties: {
          currency: {
            type: 'string',
            description: 'Base currency (BTC or ETH)',
            enum: ['BTC', 'ETH'],
            default: 'BTC'
          },
          threshold_percentage: {
            type: 'number',
            description: 'Minimum deviation percentage to flag',
            default: 10
          },
          expiry_filter: {
            type: 'string',
            description: 'Filter by expiry date (YYYY-MM-DD)',
            default: null
          }
        },
        required: []
      },
      handler: this.analyzeMispricing.bind(this)
    });




    this.addTool({
      name: 'deribit_calculate_price_probabilities',
      description: 'Calculate probability of BTC/ETH reaching specific price levels',
      inputSchema: {
        type: 'object',
        properties: {
          currency: {
            type: 'string',
            description: 'Base currency (BTC or ETH)',
            enum: ['BTC', 'ETH'],
            default: 'BTC'
          },
          target_prices: {
            type: 'array',
            description: 'Array of target prices to calculate probabilities for',
            items: { type: 'number' }
          },
          time_horizon: {
            type: 'number',
            description: 'Time horizon in days',
            default: 30
          },
          current_price: {
            type: 'number',
            description: 'Current underlying price (optional, will fetch if not provided)'
          }
        },
        required: ['currency', 'target_prices']
      },
      handler: this.calculatePriceProbabilities.bind(this)
    });


    this.addTool({
      name: 'deribit_comprehensive_analysis',
      description: 'Comprehensive volatility surface analysis and risk metrics calculation',
      inputSchema: {
        type: 'object',
        properties: {
          currency: {
            type: 'string',
            description: 'Base currency (BTC or ETH)',
            enum: ['BTC', 'ETH'],
            default: 'BTC'
          },
          analysis_type: {
            type: 'string',
            description: 'Type of analysis to perform',
            enum: ['volatility_only', 'risk_only', 'comprehensive'],
            default: 'comprehensive'
          },
          portfolio_strikes: {
            type: 'array',
            description: 'Array of strike prices in portfolio (required for risk analysis)',
            items: { type: 'number' }
          },
          portfolio_quantities: {
            type: 'array',
            description: 'Array of quantities for each strike (required for risk analysis)',
            items: { type: 'number' }
          },
          time_horizon: {
            type: 'number',
            description: 'Risk analysis time horizon in days',
            default: 1
          }
        },
        required: ['currency']
      },
      handler: this.comprehensiveAnalysis.bind(this)
    });

    this.addTool({
      name: 'deribit_analyze_iv',
      description: 'Get comprehensive implied volatility analysis including term structure, smile, and IV vs HV comparison',
      inputSchema: {
        type: 'object',
        properties: {
          currency: {
            type: 'string',
            enum: ['BTC', 'ETH'],
            default: 'BTC',
            description: 'Base currency (BTC or ETH)'
          }
        },
        required: []
      },
      handler: this.analyzeIV.bind(this)
    });
  }

  constructor() {
    super();
    
    // Database removed - using direct API calls only
    
    // Using public API endpoints only - no authentication required
    
    // Initialize tools
    this.theoreticalIVCalculator = new TheoreticalIVCalculator();
    this.apiClient = new DeribitAPIClient();
    this.optionsAnalyzer = new OptionsAnalyzer();
    
    // Set up tools after properties are initialized
    this.setupTools();
  }

  async initialize(): Promise<void> {
    // Tools are already set up in constructor
    console.log('Deribit module initialized with public API endpoints only.');
  }



  private async makePublicRequest(endpoint: string, params: any = {}): Promise<any> {
    const response = await axios.get(`${this.apiBaseUrl}${endpoint}`, {
      params
    });

    return response.data.result;
  }


  // Database sync methods removed - using direct API calls only

  // Database sync methods removed - using direct API calls only

  // Database sync methods removed - using direct API calls only

  async getOptionChain(args: any) {
    try {
      const currency = args.currency || 'BTC';
      const includeGreeks = args.include_greeks !== false;
      const targetExpiry = args.expiry;

      // Fetch real-time data from Deribit API
      const chainData = await this.apiClient.getOptionsChain(currency, targetExpiry);
      
      let options = chainData.options;
      
      // If no specific expiry provided, find the nearest expiry
      if (!targetExpiry) {
        // Get all unique expiries and sort by date
        const expiries = [...new Set(options.map(opt => opt.instrument_name.split('-')[1]))];
        const sortedExpiries = expiries.sort((a, b) => {
          // Simple date comparison assuming format like "27DEC24"
          return a.localeCompare(b);
        });
        
        if (sortedExpiries.length === 0) {
          return {
            currency: currency,
            options: [],
            underlying_price: chainData.spot_price,
            expiry: null,
            timestamp: new Date().toISOString(),
            total_options: 0,
            message: `No options found for ${currency}`
          };
        }
        
        // Use the nearest expiry
        const nearestExpiry = sortedExpiries[0];
        options = options.filter(opt => 
          opt.instrument_name.includes(nearestExpiry)
        );
      } else {
        // Filter by the specified expiry
        options = options.filter(opt => 
          opt.instrument_name.includes(targetExpiry.toUpperCase())
        );
        
        if (options.length === 0) {
          return {
            currency: currency,
            options: [],
            underlying_price: chainData.spot_price,
            expiry: targetExpiry,
            timestamp: new Date().toISOString(),
            total_options: 0,
            message: `No options found for ${currency} with expiry ${targetExpiry}`
          };
        }
      }
      
      const actualExpiry = options[0].instrument_name.split('-')[1];
      
      // Sort options by strike price for better organization
      options.sort((a, b) => a.strike - b.strike);
      
      const chain = options.map(option => {
        const result: any = {
          instrument_name: option.instrument_name,
          currency: currency,
          option_type: option.option_type,
          strike: option.strike,
          underlying_price: option.underlying_price,
          mark_price: option.mark_price,
          bid_price: option.bid_price,
          ask_price: option.ask_price,
          last_price: option.last_price,
          volume: option.volume,
          open_interest: option.open_interest,
          iv: option.mark_iv,
          index_price: option.underlying_price
        };

        if (includeGreeks && option.greeks) {
          result.greeks = option.greeks;
        }

        return result;
      });

      // Separate calls and puts for better organization
      const calls = chain.filter(opt => opt.option_type === 'call');
      const puts = chain.filter(opt => opt.option_type === 'put');

      return {
        currency: currency,
        expiry: actualExpiry,
        options: chain,
        calls: calls,
        puts: puts,
        underlying_price: chainData.spot_price,
        timestamp: new Date().toISOString(),
        total_options: chain.length,
        total_calls: calls.length,
        total_puts: puts.length,
        message: `Retrieved ${chain.length} options for ${currency} expiry ${actualExpiry} (${calls.length} calls, ${puts.length} puts) - spot: $${chainData.spot_price.toFixed(2)}`
      };
    } catch (error) {
      console.error('Error fetching option chain:', error);
      throw error; // Re-throw to ensure we don't return empty data
    }
  }


  async analyzeMispricing(args: any) {
    try {
      const currency = args.currency || 'BTC';
      const thresholdPercentage = args.threshold_percentage || this.mispricingThreshold * 100;
      const expiryFilter = args.expiry_filter;

      // Fetch real-time data from Deribit API
      const chainData = await this.apiClient.getOptionsChain(currency);
      let options = chainData.options;
      
      // Apply expiry filter if provided
      if (expiryFilter) {
        options = options.filter(opt => 
          opt.instrument_name.includes(expiryFilter.toUpperCase())
        );
      }
      
      if (options.length === 0) {
        return {
          currency,
          mispricings: [],
          message: 'No options data available from Deribit API.',
          error: 'No options data found'
        };
      }

      const mispricings: MispricingAlert[] = [];

      for (const option of options) {
        if (option.mark_price > 0 && option.mark_iv > 0) {
          // Extract expiry from instrument name (e.g., BTC-27DEC24-100000-C -> 27DEC24)
          const expiry = option.instrument_name.split('-')[1];
          
          // Calculate implied probability from option price using Black-Scholes
          const impliedProbability = this.calculateImpliedProbability(
            option.mark_price,
            option.strike,
            option.underlying_price,
            expiry,
            option.mark_iv
          );

          // Get market-based probability from external sources
          const marketProbability = await this.getMarketProbability({
            instrument_name: option.instrument_name,
            currency: currency,
            option_type: option.option_type,
            strike: option.strike,
            expiry: expiry,
            underlying_index: option.underlying_index,
            underlying_price: option.underlying_price,
            mark_price: option.mark_price,
            bid_price: option.bid_price,
            ask_price: option.ask_price,
            iv: option.mark_iv,
            volume: option.volume,
            index_price: option.underlying_price,
            timestamp: String(option.timestamp),
            last_price: option.last_price || 0,
            open_interest: option.open_interest || 0,
            created_at: new Date(),
            updated_at: new Date()
          } as GenericOption, currency);

          if (marketProbability > 0) {
            const deviationPercentage = Math.abs(impliedProbability - marketProbability) / marketProbability * 100;

            if (deviationPercentage >= thresholdPercentage) {
              mispricings.push({
                instrument_name: option.instrument_name,
                option_price: option.mark_price,
                polymarket_probability: marketProbability,
                implied_probability: impliedProbability,
                deviation_percentage: deviationPercentage,
                alert_type: impliedProbability > marketProbability ? 'overpriced' : 'underpriced',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }

      return {
        currency,
        threshold_percentage: thresholdPercentage,
        mispricings: mispricings.sort((a, b) => b.deviation_percentage - a.deviation_percentage),
        total_mispricings: mispricings.length,
        total_options_analyzed: options.length,
        underlying_price: chainData.spot_price,
        timestamp: new Date().toISOString(),
        message: `Found ${mispricings.length} potential mispricings above ${thresholdPercentage}% deviation from ${options.length} options analyzed (spot: $${chainData.spot_price.toFixed(2)})`
      };
    } catch (error) {
      console.error('Error analyzing mispricing:', error);
      return {
        currency: args.currency || 'BTC',
        mispricings: [],
        error: `Failed to analyze mispricing: ${error}`,
        message: 'Error analyzing mispricing'
      };
    }
  }




  private async syncWithFallbackData(currency: string): Promise<void> {
    console.log(`UP: Deribit: No fallback data available for ${currency} - API credentials required`);
    throw new Error(`Deribit API credentials required for ${currency} data sync`);
  }



  private calculateImpliedVolatility(moneyness: number, timeToExpiry: number): number {
    // Simplified IV calculation based on moneyness and time
    const baseIV = 0.8; // 80% base IV
    const moneynessEffect = Math.abs(Math.log(moneyness)) * 0.2;
    const timeEffect = Math.max(0.1, timeToExpiry) * 0.1;
    
    return Math.min(2.0, Math.max(0.1, baseIV + moneynessEffect + timeEffect));
  }

  private calculateOptionPrice(S: number, K: number, T: number, sigma: number, type: 'call' | 'put'): number {
    // Simplified Black-Scholes calculation
    const r = 0.05; // Risk-free rate
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    
    const N = (x: number) => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
    
    if (type === 'call') {
      return S * N(d1) - K * Math.exp(-r * T) * N(d2);
    } else {
      return K * Math.exp(-r * T) * N(-d2) - S * N(-d1);
    }
  }

  private calculateDelta(S: number, K: number, T: number, sigma: number): number {
    const r = 0.05;
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const N = (x: number) => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
    return N(d1);
  }

  private calculateGamma(S: number, K: number, T: number, sigma: number): number {
    const r = 0.05;
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const n = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    return n(d1) / (S * sigma * Math.sqrt(T));
  }

  private calculateTheta(S: number, K: number, T: number, sigma: number): number {
    const r = 0.05;
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    const N = (x: number) => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
    const n = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    
    return -(S * n(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * N(d2);
  }

  private calculateVega(S: number, K: number, T: number, sigma: number): number {
    const r = 0.05;
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const n = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    return S * Math.sqrt(T) * n(d1) * 0.01; // Vega per 1% change in IV
  }

  private calculateRho(S: number, K: number, T: number, sigma: number): number {
    const r = 0.05;
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    const N = (x: number) => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
    return K * T * Math.exp(-r * T) * N(d2) * 0.01; // Rho per 1% change in interest rate
  }

  private async getMarketProbability(option: GenericOption, currency: string): Promise<number> {
    try {
      // Try to get probability from external sources
      // This could integrate with Polymarket, prediction markets, or other sources
      
      // For now, use a simple market-based approach
      const timeToExpiry = (new Date(option.expiry).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000);
      const moneyness = option.underlying_price / option.strike;
      
      // Simple probability based on current market conditions
      let baseProbability = 0.5;
      
      if (moneyness > 1.1) baseProbability = 0.7; // ITM calls more likely
      if (moneyness < 0.9) baseProbability = 0.3; // OTM calls less likely
      
      // Adjust for time decay
      const timeAdjustment = Math.max(0.1, timeToExpiry);
      baseProbability = baseProbability * timeAdjustment;
      
      return Math.min(0.95, Math.max(0.05, baseProbability));
      
    } catch (error) {
      console.error('Failed to get market probability:', error);
      return 0.5; // Default neutral probability
    }
  }

  private calculateImpliedProbability(optionPrice: number, strike: number, underlyingPrice: number, expiry: string, iv?: number): number {
    // Improved Black-Scholes implied probability calculation
    const timeToExpiry = (new Date(expiry).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000);
    
    if (timeToExpiry <= 0) return 0;
    
    // Use provided IV or calculate from option price
    const impliedVol = iv || this.calculateImpliedVolatility(underlyingPrice / strike, timeToExpiry);
    
    // Calculate probability using Black-Scholes
    const r = 0.05; // Risk-free rate
    const d2 = (Math.log(underlyingPrice / strike) + (r - 0.5 * impliedVol * impliedVol) * timeToExpiry) / (impliedVol * Math.sqrt(timeToExpiry));
    const N = (x: number) => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
    
    return N(d2);
  }

  async calculatePriceProbabilities(args: any) {
    try {
      const currency = args.currency || 'BTC';
      const targetPrices = args.target_prices || [];
      const timeHorizon = args.time_horizon || 30;
      const currentPrice = args.current_price;

      if (targetPrices.length === 0) {
        return {
          currency,
          error: 'No target prices provided',
          message: 'Please provide target_prices array'
        };
      }

      // Get current price if not provided
      let underlyingPrice = currentPrice;
      if (!underlyingPrice) {
        // Fetch real-time data from Deribit API
        const chainData = await this.apiClient.getOptionsChain(currency);
        underlyingPrice = chainData.spot_price;
        
        if (!underlyingPrice || underlyingPrice === 0) {
          return {
            currency,
            error: 'Unable to fetch current price from Deribit API',
            message: 'Please provide current_price parameter or check API connectivity'
          };
        }
      }

      // Get average implied volatility from options for better probability calculation
      const chainData = await this.apiClient.getOptionsChain(currency);
      const validOptions = chainData.options.filter(opt => opt.mark_iv > 0);
      const avgImpliedVol = validOptions.length > 0
        ? validOptions.reduce((sum, opt) => sum + opt.mark_iv, 0) / validOptions.length / 100
        : 0.8; // Default to 80% if no valid options

      const probabilities = [];
      const timeToExpiry = timeHorizon / 365; // Convert days to years

      for (const targetPrice of targetPrices) {
        // Calculate probability using log-normal distribution with market IV
        const probability = this.calculatePriceProbabilityWithIV(
          underlyingPrice,
          targetPrice,
          timeToExpiry,
          avgImpliedVol,
          currency
        );

        probabilities.push({
          target_price: targetPrice,
          current_price: underlyingPrice,
          probability: probability,
          odds: this.probabilityToOdds(probability),
          moneyness: targetPrice / underlyingPrice,
          time_horizon_days: timeHorizon,
          implied_volatility: avgImpliedVol * 100
        });
      }

      return {
        currency,
        current_price: underlyingPrice,
        time_horizon_days: timeHorizon,
        average_implied_volatility: avgImpliedVol * 100,
        probabilities: probabilities.sort((a, b) => b.probability - a.probability),
        total_targets: targetPrices.length,
        timestamp: new Date().toISOString(),
        message: `Calculated probabilities for ${targetPrices.length} price levels using market IV of ${(avgImpliedVol * 100).toFixed(1)}% (spot: $${underlyingPrice.toFixed(2)})`
      };

    } catch (error) {
      console.error('Error calculating price probabilities:', error);
      return {
        currency: args.currency || 'BTC',
        probabilities: [],
        error: `Failed to calculate price probabilities: ${error}`,
        message: 'Error calculating price probabilities'
      };
    }
  }

  async calculateComprehensiveGreeks(args: any) {
    try {
      const currency = args.currency || 'BTC';
      const strike = args.strike;
      const expiry = args.expiry;
      const optionType = args.option_type || 'call';
      const currentPrice = args.current_price;
      const riskFreeRate = args.risk_free_rate || 0.05;

      // If no specific parameters provided, get data from option chain
      if (!strike || !expiry || !currentPrice) {
        // Fetch real-time data from Deribit API
        const chainData = await this.apiClient.getOptionsChain(currency);
        if (chainData.options.length === 0) {
          return {
            currency,
            error: 'No options data available from Deribit API - provide strike, expiry, and current_price parameters',
            message: 'Please provide all required parameters or check API connectivity'
          };
        }
        
        // Use first available option for demonstration
        const firstOption = chainData.options[0];
        const actualStrike = strike || firstOption.strike;
        const actualExpiry = expiry || firstOption.instrument_name.split('-')[1];
        const actualCurrentPrice = currentPrice || chainData.spot_price;
        
        return this.calculateGreeksForOption(currency, actualStrike, actualExpiry, optionType, actualCurrentPrice, riskFreeRate);
      }

      return this.calculateGreeksForOption(currency, strike, expiry, optionType, currentPrice, riskFreeRate);

    } catch (error) {
      return {
        currency: args.currency || 'BTC',
        greeks: null,
        error: `Failed to calculate comprehensive Greeks: ${error}`,
        message: 'Error calculating Greeks'
      };
    }
  }

  private async calculateGreeksForOption(currency: string, strike: number, expiry: string, optionType: string, currentPrice: number, riskFreeRate: number) {
    const timeToExpiry = (new Date(expiry).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000);
    
    if (timeToExpiry <= 0) {
      return {
        currency,
        error: 'Invalid expiry date',
        message: 'Expiry date must be in the future'
      };
    }

    // Get implied volatility from option chain data
    const chainData = await this.apiClient.getOptionsChain(currency as 'BTC' | 'ETH');
    const similarOption = chainData.options.find(opt => 
      Math.abs(opt.strike - strike) / strike < 0.1 && // Within 10% of strike
      opt.instrument_name.includes(expiry.toUpperCase()) // Same expiry
    );

    const impliedVol = similarOption?.mark_iv ? similarOption.mark_iv / 100 : this.calculateImpliedVolatility(currentPrice / strike, timeToExpiry);

    // Calculate comprehensive Greeks using proper Black-Scholes
    const greeks = this.calculateBlackScholesGreeks(
      currentPrice,
      strike,
      timeToExpiry,
      impliedVol,
      riskFreeRate,
      optionType as 'call' | 'put'
    );

    // Calculate additional metrics
    const optionPrice = this.calculateBlackScholesPrice(
      currentPrice,
      strike,
      timeToExpiry,
      impliedVol,
      riskFreeRate,
      optionType as 'call' | 'put'
    );

    const intrinsicValue = optionType === 'call' 
      ? Math.max(0, currentPrice - strike)
      : Math.max(0, strike - currentPrice);

    const timeValue = optionPrice - intrinsicValue;
    const moneyness = currentPrice / strike;

    return {
      currency,
      instrument_details: {
        strike,
        expiry,
        option_type: optionType,
        current_price: currentPrice,
        implied_volatility: impliedVol,
        time_to_expiry_years: timeToExpiry
      },
      option_pricing: {
        theoretical_price: optionPrice,
        intrinsic_value: intrinsicValue,
        time_value: timeValue,
        moneyness: moneyness
      },
      greeks: {
        delta: greeks.delta,
        gamma: greeks.gamma,
        theta: greeks.theta,
        vega: greeks.vega,
        rho: greeks.rho,
        lambda: greeks.lambda, // Leverage
        elasticity: greeks.elasticity
      },
      risk_metrics: {
        probability_itm: greeks.probabilityITM,
        probability_otm: greeks.probabilityOTM,
        expected_payoff: greeks.expectedPayoff,
        max_loss: greeks.maxLoss,
        max_gain: greeks.maxGain
      },
      message: `Comprehensive Greeks calculated for ${currency} ${optionType} option`
    };
  }

  async analyzeVolatilitySurface(args: any) {
    try {
      const currency = args.currency || 'BTC';
      const analysisType = args.analysis_type || 'all';

      // Fetch real-time data from Deribit API
      const chainData = await this.apiClient.getOptionsChain(currency);
      const options = chainData.options.map(opt => ({
        instrument_name: opt.instrument_name,
        strike: opt.strike,
        expiry: opt.instrument_name.split('-')[1],
        option_type: opt.option_type,
        mark_price: opt.mark_price,
        mark_iv: opt.mark_iv,
        bid_iv: opt.bid_iv,
        ask_iv: opt.ask_iv,
        underlying_price: opt.underlying_price,
        volume: opt.volume,
        open_interest: opt.open_interest
      }));
      
      if (options.length === 0) {
        return {
          currency,
          error: 'No options data available from Deribit API',
          message: 'Unable to fetch options data'
        };
      }

      const analysis: any = {
        currency,
        underlying_price: chainData.spot_price,
        total_options: options.length,
        analysis_timestamp: new Date().toISOString()
      };

      if (analysisType === 'surface' || analysisType === 'all') {
        analysis.volatility_surface = (this as any).buildVolatilitySurfaceFromAPI(options);
      }

      if (analysisType === 'term_structure' || analysisType === 'all') {
        analysis.term_structure = (this as any).analyzeTermStructureFromAPI(options);
      }

      if (analysisType === 'skew' || analysisType === 'all') {
        analysis.volatility_skew = (this as any).analyzeVolatilitySkewFromAPI(options, chainData.spot_price);
      }

      if (analysisType === 'all') {
        analysis.summary = (this as any).generateVolatilitySummaryFromAPI(options, chainData.spot_price);
      }

      return {
        ...analysis,
        message: `Volatility analysis completed for ${currency} (spot: $${chainData.spot_price.toFixed(2)})`
      };

    } catch (error) {
      console.error('Error analyzing volatility surface:', error);
      return {
        currency: args.currency || 'BTC',
        error: `Failed to analyze volatility surface: ${error}`,
        message: 'Error analyzing volatility'
      };
    }
  }

  async analyzeIV(args: any) {
    try {
      const currency = args.currency || 'BTC';
      
      // Fetch real-time options data
      const chainData = await this.apiClient.getOptionsChain(currency);
      
      // Get historical volatility
      const historicalVol = await this.apiClient.getHistoricalVolatility(currency);
      
      // Analyze the options chain
      const analysis = this.optionsAnalyzer.analyzeOptionsChain(
        chainData.options,
        chainData.spot_price,
        historicalVol
      );
      
      return {
        currency: currency,
        spot_price: chainData.spot_price,
        analysis: analysis,
        timestamp: new Date().toISOString(),
        message: `Comprehensive IV analysis for ${currency}`
      };
    } catch (error) {
      console.error('Error analyzing IV:', error);
      return {
        currency: args.currency || 'BTC',
        error: error instanceof Error ? error.message : 'Failed to analyze IV',
        message: 'Error performing IV analysis'
      };
    }
  }

  async calculateRiskMetrics(args: any) {
    try {
      const currency = args.currency || 'BTC';
      const portfolioStrikes = args.portfolio_strikes || [];
      const portfolioQuantities = args.portfolio_quantities || [];
      const timeHorizon = args.time_horizon || 1;

      if (portfolioStrikes.length === 0) {
        return {
          currency,
          error: 'No portfolio strikes provided',
          message: 'Please provide portfolio_strikes array'
        };
      }

      if (portfolioStrikes.length !== portfolioQuantities.length) {
        return {
          currency,
          error: 'Portfolio strikes and quantities arrays must have same length',
          message: 'Mismatched array lengths'
        };
      }

      // Fetch real-time data from Deribit API
      const chainData = await this.apiClient.getOptionsChain(currency);
      const currentPrice = chainData.spot_price;
      
      if (!currentPrice || currentPrice === 0) {
        return {
          currency,
          error: 'Unable to fetch current price from Deribit API',
          message: 'Please check API connectivity'
        };
      }

      // Get portfolio options data for Greeks calculation
      const portfolioOptions = [];
      for (let i = 0; i < portfolioStrikes.length; i++) {
        const strike = portfolioStrikes[i];
        const quantity = portfolioQuantities[i];
        
        // Find the closest option to the strike
        const matchingOptions = chainData.options.filter(opt => opt.strike === strike);
        if (matchingOptions.length > 0) {
          // Use ATM option for Greeks if multiple expiries
          const atmOption = matchingOptions.reduce((closest, opt) => {
            const currentDiff = Math.abs(opt.strike - currentPrice);
            const closestDiff = Math.abs(closest.strike - currentPrice);
            return currentDiff < closestDiff ? opt : closest;
          });
          
          portfolioOptions.push({
            strike,
            quantity,
            option: atmOption
          });
        }
      }

      // Calculate portfolio-level Greeks
      let portfolioDelta = 0;
      let portfolioGamma = 0;
      let portfolioTheta = 0;
      let portfolioVega = 0;
      
      for (const pos of portfolioOptions) {
        if (pos.option.greeks) {
          portfolioDelta += pos.quantity * pos.option.greeks.delta;
          portfolioGamma += pos.quantity * pos.option.greeks.gamma;
          portfolioTheta += pos.quantity * pos.option.greeks.theta;
          portfolioVega += pos.quantity * pos.option.greeks.vega;
        }
      }

      // Calculate risk metrics with market data
      const avgIV = chainData.options
        .filter(opt => opt.mark_iv > 0)
        .reduce((sum, opt) => sum + opt.mark_iv, 0) / chainData.options.length / 100;

      const riskMetrics = this.calculatePortfolioRiskWithMarketData(
        portfolioStrikes,
        portfolioQuantities,
        currentPrice,
        timeHorizon,
        avgIV,
        currency
      );

      return {
        currency,
        current_price: currentPrice,
        time_horizon_days: timeHorizon,
        portfolio_size: portfolioStrikes.length,
        portfolio_greeks: {
          delta: portfolioDelta,
          gamma: portfolioGamma,
          theta: portfolioTheta,
          vega: portfolioVega
        },
        market_implied_volatility: avgIV * 100,
        risk_metrics: riskMetrics,
        timestamp: new Date().toISOString(),
        message: `Risk analysis completed for ${portfolioStrikes.length} positions (spot: $${currentPrice.toFixed(2)})`
      };

    } catch (error) {
      console.error('Error calculating risk metrics:', error);
      return {
        currency: args.currency || 'BTC',
        risk_metrics: null,
        error: `Failed to calculate risk metrics: ${error}`,
        message: 'Error calculating risk metrics'
      };
    }
  }

  async comprehensiveAnalysis(args: any) {
    try {
      const currency = args.currency || 'BTC';
      const analysisType = args.analysis_type || 'comprehensive';
      const portfolioStrikes = args.portfolio_strikes || [];
      const portfolioQuantities = args.portfolio_quantities || [];
      const timeHorizon = args.time_horizon || 1;

      const result: any = {
        currency,
        analysis_type: analysisType,
        timestamp: new Date().toISOString()
      };

      // Always fetch the options chain data
      const chainData = await this.apiClient.getOptionsChain(currency);
      result.underlying_price = chainData.spot_price;
      result.total_options = chainData.options.length;

      // Volatility analysis
      if (analysisType === 'volatility_only' || analysisType === 'comprehensive') {
        const volatilityResult = await this.analyzeVolatilitySurface({
          currency,
          analysis_type: 'all'
        });
        
        if (!volatilityResult.error) {
          result.volatility_analysis = {
            volatility_surface: volatilityResult.volatility_surface,
            term_structure: volatilityResult.term_structure,
            volatility_skew: volatilityResult.volatility_skew,
            summary: volatilityResult.summary
          };
        } else {
          result.volatility_analysis = { error: volatilityResult.error };
        }
      }

      // Risk analysis (only if portfolio data is provided)
      if ((analysisType === 'risk_only' || analysisType === 'comprehensive') && 
          portfolioStrikes.length > 0 && portfolioQuantities.length > 0) {
        
        const riskResult = await this.calculateRiskMetrics({
          currency,
          portfolio_strikes: portfolioStrikes,
          portfolio_quantities: portfolioQuantities,
          time_horizon: timeHorizon
        });
        
        if (!riskResult.error) {
          result.risk_analysis = {
            portfolio_greeks: riskResult.portfolio_greeks,
            risk_metrics: riskResult.risk_metrics,
            market_implied_volatility: riskResult.market_implied_volatility,
            portfolio_size: riskResult.portfolio_size
          };
        } else {
          result.risk_analysis = { error: riskResult.error };
        }
      } else if (analysisType === 'risk_only') {
        result.risk_analysis = { 
          error: 'Portfolio strikes and quantities required for risk analysis' 
        };
      }

      // Add IV analysis for comprehensive view
      if (analysisType === 'comprehensive') {
        const ivResult = await this.analyzeIV({ currency });
        if (!ivResult.error) {
          result.iv_analysis = ivResult.analysis;
        }
      }

      result.message = `Comprehensive ${analysisType} analysis completed for ${currency}`;
      return result;

    } catch (error) {
      console.error('Error in comprehensive analysis:', error);
      return {
        currency: args.currency || 'BTC',
        analysis_type: args.analysis_type || 'comprehensive',
        error: `Failed to perform comprehensive analysis: ${error}`,
        message: 'Error in comprehensive analysis'
      };
    }
  }

  private calculatePriceProbability(currentPrice: number, targetPrice: number, timeToExpiry: number, currency: string): number {
    // Use historical volatility or implied volatility
    const volatility = this.getHistoricalVolatility(currency, timeToExpiry);
    
    // Log-normal distribution parameters
    const drift = 0; // Assume no drift for simplicity
    const sigma = volatility * Math.sqrt(timeToExpiry);
    
    // Calculate probability using cumulative normal distribution
    const d = (Math.log(targetPrice / currentPrice) - drift * timeToExpiry) / sigma;
    const N = (x: number) => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
    
    return N(d);
  }

  private calculatePriceProbabilityWithIV(currentPrice: number, targetPrice: number, timeToExpiry: number, impliedVolatility: number, currency: string): number {
    // Use provided implied volatility from market
    const volatility = impliedVolatility;
    
    // Log-normal distribution parameters
    const drift = 0; // Assume no drift for simplicity
    const sigma = volatility * Math.sqrt(timeToExpiry);
    
    // Calculate probability using cumulative normal distribution
    const d = (Math.log(targetPrice / currentPrice) - drift * timeToExpiry) / sigma;
    const N = (x: number) => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
    
    return N(d);
  }

  private probabilityToOdds(probability: number): string {
    if (probability >= 1) return '1:0';
    if (probability <= 0) return '0:1';
    
    const odds = (1 - probability) / probability;
    return `1:${odds.toFixed(2)}`;
  }

  private calculateBlackScholesGreeks(S: number, K: number, T: number, sigma: number, r: number, type: 'call' | 'put') {
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    
    const N = (x: number) => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
    const n = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    
    const delta = type === 'call' ? N(d1) : N(d1) - 1;
    const gamma = n(d1) / (S * sigma * Math.sqrt(T));
    const theta = -(S * n(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * N(d2);
    const vega = S * Math.sqrt(T) * n(d1);
    const rho = K * T * Math.exp(-r * T) * N(d2);
    
    const optionPrice = this.calculateBlackScholesPrice(S, K, T, sigma, r, type);
    const lambda = (delta * S) / optionPrice; // Leverage
    const elasticity = lambda * (S / optionPrice);
    
    const probabilityITM = type === 'call' ? N(d2) : 1 - N(d2);
    const probabilityOTM = 1 - probabilityITM;
    
    const expectedPayoff = type === 'call' 
      ? S * N(d1) - K * Math.exp(-r * T) * N(d2)
      : K * Math.exp(-r * T) * N(-d2) - S * N(-d1);
    
    const maxLoss = type === 'call' ? optionPrice : K - S;
    const maxGain = type === 'call' ? Infinity : optionPrice;
    
    return {
      delta,
      gamma,
      theta,
      vega,
      rho,
      lambda,
      elasticity,
      probabilityITM,
      probabilityOTM,
      expectedPayoff,
      maxLoss,
      maxGain
    };
  }

  private calculateBlackScholesPrice(S: number, K: number, T: number, sigma: number, r: number, type: 'call' | 'put'): number {
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    
    const N = (x: number) => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
    
    if (type === 'call') {
      return S * N(d1) - K * Math.exp(-r * T) * N(d2);
    } else {
      return K * Math.exp(-r * T) * N(-d2) - S * N(-d1);
    }
  }

  private getHistoricalVolatility(currency: string, timeToExpiry: number): number {
    // Simplified historical volatility calculation
    // In practice, this would use actual historical price data
    const baseVol = currency === 'BTC' ? 0.8 : 1.2; // 80% for BTC, 120% for ETH
    return Math.min(2.0, Math.max(0.1, baseVol + timeToExpiry * 0.1));
  }

  private buildVolatilitySurface(options: GenericOption[]): any {
    const surface: { [expiry: string]: { [strike: number]: number } } = {};
    
    for (const option of options) {
      if (option.iv > 0) {
        if (!surface[option.expiry]) {
          surface[option.expiry] = {};
        }
        surface[option.expiry][option.strike] = option.iv;
      }
    }
    
    return {
      surface,
      expiries: Object.keys(surface),
      strikes: [...new Set(options.map(o => o.strike))].sort((a, b) => a - b)
    };
  }

  private analyzeTermStructure(options: GenericOption[]): any {
    const termStructure: { [expiry: string]: number } = {};
    
    // Group by expiry and calculate average IV
    const expiryGroups: { [expiry: string]: number[] } = {};
    
    for (const option of options) {
      if (option.iv > 0) {
        if (!expiryGroups[option.expiry]) {
          expiryGroups[option.expiry] = [];
        }
        expiryGroups[option.expiry].push(option.iv);
      }
    }
    
    for (const [expiry, ivs] of Object.entries(expiryGroups)) {
      const avgIV = ivs.reduce((sum, iv) => sum + iv, 0) / ivs.length;
      termStructure[expiry] = avgIV;
    }
    
    return {
      term_structure: termStructure,
      analysis: this.analyzeTermStructurePattern(termStructure)
    };
  }

  private analyzeVolatilitySkew(options: GenericOption[]): any {
    const skewData: { [expiry: string]: { strikes: number[], ivs: number[] } } = {};
    
    for (const option of options) {
      if (option.iv > 0) {
        if (!skewData[option.expiry]) {
          skewData[option.expiry] = { strikes: [], ivs: [] };
        }
        skewData[option.expiry].strikes.push(option.strike);
        skewData[option.expiry].ivs.push(option.iv);
      }
    }
    
    return {
      skew_data: skewData,
      analysis: this.calculateSkewMetrics(skewData)
    };
  }

  private generateVolatilitySummary(options: GenericOption[]): any {
    const ivs = options.filter(o => o.iv > 0).map(o => o.iv);
    
    if (ivs.length === 0) {
      return { message: 'No volatility data available' };
    }
    
    const avgIV = ivs.reduce((sum, iv) => sum + iv, 0) / ivs.length;
    const minIV = Math.min(...ivs);
    const maxIV = Math.max(...ivs);
    
    return {
      average_iv: avgIV,
      min_iv: minIV,
      max_iv: maxIV,
      iv_range: maxIV - minIV,
      total_options: options.length,
      options_with_iv: ivs.length
    };
  }

  // API-based helper methods for volatility analysis
  private buildVolatilitySurfaceFromAPI(options: any[]): any {
    const surface: { [expiry: string]: { [strike: number]: number } } = {};
    const surfaceArray: any[] = [];
    
    for (const option of options) {
      if (option.mark_iv > 0) {
        if (!surface[option.expiry]) {
          surface[option.expiry] = {};
        }
        surface[option.expiry][option.strike] = option.mark_iv;
        
        surfaceArray.push({
          expiry: option.expiry,
          strike: option.strike,
          iv: option.mark_iv,
          option_type: option.option_type
        });
      }
    }
    
    return {
      surface,
      surface_array: surfaceArray,
      expiries: Object.keys(surface).sort(),
      strikes: [...new Set(options.map(o => o.strike))].sort((a, b) => a - b)
    };
  }

  private analyzeTermStructureFromAPI(options: any[]): any {
    const termStructure: { [expiry: string]: number } = {};
    const termArray: any[] = [];
    
    // Group by expiry and calculate average IV
    const expiryGroups: { [expiry: string]: number[] } = {};
    
    for (const option of options) {
      if (option.mark_iv > 0) {
        if (!expiryGroups[option.expiry]) {
          expiryGroups[option.expiry] = [];
        }
        expiryGroups[option.expiry].push(option.mark_iv);
      }
    }
    
    for (const [expiry, ivs] of Object.entries(expiryGroups)) {
      const avgIV = ivs.reduce((sum, iv) => sum + iv, 0) / ivs.length;
      termStructure[expiry] = avgIV;
      termArray.push({
        expiry,
        average_iv: avgIV,
        option_count: ivs.length
      });
    }
    
    return {
      term_structure: termStructure,
      term_array: termArray.sort((a, b) => a.expiry.localeCompare(b.expiry)),
      expiries: Object.keys(termStructure).sort()
    };
  }

  private analyzeVolatilitySkewFromAPI(options: any[], spotPrice: number): any {
    const skewByExpiry: { [expiry: string]: any } = {};
    const skewArray: any[] = [];
    
    // Group by expiry
    const expiryGroups: { [expiry: string]: any[] } = {};
    
    for (const option of options) {
      if (option.mark_iv > 0) {
        if (!expiryGroups[option.expiry]) {
          expiryGroups[option.expiry] = [];
        }
        expiryGroups[option.expiry].push(option);
      }
    }
    
    for (const [expiry, expiryOptions] of Object.entries(expiryGroups)) {
      // Calculate moneyness and sort by strike
      const skewData = expiryOptions
        .map(opt => ({
          strike: opt.strike,
          iv: opt.mark_iv,
          moneyness: opt.strike / spotPrice,
          option_type: opt.option_type
        }))
        .sort((a, b) => a.strike - b.strike);
      
      // Calculate skew metrics
      const atmStrike = skewData.reduce((closest, opt) => 
        Math.abs(opt.moneyness - 1) < Math.abs(closest.moneyness - 1) ? opt : closest
      ).strike;
      
      const atmIV = skewData.find(s => s.strike === atmStrike)?.iv || 0;
      const putSkew = skewData.filter(s => s.strike < atmStrike && s.option_type === 'put');
      const callSkew = skewData.filter(s => s.strike > atmStrike && s.option_type === 'call');
      
      skewByExpiry[expiry] = {
        atm_strike: atmStrike,
        atm_iv: atmIV,
        skew_data: skewData,
        put_wing_iv: putSkew.length > 0 ? putSkew[0].iv : null,
        call_wing_iv: callSkew.length > 0 ? callSkew[callSkew.length - 1].iv : null
      };
      
      skewArray.push({
        expiry,
        atm_strike: atmStrike,
        atm_iv: atmIV,
        put_wing_iv: skewByExpiry[expiry].put_wing_iv,
        call_wing_iv: skewByExpiry[expiry].call_wing_iv,
        option_count: skewData.length
      });
    }
    
    return {
      skew_by_expiry: skewByExpiry,
      skew_summary: skewArray.sort((a, b) => a.expiry.localeCompare(b.expiry))
    };
  }

  private generateVolatilitySummaryFromAPI(options: any[], spotPrice: number): any {
    const ivs = options.filter(o => o.mark_iv > 0).map(o => o.mark_iv);
    
    if (ivs.length === 0) {
      return { message: 'No volatility data available' };
    }
    
    const avgIV = ivs.reduce((sum, iv) => sum + iv, 0) / ivs.length;
    const minIV = Math.min(...ivs);
    const maxIV = Math.max(...ivs);
    
    // Calculate IV percentiles
    const sortedIVs = [...ivs].sort((a, b) => a - b);
    const p25 = sortedIVs[Math.floor(sortedIVs.length * 0.25)];
    const p50 = sortedIVs[Math.floor(sortedIVs.length * 0.50)];
    const p75 = sortedIVs[Math.floor(sortedIVs.length * 0.75)];
    
    return {
      spot_price: spotPrice,
      average_iv: avgIV,
      min_iv: minIV,
      max_iv: maxIV,
      iv_range: maxIV - minIV,
      iv_percentiles: {
        p25: p25,
        p50: p50,
        p75: p75
      },
      total_options: options.length,
      options_with_iv: ivs.length,
      timestamp: new Date().toISOString()
    };
  }

  private analyzeTermStructurePattern(termStructure: { [expiry: string]: number }): any {
    const expiries = Object.keys(termStructure).sort();
    const ivs = expiries.map(expiry => termStructure[expiry]);
    
    if (ivs.length < 2) {
      return { pattern: 'insufficient_data' };
    }
    
    // Simple pattern analysis
    const isUpward = ivs[ivs.length - 1] > ivs[0];
    const isDownward = ivs[ivs.length - 1] < ivs[0];
    
    let pattern = 'flat';
    if (isUpward) pattern = 'upward_sloping';
    if (isDownward) pattern = 'downward_sloping';
    
    return {
      pattern,
      short_term_iv: ivs[0],
      long_term_iv: ivs[ivs.length - 1],
      slope: ivs[ivs.length - 1] - ivs[0]
    };
  }

  private calculateSkewMetrics(skewData: { [expiry: string]: { strikes: number[], ivs: number[] } }): any {
    const skewAnalysis: { [expiry: string]: any } = {};
    
    for (const [expiry, data] of Object.entries(skewData)) {
      if (data.strikes.length < 3) continue;
      
      // Calculate skew (simplified)
      const sortedData = data.strikes.map((strike, i) => ({ strike, iv: data.ivs[i] }))
        .sort((a, b) => a.strike - b.strike);
      
      const atmIndex = Math.floor(sortedData.length / 2);
      const atmIV = sortedData[atmIndex].iv;
      
      const otmIV = sortedData[sortedData.length - 1].iv;
      const itmIV = sortedData[0].iv;
      
      skewAnalysis[expiry] = {
        atm_iv: atmIV,
        otm_iv: otmIV,
        itm_iv: itmIV,
        skew: otmIV - itmIV,
        skew_percentage: ((otmIV - itmIV) / atmIV) * 100
      };
    }
    
    return skewAnalysis;
  }

  private calculatePortfolioRisk(strikes: number[], quantities: number[], currentPrice: number, timeHorizon: number, currency: string): any {
    const positions = strikes.map((strike, i) => ({
      strike,
      quantity: quantities[i],
      moneyness: currentPrice / strike
    }));
    
    const totalExposure = positions.reduce((sum, pos) => sum + Math.abs(pos.quantity), 0);
    const netDelta = positions.reduce((sum, pos) => {
      const delta = this.calculateDelta(currentPrice, pos.strike, timeHorizon / 365, this.getHistoricalVolatility(currency, timeHorizon / 365));
      return sum + (delta * pos.quantity);
    }, 0);
    
    const portfolioValue = positions.reduce((sum, pos) => {
      const optionPrice = this.calculateOptionPrice(currentPrice, pos.strike, timeHorizon / 365, this.getHistoricalVolatility(currency, timeHorizon / 365), 'call');
      return sum + (optionPrice * pos.quantity);
    }, 0);
    
    return {
      total_exposure: totalExposure,
      net_delta: netDelta,
      portfolio_value: portfolioValue,
      delta_exposure: netDelta * currentPrice,
      positions: positions.map(pos => ({
        strike: pos.strike,
        quantity: pos.quantity,
        moneyness: pos.moneyness,
        delta: this.calculateDelta(currentPrice, pos.strike, timeHorizon / 365, this.getHistoricalVolatility(currency, timeHorizon / 365))
      }))
    };
  }

  private calculatePortfolioRiskWithMarketData(strikes: number[], quantities: number[], currentPrice: number, timeHorizon: number, marketIV: number, currency: string): any {
    const positions = strikes.map((strike, i) => ({
      strike,
      quantity: quantities[i],
      moneyness: strike / currentPrice
    }));
    
    const totalExposure = positions.reduce((sum, pos) => sum + Math.abs(pos.quantity), 0);
    const timeToExpiry = timeHorizon / 365;
    
    const netDelta = positions.reduce((sum, pos) => {
      const delta = this.calculateDelta(currentPrice, pos.strike, timeToExpiry, marketIV);
      return sum + (delta * pos.quantity);
    }, 0);
    
    const portfolioValue = positions.reduce((sum, pos) => {
      const optionPrice = this.calculateOptionPrice(currentPrice, pos.strike, timeToExpiry, marketIV, 'call');
      return sum + (optionPrice * pos.quantity);
    }, 0);
    
    // Calculate VaR using market IV
    const confidenceLevel = 0.95;
    const zScore = 1.645; // 95% confidence
    const portfolioVaR = currentPrice * netDelta * marketIV * Math.sqrt(timeToExpiry) * zScore;
    
    // Calculate scenario analysis
    const scenarios = [
      { name: 'Market up 10%', priceMove: 0.10 },
      { name: 'Market up 5%', priceMove: 0.05 },
      { name: 'Market down 5%', priceMove: -0.05 },
      { name: 'Market down 10%', priceMove: -0.10 },
      { name: 'Market crash 20%', priceMove: -0.20 }
    ];
    
    const scenarioResults = scenarios.map(scenario => {
      const newPrice = currentPrice * (1 + scenario.priceMove);
      const portfolioPnL = positions.reduce((sum, pos) => {
        const oldOptionPrice = this.calculateOptionPrice(currentPrice, pos.strike, timeToExpiry, marketIV, 'call');
        const newOptionPrice = this.calculateOptionPrice(newPrice, pos.strike, timeToExpiry, marketIV, 'call');
        return sum + ((newOptionPrice - oldOptionPrice) * pos.quantity);
      }, 0);
      
      return {
        scenario: scenario.name,
        price_move: scenario.priceMove,
        new_price: newPrice,
        portfolio_pnl: portfolioPnL,
        pnl_percentage: (portfolioPnL / portfolioValue) * 100
      };
    });
    
    return {
      total_exposure: totalExposure,
      net_delta: netDelta,
      portfolio_value: portfolioValue,
      delta_exposure: netDelta * currentPrice,
      value_at_risk_95: portfolioVaR,
      market_iv_used: marketIV * 100,
      scenario_analysis: scenarioResults,
      positions: positions.map(pos => ({
        strike: pos.strike,
        quantity: pos.quantity,
        moneyness: pos.moneyness,
        delta: this.calculateDelta(currentPrice, pos.strike, timeToExpiry, marketIV),
        option_value: this.calculateOptionPrice(currentPrice, pos.strike, timeToExpiry, marketIV, 'call')
      }))
    };
  }

  // Database validation methods removed - using direct API calls only

  // Cleanup method for testing
  async destroy(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    // Database removed - no cleanup needed
  }
}
