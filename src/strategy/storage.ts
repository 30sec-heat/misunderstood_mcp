/**
 * Strategy Storage
 *
 * Persists strategies to strategies.json (or in-memory fallback).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Strategy } from './types.js';

const DEFAULT_PATH = path.join(process.cwd(), 'strategies.json');

/**
 * Load strategies from file or return empty array.
 */
export function loadStrategies(filePath: string = DEFAULT_PATH): Strategy[] {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data.strategies) ? data.strategies : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

/**
 * Save strategies to file.
 */
export function saveStrategies(
  strategies: Strategy[],
  filePath: string = DEFAULT_PATH
): void {
  const data = {
    strategies,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Add or update a strategy.
 */
export function upsertStrategy(
  strategy: Strategy,
  filePath: string = DEFAULT_PATH
): void {
  const strategies = loadStrategies(filePath);
  const idx = strategies.findIndex((s) => s.id === strategy.id);
  const updated = { ...strategy, updatedAt: new Date().toISOString() };

  if (idx >= 0) {
    strategies[idx] = updated;
  } else {
    strategies.push(updated);
  }

  saveStrategies(strategies, filePath);
}

/**
 * Remove a strategy by id.
 */
export function removeStrategy(
  id: string,
  filePath: string = DEFAULT_PATH
): boolean {
  const strategies = loadStrategies(filePath);
  const filtered = strategies.filter((s) => s.id !== id);
  if (filtered.length === strategies.length) {
    return false;
  }
  saveStrategies(filtered, filePath);
  return true;
}

/**
 * Get strategy by id.
 */
export function getStrategy(
  id: string,
  filePath: string = DEFAULT_PATH
): Strategy | undefined {
  return loadStrategies(filePath).find((s) => s.id === id);
}
