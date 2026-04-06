/**
 * Aggregates Deribit option prints + open interest into desk-style summaries.
 * Uses public trade tape only (no counterparty / OTC labels).
 */

import type { DeribitPublicTrade, DeribitOption } from './DeribitAPIClient.js';
import type { VolatilityAnalysis } from './OptionsAnalyzer.js';

export interface ParsedInstrument {
  base: string;
  expiry: string;
  strike: number;
  option_type: 'call' | 'put';
}

export interface FlowReport {
  currency: string;
  spot_usd: number;
  window: { start_iso: string; end_iso: string; hours: number };
  data_quality: {
    trade_rows_ingested: number;
    api_pages: number;
    tape_truncated: boolean;
    caveats: string[];
  };
  flow_summary: {
    put_contracts_bought: number;
    put_contracts_sold: number;
    put_net_bought: number;
    call_contracts_bought: number;
    call_contracts_sold: number;
    call_net_bought: number;
    premium_usd_buy_total: number;
    premium_usd_sell_total: number;
    block_trade_prints: number;
    block_premium_usd_buy: number;
    combo_leg_prints: number;
  };
  skew_and_vol_snapshot: {
    nearest_expiry?: string;
    atm_iv_percent?: number;
    /** OTM put minus OTM call IV, in percentage points (vol points) */
    otm_put_minus_call_iv_vol_points?: number;
    vol_insight_line?: string;
  };
  strike_attention: {
    put_strikes_by_abs_net: Array<{
      expiry: string;
      strike: number;
      net_bought_contracts: number;
      bought: number;
      sold: number;
    }>;
    call_strikes_by_abs_net: Array<{
      expiry: string;
      strike: number;
      net_bought_contracts: number;
      bought: number;
      sold: number;
    }>;
  };
  open_interest_highlights: {
    top_put_oi: Array<{
      instrument_name: string;
      expiry: string;
      strike: number;
      open_interest: number;
      volume_24h: number;
    }>;
    top_call_oi: Array<{
      instrument_name: string;
      expiry: string;
      strike: number;
      open_interest: number;
      volume_24h: number;
    }>;
  };
  notable_prints: Array<{
    utc_iso: string;
    session_note: string;
    instrument_name: string;
    direction: string;
    contracts: number;
    premium_usd: number;
    underlying_notional_usd: number;
    execution_note: string;
    iv?: number;
  }>;
  narratives: {
    tldr_eli12: string;
    flows_paragraph: string;
    bullet_highlights: string[];
  };
}

function parseInstrument(name: string): ParsedInstrument | null {
  const parts = name.split('-');
  if (parts.length < 4) return null;
  const strike = parseFloat(parts[2]);
  if (Number.isNaN(strike)) return null;
  const o = parts[3];
  if (o !== 'C' && o !== 'P') return null;
  return {
    base: parts[0],
    expiry: parts[1],
    strike,
    option_type: o === 'C' ? 'call' : 'put'
  };
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}m`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function sessionNote(ts: number): string {
  const d = new Date(ts);
  const wd = d.toLocaleString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  const hm = d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
  const hour = d.getUTCHours();
  let band = 'off_hours_utc';
  if (hour >= 22 || hour <= 6) band = 'apac_weighted_hours_utc';
  else if (hour >= 7 && hour <= 13) band = 'europe_morning_utc';
  else if (hour >= 14 && hour <= 21) band = 'us_hours_utc';
  return `${wd} ${hm} UTC (${band})`;
}

function premiumUsd(t: DeribitPublicTrade): number {
  return t.amount * t.price * t.index_price;
}

function underlyingNotionalUsd(t: DeribitPublicTrade): number {
  return t.amount * t.index_price;
}

export class OptionFlowAnalyzer {
  static buildReport(params: {
    currency: 'BTC' | 'ETH';
    spot: number;
    hours: number;
    startMs: number;
    endMs: number;
    trades: DeribitPublicTrade[];
    truncated: boolean;
    pages: number;
    chainOptions: DeribitOption[];
    volAnalysis: VolatilityAnalysis;
    minPremiumUsd: number;
  }): FlowReport {
    const caveats: string[] = [
      'Public tape only: no counterparty, no OTC vs screen classification; block_trade_id means packaged print on Deribit.',
      'Premium is mark-to-index at print time (amount × option price in coin × index); not exchange-reported "fees paid".',
      'Open interest is a snapshot (no historical OI change) unless you persist snapshots yourself.'
    ];
    if (params.truncated) {
      caveats.unshift('Trade tape pagination stopped early; flows may under-count very active windows. Increase max_pages or shorten hours_back.');
    }

    const flow = {
      put_contracts_bought: 0,
      put_contracts_sold: 0,
      put_net_bought: 0,
      call_contracts_bought: 0,
      call_contracts_sold: 0,
      call_net_bought: 0,
      premium_usd_buy_total: 0,
      premium_usd_sell_total: 0,
      block_trade_prints: 0,
      block_premium_usd_buy: 0,
      combo_leg_prints: 0
    };

    type StrikeAgg = { expiry: string; strike: number; bought: number; sold: number };
    const putMap = new Map<string, StrikeAgg>();
    const callMap = new Map<string, StrikeAgg>();

    const strikesKey = (e: string, k: number, kind: 'P' | 'C') => `${e}:${k}:${kind}`;

    for (const t of params.trades) {
      const p = parseInstrument(t.instrument_name);
      if (!p) continue;

      const prem = premiumUsd(t);
      if (t.direction === 'buy') {
        flow.premium_usd_buy_total += prem;
        if (p.option_type === 'put') {
          flow.put_contracts_bought += t.amount;
        } else {
          flow.call_contracts_bought += t.amount;
        }
      } else {
        flow.premium_usd_sell_total += prem;
        if (p.option_type === 'put') {
          flow.put_contracts_sold += t.amount;
        } else {
          flow.call_contracts_sold += t.amount;
        }
      }

      if (t.block_trade_id) {
        flow.block_trade_prints += 1;
        if (t.direction === 'buy') flow.block_premium_usd_buy += prem;
      }
      if (t.combo_id) flow.combo_leg_prints += 1;

      const smap = p.option_type === 'put' ? putMap : callMap;
      const key = strikesKey(p.expiry, p.strike, p.option_type === 'put' ? 'P' : 'C');
      if (!smap.has(key)) {
        smap.set(key, { expiry: p.expiry, strike: p.strike, bought: 0, sold: 0 });
      }
      const row = smap.get(key)!;
      if (t.direction === 'buy') row.bought += t.amount;
      else row.sold += t.amount;
    }

    flow.put_net_bought = flow.put_contracts_bought - flow.put_contracts_sold;
    flow.call_net_bought = flow.call_contracts_bought - flow.call_contracts_sold;

    const strikeList = (m: Map<string, StrikeAgg>) =>
      [...m.values()]
        .map((r) => ({
          expiry: r.expiry,
          strike: r.strike,
          bought: r.bought,
          sold: r.sold,
          net_bought_contracts: r.bought - r.sold
        }))
        .sort((a, b) => Math.abs(b.net_bought_contracts) - Math.abs(a.net_bought_contracts))
        .slice(0, 12);

    const notable = [...params.trades]
      .map((t) => ({
        t,
        prem: premiumUsd(t),
        notional: underlyingNotionalUsd(t)
      }))
      .filter((x) => x.prem >= params.minPremiumUsd)
      .sort((a, b) => b.prem - a.prem)
      .slice(0, 15)
      .map(({ t, prem, notional }) => {
        const exec = t.block_trade_id
          ? `Block print (id ${t.block_trade_id}${t.block_trade_leg_count ? `, legs ${t.block_trade_leg_count}` : ''})`
          : 'Screen / uncategorized package';
        return {
          utc_iso: new Date(t.timestamp).toISOString(),
          session_note: sessionNote(t.timestamp),
          instrument_name: t.instrument_name,
          direction: t.direction,
          contracts: t.amount,
          premium_usd: prem,
          underlying_notional_usd: notional,
          execution_note: exec,
          iv: t.iv
        };
      });

    const putsOi = params.chainOptions
      .filter((o) => o.option_type === 'put' && o.open_interest > 0)
      .sort((a, b) => b.open_interest - a.open_interest)
      .slice(0, 12)
      .map((o) => ({
        instrument_name: o.instrument_name,
        expiry: o.instrument_name.split('-')[1],
        strike: o.strike,
        open_interest: o.open_interest,
        volume_24h: o.stats?.volume_24h ?? o.volume ?? 0
      }));

    const callsOi = params.chainOptions
      .filter((o) => o.option_type === 'call' && o.open_interest > 0)
      .sort((a, b) => b.open_interest - a.open_interest)
      .slice(0, 12)
      .map((o) => ({
        instrument_name: o.instrument_name,
        expiry: o.instrument_name.split('-')[1],
        strike: o.strike,
        open_interest: o.open_interest,
        volume_24h: o.stats?.volume_24h ?? o.volume ?? 0
      }));

    const term = [...params.volAnalysis.term_structure].sort(
      (a, b) => a.days_to_expiry - b.days_to_expiry
    );
    const front = term[0];
    const skewSnippet: FlowReport['skew_and_vol_snapshot'] = {
      nearest_expiry: front?.expiry,
      atm_iv_percent: front ? front.atm_iv * 100 : undefined,
      otm_put_minus_call_iv_vol_points: front ? front.iv_skew * 100 : undefined,
      vol_insight_line: params.volAnalysis.key_insights?.[0]
    };

    const tldr = OptionFlowAnalyzer.buildTldr(flow, strikeList(putMap), skewSnippet);
    const paragraph = OptionFlowAnalyzer.buildFlowsParagraph(
      params,
      flow,
      strikeList(putMap),
      notable
    );
    const bullets = OptionFlowAnalyzer.buildBullets(flow, notable, putsOi);

    return {
      currency: params.currency,
      spot_usd: params.spot,
      window: {
        hours: params.hours,
        start_iso: new Date(params.startMs).toISOString(),
        end_iso: new Date(params.endMs).toISOString()
      },
      data_quality: {
        trade_rows_ingested: params.trades.length,
        api_pages: params.pages,
        tape_truncated: params.truncated,
        caveats
      },
      flow_summary: flow,
      skew_and_vol_snapshot: skewSnippet,
      strike_attention: {
        put_strikes_by_abs_net: strikeList(putMap),
        call_strikes_by_abs_net: strikeList(callMap)
      },
      open_interest_highlights: {
        top_put_oi: putsOi,
        top_call_oi: callsOi
      },
      notable_prints: notable,
      narratives: {
        tldr_eli12: tldr,
        flows_paragraph: paragraph,
        bullet_highlights: bullets
      }
    };
  }

  private static buildTldr(
    flow: FlowReport['flow_summary'],
    putNet: FlowReport['strike_attention']['put_strikes_by_abs_net'],
    skew: FlowReport['skew_and_vol_snapshot']
  ): string {
    const down = flow.put_net_bought > 0 && flow.put_net_bought >= Math.abs(flow.call_net_bought);
    const up = flow.call_net_bought > 0 && flow.call_net_bought > Math.abs(flow.put_net_bought);

    const strikePhrase = putNet.length
      ? `Largest net put buying clustered around ${putNet
          .filter((x) => x.net_bought_contracts > 0)
          .slice(0, 3)
          .map((x) => `${x.strike / 1000}k (${x.expiry})`)
          .join(', ') || 'mixed short-dated strikes'}.`
      : '';

    const skewPhrase =
      skew.otm_put_minus_call_iv_vol_points !== undefined
        ? ` OTM put wing is ~${skew.otm_put_minus_call_iv_vol_points.toFixed(1)} vol points above OTM calls on the front expiry (${skew.nearest_expiry ?? 'n/a'}), so downside protection is relatively expensive.`
        : '';

    if (down && !up) {
      return `TL;DR: Tape leans defensive — net put buying over the window, with calls not leading flow.${strikePhrase ? ' ' + strikePhrase : ''}${skewPhrase}`;
    }
    if (up && !down) {
      return `TL;DR: Call buying dominates vs puts in this slice; upside structures led the tape.${skewPhrase}`;
    }
    return `TL;DR: Two-way flow — no clean single-direction story in this window.${skewPhrase}`;
  }

  private static buildFlowsParagraph(
    params: {
      hours: number;
      currency: string;
      spot: number;
      minPremiumUsd: number;
    },
    flow: FlowReport['flow_summary'],
    putNet: FlowReport['strike_attention']['put_strikes_by_abs_net'],
    notable: FlowReport['notable_prints']
  ): string {
    const netPuts = flow.put_net_bought;
    const netCalls = flow.call_net_bought;
    const bias =
      netPuts > netCalls * 1.1
        ? 'Still seeing put interest outweigh calls in cumulative contracts.'
        : netCalls > netPuts * 1.1
          ? 'Call activity led puts in cumulative contracts.'
          : 'Puts and calls both traded size; direction is messy.';

    const putStrikes = putNet
      .filter((r) => r.net_bought_contracts > 0)
      .slice(0, 4)
      .map((r) => `${r.strike} ${r.expiry}`)
      .join('; ');

    const blockNote =
      flow.block_trade_prints > 0
        ? ` Block-tagged legs accounted for ${flow.block_trade_prints} prints (buy premium from blocks ~${fmtUsd(flow.block_premium_usd_buy)}).`
        : '';

    const topLine =
      notable.length > 0
        ? `Largest premium print in the window: ${notable[0].instrument_name} ${notable[0].direction} ${notable[0].contracts}@${fmtUsd(notable[0].premium_usd)} premium / ~${fmtUsd(notable[0].underlying_notional_usd)} underlying notional — ${notable[0].session_note}.`
        : `No single print above ${fmtUsd(params.minPremiumUsd)} premium threshold; lower the min_premium_usd to surface more lines.`;

    return (
      `Last ~${params.hours}h ${params.currency} option tape vs ~${fmtUsd(params.spot)}: ` +
      `${bias} ` +
      (putStrikes ? `Net put adds clustered at ${putStrikes}. ` : '') +
      blockNote +
      ` ${topLine}`
    );
  }

  private static buildBullets(
    flow: FlowReport['flow_summary'],
    notable: FlowReport['notable_prints'],
    topPutOi: FlowReport['open_interest_highlights']['top_put_oi']
  ): string[] {
    const out: string[] = [];
    if (topPutOi[0]) {
      out.push(
        `OI pin (puts): ${topPutOi[0].instrument_name} OI ${topPutOi[0].open_interest} (24h vol ${topPutOi[0].volume_24h}).`
      );
    }
    if (flow.combo_leg_prints > 0) {
      out.push(`${flow.combo_leg_prints} combo legs hit the tape — inspect legs together for spreads / risk reversals.`);
    }
    for (let i = 0; i < Math.min(3, notable.length); i++) {
      const n = notable[i];
      out.push(
        `${n.direction === 'buy' ? 'Buyer' : 'Seller'} of ${n.contracts}× ${n.instrument_name}: ~${fmtUsd(n.premium_usd)} premium, ~${fmtUsd(n.underlying_notional_usd)} notional — ${n.session_note}; ${n.execution_note}.`
      );
    }
    return out.slice(0, 6);
  }
}
