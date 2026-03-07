import { useState, useEffect } from 'react';
import { DataTable } from '../components/shared/DataTable';
import { Card } from '../components/shared/Card';
import type { DataRecord } from '../types';

// Modules supported by backend data proxy (server-side API keys from env)
const MODULES = [
  'polymarket',
  'news',
  'breaking_news',
  'pyth',
  'econ_data',
  'earningsfeed',
  'massive',
] as const;

export function DataExplorerPage() {
  const [module, setModule] = useState<string>(MODULES[0]);
  const [data, setData] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = module === 'pyth' || module === 'econ_data' ? '?ids=0xca80ba6f32ebebb5f99f90aa194a3baaef83a7aaf15ff26539f308c2bfb41241' : '';
    fetch(`/api/data/${module}${params}`)
      .then((res) => res.json())
      .then((r: { data?: unknown; error?: string }) => {
        if (r.error) throw new Error(r.error);
        const raw = r.data;
        const arr = Array.isArray(raw)
          ? raw
          : raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)
            ? (raw as { data: DataRecord[] }).data
            : [];
        setData(arr);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [module]);

  const columns =
    data.length > 0
      ? Object.keys(data[0]).map((key) => ({
          key,
          header: key.replace(/_/g, ' '),
        }))
      : [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {MODULES.map((m) => (
          <button
            key={m}
            onClick={() => setModule(m)}
            className={`px-3 py-1.5 rounded-sharp text-sm capitalize ${
              module === m ? 'bg-accent-cyan text-dark font-medium' : 'bg-dark-surface border border-dark-border'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-4 capitalize">{module} Data</h2>
        {loading && (
          <div className="py-12 text-center text-dark-muted animate-pulse">Loading...</div>
        )}
        {error && (
          <div className="py-8 text-center text-accent-negative">
            {error}
            <p className="text-sm text-dark-muted mt-2">
              Ensure backend is running and /api/data/{module} returns data.
            </p>
          </div>
        )}
        {!loading && !error && data.length > 0 && (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <DataTable columns={columns} data={data} />
          </div>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="py-12 text-center text-dark-muted">
            No data available. Backend may return empty array for this module.
          </div>
        )}
      </Card>
    </div>
  );
}
