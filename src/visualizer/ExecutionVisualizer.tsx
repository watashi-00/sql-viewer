import React, { useState } from 'react';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { PredicateTree } from './PredicateTree';
import { JoinVisualizer } from './JoinVisualizer';
import { GroupByVisualizer } from './GroupByVisualizer';
import { DistinctVisualizer } from './DistinctVisualizer';
import { CteVisualizer } from './CteVisualizer';
import { SubqueryVisualizer } from './SubqueryVisualizer';
import { ExplainTreeVisualizer } from './ExplainTreeVisualizer';
import { Play, SkipBack, SkipForward, RotateCcw, CheckCircle2, ArrowRight } from 'lucide-react';

export type DebuggerDockPosition = 'right' | 'bottom';

export interface ExecutionVisualizerProps {
  dockPosition?: DebuggerDockPosition;
  onDockPositionChange?: (position: DebuggerDockPosition) => void;
  onClose?: () => void;
}

export const ExecutionVisualizer: React.FC<ExecutionVisualizerProps> = ({
  dockPosition = 'right',
  onDockPositionChange,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'relational' | 'explain'>('relational');
  const [activeCteScopeId, setActiveCteScopeId] = useState<string>('main');

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
  const stageOutcome = currentEvent?.rejectedRows !== undefined
    ? { label: 'REJECTED ROWS', value: currentEvent.rejectedRows.length }
    : currentEvent?.distinctDuplicatesRemoved !== undefined
    ? { label: 'DUPLICATES REMOVED', value: currentEvent.distinctDuplicatesRemoved }
    : currentEvent?.rejectedGroupBuckets !== undefined
    ? { label: 'REJECTED GROUPS', value: currentEvent.rejectedGroupBuckets.length }
    : undefined;

  return (
    <div className="h-full w-full flex flex-col bg-base text-primary font-sans select-none border-b border-border">
      {/* Visualizer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-surface border-b border-border text-xs">
        <div className="flex items-center gap-2 font-mono">
          <span className="text-secondary font-semibold">SQL DEBUGGER</span>
          <span className="px-1.5 py-0.5 rounded bg-surface-secondary border border-border text-accent text-[10px] uppercase">
            {debugState}
          </span>
        </div>

        {/* View Mode Toggle Switch */}
        <div role="group" aria-label="Debugger view mode" className="flex items-center bg-surface-secondary p-0.5 rounded border border-border">
          <button
            type="button"
            aria-pressed={viewMode === 'relational'}
            onClick={() => setViewMode('relational')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-all ${
              viewMode === 'relational'
                ? 'bg-accent/20 text-accent font-bold shadow-sm border border-accent/40'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Relational Pipeline
          </button>
          <button
            type="button"
            aria-pressed={viewMode === 'explain'}
            onClick={() => setViewMode('explain')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-all ${
              viewMode === 'explain'
                ? 'bg-accent/20 text-accent font-bold shadow-sm border border-accent/40'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Physical EXPLAIN Tree
          </button>
        </div>

        <div className="flex items-center gap-1">
          {onDockPositionChange && (
            <div role="group" aria-label="SQL debugger position" className="mr-1 flex items-center rounded border border-border bg-surface-secondary p-0.5">
              <button
                type="button"
                aria-pressed={dockPosition === 'right'}
                onClick={() => onDockPositionChange('right')}
                title="Dock SQL Debugger to the right"
                className={`rounded px-1.5 py-1 text-[10px] transition-colors ${dockPosition === 'right' ? 'bg-accent/20 text-accent' : 'text-muted hover:text-primary'}`}
              >
                Right
              </button>
              <button
                type="button"
                aria-pressed={dockPosition === 'bottom'}
                onClick={() => onDockPositionChange('bottom')}
                title="Dock SQL Debugger below the editor"
                className={`rounded px-1.5 py-1 text-[10px] transition-colors ${dockPosition === 'bottom' ? 'bg-accent/20 text-accent' : 'text-muted hover:text-primary'}`}
              >
                Bottom
              </button>
            </div>
          )}
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
            onClick={() => void runQuery()}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-accent text-base font-semibold hover:bg-accent/90"
            title="Run Query (F5)"
          >
            <Play size={12} fill="currentColor" />
            <span>Run</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close SQL Debugger"
              title="Close SQL Debugger"
              className="rounded px-1.5 py-1 text-muted hover:bg-surface-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {viewMode === 'explain' ? (
        <div className="flex-1 p-4 overflow-y-auto bg-base">
          <ExplainTreeVisualizer rootNode={executionPlan?.explainTree} />
        </div>
      ) : (
        <>
          {/* Stage Pipeline Node Bar */}
          <div className="flex items-stretch gap-2 px-4 py-3 bg-surface border-b border-border overflow-x-auto">
            {stages.length === 0 ? (
              <div className="flex min-h-[64px] w-full items-center justify-center rounded-lg border border-dashed border-border bg-surface-secondary/50 px-4 text-center text-xs text-muted">
                No query executed. Press Run to start debugging pipeline.
              </div>
            ) : (
              stages.map((stg, idx) => {
                const isActive = idx === currentStageIndex;
                const isDone = idx < currentStageIndex;
                const stageEvent = executionPlan?.events[idx];

                return (
                  <React.Fragment key={`${stg}-${idx}`}>
                    <button
                      type="button"
                      aria-current={isActive ? 'step' : undefined}
                      aria-label={`${stg}, step ${idx + 1} of ${stages.length}, ${stageEvent?.outputRows.length ?? 0} output rows`}
                      onClick={() => jumpToStage(idx)}
                      className={`group flex min-w-[112px] cursor-pointer flex-col gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        isActive
                          ? 'bg-accent/10 border-accent/70 text-primary shadow-sm ring-1 ring-accent/20'
                          : isDone
                          ? 'bg-surface-secondary border-border text-primary hover:border-success/50'
                          : 'bg-base border-border text-secondary hover:border-secondary'
                      }`}
                    >
                      <span className="flex items-center gap-2 font-mono font-semibold">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                          isActive ? 'bg-accent text-base' : isDone ? 'bg-success/15 text-success' : 'bg-surface-secondary text-muted'
                        }`}>
                          {isDone ? <CheckCircle2 size={13} /> : idx + 1}
                        </span>
                        {stg}
                      </span>
                      <span className="flex items-baseline justify-between gap-2 border-t border-border/70 pt-1.5 font-mono">
                        <span className="text-[10px] text-muted">OUTPUT</span>
                        <span className={isActive ? 'text-accent' : 'text-secondary'}>
                          {stageEvent?.outputRows.length ?? 0} rows
                        </span>
                      </span>
                      {stageEvent?.durationMs !== undefined && (
                        <span className="text-right font-mono text-[10px] text-muted">{stageEvent.durationMs} ms</span>
                      )}
                    </button>
                    {idx < stages.length - 1 && (
                      <div className="flex min-w-4 items-center justify-center text-muted" aria-hidden="true">
                        <ArrowRight size={14} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </div>

          {/* Stage Detail Card & Visualizer Area */}
          <div className="flex-1 p-4 overflow-y-auto bg-base flex flex-col gap-4">
            {/* CTE Visualizer Scope Tabs (if CTE scopes present) */}
            {executionPlan?.cteScopes && executionPlan.cteScopes.length > 0 && (
              <CteVisualizer
                scopes={executionPlan.cteScopes}
                activeScopeId={activeCteScopeId}
                onSelectScope={(scopeId) => setActiveCteScopeId(scopeId || 'main')}
              />
            )}

            {currentEvent ? (
              <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3 border-b border-border pb-3">
                  <div className="min-w-0">
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                      Step {currentStageIndex + 1} of {stages.length}
                    </div>
                    <h3 className="text-sm font-semibold text-primary">{currentEvent.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-secondary">{currentEvent.description}</p>
                  </div>
                  {currentEvent.durationMs !== undefined && (
                    <span className="shrink-0 rounded-md bg-surface-secondary px-2 py-1 text-xs font-mono text-muted">
                      {currentEvent.durationMs} ms
                    </span>
                  )}
                </div>

                {/* Metrics */}
                <div className={`grid gap-2 text-xs font-mono ${stageOutcome ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <div className="rounded-lg border border-border bg-surface-secondary p-3">
                    <div className="text-muted text-[10px]">INPUT ROWS</div>
                    <div className="mt-1 text-xl font-bold text-primary">{currentEvent.inputRows.length}</div>
                  </div>
                  <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
                    <div className="text-muted text-[10px]">OUTPUT ROWS</div>
                    <div className="mt-1 text-xl font-bold text-accent">{currentEvent.outputRows.length}</div>
                  </div>
                  {stageOutcome && (
                    <div className="rounded-lg border border-border bg-surface-secondary p-3">
                      <div className="text-muted text-[10px]">{stageOutcome.label}</div>
                      <div className="mt-1 text-xl font-bold text-secondary">{stageOutcome.value}</div>
                    </div>
                  )}
                </div>

                {/* Predicate Tree display for WHERE */}
                {currentEvent.predicateTree && (
                  <div className="space-y-2 rounded-lg border border-border bg-base/70 p-3">
                    <div className="text-[10px] font-mono font-semibold tracking-wider text-muted uppercase">Predicate Evaluation Tree</div>
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

                {/* Subquery Visualizer Cards */}
                {currentEvent.subqueryResolutions && currentEvent.subqueryResolutions.length > 0 && (
                  <SubqueryVisualizer resolutions={currentEvent.subqueryResolutions} />
                )}
              </section>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-muted font-mono">
                Execute a query to inspect logical stage step transformations.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
