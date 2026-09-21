import React from 'react';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { RowInspector } from './RowInspector';
import { Table } from 'lucide-react';

export const ResultGrid: React.FC = () => {
  const { resultRows, resultColumns, setSelectedRow } = useWorkspaceStore();

  return (
    <div className="h-full w-full flex bg-surface text-primary font-sans select-none">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-surface-secondary border-b border-border text-xs text-secondary font-mono">
          <div className="flex items-center gap-1.5">
            <Table size={13} className="text-accent" />
            <span>RESULT SET ({resultRows.length} rows)</span>
          </div>
        </div>

        {/* Grid Table */}
        <div className="flex-1 overflow-auto">
          {resultColumns.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted font-mono">
              No results to display. Run a SQL query.
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead className="sticky top-0 bg-surface-secondary border-b border-border text-secondary text-[11px]">
                <tr>
                  <th className="p-2 border-r border-border/50 w-10 text-center text-muted">#</th>
                  {resultColumns.map((col) => (
                    <th key={col} className="p-2 border-r border-border/50 font-semibold text-primary">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {resultRows.map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setSelectedRow(row)}
                    className="hover:bg-surface-secondary/70 cursor-pointer transition-colors"
                  >
                    <td className="p-2 border-r border-border/40 text-center text-muted text-[10px]">{idx + 1}</td>
                    {resultColumns.map((col) => (
                      <td key={col} className="p-2 border-r border-border/40 truncate max-w-[200px]">
                        {row[col] === null ? (
                          <span className="text-muted italic">NULL</span>
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <RowInspector />
    </div>
  );
};
