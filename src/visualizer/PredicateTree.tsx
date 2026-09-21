import React from 'react';
import { PredicateNode } from '../types';

interface Props {
  node?: PredicateNode;
}

export const PredicateTree: React.FC<Props> = ({ node }) => {
  if (!node) return null;

  return (
    <div className="flex flex-col items-center bg-surface-secondary border border-border p-2 rounded text-xs font-mono">
      {node.type === 'binary' ? (
        <div className="flex flex-col items-center space-y-1">
          <span className="px-2 py-0.5 bg-accent/20 text-accent font-bold rounded">{node.operator}</span>
          <div className="flex items-center gap-4 pt-1">
            {node.left && <PredicateTree node={node.left} />}
            {node.right && <PredicateTree node={node.right} />}
          </div>
        </div>
      ) : node.type === 'column' ? (
        <span className="text-info">{node.columnName}</span>
      ) : (
        <span className="text-success">{String(node.value)}</span>
      )}
    </div>
  );
};
