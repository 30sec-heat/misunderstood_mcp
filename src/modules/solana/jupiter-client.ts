/**
 * Jupiter API client for Solana swap quotes and token data.
 * Docs: https://station.jup.ag/docs/apis/swap-api
 */

// Jupiter Swap API - https://station.jup.ag/docs/api/quote
const JUPITER_QUOTE_URL = 'https://api.jup.ag/swap/v1/quote';
const JUPITER_SWAP_URL = 'https://api.jup.ag/swap/v1/swap';
const JUPITER_TOKEN_LIST_URL = 'https://token.jup.ag/strict'; // Verified tokens
const JUPITER_TOKEN_LIST_ALL_URL = 'https://token.jup.ag/all'; // All tokens

export interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string; // Raw amount in smallest units (lamports for SOL)
  slippageBps?: number; // Basis points, e.g. 50 = 0.5%
  onlyDirectRoutes?: boolean;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct?: string;
  routePlan?: Array<{
    swapInfo: { ammKey: string; label: string };
    percent: number;
  }>;
  contextSlot?: number;
  timeTaken?: number;
}

export interface JupiterSwapParams {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
}

/**
 * Fetch Jupiter token list (verified tokens by default)
 */
export async function fetchJupiterTokenList(useStrict = true): Promise<JupiterToken[]> {
  const url = useStrict ? JUPITER_TOKEN_LIST_URL : JUPITER_TOKEN_LIST_ALL_URL;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Jupiter token list fetch failed: ${res.status}`);
  const data = await res.json();
  // Token list can be array or {tokens: [...]}
  const arr = Array.isArray(data) ? data : data?.tokens ?? data?.data ?? [];
  return arr.map((t: any) => ({
    address: t.address ?? t.id ?? t.mint,
    symbol: t.symbol ?? 'UNKNOWN',
    name: t.name ?? 'Unknown',
    decimals: t.decimals ?? 6,
    logoURI: t.logoURI ?? t.icon,
    tags: t.tags,
  })).filter((t: JupiterToken) => t.address);
}

/**
 * Get swap quote from Jupiter API
 */
export async function getJupiterQuote(params: JupiterQuoteParams): Promise<JupiterQuoteResponse | null> {
  const searchParams = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
  });
  if (params.slippageBps != null) searchParams.set('slippageBps', String(params.slippageBps));
  if (params.onlyDirectRoutes) searchParams.set('onlyDirectRoutes', 'true');

  const res = await fetch(`${JUPITER_QUOTE_URL}?${searchParams}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter quote failed: ${res.status} - ${text}`);
  }
  return res.json();
}

/**
 * Get swap transaction from Jupiter (requires user public key)
 * Returns serialized transaction for user to sign and send.
 */
export async function getJupiterSwapTransaction(params: JupiterSwapParams): Promise<{
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}> {
  const res = await fetch(JUPITER_SWAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      quoteResponse: params.quoteResponse,
      userPublicKey: params.userPublicKey,
      wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter swap failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  return {
    swapTransaction: data.swapTransaction,
    lastValidBlockHeight: data.lastValidBlockHeight,
    prioritizationFeeLamports: data.prioritizationFeeLamports,
  };
}
