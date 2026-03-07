/**
 * Big John First-Run Setup Wizard
 * Guides user through AI model, exchange, API keys, and Telegram config
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { ClaudeClient } from '../src/claude-client.js';

const CONFIG_DIR = path.join(process.cwd(), '.ysalis');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const SETUP_DONE_FILE = path.join(CONFIG_DIR, 'setup-done');
const ENV_FILE = path.join(process.cwd(), '.env');

export interface BigJohnConfig {
  aiModel: string;
  preferredExchange: 'binance' | 'bybit' | 'both';
  marketType: 'spot' | 'futures' | 'both';
  setupComplete: boolean;
}

const DEFAULT_CONFIG: BigJohnConfig = {
  aiModel: 'claude-3-5-sonnet-20241022',
  preferredExchange: 'both',
  marketType: 'both',
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

export function loadConfig(): BigJohnConfig | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (_) {}
  return null;
}

export function saveConfig(config: Partial<BigJohnConfig>): void {
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

export async function runSetupWizard(force = false): Promise<BigJohnConfig> {
  if (!force && isSetupComplete()) {
    return loadConfig() || DEFAULT_CONFIG;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`
┌─────────────────────────────────────────────────────────────┐
│         Big John Setup Wizard – First-Run Configuration     │
│                                                             │
│  You can type "skip" for any step to leave it unset.         │
│  You can always change these later in .env or via /set       │
└─────────────────────────────────────────────────────────────┘
`);

  const config: BigJohnConfig = loadConfig() || { ...DEFAULT_CONFIG };

  // 1. AI Model (Claude only for now)
  console.log('\n📌 Step 1: AI Model');
  console.log('   Big John uses Claude for natural language conversations and strategy parsing.\n');
  
  const availableModels = ClaudeClient.getAvailableModels();
  availableModels.forEach((model, index) => {
    console.log(`   ${index + 1}. ${model.name} - ${model.description}`);
    console.log(`      Cost: $${model.inputCostPer1M}/1M input, $${model.outputCostPer1M}/1M output tokens`);
  });
  
  const modelChoice = await prompt(rl, `\n   Select model (1-${availableModels.length})`, '1');
  const selectedIndex = parseInt(modelChoice) - 1;
  const selectedModel = availableModels[selectedIndex] || availableModels[0];
  config.aiModel = selectedModel.id;

  console.log('\n   Claude requires an API key for AI features.');
  console.log('   Get your API key from: https://console.anthropic.com/');
  const claudeKey = await prompt(rl, '   Anthropic API Key (sk-ant-...)', '');
  if (claudeKey) {
    setEnvVar('ANTHROPIC_API_KEY', claudeKey);
    console.log('   ✓ Anthropic API key saved');
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

  // 4–7. Exchange API Keys
  if (config.preferredExchange === 'binance' || config.preferredExchange === 'both') {
    console.log('\n📌 Step 4–5: Binance API Keys');
    console.log('   Get keys from: https://www.binance.com/en/my/settings/api-management');
    console.log('   ⚠️  Use testnet for testing: https://testnet.binance.vision/\n');
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
    console.log('\n📌 Step 6–7: Bybit API Keys');
    console.log('   Get keys from: https://www.bybit.com/app/user/api-management');
    console.log('   ⚠️  Use testnet for testing: https://testnet.bybit.com/\n');
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

  // 8. Telegram
  console.log('\n📌 Step 8: Telegram (Optional)');
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

  // 9. Optional APIs
  console.log('\n📌 Step 9: Optional APIs (skip all to continue)');
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
