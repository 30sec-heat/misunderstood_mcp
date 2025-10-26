import axios from 'axios';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface PythPriceFeed {
  id: string;
  symbol: string;
  asset_type: string;
  base: string;
  quote_currency: string;
  description: string;
  display_symbol: string;
  schedule?: string;
  publish_interval?: string;
  country?: string;
  nasdaq_symbol?: string;
  cms_symbol?: string;
  cqs_symbol?: string;
  generic_symbol?: string;
  tenor?: string;
  contract_id?: string;
  umtf?: string;
}

export interface PythFeedsCache {
  feeds: PythPriceFeed[];
  lastUpdated: number;
  totalFeeds: number;
  categories: {
    crypto: PythPriceFeed[];
    equity: PythPriceFeed[];
    fx: PythPriceFeed[];
    commodity: PythPriceFeed[];
    bond: PythPriceFeed[];
    economic: PythPriceFeed[];
    other: PythPriceFeed[];
  };
}

class PythFeedsManager {
  private cache: PythFeedsCache | null = null;
  private readonly CACHE_FILE = path.join(process.cwd(), 'data', 'pyth-feeds-cache.json');
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly PYTH_API_BASE = 'https://hermes.pyth.network/v2';

  constructor() {
    this.ensureDataDirectory();
  }

  private async ensureDataDirectory() {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      console.log('Could not create data directory:', error);
    }
  }

  private categorizeFeeds(feeds: PythPriceFeed[]): PythFeedsCache['categories'] {
    const categories = {
      crypto: [] as PythPriceFeed[],
      equity: [] as PythPriceFeed[],
      fx: [] as PythPriceFeed[],
      commodity: [] as PythPriceFeed[],
      bond: [] as PythPriceFeed[],
      economic: [] as PythPriceFeed[],
      other: [] as PythPriceFeed[]
    };

    feeds.forEach(feed => {
      const assetType = feed.asset_type?.toLowerCase() || '';
      
      if (assetType.includes('crypto')) {
        categories.crypto.push(feed);
      } else if (assetType.includes('equity')) {
        categories.equity.push(feed);
      } else if (assetType.includes('fx')) {
        categories.fx.push(feed);
      } else if (assetType.includes('commodity')) {
        categories.commodity.push(feed);
      } else if (assetType.includes('bond')) {
        categories.bond.push(feed);
      } else if (assetType.includes('economic')) {
        categories.economic.push(feed);
      } else {
        categories.other.push(feed);
      }
    });

    return categories;
  }

  private async loadCacheFromFile(): Promise<PythFeedsCache | null> {
    try {
      const data = await fs.readFile(this.CACHE_FILE, 'utf-8');
      const cache = JSON.parse(data) as PythFeedsCache;
      
      // Check if cache is still valid
      const now = Date.now();
      if (now - cache.lastUpdated < this.CACHE_DURATION) {
        return cache;
      }
      
      return null; // Cache expired
    } catch (error) {
      return null; // No cache file or invalid
    }
  }

  private async saveCacheToFile(cache: PythFeedsCache): Promise<void> {
    try {
      await fs.writeFile(this.CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (error) {
      console.error('Failed to save Pyth feeds cache:', error);
    }
  }

  private async fetchFeedsFromAPI(): Promise<PythPriceFeed[]> {
    try {
      console.log('[REFRESH] Fetching Pyth price feeds from API...');
      const response = await axios.get(`${this.PYTH_API_BASE}/price_feeds`, {
        timeout: 30000
      });

      if (response.data && Array.isArray(response.data)) {
        return response.data.map((item: any) => ({
          id: item.id,
          symbol: item.attributes?.symbol || '',
          asset_type: item.attributes?.asset_type || '',
          base: item.attributes?.base || '',
          quote_currency: item.attributes?.quote_currency || '',
          description: item.attributes?.description || '',
          display_symbol: item.attributes?.display_symbol || '',
          schedule: item.attributes?.schedule,
          publish_interval: item.attributes?.publish_interval,
          country: item.attributes?.country,
          nasdaq_symbol: item.attributes?.nasdaq_symbol,
          cms_symbol: item.attributes?.cms_symbol,
          cqs_symbol: item.attributes?.cqs_symbol,
          generic_symbol: item.attributes?.generic_symbol,
          tenor: item.attributes?.tenor,
          contract_id: item.attributes?.contract_id,
          umtf: item.attributes?.umtf
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to fetch Pyth feeds from API:', error);
      return [];
    }
  }

  async refreshCache(): Promise<PythFeedsCache> {
    console.log('[REFRESH] Refreshing Pyth feeds cache...');
    
    const feeds = await this.fetchFeedsFromAPI();
    
    if (feeds.length === 0) {
      console.log('[WARNING] No feeds fetched, using existing cache or empty data');
      return this.cache || this.getEmptyCache();
    }

    const categories = this.categorizeFeeds(feeds);
    
    const cache: PythFeedsCache = {
      feeds,
      lastUpdated: Date.now(),
      totalFeeds: feeds.length,
      categories
    };

    this.cache = cache;
    await this.saveCacheToFile(cache);
    
    console.log(`[SUCCESS] Pyth feeds cache updated: ${feeds.length} feeds across ${Object.keys(categories).length} categories`);
    return cache;
  }

  private getEmptyCache(): PythFeedsCache {
    return {
      feeds: [],
      lastUpdated: 0,
      totalFeeds: 0,
      categories: {
        crypto: [],
        equity: [],
        fx: [],
        commodity: [],
        bond: [],
        economic: [],
        other: []
      }
    };
  }

  async getCache(): Promise<PythFeedsCache> {
    // Try to load from memory first
    if (this.cache) {
      const now = Date.now();
      if (now - this.cache.lastUpdated < this.CACHE_DURATION) {
        return this.cache;
      }
    }

    // Try to load from file
    const fileCache = await this.loadCacheFromFile();
    if (fileCache) {
      this.cache = fileCache;
      return fileCache;
    }

    // Cache is expired or doesn't exist, refresh it
    return await this.refreshCache();
  }

  async findFeedsBySymbol(symbol: string): Promise<PythPriceFeed[]> {
    const cache = await this.getCache();
    const searchTerm = symbol.toLowerCase();
    
    return cache.feeds.filter(feed => 
      feed.symbol.toLowerCase().includes(searchTerm) ||
      feed.display_symbol.toLowerCase().includes(searchTerm) ||
      feed.base.toLowerCase().includes(searchTerm) ||
      feed.description.toLowerCase().includes(searchTerm)
    );
  }

  async findFeedsByCategory(category: string): Promise<PythPriceFeed[]> {
    const cache = await this.getCache();
    const categoryKey = category.toLowerCase() as keyof PythFeedsCache['categories'];
    
    if (categoryKey in cache.categories) {
      return cache.categories[categoryKey];
    }
    
    return [];
  }

  async getPopularFeeds(): Promise<PythPriceFeed[]> {
    const cache = await this.getCache();
    
    // Return popular feeds from each category
    const popular = [
      ...cache.categories.crypto.slice(0, 10), // Top 10 crypto
      ...cache.categories.equity.slice(0, 20), // Top 20 equities
      ...cache.categories.fx.slice(0, 10),     // Top 10 forex
      ...cache.categories.commodity.slice(0, 5), // Top 5 commodities
      ...cache.categories.bond.slice(0, 5)     // Top 5 bonds
    ];
    
    return popular;
  }

  async getCacheStats(): Promise<{
    totalFeeds: number;
    lastUpdated: string;
    categoryCounts: { [key: string]: number };
  }> {
    const cache = await this.getCache();
    
    return {
      totalFeeds: cache.totalFeeds,
      lastUpdated: new Date(cache.lastUpdated).toISOString(),
      categoryCounts: {
        crypto: cache.categories.crypto.length,
        equity: cache.categories.equity.length,
        fx: cache.categories.fx.length,
        commodity: cache.categories.commodity.length,
        bond: cache.categories.bond.length,
        economic: cache.categories.economic.length,
        other: cache.categories.other.length
      }
    };
  }

  async startAutoRefresh(): Promise<void> {
    // Auto-refresh cache every 24 hours
    setInterval(async () => {
      try {
        console.log('[REFRESH] Auto-refreshing Pyth feeds cache...');
        await this.refreshCache();
      } catch (error) {
        console.error('Failed to auto-refresh Pyth feeds cache:', error);
      }
    }, this.CACHE_DURATION);
  }

  async getSymbolsByAssetType(assetType: string): Promise<PythPriceFeed[]> {
    const cache = await this.getCache();
    return cache.feeds.filter(feed => 
      feed.asset_type?.toLowerCase().includes(assetType.toLowerCase())
    );
  }

  async getSymbolsByCountry(country: string): Promise<PythPriceFeed[]> {
    const cache = await this.getCache();
    return cache.feeds.filter(feed => 
      feed.country?.toLowerCase().includes(country.toLowerCase())
    );
  }

  async searchSymbolsAdvanced(query: {
    symbol?: string;
    asset_type?: string;
    country?: string;
    description?: string;
    limit?: number;
  }): Promise<PythPriceFeed[]> {
    const cache = await this.getCache();
    let results = cache.feeds;

    if (query.symbol) {
      const searchTerm = query.symbol.toLowerCase();
      results = results.filter(feed => 
        feed.symbol.toLowerCase().includes(searchTerm) ||
        feed.display_symbol.toLowerCase().includes(searchTerm) ||
        feed.base.toLowerCase().includes(searchTerm)
      );
    }

    if (query.asset_type) {
      results = results.filter(feed => 
        feed.asset_type?.toLowerCase().includes(query.asset_type!.toLowerCase())
      );
    }

    if (query.country) {
      results = results.filter(feed => 
        feed.country?.toLowerCase().includes(query.country!.toLowerCase())
      );
    }

    if (query.description) {
      const searchTerm = query.description.toLowerCase();
      results = results.filter(feed => 
        feed.description.toLowerCase().includes(searchTerm)
      );
    }

    const limit = query.limit || 100;
    return results.slice(0, limit);
  }
}

// Singleton instance
export const pythFeedsManager = new PythFeedsManager();

// Helper functions for easy access
export async function getPythFeeds(): Promise<PythFeedsCache> {
  return await pythFeedsManager.getCache();
}

export async function refreshPythFeeds(): Promise<PythFeedsCache> {
  return await pythFeedsManager.refreshCache();
}

export async function findPythFeedsBySymbol(symbol: string): Promise<PythPriceFeed[]> {
  return await pythFeedsManager.findFeedsBySymbol(symbol);
}

export async function findPythFeedsByCategory(category: string): Promise<PythPriceFeed[]> {
  return await pythFeedsManager.findFeedsByCategory(category);
}

export async function getPopularPythFeeds(): Promise<PythPriceFeed[]> {
  return await pythFeedsManager.getPopularFeeds();
}

export async function getPythFeedsStats(): Promise<{
  totalFeeds: number;
  lastUpdated: string;
  categoryCounts: { [key: string]: number };
}> {
  return await pythFeedsManager.getCacheStats();
}

export async function startPythAutoRefresh(): Promise<void> {
  return await pythFeedsManager.startAutoRefresh();
}

export async function getPythSymbolsByAssetType(assetType: string): Promise<PythPriceFeed[]> {
  return await pythFeedsManager.getSymbolsByAssetType(assetType);
}

export async function getPythSymbolsByCountry(country: string): Promise<PythPriceFeed[]> {
  return await pythFeedsManager.getSymbolsByCountry(country);
}

export async function searchPythSymbolsAdvanced(query: {
  symbol?: string;
  asset_type?: string;
  country?: string;
  description?: string;
  limit?: number;
}): Promise<PythPriceFeed[]> {
  return await pythFeedsManager.searchSymbolsAdvanced(query);
}
