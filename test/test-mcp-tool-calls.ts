#!/usr/bin/env node
/**
 * Calls several Deribit MCP tools over stdio (same transport as Cursor).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const tsxCli = join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const serverEntry = join(projectRoot, 'mcp-server-socket.ts');

const calls: Array<{ name: string; args: Record<string, unknown> }> = [
  { name: 'deribit_get_option_chain', args: { currency: 'BTC', include_greeks: false } },
  { name: 'deribit_analyze_iv', args: { currency: 'BTC' } },
  {
    name: 'deribit_analyze_option_flows',
    args: { currency: 'BTC', hours_back: 6, min_premium_usd: 50_000, max_pages: 30 },
  },
  {
    name: 'deribit_calculate_price_probabilities',
    args: { currency: 'BTC', target_prices: [90000, 100000], time_horizon: 30 },
  },
];

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [tsxCli, serverEntry],
    env: { ...process.env },
    stderr: 'inherit',
  });

  const client = new Client(
    { name: 'tool-call-tester', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  await client.connect(transport);

  const { tools } = await client.listTools();
  console.log(`Listed ${tools.length} tools\n`);

  for (const { name, args } of calls) {
    process.stdout.write(`→ ${name} ... `);
    const start = Date.now();
    const result = await client.callTool({ name, arguments: args });
    const ms = Date.now() - start;
    const text =
      result.content?.[0]?.type === 'text'
        ? (result.content[0] as { text: string }).text.slice(0, 200)
        : JSON.stringify(result).slice(0, 200);
    console.log(`ok (${ms}ms)\n  preview: ${text.replace(/\s+/g, ' ').trim()}...\n`);
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
