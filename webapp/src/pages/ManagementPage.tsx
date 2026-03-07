import { useState, useEffect } from 'react';
import { api, type ApiTool } from '../api/client';
import { loadToolOverrides, setToolEnabled } from '../lib/tools-enabled';
import { ToolCard } from '../components/shared/ToolCard';
import { Card } from '../components/shared/Card';

/** Map ApiTool to MCPTool shape for ToolCard */
function toMCPTool(t: ApiTool): { id: string; name: string; description: string; module: string; enabled: boolean } {
  const module = t.name.split('_')[0] ?? 'other';
  return {
    id: t.name,
    name: t.name,
    description: t.description ?? '',
    module,
    enabled: t.enabled,
  };
}

export function ManagementPage() {
  const [tools, setTools] = useState<ApiTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [groupBy, setGroupBy] = useState<'module' | 'none'>('module');

  useEffect(() => {
    api
      .getTools()
      .then((res) => {
        const overrides = loadToolOverrides();
        const merged = res.tools.map((t) => ({
          ...t,
          enabled: t.name in overrides ? !!overrides[t.name] : t.enabled,
        }));
        setTools(merged);
      })
      .catch(() => setTools([]))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (name: string, enabled: boolean) => {
    try {
      if (enabled) {
        await api.enableTool(name);
      } else {
        await api.disableTool(name);
      }
      setToolEnabled(name, enabled);
      setTools((prev) =>
        prev.map((t) => (t.name === name ? { ...t, enabled } : t))
      );
    } catch {
      // Keep UI state on error
    }
  };

  const filtered = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(filter.toLowerCase()) ||
      (t.description?.toLowerCase().includes(filter.toLowerCase()) ?? false)
  );

  const grouped =
    groupBy === 'module'
      ? filtered.reduce<Record<string, ApiTool[]>>((acc, t) => {
          const m = t.name.split('_')[0] ?? 'other';
          if (!acc[m]) acc[m] = [];
          acc[m].push(t);
          return acc;
        }, {})
      : { all: filtered };

  if (loading) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-[200px]">
        <div className="animate-pulse text-dark-muted">Loading tools...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search tools..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-sharp bg-dark-surface border border-dark-border px-3 py-2 text-sm w-full sm:max-w-xs focus:outline-none focus:ring-1 focus:ring-accent-cyan"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setGroupBy('module')}
            className={`px-3 py-1.5 rounded-sharp text-sm ${
              groupBy === 'module' ? 'bg-accent-cyan text-dark' : 'bg-dark-surface border border-dark-border'
            }`}
          >
            By module
          </button>
          <button
            onClick={() => setGroupBy('none')}
            className={`px-3 py-1.5 rounded-sharp text-sm ${
              groupBy === 'none' ? 'bg-accent-cyan text-dark' : 'bg-dark-surface border border-dark-border'
            }`}
          >
            Flat
          </button>
        </div>
      </div>

      <div className="text-sm text-dark-muted">
        {filtered.length} tool{filtered.length !== 1 ? 's' : ''} • Toggle on/off (stored in browser)
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([moduleName, moduleTools]) => (
          <div key={moduleName}>
            {groupBy === 'module' && (
              <h3 className="text-sm font-semibold text-accent-cyan mb-3 uppercase tracking-wider">
                {moduleName}
              </h3>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {moduleTools.map((tool) => (
                <ToolCard
                  key={tool.name}
                  tool={toMCPTool(tool)}
                  onToggle={(enabled) => handleToggle(tool.name, enabled)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card className="text-center py-12 text-dark-muted">
          No tools match your search. Try a different filter.
        </Card>
      )}
    </div>
  );
}
