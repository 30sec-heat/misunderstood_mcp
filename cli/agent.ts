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

// Strategy automation
import {
  parseNaturalLanguageStrategy,
  parsedToConditionalStrategy,
  loadStrategies,
  upsertStrategy,
  executeConditionalStrategy,
  type ConditionalStrategy,
} from '../src/strategy/index.js';

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
      { name: 'ai-trading-agent', version: '1.0.0' },
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
║           AI Trading Agent - MCP Crypto Server               ║
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
  /strategy <text>    Parse natural language into a strategy (e.g. "when BTC > 100k go long")
  /strategies         List saved strategies
  /save <id>          Save last parsed strategy with given id
  /help               Show this help
  /exit or Ctrl+C     Exit

Multi-line input: Enter empty line to send your message.
Strategy examples: "bitcoin goes up when xyz, take a long" | "when ETH drops 5% go short"
`);
  }
}

// --- Chat mode: interactive readline ---

/** Last parsed strategy (for /save) */
let lastParsedStrategy: { parsed: any; strategy: ConditionalStrategy } | null = null;

async function runChatMode(config: AgentConfig, toolRunner: ToolRunner): Promise<void> {
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
            console.log('Agent> Usage: /call <toolName> [json-args]');
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
            console.log(`Agent> Saved strategy as "${id}"`);
          } else {
            console.log('Agent> No strategy to save. Use /strategy <text> first.');
          }
          break;
        }
        default:
          console.log(`Agent> Unknown command: ${cmd}. Type /help for commands.`);
      }
      rl.prompt();
      return;
    }

    buffer.push(line);
    rl.prompt();
  };

  rl.on('line', (line) => {
    processInput(line).catch((err) => {
      console.error('Agent> Error:', err.message);
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
      console.log('Agent> Available tools:');
      (tools as any[]).forEach((t) => console.log(`  - ${t.name}: ${t.description || ''}`));
      return;
    }
    console.log('Agent> Tool listing not available. Try /call get_comprehensive_quotes \'{"symbol":"BTC"}\'');
  } catch (err) {
    console.log('Agent>', (err as Error).message);
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
      console.log('Agent> Invalid JSON arguments. Example: \'{"symbol":"BTC"}\'');
      return;
    }
  }
  try {
    process.stdout.write('Agent> ');
    const result = await toolRunner.callTool(name, args);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.log('Agent> Error:', (err as Error).message);
  }
}

async function handleStrategyCommand(arg: string, config: AgentConfig): Promise<void> {
  const text = arg.trim();
  if (!text) {
    console.log('Agent> Usage: /strategy <natural language>');
    console.log('Agent> Example: /strategy when bitcoin goes above 100k I want to go long');
    return;
  }
  try {
    process.stdout.write('Agent> Parsing... ');
    const parsed = await parseNaturalLanguageStrategy(text);
    const strategy = parsedToConditionalStrategy(parsed, {
      id: `strat-${Date.now()}`,
      name: `${parsed.symbol} ${parsed.action} (${parsed.condition.type})`,
    });
    lastParsedStrategy = { parsed, strategy };
    console.log('\nAgent> Parsed strategy:');
    console.log(JSON.stringify(strategy, null, 2));
    console.log('Agent> Use /save <id> to save, or /strategy with new text.');
  } catch (err) {
    console.log('\nAgent> Error:', (err as Error).message);
    if ((err as Error).message?.includes('OPENAI_API_KEY')) {
      console.log('Agent> Set OPENAI_API_KEY in .env for natural language parsing.');
    }
  }
}

async function listStrategies(): Promise<void> {
  try {
    const strategies = loadStrategies();
    if (strategies.length === 0) {
      console.log('Agent> No saved strategies. Use /strategy <text> then /save <id>');
      return;
    }
    console.log(`Agent> ${strategies.length} strategy(ies):`);
    strategies.forEach((s) => {
      const cond = (s as ConditionalStrategy).condition;
      const action = (s as ConditionalStrategy).action;
      console.log(`  - ${s.id}: ${action?.symbol} ${action?.action} (enabled: ${s.enabled})`);
    });
  } catch (err) {
    console.log('Agent>', (err as Error).message);
  }
}

async function handleUserMessage(
  message: string,
  toolRunner: ToolRunner,
  config: AgentConfig
): Promise<void> {
  const lower = message.toLowerCase();
  const symbolMatch = message.match(/\b(BTC|ETH|SOL|ADA|XRP|DOGE|AVAX|LINK|DOT|MATIC|USDT|USDC)\b/i);
  const symbol = symbolMatch?.[1] || 'BTC';

  // Strategy-like: "bitcoin goes up when...", "take a long", "I notice...", "would be nice to"
  const strategyKeywords = ['goes up', 'goes down', 'take a long', 'go long', 'go short', 'when ', 'if ', 'above ', 'below ', 'would be nice', 'i notice', 'i want to'];
  const looksLikeStrategy = strategyKeywords.some((k) => lower.includes(k));

  if (looksLikeStrategy) {
    try {
      process.stdout.write('Agent> Parsing as strategy... ');
      const parsed = await parseNaturalLanguageStrategy(message);
      const strategy = parsedToConditionalStrategy(parsed, {
        id: `strat-${Date.now()}`,
        name: `${parsed.symbol} ${parsed.action}`,
      });
      lastParsedStrategy = { parsed, strategy };
      console.log('\nAgent> I parsed your idea as:');
      console.log(JSON.stringify(strategy, null, 2));
      console.log('Agent> Use /save <id> to save this strategy. Run automated-backend to execute.');
    } catch (err) {
      console.log('\nAgent> Could not parse as strategy:', (err as Error).message);
      if ((err as Error).message?.includes('OPENAI_API_KEY')) {
        console.log('Agent> Set OPENAI_API_KEY in .env for natural language parsing.');
      }
    }
    return;
  }

  if (lower.includes('price') || lower.includes('quote') || lower.includes('get')) {
    try {
      process.stdout.write('Agent> ');
      const result = await toolRunner.callTool('get_comprehensive_quotes', { symbol });
      const text =
        typeof result === 'object' && result?.content
          ? (result as any).content.find((c: any) => c.type === 'text')?.text
          : null;
      console.log(text || JSON.stringify(result, null, 2));
    } catch {
      console.log(
        `Agent> I can help with quotes. Try: /call get_comprehensive_quotes '{"symbol":"${symbol}"}'`
      );
    }
    return;
  }

  console.log(
    `Agent> Say "get price of BTC", describe a strategy ("when BTC > 100k go long"), or use /tools for commands.`
  );
}

// --- Strategy / Execute modes ---

async function runStrategyMode(config: AgentConfig): Promise<void> {
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
  const strategies = loadStrategies();
  const conditional = strategies.filter(
    (s): s is ConditionalStrategy => s.strategyType === 'conditional' && s.enabled
  );

  if (conditional.length === 0) {
    console.log('No enabled strategies. Create with: npm run agent -- -m strategy "when BTC > 100k go long"');
    return;
  }

  console.log(`Running ${conditional.length} strategy(ies), dryRun=${config.dryRun}. Press Ctrl+C to stop.\n`);

  const { TradingClient } = await import('../src/modules/trading/TradingClient.js');
  const client = new TradingClient();

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

  const executor = executeConditionalStrategy(conditional, {
    dryRun: config.dryRun,
    pollIntervalMs: 30_000,
    orderExecutor,
  });

  process.on('SIGINT', () => {
    executor.stop();
    process.exit(0);
  });
  process.stdin.resume();
}

// --- Main ---

async function main(): Promise<void> {
  program
    .name('agent')
    .description('AI Trading Agent - CLI for MCP crypto tools')
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
    .parse();

  const opts = program.opts();
  const mode = (opts.mode || 'chat') as 'chat' | 'strategy' | 'execute';
  const exchange = (opts.exchange || 'both') as 'binance' | 'bybit' | 'both';
  const market = (opts.market || 'both') as 'spot' | 'futures' | 'both';

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

  const config: AgentConfig = {
    mode,
    exchange,
    market,
    dryRun: !!opts.dryRun,
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
