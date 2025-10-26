import { PriceFetcher } from './tools/PriceFetcher.js';
import { ArbitrageDetector } from './tools/ArbitrageDetector.js';
import { QuoteAnalyzer } from './tools/QuoteAnalyzer.js';
import { ExchangeComparator } from './tools/ExchangeComparator.js';
import { QuoteTools } from './tools/QuoteTools.js';
import { CryptoModule } from '../../index.js';

export interface PriceData {
    exchange: string;
    spotPrice: number | null;
    perpPrice: number | null;
    volume24h?: number | null;
    lastUpdated: Date;
    telegramMention?: boolean; // Indicates if Telegram DB shows this exchange mentions the symbol
}

export interface ArbitrageOpportunity {
    symbol: string;
    buyExchange: string;
    sellExchange: string;
    buyPrice: number;
    sellPrice: number;
    profitPercentage: number;
    profitAmount: number;
    type: 'spot' | 'perp' | 'cross';
}

export interface QuoteAnalysis {
    symbol: string;
    averagePrice: number;
    priceRange: {
        min: number;
        max: number;
        spread: number;
        spreadPercentage: number;
    };
    exchanges: PriceData[];
    arbitrageOpportunities: ArbitrageOpportunity[];
    liquidity: {
        totalVolume24h: number;
        mostLiquidExchange: string;
    };
    volatility: {
        priceVariation: number;
        isVolatile: boolean;
    };
}

export class QuoteModule implements CryptoModule {
    public name = 'quote';
    public tools: any[] = [];
    
    private priceFetcher: PriceFetcher;
    private arbitrageDetector: ArbitrageDetector;
    private quoteAnalyzer: QuoteAnalyzer;
    private exchangeComparator: ExchangeComparator;
    private quoteTools: QuoteTools;

    constructor() {
        this.priceFetcher = new PriceFetcher();
        this.arbitrageDetector = new ArbitrageDetector();
        this.quoteAnalyzer = new QuoteAnalyzer();
        this.exchangeComparator = new ExchangeComparator();
        this.quoteTools = new QuoteTools();
    }

    async initialize(): Promise<void> {
        this.tools = [
            {
                name: 'get_comprehensive_quotes',
                description: 'Get comprehensive quotes and listings data for a symbol across all exchanges with prices, availability, and market info',
                inputSchema: {
                    type: 'object',
                    properties: {
                        symbol: {
                            type: 'string',
                            description: 'Symbol to get comprehensive data for (e.g., BTC, ETH, ADA)'
                        }
                    },
                    required: ['symbol']
                },
                handler: async (args: any) => {
                    return await this.quoteTools.getComprehensiveQuotes(args.symbol);
                }
            }
        ];
    }

    /**
     * Get price quotes from multiple exchanges for a symbol
     */
    async getQuotes(symbol: string): Promise<PriceData[]> {
        return await this.priceFetcher.fetchPrices(symbol);
    }

    /**
     * Get comprehensive quote analysis including arbitrage opportunities
     */
    async getQuoteAnalysis(symbol: string): Promise<QuoteAnalysis> {
        const prices = await this.getQuotes(symbol);
        const arbitrageOpportunities = await this.arbitrageDetector.detectArbitrage(prices, symbol);
        
        return this.quoteAnalyzer.analyzeQuotes(prices, symbol, arbitrageOpportunities);
    }

    /**
     * Detect arbitrage opportunities across exchanges
     */
    async detectArbitrage(symbol: string): Promise<ArbitrageOpportunity[]> {
        const prices = await this.getQuotes(symbol);
        return await this.arbitrageDetector.detectArbitrage(prices, symbol);
    }

    /**
     * Compare exchanges for a symbol
     */
    async compareExchanges(symbol: string): Promise<{
        bestPrice: { exchange: string; price: number; type: 'spot' | 'perp' };
        worstPrice: { exchange: string; price: number; type: 'spot' | 'perp' };
        priceSpread: number;
        exchanges: PriceData[];
    }> {
        const prices = await this.getQuotes(symbol);
        return this.exchangeComparator.compareExchanges(prices, symbol);
    }

    /**
     * Get price dislocation analysis
     */
    async getPriceDislocation(symbol: string, threshold: number = 0.01): Promise<{
        symbol: string;
        dislocatedExchanges: Array<{
            exchange: string;
            price: number;
            deviation: number;
            deviationPercentage: number;
        }>;
        averagePrice: number;
        dislocationSeverity: 'low' | 'medium' | 'high';
    }> {
        const prices = await this.getQuotes(symbol);
        return this.arbitrageDetector.detectPriceDislocation(prices, symbol, threshold);
    }

    /**
     * Get supported exchanges
     */
    getSupportedExchanges(): string[] {
        return this.priceFetcher.getSupportedExchanges();
    }

    /**
     * Check if symbol is available on exchange
     */
    async isSymbolAvailable(symbol: string, exchange: string): Promise<boolean> {
        return await this.priceFetcher.isSymbolAvailable(symbol, exchange);
    }

    /**
     * Get exchange-specific market data
     */
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
        return await this.priceFetcher.getExchangeMarketData(symbol, exchange);
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
        return await this.priceFetcher.getListings(symbol);
    }
}
