import React from 'react';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { X, Search } from 'lucide-react';

export const RowInspector: React.FC = () => {
  const { selectedRow, setSelectedRow } = useWorkspaceStore();

  if (!selectedRow) return null;

  return (
    <div className="w-80 h-full bg-surface border-l border-border flex flex-col text-xs font-sans">
      <div className="flex items-center justify-between px-3 py-2 bg-surface-secondary border-b border-border">
        <div className="flex items-center gap-1.5 font-semibold text-primary">
          <Search size={13} className="text-accent" />
          <span>ROW INSPECTOR</span>
        </div>
        <button onClick={() => setSelectedRow(null)} className="text-secondary hover:text-primary">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono">
        {Object.entries(selectedRow).map(([key, val]) => (
          <div key={key} className="bg-surface-secondary border border-border p-2 rounded">
            <div className="text-[10px] text-muted uppercase">{key}</div>
            <div className="text-primary font-medium text-xs break-all">{val === null ? 'NULL' : String(val)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
