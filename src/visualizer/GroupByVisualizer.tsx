import React from 'react';
import { GroupBucket } from '../types';
import { Layers, Calculator, CheckCircle2, XCircle } from 'lucide-react';

export interface GroupByVisualizerProps {
  buckets?: GroupBucket[];
  rejectedBuckets?: GroupBucket[];
  rejectedGroupBuckets?: GroupBucket[];
}

export const GroupByVisualizer: React.FC<GroupByVisualizerProps> = ({
  buckets = [],
  rejectedBuckets,
  rejectedGroupBuckets,
}) => {
  const rejected = rejectedBuckets ?? rejectedGroupBuckets ?? [];
  const displayBuckets = [
    ...buckets,
    ...rejected.filter((rb) => !buckets.some((b) => b.groupKey === rb.groupKey)),
  ];

  return (
    <div className="flex flex-col gap-4 bg-surface-secondary border border-border p-4 rounded font-sans text-xs">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2 font-mono font-semibold text-primary">
          <Layers size={14} className="text-accent" />
          <span>GROUP BY PARTITIONS ({displayBuckets.length} Buckets)</span>
        </div>
      </div>

      {displayBuckets.length === 0 ? (
        <div className="text-muted font-mono text-center py-4">No group partitions found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayBuckets.map((b, idx) => (
            <div key={idx} className="bg-surface border border-border rounded p-3 space-y-3 font-mono">
              {/* Bucket Header */}
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <div className="font-semibold text-primary text-xs">
                  GROUP: <span className="text-accent">{b.groupKey}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">{b.rows?.length ?? 0} rows</span>
                  {b.havingPassed !== undefined && (
                    b.havingPassed ? (
                      <span className="flex items-center gap-1 text-[10px] text-success font-semibold">
                        <CheckCircle2 size={11} /> PASSED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-error font-semibold">
                        <XCircle size={11} /> REJECTED
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* Having Predicate if present */}
              {b.havingPredicate && (
                <div className="text-[10px] text-muted bg-surface-secondary/60 px-2 py-1 rounded border border-border/50">
                  HAVING: <span className="text-secondary">{b.havingPredicate}</span>
                </div>
              )}

              {/* Aggregate Formulas */}
              {(b.aggregates || []).length > 0 ? (
                (b.aggregates || []).map((agg, aIdx) => (
                  <div key={aIdx} className="bg-surface-secondary border border-border p-2 rounded space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-secondary">
                      <div className="flex items-center gap-1">
                        <Calculator size={11} className="text-info" />
                        <span>
                          {agg.funcName}({agg.expression})
                        </span>
                      </div>
                      <span className="text-success font-bold text-xs">{String(agg.finalValue)}</span>
                    </div>
                    <div className="text-[10px] text-muted">
                      Formula: <span className="text-primary">{agg.formulaStep}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-muted italic p-1">No aggregate calculations</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
