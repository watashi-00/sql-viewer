import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { RowInspector } from './RowInspector';
import { Table } from 'lucide-react';

export const ResultGrid: React.FC = () => {
  const { resultRows, resultColumns, selectedRow, setSelectedRow } = useWorkspaceStore();
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: resultRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  // Fallback to rendering rows if parent container has no measured height (e.g. head-less test environment)
  const itemsToRender = virtualItems.length > 0
    ? virtualItems.map((vi) => ({ index: vi.index, row: resultRows[vi.index] }))
    : resultRows.map((row, index) => ({ index, row }));

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
        <div ref={parentRef} className="flex-1 overflow-auto">
          {resultColumns.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted font-mono">
              No results to display. Run a SQL query.
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead className="sticky top-0 bg-surface-secondary border-b border-border text-secondary text-[11px] z-10">
                <tr>
                  <th className="p-2 border-r border-border/50 w-10 text-center text-muted">#</th>
                  {resultColumns.map((col, idx) => (
                    <th key={`${col}-${idx}`} className="p-2 border-r border-border/50 font-semibold text-primary">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {itemsToRender.map(({ index, row }) => {
                  const isSelected = selectedRow === row;
                  return (
                    <tr
                      key={index}
                      onClick={() => setSelectedRow(row)}
                      className={`hover:bg-surface-secondary/70 cursor-pointer transition-colors ${
                        isSelected ? 'bg-accent/15 font-medium' : ''
                      }`}
                    >
                      <td className="p-2 border-r border-border/40 text-center text-muted text-[10px]">
                        {index + 1}
                      </td>
                      {resultColumns.map((col, cIdx) => (
                        <td key={`${col}-${cIdx}`} className="p-2 border-r border-border/40 truncate max-w-[200px]">
                          {row[col] === null ? (
                            <span className="text-muted italic">NULL</span>
                          ) : (
                            String(row[col])
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <RowInspector />
    </div>
  );
};
