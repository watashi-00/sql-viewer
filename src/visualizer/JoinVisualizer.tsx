import React, { useState } from 'react';
import { JoinMatch, DataRow } from '../types';
import { Table, Link2, CheckCircle2, AlertCircle } from 'lucide-react';

export interface JoinVisualizerProps {
  matches?: JoinMatch[];
  unmatchedLeft?: DataRow[];
  unmatchedRight?: DataRow[];
  leftTableName?: string;
  rightTableName?: string;
}

export const JoinVisualizer: React.FC<JoinVisualizerProps> = ({
  matches = [],
  unmatchedLeft,
  unmatchedRight,
  leftTableName = 'Left Relation',
  rightTableName = 'Right Relation',
}) => {
  const [selectedMatch, setSelectedMatch] = useState<JoinMatch | null>(matches[0] ?? null);

  const activeMatch = matches.find((m) => m === selectedMatch) ?? matches[0] ?? null;

  const rowHeight = 56;
  const headerOffset = 42;
  const svgHeight = Math.max(matches.length * rowHeight + headerOffset + 10, 100);

  return (
    <div className="flex flex-col gap-4 bg-surface-secondary border border-border p-4 rounded font-sans text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2 font-mono font-semibold text-primary">
          <Link2 size={14} className="text-accent" />
          <span>RELATIONAL JOIN MAP</span>
        </div>
        <span className="text-muted font-mono text-[11px]">
          {matches.length} Matching Tuples
          {((unmatchedLeft?.length ?? 0) > 0 || (unmatchedRight?.length ?? 0) > 0) &&
            ` · ${(unmatchedLeft?.length ?? 0) + (unmatchedRight?.length ?? 0)} Unmatched`}
        </span>
      </div>

      {/* Dual Relation Columns with SVG Connectors */}
      <div className="grid grid-cols-[1fr_60px_1fr] sm:grid-cols-[1fr_80px_1fr] gap-2 items-start relative">
        {/* Left Relation Card */}
        <div className="bg-surface border border-border rounded p-3 space-y-2">
          <div className="flex items-center gap-1.5 font-mono text-secondary font-medium border-b border-border pb-1">
            <Table size={12} className="text-info" />
            <span>LEFT RELATION: {leftTableName}</span>
          </div>
          <div className="space-y-1.5 font-mono">
            {matches.length === 0 ? (
              <div className="p-3 text-center text-muted font-mono text-[11px]">No matching tuples found</div>
            ) : (
              matches.map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedMatch(m)}
                  className={`p-2 rounded border cursor-pointer transition-colors min-h-[50px] flex flex-col justify-center ${
                    activeMatch === m
                      ? 'bg-accent/15 border-accent text-primary font-semibold'
                      : 'bg-surface-secondary border-border text-secondary hover:text-primary'
                  }`}
                >
                  <div className="text-[10px] text-muted">Row #{m.leftRowId}</div>
                  <div className="truncate">
                    {String(m.leftValues['title'] ?? m.leftValues['name'] ?? JSON.stringify(m.leftValues))}
                  </div>
                </div>
              ))
            )}

            {/* Unmatched Left Rows (Outer Joins) */}
            {unmatchedLeft && unmatchedLeft.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <div className="text-[10px] uppercase font-mono text-muted flex items-center gap-1">
                  <AlertCircle size={10} className="text-warning" />
                  <span>Unmatched Left Rows ({unmatchedLeft.length})</span>
                </div>
                {unmatchedLeft.map((row, idx) => (
                  <div
                    key={`unmatched-l-${idx}`}
                    className="p-2 rounded border border-dashed border-border/70 bg-surface-secondary/40 text-muted font-mono min-h-[46px] flex flex-col justify-center"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span>Unmatched #{idx + 1}</span>
                      <span className="text-warning text-[9px] px-1 py-0.5 rounded bg-warning/10 border border-warning/20">
                        NULL Padded
                      </span>
                    </div>
                    <div className="truncate text-secondary" title={JSON.stringify(row)}>
                      {String(row['title'] ?? row['name'] ?? Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(', '))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center SVG Connectors */}
        <div className="relative h-full flex flex-col items-center justify-start self-stretch">
          <svg
            viewBox={`0 0 100 ${svgHeight}`}
            preserveAspectRatio="none"
            className="w-full h-full min-h-[100px] overflow-visible"
            data-testid="join-connector-svg"
          >
            <defs>
              <linearGradient id="activeJoinGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>
            {matches.map((m, idx) => {
              const y = headerOffset + idx * rowHeight + 25;
              const isSelected = activeMatch === m;
              return (
                <g
                  key={idx}
                  data-testid={`join-connector-${idx}`}
                  onClick={() => setSelectedMatch(m)}
                  className="cursor-pointer group"
                >
                  {/* Invisible wide path for easy clicking */}
                  <path
                    d={`M 0 ${y} C 50 ${y}, 50 ${y}, 100 ${y}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="16"
                  />
                  {/* Visible connector line */}
                  <path
                    d={`M 0 ${y} C 50 ${y}, 50 ${y}, 100 ${y}`}
                    fill="none"
                    stroke={isSelected ? 'url(#activeJoinGradient)' : 'rgba(148, 163, 184, 0.4)'}
                    strokeWidth={isSelected ? 3 : 1.5}
                    strokeDasharray={isSelected ? undefined : '3,3'}
                    className="transition-all duration-150 group-hover:stroke-accent"
                  />
                  {/* Left anchor circle */}
                  <circle
                    cx={2}
                    cy={y}
                    r={isSelected ? 3.5 : 2.5}
                    className={isSelected ? 'fill-accent' : 'fill-muted group-hover:fill-accent'}
                  />
                  {/* Right anchor circle */}
                  <circle
                    cx={98}
                    cy={y}
                    r={isSelected ? 3.5 : 2.5}
                    className={isSelected ? 'fill-accent' : 'fill-muted group-hover:fill-accent'}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right Relation Card */}
        <div className="bg-surface border border-border rounded p-3 space-y-2">
          <div className="flex items-center gap-1.5 font-mono text-secondary font-medium border-b border-border pb-1">
            <Table size={12} className="text-accent" />
            <span>RIGHT RELATION: {rightTableName}</span>
          </div>
          <div className="space-y-1.5 font-mono">
            {matches.length === 0 ? (
              <div className="p-3 text-center text-muted font-mono text-[11px]">No matching tuples found</div>
            ) : (
              matches.map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedMatch(m)}
                  className={`p-2 rounded border cursor-pointer transition-colors min-h-[50px] flex flex-col justify-center ${
                    activeMatch === m
                      ? 'bg-accent/15 border-accent text-primary font-semibold'
                      : 'bg-surface-secondary border-border text-secondary hover:text-primary'
                  }`}
                >
                  <div className="text-[10px] text-muted">Row #{m.rightRowId}</div>
                  <div className="truncate">
                    {String(m.rightValues['score'] ?? m.rightValues['title'] ?? JSON.stringify(m.rightValues))}
                  </div>
                </div>
              ))
            )}

            {/* Unmatched Right Rows (Outer Joins) */}
            {unmatchedRight && unmatchedRight.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <div className="text-[10px] uppercase font-mono text-muted flex items-center gap-1">
                  <AlertCircle size={10} className="text-warning" />
                  <span>Unmatched Right Rows ({unmatchedRight.length})</span>
                </div>
                {unmatchedRight.map((row, idx) => (
                  <div
                    key={`unmatched-r-${idx}`}
                    className="p-2 rounded border border-dashed border-border/70 bg-surface-secondary/40 text-muted font-mono min-h-[46px] flex flex-col justify-center"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span>Unmatched #{idx + 1}</span>
                      <span className="text-warning text-[9px] px-1 py-0.5 rounded bg-warning/10 border border-warning/20">
                        NULL Padded
                      </span>
                    </div>
                    <div className="truncate text-secondary" title={JSON.stringify(row)}>
                      {String(row['title'] ?? row['name'] ?? Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(', '))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Join Match Details Inspector */}
      {activeMatch ? (
        <div className="bg-surface border border-border p-3 rounded font-mono space-y-2">
          <div className="flex items-center justify-between text-success text-[11px]">
            <div className="flex items-center gap-1">
              <CheckCircle2 size={13} />
              <span>PREDICATE EVALUATION: {activeMatch.joinPredicate ?? 'Equality Match'}</span>
            </div>
            <span className="font-bold">RESULT: MATCH</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-[11px] text-secondary">
            <div>
              <span className="text-muted">Left Value:</span> {JSON.stringify(activeMatch.leftValues)}
            </div>
            <div>
              <span className="text-muted">Right Value:</span> {JSON.stringify(activeMatch.rightValues)}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-border p-3 rounded font-mono text-center text-muted text-[11px]">
          No matching tuples found or select a tuple to inspect predicate evaluation.
        </div>
      )}
    </div>
  );
};
