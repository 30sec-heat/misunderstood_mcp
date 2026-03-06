/**
 * Config Module - Set environment variables / API keys via MCP
 * Allows users to add or update env vars by speaking to the agent
 */

import { BaseCryptoModule } from '../base/module.js';
import * as fs from 'fs';
import * as path from 'path';

/** Keys that can be set via the agent. Excludes sensitive DB/system vars. */
const ALLOWED_KEYS = new Set([
  'BINANCE_API_KEY',
  'BINANCE_SECRET_KEY',
  'BYBIT_API_KEY',
  'BYBIT_SECRET_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'COINALYZE_API_KEY',
  'EARNINGSFEED_API_KEY',
  'EARNINGSFEED_API_BASE_URL',
  'MASSIVE_API_KEY',
  'MASSIVE_API_BASE_URL',
  'CRYPTO_NEWS_API_KEY',
  'BRAVE_SEARCH_API_KEY',
  'SERPER_API_KEY',
  'DERIBIT_CLIENT_ID',
  'DERIBIT_CLIENT_SECRET',
  'COINDESK_API_KEY',
  'SOLANA_RPC_URL',
  'TELEGRAM_SESSION_STRING',
  'TELEGRAM_API_ID',
  'TELEGRAM_API_HASH',
  'LOG_LEVEL',
  'PORT',
  'HOST',
]);

export class ConfigModule extends BaseCryptoModule {
  name = 'config';

  constructor() {
    super();
    this.setupTools();
  }

  async initialize(): Promise<void> {
    await super.initialize();
  }

  protected setupTools(): void {
    this.addTool({
      name: 'config_set_env_var',
      description:
        'Add or update an environment variable (e.g. API key) in .env. Use when user says "set my Binance API key" or "add COINALYZE_API_KEY". Only allowed keys can be set. Value is persisted to .env file.',
      inputSchema: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description:
              'Environment variable name (e.g. BINANCE_API_KEY, OPENAI_API_KEY). Use UPPER_SNAKE_CASE.',
          },
          value: {
            type: 'string',
            description: 'The value to set. For secrets, the full key string.',
          },
        },
        required: ['key', 'value'],
      },
      handler: this.setEnvVar.bind(this),
    });

    this.addTool({
      name: 'config_list_allowed_keys',
      description:
        'List which environment variable names can be set via config_set_env_var. Useful when user asks "what keys can I set" or to validate before setting.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: this.listAllowedKeys.bind(this),
    });
  }

  private async setEnvVar(args: { key: string; value: string }): Promise<any> {
    const key = args.key.trim().toUpperCase().replace(/\s+/g, '_');
    const value = args.value.trim();

    if (!key || !value) {
      return {
        success: false,
        error: 'key and value are required',
      };
    }

    if (!ALLOWED_KEYS.has(key)) {
      return {
        success: false,
        error: `Key "${key}" is not in the allowed list. Use config_list_allowed_keys to see available keys.`,
        allowedCount: ALLOWED_KEYS.size,
      };
    }

    const envPath = path.join(process.cwd(), '.env');
    let content = '';
    const keyRegex = new RegExp(`^${key}=.*$`, 'm');

    try {
      if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf-8');
      } else {
        // Create from env.example if .env doesn't exist
        const examplePath = path.join(process.cwd(), 'env.example');
        if (fs.existsSync(examplePath)) {
          content = fs.readFileSync(examplePath, 'utf-8');
        }
      }

      // Escape value for .env: wrap in quotes if it contains spaces or special chars
      const needsQuotes =
        value.includes(' ') || value.includes('=') || value.includes('#') || value.includes('"');
      const safeValue = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value;

      const line = `${key}=${safeValue}`;
      if (keyRegex.test(content)) {
        content = content.replace(keyRegex, line);
      } else {
        // Append
        const trimmed = content.trimEnd();
        content = trimmed + (trimmed.endsWith('\n') ? '' : '\n') + '\n' + line + '\n';
      }

      fs.writeFileSync(envPath, content, 'utf-8');

      // Update process.env for current process (optional - dotenv reload would need restart)
      process.env[key] = value;

      return {
        success: true,
        key,
        message: `Set ${key} in .env. Restart the server/agent to pick up changes.`,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async listAllowedKeys(): Promise<any> {
    return {
      allowed: Array.from(ALLOWED_KEYS).sort(),
      count: ALLOWED_KEYS.size,
      message: `You can set these ${ALLOWED_KEYS.size} keys via config_set_env_var.`,
    };
  }
}
