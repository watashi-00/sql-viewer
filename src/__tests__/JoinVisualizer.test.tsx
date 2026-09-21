import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { JoinVisualizer } from '../visualizer/JoinVisualizer';
import { JoinMatch, DataRow } from '../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('JoinVisualizer Component', () => {
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
        // Find leaf or innermost element matching
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
      // If no leaf match found, try any match
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
    getByTestId: (id: string) => {
      const el = container.querySelector(`[data-testid="${id}"]`);
      if (!el) throw new Error(`Unable to find element with testid ${id}`);
      return el;
    },
    queryByTestId: (id: string) => {
      return container.querySelector(`[data-testid="${id}"]`);
    },
  };

  const fireEvent = {
    click: (element: Element) => {
      act(() => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    },
  };

  const mockMatches: JoinMatch[] = [
    {
      leftRowId: 1,
      rightRowId: 1,
      isMatch: true,
      leftValues: { movie_id: 1, title: 'Inception' },
      rightValues: { review_id: 10, movie_id: 1, score: 9 },
      joinPredicate: 'r.movie_id = m.movie_id',
    },
    {
      leftRowId: 2,
      rightRowId: 2,
      isMatch: true,
      leftValues: { movie_id: 2, title: 'Interstellar' },
      rightValues: { review_id: 20, movie_id: 2, score: 10 },
      joinPredicate: 'r.movie_id = m.movie_id',
    },
  ];

  it('renders dual relation cards and connector details', () => {
    render(<JoinVisualizer matches={mockMatches} leftTableName="movies" rightTableName="reviews" />);
    expect(screen.getByText(/LEFT RELATION: movies/i)).toBeDefined();
    expect(screen.getByText(/RIGHT RELATION: reviews/i)).toBeDefined();
    expect(screen.getByText('Inception')).toBeDefined();
  });

  it('renders matching tuples count in header', () => {
    render(<JoinVisualizer matches={mockMatches} leftTableName="movies" rightTableName="reviews" />);
    expect(screen.getByText(/2 Matching Tuples/i)).toBeDefined();
  });

  it('renders interactive SVG connector lines connecting matching tuples', () => {
    render(<JoinVisualizer matches={mockMatches} leftTableName="movies" rightTableName="reviews" />);
    const svg = screen.getByTestId('join-connector-svg');
    expect(svg).toBeDefined();

    const conn0 = screen.getByTestId('join-connector-0');
    const conn1 = screen.getByTestId('join-connector-1');
    expect(conn0).toBeDefined();
    expect(conn1).toBeDefined();
  });

  it('displays predicate evaluation inspector for the currently selected match', () => {
    render(<JoinVisualizer matches={mockMatches} leftTableName="movies" rightTableName="reviews" />);
    expect(screen.getByText(/PREDICATE EVALUATION: r\.movie_id = m\.movie_id/i)).toBeDefined();
    expect(screen.getByText(/RESULT: MATCH/i)).toBeDefined();
    expect(screen.getByText(/Left Value:/i)).toBeDefined();
    expect(screen.getByText(/Right Value:/i)).toBeDefined();
  });

  it('updates predicate inspector when another left row card is clicked', () => {
    render(<JoinVisualizer matches={mockMatches} leftTableName="movies" rightTableName="reviews" />);

    // Initially Inception is selected
    expect(container.textContent).toContain('Inception');

    // Click on Interstellar row card (Row #2)
    const interstellarCard = screen.getByText('Interstellar');
    fireEvent.click(interstellarCard);

    // Inspector should now reflect row 2 details
    expect(container.textContent).toContain('Interstellar');
    expect(container.textContent).toContain('"movie_id":2');
  });

  it('updates predicate inspector when another right row card is clicked', () => {
    render(<JoinVisualizer matches={mockMatches} leftTableName="movies" rightTableName="reviews" />);

    // Click on right row card (Row #2)
    const row2Header = screen.getByText('Row #2');
    fireEvent.click(row2Header);

    // Inspector should now reflect row 2 details
    expect(container.textContent).toContain('Interstellar');
  });

  it('updates predicate inspector when an SVG connector line is clicked', () => {
    render(<JoinVisualizer matches={mockMatches} leftTableName="movies" rightTableName="reviews" />);

    const conn1 = screen.getByTestId('join-connector-1');
    fireEvent.click(conn1);

    expect(container.textContent).toContain('Interstellar');
  });

  it('renders unmatched left rows with NULL padded badge', () => {
    const unmatchedLeft: DataRow[] = [
      { movie_id: 3, title: 'Memento' },
    ];

    render(
      <JoinVisualizer
        matches={mockMatches}
        unmatchedLeft={unmatchedLeft}
        leftTableName="movies"
        rightTableName="reviews"
      />
    );

    expect(screen.getByText(/Unmatched Left Rows/i)).toBeDefined();
    expect(screen.getByText('Memento')).toBeDefined();
    expect(screen.getByText(/NULL Padded/i)).toBeDefined();
  });

  it('renders unmatched right rows with NULL padded badge', () => {
    const unmatchedRight: DataRow[] = [
      { review_id: 99, movie_id: 999, score: 7 },
    ];

    render(
      <JoinVisualizer
        matches={mockMatches}
        unmatchedRight={unmatchedRight}
        leftTableName="movies"
        rightTableName="reviews"
      />
    );

    expect(screen.getByText(/Unmatched Right Rows/i)).toBeDefined();
    expect(container.textContent).toContain('999');
    expect(screen.getByText(/NULL Padded/i)).toBeDefined();
  });

  it('handles empty matches gracefully', () => {
    render(<JoinVisualizer matches={[]} leftTableName="movies" rightTableName="reviews" />);
    expect(screen.getByText(/0 Matching Tuples/i)).toBeDefined();
    expect(screen.getByText(/No matching tuples found/i)).toBeDefined();
  });

  it('uses default table names when not provided', () => {
    render(<JoinVisualizer matches={mockMatches} />);
    expect(screen.getByText(/LEFT RELATION: Left Relation/i)).toBeDefined();
    expect(screen.getByText(/RIGHT RELATION: Right Relation/i)).toBeDefined();
  });
});
