import React from 'react';
import { ExplainNode } from '../types';
import { ChevronDown, ChevronRight, Clock, BarChart3 } from 'lucide-react';
import { getOperatorColorClass } from './explainTreeStyles';

interface ExplainNodeCardProps {
  node: ExplainNode;
  selectedNode: ExplainNode | null;
  collapsedNodes: Set<string>;
  onSelect: (node: ExplainNode) => void;
  onToggleCollapse: (nodeId: string) => void;
  depth?: number;
}

export const ExplainNodeCard: React.FC<ExplainNodeCardProps> = ({
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
    <div className="flex flex-col gap-1.5 relative">
      <div
        role="button"
        tabIndex={0}
        data-testid={`operator-node-${node.id}`}
        onClick={() => onSelect(node)}
        className={`p-2 rounded border font-mono transition-all cursor-pointer ${
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
            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${colorClass}`}>
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
          <div className="mt-1 text-[11px] text-primary truncate font-sans" title={node.description}>
            {node.description}
          </div>
        )}
      </div>

      {hasChildren && !isCollapsed && (
        <div className="pl-4 border-l border-border/60 ml-2 space-y-1.5 pt-0.5">
          {node.children.map((child) => (
            <ExplainNodeCard
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
