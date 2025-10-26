import { PriceFetcher } from './PriceFetcher.js';
import { ArbitrageDetector } from './ArbitrageDetector.js';
import { QuoteAnalyzer } from './QuoteAnalyzer.js';
import { ExchangeComparator } from './ExchangeComparator.js';

export class QuoteTools {
    private priceFetcher: PriceFetcher;
    private arbitrageDetector: ArbitrageDetector;
    private quoteAnalyzer: QuoteAnalyzer;
    private exchangeComparator: ExchangeComparator;

    constructor() {
        this.priceFetcher = new PriceFetcher();
        this.arbitrageDetector = new ArbitrageDetector();
        this.quoteAnalyzer = new QuoteAnalyzer();
        this.exchangeComparator = new ExchangeComparator();
    }

    /**
     * Get price quotes from multiple exchanges
     */
    async getQuotes(symbol: string) {
        try {
            const quotes = await this.priceFetcher.fetchPrices(symbol);
            const table = this.formatQuoteTable(quotes);
            
            return {
                content: [
                    {
                        type: 'text',
                        text: `[DATA] Price Quotes for ${symbol.toUpperCase()}\n\n${table}`
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `[ERROR] Error fetching quotes: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }

    /**
     * Get comprehensive quote analysis
     */
    async getQuoteAnalysis(symbol: string) {
        try {
            const prices = await this.priceFetcher.fetchPrices(symbol);
            const analysis = this.quoteAnalyzer.analyzeQuotes(prices, symbol, []);
            const summary = this.generateAnalysisSummary(analysis);
            
            return {
                content: [
                    {
                        type: 'text',
                        text: summary
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `[ERROR] Error analyzing quotes: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }

    /**
     * Detect arbitrage opportunities
     */
    async detectArbitrage(symbol: string) {
        try {
            const prices = await this.priceFetcher.fetchPrices(symbol);
            const opportunities = await this.arbitrageDetector.detectArbitrage(prices, symbol);
            const report = this.formatArbitrageReport(opportunities, symbol);
            
            return {
                content: [
                    {
                        type: 'text',
                        text: report
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `[ERROR] Error detecting arbitrage: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }

    /**
     * Compare exchanges
     */
    async compareExchanges(symbol: string) {
        try {
            const prices = await this.priceFetcher.fetchPrices(symbol);
            const comparison = this.exchangeComparator.compareExchanges(prices, symbol);
            const report = this.formatExchangeComparison(comparison, symbol);
            
            return {
                content: [
                    {
                        type: 'text',
                        text: report
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `[ERROR] Error comparing exchanges: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }

    /**
     * Get price dislocation analysis
     */
    async getPriceDislocation(symbol: string, threshold: number = 0.01) {
        try {
            // Price dislocation analysis would require additional market data
            const dislocation = { symbol, threshold, message: 'Price dislocation analysis not implemented' };
            const report = this.formatDislocationReport(dislocation);
            
            return {
                content: [
                    {
                        type: 'text',
                        text: report
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `[ERROR] Error analyzing price dislocation: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }

    /**
     * Get supported exchanges
     */
    async getSupportedExchanges() {
        try {
            const exchanges = this.priceFetcher.getSupportedExchanges();
            const list = exchanges.join(', ');
            
            return {
                content: [
                    {
                        type: 'text',
                        text: `[LIST] Supported Exchanges:\n\n${list}\n\nTotal: ${exchanges.length} exchanges`
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `[ERROR] Error getting supported exchanges: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }

    /**
     * Check symbol availability
     */
    async checkSymbolAvailability(symbol: string, exchange: string) {
        try {
            const isAvailable = await this.priceFetcher.isSymbolAvailable(symbol, exchange);
            const status = isAvailable ? '[SUCCESS] Available' : '[ERROR] Not Available';
            
            return {
                content: [
                    {
                        type: 'text',
                        text: `${status} - ${symbol.toUpperCase()} on ${exchange.toUpperCase()}`
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `[ERROR] Error checking symbol availability: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }

    /**
     * Get exchange market data
     */
    async getExchangeMarketData(symbol: string, exchange: string) {
        try {
            const marketData = await this.priceFetcher.getExchangeMarketData(symbol, exchange);
            
            if (!marketData) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `[ERROR] No market data available for ${symbol.toUpperCase()} on ${exchange.toUpperCase()}`
                        }
                    ]
                };
            }

            const report = this.formatMarketDataReport(marketData);
            
            return {
                content: [
                    {
                        type: 'text',
                        text: report
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `[ERROR] Error getting market data: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }

    /**
     * Get listings for a symbol across all exchanges
     */
    async getListings(symbol: string) {
        try {
            const listings = await this.priceFetcher.getListings(symbol);
            const report = this.formatListingsReport(listings, symbol);
            
            return {
                content: [
                    {
                        type: 'text',
                        text: report
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `[ERROR] Error getting listings: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }

    /**
     * Get comprehensive quotes and listings data - combines all quote functionality
     */
    async getComprehensiveQuotes(symbol: string) {
        try {
            // Fetch all data in parallel
            const [quotes, listings] = await Promise.all([
                this.priceFetcher.fetchPrices(symbol),
                this.priceFetcher.getListings(symbol)
            ]);

            // Detect arbitrage opportunities
            const arbitrageOpportunities = await this.arbitrageDetector.detectArbitrage(quotes, symbol);
            
            // Analyze quotes
            const analysis = this.quoteAnalyzer.analyzeQuotes(quotes, symbol, arbitrageOpportunities);
            
            // Compare exchanges
            const comparison = this.exchangeComparator.compareExchanges(quotes, symbol);

            // Format comprehensive JSON response
            const response = {
                symbol: symbol.toUpperCase(),
                timestamp: new Date().toISOString(),
                summary: {
                    total_exchanges_checked: listings.length,
                    listed_exchanges: listings.filter(l => l.isListed).length,
                    active_exchanges: quotes.filter(q => q.spotPrice || q.perpPrice).length,
                    average_price: analysis.averagePrice,
                    price_spread_percentage: analysis.priceRange.spreadPercentage
                },
                exchanges: listings.map(listing => ({
                    exchange: listing.exchange,
                    spot_price: listing.spotPrice,
                    futures_price: listing.perpPrice,
                    volume_24h: listing.volume24h,
                    is_listed: listing.isListed,
                    has_spot: !!listing.spotPrice,
                    has_futures: !!listing.perpPrice,
                    status: this.getExchangeStatus(listing)
                })),
                arbitrage_opportunities: arbitrageOpportunities.slice(0, 5).map(opp => ({
                    buy_exchange: opp.buyExchange,
                    sell_exchange: opp.sellExchange,
                    buy_price: opp.buyPrice,
                    sell_price: opp.sellPrice,
                    profit_percentage: opp.profitPercentage,
                    profit_amount: opp.profitAmount,
                    type: opp.type
                })),
                best_prices: {
                    spot: this.getBestPrice(listings, 'spot'),
                    futures: this.getBestPrice(listings, 'futures')
                },
                market_analysis: {
                    liquidity: {
                        total_volume_24h: analysis.liquidity.totalVolume24h,
                        most_liquid_exchange: analysis.liquidity.mostLiquidExchange
                    },
                    volatility: {
                        price_variation_percentage: analysis.volatility.priceVariation * 100,
                        is_volatile: analysis.volatility.isVolatile
                    },
                    price_range: {
                        min: analysis.priceRange.min,
                        max: analysis.priceRange.max,
                        spread: analysis.priceRange.spread,
                        spread_percentage: analysis.priceRange.spreadPercentage
                    }
                }
            };

            // Also provide a formatted text summary
            const textSummary = this.formatComprehensiveReport(response);

            return {
                content: [
                    {
                        type: 'text',
                        text: textSummary
                    }
                ],
                data: response // Include structured data for programmatic access
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `[ERROR] Error getting comprehensive quotes: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }

    /**
     * Format quote table
     */
    private formatQuoteTable(quotes: any[]): string {
        const header = 'Exchange    Spot Price    Perp Price    Volume 24h    Status';
        const separator = '─────────────────────────────────────────────────────────────────────';
        
        let table = `${header}\n${separator}\n`;

        for (const quote of quotes) {
            const spotStr = quote.spotPrice ? `$${this.formatPrice(quote.spotPrice)}` : 'N/A';
            const perpStr = quote.perpPrice ? `$${this.formatPrice(quote.perpPrice)}` : 'N/A';
            const volumeStr = quote.volume24h ? `$${this.formatPrice(quote.volume24h)}` : 'N/A';
            
            // Determine status
            let status = '🟢 Active';
            if (quote.spotPrice === null && quote.perpPrice === null) {
                if (quote.telegramMention) {
                    status = 'MOBILE: Telegram';
                } else {
                    status = '🔴 Unavailable';
                }
            } else if (quote.spotPrice === null || quote.perpPrice === null) {
                status = '🟡 Partial';
            }
            
            table += `${quote.exchange.padEnd(11)} ${spotStr.padEnd(12)} ${perpStr.padEnd(12)} ${volumeStr.padEnd(12)} ${status}\n`;
        }

        return table;
    }

    /**
     * Generate analysis summary
     */
    private generateAnalysisSummary(analysis: any): string {
        let summary = `[DATA] Quote Analysis for ${analysis.symbol}\n\n`;
        
        // Price overview
        summary += `MONEY: Price Overview:\n`;
        summary += `• Average Price: $${this.formatPrice(analysis.averagePrice)}\n`;
        summary += `• Price Range: $${this.formatPrice(analysis.priceRange.min)} - $${this.formatPrice(analysis.priceRange.max)}\n`;
        summary += `• Spread: ${analysis.priceRange.spreadPercentage.toFixed(2)}%\n\n`;

        // Arbitrage opportunities
        if (analysis.arbitrageOpportunities.length > 0) {
            summary += `[TARGET] Arbitrage Opportunities:\n`;
            const topOpportunity = analysis.arbitrageOpportunities[0];
            summary += `• Best: ${topOpportunity.buyExchange} → ${topOpportunity.sellExchange}\n`;
            summary += `• Profit: ${topOpportunity.profitPercentage.toFixed(2)}% ($${this.formatPrice(topOpportunity.profitAmount)})\n`;
            summary += `• Total Opportunities: ${analysis.arbitrageOpportunities.length}\n\n`;
        } else {
            summary += `[TARGET] No significant arbitrage opportunities found\n\n`;
        }

        // Liquidity
        summary += `💧 Liquidity:\n`;
        summary += `• Total Volume 24h: $${this.formatPrice(analysis.liquidity.totalVolume24h)}\n`;
        summary += `• Most Liquid Exchange: ${analysis.liquidity.mostLiquidExchange}\n\n`;

        // Volatility
        summary += `UP: Volatility:\n`;
        summary += `• Price Variation: ${(analysis.volatility.priceVariation * 100).toFixed(2)}%\n`;
        summary += `• Market Status: ${analysis.volatility.isVolatile ? '🔴 Volatile' : '🟢 Stable'}\n`;

        return summary;
    }

    /**
     * Format arbitrage report
     */
    private formatArbitrageReport(opportunities: any[], symbol: string): string {
        if (opportunities.length === 0) {
            return `[TARGET] No arbitrage opportunities found for ${symbol.toUpperCase()}`;
        }

        let report = `[TARGET] Arbitrage Opportunities for ${symbol.toUpperCase()}\n\n`;

        opportunities.slice(0, 10).forEach((opp, index) => {
            report += `${index + 1}. ${opp.buyExchange} → ${opp.sellExchange}\n`;
            report += `   Buy: $${this.formatPrice(opp.buyPrice)} | Sell: $${this.formatPrice(opp.sellPrice)}\n`;
            report += `   Profit: ${opp.profitPercentage.toFixed(2)}% ($${this.formatPrice(opp.profitAmount)})\n`;
            report += `   Type: ${opp.type.toUpperCase()}\n\n`;
        });

        if (opportunities.length > 10) {
            report += `... and ${opportunities.length - 10} more opportunities\n`;
        }

        return report;
    }

    /**
     * Format exchange comparison
     */
    private formatExchangeComparison(comparison: any, symbol: string): string {
        let report = `[DATA] Exchange Comparison for ${symbol.toUpperCase()}\n\n`;

        // Price comparison
        report += `MONEY: Price Comparison:\n`;
        report += `• Best Price: ${comparison.bestPrice.exchange} (${comparison.bestPrice.type}) - $${this.formatPrice(comparison.bestPrice.price)}\n`;
        report += `• Worst Price: ${comparison.worstPrice.exchange} (${comparison.worstPrice.type}) - $${this.formatPrice(comparison.worstPrice.price)}\n`;
        report += `• Price Spread: $${this.formatPrice(comparison.priceSpread)}\n\n`;

        // Exchange table
        report += `[LIST] Exchange Details:\n`;
        report += this.formatQuoteTable(comparison.exchanges);

        return report;
    }

    /**
     * Format dislocation report
     */
    private formatDislocationReport(dislocation: any): string {
        let report = `[DATA] Price Dislocation Analysis for ${dislocation.symbol}\n\n`;

        report += `MONEY: Average Price: $${this.formatPrice(dislocation.averagePrice)}\n`;
        report += `[SEARCH] Dislocation Severity: ${dislocation.dislocationSeverity.toUpperCase()}\n\n`;

        if (dislocation.dislocatedExchanges.length === 0) {
            report += `[SUCCESS] No significant price dislocations detected\n`;
        } else {
            report += `[WARNING] Dislocated Exchanges:\n`;
            dislocation.dislocatedExchanges.forEach((exchange: any) => {
                report += `• ${exchange.exchange}: $${this.formatPrice(exchange.price)} (${exchange.deviationPercentage.toFixed(2)}% deviation)\n`;
            });
        }

        return report;
    }

    /**
     * Format market data report
     */
    private formatMarketDataReport(marketData: any): string {
        let report = `[DATA] Market Data for ${marketData.symbol} on ${marketData.exchange}\n\n`;

        report += `MONEY: Current Price: $${this.formatPrice(marketData.price)}\n`;
        report += `UP: 24h Change: $${this.formatPrice(marketData.priceChange24h)} (${marketData.priceChangePercentage24h.toFixed(2)}%)\n`;
        report += `[DATA] Volume 24h: $${this.formatPrice(marketData.volume24h)}\n`;
        report += `🔺 High 24h: $${this.formatPrice(marketData.high24h)}\n`;
        report += `🔻 Low 24h: $${this.formatPrice(marketData.low24h)}\n`;

        return report;
    }

    /**
     * Format listings report
     */
    private formatListingsReport(listings: any[], symbol: string): string {
        const listedExchanges = listings.filter(l => l.isListed);
        const spotOnly = listedExchanges.filter(l => l.spotPrice && !l.perpPrice);
        const perpOnly = listedExchanges.filter(l => !l.spotPrice && l.perpPrice);
        const bothMarkets = listedExchanges.filter(l => l.spotPrice && l.perpPrice);

        let report = `[LIST] Exchange Listings for ${symbol.toUpperCase()}\n\n`;
        
        report += `[DATA] Summary:\n`;
        report += `• Total Exchanges Checked: ${listings.length}\n`;
        report += `• Listed Exchanges: ${listedExchanges.length}\n`;
        report += `• Spot Only: ${spotOnly.length}\n`;
        report += `• Perpetual Only: ${perpOnly.length}\n`;
        report += `• Both Markets: ${bothMarkets.length}\n\n`;

        if (listedExchanges.length === 0) {
            report += `[ERROR] ${symbol.toUpperCase()} is not listed on any of the checked exchanges.\n`;
            return report;
        }

        // Detailed listings table
        report += `[LIST] Detailed Listings:\n`;
        const header = 'Exchange      Spot Price    Perp Price    Volume 24h    Status';
        const separator = '─────────────────────────────────────────────────────────────────';
        
        report += `${header}\n${separator}\n`;

        for (const listing of listings) {
            const spotStr = listing.spotPrice ? `$${this.formatPrice(listing.spotPrice)}` : 'N/A';
            const perpStr = listing.perpPrice ? `$${this.formatPrice(listing.perpPrice)}` : 'N/A';
            const volumeStr = listing.volume24h ? `$${this.formatPrice(listing.volume24h)}` : 'N/A';
            
            let status = '[ERROR] Not Listed';
            if (listing.isListed) {
                if (listing.spotPrice && listing.perpPrice) {
                    status = '🟢 Both';
                } else if (listing.spotPrice) {
                    status = '🔵 Spot';
                } else if (listing.perpPrice) {
                    status = '🟡 Perp';
                }
            }
            
            report += `${listing.exchange.padEnd(13)} ${spotStr.padEnd(12)} ${perpStr.padEnd(12)} ${volumeStr.padEnd(12)} ${status}\n`;
        }

        // Best prices
        if (spotOnly.length > 0 || bothMarkets.length > 0) {
            const spotPrices = [...spotOnly, ...bothMarkets].filter(l => l.spotPrice);
            if (spotPrices.length > 0) {
                const bestSpot = spotPrices.reduce((best, current) => 
                    current.spotPrice < best.spotPrice ? current : best
                );
                const worstSpot = spotPrices.reduce((worst, current) => 
                    current.spotPrice > worst.spotPrice ? current : worst
                );
                
                report += `\nMONEY: Best Spot Price: ${bestSpot.exchange} - $${this.formatPrice(bestSpot.spotPrice)}\n`;
                report += `MONEY: Worst Spot Price: ${worstSpot.exchange} - $${this.formatPrice(worstSpot.spotPrice)}\n`;
            }
        }

        if (perpOnly.length > 0 || bothMarkets.length > 0) {
            const perpPrices = [...perpOnly, ...bothMarkets].filter(l => l.perpPrice);
            if (perpPrices.length > 0) {
                const bestPerp = perpPrices.reduce((best, current) => 
                    current.perpPrice < best.perpPrice ? current : best
                );
                const worstPerp = perpPrices.reduce((worst, current) => 
                    current.perpPrice > worst.perpPrice ? current : worst
                );
                
                report += `MONEY: Best Perp Price: ${bestPerp.exchange} - $${this.formatPrice(bestPerp.perpPrice)}\n`;
                report += `MONEY: Worst Perp Price: ${worstPerp.exchange} - $${this.formatPrice(worstPerp.perpPrice)}\n`;
            }
        }

        return report;
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

    /**
     * Get exchange status for comprehensive report
     */
    private getExchangeStatus(listing: any): string {
        if (!listing.isListed) return 'not_listed';
        if (listing.spotPrice && listing.perpPrice) return 'both_markets';
        if (listing.spotPrice) return 'spot_only';
        if (listing.perpPrice) return 'futures_only';
        return 'listed_no_price';
    }

    /**
     * Get best price for spot or futures
     */
    private getBestPrice(listings: any[], type: 'spot' | 'futures'): { exchange: string; price: number } | null {
        const priceField = type === 'spot' ? 'spotPrice' : 'perpPrice';
        const validListings = listings.filter(l => l[priceField] && l.isListed);
        
        if (validListings.length === 0) return null;
        
        const best = validListings.reduce((best, current) => 
            current[priceField] < best[priceField] ? current : best
        );
        
        return {
            exchange: best.exchange,
            price: best[priceField]
        };
    }

    /**
     * Format comprehensive report
     */
    private formatComprehensiveReport(data: any): string {
        let report = `[LAUNCH] Comprehensive Market Data for ${data.symbol}\n`;
        report += ` ${new Date(data.timestamp).toLocaleString()}\n\n`;

        // Summary
        report += `[DATA] SUMMARY\n`;
        report += `• Total Exchanges: ${data.summary.total_exchanges_checked}\n`;
        report += `• Listed Exchanges: ${data.summary.listed_exchanges}\n`;
        report += `• Active Exchanges: ${data.summary.active_exchanges}\n`;
        report += `• Average Price: $${this.formatPrice(data.summary.average_price)}\n`;
        report += `• Price Spread: ${data.summary.price_spread_percentage.toFixed(2)}%\n\n`;

        // Best Prices
        report += `MONEY: BEST PRICES\n`;
        if (data.best_prices.spot) {
            report += `• Best Spot: ${data.best_prices.spot.exchange} - $${this.formatPrice(data.best_prices.spot.price)}\n`;
        }
        if (data.best_prices.futures) {
            report += `• Best Futures: ${data.best_prices.futures.exchange} - $${this.formatPrice(data.best_prices.futures.price)}\n`;
        }
        report += `\n`;

        // Arbitrage Opportunities
        if (data.arbitrage_opportunities.length > 0) {
            report += `[TARGET] TOP ARBITRAGE OPPORTUNITIES\n`;
            data.arbitrage_opportunities.slice(0, 3).forEach((opp: any, i: number) => {
                report += `${i + 1}. ${opp.buy_exchange} → ${opp.sell_exchange}\n`;
                report += `   Profit: ${opp.profit_percentage.toFixed(2)}% ($${this.formatPrice(opp.profit_amount)})\n`;
            });
            report += `\n`;
        }

        // Market Analysis
        report += `UP: MARKET ANALYSIS\n`;
        report += `• Total Volume 24h: $${this.formatPrice(data.market_analysis.liquidity.total_volume_24h)}\n`;
        report += `• Most Liquid: ${data.market_analysis.liquidity.most_liquid_exchange}\n`;
        report += `• Volatility: ${data.market_analysis.volatility.is_volatile ? '🔴 High' : '🟢 Low'} (${data.market_analysis.volatility.price_variation_percentage.toFixed(2)}%)\n`;
        report += `• Price Range: $${this.formatPrice(data.market_analysis.price_range.min)} - $${this.formatPrice(data.market_analysis.price_range.max)}\n\n`;

        // Exchange Details Table
        report += `[LIST] EXCHANGE DETAILS\n`;
        const header = 'Exchange      Spot Price    Futures Price  Volume 24h     Status';
        const separator = '─'.repeat(70);
        report += `${header}\n${separator}\n`;

        data.exchanges.forEach((ex: any) => {
            const spotStr = ex.spot_price ? `$${this.formatPrice(ex.spot_price)}` : 'N/A';
            const futuresStr = ex.futures_price ? `$${this.formatPrice(ex.futures_price)}` : 'N/A';
            const volumeStr = ex.volume_24h ? `$${this.formatPrice(ex.volume_24h)}` : 'N/A';
            
            let statusIcon = 'ERROR:';
            switch (ex.status) {
                case 'both_markets': statusIcon = '🟢'; break;
                case 'spot_only': statusIcon = '🔵'; break;
                case 'futures_only': statusIcon = '🟡'; break;
                case 'listed_no_price': statusIcon = '⚪'; break;
            }
            
            report += `${ex.exchange.padEnd(13)} ${spotStr.padEnd(12)} ${futuresStr.padEnd(13)} ${volumeStr.padEnd(13)} ${statusIcon}\n`;
        });

        return report;
    }
}
