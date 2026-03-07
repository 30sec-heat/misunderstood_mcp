import { useState, useEffect } from 'react';
import { Card } from '../components/shared/Card';

const STORAGE_KEYS = [
  { key: 'api_key_polymarket', label: 'Polymarket API Key', placeholder: 'pk_...' },
  { key: 'api_key_deribit', label: 'Deribit API Key', placeholder: '...' },
  { key: 'api_key_binance', label: 'Binance API Key', placeholder: '...' },
  { key: 'api_key_coinalyze', label: 'Coinalyze API Key', placeholder: '...' },
  { key: 'api_key_news', label: 'News API Key', placeholder: '...' },
] as const;

export function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const v: Record<string, string> = {};
    STORAGE_KEYS.forEach(({ key }) => {
      v[key] = localStorage.getItem(key) ?? '';
    });
    setValues(v);
  }, []);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    Object.entries(values).forEach(([k, v]) => {
      if (v) localStorage.setItem(k, v);
      else localStorage.removeItem(k);
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">API Keys (Client-Side Only)</h2>
        <p className="text-sm text-dark-muted">
          Keys are stored in browser localStorage only. Never sent to the server. Use for trading/order APIs that
          require client-side signing.
        </p>
      </div>

      <Card className="space-y-4">
        {STORAGE_KEYS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
            <input
              type="password"
              value={values[key] ?? ''}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-sharp bg-dark-surface border border-dark-border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-accent-cyan"
            />
          </div>
        ))}
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-sharp bg-accent-cyan text-dark font-semibold text-sm hover:bg-accent-cyan/90 transition-colors"
        >
          {saved ? 'Saved ✓' : 'Save to localStorage'}
        </button>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold mb-2">Backend API Keys</h3>
        <p className="text-sm text-dark-muted">
          Data-fetching APIs (Polymarket, news, sentiment, etc.) use keys configured on the server. Configure those
          in your backend environment variables.
        </p>
      </Card>
    </div>
  );
}
