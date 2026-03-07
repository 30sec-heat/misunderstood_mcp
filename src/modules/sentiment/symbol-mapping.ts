/**
 * Symbol mapping and aliases for cryptocurrency sentiment analysis
 */

export interface SymbolMapping {
  symbol: string;
  aliases: string[];
  name: string;
}

// Common cryptocurrency symbols and their aliases
const SYMBOL_MAPPINGS: SymbolMapping[] = [
  {
    symbol: 'BTC',
    aliases: ['bitcoin', 'btc', '$btc', '#bitcoin', '#btc'],
    name: 'Bitcoin'
  },
  {
    symbol: 'ETH',
    aliases: ['ethereum', 'eth', '$eth', '#ethereum', '#eth', 'ether'],
    name: 'Ethereum'
  },
  {
    symbol: 'SOL',
    aliases: ['solana', 'sol', '$sol', '#solana', '#sol'],
    name: 'Solana'
  },
  {
    symbol: 'BNB',
    aliases: ['binance', 'bnb', '$bnb', '#binance', '#bnb', 'binance coin'],
    name: 'Binance Coin'
  },
  {
    symbol: 'ADA',
    aliases: ['cardano', 'ada', '$ada', '#cardano', '#ada'],
    name: 'Cardano'
  },
  {
    symbol: 'DOT',
    aliases: ['polkadot', 'dot', '$dot', '#polkadot', '#dot'],
    name: 'Polkadot'
  },
  {
    symbol: 'AVAX',
    aliases: ['avalanche', 'avax', '$avax', '#avalanche', '#avax'],
    name: 'Avalanche'
  },
  {
    symbol: 'MATIC',
    aliases: ['polygon', 'matic', '$matic', '#polygon', '#matic'],
    name: 'Polygon'
  },
  {
    symbol: 'LINK',
    aliases: ['chainlink', 'link', '$link', '#chainlink', '#link'],
    name: 'Chainlink'
  },
  {
    symbol: 'UNI',
    aliases: ['uniswap', 'uni', '$uni', '#uniswap', '#uni'],
    name: 'Uniswap'
  },
  {
    symbol: 'DOGE',
    aliases: ['dogecoin', 'doge', '$doge', '#dogecoin', '#doge'],
    name: 'Dogecoin'
  },
  {
    symbol: 'SHIB',
    aliases: ['shiba', 'shib', '$shib', '#shiba', '#shib', 'shiba inu'],
    name: 'Shiba Inu'
  },
  {
    symbol: 'LTC',
    aliases: ['litecoin', 'ltc', '$ltc', '#litecoin', '#ltc'],
    name: 'Litecoin'
  },
  {
    symbol: 'XRP',
    aliases: ['ripple', 'xrp', '$xrp', '#ripple', '#xrp'],
    name: 'XRP'
  },
  {
    symbol: 'ATOM',
    aliases: ['cosmos', 'atom', '$atom', '#cosmos', '#atom'],
    name: 'Cosmos'
  }
];

/**
 * Get all aliases for a given symbol
 */
export function getSymbolAliases(symbol: string): string[] {
  const upperSymbol = symbol.toUpperCase();
  const mapping = SYMBOL_MAPPINGS.find(m => m.symbol === upperSymbol);
  
  if (mapping) {
    return [symbol.toLowerCase(), ...mapping.aliases];
  }
  
  // If symbol not found, return common variations
  return [
    symbol.toLowerCase(),
    symbol.toUpperCase(),
    `$${symbol.toLowerCase()}`,
    `#${symbol.toLowerCase()}`
  ];
}

/**
 * Get symbol information by symbol or alias
 */
export function getSymbolInfo(symbolOrAlias: string): SymbolMapping | null {
  const lower = symbolOrAlias.toLowerCase();
  
  return SYMBOL_MAPPINGS.find(mapping => 
    mapping.symbol.toLowerCase() === lower ||
    mapping.aliases.some(alias => alias.toLowerCase() === lower)
  ) || null;
}

/**
 * Get all supported symbols
 */
export function getAllSymbols(): string[] {
  return SYMBOL_MAPPINGS.map(m => m.symbol);
}

/**
 * Check if a symbol is supported
 */
export function isSymbolSupported(symbol: string): boolean {
  return getSymbolInfo(symbol) !== null;
}