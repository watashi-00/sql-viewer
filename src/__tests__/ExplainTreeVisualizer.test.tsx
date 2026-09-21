import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ExplainTreeVisualizer } from '../visualizer/ExplainTreeVisualizer';
import { ExplainNode } from '../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('ExplainTreeVisualizer Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const render = (ui: React.ReactElement) => {
    act(() => {
      root.render(ui);
    });
  };

  const screen = {
    getByText: (matcher: string | RegExp) => {
      const all = Array.from(container.querySelectorAll('*'));
      for (const el of all) {
        const text = el.textContent || '';
        const matches = typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text);
        if (matches) {
          const childMatches = Array.from(el.children).some((child) => {
            const childText = child.textContent || '';
            return typeof matcher === 'string' ? childText.includes(matcher) : matcher.test(childText);
          });
          if (!childMatches) {
            return el;
          }
        }
      }
      for (const el of all) {
        const text = el.textContent || '';
        if (typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text)) {
          return el;
        }
      }
      throw new Error(`Unable to find element with text matching ${matcher}`);
    },
    queryByText: (matcher: string | RegExp) => {
      try {
        return screen.getByText(matcher);
      } catch {
        return null;
      }
    },
  };

  const fireEvent = {
    click: (element: Element) => {
      act(() => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    },
  };

  const mockTree: ExplainNode = {
    id: 'node-1',
    operatorType: 'HASH_JOIN',
    description: 'JOIN ON r.movie_id = m.movie_id',
    timingMs: 2.5,
    cardinality: 10,
    children: [
      {
        id: 'node-2',
        operatorType: 'SEQ_SCAN',
        description: 'Scan table ratings r',
        timingMs: 1.2,
        cardinality: 100,
        children: [],
      },
      {
        id: 'node-3',
        operatorType: 'FILTER',
        description: 'r.rating > 8.0',
        timingMs: 0.8,
        cardinality: 25,
        children: [
          {
            id: 'node-4',
            operatorType: 'AGGREGATE',
            description: 'Group by genre',
            timingMs: 0.5,
            cardinality: 5,
            children: [],
          },
        ],
      },
    ],
  };

  it('renders operator node cards and metrics', () => {
    render(<ExplainTreeVisualizer rootNode={mockTree} />);
    expect(screen.getByText(/HASH_JOIN/i)).toBeDefined();
    expect(screen.getByText(/2\.5/i)).toBeDefined();
    expect(screen.getByText(/10 rows/i)).toBeDefined();
  });

  it('renders child operator nodes hierarchically', () => {
    render(<ExplainTreeVisualizer rootNode={mockTree} />);
    expect(screen.getByText(/SEQ_SCAN/i)).toBeDefined();
    expect(screen.getByText(/FILTER/i)).toBeDefined();
    expect(screen.getByText(/AGGREGATE/i)).toBeDefined();
    expect(screen.getByText(/Scan table ratings r/i)).toBeDefined();
  });

  it('applies color coding badges based on operator type', () => {
    render(<ExplainTreeVisualizer rootNode={mockTree} />);
    
    const hashJoinBadge = screen.getByText(/HASH_JOIN/i);
    expect(hashJoinBadge.className).toMatch(/purple/i);

    const seqScanBadge = screen.getByText(/SEQ_SCAN/i);
    expect(seqScanBadge.className).toMatch(/cyan/i);

    const filterBadge = screen.getByText(/FILTER/i);
    expect(filterBadge.className).toMatch(/amber/i);

    const aggregateBadge = screen.getByText(/AGGREGATE/i);
    expect(aggregateBadge.className).toMatch(/emerald/i);
  });

  it('renders empty fallback when rootNode is undefined', () => {
    render(<ExplainTreeVisualizer rootNode={undefined} />);
    expect(screen.getByText(/No physical EXPLAIN plan available/i)).toBeDefined();
  });

  it('allows selecting an operator node to view details', () => {
    render(<ExplainTreeVisualizer rootNode={mockTree} />);
    const scanNodeBadge = screen.getByText(/SEQ_SCAN/i);
    const nodeCard = scanNodeBadge.closest('[data-testid="operator-node-node-2"]');
    if (nodeCard) {
      fireEvent.click(nodeCard);
      expect(screen.getByText(/SELECTED OPERATOR DETAILS/i)).toBeDefined();
      expect(container.textContent).toContain('Scan table ratings r');
    }
  });

  it('allows collapsing and expanding node children', () => {
    render(<ExplainTreeVisualizer rootNode={mockTree} />);
    expect(screen.getByText(/AGGREGATE/i)).toBeDefined();

    const collapseBtn = container.querySelector('[data-testid="toggle-node-3"]');
    if (collapseBtn) {
      fireEvent.click(collapseBtn);
      expect(screen.queryByText(/AGGREGATE/i)).toBeNull();
      fireEvent.click(collapseBtn);
      expect(screen.getByText(/AGGREGATE/i)).toBeDefined();
    }
  });
});
