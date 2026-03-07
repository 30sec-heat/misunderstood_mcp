/**
 * Keys Vault - Client-side only storage for exchange API keys and wallet keys.
 * NEVER sent to server. Used for signing orders in the browser.
 */

const STORAGE_KEY = 'mcp_keys_vault';

export type ExchangeId = 'binance' | 'bybit';

export interface ExchangeKeys {
  apiKey: string;
  secret: string;
  label?: string;
}

export interface WalletKey {
  id: string;
  label: string;
  /** Masked for display only - never store raw key in a way that gets logged */
  address?: string;
  /** Encrypted or encoded - for now we store as-is in localStorage (user responsibility) */
  privateKeyEncoded?: string;
}

export interface KeysVaultData {
  exchange: Partial<Record<ExchangeId, ExchangeKeys>>;
  wallets: WalletKey[];
  updatedAt: string;
}

const DEFAULT: KeysVaultData = {
  exchange: {},
  wallets: [],
  updatedAt: new Date().toISOString(),
};

export function loadKeysVault(): KeysVaultData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as KeysVaultData;
    return {
      exchange: parsed.exchange ?? {},
      wallets: parsed.wallets ?? [],
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveKeysVault(data: KeysVaultData): void {
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function setExchangeKeys(exchange: ExchangeId, keys: ExchangeKeys | null): void {
  const data = loadKeysVault();
  if (keys) {
    data.exchange[exchange] = keys;
  } else {
    delete data.exchange[exchange];
  }
  saveKeysVault(data);
}

export function getExchangeKeys(exchange: ExchangeId): ExchangeKeys | null {
  return loadKeysVault().exchange[exchange] ?? null;
}

export function maskKey(key: string, visible = 4): string {
  if (!key || key.length <= visible * 2) return '••••••••';
  return `${key.slice(0, visible)}${'•'.repeat(Math.min(key.length - visible * 2, 12))}${key.slice(-visible)}`;
}
