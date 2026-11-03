import React from 'react';
import { ExplainNode } from '../types';
import { ChevronDown, ChevronRight, Clock, Rows3 } from 'lucide-react';
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
  const hasChildren = node.children.length > 0;

  return (
    <div className="relative flex flex-col gap-2" data-depth={depth}>
      <div className="flex items-stretch gap-1.5">
        <div
          role="button"
          tabIndex={0}
          aria-pressed={isSelected}
          data-testid={`operator-node-${node.id}`}
          onClick={() => onSelect(node)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(node);
            }
          }}
          className={`min-w-0 flex-1 cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            isSelected
              ? 'border-accent/70 bg-accent/10 shadow-sm'
              : 'border-border bg-surface hover:border-secondary hover:bg-surface-secondary/70'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`rounded-md border px-2 py-1 font-mono text-[10px] font-bold ${getOperatorColorClass(node.operatorType)}`}>
              {node.operatorType}
            </span>
            <div className="flex shrink-0 items-center gap-3 font-mono text-[10px] text-muted">
              {node.cardinality !== undefined && (
                <span className="flex items-center gap-1" title="Estimated output cardinality">
                  <Rows3 size={11} className="text-success" />
                  ~{node.cardinality} rows
                </span>
              )}
              {node.timingMs !== undefined && (
                <span className="flex items-center gap-1" title="Operator timing">
                  <Clock size={11} className="text-accent" />
                  {node.timingMs} ms
                </span>
              )}
            </div>
          </div>

          <div className="mt-2 truncate text-[11px] text-primary" title={node.description}>
            {node.description || 'No operator description'}
          </div>
        </div>

        {hasChildren && (
          <button
            type="button"
            aria-label="Toggle children"
            aria-expanded={!isCollapsed}
            data-testid={`toggle-${node.id}`}
            onClick={() => onToggleCollapse(node.id)}
            className="flex w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-secondary transition-colors hover:border-secondary hover:bg-surface-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title={isCollapsed ? 'Show child operators' : 'Hide child operators'}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {hasChildren && !isCollapsed && (
        <div className="ml-4 flex flex-col gap-2 border-l border-border/80 py-1 pl-3">
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
