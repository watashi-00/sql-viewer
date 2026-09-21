import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { SubqueryVisualizer } from '../visualizer/SubqueryVisualizer';
import { SubqueryResolution } from '../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('SubqueryVisualizer Component', () => {
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

  const mockResolutions: SubqueryResolution[] = [
    {
      id: 'sub-1',
      type: 'scalar',
      rawQuery: 'SELECT AVG(score) FROM reviews',
      resolvedValue: 8.5,
      parentClause: 'WHERE',
    },
  ];

  it('renders subquery raw query and resolved value badge', () => {
    render(<SubqueryVisualizer resolutions={mockResolutions} />);
    expect(screen.getByText(/SELECT AVG\(score\)/i)).toBeDefined();
    expect(screen.getByText(/8.5/i)).toBeDefined();
  });

  it('renders set subquery with resolved set values', () => {
    const setResolutions: SubqueryResolution[] = [
      {
        id: 'sub-2',
        type: 'set',
        rawQuery: 'SELECT movie_id FROM reviews WHERE score >= 8',
        resolvedSet: [101, 102, 105],
        parentClause: 'WHERE',
      },
    ];

    render(<SubqueryVisualizer resolutions={setResolutions} />);
    expect(screen.getByText(/SELECT movie_id FROM reviews/i)).toBeDefined();
    expect(screen.getByText(/SET \(IN\)/i)).toBeDefined();
    expect(screen.getByText(/101/i)).toBeDefined();
    expect(screen.getByText(/102/i)).toBeDefined();
    expect(screen.getByText(/105/i)).toBeDefined();
  });

  it('renders exists subquery with resolved boolean result', () => {
    const existsResolutions: SubqueryResolution[] = [
      {
        id: 'sub-3',
        type: 'exists',
        rawQuery: 'SELECT 1 FROM reviews WHERE movie_id = m.movie_id',
        existsResult: true,
        parentClause: 'WHERE',
      },
    ];

    render(<SubqueryVisualizer resolutions={existsResolutions} />);
    expect(screen.getByText(/SELECT 1 FROM reviews/i)).toBeDefined();
    expect(screen.getByText(/EXISTS/i)).toBeDefined();
    expect(screen.getByText(/TRUE/i)).toBeDefined();
  });

  it('renders empty state when resolutions is empty or omitted', () => {
    render(<SubqueryVisualizer resolutions={[]} />);
    expect(screen.getByText(/No subquery resolutions/i)).toBeDefined();

    render(<SubqueryVisualizer />);
    expect(screen.getByText(/No subquery resolutions/i)).toBeDefined();
  });
});
