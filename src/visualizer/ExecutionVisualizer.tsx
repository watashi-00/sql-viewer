import React from 'react';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { PredicateTree } from './PredicateTree';
import { JoinVisualizer } from './JoinVisualizer';
import { GroupByVisualizer } from './GroupByVisualizer';
import { DistinctVisualizer } from './DistinctVisualizer';
import { Play, SkipBack, SkipForward, RotateCcw, CheckCircle2, Circle, ArrowRight } from 'lucide-react';

export const ExecutionVisualizer: React.FC = () => {
  const {
    executionPlan,
    stages,
    currentStageIndex,
    stepForward,
    stepBack,
    restartDebug,
    runQuery,
    jumpToStage,
    debugState,
  } = useWorkspaceStore();

  const currentEvent = executionPlan?.events[currentStageIndex];

  return (
    <div className="h-full w-full flex flex-col bg-base text-primary font-sans select-none border-b border-border">
      {/* Visualizer Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface border-b border-border text-xs">
        <div className="flex items-center gap-2 font-mono">
          <span className="text-secondary font-semibold">SQL DEBUGGER</span>
          <span className="px-1.5 py-0.5 rounded bg-surface-secondary border border-border text-accent text-[10px] uppercase">
            {debugState}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={restartDebug}
            disabled={!executionPlan}
            className="p-1 rounded hover:bg-surface-secondary text-secondary hover:text-primary disabled:opacity-40"
            title="Restart (Ctrl+R)"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={stepBack}
            disabled={!executionPlan || currentStageIndex === 0}
            className="p-1 rounded hover:bg-surface-secondary text-secondary hover:text-primary disabled:opacity-40"
            title="Step Back (Shift+F10)"
          >
            <SkipBack size={14} />
          </button>
          <button
            onClick={stepForward}
            disabled={!executionPlan || currentStageIndex >= stages.length - 1}
            className="p-1 rounded hover:bg-surface-secondary text-secondary hover:text-primary disabled:opacity-40"
            title="Step Forward (F10)"
          >
            <SkipForward size={14} />
          </button>
          <button
            onClick={runQuery}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-accent text-base font-semibold hover:bg-accent/90"
            title="Run Query (F5)"
          >
            <Play size={12} fill="currentColor" />
            <span>Run</span>
          </button>
        </div>
      </div>

      {/* Stage Pipeline Node Bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-surface border-b border-border overflow-x-auto">
        {stages.length === 0 ? (
          <div className="text-xs text-muted font-mono">No query executed. Press Run to start debugging pipeline.</div>
        ) : (
          stages.map((stg, idx) => {
            const isActive = idx === currentStageIndex;
            const isDone = idx < currentStageIndex;

            return (
              <React.Fragment key={`${stg}-${idx}`}>
                <div
                  onClick={() => jumpToStage(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono cursor-pointer transition-all ${
                    isActive
                      ? 'bg-accent/15 border-accent text-accent font-bold shadow-sm'
                      : isDone
                      ? 'bg-surface-secondary border-border text-success'
                      : 'bg-surface border-border text-muted hover:text-secondary'
                  }`}
                >
                  {isDone ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                  <span>{stg}</span>
                </div>
                {idx < stages.length - 1 && <ArrowRight size={12} className="text-muted shrink-0" />}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Stage Detail Card & Visualizer Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-base flex flex-col gap-4">
        {currentEvent ? (
          <div className="bg-surface border border-border rounded p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div>
                <h3 className="text-sm font-semibold text-primary">{currentEvent.title}</h3>
                <p className="text-xs text-secondary">{currentEvent.description}</p>
              </div>
              {currentEvent.durationMs !== undefined && (
                <span className="text-xs font-mono text-muted">{currentEvent.durationMs} ms</span>
              )}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3 text-xs font-mono">
              <div className="bg-surface-secondary border border-border p-2.5 rounded">
                <div className="text-muted text-[10px]">INPUT ROWS</div>
                <div className="text-lg font-bold text-primary">{currentEvent.inputRows.length}</div>
              </div>
              <div className="bg-surface-secondary border border-border p-2.5 rounded">
                <div className="text-muted text-[10px]">OUTPUT ROWS</div>
                <div className="text-lg font-bold text-success">{currentEvent.outputRows.length}</div>
              </div>
              <div className="bg-surface-secondary border border-border p-2.5 rounded">
                <div className="text-muted text-[10px]">REJECTED ROWS</div>
                <div className="text-lg font-bold text-error">{currentEvent.rejectedRows?.length ?? 0}</div>
              </div>
            </div>

            {/* Predicate Tree display for WHERE */}
            {currentEvent.predicateTree && (
              <div className="space-y-1">
                <div className="text-xs font-mono text-muted uppercase">Predicate Evaluation Tree</div>
                <PredicateTree node={currentEvent.predicateTree} />
              </div>
            )}

            {currentEvent.stage === 'JOIN' && (
              <JoinVisualizer matches={currentEvent.joinMatches} />
            )}

            {(currentEvent.stage === 'GROUP BY' || currentEvent.stage === 'HAVING') && (
              <GroupByVisualizer buckets={currentEvent.groupBuckets} />
            )}

            {currentEvent.stage === 'DISTINCT' && (
              <DistinctVisualizer
                inputCount={currentEvent.inputRows.length}
                outputCount={currentEvent.outputRows.length}
                duplicatesRemoved={currentEvent.distinctDuplicatesRemoved ?? (currentEvent.inputRows.length - currentEvent.outputRows.length)}
              />
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-muted font-mono">
            Execute a query to inspect logical stage step transformations.
          </div>
        )}
      </div>
    </div>
  );
};
