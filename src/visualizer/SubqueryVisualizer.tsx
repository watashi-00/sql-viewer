import React from 'react';
import { SubqueryResolution } from '../types';
import { Search, Code, CheckCircle2, XCircle, ListFilter, HelpCircle } from 'lucide-react';

export interface SubqueryVisualizerProps {
  resolutions?: SubqueryResolution[];
}

export const SubqueryVisualizer: React.FC<SubqueryVisualizerProps> = ({
  resolutions = [],
}) => {
  return (
    <div className="flex flex-col gap-3 bg-surface-secondary border border-border p-4 rounded font-sans text-xs">
      {/* Visualizer Header */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2 font-mono font-semibold text-primary">
          <Search size={14} className="text-accent" />
          <span>SUBQUERY RESOLUTION INSPECTOR ({resolutions.length} Subqueries)</span>
        </div>
      </div>

      {resolutions.length === 0 ? (
        <div className="text-muted font-mono text-center py-4">
          No subquery resolutions captured for this stage.
        </div>
      ) : (
        <div className="flex flex-col gap-3 font-mono">
          {resolutions.map((res) => {
            const isScalar = res.type === 'scalar';
            const isSet = res.type === 'set';
            const isExists = res.type === 'exists';

            return (
              <div key={res.id} className="bg-surface border border-border rounded p-3 space-y-2.5">
                {/* Resolution Item Header with Badges */}
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    {/* Subquery Type Badge */}
                    {isScalar && (
                      <span className="px-2 py-0.5 rounded bg-info/15 border border-info/40 text-info font-bold text-[10px] uppercase">
                        SCALAR
                      </span>
                    )}
                    {isSet && (
                      <span className="px-2 py-0.5 rounded bg-accent/15 border border-accent/40 text-accent font-bold text-[10px] uppercase">
                        SET (IN)
                      </span>
                    )}
                    {isExists && (
                      <span className="px-2 py-0.5 rounded bg-warning/15 border border-warning/40 text-warning font-bold text-[10px] uppercase">
                        EXISTS
                      </span>
                    )}

                    {/* Parent Clause Badge */}
                    {res.parentClause && (
                      <span className="px-1.5 py-0.5 rounded bg-surface-secondary border border-border text-muted text-[10px] uppercase">
                        {res.parentClause}
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-muted font-mono">{res.id}</span>
                </div>

                {/* Subquery Raw SQL Code Snippet */}
                <div className="bg-surface-secondary border border-border rounded p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted font-semibold uppercase tracking-wider">
                    <Code size={11} className="text-accent" />
                    <span>Raw Subquery Expression</span>
                  </div>
                  <pre className="text-[11px] text-accent font-mono whitespace-pre-wrap overflow-x-auto">
                    {res.rawQuery}
                  </pre>
                </div>

                {/* Resolved Output Inspector Box */}
                <div className="bg-surface-secondary/50 border border-border/80 rounded p-2.5 space-y-1.5">
                  <div className="text-[10px] text-muted font-semibold uppercase tracking-wider">
                    Resolved Evaluation Result
                  </div>

                  {isScalar && (
                    <div className="flex items-center gap-2">
                      <span className="text-secondary text-[11px]">Scalar Value:</span>
                      <span className="px-2 py-0.5 rounded bg-surface border border-border text-success font-bold text-xs">
                        {res.resolvedValue !== undefined && res.resolvedValue !== null
                          ? String(res.resolvedValue)
                          : 'NULL'}
                      </span>
                    </div>
                  )}

                  {isSet && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-secondary text-[11px]">
                        <span className="flex items-center gap-1">
                          <ListFilter size={11} className="text-accent" />
                          <span>Resolved Set List:</span>
                        </span>
                        <span className="text-[10px] text-muted">
                          {res.resolvedSet?.length ?? 0} elements
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-surface border border-border rounded">
                        {res.resolvedSet && res.resolvedSet.length > 0 ? (
                          res.resolvedSet.map((item, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 text-[11px] rounded bg-accent/10 border border-accent/30 text-primary font-bold"
                            >
                              {item !== undefined && item !== null ? String(item) : 'NULL'}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted italic text-[11px] px-1">Empty Set ()</span>
                        )}
                      </div>
                    </div>
                  )}

                  {isExists && (
                    <div className="flex items-center gap-2">
                      <span className="text-secondary text-[11px]">Exists Condition Evaluation:</span>
                      {res.existsResult ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-success/15 border border-success/40 text-success font-bold text-xs">
                          <CheckCircle2 size={12} />
                          <span>TRUE</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-error/15 border border-error/40 text-error font-bold text-xs">
                          <XCircle size={12} />
                          <span>FALSE</span>
                        </span>
                      )}
                    </div>
                  )}

                  {!isScalar && !isSet && !isExists && (
                    <div className="flex items-center gap-2 text-muted text-[11px]">
                      <HelpCircle size={12} />
                      <span>
                        Value:{' '}
                        {res.resolvedValue !== undefined
                          ? String(res.resolvedValue)
                          : res.resolvedSet
                          ? `[${res.resolvedSet.join(', ')}]`
                          : String(res.existsResult)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
