import { useState } from 'react';
import type { MCPTool } from '../../types';

interface ToolCardProps {
  tool: MCPTool;
  onToggle: (enabled: boolean) => void | Promise<void>;
}

export function ToolCard({ tool, onToggle }: ToolCardProps) {
  const { name, description, module: moduleName, enabled } = tool;
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      await onToggle(!enabled);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-base flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-white">
            {name}
          </span>
          <span className="rounded-sharp bg-dark-muted px-1.5 py-0.5 font-mono text-xs text-gray-400">
            {moduleName}
          </span>
        </div>
        {description && (
          <p className="mt-1 font-sans text-xs text-gray-400 line-clamp-2">
            {description}
          </p>
        )}
      </div>
      <label className="flex shrink-0 cursor-pointer items-center gap-2">
        <span className="font-mono text-xs text-gray-500">
          {enabled ? 'ON' : 'OFF'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={loading}
          onClick={handleToggle}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:ring-offset-2 focus:ring-offset-dark-elevated disabled:opacity-50 ${
            enabled
              ? 'border-accent-emerald bg-accent-emerald'
              : 'border-dark-border bg-dark-surface'
          }`}
        >
          <span
            className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              enabled ? 'left-6 translate-x-0' : 'left-1 -translate-x-0'
            }`}
          />
        </button>
      </label>
    </div>
  );
}
