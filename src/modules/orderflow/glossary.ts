/**
 * Order Flow Terminology & Concepts - Glossary for LLM context
 * Used by get_orderflow_glossary MCP tool
 */

export interface OrderFlowTerm {
  term: string;
  definition: string;
  formula?: string;
  interpretation?: string;
}

export const ORDERFLOW_GLOSSARY: OrderFlowTerm[] = [
  {
    term: 'Fair Value Gap (FVG)',
    definition:
      'A 3-candle imbalance pattern representing inefficient price discovery. Bull FVG: low of candle 3 > high of candle 1. Bear FVG: high of candle 3 < low of candle 1.',
    formula: 'Bull FVG: low[2] > high[0]. Bear FVG: high[2] < low[0]',
    interpretation:
      'FVGs often act as magnets for price. Unfilled FVGs suggest potential zones for mean reversion or continuation.',
  },
  {
    term: 'Liquidity Pools / Sweep Zones',
    definition:
      'Areas where stop-losses cluster (above swing highs for shorts, below swing lows for longs). Price often "sweeps" or "stops hunts" these levels before reversing.',
    interpretation:
      'Identifying liquidity sweeps helps anticipate reversal zones. A sweep + structure break = high-probability entry.',
  },
  {
    term: 'Order Blocks',
    definition:
      'The last opposing candle before a strong move. Bullish OB: last down candle before rally. Bearish OB: last up candle before selloff. Represents institutional order flow.',
    interpretation:
      'Fresh, unmitigated order blocks at key levels offer high-probability trade setups.',
  },
  {
    term: 'Imbalance Zones',
    definition:
      'Broad term for areas where buy/sell pressure was disproportionate - includes FVGs, order blocks, and gaps. Price often returns to "balance" these zones.',
    interpretation:
      'Multiple imbalances stacking at one level increase significance.',
  },
  {
    term: 'BOS (Break of Structure)',
    definition:
      'Price breaks a prior swing high (bullish BOS) or swing low (bearish BOS), confirming trend continuation. Indicates market structure shift in favor of the direction.',
    interpretation:
      'BOS validates trend. Consecutive BOS in same direction = strong trend.',
  },
  {
    term: 'CHoCH (Change of Character)',
    definition:
      'Price breaks a swing in the opposite direction of the prior trend - first sign of potential reversal. Bullish CHoCH: break above prior high in downtrend. Bearish CHoCH: break below prior low in uptrend.',
    interpretation:
      'CHoCH suggests trend may be exhausted. Often precedes BOS in new direction.',
  },
  {
    term: 'Market Structure',
    definition:
      'The series of higher highs/higher lows (uptrend) or lower highs/lower lows (downtrend). Structure defines the dominant trend.',
    interpretation:
      'Trade in direction of structure for higher probability. CHoCH marks potential shift.',
  },
  {
    term: 'Mitigation / FVG Fill',
    definition:
      'When price returns to and trades through an imbalance zone (FVG, order block). Mitigation can invalidate the zone or, if followed by rejection, confirm it as support/resistance.',
    interpretation:
      'Partially mitigated zones may still be valid. Fully filled = zone consumed.',
  },
  {
    term: 'Liquidity Grab',
    definition:
      'A brief move beyond a key level (high/low) to trigger stops, followed by reversal. Often appears as wicks or "wick sweeps."',
    interpretation:
      'Liquidity grabs before FVG fills or at order blocks create high-probability entries.',
  },
  {
    term: 'Premium / Discount',
    definition:
      'Premium: price above the mean (e.g., above equilibrium or 50% of range). Discount: price below the mean. SMC traders often sell in premium, buy in discount.',
    interpretation:
      'Confluence of discount + bullish structure = buy. Premium + bearish structure = sell.',
  },
];

export function getOrderFlowGlossary(): { terms: OrderFlowTerm[]; count: number } {
  return {
    terms: ORDERFLOW_GLOSSARY,
    count: ORDERFLOW_GLOSSARY.length,
  };
}
