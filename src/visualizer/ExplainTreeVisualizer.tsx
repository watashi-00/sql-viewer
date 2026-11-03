import React, { useState } from 'react';
import { ExplainNode } from '../types';
import { GitFork, Info, Maximize2, Minimize2 } from 'lucide-react';
import { ExplainNodeCard } from './ExplainNodeCard';
import { getOperatorColorClass } from './explainTreeStyles';

export interface ExplainTreeVisualizerProps {
  rootNode?: ExplainNode;
  onSelectNode?: (node: ExplainNode) => void;
}

export const ExplainTreeVisualizer: React.FC<ExplainTreeVisualizerProps> = ({
  rootNode,
  onSelectNode,
}) => {
  const [selectedNode, setSelectedNode] = useState<ExplainNode | null>(rootNode ?? null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  const handleSelect = (node: ExplainNode) => {
    setSelectedNode(node);
    if (onSelectNode) {
      onSelectNode(node);
    }
  };

  const handleToggleCollapse = (nodeId: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const collectNodeIds = (node: ExplainNode): string[] => [
    node.id,
    ...node.children.flatMap(collectNodeIds),
  ];

  const allNodeIds = rootNode ? collectNodeIds(rootNode) : [];

  if (!rootNode) {
    return (
      <div className="flex flex-col gap-3 bg-surface-secondary border border-border p-4 rounded font-sans text-xs">
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <div className="flex items-center gap-2 font-mono font-semibold text-primary">
            <GitFork size={14} className="text-accent" />
            <span>EXPLAIN OPERATOR TREE</span>
          </div>
        </div>
        <div className="p-6 bg-surface border border-border rounded text-center text-muted font-mono text-xs">
          No physical EXPLAIN plan available.
        </div>
      </div>
    );
  }

  const activeSelected = selectedNode ?? rootNode;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 bg-surface-secondary border border-border p-3 rounded font-sans text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2 font-mono font-semibold text-primary">
          <GitFork size={14} className="text-accent" />
          <span>EXPLAIN OPERATOR TREE</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
          <span>{allNodeIds.length} operators</span>
          <button
            type="button"
            onClick={() => setCollapsedNodes(new Set())}
            className="p-1 rounded hover:bg-surface text-secondary hover:text-primary"
            title="Expand all operators"
            aria-label="Expand all operators"
          >
            <Maximize2 size={12} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsedNodes(new Set(allNodeIds))}
            className="p-1 rounded hover:bg-surface text-secondary hover:text-primary"
            title="Collapse all operators"
            aria-label="Collapse all operators"
          >
            <Minimize2 size={12} />
          </button>
        </div>
      </div>

      {/* Keep the selected node summary visible while the operator tree scrolls. */}
      {activeSelected && (
        <div className="shrink-0 bg-surface border border-border rounded px-2.5 py-2 font-mono">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Info size={12} className="shrink-0 text-accent" />
              <span className="text-[10px] text-muted uppercase">Selected</span>
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${getOperatorColorClass(activeSelected.operatorType)}`}>
                {activeSelected.operatorType}
              </span>
            </div>
            <span className="shrink-0 text-[10px] text-muted">
              {activeSelected.timingMs !== undefined ? `${activeSelected.timingMs} ms` : 'timing N/A'}
            </span>
          </div>
          <div className="mt-1 truncate text-[11px] text-primary" title={activeSelected.description}>
            {activeSelected.description || 'No operator description'}
          </div>
        </div>
      )}

      {/* Hierarchical Operator Graph Tree */}
      <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        <ExplainNodeCard
          node={rootNode}
          selectedNode={activeSelected}
          collapsedNodes={collapsedNodes}
          onSelect={handleSelect}
          onToggleCollapse={handleToggleCollapse}
        />
      </div>

      {/* Selected Node Details Inspector */}
      {activeSelected && (
        <details className="shrink-0 bg-surface border border-border rounded font-mono">
          <summary className="cursor-pointer list-none px-2.5 py-2 text-[10px] font-semibold text-secondary uppercase">
            Selected operator details
          </summary>
          <div className="space-y-2 border-t border-border px-2.5 py-2">
          <div className="flex items-center justify-between border-b border-border pb-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-accent font-semibold">
              <Info size={13} />
              <span>SELECTED OPERATOR DETAILS</span>
            </div>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getOperatorColorClass(activeSelected.operatorType)}`}>
              {activeSelected.operatorType}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
            <div>
              <span className="text-muted">Node ID:</span>{' '}
              <span className="text-primary font-semibold">{activeSelected.id}</span>
            </div>
            <div>
              <span className="text-muted">Description:</span>{' '}
              <span className="text-primary">{activeSelected.description || 'N/A'}</span>
            </div>
            <div>
              <span className="text-muted">Execution Timing:</span>{' '}
              <span className="text-primary">
                {activeSelected.timingMs !== undefined ? `${activeSelected.timingMs} ms` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-muted">Estimated Rows:</span>{' '}
              <span className="text-primary">
                {activeSelected.cardinality !== undefined ? `${activeSelected.cardinality} rows` : 'N/A'}
              </span>
            </div>
          </div>
          </div>
        </details>
      )}
    </div>
  );
};
