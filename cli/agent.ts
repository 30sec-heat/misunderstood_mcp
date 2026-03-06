#!/usr/bin/env node
/**
 * CLI-based AI Trading Agent
 * Interactive chat with MCP tools for crypto trading intelligence.
 * Natural language strategy creation: "I notice bitcoin goes up when xyz... take a long"
 */

import 'dotenv/config';
import { program } from 'commander';
import * as readline from 'readline';
import axios from 'axios';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ClaudeClient, type ConversationMessage } from '../src/claude-client.js';

// Strategy automation
import {
  parsedToConditionalStrategy,
  loadStrategies,
  upsertStrategy,
  executeConditionalStrategy,
  getStrategyRunner,
  type ConditionalStrategy,
} from '../src/strategy/index.js';
import {
  runSetupWizard,
  isSetupComplete,
  loadConfig,
  type YsalisConfig,
} from './setup-wizard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Types ---

export interface ToolRunner {
  callTool(name: string, args: object): Promise<any>;
}

export interface AgentConfig {
  mode: 'chat' | 'strategy' | 'execute';
  exchange: 'binance' | 'bybit' | 'both';
  market: 'spot' | 'futures' | 'both';
  dryRun: boolean;
  backendUrl?: string;
}

// --- ToolRunner implementations ---

/** ToolRunner that calls backend HTTP API (expects POST /tools/call and GET /tools) */
class BackendToolRunner implements ToolRunner {
  constructor(public readonly baseUrl: string) {}

  async callTool(name: string, args: object): Promise<any> {
    const res = await axios.post(`${this.baseUrl}/tools/call`, {
      name,
      arguments: args,
    }, { timeout: 60000 });
    return res.data;
  }

  async listTools(): Promise<{ tools: Array<{ name: string; description?: string }> }> {
    const res = await axios.get(`${this.baseUrl}/tools`, { timeout: 10000 });
    return res.data;
  }
}

/** ToolRunner that spawns MCP server as subprocess and calls tools via MCP protocol */
class MCPSubprocessToolRunner implements ToolRunner {
  private client: Client | null = null;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async callTool(name: string, args: object): Promise<any> {
    await this.ensureConnected();
    const result = await this.client!.callTool({
      name,
      arguments: args,
    });
    // MCP returns { content: [{ type: 'text', text: '...' }], isError? }
    if (result.content?.length) {
      const textContent = result.content.find((c: any) => c.type === 'text');
      if (textContent?.text) {
        try {
          return JSON.parse(textContent.text);
        } catch {
          return { text: textContent.text };
        }
      }
    }
    return result;
  }

  private async ensureConnected(): Promise<void> {
    if (this.client) return;

    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', join(this.projectRoot, 'mcp-server-socket.ts')],
      env: { ...process.env },
      stderr: 'ignore', // Suppress MCP server init logs in agent output
    });

    this.client = new Client(
      { name: 'ysalis', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    try {
      await this.client.connect(transport);
    } catch (err) {
      throw new Error(
        `MCP server failed to start. Run "npm run mcp-socket" to debug. ${(err as Error).message}`
      );
    }
  }

  async listTools(): Promise<{ tools: Array<{ name: string; description?: string }> }> {
    await this.ensureConnected();
    const result = await this.client!.listTools();
    return { tools: result.tools || [] };
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}

// --- Initialize ToolRunner ---

async function createToolRunner(config: AgentConfig): Promise<ToolRunner> {
  if (config.backendUrl) {
    const baseUrl = config.backendUrl.replace(/\/$/, '');
    return new BackendToolRunner(baseUrl);
  }
  // Default: spawn MCP server subprocess
  const projectRoot = join(__dirname, '..');
  return new MCPSubprocessToolRunner(projectRoot);
}

// --- Welcome banner ---

function printBanner(config: AgentConfig): void {
  const modeStr = config.mode.padEnd(20);
  const exchangeStr = config.exchange.padEnd(15);
  const marketStr = config.market.padEnd(20);
  const dryRunStr = String(config.dryRun).padEnd(14);
  const backendStr = (config.backendUrl || 'MCP subprocess').padEnd(45);

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           Ysalis - AI Trading Agent                          ║
╠═══════════════════════════════════════════════════════════════╣
║  Mode:    ${modeStr} Exchange: ${exchangeStr} ║
║  Market:  ${marketStr} Dry-run: ${dryRunStr} ║
║  Backend: ${backendStr} ║
╚═══════════════════════════════════════════════════════════════╝
`);

  if (config.mode === 'chat') {
    console.log(`Commands:
  /tools              List available MCP tools
  /call <name> [json] Call a tool (e.g. /call get_comprehensive_quotes '{"symbol":"BTC"}')
  /set <KEY> <value>  Set env var / API key (e.g. /set ANTHROPIC_API_KEY sk-xxx)
  /strategy <text>    Parse natural language into a strategy (e.g. "when BTC > 100k go long")
  /strategies         List saved strategies
  /save <id>          Save last parsed strategy with given id
  /help               Show this help
  /exit or Ctrl+C     Exit

Chat naturally with Ysalis! Ask questions, get crypto insights, or describe trading strategies.
Multi-line input: Enter empty line to send your message.
Set API key: "set my Claude API key to sk-ant-xxx" or "add ANTHROPIC_API_KEY sk-ant-xxx"
Strategy examples: "bitcoin goes up when xyz, take a long" | "when ETH drops 5% go short"
`);
  }
}

// --- Chat mode: interactive readline ---

/** Last parsed strategy (for /save) */
let lastParsedStrategy: { parsed: any; strategy: ConditionalStrategy } | null = null;

/** Claude client for AI conversations */
let claudeClient: ClaudeClient | null = null;

/** Conversation history for context */
let conversationHistory: ConversationMessage[] = [];

async function runChatMode(config: AgentConfig, toolRunner: ToolRunner): Promise<void> {
  // Initialize Claude client
  claudeClient = new ClaudeClient();
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'You> ',
  });

  let buffer: string[] = [];

  const processInput = async (line: string): Promise<void> => {
    const trimmed = line.trim();

    // Empty line = send buffered input
    if (trimmed === '') {
      const message = buffer.join('\n').trim();
      buffer = [];
      if (message) {
        await handleUserMessage(message, toolRunner, config);
      }
      rl.prompt();
      return;
    }

    // Commands start with /
    if (trimmed.startsWith('/')) {
      const [cmd, ...rest] = trimmed.split(/\s+/);
      const arg = rest.join(' ').trim();

      switch (cmd) {
        case '/exit':
        case '/quit':
          console.log('\nGoodbye!');
          if ('close' in toolRunner && typeof toolRunner.close === 'function') {
            await (toolRunner as MCPSubprocessToolRunner).close();
          }
          process.exit(0);
        case '/help':
          printBanner(config);
          break;
        case '/tools':
          await listTools(toolRunner);
          break;
        case '/call': {
          const match = arg.match(/^(\S+)\s*(.*)$/s);
          const toolName = match?.[1];
          const jsonArg = match?.[2]?.trim() || '{}';
          if (!toolName) {
            console.log('Ysalis> Usage: /call <toolName> [json-args]');
          } else {
            await callToolByName(toolRunner, toolName, jsonArg);
          }
          break;
        }
        case '/strategy':
          await handleStrategyCommand(arg, config);
          break;
        case '/strategies':
          await listStrategies();
          break;
        case '/save': {
          const id = arg.trim() || `strat-${Date.now()}`;
          if (lastParsedStrategy) {
            lastParsedStrategy.strategy.id = id;
            upsertStrategy(lastParsedStrategy.strategy);
            console.log(`Ysalis> Saved strategy as "${id}"`);
          } else {
            console.log('Ysalis> No strategy to save. Use /strategy <text> first.');
          }
          break;
        }
        case '/set': {
          const setMatch = arg.match(/^(\S+)\s+(.+)$/s);
          if (setMatch) {
            await handleSetEnvVar(toolRunner, setMatch[1].trim(), setMatch[2].trim());
          } else {
            console.log('Ysalis> Usage: /set <KEY> <value> (e.g. /set BINANCE_API_KEY abc123)');
          }
          break;
        }
        default:
          console.log(`Ysalis> Unknown command: ${cmd}. Type /help for commands.`);
      }
      rl.prompt();
      return;
    }

    buffer.push(line);
    rl.prompt();
  };

  rl.on('line', (line) => {
    processInput(line).catch((err) => {
      console.error('Ysalis> Error:', err.message);
      rl.prompt();
    });
  });

  rl.on('close', () => {
    console.log('\nGoodbye!');
    process.exit(0);
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\nGoodbye!');
    if ('close' in toolRunner && typeof toolRunner.close === 'function') {
      (toolRunner as MCPSubprocessToolRunner).close().finally(() => process.exit(0));
    } else {
      process.exit(0);
    }
  });

  rl.prompt();
}

async function listTools(toolRunner: ToolRunner): Promise<void> {
  try {
    if ('listTools' in toolRunner && typeof toolRunner.listTools === 'function') {
      const result = await (toolRunner as any).listTools();
      const tools = result?.tools || [];
      console.log('Ysalis> Available tools:');
      (tools as any[]).forEach((t) => console.log(`  - ${t.name}: ${t.description || ''}`));
      return;
    }
    console.log('Ysalis> Tool listing not available. Try /call get_comprehensive_quotes \'{"symbol":"BTC"}\'');
  } catch (err) {
    console.log('Ysalis>', (err as Error).message);
  }
}

async function callToolByName(
  toolRunner: ToolRunner,
  name: string,
  jsonArg: string
): Promise<void> {
  let args: object = {};
  if (jsonArg) {
    try {
      args = JSON.parse(jsonArg);
    } catch {
      console.log('Ysalis> Invalid JSON arguments. Example: \'{"symbol":"BTC"}\'');
      return;
    }
  }
  try {
    process.stdout.write('Ysalis> ');
    const result = await toolRunner.callTool(name, args);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.log('Ysalis> Error:', (err as Error).message);
  }
}

async function handleStrategyCommand(arg: string, config: AgentConfig): Promise<void> {
  const text = arg.trim();
  if (!text) {
    console.log('Ysalis> Usage: /strategy <natural language>');
    console.log('Ysalis> Example: /strategy when bitcoin goes above 100k I want to go long');
    return;
  }
  try {
    process.stdout.write('Ysalis> Parsing... ');
    
    // Use Claude for strategy parsing
    if (!claudeClient) {
      claudeClient = new ClaudeClient();
    }
    
    const parsed = await claudeClient.parseStrategy(text);
    const strategy = parsedToConditionalStrategy(parsed, {
      id: `strat-${Date.now()}`,
      name: `${parsed.symbol} ${parsed.action} (${parsed.condition.type})`,
    });
    lastParsedStrategy = { parsed, strategy };
    console.log('\nYsalis> Parsed strategy:');
    console.log(JSON.stringify(strategy, null, 2));
    console.log('Ysalis> Use /save <id> to save, or /strategy with new text.');
  } catch (err) {
    console.log('\nYsalis> Error:', (err as Error).message);
    if ((err as Error).message?.includes('API key')) {
      console.log('Ysalis> Set ANTHROPIC_API_KEY in .env for natural language parsing.');
    }
  }
}

async function handleSetEnvVar(toolRunner: ToolRunner, key: string, value: string): Promise<void> {
  try {
    const keyNorm = key.toUpperCase().replace(/\s+/g, '_');
    const result = await toolRunner.callTool('config_set_env_var', { key: keyNorm, value });
    const content = result?.content?.[0]?.text;
    const data = typeof content === 'string' ? (() => { try { return JSON.parse(content); } catch { return { text: content }; } })() : result;
    if (data?.success) {
      console.log(`Ysalis> ${data.message || 'Set ' + keyNorm}`);
    } else {
      console.log('Ysalis>', data?.error || JSON.stringify(result));
    }
  } catch (err) {
    console.log('Ysalis> Error:', (err as Error).message);
  }
}

/** Parse "set X to Y" / "my binance api key is X" style messages into key/value */
function parseEnvSetFromMessage(message: string): { key: string; value: string } | null {
  const lower = message.toLowerCase().trim();
  const serviceToKey: Record<string, string> = {
    binance: 'BINANCE_API_KEY',
    bybit: 'BYBIT_API_KEY',
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    claude: 'ANTHROPIC_API_KEY',
    coinalyze: 'COINALYZE_API_KEY',
    brave: 'BRAVE_SEARCH_API_KEY',
    serper: 'SERPER_API_KEY',
    earnings: 'EARNINGSFEED_API_KEY',
    massive: 'MASSIVE_API_KEY',
    polygon: 'MASSIVE_API_KEY',
    news: 'CRYPTO_NEWS_API_KEY',
    deribit: 'DERIBIT_CLIENT_ID',
  };

  // "set BINANCE_API_KEY to abc" or "set BINANCE_API_KEY=abc"
  let m = message.match(/set\s+([A-Za-z0-9_]+)\s*(?:to|=)\s*(.+)/i);
  if (m) return { key: m[1].toUpperCase(), value: m[2].trim() };

  // "BINANCE_API_KEY = abc" or "BINANCE_API_KEY: abc"
  m = message.match(/([A-Za-z0-9_]+)\s*[:=]\s*(.+)/);
  if (m && /_KEY|_SECRET|API_ID|API_HASH/.test(m[1])) return { key: m[1].toUpperCase(), value: m[2].trim() };

  // "my binance api key is abc123" or "add my openai key: sk-xxx"
  m = lower.match(/(?:my|add)\s+(binance|bybit|openai|anthropic|claude|coinalyze|brave|serper|earnings|massive|polygon|news|deribit)\s+(?:api\s+)?key\s*(?:is|:|=)?\s*(.+)/i);
  if (m) {
    const svc = m[1].toLowerCase();
    const key = serviceToKey[svc] || (svc.toUpperCase() + '_API_KEY');
    return { key, value: m[2].trim() };
  }

  // "add OPENAI_API_KEY sk-xxx"
  m = message.match(/add\s+([A-Za-z0-9_]+)\s+(.+)/i);
  if (m) return { key: m[1].toUpperCase(), value: m[2].trim() };

  return null;
}

async function listStrategies(): Promise<void> {
  try {
    const strategies = loadStrategies();
    if (strategies.length === 0) {
      console.log('Ysalis> No saved strategies. Use /strategy <text> then /save <id>');
      return;
    }
    console.log(`Ysalis> ${strategies.length} strategy(ies):`);
    strategies.forEach((s) => {
      const cond = (s as ConditionalStrategy).condition;
      const action = (s as ConditionalStrategy).action;
      console.log(`  - ${s.id}: ${action?.symbol} ${action?.action} (enabled: ${s.enabled})`);
    });
  } catch (err) {
    console.log('Ysalis>', (err as Error).message);
  }
}

async function handleUserMessage(
  message: string,
  toolRunner: ToolRunner,
  config: AgentConfig
): Promise<void> {
  const lower = message.toLowerCase();

  // Env/API key: "set my binance api key to xyz", "add ANTHROPIC_API_KEY sk-xxx"
  const envSet = parseEnvSetFromMessage(message);
  if (envSet) {
    try {
      process.stdout.write('Ysalis> ');
      await handleSetEnvVar(toolRunner, envSet.key, envSet.value);
    } catch (err) {
      console.log('Ysalis> Error:', (err as Error).message);
    }
    return;
  }

  // Strategy-like: "bitcoin goes up when...", "take a long", "I notice...", "would be nice to"
  const strategyKeywords = ['goes up', 'goes down', 'take a long', 'go long', 'go short', 'when ', 'if ', 'above ', 'below ', 'would be nice', 'i notice', 'i want to'];
  const looksLikeStrategy = strategyKeywords.some((k) => lower.includes(k));

  if (looksLikeStrategy) {
    try {
      process.stdout.write('Ysalis> Parsing as strategy... ');
      
      // Use Claude for strategy parsing instead of OpenAI
      if (!claudeClient) {
        claudeClient = new ClaudeClient();
      }
      
      const parsed = await claudeClient.parseStrategy(message);
      const strategy = parsedToConditionalStrategy(parsed, {
        id: `strat-${Date.now()}`,
        name: `${parsed.symbol} ${parsed.action}`,
      });
      lastParsedStrategy = { parsed, strategy };
      console.log('\nYsalis> I parsed your idea as:');
      console.log(JSON.stringify(strategy, null, 2));
      console.log('Ysalis> Use /save <id> to save this strategy. Run automated-backend to execute.');
    } catch (err) {
      console.log('\nYsalis> Could not parse as strategy:', (err as Error).message);
      if ((err as Error).message?.includes('API key')) {
        console.log('Ysalis> Set ANTHROPIC_API_KEY in .env for natural language parsing.');
      }
    }
    return;
  }

  // For all other messages, use Claude for natural conversation
  try {
    if (!claudeClient) {
      claudeClient = new ClaudeClient();
    }

    process.stdout.write('Ysalis> ');
    
    // Check if the message seems to need tool usage
    const needsToolUsage = 
      lower.includes('price') || 
      lower.includes('quote') || 
      lower.includes('market') ||
      lower.includes('chart') ||
      lower.includes('news') ||
      lower.includes('sentiment') ||
      lower.includes('liquidation') ||
      lower.includes('funding') ||
      lower.includes('volume') ||
      lower.includes('aave') ||
      lower.includes('defi') ||
      lower.includes('telegram') ||
      lower.includes('reddit') ||
      lower.includes('analysis');

    let toolContext = '';
    
    if (needsToolUsage) {
      // Try to get relevant data using tools
      const symbolMatch = message.match(/\b(BTC|ETH|SOL|ADA|XRP|DOGE|AVAX|LINK|DOT|MATIC|USDT|USDC)\b/i);
      const symbol = symbolMatch?.[1] || 'BTC';
      
      try {
        if (lower.includes('price') || lower.includes('quote')) {
          const result = await toolRunner.callTool('get_comprehensive_quotes', { symbol });
          const text = typeof result === 'object' && result?.content
            ? (result as any).content.find((c: any) => c.type === 'text')?.text
            : JSON.stringify(result, null, 2);
          toolContext = `\n\nCurrent market data for ${symbol}:\n${text}`;
        }
      } catch (err) {
        toolContext = `\n\nNote: Could not fetch current market data (${(err as Error).message})`;
      }
    }

    const response = await claudeClient.sendMessage(
      message + toolContext,
      conversationHistory
    );
    
    console.log(response);
    
    // Update conversation history
    conversationHistory.push({ role: 'user', content: message });
    conversationHistory.push({ role: 'assistant', content: response });
    
    // Keep conversation history manageable (last 10 exchanges)
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }
    
  } catch (err) {
    console.log('Error:', (err as Error).message);
    if ((err as Error).message?.includes('API key')) {
      console.log('Ysalis> Set ANTHROPIC_API_KEY in .env to enable AI conversations.');
      console.log('Ysalis> You can still use /tools and /call commands for crypto data.');
    }
  }
}

// --- Strategy / Execute modes ---

async function runStrategyMode(config: AgentConfig): Promise<void> {
  // Initialize Claude client
  if (!claudeClient) {
    claudeClient = new ClaudeClient();
  }
  
  const args = program.args?.join(' ').trim();
  if (args) {
    await handleStrategyCommand(args, config);
    const strat = lastParsedStrategy;
    if (strat) {
      const id = `strat-${Date.now()}`;
      strat.strategy.id = id;
      upsertStrategy(strat.strategy);
      console.log(`\nSaved as "${id}". Run 'npm run agent -- -m execute' to start automation.`);
    }
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'Strategy> ' });
  console.log('Strategy mode. Enter natural language (e.g. "when BTC > 100k go long"). Empty line to exit.\n');

  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text) {
      console.log('Goodbye.');
      rl.close();
      process.exit(0);
      return;
    }
    await handleStrategyCommand(text, config);
    if (lastParsedStrategy) {
      const id = `strat-${Date.now()}`;
      lastParsedStrategy.strategy.id = id;
      upsertStrategy(lastParsedStrategy.strategy);
      console.log(`Saved as "${id}".`);
    }
    rl.prompt();
  });
  rl.prompt();
}

async function runExecuteMode(config: AgentConfig): Promise<void> {
  const runner = getStrategyRunner();
  const conditional = runner.getStrategiesToExecute();

  if (conditional.length === 0) {
    console.log('No running strategies. Mark strategies as running first:');
    console.log('  - Use strategy dashboard: npm run strategy-dashboard -> run <id>');
    console.log('  - Or set status to "running" in strategies.json');
    console.log('Create strategies with: npm run agent -- -m strategy "when BTC > 100k go long"');
    return;
  }

  console.log(`Running ${conditional.length} strategy(ies), dryRun=${config.dryRun}. Press Ctrl+C to stop.\n`);

  const { TradingClient } = await import('../src/modules/trading/TradingClient.js');
  const client = new TradingClient();

  const balanceFetcher = {
    async fetchUsdtBalance(exchange: string, marketType: string): Promise<number> {
      try {
        const bal = await client.fetchBalance(
          exchange as 'binance' | 'bybit',
          marketType as 'spot' | 'futures'
        );
        return bal.total?.USDT ?? bal.balances?.USDT?.free ?? 0;
      } catch {
        return 0;
      }
    },
  };

  const orderExecutor = config.dryRun
    ? async (params: any) => {
        console.log(`[DRY-RUN] Would: ${params.action} ${params.symbol} on ${params.exchange || 'binance'}`);
      }
    : async (params: any) => {
        const side = params.action === 'long' ? 'buy' : 'sell';
        const exchange = (params.exchange as 'binance' | 'bybit') || 'binance';
        const marketType = params.marketType === 'futures' || params.marketType === 'perp' ? 'futures' : 'spot';
        await client.createMarketOrder(params.symbol, side, params.size ?? 0.001, { exchange, marketType });
        console.log(`[EXECUTED] ${params.action} ${params.symbol} on ${exchange}`);
      };

  const executor = executeConditionalStrategy(
    () => runner.getStrategiesToExecute(),
    {
      dryRun: config.dryRun,
      pollIntervalMs: 30_000,
      orderExecutor,
      balanceFetcher,
    }
  );

  process.on('SIGINT', () => {
    executor.stop();
    process.exit(0);
  });
  process.stdin.resume();
}

// --- Main ---

async function main(): Promise<void> {
  program
    .name('ysalis')
    .description('Ysalis - AI Trading Agent CLI for MCP crypto tools')
    .option(
      '-m, --mode <mode>',
      "Mode: 'chat' | 'strategy' | 'execute'",
      'chat'
    )
    .option(
      '-e, --exchange <exchange>',
      "Exchange: 'binance' | 'bybit' | 'both'",
      'both'
    )
    .option(
      '-k, --market <market>',
      "Market: 'spot' | 'futures' | 'both'",
      'both'
    )
  .option('-d, --dry-run', 'No real orders, simulation only', false)
  .option('-b, --backend-url <url>', 'Backend API URL (e.g. http://localhost:3000)')
  .option('--setup', 'Run first-time setup wizard (or re-run to reconfigure)')
  .parse();

  const opts = program.opts();

  if (opts.setup) {
    await runSetupWizard(true);
    console.log('\nSetup complete. Run "npm run ysalis" to start.\n');
    process.exit(0);
  }

  if (!isSetupComplete()) {
    console.log('\n  Welcome to Ysalis! First-time setup:\n');
    await runSetupWizard(false);
  }

  const saved = loadConfig();
  const mode = (opts.mode || 'chat') as 'chat' | 'strategy' | 'execute';
  const exchange = (opts.exchange || saved?.preferredExchange || 'both') as 'binance' | 'bybit' | 'both';
  const market = (opts.market || saved?.marketType || 'both') as 'spot' | 'futures' | 'both';

  const validModes = ['chat', 'strategy', 'execute'];
  const validExchanges = ['binance', 'bybit', 'both'];
  const validMarkets = ['spot', 'futures', 'both'];

  if (!validModes.includes(mode)) {
    console.error(`Invalid --mode. Must be one of: ${validModes.join(', ')}`);
    process.exit(1);
  }
  if (!validExchanges.includes(exchange)) {
    console.error(`Invalid --exchange. Must be one of: ${validExchanges.join(', ')}`);
    process.exit(1);
  }
  if (!validMarkets.includes(market)) {
    console.error(`Invalid --market. Must be one of: ${validMarkets.join(', ')}`);
    process.exit(1);
  }

  const dryRun = opts.dryRun !== undefined
    ? !!opts.dryRun
    : (saved?.dryRunDefault ?? true);

  const config: AgentConfig = {
    mode,
    exchange,
    market,
    dryRun,
    backendUrl: opts.backendUrl,
  };

  printBanner(config);

  if (mode === 'strategy') {
    await runStrategyMode(config);
    return;
  }
  if (mode === 'execute') {
    await runExecuteMode(config);
    return;
  }

  let toolRunner: ToolRunner;
  try {
    toolRunner = await createToolRunner(config);
  } catch (err) {
    console.error('Failed to initialize ToolRunner:', (err as Error).message);
    process.exit(1);
  }

  try {
    await runChatMode(config, toolRunner);
  } finally {
    if ('close' in toolRunner && typeof toolRunner.close === 'function') {
      await (toolRunner as MCPSubprocessToolRunner).close();
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
