import { PriceData, ArbitrageOpportunity, QuoteAnalysis } from '../index';

export class QuoteAnalyzer {
    /**
     * Analyze quote data and provide comprehensive insights
     */
    analyzeQuotes(
        prices: PriceData[],
        symbol: string,
        arbitrageOpportunities: ArbitrageOpportunity[]
    ): QuoteAnalysis {
        const validSpotPrices = prices
            .filter(p => p.spotPrice !== null)
            .map(p => p.spotPrice!);

        const validPerpPrices = prices
            .filter(p => p.perpPrice !== null)
            .map(p => p.perpPrice!);

        // Calculate average price (using spot prices as primary)
        const averagePrice = validSpotPrices.length > 0 
            ? validSpotPrices.reduce((sum, price) => sum + price, 0) / validSpotPrices.length
            : validPerpPrices.reduce((sum, price) => sum + price, 0) / validPerpPrices.length;

        // Calculate price range
        const allPrices = [...validSpotPrices, ...validPerpPrices];
        const minPrice = Math.min(...allPrices);
        const maxPrice = Math.max(...allPrices);
        const spread = maxPrice - minPrice;
        const spreadPercentage = (spread / minPrice) * 100;

        // Calculate total volume
        const totalVolume24h = prices
            .filter(p => p.volume24h !== null)
            .reduce((sum, p) => sum + p.volume24h!, 0);

        // Find most liquid exchange
        const mostLiquidExchange = prices
            .filter(p => p.volume24h !== null)
            .sort((a, b) => b.volume24h! - a.volume24h!)[0]?.exchange || '';

        // Calculate volatility
        const priceVariation = this.calculatePriceVariation(allPrices);
        const isVolatile = priceVariation > 0.05; // 5% threshold

        return {
            symbol,
            averagePrice,
            priceRange: {
                min: minPrice,
                max: maxPrice,
                spread,
                spreadPercentage
            },
            exchanges: prices,
            arbitrageOpportunities,
            liquidity: {
                totalVolume24h,
                mostLiquidExchange
            },
            volatility: {
                priceVariation,
                isVolatile
            }
        };
    }

    /**
     * Calculate price variation (standard deviation as percentage of mean)
     */
    private calculatePriceVariation(prices: number[]): number {
        if (prices.length === 0) return 0;

        const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
        const standardDeviation = Math.sqrt(variance);

        return standardDeviation / mean;
    }

    /**
     * Generate market summary
     */
    generateMarketSummary(analysis: QuoteAnalysis): string {
        const { symbol, averagePrice, priceRange, arbitrageOpportunities, liquidity, volatility } = analysis;

        let summary = `[DATA] Market Summary for ${symbol}\n\n`;
        
        // Price overview
        summary += `MONEY: Price Overview:\n`;
        summary += `• Average Price: $${this.formatPrice(averagePrice)}\n`;
        summary += `• Price Range: $${this.formatPrice(priceRange.min)} - $${this.formatPrice(priceRange.max)}\n`;
        summary += `• Spread: ${priceRange.spreadPercentage.toFixed(2)}%\n\n`;

        // Arbitrage opportunities
        if (arbitrageOpportunities.length > 0) {
            summary += `[TARGET] Arbitrage Opportunities:\n`;
            const topOpportunity = arbitrageOpportunities[0];
            summary += `• Best: ${topOpportunity.buyExchange} → ${topOpportunity.sellExchange}\n`;
            summary += `• Profit: ${topOpportunity.profitPercentage.toFixed(2)}% ($${this.formatPrice(topOpportunity.profitAmount)})\n`;
            summary += `• Total Opportunities: ${arbitrageOpportunities.length}\n\n`;
        } else {
            summary += `[TARGET] No significant arbitrage opportunities found\n\n`;
        }

        // Liquidity
        summary += `💧 Liquidity:\n`;
        summary += `• Total Volume 24h: $${this.formatPrice(liquidity.totalVolume24h)}\n`;
        summary += `• Most Liquid Exchange: ${liquidity.mostLiquidExchange}\n\n`;

        // Volatility
        summary += `UP: Volatility:\n`;
        summary += `• Price Variation: ${(volatility.priceVariation * 100).toFixed(2)}%\n`;
        summary += `• Market Status: ${volatility.isVolatile ? '🔴 Volatile' : '🟢 Stable'}\n`;

        return summary;
    }

    /**
     * Generate exchange comparison table
     */
    generateExchangeComparisonTable(prices: PriceData[]): string {
        const header = 'Exchange    Spot Price    Perp Price    Volume 24h    Status';
        const separator = '─────────────────────────────────────────────────────────────────────';
        
        let table = `${header}\n${separator}\n`;

        for (const price of prices) {
            const spotStr = price.spotPrice ? `$${this.formatPrice(price.spotPrice)}` : 'N/A';
            const perpStr = price.perpPrice ? `$${this.formatPrice(price.perpPrice)}` : 'N/A';
            const volumeStr = price.volume24h ? `$${this.formatPrice(price.volume24h)}` : 'N/A';
            
            // Determine status
            let status = '🟢 Active';
            if (price.spotPrice === null && price.perpPrice === null) {
                status = '🔴 Unavailable';
            } else if (price.spotPrice === null || price.perpPrice === null) {
                status = '🟡 Partial';
            }
            
            table += `${price.exchange.padEnd(11)} ${spotStr.padEnd(12)} ${perpStr.padEnd(12)} ${volumeStr.padEnd(12)} ${status}\n`;
        }

        return table;
    }

    /**
     * Detect market anomalies
     */
    detectMarketAnomalies(analysis: QuoteAnalysis): Array<{
        type: 'price_spike' | 'volume_surge' | 'arbitrage_opportunity' | 'price_dislocation';
        severity: 'low' | 'medium' | 'high';
        description: string;
        impact: string;
    }> {
        const anomalies: Array<{
            type: 'price_spike' | 'volume_surge' | 'arbitrage_opportunity' | 'price_dislocation';
            severity: 'low' | 'medium' | 'high';
            description: string;
            impact: string;
        }> = [];

        // Check for price dislocation
        if (analysis.priceRange.spreadPercentage > 5) {
            anomalies.push({
                type: 'price_dislocation',
                severity: analysis.priceRange.spreadPercentage > 10 ? 'high' : 'medium',
                description: `Significant price spread detected: ${analysis.priceRange.spreadPercentage.toFixed(2)}%`,
                impact: 'Potential arbitrage opportunities or market inefficiencies'
            });
        }

        // Check for arbitrage opportunities
        if (analysis.arbitrageOpportunities.length > 0) {
            const bestArbitrage = analysis.arbitrageOpportunities[0];
            if (bestArbitrage.profitPercentage > 2) {
                anomalies.push({
                    type: 'arbitrage_opportunity',
                    severity: bestArbitrage.profitPercentage > 5 ? 'high' : 'medium',
                    description: `Arbitrage opportunity: ${bestArbitrage.profitPercentage.toFixed(2)}% profit`,
                    impact: `Buy on ${bestArbitrage.buyExchange}, sell on ${bestArbitrage.sellExchange}`
                });
            }
        }

        // Check for high volatility
        if (analysis.volatility.isVolatile) {
            anomalies.push({
                type: 'price_spike',
                severity: analysis.volatility.priceVariation > 0.1 ? 'high' : 'medium',
                description: `High price volatility: ${(analysis.volatility.priceVariation * 100).toFixed(2)}%`,
                impact: 'Increased risk and potential for rapid price movements'
            });
        }

        return anomalies;
    }

    /**
     * Format price for display
     */
    private formatPrice(price: number): string {
        if (price >= 1000) {
            return price.toFixed(0); // $1,000+ -> 0 decimals
        } else if (price >= 100) {
            return price.toFixed(1); // $100-999 -> 1 decimal
        } else if (price >= 10) {
            return price.toFixed(2); // $10-99 -> 2 decimals
        } else if (price >= 1) {
            return price.toFixed(2); // $1-9 -> 2 decimals
        } else if (price >= 0.1) {
            return price.toFixed(3); // $0.1-0.9 -> 3 decimals
        } else {
            return price.toFixed(8); // <$0.1 -> 8 decimals
        }
    }
}
