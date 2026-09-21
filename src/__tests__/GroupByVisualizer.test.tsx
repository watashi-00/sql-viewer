import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { GroupByVisualizer } from '../visualizer/GroupByVisualizer';
import { GroupBucket } from '../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('GroupByVisualizer Component', () => {
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

  const mockBuckets: GroupBucket[] = [
    {
      groupKey: 'Inception',
      rows: [
        { title: 'Inception', score: 9 },
        { title: 'Inception', score: 8 },
      ],
      aggregates: [
        {
          funcName: 'AVG',
          expression: 'r.score',
          inputValues: [9, 8],
          formulaStep: '(9 + 8) / 2',
          finalValue: 8.5,
        },
      ],
      havingPassed: true,
      havingPredicate: 'AVG(r.score) >= 8.0',
    },
    {
      groupKey: 'Interstellar',
      rows: [
        { title: 'Interstellar', score: 10 },
      ],
      aggregates: [
        {
          funcName: 'COUNT',
          expression: '*',
          inputValues: [1],
          formulaStep: 'COUNT(1)',
          finalValue: 1,
        },
        {
          funcName: 'SUM',
          expression: 'r.score',
          inputValues: [10],
          formulaStep: '10',
          finalValue: 10,
        },
      ],
      havingPassed: false,
      havingPredicate: 'AVG(r.score) >= 8.0',
    },
  ];

  it('renders group bucket keys and aggregate formulas', () => {
    render(<GroupByVisualizer buckets={mockBuckets} />);
    expect(screen.getByText(/GROUP: Inception/i)).toBeDefined();
    expect(screen.getByText(/AVG\(r\.score\)/i)).toBeDefined();
    expect(screen.getByText(/8\.5/i)).toBeDefined();
    expect(screen.getByText(/Formula:/i)).toBeDefined();
    expect(screen.getByText(/\(9 \+ 8\) \/ 2/i)).toBeDefined();
  });

  it('renders partition header with bucket count', () => {
    render(<GroupByVisualizer buckets={mockBuckets} />);
    expect(screen.getByText(/GROUP BY PARTITIONS \(2 Buckets\)/i)).toBeDefined();
  });

  it('renders row counts for each partition', () => {
    render(<GroupByVisualizer buckets={mockBuckets} />);
    expect(screen.getByText(/2 rows/i)).toBeDefined();
    expect(screen.getByText(/1 rows/i)).toBeDefined();
  });

  it('renders PASSED badge for buckets that satisfy HAVING predicate', () => {
    render(<GroupByVisualizer buckets={mockBuckets} />);
    expect(screen.getByText(/PASSED/i)).toBeDefined();
  });

  it('renders REJECTED badge for buckets that fail HAVING predicate', () => {
    render(<GroupByVisualizer buckets={mockBuckets} />);
    expect(screen.getByText(/REJECTED/i)).toBeDefined();
  });

  it('renders havingPredicate when present on a bucket', () => {
    render(<GroupByVisualizer buckets={mockBuckets} />);
    expect(screen.getByText(/HAVING:/i)).toBeDefined();
    expect(screen.getByText(/AVG\(r\.score\) >= 8\.0/i)).toBeDefined();
  });

  it('renders multiple aggregates within a single bucket', () => {
    render(<GroupByVisualizer buckets={mockBuckets} />);
    expect(screen.getByText(/COUNT\(\*\)/i)).toBeDefined();
    expect(screen.getByText(/SUM\(r\.score\)/i)).toBeDefined();
    expect(screen.getByText(/COUNT\(1\)/i)).toBeDefined();
  });

  it('displays rejectedBuckets and rejectedGroupBuckets seamlessly', () => {
    const passedOnly: GroupBucket[] = [mockBuckets[0]];
    const rejectedOnly: GroupBucket[] = [mockBuckets[1]];

    render(<GroupByVisualizer buckets={passedOnly} rejectedGroupBuckets={rejectedOnly} />);
    expect(screen.getByText(/GROUP BY PARTITIONS \(2 Buckets\)/i)).toBeDefined();
    expect(screen.getByText(/GROUP: Inception/i)).toBeDefined();
    expect(screen.getByText(/GROUP: Interstellar/i)).toBeDefined();
    expect(screen.getByText(/PASSED/i)).toBeDefined();
    expect(screen.getByText(/REJECTED/i)).toBeDefined();
  });

  it('handles empty buckets list gracefully with empty state notice', () => {
    render(<GroupByVisualizer buckets={[]} />);
    expect(screen.getByText(/GROUP BY PARTITIONS \(0 Buckets\)/i)).toBeDefined();
    expect(screen.getByText(/No group partitions found\./i)).toBeDefined();
  });

  it('renders gracefully when buckets prop is undefined', () => {
    render(<GroupByVisualizer />);
    expect(screen.getByText(/GROUP BY PARTITIONS \(0 Buckets\)/i)).toBeDefined();
    expect(screen.getByText(/No group partitions found\./i)).toBeDefined();
  });

  it('renders fallback when bucket has no aggregate calculations', () => {
    const bucketNoAgg: GroupBucket[] = [
      {
        groupKey: 'Sci-Fi',
        rows: [{ title: 'Inception' }],
        aggregates: [],
      },
    ];
    render(<GroupByVisualizer buckets={bucketNoAgg} />);
    expect(screen.getByText(/GROUP: Sci-Fi/i)).toBeDefined();
    expect(screen.getByText(/No aggregate calculations/i)).toBeDefined();
  });
});
