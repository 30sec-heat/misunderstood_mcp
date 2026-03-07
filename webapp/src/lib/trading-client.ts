/**
 * Client-side trading - signs requests in browser, sends via relay.
 * Keys from localStorage (Keys Vault). Server NEVER receives keys.
 */

import { getExchangeKeys, type ExchangeId } from './keys-vault';

const RELAY_URL = '/api/trading/relay';

async function hmacSha256Base64(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const keyData = enc.encode(key);
  const keyObj = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    keyObj,
    enc.encode(data)
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function hmacSha256Hex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const keyData = enc.encode(key);
  const keyObj = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', keyObj, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Binance: sign query string with HMAC-SHA256 */
async function signBinanceParams(
  secret: string,
  query: string
): Promise<string> {
  return hmacSha256Base64(secret, query);
}

/** Bybit v5: sign timestamp + api_key + recv_window + rawRequestBody, output hex */
async function signBybitV5(
  secret: string,
  timestamp: string,
  apiKey: string,
  recvWindow: string,
  rawBody: string
): Promise<string> {
  const payload = timestamp + apiKey + recvWindow + rawBody;
  return hmacSha256Hex(secret, payload);
}

export interface PlaceMarketOrderParams {
  exchange: ExchangeId;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  marketType: 'spot' | 'futures';
}

export interface PlaceLimitOrderParams {
  exchange: ExchangeId;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  marketType: 'spot' | 'futures';
}

export interface RelayResult {
  success?: boolean;
  orderId?: string;
  error?: string;
  msg?: string;
  retCode?: number;
  [key: string]: unknown;
}

async function relay(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<RelayResult> {
  const res = await fetch(RELAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, method, headers, body }),
  });
  const data = (await res.json()) as RelayResult & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Relay failed: ${res.status}`);
  }
  return data;
}

/** Place a Binance spot market order */
async function binanceSpotMarketOrder(
  apiKey: string,
  secret: string,
  symbol: string,
  side: 'buy' | 'sell',
  quantity: number
): Promise<RelayResult> {
  const timestamp = Date.now().toString();
  const params = new URLSearchParams({
    symbol: symbol.replace('/', ''),
    side: side.toUpperCase(),
    type: 'MARKET',
    quantity: quantity.toString(),
    timestamp,
  });
  const signature = await signBinanceParams(secret, params.toString());
  params.set('signature', signature);

  const url = `https://api.binance.com/api/v3/order?${params.toString()}`;
  return relay(url, 'POST', { 'X-MBX-APIKEY': apiKey });
}

/** Place a Binance futures market order */
async function binanceFuturesMarketOrder(
  apiKey: string,
  secret: string,
  symbol: string,
  side: 'buy' | 'sell',
  quantity: number
): Promise<RelayResult> {
  const timestamp = Date.now().toString();
  const sym = symbol.includes('/') ? symbol.replace('/', '').replace(':USDT', 'USDT') : symbol;
  const params = new URLSearchParams({
    symbol: sym,
    side: side.toUpperCase(),
    type: 'MARKET',
    quantity: quantity.toString(),
    timestamp,
  });
  const signature = await signBinanceParams(secret, params.toString());
  params.set('signature', signature);

  const url = `https://fapi.binance.com/fapi/v1/order?${params.toString()}`;
  return relay(url, 'POST', { 'X-MBX-APIKEY': apiKey });
}

/** Place a Bybit spot market order (v5 API) */
async function bybitSpotMarketOrder(
  apiKey: string,
  secret: string,
  symbol: string,
  side: 'buy' | 'sell',
  qty: number
): Promise<RelayResult> {
  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  const sym = symbol.includes('/') ? symbol.replace('/', '') : symbol;
  const bodyObj = {
    category: 'spot',
    symbol: sym,
    side: side === 'buy' ? 'Buy' : 'Sell',
    orderType: 'Market',
    qty: qty.toString(),
  };
  const rawBody = JSON.stringify(bodyObj);
  const signature = await signBybitV5(secret, timestamp, apiKey, recvWindow, rawBody);
  const url = 'https://api.bybit.com/v5/order/create';
  return relay(url, 'POST', {
    'Content-Type': 'application/json',
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-SIGN': signature,
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': recvWindow,
  }, rawBody);
}

/** Place market order using client-side keys and relay */
export async function placeMarketOrder(
  params: PlaceMarketOrderParams
): Promise<RelayResult> {
  const keys = getExchangeKeys(params.exchange);
  if (!keys?.apiKey || !keys?.secret) {
    throw new Error(`No API keys for ${params.exchange}. Add keys in Settings > Keys Vault.`);
  }

  const sym = params.symbol.toUpperCase().replace('-', '');
  const symbol = sym.endsWith('USDT') ? sym : `${sym}USDT`;

  if (params.exchange === 'binance') {
    return params.marketType === 'futures'
      ? binanceFuturesMarketOrder(keys.apiKey, keys.secret, symbol, params.side, params.amount)
      : binanceSpotMarketOrder(keys.apiKey, keys.secret, symbol, params.side, params.amount);
  }

  if (params.exchange === 'bybit') {
    return bybitSpotMarketOrder(keys.apiKey, keys.secret, symbol, params.side, params.amount);
  }

  throw new Error(`Unsupported exchange: ${params.exchange}`);
}
