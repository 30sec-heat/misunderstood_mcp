/**
 * Correlation analysis between two symbols' returns
 * Uses Pearson correlation of close-price returns
 */

export interface OHLCVBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CorrelationResult {
  correlation: number;
  period: number;
  symbol1: string;
  symbol2: string;
  interpretation: string;
}

/**
 * Compute Pearson correlation of returns between two OHLCV series.
 * Aligns by timestamp and uses overlapping periods.
 */
export function computeSymbolCorrelation(
  ohlcv1: OHLCVBar[],
  ohlcv2: OHLCVBar[],
  symbol1: string,
  symbol2: string
): CorrelationResult {
  // Build map by timestamp for alignment
  const map1 = new Map<number, number>();
  const map2 = new Map<number, number>();
  for (const c of ohlcv1) map1.set(c.timestamp, c.close);
  for (const c of ohlcv2) map2.set(c.timestamp, c.close);

  const commonTs = [...map1.keys()].filter((ts) => map2.has(ts));
  commonTs.sort((a, b) => a - b);

  if (commonTs.length < 2) {
    return {
      correlation: 0,
      period: 0,
      symbol1,
      symbol2,
      interpretation: 'Insufficient overlapping data for correlation',
    };
  }

  const closes1: number[] = [];
  const closes2: number[] = [];
  for (const ts of commonTs) {
    closes1.push(map1.get(ts)!);
    closes2.push(map2.get(ts)!);
  }

  // Compute returns
  const returns1: number[] = [];
  const returns2: number[] = [];
  for (let i = 1; i < closes1.length; i++) {
    const r1 = (closes1[i] - closes1[i - 1]) / (closes1[i - 1] || 1);
    const r2 = (closes2[i] - closes2[i - 1]) / (closes2[i - 1] || 1);
    returns1.push(r1);
    returns2.push(r2);
  }

  const n = returns1.length;
  if (n < 2) {
    return {
      correlation: 0,
      period: n,
      symbol1,
      symbol2,
      interpretation: 'Insufficient data points for correlation',
    };
  }

  const mean1 = returns1.reduce((a, b) => a + b, 0) / n;
  const mean2 = returns2.reduce((a, b) => a + b, 0) / n;

  let cov = 0;
  let var1 = 0;
  let var2 = 0;
  for (let i = 0; i < n; i++) {
    const d1 = returns1[i] - mean1;
    const d2 = returns2[i] - mean2;
    cov += d1 * d2;
    var1 += d1 * d1;
    var2 += d2 * d2;
  }

  const denom = Math.sqrt(var1 * var2);
  const correlation = denom > 0 ? cov / denom : 0;
  const corrRounded = Math.round(correlation * 1000) / 1000;

  let interpretation: string;
  if (Math.abs(corrRounded) >= 0.7) {
    interpretation = `Strong ${corrRounded > 0 ? 'positive' : 'negative'} correlation - assets tend to move together${corrRounded < 0 ? ' inversely' : ''}.`;
  } else if (Math.abs(corrRounded) >= 0.4) {
    interpretation = `Moderate ${corrRounded > 0 ? 'positive' : 'negative'} correlation.`;
  } else if (Math.abs(corrRounded) >= 0.2) {
    interpretation = `Weak ${corrRounded > 0 ? 'positive' : 'negative'} correlation.`;
  } else {
    interpretation = 'Low correlation - assets move largely independently.';
  }

  return {
    correlation: corrRounded,
    period: n,
    symbol1,
    symbol2,
    interpretation,
  };
}
