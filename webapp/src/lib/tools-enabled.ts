/**
 * Persist MCP tool enabled state in localStorage (for anonymous/single-user).
 * Stores explicit user overrides: Record<toolName, enabled>.
 * Tools not in overrides use backend default (or true).
 */

const STORAGE_KEY = 'mcp_tools_enabled';

export function loadToolOverrides(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, boolean>;
    return typeof obj === 'object' && obj !== null ? obj : {};
  } catch {
    return {};
  }
}

export function setToolEnabled(name: string, enabled: boolean): void {
  const overrides = loadToolOverrides();
  overrides[name] = enabled;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

/** Get list of enabled tool names for X-Enabled-Tools header. Only include explicit overrides. */
export function getEnabledToolsForHeader(): string[] | undefined {
  const overrides = loadToolOverrides();
  const enabled = Object.entries(overrides)
    .filter(([, v]) => v)
    .map(([k]) => k);
  return enabled.length > 0 ? enabled : undefined;
}
