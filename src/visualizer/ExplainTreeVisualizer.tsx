import React, { useEffect, useMemo, useState } from 'react';
import { ExplainNode } from '../types';
import { GitFork, Info, Maximize2, Minimize2 } from 'lucide-react';
import { ExplainNodeCard } from './ExplainNodeCard';

export interface ExplainTreeVisualizerProps {
  rootNode?: ExplainNode;
  onSelectNode?: (node: ExplainNode) => void;
}

const collectNodeIds = (node: ExplainNode): string[] => [
  node.id,
  ...node.children.flatMap(collectNodeIds),
];

export const ExplainTreeVisualizer: React.FC<ExplainTreeVisualizerProps> = ({
  rootNode,
  onSelectNode,
}) => {
  const [selectedNode, setSelectedNode] = useState<ExplainNode | null>(rootNode ?? null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedNode(rootNode ?? null);
    setCollapsedNodes(new Set());
  }, [rootNode]);

  const allNodeIds = useMemo(() => rootNode ? collectNodeIds(rootNode) : [], [rootNode]);
  const activeSelected = selectedNode ?? rootNode;

  const handleSelect = (node: ExplainNode) => {
    setSelectedNode(node);
    onSelectNode?.(node);
  };

  const handleToggleCollapse = (nodeId: string) => {
    setCollapsedNodes((previous) => {
      const next = new Set(previous);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  if (!rootNode) {
    return (
      <section className="flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-4 font-sans text-xs">
        <div className="flex items-center gap-2 font-mono font-semibold text-primary">
          <GitFork size={15} className="text-accent" />
          <h3>EXPLAIN OPERATOR TREE</h3>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-secondary/50 p-6 text-center">
          <GitFork size={22} className="text-muted" />
          <p className="font-medium text-secondary">No physical EXPLAIN plan available.</p>
          <p className="max-w-xs text-muted">Run a query to inspect the operators DuckDB selected to produce its result.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface font-sans text-xs">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <GitFork size={15} className="shrink-0 text-accent" />
          <div className="min-w-0">
            <h3 className="font-mono font-semibold text-primary">EXPLAIN OPERATOR TREE</h3>
            <p className="mt-0.5 text-[10px] text-muted">Start at the result; follow child nodes toward the scans.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted">
          <span className="rounded-full bg-surface-secondary px-2 py-1">{allNodeIds.length} operators</span>
          <button
            type="button"
            onClick={() => setCollapsedNodes(new Set())}
            className="rounded-md border border-border bg-surface-secondary p-1.5 text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title="Expand all operators"
            aria-label="Expand all operators"
          >
            <Maximize2 size={12} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsedNodes(new Set(allNodeIds))}
            className="rounded-md border border-border bg-surface-secondary p-1.5 text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title="Collapse all operators"
            aria-label="Collapse all operators"
          >
            <Minimize2 size={12} />
          </button>
        </div>
      </header>

      <div aria-label="Physical plan operators" className="min-h-0 flex-1 overflow-auto bg-base/40 p-3">
        <div className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-widest text-muted">Result</div>
        <ExplainNodeCard
          node={rootNode}
          selectedNode={activeSelected ?? null}
          collapsedNodes={collapsedNodes}
          onSelect={handleSelect}
          onToggleCollapse={handleToggleCollapse}
        />
      </div>

      {activeSelected && (
        <section aria-label="Selected operator details" className="shrink-0 border-t border-border bg-surface px-3 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wide text-secondary">
            <Info size={12} className="text-accent" />
            <span>SELECTED OPERATOR DETAILS</span>
          </div>
          <p className="text-[11px] leading-relaxed text-primary" title={activeSelected.description}>
            {activeSelected.description || 'No operator description'}
          </p>
          <div className="mt-1.5 font-mono text-[10px] text-muted">Node ID: {activeSelected.id}</div>
        </section>
      )}
    </section>
  );
};
