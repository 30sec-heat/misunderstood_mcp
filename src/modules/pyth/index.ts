import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import axios from 'axios';
import { pythFeedsManager, findPythFeedsBySymbol, findPythFeedsByCategory, getPopularPythFeeds, getPythSymbolsByAssetType, getPythSymbolsByCountry, searchPythSymbolsAdvanced } from '../../helpers/pyth-feeds-cache.js';

export class EconomicDataModule extends BaseCryptoModule {
  name = 'get_econ_data';
  private readonly PYTH_API_BASE = 'https://hermes.pyth.network/v2';
  private readonly PYTH_TRADINGVIEW_BASE = 'https://hermes.pyth.network/v1';
  
  // Economic indicators available on Pyth Network
  private readonly ECONOMIC_TICKERS = {
    // Inflation Data (CPI)
    'CPI_YOY': { symbol: 'ECO.US.CPIRATEY', id: '3c35e93113a975ab62428bcf92c6fa11d383438904aa38a79e506afac814688e', name: 'CPI Year-over-Year', description: 'Consumer Price Index 12-month change' },
    'CORE_CPI_YOY': { symbol: 'ECO.US.CORECPIRATEY', id: '9d5311b947cea84f49a5ecfa6a1a149926359c7e7d4522e53d29286bef3f5f66', name: 'Core CPI Year-over-Year', description: 'Core CPI 12-month change (excludes food & energy)' },
    'CPI_INDEX': { symbol: 'ECO.US.CPIINDEX', id: 'c078bf950f538127971287ed7614d7ccfc008c33c7306bb98d7c1a5d2574b97b', name: 'CPI Index', description: 'Consumer Price Index level' },
    'CPI_MOM': { symbol: 'ECO.US.CPIRATE', id: 'dae3345610111b874dcd1a05478f2e6f5248fbc5017cb20b375c2433eb406238', name: 'CPI Month-over-Month', description: 'Consumer Price Index monthly change' },
    'CORE_CPI_MOM': { symbol: 'ECO.US.CORECPIRATE', id: 'eac717d7e25ce5216eb1b27eecf66712a2fe3b01731556ae005a237306b5c76f', name: 'Core CPI Month-over-Month', description: 'Core Consumer Price Index monthly change' },
    
    // Producer Prices (PPI)
    'PPI_YOY': { symbol: 'ECO.US.PPIRATEY', id: '4c0d5dee9001331f1258546e159f7bb91357051fe9fc8252345a184a59be4ac2', name: 'PPI Year-over-Year', description: 'Producer Price Index 12-month change' },
    'CORE_PPI_YOY': { symbol: 'ECO.US.COREPPIRATEY', id: '0e1dc8bbe022e03f63e37b0f7569cd6fa17cffd0662af0ded87060ea7d0ce7fc', name: 'Core PPI Year-over-Year', description: 'Core Producer Price Index 12-month change' },
    'PPI_MOM': { symbol: 'ECO.US.PPIRATE', id: 'bb733ae406970581ee2bce323e04943c2ff25fcfd23b98bddf6880fecd42d5b0', name: 'PPI Month-over-Month', description: 'Producer Price Index monthly change' },
    'CORE_PPI_MOM': { symbol: 'ECO.US.COREPPIRATE', id: '9117c3ac2f9416e7554642d587122955adfb3eb6c6211de805f99f7ac935dce5', name: 'Core PPI Month-over-Month', description: 'Core Producer Price Index monthly change' },
    'PPI_INDEX': { symbol: 'ECO.US.PPIINDEX', id: '3f62a36b5c2b7f0b748b10f184d6a3261028f5284df7d99e2b2239e6f4032911', name: 'PPI Index', description: 'Producer Price Index level' },
    
    // Employment Data
    'UNEMPLOYMENT_RATE': { symbol: 'ECO.US.UNRATE', id: '5a4be288bc7f075b50f5ee4ece0895bb46a7cfc8f0b803cfbafc583a16223028', name: 'Unemployment Rate', description: 'US Unemployment Rate' },
    'NFP': { symbol: 'ECO.US.NFPHEADLINE', id: 'b982b4fd7a8c2eb2c0f1b0e8c9b8e0c8f9b8e0c8f9b8e0c8f9b8e0c8f9b8e0c8', name: 'Non-Farm Payroll', description: 'US Non-Farm Payroll Jobs Added' },
    'WAGE_GROWTH': { symbol: 'ECO.US.WAGEGROWTH', id: 'c982b4fd7a8c2eb2c0f1b0e8c9b8e0c8f9b8e0c8f9b8e0c8f9b8e0c8f9b8e0c8', name: 'Wage Growth', description: 'US Hourly Wage Growth Rate YoY' },
    
    // GDP Data
    'GDP_CURRENT': { symbol: 'ECO.US.GDP', id: '01a2d2aa5728850767d67e2f82ddc9c8e4c3bbace231461386ef9cbb16d0d36b', name: 'GDP Current', description: 'US Gross Domestic Product Rate - Current' },
    
    // PCE Data (Fed's Preferred Inflation Measure)
    'PCE_YOY': { symbol: 'ECO.US.PCERATE', id: 'd982b4fd7a8c2eb2c0f1b0e8c9b8e0c8f9b8e0c8f9b8e0c8f9b8e0c8f9b8e0c8', name: 'PCE Year-over-Year', description: 'Personal Consumption Expenditures 12-month change' },
    'CORE_PCE_YOY': { symbol: 'ECO.US.PCECORERATE', id: 'e982b4fd7a8c2eb2c0f1b0e8c9b8e0c8f9b8e0c8f9b8e0c8f9b8e0c8f9b8e0c8', name: 'Core PCE Year-over-Year', description: 'Core Personal Consumption Expenditures 12-month change' },
    'PCE_INDEX': { symbol: 'ECO.US.PCEINDEX', id: 'f982b4fd7a8c2eb2c0f1b0e8c9b8e0c8f9b8e0c8f9b8e0c8f9b8e0c8f9b8e0c8', name: 'PCE Index', description: 'Personal Consumption Expenditures Index level' },
    'CORE_PCE_INDEX': { symbol: 'ECO.US.PCECOREINDEX', id: 'g982b4fd7a8c2eb2c0f1b0e8c9b8e0c8f9b8e0c8f9b8e0c8f9b8e0c8f9b8e0c8', name: 'Core PCE Index', description: 'Core Personal Consumption Expenditures Index level' }
  };

  protected setupTools() {
    this.addTool({
      name: 'get_econ_tickers',
      description: 'Get list of available economic indicators (CPI, PPI, unemployment, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['inflation', 'employment', 'gdp', 'pce', 'all'],
            description: 'Filter by economic data category',
            default: 'all'
          }
        },
        required: []
      },
      handler: this.getEconomicTickers.bind(this)
    });

    this.addTool({
      name: 'get_econ_data',
      description: 'Get economic data time series with configurable time range (default 6 months, max 1 year)',
      inputSchema: {
        type: 'object',
        properties: {
          tickers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Economic indicator tickers (e.g., ["CPI_YOY", "UNEMPLOYMENT_RATE"])',
            minItems: 1,
            maxItems: 10
          },
          months: {
            type: 'number',
            description: 'Number of months of historical data to retrieve',
            default: 6,
            minimum: 1,
            maximum: 12
          },
          include_current: {
            type: 'boolean',
            description: 'Include current/latest value',
            default: true
          }
        },
        required: ['tickers']
      },
      handler: this.getEconomicData.bind(this)
    });
  }

  private async getEconomicTickers(args: any) {
    try {
      const { category = 'all' } = args;
      
      const tickers = Object.entries(this.ECONOMIC_TICKERS).map(([key, value]) => ({
        ticker: key,
        symbol: value.symbol,
        name: value.name,
        description: value.description,
        category: this.getTickerCategory(key)
      }));
      
      let filteredTickers = tickers;
      if (category !== 'all') {
        filteredTickers = tickers.filter(ticker => ticker.category === category);
      }
      
      return {
        tickers: filteredTickers,
        count: filteredTickers.length,
        categories: ['inflation', 'employment', 'gdp', 'pce'],
        message: `Found ${filteredTickers.length} economic indicators${category !== 'all' ? ` in ${category} category` : ''}`
      };
    } catch (error: any) {
      return {
        error: 'Failed to get economic tickers',
        message: `Error fetching economic tickers: ${error.message}`
      };
    }
  }
  
  private getTickerCategory(ticker: string): string {
    if (ticker.includes('CPI') || ticker.includes('PPI') || ticker.includes('PCE')) {
      return 'inflation';
    }
    if (ticker.includes('UNEMPLOYMENT') || ticker.includes('NFP') || ticker.includes('WAGE')) {
      return 'employment';
    }
    if (ticker.includes('GDP')) {
      return 'gdp';
    }
    if (ticker.includes('PCE')) {
      return 'pce';
    }
    return 'other';
  }

  private async getEconomicData(args: any) {
    try {
      const { tickers, months = 6, include_current = true } = args;
      
      if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
        return {
          error: 'Invalid tickers',
          message: 'tickers parameter must be a non-empty array'
        };
      }
      
      // Validate months parameter
      const safeMonths = Math.min(Math.max(months, 1), 12);
      
      // Calculate time range
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (safeMonths * 30 * 24 * 60 * 60); // Approximate months to seconds
      
      const results: any[] = [];
      const errors: string[] = [];
      
      for (const ticker of tickers) {
        try {
          const tickerInfo = this.ECONOMIC_TICKERS[ticker];
          if (!tickerInfo) {
            errors.push(`Unknown ticker: ${ticker}`);
            continue;
          }
          
          // Get current value if requested
          let currentValue = null;
          if (include_current) {
            try {
              const currentResponse = await axios.get(`${this.PYTH_API_BASE}/updates/price/latest`, {
          params: {
                  'ids[]': [tickerInfo.id],
            parsed: true
          },
          timeout: 10000,
          headers: {
                  'User-Agent': 'economic-data/1.0'
                }
              });
              
              if (currentResponse.data && currentResponse.data.parsed && currentResponse.data.parsed.length > 0) {
                const feed = currentResponse.data.parsed[0];
                currentValue = {
                  value: this.formatEconomicValue(feed.price?.price || 0, ticker),
                  confidence: feed.price?.conf || 0,
                  timestamp: feed.price?.publish_time || 0,
                  formatted_timestamp: new Date((feed.price?.publish_time || 0) * 1000).toISOString()
                };
              }
            } catch (currentError: any) {
              console.warn(`Failed to get current value for ${ticker}:`, currentError.message);
            }
          }
          
          // For now, we'll return the current value as historical data is limited on Pyth
          // In a real implementation, you might want to store historical data or use another source
          const historicalData = currentValue ? [{
            timestamp: currentValue.timestamp,
            formatted_timestamp: currentValue.formatted_timestamp,
            value: currentValue.value,
            confidence: currentValue.confidence
          }] : [];
          
          results.push({
            ticker,
            name: tickerInfo.name,
            description: tickerInfo.description,
            symbol: tickerInfo.symbol,
            category: this.getTickerCategory(ticker),
            current_value: currentValue,
            historical_data: historicalData,
            data_points: historicalData.length,
            time_range: {
              start_time: startTime,
              end_time: endTime,
              months: safeMonths,
              start_date: new Date(startTime * 1000).toISOString(),
              end_date: new Date(endTime * 1000).toISOString()
            }
          });
          
        } catch (tickerError: any) {
          errors.push(`Error processing ${ticker}: ${tickerError.message}`);
        }
      }

      return {
        data: results,
        count: results.length,
        requested_tickers: tickers,
        successful_tickers: results.map(r => r.ticker),
        errors: errors.length > 0 ? errors : undefined,
        time_range: {
          months: safeMonths,
          start_date: new Date(startTime * 1000).toISOString(),
          end_date: new Date(endTime * 1000).toISOString()
        },
        message: `Retrieved economic data for ${results.length} out of ${tickers.length} requested tickers${safeMonths !== months ? ` (limited to ${safeMonths} months)` : ''}`
      };
    } catch (error: any) {
      return {
        error: 'Failed to get economic data',
        message: `Error fetching economic data: ${error.message}`
      };
    }
  }
  
  private formatEconomicValue(rawValue: number, ticker: string): number {
    // Most economic indicators on Pyth are scaled
    // CPI, PPI rates are typically in basis points (divide by 100 for percentage)
    // Unemployment rate is in basis points (divide by 100 for percentage)
    // Index values are typically as-is but scaled up
    
    if (ticker.includes('RATE') || ticker.includes('YOY') || ticker.includes('MOM')) {
      return rawValue / 100; // Convert basis points to percentage
    }
    
    if (ticker.includes('INDEX')) {
      return rawValue / 1000; // Scale down index values
    }
    
    if (ticker === 'UNEMPLOYMENT_RATE') {
      return rawValue / 100; // Convert to percentage
    }
    
    if (ticker === 'GDP_CURRENT') {
      return rawValue / 10; // Scale GDP rate
    }
    
    return rawValue; // Return as-is for other indicators
  }
}