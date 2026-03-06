/**
 * Ysalis First-Run Setup Wizard
 * Guides user through AI model, exchange, API keys, and Telegram config
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_DIR = path.join(process.cwd(), '.ysalis');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const SETUP_DONE_FILE = path.join(CONFIG_DIR, 'setup-done');
const ENV_FILE = path.join(process.cwd(), '.env');

export interface YsalisConfig {
  aiModel: string;
  preferredExchange: 'binance' | 'bybit' | 'both';
  marketType: 'spot' | 'futures' | 'both';
  dryRunDefault: boolean;
  setupComplete: boolean;
}

const DEFAULT_CONFIG: YsalisConfig = {
  aiModel: 'claude-sonnet-4-20250514',
  preferredExchange: 'both',
  marketType: 'both',
  dryRunDefault: true,
  setupComplete: false,
};

export function isSetupComplete(): boolean {
  try {
    if (fs.existsSync(SETUP_DONE_FILE)) return true;
    const cfg = loadConfig();
    return cfg?.setupComplete === true;
  } catch {
    return false;
  }
}

export function loadConfig(): YsalisConfig | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (_) {}
  return null;
}

export function saveConfig(config: Partial<YsalisConfig>): void {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const current = loadConfig() || DEFAULT_CONFIG;
  const merged = { ...current, ...config };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
}

function ensureEnvFile(): void {
  if (!fs.existsSync(ENV_FILE)) {
    const example = path.join(process.cwd(), 'env.example');
    if (fs.existsSync(example)) {
      fs.copyFileSync(example, ENV_FILE);
    } else {
      fs.writeFileSync(ENV_FILE, '', 'utf-8');
    }
  }
}

function setEnvVar(key: string, value: string): void {
  ensureEnvFile();
  let content = fs.readFileSync(ENV_FILE, 'utf-8');
  const keyRegex = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${value.includes(' ') ? `"${value.replace(/"/g, '\\"')}"` : value}`;
  if (keyRegex.test(content)) {
    content = content.replace(keyRegex, line);
  } else {
    content = content.trimEnd() + (content.endsWith('\n') ? '' : '\n') + '\n' + line + '\n';
  }
  fs.writeFileSync(ENV_FILE, content, 'utf-8');
  process.env[key] = value;
}

function prompt(rl: readline.Interface, question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : ' (or type "skip")';
  return new Promise((resolve) => {
    rl.question(question + suffix + ': ', (answer) => {
      const trimmed = answer.trim();
      if (trimmed.toLowerCase() === 'skip' && !defaultValue) return resolve('');
      if (trimmed === '' && defaultValue) return resolve(defaultValue);
      resolve(trimmed);
    });
  });
}

export async function runSetupWizard(force = false): Promise<YsalisConfig> {
  if (!force && isSetupComplete()) {
    return loadConfig() || DEFAULT_CONFIG;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`
┌─────────────────────────────────────────────────────────────┐
│         Ysalis Setup Wizard – First-Run Configuration        │
│                                                             │
│  You can type "skip" for any step to leave it unset.         │
│  You can always change these later in .env or via /set       │
└─────────────────────────────────────────────────────────────┘
`);

  const config: YsalisConfig = loadConfig() || { ...DEFAULT_CONFIG };

  // 1. AI Model (Claude only for now)
  console.log('\n📌 Step 1: AI Model');
  console.log('   Ysalis uses Claude for natural language and tool-calling.\n');
  const models = [
    { id: '1', name: 'claude-sonnet-4-20250514', desc: 'Claude 4 Sonnet (recommended)' },
    { id: '2', name: 'claude-opus-4-20250514', desc: 'Claude 4 Opus (most capable)' },
    { id: '3', name: 'claude-3-5-sonnet-20241022', desc: 'Claude 3.5 Sonnet' },
  ];
  models.forEach((m) => console.log(`   ${m.id}. ${m.name} - ${m.desc}`));
  const modelChoice = await prompt(rl, '\n   Select model (1-3)', '1');
  const modelMap: Record<string, string> = {
    '1': 'claude-sonnet-4-20250514',
    '2': 'claude-opus-4-20250514',
    '3': 'claude-3-5-sonnet-20241022',
  };
  config.aiModel = modelMap[modelChoice] || modelMap['1'];

  console.log('   Claude requires an API key for AI features.');
  const claudeKey = await prompt(rl, '   Claude API Key (from provider console)', '');
  if (claudeKey) {
    setEnvVar('ANTHROPIC_API_KEY', claudeKey);
    console.log('   ✓ Anthropic key saved');
  }

  // 2. Preferred Exchange
  console.log('\n📌 Step 2: Preferred Exchange');
  console.log('   Where do you want to trade?\n');
  console.log('   1. Binance only');
  console.log('   2. Bybit only');
  console.log('   3. Both (use either)');
  const exChoice = await prompt(rl, '\n   Select exchange (1-3)', '3');
  const exMap: Record<string, 'binance' | 'bybit' | 'both'> = {
    '1': 'binance',
    '2': 'bybit',
    '3': 'both',
  };
  config.preferredExchange = exMap[exChoice] || 'both';

  // 3. Market Type
  console.log('\n📌 Step 3: Market Type');
  console.log('   Spot = buy/sell actual coins. Futures = leverage, shorting.\n');
  console.log('   1. Spot only');
  console.log('   2. Futures only');
  console.log('   3. Both');
  const marketChoice = await prompt(rl, '\n   Select market (1-3)', '3');
  const marketMap: Record<string, 'spot' | 'futures' | 'both'> = {
    '1': 'spot',
    '2': 'futures',
    '3': 'both',
  };
  config.marketType = marketMap[marketChoice] || 'both';

  // 4. Default dry-run
  console.log('\n📌 Step 4: Default Mode');
  console.log('   Dry-run = no real orders until you disable it (safer).\n');
  const dryChoice = await prompt(rl, '   Start with dry-run? (y/n)', 'y');
  config.dryRunDefault = dryChoice.toLowerCase() !== 'n' && dryChoice.toLowerCase() !== 'no';

  // 5–8. Exchange API Keys
  if (config.preferredExchange === 'binance' || config.preferredExchange === 'both') {
    console.log('\n📌 Step 5–6: Binance API Keys');
    console.log('   Get keys from: https://www.binance.com/en/my/settings/api-management\n');
    const bk = await prompt(rl, '   Binance API Key');
    if (bk) {
      const bs = await prompt(rl, '   Binance Secret Key');
      if (bs) {
        setEnvVar('BINANCE_API_KEY', bk);
        setEnvVar('BINANCE_SECRET_KEY', bs);
        console.log('   ✓ Binance keys saved to .env');
      }
    }
  }

  if (config.preferredExchange === 'bybit' || config.preferredExchange === 'both') {
    console.log('\n📌 Step 7–8: Bybit API Keys');
    console.log('   Get keys from: https://www.bybit.com/app/user/api-management\n');
    const yk = await prompt(rl, '   Bybit API Key');
    if (yk) {
      const ys = await prompt(rl, '   Bybit Secret Key');
      if (ys) {
        setEnvVar('BYBIT_API_KEY', yk);
        setEnvVar('BYBIT_SECRET_KEY', ys);
        console.log('   ✓ Bybit keys saved to .env');
      }
    }
  }

  // 9. OpenAI API Key (for strategy parsing & semantic search)
  console.log('\n📌 Step 9: OpenAI API Key');
  console.log('   Used for: strategy parsing ("when BTC > 100k go long"), semantic search.\n');
  const oai = await prompt(rl, '   OpenAI API Key');
  if (oai) {
    setEnvVar('OPENAI_API_KEY', oai);
    console.log('   ✓ OpenAI key saved');
  }

  // 10. Telegram
  console.log('\n📌 Step 10: Telegram (Optional)');
  console.log('   For: channel monitoring, message-trigger strategies, sentiment.\n');
  console.log('   To get a session string, run: npx tsx utils/telegram-auth.ts');
  console.log('   Then paste the session string below, or skip.\n');
  const tg = await prompt(rl, '   Telegram session string');
  if (tg) {
    setEnvVar('TELEGRAM_SESSION_STRING', tg);
    console.log('   ✓ Session saved');
    const apiId = await prompt(rl, '   Telegram API ID (from https://my.telegram.org)', '');
    if (apiId) setEnvVar('TELEGRAM_API_ID', apiId);
    const apiHash = await prompt(rl, '   Telegram API Hash', '');
    if (apiHash) setEnvVar('TELEGRAM_API_HASH', apiHash);
  }

  // 11. Optional APIs
  console.log('\n📌 Step 11: Optional APIs (skip all to continue)');
  console.log('   Coinalyze (OI/liquidations), Earnings Feed, Crypto News, etc.\n');
  const coinalyze = await prompt(rl, '   Coinalyze API Key');
  if (coinalyze) setEnvVar('COINALYZE_API_KEY', coinalyze);

  config.setupComplete = true;
  saveConfig(config);

  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(SETUP_DONE_FILE, new Date().toISOString(), 'utf-8');

  rl.close();

  console.log(`
┌─────────────────────────────────────────────────────────────┐
│                    ✓ Setup Complete                         │
│                                                             │
│  Config: .ysalis/config.json                                │
│  Env:    .env                                               │
│                                                             │
│  Run: npm run ysalis                                        │
│  Re-run setup: npm run ysalis -- --setup                    │
└─────────────────────────────────────────────────────────────┘
`);

  return config;
}
