/**
 * Strategy Runner Service
 * Tracks running strategies in memory, persists state to strategies.json (and strategy-state.json for PnL).
 * Methods: startStrategy, pauseStrategy, resumeStrategy, stopStrategy
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  loadStrategies,
  saveStrategies,
  getStrategy,
} from './storage.js';
import type { Strategy, ConditionalStrategy } from './types.js';

const STATE_PATH = path.join(process.cwd(), 'strategy-state.json');
const STRATEGIES_PATH = path.join(process.cwd(), 'strategies.json');

export interface PositionRecord {
  strategyId: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  size: number;
  entryTime: string;
  exchange?: string;
  marketType?: string;
  /** For trailing stop */
  trailingHigh?: number;
  trailingLow?: number;
}

export interface ClosedTradeRecord {
  strategyId: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  pnlPercent: number;
  exitTime: string;
  exitReason: 'stop_loss' | 'take_profit' | 'manual' | 'indicator';
}

export interface StrategyStateData {
  positions: Record<string, PositionRecord>;
  closedTrades: ClosedTradeRecord[];
  lastTradeByStrategy: Record<string, ClosedTradeRecord>;
  updatedAt: string;
}

function loadState(): StrategyStateData {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf-8');
    return JSON.parse(raw) as StrategyStateData;
  } catch {
    return {
      positions: {},
      closedTrades: [],
      lastTradeByStrategy: {},
      updatedAt: new Date().toISOString(),
    };
  }
}

function saveState(state: StrategyStateData): void {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

export class StrategyRunnerService {
  private runningStrategyIds: Set<string> = new Set();
  private pausedStrategyIds: Set<string> = new Set();

  /** Start a strategy (run) */
  startStrategy(id: string): boolean {
    const strategy = getStrategy(id);
    if (!strategy) return false;
    this.runningStrategyIds.add(id);
    this.pausedStrategyIds.delete(id);
    this.persistStatus(id, 'running');
    return true;
  }

  /** Pause a strategy (stop polling but keep position tracking) */
  pauseStrategy(id: string): boolean {
    const strategy = getStrategy(id);
    if (!strategy) return false;
    this.runningStrategyIds.delete(id);
    this.pausedStrategyIds.add(id);
    this.persistStatus(id, 'paused');
    return true;
  }

  /** Resume a paused strategy */
  resumeStrategy(id: string): boolean {
    return this.startStrategy(id);
  }

  /** Stop a strategy completely */
  stopStrategy(id: string): boolean {
    const strategy = getStrategy(id);
    if (!strategy) return false;
    this.runningStrategyIds.delete(id);
    this.pausedStrategyIds.delete(id);
    this.persistStatus(id, 'stopped');
    return true;
  }

  isRunning(id: string): boolean {
    return this.runningStrategyIds.has(id);
  }

  isPaused(id: string): boolean {
    return this.pausedStrategyIds.has(id);
  }

  getRunningIds(): string[] {
    return Array.from(this.runningStrategyIds);
  }

  getStrategiesToExecute(): ConditionalStrategy[] {
    const strategies = loadStrategies(STRATEGIES_PATH);
    return strategies.filter(
      (s): s is ConditionalStrategy =>
        s.strategyType === 'conditional' &&
        s.enabled &&
        this.runningStrategyIds.has(s.id)
    );
  }

  private persistStatus(id: string, status: 'running' | 'paused' | 'stopped'): void {
    const strategies = loadStrategies(STRATEGIES_PATH);
    const idx = strategies.findIndex((s) => s.id === id);
    if (idx >= 0) {
      strategies[idx] = { ...strategies[idx], status, updatedAt: new Date().toISOString() };
      saveStrategies(strategies, STRATEGIES_PATH);
    }
  }

  // --- PnL tracking ---

  recordEntry(strategyId: string, pos: Omit<PositionRecord, 'strategyId' | 'entryTime'>): void {
    const state = loadState();
    const record: PositionRecord = {
      ...pos,
      strategyId,
      entryTime: new Date().toISOString(),
    };
    state.positions[strategyId] = record;
    saveState(state);
  }

  recordExit(
    strategyId: string,
    exitPrice: number,
    exitReason: ClosedTradeRecord['exitReason']
  ): ClosedTradeRecord | null {
    const state = loadState();
    const pos = state.positions[strategyId];
    if (!pos) return null;

    const pnl =
      pos.side === 'long'
        ? (exitPrice - pos.entryPrice) * pos.size
        : (pos.entryPrice - exitPrice) * pos.size;
    const pnlPercent =
      pos.entryPrice !== 0 ? (pnl / (pos.entryPrice * pos.size)) * 100 : 0;

    const closed: ClosedTradeRecord = {
      strategyId,
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice,
      size: pos.size,
      pnl,
      pnlPercent,
      exitTime: new Date().toISOString(),
      exitReason,
    };

    delete state.positions[strategyId];
    state.closedTrades.push(closed);
    state.lastTradeByStrategy[strategyId] = closed;
    saveState(state);
    return closed;
  }

  updateTrailingLevel(strategyId: string, trailingHigh?: number, trailingLow?: number): void {
    const state = loadState();
    const pos = state.positions[strategyId];
    if (!pos) return;
    if (trailingHigh != null) pos.trailingHigh = trailingHigh;
    if (trailingLow != null) pos.trailingLow = trailingLow;
    state.positions[strategyId] = pos;
    saveState(state);
  }

  getPosition(strategyId: string): PositionRecord | null {
    const state = loadState();
    return state.positions[strategyId] ?? null;
  }

  getLastTrade(strategyId: string): ClosedTradeRecord | null {
    const state = loadState();
    return state.lastTradeByStrategy[strategyId] ?? null;
  }

  getUnrealizedPnL(strategyId: string, currentPrice: number): number | null {
    const pos = this.getPosition(strategyId);
    if (!pos) return null;
    return pos.side === 'long'
      ? (currentPrice - pos.entryPrice) * pos.size
      : (pos.entryPrice - currentPrice) * pos.size;
  }

  getRealizedPnL(strategyId: string): number {
    const state = loadState();
    const trades = state.closedTrades.filter((t) => t.strategyId === strategyId);
    return trades.reduce((sum, t) => sum + t.pnl, 0);
  }

  getAllPositions(): PositionRecord[] {
    const state = loadState();
    return Object.values(state.positions);
  }

  getStrategiesWithStatus(): Array<{
    strategy: Strategy;
    status: 'running' | 'paused' | 'stopped';
    position: PositionRecord | null;
    lastTrade: ClosedTradeRecord | null;
    unrealizedPnL?: number;
    realizedPnL: number;
  }> {
    const strategies = loadStrategies(STRATEGIES_PATH);
    const state = loadState();
    const result: Array<{
      strategy: Strategy;
      status: 'running' | 'paused' | 'stopped';
      position: PositionRecord | null;
      lastTrade: ClosedTradeRecord | null;
      unrealizedPnL?: number;
      realizedPnL: number;
    }> = [];

    for (const s of strategies) {
      const status: 'running' | 'paused' | 'stopped' =
        this.runningStrategyIds.has(s.id)
          ? 'running'
          : this.pausedStrategyIds.has(s.id)
            ? 'paused'
            : (s.status ?? 'stopped');
      const position = state.positions[s.id] ?? null;
      const lastTrade = state.lastTradeByStrategy[s.id] ?? null;
      const realizedPnL = state.closedTrades
        .filter((t) => t.strategyId === s.id)
        .reduce((sum, t) => sum + t.pnl, 0);

      result.push({
        strategy: s,
        status,
        position,
        lastTrade,
        realizedPnL,
      });
    }
    return result;
  }

  /** Load persisted running status on startup */
  loadPersistedRunningStatus(): void {
    const strategies = loadStrategies(STRATEGIES_PATH);
    for (const s of strategies) {
      if (s.status === 'running') {
        this.runningStrategyIds.add(s.id);
        this.pausedStrategyIds.delete(s.id);
      } else if (s.status === 'paused') {
        this.pausedStrategyIds.delete(s.id);
        this.pausedStrategyIds.add(s.id);
      }
    }
  }
}

let singletonRunner: StrategyRunnerService | null = null;

export function getStrategyRunner(): StrategyRunnerService {
  if (!singletonRunner) {
    singletonRunner = new StrategyRunnerService();
    singletonRunner.loadPersistedRunningStatus();
  }
  return singletonRunner;
}
