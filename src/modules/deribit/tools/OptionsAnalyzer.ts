/**
 * Options Chain Analyzer
 * Analyzes options data for volatility insights
 */

import { DeribitOption } from './DeribitAPIClient.js';

export interface VolatilityAnalysis {
  current_iv: {
    atm_iv: number;
    iv_rank: number;
    iv_percentile: number;
  };
  term_structure: Array<{
    expiry: string;
    days_to_expiry: number;
    atm_iv: number;
    iv_skew: number;
  }>;
  volatility_smile: Array<{
    strike: number;
    moneyness: number;
    call_iv: number;
    put_iv: number;
    iv_skew: number;
  }>;
  iv_vs_hv: {
    current_iv: number;
    hv_30d: number;
    hv_60d: number;
    hv_90d: number;
    iv_premium: number;
    assessment: string;
  };
  key_insights: string[];
}

export class OptionsAnalyzer {
  
  /**
   * Analyze full options chain
   */
  analyzeOptionsChain(
    options: DeribitOption[],
    spotPrice: number,
    historicalVol?: { hv_30d: number; hv_60d: number; hv_90d: number }
  ): VolatilityAnalysis {
    // Group options by expiry
    const optionsByExpiry = this.groupByExpiry(options);
    
    // Get ATM IV
    const atmIV = this.calculateATMIV(options, spotPrice);
    
    // Calculate term structure
    const termStructure = this.calculateTermStructure(optionsByExpiry, spotPrice);
    
    // Calculate volatility smile for nearest expiry
    const nearestExpiry = this.getNearestExpiry(optionsByExpiry);
    const volatilitySmile = this.calculateVolatilitySmile(nearestExpiry.options, spotPrice);
    
    // IV vs HV analysis
    const ivVsHv = this.analyzeIVvsHV(atmIV, historicalVol);
    
    // Generate insights
    const insights = this.generateInsights(atmIV, termStructure, volatilitySmile, ivVsHv);
    
    return {
      current_iv: {
        atm_iv: atmIV,
        iv_rank: this.calculateIVRank(atmIV),
        iv_percentile: this.calculateIVPercentile(atmIV)
      },
      term_structure: termStructure,
      volatility_smile: volatilitySmile,
      iv_vs_hv: ivVsHv,
      key_insights: insights
    };
  }
  
  /**
   * Group options by expiry date
   */
  private groupByExpiry(options: DeribitOption[]): Map<string, {
    expiry: string;
    daysToExpiry: number;
    options: DeribitOption[];
  }> {
    const grouped = new Map<string, DeribitOption[]>();
    
    options.forEach(option => {
      // Extract expiry from instrument name (e.g., "BTC-29DEC23-50000-C")
      const parts = option.instrument_name.split('-');
      const expiry = parts[1];
      
      if (!grouped.has(expiry)) {
        grouped.set(expiry, []);
      }
      grouped.get(expiry)!.push(option);
    });
    
    // Convert to structured format with days to expiry
    const result = new Map();
    grouped.forEach((opts, expiry) => {
      const expiryDate = this.parseExpiryDate(expiry);
      const daysToExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      result.set(expiry, {
        expiry: expiry,
        daysToExpiry: daysToExpiry,
        options: opts
      });
    });
    
    return result;
  }
  
  /**
   * Calculate ATM implied volatility
   */
  private calculateATMIV(options: DeribitOption[], spotPrice: number): number {
    // Find options closest to ATM
    const atmOptions = options
      .filter(opt => opt.mark_iv > 0)
      .map(opt => ({
        ...opt,
        moneyness: Math.abs(opt.strike - spotPrice) / spotPrice
      }))
      .sort((a, b) => a.moneyness - b.moneyness)
      .slice(0, 4); // Take 2 closest calls and puts
    
    if (atmOptions.length === 0) return 0;
    
    // Average the IVs
    const avgIV = atmOptions.reduce((sum, opt) => sum + opt.mark_iv, 0) / atmOptions.length;
    return avgIV / 100; // Convert from percentage
  }
  
  /**
   * Calculate term structure
   */
  private calculateTermStructure(
    optionsByExpiry: Map<string, any>,
    spotPrice: number
  ): Array<any> {
    const termStructure: Array<any> = [];
    
    optionsByExpiry.forEach((expiryData, expiry) => {
      const atmIV = this.calculateATMIV(expiryData.options, spotPrice);
      const skew = this.calculateSkew(expiryData.options, spotPrice);
      
      termStructure.push({
        expiry: expiry,
        days_to_expiry: expiryData.daysToExpiry,
        atm_iv: atmIV,
        iv_skew: skew
      });
    });
    
    // Sort by days to expiry
    return termStructure.sort((a, b) => a.days_to_expiry - b.days_to_expiry);
  }
  
  /**
   * Calculate volatility smile
   */
  private calculateVolatilitySmile(
    options: DeribitOption[],
    spotPrice: number
  ): Array<any> {
    // Group by strike
    const strikeMap = new Map<number, { call?: DeribitOption; put?: DeribitOption }>();
    
    options.forEach(opt => {
      if (!strikeMap.has(opt.strike)) {
        strikeMap.set(opt.strike, {});
      }
      
      if (opt.option_type === 'call') {
        strikeMap.get(opt.strike)!.call = opt;
      } else {
        strikeMap.get(opt.strike)!.put = opt;
      }
    });
    
    const smile: Array<any> = [];
    
    strikeMap.forEach((opts, strike) => {
      const moneyness = strike / spotPrice;
      
      smile.push({
        strike: strike,
        moneyness: moneyness,
        call_iv: opts.call ? opts.call.mark_iv / 100 : 0,
        put_iv: opts.put ? opts.put.mark_iv / 100 : 0,
        iv_skew: opts.call && opts.put ? (opts.put.mark_iv - opts.call.mark_iv) / 100 : 0
      });
    });
    
    return smile.sort((a, b) => a.strike - b.strike);
  }
  
  /**
   * Calculate skew
   */
  private calculateSkew(options: DeribitOption[], spotPrice: number): number {
    const otmPuts = options.filter(opt => 
      opt.option_type === 'put' && 
      opt.strike < spotPrice * 0.9 &&
      opt.mark_iv > 0
    );
    
    const otmCalls = options.filter(opt => 
      opt.option_type === 'call' && 
      opt.strike > spotPrice * 1.1 &&
      opt.mark_iv > 0
    );
    
    if (otmPuts.length === 0 || otmCalls.length === 0) return 0;
    
    const avgPutIV = otmPuts.reduce((sum, opt) => sum + opt.mark_iv, 0) / otmPuts.length;
    const avgCallIV = otmCalls.reduce((sum, opt) => sum + opt.mark_iv, 0) / otmCalls.length;
    
    return (avgPutIV - avgCallIV) / 100;
  }
  
  /**
   * Analyze IV vs Historical Volatility
   */
  private analyzeIVvsHV(
    currentIV: number,
    historicalVol?: { hv_30d: number; hv_60d: number; hv_90d: number }
  ): any {
    const hv = historicalVol || { hv_30d: 0.6, hv_60d: 0.65, hv_90d: 0.7 };
    const avgHV = (hv.hv_30d + hv.hv_60d + hv.hv_90d) / 3;
    const ivPremium = ((currentIV / avgHV) - 1) * 100;
    
    let assessment = '';
    if (ivPremium < -20) {
      assessment = 'IV is extremely cheap relative to historical volatility';
    } else if (ivPremium < -10) {
      assessment = 'IV is cheap relative to historical volatility';
    } else if (ivPremium < 10) {
      assessment = 'IV is fairly valued relative to historical volatility';
    } else if (ivPremium < 20) {
      assessment = 'IV is expensive relative to historical volatility';
    } else {
      assessment = 'IV is extremely expensive relative to historical volatility';
    }
    
    return {
      current_iv: currentIV,
      hv_30d: hv.hv_30d,
      hv_60d: hv.hv_60d,
      hv_90d: hv.hv_90d,
      iv_premium: ivPremium,
      assessment: assessment
    };
  }
  
  /**
   * Generate key insights
   */
  private generateInsights(
    atmIV: number,
    termStructure: Array<any>,
    volatilitySmile: Array<any>,
    ivVsHv: any
  ): string[] {
    const insights: string[] = [];
    
    // ATM IV level
    const ivLevel = atmIV * 100;
    if (ivLevel < 40) {
      insights.push(`DOWN: ATM IV at ${ivLevel.toFixed(1)}% is at historically low levels`);
    } else if (ivLevel > 80) {
      insights.push(`UP: ATM IV at ${ivLevel.toFixed(1)}% is elevated`);
    } else {
      insights.push(`[DATA] ATM IV at ${ivLevel.toFixed(1)}% is in normal range`);
    }
    
    // Term structure
    if (termStructure.length >= 2) {
      const shortTerm = termStructure[0].atm_iv;
      const longTerm = termStructure[termStructure.length - 1].atm_iv;
      
      if (shortTerm > longTerm * 1.1) {
        insights.push('UP: Inverted term structure suggests near-term event risk');
      } else if (longTerm > shortTerm * 1.1) {
        insights.push('[DATA] Normal upward-sloping term structure');
      } else {
        insights.push('➡ Flat term structure across expiries');
      }
    }
    
    // Skew analysis
    const avgSkew = volatilitySmile.reduce((sum, point) => sum + Math.abs(point.iv_skew), 0) / volatilitySmile.length;
    if (avgSkew > 0.05) {
      insights.push('[REFRESH] High put skew indicates downside protection demand');
    }
    
    // IV vs HV
    if (ivVsHv.iv_premium < -15) {
      insights.push('DIAMOND: ' + ivVsHv.assessment);
    } else if (ivVsHv.iv_premium > 15) {
      insights.push('[WARNING] ' + ivVsHv.assessment);
    }
    
    return insights;
  }
  
  // Helper methods
  private getNearestExpiry(optionsByExpiry: Map<string, any>): any {
    let nearest = null;
    let minDays = Infinity;
    
    optionsByExpiry.forEach(data => {
      if (data.daysToExpiry < minDays && data.daysToExpiry > 0) {
        minDays = data.daysToExpiry;
        nearest = data;
      }
    });
    
    return nearest;
  }
  
  private parseExpiryDate(expiry: string): Date {
    // Parse format like "29DEC23"
    const day = parseInt(expiry.substring(0, 2));
    const monthStr = expiry.substring(2, 5);
    const year = 2000 + parseInt(expiry.substring(5));
    
    const monthMap: { [key: string]: number } = {
      'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3,
      'MAY': 4, 'JUN': 5, 'JUL': 6, 'AUG': 7,
      'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
    };
    
    return new Date(year, monthMap[monthStr], day);
  }
  
  private calculateIVRank(currentIV: number): number {
    // Simplified IV rank (would need historical data for accurate calculation)
    const ivPercent = currentIV * 100;
    if (ivPercent < 40) return 10;
    if (ivPercent < 50) return 25;
    if (ivPercent < 60) return 50;
    if (ivPercent < 80) return 75;
    return 90;
  }
  
  private calculateIVPercentile(currentIV: number): number {
    // Simplified IV percentile
    return this.calculateIVRank(currentIV);
  }
}
