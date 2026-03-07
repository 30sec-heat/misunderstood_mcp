/**
 * API client for MCP Crypto Web Platform.
 * - Tools: GET /api/tools, POST /api/tools/:name/enable|disable
 * - Tool call: POST /api/tools/call
 * - Trading relay: POST /api/trading/relay (client signs, server forwards - never stores keys)
 */

const API_BASE = '/api';

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'API request failed');
  }

  return res.json() as Promise<T>;
}

export interface ApiTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  enabled: boolean;
}

export const api = {
  /** Get all tools with enabled state. Pass X-Enabled-Tools header for client-side overrides (localStorage). */
  getTools: (enabledTools?: string[]) =>
    fetchApi<{ tools: ApiTool[] }>('/tools', {
      headers: enabledTools?.length
        ? { 'X-Enabled-Tools': enabledTools.join(',') }
        : {},
    }),

  enableTool: (name: string) =>
    fetchApi<{ success: boolean; name: string; enabled: boolean }>(
      `/tools/${encodeURIComponent(name)}/enable`,
      { method: 'POST' }
    ),

  disableTool: (name: string) =>
    fetchApi<{ success: boolean; name: string; enabled: boolean }>(
      `/tools/${encodeURIComponent(name)}/disable`,
      { method: 'POST' }
    ),

  callTool: (name: string, args: Record<string, unknown>) =>
    fetchApi<unknown>('/tools/call', {
      method: 'POST',
      body: JSON.stringify({ name, arguments: args }),
    }),

  /** Relay pre-signed request to exchange. Server never stores keys. */
  tradingRelay: (params: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }) =>
    fetchApi<unknown>('/trading/relay', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getHealth: () => fetchApi<{ status: string }>('/health'),
};
