/**
 * Solana token metadata fetching via chain (getParsedAccountInfo) and Jupiter token list.
 * SPL token mint accounts contain decimals; name/symbol/uri from Metaplex metadata or Jupiter list.
 */

import { Connection, PublicKey } from '@solana/web3.js';

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

export interface TokenMetadata {
  mintAddress: string;
  name: string | null;
  symbol: string | null;
  decimals: number;
  uri: string | null;
  supply?: string;
  source: 'chain' | 'jupiter' | 'chain_and_jupiter';
}

/**
 * Parse Metaplex metadata account (simplified - extracts name, symbol, uri)
 * Layout: discriminator(1) + update_authority(32) + mint(32) + name_len(4) + name + symbol_len(4) + symbol + uri_len(4) + uri + ...
 */
function parseMetaplexMetadata(data: Buffer): { name: string; symbol: string; uri: string } | null {
  try {
    if (data.length < 69) return null;
    let offset = 1 + 32 + 32; // skip discriminator, update_authority, mint

    const readString = (): string => {
      if (offset + 4 > data.length) return '';
      const len = data.readUInt32LE(offset);
      offset += 4;
      if (offset + len > data.length) return '';
      const str = data.subarray(offset, offset + len).toString('utf8');
      offset += len;
      return str.trim();
    };

    const name = readString();
    const symbol = readString();
    const uri = readString();
    return { name: name || 'Unknown', symbol: symbol || 'Unknown', uri: uri || '' };
  } catch {
    return null;
  }
}

/**
 * Derive Metaplex metadata PDA for a mint
 */
function getMetadataPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METAPLEX_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METAPLEX_PROGRAM_ID
  );
}

/**
 * Fetch token metadata from chain (Solana RPC) and optionally enrich from Jupiter list
 */
export async function getTokenMetadataFromChain(
  mintAddress: string,
  connection?: Connection
): Promise<TokenMetadata> {
  const conn = connection || new Connection(SOLANA_RPC);
  const mint = new PublicKey(mintAddress);

  // 1. Get parsed mint account for decimals and supply
  const mintInfo = await conn.getParsedAccountInfo(mint);
  if (!mintInfo || !mintInfo.value) {
    throw new Error(`Token mint not found: ${mintAddress}`);
  }

  const parsed = (mintInfo.value as any).data?.parsed;
  if (!parsed || parsed.type !== 'mint') {
    throw new Error(`Invalid token mint account: ${mintAddress}`);
  }

  const decimals = parsed.info.decimals ?? 0;
  const supply = parsed.info.supply;

  let name: string | null = null;
  let symbol: string | null = null;
  let uri: string | null = null;

  // 2. Try to fetch Metaplex metadata for name/symbol/uri
  try {
    const [metadataPDA] = getMetadataPDA(mint);
    const metadataAccount = await conn.getAccountInfo(metadataPDA);
    if (metadataAccount?.data) {
      const parsedMeta = parseMetaplexMetadata(metadataAccount.data);
      if (parsedMeta) {
        name = parsedMeta.name;
        symbol = parsedMeta.symbol;
        uri = parsedMeta.uri || null;
      }
    }
  } catch {
    // Metaplex metadata not found or parse failed - leave name/symbol/uri empty
  }

  return {
    mintAddress,
    name,
    symbol,
    decimals,
    uri,
    supply: supply != null ? String(supply) : undefined,
    source: name ? 'chain' : 'chain',
  };
}
