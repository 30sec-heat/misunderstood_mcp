# Solana Module

Solana integration for the trading agent: token metadata, search, and Jupiter swap quotes.

## Tools

### `solana_get_token_metadata`
Fetch SPL token metadata (name, symbol, decimals, uri) from chain. Uses `getAccountInfo` + Metaplex metadata parsing, enriched by Jupiter token list when needed.

- **Input**: `{ mintAddress: string }`

### `solana_search_token_by_name`
Search for tokens by symbol or name using Jupiter token list.

- **Input**: `{ query: string, limit?: number, includeAll?: boolean }`

### `solana_get_swap_quote`
Get a Jupiter swap quote (quote only, no execution).

- **Input**: `{ mintIn, mintOut, amount, slippageBps? }`
- **amount**: Raw amount in smallest units (lamports for SOL)

### `solana_swap`
Get quote and optionally swap transaction. When `wallet` (public key) is provided, returns serialized transaction for signing. Wallet signing/broadcast is phase 2.

- **Input**: `{ mintIn, mintOut, amount, slippageBps?, wallet? }`

## Environment

- `SOLANA_RPC_URL`: Optional. Default: `https://api.mainnet-beta.solana.com`
- Jupiter API: No key required for public quote/swap endpoints

## Common Addresses

- SOL: `So11111111111111111111111111111111111111112`
- USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
