import { PriceData } from '../index';

export class ExchangeComparator {
    /**
     * Compare exchanges for a symbol
     */
    compareExchanges(prices: PriceData[], symbol: string): {
        bestPrice: { exchange: string; price: number; type: 'spot' | 'perp' };
        worstPrice: { exchange: string; price: number; type: 'spot' | 'perp' };
        priceSpread: number;
        exchanges: PriceData[];
    } {
        const validPrices = prices.filter(p => p.spotPrice !== null || p.perpPrice !== null);

        if (validPrices.length === 0) {
            return {
                bestPrice: { exchange: '', price: 0, type: 'spot' },
                worstPrice: { exchange: '', price: 0, type: 'spot' },
                priceSpread: 0,
                exchanges: prices
            };
        }

        // Find best and worst spot prices
        const spotPrices = validPrices
            .filter(p => p.spotPrice !== null)
            .map(p => ({ exchange: p.exchange, price: p.spotPrice!, type: 'spot' as const }));

        const perpPrices = validPrices
            .filter(p => p.perpPrice !== null)
            .map(p => ({ exchange: p.exchange, price: p.perpPrice!, type: 'perp' as const }));

        const allPrices = [...spotPrices, ...perpPrices];

        if (allPrices.length === 0) {
            return {
                bestPrice: { exchange: '', price: 0, type: 'spot' },
                worstPrice: { exchange: '', price: 0, type: 'spot' },
                priceSpread: 0,
                exchanges: prices
            };
        }

        const bestPrice = allPrices.reduce((best, current) => 
            current.price < best.price ? current : best
        );

        const worstPrice = allPrices.reduce((worst, current) => 
            current.price > worst.price ? current : worst
        );

        const priceSpread = worstPrice.price - bestPrice.price;

        return {
            bestPrice,
            worstPrice,
            priceSpread,
            exchanges: prices
        };
    }

    /**
     * Rank exchanges by price competitiveness
     */
    rankExchangesByPrice(prices: PriceData[]): Array<{
        exchange: string;
        spotPrice: number | null;
        perpPrice: number | null;
        averagePrice: number;
        rank: number;
        priceDeviation: number;
    }> {
        const validPrices = prices.filter(p => p.spotPrice !== null || p.perpPrice !== null);

        if (validPrices.length === 0) {
            return [];
        }

        // Calculate average price
        const allPrices = validPrices
            .map(p => [p.spotPrice, p.perpPrice])
            .flat()
            .filter(price => price !== null) as number[];

        const averagePrice = allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length;

        // Calculate rankings
        const rankings = validPrices.map(price => {
            const spotPrice = price.spotPrice || 0;
            const perpPrice = price.perpPrice || 0;
            const averageExchangePrice = (spotPrice + perpPrice) / 2;
            const priceDeviation = Math.abs(averageExchangePrice - averagePrice);

            return {
                exchange: price.exchange,
                spotPrice: price.spotPrice,
                perpPrice: price.perpPrice,
                averagePrice: averageExchangePrice,
                rank: 0, // Will be set below
                priceDeviation
            };
        });

        // Sort by price deviation (closest to average first)
        rankings.sort((a, b) => a.priceDeviation - b.priceDeviation);

        // Assign ranks
        rankings.forEach((ranking, index) => {
            ranking.rank = index + 1;
        });

        return rankings;
    }

    /**
     * Compare exchange liquidity
     */
    compareExchangeLiquidity(prices: PriceData[]): Array<{
        exchange: string;
        volume24h: number;
        rank: number;
        liquidityScore: number;
    }> {
        const validPrices = prices.filter(p => p.volume24h !== null);

        if (validPrices.length === 0) {
            return [];
        }

        // Calculate liquidity rankings
        const liquidityRankings = validPrices.map(price => ({
            exchange: price.exchange,
            volume24h: price.volume24h!,
            rank: 0, // Will be set below
            liquidityScore: 0 // Will be set below
        }));

        // Sort by volume (highest first)
        liquidityRankings.sort((a, b) => b.volume24h - a.volume24h);

        // Calculate liquidity scores and assign ranks
        const maxVolume = liquidityRankings[0].volume24h;
        liquidityRankings.forEach((ranking, index) => {
            ranking.rank = index + 1;
            ranking.liquidityScore = (ranking.volume24h / maxVolume) * 100;
        });

        return liquidityRankings;
    }

    /**
     * Generate exchange comparison report
     */
    generateExchangeComparisonReport(prices: PriceData[], symbol: string): string {
        const comparison = this.compareExchanges(prices, symbol);
        const priceRankings = this.rankExchangesByPrice(prices);
        const liquidityRankings = this.compareExchangeLiquidity(prices);

        let report = `[DATA] Exchange Comparison Report for ${symbol}\n\n`;

        // Price comparison
        report += `MONEY: Price Comparison:\n`;
        report += `• Best Price: ${comparison.bestPrice.exchange} (${comparison.bestPrice.type}) - $${this.formatPrice(comparison.bestPrice.price)}\n`;
        report += `• Worst Price: ${comparison.worstPrice.exchange} (${comparison.worstPrice.type}) - $${this.formatPrice(comparison.worstPrice.price)}\n`;
        report += `• Price Spread: $${this.formatPrice(comparison.priceSpread)}\n\n`;

        // Price rankings
        if (priceRankings.length > 0) {
            report += ` Price Rankings (closest to average):\n`;
            priceRankings.slice(0, 5).forEach(ranking => {
                const priceStr = ranking.spotPrice && ranking.perpPrice 
                    ? `Spot: $${this.formatPrice(ranking.spotPrice)}, Perp: $${this.formatPrice(ranking.perpPrice)}`
                    : ranking.spotPrice 
                    ? `Spot: $${this.formatPrice(ranking.spotPrice)}`
                    : `Perp: $${this.formatPrice(ranking.perpPrice!)}`;
                
                report += `${ranking.rank}. ${ranking.exchange} - ${priceStr}\n`;
            });
            report += '\n';
        }

        // Liquidity rankings
        if (liquidityRankings.length > 0) {
            report += `💧 Liquidity Rankings:\n`;
            liquidityRankings.slice(0, 5).forEach(ranking => {
                report += `${ranking.rank}. ${ranking.exchange} - $${this.formatPrice(ranking.volume24h)} (${ranking.liquidityScore.toFixed(1)}%)\n`;
            });
            report += '\n';
        }

        // Recommendations
        report += `[INFO] Recommendations:\n`;
        if (comparison.priceSpread > 0.01) {
            report += `• Consider arbitrage between ${comparison.bestPrice.exchange} and ${comparison.worstPrice.exchange}\n`;
        }
        if (liquidityRankings.length > 0) {
            const mostLiquid = liquidityRankings[0];
            report += `• Best liquidity: ${mostLiquid.exchange} (${mostLiquid.liquidityScore.toFixed(1)}% of max)\n`;
        }
        if (priceRankings.length > 0) {
            const mostCompetitive = priceRankings[0];
            report += `• Most competitive price: ${mostCompetitive.exchange}\n`;
        }

        return report;
    }

    /**
     * Find exchange with best combination of price and liquidity
     */
    findBestExchange(prices: PriceData[]): {
        exchange: string;
        score: number;
        priceScore: number;
        liquidityScore: number;
        recommendation: string;
    } | null {
        const priceRankings = this.rankExchangesByPrice(prices);
        const liquidityRankings = this.compareExchangeLiquidity(prices);

        if (priceRankings.length === 0 || liquidityRankings.length === 0) {
            return null;
        }

        // Create combined scores
        const combinedScores = priceRankings.map(priceRanking => {
            const liquidityRanking = liquidityRankings.find(l => l.exchange === priceRanking.exchange);
            
            if (!liquidityRanking) {
                return {
                    exchange: priceRanking.exchange,
                    score: 0,
                    priceScore: 0,
                    liquidityScore: 0,
                    recommendation: 'Insufficient data'
                };
            }

            // Normalize scores (lower rank = higher score)
            const priceScore = (priceRankings.length - priceRanking.rank + 1) / priceRankings.length * 100;
            const liquidityScore = liquidityRanking.liquidityScore;
            
            // Weighted combination (60% price, 40% liquidity)
            const combinedScore = (priceScore * 0.6) + (liquidityScore * 0.4);

            let recommendation = 'Good overall';
            if (priceScore > 80 && liquidityScore > 80) {
                recommendation = 'Excellent choice';
            } else if (priceScore > 60 && liquidityScore > 60) {
                recommendation = 'Good choice';
            } else if (priceScore < 40 || liquidityScore < 40) {
                recommendation = 'Consider alternatives';
            }

            return {
                exchange: priceRanking.exchange,
                score: combinedScore,
                priceScore,
                liquidityScore,
                recommendation
            };
        });

        // Sort by combined score
        combinedScores.sort((a, b) => b.score - a.score);

        return combinedScores[0];
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
