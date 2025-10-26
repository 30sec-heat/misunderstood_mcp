import * as ccxt from 'ccxt';
import { PriceData } from '../index';

export class PriceFetcher {
    private exchanges: { [key: string]: ccxt.Exchange };
    private krwUsdtRate: number | null = null;

    constructor() {
        // Reduced to major exchanges for faster responses
        this.exchanges = {
            'binance': new ccxt.binance(),
            'coinbase': new ccxt.coinbase(),
            'bybit': new ccxt.bybit(),
            'okx': new ccxt.okx(),
            'kraken': new ccxt.kraken()
        };
    }

    private async getKrwUsdtRate(): Promise<number> {
        if (this.krwUsdtRate) {
            return this.krwUsdtRate;
        }

        try {
            // Get KRW/USDT rate from Upbit (they have KRW/USDT pair)
            const upbit = this.exchanges['upbit'];
            const ticker = await upbit.fetchTicker('KRW/USDT');
            this.krwUsdtRate = ticker.last ?? 0;
            return this.krwUsdtRate;
        } catch (error) {
            // Fallback rate (approximate)
            this.krwUsdtRate = 0.00075;
            return this.krwUsdtRate;
        }
    }

    private async fetchSpotPrice(exchange: ccxt.Exchange, symbol: string): Promise<number | null> {
        try {
            const ticker = await Promise.race([
                exchange.fetchTicker(symbol),
                new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
            ]);
            return ticker.last || null;
        } catch (error) {
            // Suppress expected errors for symbols not available on exchanges
            return null;
        }
    }

    private async fetchPerpPrice(exchange: ccxt.Exchange, symbol: string): Promise<number | null> {
        try {
            // Skip perp for exchanges that don't support it
            if (exchange.id === 'coinbase' || exchange.id === 'kraken' || exchange.id === 'kucoin') {
                return null;
            }

            // Try different perpetual contract symbols based on exchange
            let perpSymbols: string[] = [];
            
            if (exchange.id === 'hyperliquid') {
                perpSymbols = [`${symbol}-USD`];
            } else if (exchange.id === 'upbit') {
                // Upbit doesn't have perp contracts
                return null;
            } else {
                perpSymbols = [
                    `${symbol}/USDT:USDT`,
                    `${symbol}USDT`,
                    `${symbol}-PERP`,
                    `${symbol}PERP`
                ];
            }

            for (const perpSymbol of perpSymbols) {
                try {
                    const ticker = await Promise.race([
                        exchange.fetchTicker(perpSymbol),
                        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
                    ]);
                    if (ticker && ticker.last) {
                        return ticker.last;
                    }
                } catch (e) {
                    // Try next symbol
                    continue;
                }
            }

            return null;
        } catch (error) {
            // Suppress expected errors for symbols not available on exchanges
            return null;
        }
    }

    private convertKrwToUsd(krwPrice: number): number {
        return krwPrice * this.krwUsdtRate!;
    }

    /**
     * Get listings for a symbol across all exchanges
     */
    async getListings(symbol: string): Promise<Array<{
        exchange: string;
        symbol: string;
        spotPrice: number | null;
        perpPrice: number | null;
        volume24h: number | null;
        isListed: boolean;
    }>> {
        const symbolUpper = symbol.toUpperCase();
        const results: Array<{
            exchange: string;
            symbol: string;
            spotPrice: number | null;
            perpPrice: number | null;
            volume24h: number | null;
            isListed: boolean;
        }> = [];

        // Get KRW/USDT rate for Upbit conversion
        await this.getKrwUsdtRate();

        for (const [exchangeName, exchange] of Object.entries(this.exchanges)) {
            try {
                let spotPrice: number | null = null;
                let perpPrice: number | null = null;
                let volume24h: number | null = null;
                let isListed = false;

                // Check spot listing
                if (exchangeName === 'upbit') {
                    // Upbit uses KRW pairs
                    try {
                        const krwTicker = await exchange.fetchTicker(`KRW-${symbolUpper}`);
                        if (krwTicker && krwTicker.last) {
                            spotPrice = this.convertKrwToUsd(krwTicker.last);
                            volume24h = krwTicker.quoteVolume || null;
                            isListed = true;
                        }
                    } catch (error) {
                        // Symbol not available on Upbit
                    }
                } else if (exchangeName === 'hyperliquid') {
                    // Hyperliquid uses different symbol format
                    try {
                        const ticker = await exchange.fetchTicker(`${symbolUpper}-USD`);
                        if (ticker && ticker.last) {
                            spotPrice = ticker.last;
                            volume24h = ticker.quoteVolume || null;
                            isListed = true;
                        }
                    } catch (error) {
                        // Symbol not available on Hyperliquid
                    }
                } else {
                    // Other exchanges use USDT pairs
                    try {
                        const ticker = await exchange.fetchTicker(`${symbolUpper}/USDT`);
                        if (ticker && ticker.last) {
                            spotPrice = ticker.last;
                            volume24h = ticker.quoteVolume || null;
                            isListed = true;
                        }
                    } catch (error) {
                        // Symbol not available on this exchange
                    }
                }

                // Check perp listing
                perpPrice = await this.fetchPerpPrice(exchange, symbolUpper);
                if (perpPrice) {
                    isListed = true;
                }

                results.push({
                    exchange: exchangeName.toUpperCase(),
                    symbol: symbolUpper,
                    spotPrice,
                    perpPrice,
                    volume24h,
                    isListed
                });

            } catch (error) {
                // Exchange error, mark as not listed
                results.push({
                    exchange: exchangeName.toUpperCase(),
                    symbol: symbolUpper,
                    spotPrice: null,
                    perpPrice: null,
                    volume24h: null,
                    isListed: false
                });
            }
        }

        return results;
    }

    private getTimeRangeMs(timeRange: string): number {
        const now = Date.now();
        switch (timeRange) {
            case '1d': return now - (24 * 60 * 60 * 1000);
            case '3d': return now - (3 * 24 * 60 * 60 * 1000);
            case '7d': return now - (7 * 24 * 60 * 60 * 1000);
            case '30d': return now - (30 * 24 * 60 * 60 * 1000);
            default: return now - (7 * 24 * 60 * 60 * 1000);
        }
    }

    async fetchPrices(symbol: string): Promise<PriceData[]> {
        const results: PriceData[] = [];
        const symbolUpper = symbol.toUpperCase();

        // Get KRW/USDT rate for Upbit conversion
        await this.getKrwUsdtRate();

        // Check all exchanges for quotes
        const exchangesToCheck = Object.entries(this.exchanges);

        for (const [exchangeName, exchange] of exchangesToCheck) {
            try {
                let spotPrice: number | null = null;
                let perpPrice: number | null = null;
                let volume24h: number | null = null;

                // Fetch spot price with timeout
                if (exchangeName === 'upbit') {
                    // Upbit uses KRW pairs, convert to USD
                    try {
                        const krwTicker = await Promise.race([
                            exchange.fetchTicker(`KRW-${symbolUpper}`),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
                        ]);
                        if (krwTicker && (krwTicker as any).last) {
                            spotPrice = this.convertKrwToUsd((krwTicker as any).last);
                            volume24h = (krwTicker as any).quoteVolume || null;
                        }
                    } catch (error) {
                        // Suppress expected errors
                    }
                } else if (exchangeName === 'hyperliquid') {
                    // Hyperliquid uses different symbol format
                    try {
                        const ticker = await Promise.race([
                            exchange.fetchTicker(`${symbolUpper}-USD`),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
                        ]);
                        if (ticker && (ticker as any).last) {
                            spotPrice = (ticker as any).last;
                            volume24h = (ticker as any).quoteVolume || null;
                        }
                    } catch (error) {
                        // Suppress expected errors
                    }
                } else {
                    // Other exchanges use USDT pairs
                    spotPrice = await this.fetchSpotPrice(exchange, `${symbolUpper}/USDT`);
                    if (spotPrice) {
                        try {
                            const ticker = await Promise.race([
                                exchange.fetchTicker(`${symbolUpper}/USDT`),
                                new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
                            ]);
                            volume24h = ticker.quoteVolume || null;
                        } catch (error) {
                            // Suppress expected errors
                        }
                    }
                }

                // Fetch perp price
                perpPrice = await this.fetchPerpPrice(exchange, symbolUpper);

                results.push({
                    exchange: exchangeName.toUpperCase(),
                    spotPrice,
                    perpPrice,
                    volume24h,
                    lastUpdated: new Date()
                });

            } catch (error) {
                console.error(`Error fetching prices from ${exchangeName}:`, error);
                
                results.push({
                    exchange: exchangeName.toUpperCase(),
                    spotPrice: null,
                    perpPrice: null,
                    volume24h: null,
                    lastUpdated: new Date()
                });
            }
        }

        return results;
    }

    getSupportedExchanges(): string[] {
        return Object.keys(this.exchanges).map(name => name.toUpperCase());
    }

    async isSymbolAvailable(symbol: string, exchange: string): Promise<boolean> {
        const exchangeLower = exchange.toLowerCase();
        const exchangeInstance = this.exchanges[exchangeLower];
        
        if (!exchangeInstance) {
            return false;
        }

        try {
            const symbolUpper = symbol.toUpperCase();
            let testSymbol: string;

            if (exchangeLower === 'upbit') {
                testSymbol = `KRW-${symbolUpper}`;
            } else if (exchangeLower === 'hyperliquid') {
                testSymbol = `${symbolUpper}-USD`;
            } else {
                testSymbol = `${symbolUpper}/USDT`;
            }

            await exchangeInstance.fetchTicker(testSymbol);
            return true;
        } catch (error) {
            return false;
        }
    }

    async getExchangeMarketData(symbol: string, exchange: string): Promise<{
        exchange: string;
        symbol: string;
        price: number;
        volume24h: number;
        priceChange24h: number;
        priceChangePercentage24h: number;
        high24h: number;
        low24h: number;
    } | null> {
        const exchangeLower = exchange.toLowerCase();
        const exchangeInstance = this.exchanges[exchangeLower];
        
        if (!exchangeInstance) {
            return null;
        }

        try {
            const symbolUpper = symbol.toUpperCase();
            let testSymbol: string;

            if (exchangeLower === 'upbit') {
                testSymbol = `KRW-${symbolUpper}`;
            } else if (exchangeLower === 'hyperliquid') {
                testSymbol = `${symbolUpper}-USD`;
            } else {
                testSymbol = `${symbolUpper}/USDT`;
            }

            const ticker = await exchangeInstance.fetchTicker(testSymbol);
            
            return {
                exchange: exchange.toUpperCase(),
                symbol: symbolUpper,
                price: ticker.last || 0,
                volume24h: ticker.quoteVolume || 0,
                priceChange24h: ticker.change || 0,
                priceChangePercentage24h: ticker.percentage || 0,
                high24h: ticker.high || 0,
                low24h: ticker.low || 0
            };
        } catch (error) {
            return null;
        }
    }

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

    formatPriceTable(prices: PriceData[]): string {
        const header = 'Exchange    Spot Price    Perp Price    Volume 24h';
        const separator = '────────────────────────────────────────────────────────';
        
        let table = `${header}\n${separator}\n`;

        for (const price of prices) {
            const spotStr = price.spotPrice ? `$${this.formatPrice(price.spotPrice)}` : 'N/A';
            const perpStr = price.perpPrice ? `$${this.formatPrice(price.perpPrice)}` : 'N/A';
            const volumeStr = price.volume24h ? `$${this.formatPrice(price.volume24h)}` : 'N/A';
            
            table += `${price.exchange.padEnd(11)} ${spotStr.padEnd(12)} ${perpStr.padEnd(12)} ${volumeStr}\n`;
        }

        return table;
    }
}
