import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { RowInspector } from './RowInspector';
import { Table, Download } from 'lucide-react';
import { DataRow } from '../types';

export interface ResultGridProps {
  rows?: DataRow[];
  columns?: string[];
}

export const ResultGrid: React.FC<ResultGridProps> = ({ rows: propsRows, columns: propsColumns }) => {
  const { resultRows, resultColumns, selectedRow, setSelectedRow } = useWorkspaceStore();
  const rows = propsRows ?? resultRows;
  const columns = propsColumns ?? resultColumns;

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  // Fallback to rendering rows if parent container has no measured height (e.g. head-less test environment)
  const itemsToRender = virtualItems.length > 0
    ? virtualItems.map((vi) => ({ index: vi.index, row: rows[vi.index] }))
    : rows.map((row, index) => ({ index, row }));

  const handleExport = (format: 'csv' | 'json' | 'parquet') => {
    if (rows.length === 0) return;

    let content: string = '';
    let mimeType: string = 'text/plain';
    let filename: string = `export.${format}`;

    if (format === 'csv') {
      const header = columns.join(',');
      const bodyLines = rows.map((row) =>
        columns
          .map((col) => {
            const val = row[col];
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (/[",\n]/.test(str)) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      );
      content = [header, ...bodyLines].join('\n');
      mimeType = 'text/csv';
    } else if (format === 'json') {
      content = JSON.stringify(rows, null, 2);
      mimeType = 'application/json';
    } else if (format === 'parquet') {
      content = JSON.stringify(rows, null, 2);
      mimeType = 'application/octet-stream';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : '';
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof URL.revokeObjectURL === 'function' && url) {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="h-full w-full flex bg-surface text-primary font-sans select-none">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-surface-secondary border-b border-border text-xs text-secondary font-mono">
          <div className="flex items-center gap-1.5">
            <Table size={13} className="text-accent" />
            <span>RESULT SET ({rows.length} rows)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleExport('csv')}
              disabled={rows.length === 0}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface hover:bg-surface-secondary text-primary text-[11px] border border-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download size={11} />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={rows.length === 0}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface hover:bg-surface-secondary text-primary text-[11px] border border-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download size={11} />
              <span>Export JSON</span>
            </button>
            <button
              onClick={() => handleExport('parquet')}
              disabled={rows.length === 0}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface hover:bg-surface-secondary text-primary text-[11px] border border-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download size={11} />
              <span>Export Parquet</span>
            </button>
          </div>
        </div>

        {/* Grid Table */}
        <div ref={parentRef} className="flex-1 overflow-auto">
          {columns.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted font-mono">
              No results to display. Run a SQL query.
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead className="sticky top-0 bg-surface-secondary border-b border-border text-secondary text-[11px] z-10">
                <tr>
                  <th className="p-2 border-r border-border/50 w-10 text-center text-muted">#</th>
                  {columns.map((col, idx) => (
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
                      {columns.map((col, cIdx) => (
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
