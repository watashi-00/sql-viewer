import React, { useState } from 'react';
import { ExplainNode } from '../types';
import { GitFork, ChevronDown, ChevronRight, Clock, BarChart3, Cpu, Info } from 'lucide-react';

export interface ExplainTreeVisualizerProps {
  rootNode?: ExplainNode;
  onSelectNode?: (node: ExplainNode) => void;
}

const getOperatorColorClass = (opType: string): string => {
  const upper = opType.toUpperCase();
  if (upper.includes('JOIN')) {
    return 'bg-purple-500/15 text-purple-400 border-purple-500/40';
  }
  if (upper.includes('SCAN')) {
    return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40';
  }
  if (upper.includes('FILTER') || upper.includes('PROJECTION')) {
    return 'bg-amber-500/15 text-amber-400 border-amber-500/40';
  }
  if (upper.includes('AGG') || upper.includes('GROUP')) {
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';
  }
  return 'bg-accent/15 text-accent border-accent/40';
};

interface NodeCardProps {
  node: ExplainNode;
  selectedNode: ExplainNode | null;
  collapsedNodes: Set<string>;
  onSelect: (node: ExplainNode) => void;
  onToggleCollapse: (nodeId: string) => void;
  depth?: number;
}

const NodeCard: React.FC<NodeCardProps> = ({
  node,
  selectedNode,
  collapsedNodes,
  onSelect,
  onToggleCollapse,
  depth = 0,
}) => {
  const isSelected = selectedNode?.id === node.id;
  const isCollapsed = collapsedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const colorClass = getOperatorColorClass(node.operatorType);

  return (
    <div className="flex flex-col gap-2 relative">
      <div
        role="button"
        tabIndex={0}
        data-testid={`operator-node-${node.id}`}
        onClick={() => onSelect(node)}
        className={`p-3 rounded border font-mono transition-all cursor-pointer ${
          isSelected
            ? 'bg-surface border-accent shadow-md ring-1 ring-accent/50'
            : 'bg-surface border-border hover:border-secondary'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {hasChildren && (
              <button
                type="button"
                aria-label="Toggle children"
                data-testid={`toggle-${node.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(node.id);
                }}
                className="p-0.5 rounded hover:bg-surface-secondary text-secondary hover:text-primary transition-colors"
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            <span className={`px-2 py-0.5 text-xs font-bold rounded border ${colorClass}`}>
              {node.operatorType}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-secondary">
            {node.timingMs !== undefined && (
              <div className="flex items-center gap-1 font-mono text-muted">
                <Clock size={11} className="text-accent" />
                <span>{node.timingMs} ms</span>
              </div>
            )}
            {node.cardinality !== undefined && (
              <div className="flex items-center gap-1 font-mono text-muted">
                <BarChart3 size={11} className="text-success" />
                <span>{node.cardinality} rows</span>
              </div>
            )}
          </div>
        </div>

        {node.description && (
          <div className="mt-2 text-xs text-primary truncate font-sans" title={node.description}>
            {node.description}
          </div>
        )}
      </div>

      {hasChildren && !isCollapsed && (
        <div className="pl-6 border-l-2 border-border/60 ml-3 space-y-2.5 pt-1">
          {node.children.map((child) => (
            <NodeCard
              key={child.id}
              node={child}
              selectedNode={selectedNode}
              collapsedNodes={collapsedNodes}
              onSelect={onSelect}
              onToggleCollapse={onToggleCollapse}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

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
    <div className="flex flex-col gap-4 bg-surface-secondary border border-border p-4 rounded font-sans text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div className="flex items-center gap-2 font-mono font-semibold text-primary">
          <GitFork size={14} className="text-accent" />
          <span>EXPLAIN OPERATOR TREE</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted">
          <Cpu size={12} className="text-accent" />
          <span>DuckDB Physical Plan</span>
        </div>
      </div>

      {/* Hierarchical Operator Graph Tree */}
      <div className="space-y-3 overflow-x-auto">
        <NodeCard
          node={rootNode}
          selectedNode={activeSelected}
          collapsedNodes={collapsedNodes}
          onSelect={handleSelect}
          onToggleCollapse={handleToggleCollapse}
        />
      </div>

      {/* Selected Node Details Inspector */}
      {activeSelected && (
        <div className="bg-surface border border-border rounded p-3 font-mono space-y-2 mt-2">
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
      )}
    </div>
  );
};
