import { BaseCryptoModule } from '../base/module.js';
import { getTokenMetadataFromChain } from './token-metadata.js';
import {
  fetchJupiterTokenList,
  getJupiterQuote,
  getJupiterSwapTransaction,
  type JupiterQuoteResponse,
  type JupiterToken,
} from './jupiter-client.js';

// Common Solana addresses
const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export class SolanaModule extends BaseCryptoModule {
  name = 'solana';
  private tokenListCache: JupiterToken[] | null = null;
  private tokenListCacheTime = 0;
  private readonly TOKEN_LIST_CACHE_MS = 5 * 60 * 1000; // 5 min

  constructor() {
    super();
    this.setupTools();
  }

  private async getTokenList(): Promise<JupiterToken[]> {
    if (this.tokenListCache && Date.now() - this.tokenListCacheTime < this.TOKEN_LIST_CACHE_MS) {
      return this.tokenListCache;
    }
    try {
      this.tokenListCache = await fetchJupiterTokenList(true);
      this.tokenListCacheTime = Date.now();
      return this.tokenListCache;
    } catch {
      // Fallback to all tokens if strict fails
      this.tokenListCache = await fetchJupiterTokenList(false);
      this.tokenListCacheTime = Date.now();
      return this.tokenListCache;
    }
  }

  protected setupTools() {
    // Token metadata - fetch from chain + Jupiter list enrichment
    this.addTool({
      name: 'solana_get_token_metadata',
      description: 'Fetch SPL token metadata (name, symbol, decimals, uri) from Solana chain. Uses getAccountInfo for mint data and Metaplex metadata when available.',
      inputSchema: {
        type: 'object',
        properties: {
          mintAddress: {
            type: 'string',
            description: 'SPL token mint address (base58)',
          },
        },
        required: ['mintAddress'],
      },
      handler: async (args: { mintAddress: string }) => {
        try {
          const chainMeta = await getTokenMetadataFromChain(args.mintAddress);
          // Enrich from Jupiter token list if chain metadata is incomplete
          const tokens = await this.getTokenList();
          const jupToken = tokens.find(
            (t) => t.address.toLowerCase() === args.mintAddress.toLowerCase()
          );
          if (jupToken && (!chainMeta.name || !chainMeta.symbol)) {
            return {
              mintAddress: args.mintAddress,
              name: chainMeta.name ?? jupToken.name,
              symbol: chainMeta.symbol ?? jupToken.symbol,
              decimals: chainMeta.decimals,
              uri: chainMeta.uri ?? jupToken.logoURI ?? null,
              supply: chainMeta.supply,
              source: 'chain_and_jupiter',
            };
          }
          return chainMeta;
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : String(error),
            mintAddress: args.mintAddress,
          };
        }
      },
    });

    // Search token by name/symbol via Jupiter token list
    this.addTool({
      name: 'solana_search_token_by_name',
      description: 'Search for Solana tokens by symbol or name. Uses Jupiter token list (verified tokens).',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Token symbol or name to search (e.g. "SOL", "BONK", "Jupiter")',
          },
          limit: {
            type: 'number',
            description: 'Max results to return',
            default: 20,
          },
          includeAll: {
            type: 'boolean',
            description: 'Include unverified tokens from full Jupiter list',
            default: false,
          },
        },
        required: ['query'],
      },
      handler: async (args: { query: string; limit?: number; includeAll?: boolean }) => {
        try {
          const tokens = await this.getTokenList();
          const q = args.query.toLowerCase().trim();
          const limit = Math.min(args.limit ?? 20, 50);

          const matches = tokens.filter(
            (t) =>
              t.symbol.toLowerCase().includes(q) ||
              t.name.toLowerCase().includes(q) ||
              t.address.toLowerCase() === q
          );

          return {
            tokens: matches.slice(0, limit).map((t) => ({
              address: t.address,
              symbol: t.symbol,
              name: t.name,
              decimals: t.decimals,
              logoURI: t.logoURI,
            })),
            total: matches.length,
            query: args.query,
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : String(error),
            tokens: [],
            query: args.query,
          };
        }
      },
    });

    // Get swap quote only (no execution)
    this.addTool({
      name: 'solana_get_swap_quote',
      description: 'Get a Jupiter swap quote for Solana. Quote only - no execution. Amount is in smallest units (lamports for SOL).',
      inputSchema: {
        type: 'object',
        properties: {
          mintIn: {
            type: 'string',
            description: 'Input token mint (e.g. SOL: So11111111111111111111111111111111111111112)',
          },
          mintOut: {
            type: 'string',
            description: 'Output token mint (e.g. USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)',
          },
          amount: {
            type: 'string',
            description: 'Amount in smallest units (lamports for SOL, e.g. 1000000000 = 1 SOL)',
          },
          slippageBps: {
            type: 'number',
            description: 'Slippage in basis points (50 = 0.5%)',
            default: 50,
          },
        },
        required: ['mintIn', 'mintOut', 'amount'],
      },
      handler: async (args: {
        mintIn: string;
        mintOut: string;
        amount: string;
        slippageBps?: number;
      }) => {
        try {
          const quote = await getJupiterQuote({
            inputMint: args.mintIn,
            outputMint: args.mintOut,
            amount: String(args.amount),
            slippageBps: args.slippageBps ?? 50,
          });
          return {
            inputMint: quote?.inputMint,
            outputMint: quote?.outputMint,
            inAmount: quote?.inAmount,
            outAmount: quote?.outAmount,
            priceImpactPct: quote?.priceImpactPct,
            routePlan: quote?.routePlan,
            note: 'Quote only. Use solana_swap with wallet for execution (phase 2).',
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    });

    // Swap - quote + optional swap transaction (wallet integration phase 2)
    this.addTool({
      name: 'solana_swap',
      description: 'Get Jupiter swap quote and optionally swap transaction. When wallet (public key) is provided, returns serialized transaction to sign. Wallet execution is phase 2 - for now returns quote and transaction data.',
      inputSchema: {
        type: 'object',
        properties: {
          mintIn: {
            type: 'string',
            description: 'Input token mint',
          },
          mintOut: {
            type: 'string',
            description: 'Output token mint',
          },
          amount: {
            type: 'string',
            description: 'Amount in smallest units',
          },
          slippageBps: {
            type: 'number',
            description: 'Slippage in basis points',
            default: 50,
          },
          wallet: {
            type: 'string',
            description: 'Optional: User wallet public key (base58). If provided, returns swap transaction for signing.',
          },
        },
        required: ['mintIn', 'mintOut', 'amount'],
      },
      handler: async (args: {
        mintIn: string;
        mintOut: string;
        amount: string;
        slippageBps?: number;
        wallet?: string;
      }) => {
        try {
          const quote = await getJupiterQuote({
            inputMint: args.mintIn,
            outputMint: args.mintOut,
            amount: String(args.amount),
            slippageBps: args.slippageBps ?? 50,
          });

          if (!quote) {
            return { error: 'No quote available' };
          }

          const result: Record<string, unknown> = {
            quote: {
              inputMint: quote.inputMint,
              outputMint: quote.outputMint,
              inAmount: quote.inAmount,
              outAmount: quote.outAmount,
              priceImpactPct: quote.priceImpactPct,
              routePlan: quote.routePlan,
            },
          };

          if (args.wallet) {
            const swapData = await getJupiterSwapTransaction({
              quoteResponse: quote as JupiterQuoteResponse,
              userPublicKey: args.wallet,
            });
            result.swapTransaction = swapData.swapTransaction;
            result.lastValidBlockHeight = swapData.lastValidBlockHeight;
            result.note =
              'Sign and send swapTransaction. Wallet signing/broadcast integration is phase 2.';
          } else {
            result.note =
              'Quote only. Provide wallet public key to get swap transaction for signing.';
          }

          return result;
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    });
  }
}
