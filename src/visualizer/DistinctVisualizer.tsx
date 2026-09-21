import React from 'react';
import { Filter } from 'lucide-react';
import { DataRow } from '../types';

export interface DistinctVisualizerProps {
  inputCount?: number;
  outputCount?: number;
  duplicatesRemoved?: number;
  distinctDuplicatesRemoved?: number;
  inputRows?: DataRow[];
  outputRows?: DataRow[];
}

export const DistinctVisualizer: React.FC<DistinctVisualizerProps> = ({
  inputCount,
  outputCount,
  duplicatesRemoved,
  distinctDuplicatesRemoved,
  inputRows,
  outputRows,
}) => {
  const resolvedInput = inputCount ?? inputRows?.length ?? 0;
  const resolvedOutput = outputCount ?? outputRows?.length ?? 0;
  const resolvedDuplicates =
    duplicatesRemoved ??
    distinctDuplicatesRemoved ??
    Math.max(0, resolvedInput - resolvedOutput);

  return (
    <div className="flex flex-col gap-3 bg-surface-secondary border border-border p-4 rounded font-sans text-xs">
      <div className="flex items-center gap-2 font-mono font-semibold text-primary border-b border-border pb-2">
        <Filter size={14} className="text-accent" />
        <span>DISTINCT DEDUPLICATION</span>
      </div>

      <div className="grid grid-cols-3 gap-3 font-mono">
        <div className="bg-surface border border-border p-2.5 rounded">
          <div className="text-muted text-[10px]">INPUT ROWS</div>
          <div className="text-base font-bold text-primary">{resolvedInput}</div>
        </div>
        <div className="bg-surface border border-border p-2.5 rounded">
          <div className="text-muted text-[10px]">OUTPUT UNIQUE ROWS</div>
          <div className="text-base font-bold text-success">{resolvedOutput}</div>
        </div>
        <div className="bg-surface border border-border p-2.5 rounded">
          <div className="text-muted text-[10px]">DUPLICATES REMOVED</div>
          <div className="text-base font-bold text-warning">{resolvedDuplicates} Duplicates Collapsed</div>
        </div>
      </div>
    </div>
  );
};
