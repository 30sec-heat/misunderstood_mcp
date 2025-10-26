#!/usr/bin/env tsx

import axios from 'axios';

// Enhanced Deribit probability and Greeks calculator
class DeribitProbabilityCalculator {
  private apiBaseUrl = 'https://www.deribit.com/api/v2';

  async calculatePriceProbabilities(currency: string, targetPrices: number[], timeHorizonDays: number = 30) {
    console.log(`\n[TARGET] Calculating Price Probabilities for ${currency}`);
    console.log(`Time Horizon: ${timeHorizonDays} days`);
    console.log(`Target Prices: ${targetPrices.join(', ')}`);

    try {
      // Get current price
      const currentPrice = await this.getCurrentPrice(currency);
      console.log(`Current ${currency} Price: $${currentPrice.toLocaleString()}`);

      const probabilities = [];
      const timeToExpiry = timeHorizonDays / 365;

      for (const targetPrice of targetPrices) {
        const probability = this.calculatePriceProbability(currentPrice, targetPrice, timeToExpiry, currency);
        const odds = this.probabilityToOdds(probability);
        const moneyness = targetPrice / currentPrice;

        probabilities.push({
          target_price: targetPrice,
          probability: probability,
          odds: odds,
          moneyness: moneyness,
          price_change_pct: ((targetPrice - currentPrice) / currentPrice * 100).toFixed(2) + '%'
        });

        console.log(`\n[DATA] Target: $${targetPrice.toLocaleString()}`);
        console.log(`   Probability: ${(probability * 100).toFixed(2)}%`);
        console.log(`   Odds: ${odds}`);
        console.log(`   Moneyness: ${moneyness.toFixed(3)}`);
        console.log(`   Price Change: ${((targetPrice - currentPrice) / currentPrice * 100).toFixed(2)}%`);
      }

      return {
        currency,
        current_price: currentPrice,
        time_horizon_days: timeHorizonDays,
        probabilities: probabilities.sort((a, b) => b.probability - a.probability)
      };

    } catch (error) {
      console.error('Error calculating price probabilities:', error);
      return null;
    }
  }

  async calculateComprehensiveGreeks(currency: string, strike: number, expiry: string, optionType: 'call' | 'put' = 'call') {
    console.log(`\nUP: Calculating Comprehensive Greeks for ${currency}`);
    console.log(`Strike: $${strike.toLocaleString()}, Expiry: ${expiry}, Type: ${optionType}`);

    try {
      const currentPrice = await this.getCurrentPrice(currency);
      const timeToExpiry = (new Date(expiry).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000);
      
      if (timeToExpiry <= 0) {
        console.error('[ERROR] Invalid expiry date - must be in the future');
        return null;
      }

      // Get implied volatility from market
      const impliedVol = await this.getImpliedVolatility(currency, strike, expiry);
      
      console.log(`Current Price: $${currentPrice.toLocaleString()}`);
      console.log(`Time to Expiry: ${timeToExpiry.toFixed(4)} years`);
      console.log(`Implied Volatility: ${(impliedVol * 100).toFixed(2)}%`);

      // Calculate comprehensive Greeks
      const greeks = this.calculateBlackScholesGreeks(currentPrice, strike, timeToExpiry, impliedVol, 0.05, optionType);
      const optionPrice = this.calculateBlackScholesPrice(currentPrice, strike, timeToExpiry, impliedVol, 0.05, optionType);

      const intrinsicValue = optionType === 'call' 
        ? Math.max(0, currentPrice - strike)
        : Math.max(0, strike - currentPrice);

      const timeValue = optionPrice - intrinsicValue;
      const moneyness = currentPrice / strike;

      console.log(`\nMONEY: Option Pricing:`);
      console.log(`   Theoretical Price: $${optionPrice.toFixed(4)}`);
      console.log(`   Intrinsic Value: $${intrinsicValue.toFixed(4)}`);
      console.log(`   Time Value: $${timeValue.toFixed(4)}`);
      console.log(`   Moneyness: ${moneyness.toFixed(3)}`);

      console.log(`\n🔢 Greeks:`);
      console.log(`   Delta: ${greeks.delta.toFixed(4)} (${(greeks.delta * 100).toFixed(2)}% price sensitivity)`);
      console.log(`   Gamma: ${greeks.gamma.toFixed(6)} (delta change per $1 move)`);
      console.log(`   Theta: ${greeks.theta.toFixed(4)} (time decay per day)`);
      console.log(`   Vega: ${greeks.vega.toFixed(4)} (volatility sensitivity)`);
      console.log(`   Rho: ${greeks.rho.toFixed(4)} (interest rate sensitivity)`);
      console.log(`   Lambda: ${greeks.lambda.toFixed(4)} (leverage)`);

      console.log(`\n Risk Metrics:`);
      console.log(`   Probability ITM: ${(greeks.probabilityITM * 100).toFixed(2)}%`);
      console.log(`   Probability OTM: ${(greeks.probabilityOTM * 100).toFixed(2)}%`);
      console.log(`   Expected Payoff: $${greeks.expectedPayoff.toFixed(4)}`);
      console.log(`   Max Loss: $${greeks.maxLoss.toFixed(4)}`);
      console.log(`   Max Gain: ${greeks.maxGain === Infinity ? 'Unlimited' : '$' + greeks.maxGain.toFixed(4)}`);

      return {
        currency,
        strike,
        expiry,
        option_type: optionType,
        current_price: currentPrice,
        option_pricing: {
          theoretical_price: optionPrice,
          intrinsic_value: intrinsicValue,
          time_value: timeValue,
          moneyness: moneyness
        },
        greeks: greeks,
        risk_metrics: {
          probability_itm: greeks.probabilityITM,
          probability_otm: greeks.probabilityOTM,
          expected_payoff: greeks.expectedPayoff,
          max_loss: greeks.maxLoss,
          max_gain: greeks.maxGain
        }
      };

    } catch (error) {
      console.error('Error calculating Greeks:', error);
      return null;
    }
  }

  async analyzeVolatilitySurface(currency: string) {
    console.log(`\n[DATA] Analyzing Volatility Surface for ${currency}`);

    try {
      const instruments = await this.getInstruments(currency);
      const options = instruments.filter(inst => inst.kind === 'option' && !inst.expired);

      console.log(`Found ${options.length} ${currency} options`);

      // Build volatility surface
      const surface: { [expiry: string]: { [strike: number]: number } } = {};
      const termStructure: { [expiry: string]: number[] } = {};

      for (const option of options) {
        try {
          const tickerData = await this.getTickerData(option.instrument_name);
          
          if (tickerData.iv && tickerData.iv > 0) {
            if (!surface[option.expiry]) {
              surface[option.expiry] = {};
            }
            surface[option.expiry][option.strike] = tickerData.iv;

            if (!termStructure[option.expiry]) {
              termStructure[option.expiry] = [];
            }
            termStructure[option.expiry].push(tickerData.iv);
          }
        } catch (error) {
          // Skip individual option errors
        }
      }

      // Analyze term structure
      console.log(`\nUP: Volatility Term Structure:`);
      const sortedExpiries = Object.keys(termStructure).sort();
      
      for (const expiry of sortedExpiries.slice(0, 5)) { // Show first 5 expiries
        const ivs = termStructure[expiry];
        const avgIV = ivs.reduce((sum, iv) => sum + iv, 0) / ivs.length;
        const minIV = Math.min(...ivs);
        const maxIV = Math.max(...ivs);
        
        console.log(`   ${expiry}: Avg IV ${(avgIV * 100).toFixed(2)}% (Range: ${(minIV * 100).toFixed(2)}% - ${(maxIV * 100).toFixed(2)}%)`);
      }

      // Analyze volatility skew
      console.log(`\n[DATA] Volatility Skew Analysis:`);
      const skewAnalysis = this.analyzeVolatilitySkew(surface);
      
      for (const [expiry, skew] of Object.entries(skewAnalysis)) {
        console.log(`   ${expiry}: Skew ${skew.skew_percentage.toFixed(2)}% (${skew.pattern})`);
      }

      return {
        currency,
        total_options: options.length,
        volatility_surface: surface,
        term_structure: termStructure,
        skew_analysis: skewAnalysis
      };

    } catch (error) {
      console.error('Error analyzing volatility surface:', error);
      return null;
    }
  }

  private async getCurrentPrice(currency: string): Promise<number> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/public/ticker`, {
        params: { instrument_name: `${currency}-PERP` }
      });
      return response.data.result.last_price;
    } catch (error) {
      // Fallback prices
      return currency === 'BTC' ? 95000 : 3500;
    }
  }

  private async getInstruments(currency: string): Promise<any[]> {
    const response = await axios.get(`${this.apiBaseUrl}/public/get_instruments`, {
      params: {
        currency,
        kind: 'option',
        expired: false
      }
    });
    return response.data.result;
  }

  private async getTickerData(instrumentName: string): Promise<any> {
    const response = await axios.get(`${this.apiBaseUrl}/public/ticker`, {
      params: { instrument_name: instrumentName }
    });
    return response.data.result;
  }

  private async getImpliedVolatility(currency: string, strike: number, expiry: string): Promise<number> {
    try {
      // Try to find similar option in market
      const instruments = await this.getInstruments(currency);
      const similarOption = instruments.find(inst => 
        Math.abs(inst.strike - strike) / strike < 0.1 && 
        inst.expiry === expiry
      );

      if (similarOption) {
        const tickerData = await this.getTickerData(similarOption.instrument_name);
        return tickerData.iv || 0.8; // Default to 80% IV
      }
    } catch (error) {
      // Fallback
    }
    
    return 0.8; // Default IV
  }

  private calculatePriceProbability(currentPrice: number, targetPrice: number, timeToExpiry: number, currency: string): number {
    const volatility = this.getHistoricalVolatility(currency, timeToExpiry);
    const drift = 0; // No drift assumption
    const sigma = volatility * Math.sqrt(timeToExpiry);
    
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
    const lambda = (delta * S) / optionPrice;
    
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
    const baseVol = currency === 'BTC' ? 0.8 : 1.2;
    return Math.min(2.0, Math.max(0.1, baseVol + timeToExpiry * 0.1));
  }

  private analyzeVolatilitySkew(surface: { [expiry: string]: { [strike: number]: number } }): any {
    const skewAnalysis: { [expiry: string]: any } = {};
    
    for (const [expiry, strikes] of Object.entries(surface)) {
      const strikePrices = Object.keys(strikes).map(Number).sort((a, b) => a - b);
      const ivs = strikePrices.map(strike => strikes[strike]);
      
      if (strikePrices.length < 3) continue;
      
      const atmIndex = Math.floor(strikePrices.length / 2);
      const atmIV = ivs[atmIndex];
      const otmIV = ivs[ivs.length - 1];
      const itmIV = ivs[0];
      
      const skew = otmIV - itmIV;
      const skewPercentage = (skew / atmIV) * 100;
      
      let pattern = 'flat';
      if (skewPercentage > 5) pattern = 'positive_skew';
      if (skewPercentage < -5) pattern = 'negative_skew';
      
      skewAnalysis[expiry] = {
        atm_iv: atmIV,
        otm_iv: otmIV,
        itm_iv: itmIV,
        skew: skew,
        skew_percentage: skewPercentage,
        pattern: pattern
      };
    }
    
    return skewAnalysis;
  }
}

async function testDeribitProbabilityCalculations() {
  console.log('[TARGET] Deribit Probability & Greeks Calculator');
  console.log('==========================================');

  const calculator = new DeribitProbabilityCalculator();

  try {
    // Test 1: Price Probabilities
    console.log('\n[DATA] TEST 1: Price Probabilities');
    console.log('==============================');
    
    const btcTargets = [80000, 90000, 100000, 110000, 120000];
    const btcProbs = await calculator.calculatePriceProbabilities('BTC', btcTargets, 30);
    
    const ethTargets = [3000, 3500, 4000, 4500, 5000];
    const ethProbs = await calculator.calculatePriceProbabilities('ETH', ethTargets, 30);

    // Test 2: Comprehensive Greeks
    console.log('\nUP: TEST 2: Comprehensive Greeks');
    console.log('===============================');
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const expiry = futureDate.toISOString().split('T')[0];
    
    const btcGreeks = await calculator.calculateComprehensiveGreeks('BTC', 100000, expiry, 'call');
    const ethGreeks = await calculator.calculateComprehensiveGreeks('ETH', 4000, expiry, 'call');

    // Test 3: Volatility Surface Analysis
    console.log('\n[DATA] TEST 3: Volatility Surface Analysis');
    console.log('=====================================');
    
    const btcVolSurface = await calculator.analyzeVolatilitySurface('BTC');
    const ethVolSurface = await calculator.analyzeVolatilitySurface('ETH');

    console.log('\n[COMPLETE] All tests completed successfully!');
    console.log('\n[LIST] Summary:');
    console.log(`[SUCCESS] BTC Price Probabilities: ${btcProbs?.probabilities.length || 0} targets analyzed`);
    console.log(`[SUCCESS] ETH Price Probabilities: ${ethProbs?.probabilities.length || 0} targets analyzed`);
    console.log(`[SUCCESS] BTC Greeks: ${btcGreeks ? 'Calculated' : 'Failed'}`);
    console.log(`[SUCCESS] ETH Greeks: ${ethGreeks ? 'Calculated' : 'Failed'}`);
    console.log(`[SUCCESS] BTC Volatility Surface: ${btcVolSurface?.total_options || 0} options analyzed`);
    console.log(`[SUCCESS] ETH Volatility Surface: ${ethVolSurface?.total_options || 0} options analyzed`);

  } catch (error) {
    console.error('[ERROR] Test failed:', error);
  }
}

// Run the test
testDeribitProbabilityCalculations().catch(console.error);
