/**
 * Fair Value Gap (FVG) Detector
 * Detects bull and bear FVGs from OHLCV history
 */

export interface OHLCVBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FairValueGap {
  type: 'bull' | 'bear';
  top: number;
  bottom: number;
  midpoint: number;
  strength: number; // 0-1, based on gap size vs ATR or avg range
  timestamp: number; // center candle timestamp
  index: number; // index of center candle (candle 2 in 0,1,2)
  volume: number; // volume of center candle
}

/**
 * Detect Fair Value Gaps in OHLCV data.
 * Bull FVG: low of candle 3 > high of candle 1
 * Bear FVG: high of candle 3 < low of candle 1
 */
export function detectFairValueGaps(ohlcv: OHLCVBar[]): FairValueGap[] {
  const gaps: FairValueGap[] = [];

  if (!ohlcv || ohlcv.length < 3) {
    return gaps;
  }

  // Compute average range for strength scoring
  const ranges = ohlcv.slice(0, Math.min(100, ohlcv.length)).map((c) => c.high - c.low);
  const avgRange = ranges.length > 0 ? ranges.reduce((a, b) => a + b, 0) / ranges.length : 1;

  for (let i = 2; i < ohlcv.length; i++) {
    const c0 = ohlcv[i - 2];
    const c1 = ohlcv[i - 1];
    const c2 = ohlcv[i];

    // Bull FVG: low of candle 3 > high of candle 1
    if (c2.low > c0.high) {
      const top = c2.low;
      const bottom = c0.high;
      const gapSize = top - bottom;
      const strength = Math.min(1, gapSize / Math.max(avgRange * 0.5, 0.0001));

      gaps.push({
        type: 'bull',
        top,
        bottom,
        midpoint: (top + bottom) / 2,
        strength: Math.round(strength * 100) / 100,
        timestamp: c1.timestamp,
        index: i - 1,
        volume: c1.volume,
      });
    }

    // Bear FVG: high of candle 3 < low of candle 1
    if (c2.high < c0.low) {
      const top = c0.low;
      const bottom = c2.high;
      const gapSize = top - bottom;
      const strength = Math.min(1, gapSize / Math.max(avgRange * 0.5, 0.0001));

      gaps.push({
        type: 'bear',
        top,
        bottom,
        midpoint: (top + bottom) / 2,
        strength: Math.round(strength * 100) / 100,
        timestamp: c1.timestamp,
        index: i - 1,
        volume: c1.volume,
      });
    }
  }

  return gaps;
}
