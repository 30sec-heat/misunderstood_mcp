import { PriceData, ArbitrageOpportunity } from '../index';

export class ArbitrageDetector {
    /**
     * Detect arbitrage opportunities across exchanges
     */
    async detectArbitrage(prices: PriceData[], symbol: string): Promise<ArbitrageOpportunity[]> {
        const opportunities: ArbitrageOpportunity[] = [];

        // Filter out exchanges with no prices
        const validPrices = prices.filter(p => p.spotPrice !== null || p.perpPrice !== null);

        if (validPrices.length < 2) {
            return opportunities;
        }

        // Detect spot arbitrage opportunities
        const spotPrices = validPrices
            .filter(p => p.spotPrice !== null)
            .map(p => ({ exchange: p.exchange, price: p.spotPrice!, type: 'spot' as const }));

        opportunities.push(...this.findArbitrageOpportunities(spotPrices, symbol, 'spot'));

        // Detect perp arbitrage opportunities
        const perpPrices = validPrices
            .filter(p => p.perpPrice !== null)
            .map(p => ({ exchange: p.exchange, price: p.perpPrice!, type: 'perp' as const }));

        opportunities.push(...this.findArbitrageOpportunities(perpPrices, symbol, 'perp'));

        // Detect cross arbitrage (spot vs perp)
        opportunities.push(...this.findCrossArbitrage(validPrices, symbol));

        // Sort by profit percentage (highest first)
        return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
    }

    /**
     * Find arbitrage opportunities within the same market type
     */
    private findArbitrageOpportunities(
        prices: Array<{ exchange: string; price: number; type: 'spot' | 'perp' }>,
        symbol: string,
        marketType: 'spot' | 'perp'
    ): ArbitrageOpportunity[] {
        const opportunities: ArbitrageOpportunity[] = [];

        for (let i = 0; i < prices.length; i++) {
            for (let j = i + 1; j < prices.length; j++) {
                const price1 = prices[i];
                const price2 = prices[j];

                // Calculate profit percentage
                const profitPercentage1 = ((price2.price - price1.price) / price1.price) * 100;
                const profitPercentage2 = ((price1.price - price2.price) / price2.price) * 100;

                // Only consider opportunities with at least 0.1% profit
                if (profitPercentage1 > 0.1) {
                    opportunities.push({
                        symbol,
                        buyExchange: price1.exchange,
                        sellExchange: price2.exchange,
                        buyPrice: price1.price,
                        sellPrice: price2.price,
                        profitPercentage: profitPercentage1,
                        profitAmount: price2.price - price1.price,
                        type: marketType
                    });
                }

                if (profitPercentage2 > 0.1) {
                    opportunities.push({
                        symbol,
                        buyExchange: price2.exchange,
                        sellExchange: price1.exchange,
                        buyPrice: price2.price,
                        sellPrice: price1.price,
                        profitPercentage: profitPercentage2,
                        profitAmount: price1.price - price2.price,
                        type: marketType
                    });
                }
            }
        }

        return opportunities;
    }

    /**
     * Find cross arbitrage opportunities (spot vs perp)
     */
    private findCrossArbitrage(prices: PriceData[], symbol: string): ArbitrageOpportunity[] {
        const opportunities: ArbitrageOpportunity[] = [];

        for (const price of prices) {
            if (price.spotPrice !== null && price.perpPrice !== null) {
                // Same exchange, different markets
                const profitPercentage = ((price.perpPrice - price.spotPrice) / price.spotPrice) * 100;
                
                if (Math.abs(profitPercentage) > 0.1) {
                    if (profitPercentage > 0) {
                        // Perp is higher, buy spot sell perp
                        opportunities.push({
                            symbol,
                            buyExchange: `${price.exchange} (Spot)`,
                            sellExchange: `${price.exchange} (Perp)`,
                            buyPrice: price.spotPrice,
                            sellPrice: price.perpPrice,
                            profitPercentage,
                            profitAmount: price.perpPrice - price.spotPrice,
                            type: 'cross'
                        });
                    } else {
                        // Spot is higher, buy perp sell spot
                        opportunities.push({
                            symbol,
                            buyExchange: `${price.exchange} (Perp)`,
                            sellExchange: `${price.exchange} (Spot)`,
                            buyPrice: price.perpPrice,
                            sellPrice: price.spotPrice,
                            profitPercentage: Math.abs(profitPercentage),
                            profitAmount: price.spotPrice - price.perpPrice,
                            type: 'cross'
                        });
                    }
                }
            }
        }

        return opportunities;
    }

    /**
     * Detect price dislocation across exchanges
     */
    detectPriceDislocation(
        prices: PriceData[],
        symbol: string,
        threshold: number = 0.01
    ): {
        symbol: string;
        dislocatedExchanges: Array<{
            exchange: string;
            price: number;
            deviation: number;
            deviationPercentage: number;
        }>;
        averagePrice: number;
        dislocationSeverity: 'low' | 'medium' | 'high';
    } {
        // Get all valid spot prices
        const validSpotPrices = prices
            .filter(p => p.spotPrice !== null)
            .map(p => p.spotPrice!);

        if (validSpotPrices.length === 0) {
            return {
                symbol,
                dislocatedExchanges: [],
                averagePrice: 0,
                dislocationSeverity: 'low'
            };
        }

        // Calculate average price
        const averagePrice = validSpotPrices.reduce((sum, price) => sum + price, 0) / validSpotPrices.length;

        // Find dislocated exchanges
        const dislocatedExchanges: Array<{
            exchange: string;
            price: number;
            deviation: number;
            deviationPercentage: number;
        }> = [];

        for (const price of prices) {
            if (price.spotPrice !== null) {
                const deviation = Math.abs(price.spotPrice - averagePrice);
                const deviationPercentage = (deviation / averagePrice) * 100;

                if (deviationPercentage > threshold * 100) {
                    dislocatedExchanges.push({
                        exchange: price.exchange,
                        price: price.spotPrice,
                        deviation,
                        deviationPercentage
                    });
                }
            }
        }

        // Determine dislocation severity
        let dislocationSeverity: 'low' | 'medium' | 'high' = 'low';
        const maxDeviation = Math.max(...dislocatedExchanges.map(d => d.deviationPercentage));
        
        if (maxDeviation > 5) {
            dislocationSeverity = 'high';
        } else if (maxDeviation > 2) {
            dislocationSeverity = 'medium';
        }

        return {
            symbol,
            dislocatedExchanges: dislocatedExchanges.sort((a, b) => b.deviationPercentage - a.deviationPercentage),
            averagePrice,
            dislocationSeverity
        };
    }

    /**
     * Calculate price spread across exchanges
     */
    calculatePriceSpread(prices: PriceData[]): {
        minPrice: number;
        maxPrice: number;
        spread: number;
        spreadPercentage: number;
        exchanges: {
            min: string;
            max: string;
        };
    } {
        const validSpotPrices = prices
            .filter(p => p.spotPrice !== null)
            .map(p => ({ exchange: p.exchange, price: p.spotPrice! }));

        if (validSpotPrices.length === 0) {
            return {
                minPrice: 0,
                maxPrice: 0,
                spread: 0,
                spreadPercentage: 0,
                exchanges: { min: '', max: '' }
            };
        }

        const minPrice = Math.min(...validSpotPrices.map(p => p.price));
        const maxPrice = Math.max(...validSpotPrices.map(p => p.price));
        const spread = maxPrice - minPrice;
        const spreadPercentage = (spread / minPrice) * 100;

        const minExchange = validSpotPrices.find(p => p.price === minPrice)?.exchange || '';
        const maxExchange = validSpotPrices.find(p => p.price === maxPrice)?.exchange || '';

        return {
            minPrice,
            maxPrice,
            spread,
            spreadPercentage,
            exchanges: { min: minExchange, max: maxExchange }
        };
    }
}
