/**
 * Theoretical Implied Volatility Calculator
 * Calculates IV based on market conditions without needing options data
 */

export class TheoreticalIVCalculator {
  /**
   * Calculate theoretical IV based on current market conditions
   */
  calculateTheoreticalIV(
    spotPrice: number,
    historicalVol: number,
    timeToExpiry: number = 30, // days
    marketConditions?: {
      priceLevel?: 'ath' | 'high' | 'medium' | 'low';
      volRegime?: 'low' | 'normal' | 'high';
      trend?: 'up' | 'sideways' | 'down';
    }
  ): {
    atm_iv: number;
    iv_premium: number;
    iv_term_structure: { [days: string]: number };
    volatility_smile: { [moneyness: string]: number };
    analysis: string;
  } {
    // Base IV starts from historical vol
    let baseIV = historicalVol;
    
    // Apply risk premium (IV typically trades above RV)
    const riskPremium = 1.15; // 15% premium on average
    let theoreticalIV = baseIV * riskPremium;
    
    // Adjust for market conditions
    if (marketConditions) {
      // Price level adjustment
      if (marketConditions.priceLevel === 'ath') {
        theoreticalIV *= 1.2; // Higher IV at all-time highs
      } else if (marketConditions.priceLevel === 'low') {
        theoreticalIV *= 1.1;
      }
      
      // Vol regime adjustment
      if (marketConditions.volRegime === 'low') {
        theoreticalIV *= 0.9; // Compress IV in low vol regimes
      } else if (marketConditions.volRegime === 'high') {
        theoreticalIV *= 1.3;
      }
      
      // Trend adjustment
      if (marketConditions.trend === 'up') {
        theoreticalIV *= 0.95; // Lower IV in strong uptrends
      } else if (marketConditions.trend === 'down') {
        theoreticalIV *= 1.15; // Higher IV in downtrends
      }
    }
    
    // Calculate term structure (typically upward sloping)
    const termStructure: { [days: string]: number } = {
      '1': theoreticalIV * 0.8,
      '7': theoreticalIV * 0.9,
      '30': theoreticalIV,
      '60': theoreticalIV * 1.05,
      '90': theoreticalIV * 1.08,
      '180': theoreticalIV * 1.1
    };
    
    // Calculate volatility smile
    const volatilitySmile: { [moneyness: string]: number } = {
      '0.8': theoreticalIV * 1.15, // 20% OTM puts
      '0.9': theoreticalIV * 1.08, // 10% OTM puts
      '0.95': theoreticalIV * 1.03, // 5% OTM puts
      '1.0': theoreticalIV,        // ATM
      '1.05': theoreticalIV * 1.02, // 5% OTM calls
      '1.1': theoreticalIV * 1.05,  // 10% OTM calls
      '1.2': theoreticalIV * 1.12   // 20% OTM calls
    };
    
    // IV premium calculation
    const ivPremium = (theoreticalIV / historicalVol - 1) * 100;
    
    // Generate analysis
    const analysis = this.generateAnalysis(
      spotPrice,
      historicalVol,
      theoreticalIV,
      ivPremium,
      marketConditions
    );
    
    return {
      atm_iv: theoreticalIV,
      iv_premium: ivPremium,
      iv_term_structure: termStructure,
      volatility_smile: volatilitySmile,
      analysis
    };
  }
  
  private generateAnalysis(
    spotPrice: number,
    historicalVol: number,
    theoreticalIV: number,
    ivPremium: number,
    conditions?: any
  ): string {
    const parts = [];
    
    // Current state
    parts.push(`BTC at $${spotPrice.toLocaleString()}`);
    parts.push(`Historical Vol: ${(historicalVol * 100).toFixed(1)}%`);
    parts.push(`Theoretical ATM IV: ${(theoreticalIV * 100).toFixed(1)}%`);
    parts.push(`IV Premium: ${ivPremium > 0 ? '+' : ''}${ivPremium.toFixed(1)}%`);
    
    // Assessment
    if (ivPremium < -10) {
      parts.push("\nLIGHTNING: IV appears VERY CHEAP relative to historical vol");
    } else if (ivPremium < 0) {
      parts.push("\n[SUCCESS] IV appears CHEAP relative to historical vol");
    } else if (ivPremium < 20) {
      parts.push("\n[DATA] IV fairly priced relative to historical vol");
    } else {
      parts.push("\n[WARNING] IV appears EXPENSIVE relative to historical vol");
    }
    
    // Market conditions
    if (conditions?.priceLevel === 'ath' && conditions?.volRegime === 'low') {
      parts.push("\n[ALERT] ATH with low vol is often a compression before expansion");
    }
    
    return parts.join('\n');
  }
}
