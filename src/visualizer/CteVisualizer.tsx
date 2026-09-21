import React from 'react';
import { CteScope } from '../types';
import { Layers, Code, Table as TableIcon, Database } from 'lucide-react';

export interface CteVisualizerProps {
  scopes?: CteScope[];
  activeScopeId?: string | null;
  onSelectScope?: (scopeId: string | null) => void;
}

export const CteVisualizer: React.FC<CteVisualizerProps> = ({
  scopes = [],
  activeScopeId = 'main',
  onSelectScope,
}) => {
  const isMainActive = !activeScopeId || activeScopeId === 'main';
  const activeScope = scopes.find((s) => s.id === activeScopeId);

  // Extract columns for output data preview table
  const getColumns = (rows: Record<string, any>[]): string[] => {
    if (!rows || rows.length === 0) return [];
    const colSet = new Set<string>();
    rows.forEach((row) => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach((k) => colSet.add(k));
      }
    });
    return Array.from(colSet);
  };

  return (
    <div className="flex flex-col gap-3 bg-surface-secondary border border-border p-4 rounded font-sans text-xs">
      {/* Scope Navigation Tab Bar */}
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div className="flex items-center gap-2 font-mono font-semibold text-primary">
          <Layers size={14} className="text-accent" />
          <span>CTE EXECUTION SCOPES</span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        {/* Main Query Tab */}
        <button
          onClick={() => onSelectScope?.('main')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono transition-all ${
            isMainActive
              ? 'bg-accent/15 border-accent text-accent font-bold shadow-sm'
              : 'bg-surface border-border text-secondary hover:text-primary'
          }`}
        >
          <Database size={12} />
          <span>Main Query</span>
        </button>

        {/* CTE Scope Tabs */}
        {scopes.map((scope) => {
          const isActive = activeScopeId === scope.id;
          const rowCount = scope.outputRows?.length ?? 0;

          return (
            <button
              key={scope.id}
              onClick={() => onSelectScope?.(scope.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono transition-all ${
                isActive
                  ? 'bg-accent/15 border-accent text-accent font-bold shadow-sm'
                  : 'bg-surface border-border text-secondary hover:text-primary'
              }`}
            >
              <Code size={12} />
              <span>{scope.aliasName}</span>
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-surface-secondary border border-border text-muted">
                {rowCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scope Canvas Content */}
      {isMainActive ? (
        <div className="bg-surface border border-border rounded p-3 text-secondary font-mono text-xs">
          <div className="flex items-center gap-2 font-semibold text-primary mb-1">
            <Database size={13} className="text-accent" />
            <span>Scope: Main Query</span>
          </div>
          <p className="text-muted text-[11px]">
            Viewing outer execution pipeline for the primary SQL statement.
          </p>
        </div>
      ) : activeScope ? (
        <div className="bg-surface border border-border rounded p-3 space-y-3 font-mono">
          {/* Active CTE Header */}
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs">
              <Code size={13} className="text-accent" />
              <span>
                WITH <span className="text-accent">{activeScope.aliasName}</span> AS
              </span>
            </div>
            <div className="text-[11px] text-muted font-mono">
              Output Rows: <span className="text-success font-bold">{activeScope.outputRows?.length ?? 0}</span>
            </div>
          </div>

          {/* CTE SQL Query Snippet */}
          <div className="bg-surface-secondary border border-border rounded p-2.5 space-y-1">
            <div className="text-[10px] text-muted font-semibold uppercase tracking-wider">
              CTE Definition Query
            </div>
            <pre className="text-[11px] text-accent font-mono whitespace-pre-wrap overflow-x-auto">
              {activeScope.query}
            </pre>
          </div>

          {/* Intermediate Output Table Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-secondary">
              <TableIcon size={12} className="text-accent" />
              <span>Intermediate Relation Preview ({activeScope.outputRows?.length ?? 0} rows)</span>
            </div>

            {!activeScope.outputRows || activeScope.outputRows.length === 0 ? (
              <div className="text-muted text-[11px] italic py-2">
                No output rows produced by this CTE scope.
              </div>
            ) : (
              <div className="overflow-x-auto border border-border rounded max-h-48">
                <table className="w-full text-left border-collapse text-[11px] font-mono">
                  <thead>
                    <tr className="bg-surface-secondary border-b border-border text-muted">
                      {getColumns(activeScope.outputRows).map((col) => (
                        <th key={col} className="px-2.5 py-1.5 font-semibold">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeScope.outputRows.map((row, rIdx) => {
                      const cols = getColumns(activeScope.outputRows);
                      return (
                        <tr key={rIdx} className="border-b border-border/50 hover:bg-surface-secondary/40">
                          {cols.map((col) => (
                            <td key={col} className="px-2.5 py-1.5 text-primary">
                              {row[col] !== undefined && row[col] !== null
                                ? String(row[col])
                                : <span className="text-muted italic">NULL</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded p-3 text-muted font-mono text-xs">
          Select a scope tab to inspect definition and intermediate dataset.
        </div>
      )}
    </div>
  );
};
