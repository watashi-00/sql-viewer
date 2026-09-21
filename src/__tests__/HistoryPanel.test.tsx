import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { HistoryPanel } from '../history/HistoryPanel';
import { QueryHistoryItem, SavedSnippet } from '../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('HistoryPanel Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockHistory: QueryHistoryItem[] = [
    {
      id: 'h-1',
      sql: 'SELECT * FROM movies;',
      timestamp: 1700000000000,
      durationMs: 15.2,
      rowCount: 10,
      status: 'success',
    },
    {
      id: 'h-2',
      sql: 'SELECT * FROM invalid_table;',
      timestamp: 1700000005000,
      durationMs: 45.6,
      rowCount: 0,
      status: 'error',
      errorMessage: 'Table invalid_table does not exist',
    },
  ];

  const mockSnippets: SavedSnippet[] = [
    {
      id: 's-1',
      title: 'Top Rated Movies',
      sql: 'SELECT title, score FROM movies WHERE score > 8.5;',
      description: 'Fetch all top rated movies',
      tags: ['analytics', 'movies'],
      createdAt: 1700000000000,
    },
  ];

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
    vi.restoreAllMocks();
  });

  it('renders history timeline entries and duration metrics', () => {
    act(() => {
      root.render(React.createElement(HistoryPanel, { history: mockHistory, onSelectSql: () => {} }));
    });

    expect(container.textContent).toContain('SELECT * FROM movies;');
    expect(container.textContent).toContain('15.2ms');
    expect(container.textContent).toContain('SUCCESS');
    expect(container.textContent).toContain('ERROR');
    expect(container.textContent).toContain('10 rows');
  });

  it('calls onSelectSql when clicking a history entry', () => {
    const onSelectSql = vi.fn();

    act(() => {
      root.render(React.createElement(HistoryPanel, { history: mockHistory, onSelectSql }));
    });

    const item = Array.from(container.querySelectorAll('.font-mono')).find((el) =>
      el.textContent?.includes('SELECT * FROM movies;')
    );
    expect(item).not.toBeUndefined();

    act(() => {
      item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSelectSql).toHaveBeenCalledWith('SELECT * FROM movies;');
  });

  it('switches to Saved Snippets tab and renders snippets with tags and description', () => {
    const onSelectSql = vi.fn();

    act(() => {
      root.render(
        React.createElement(HistoryPanel, {
          history: mockHistory,
          snippets: mockSnippets,
          onSelectSql,
        })
      );
    });

    const snippetTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Snippets')
    );
    expect(snippetTabBtn).not.toBeUndefined();

    act(() => {
      snippetTabBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Top Rated Movies');
    expect(container.textContent).toContain('Fetch all top rated movies');
    expect(container.textContent).toContain('SELECT title, score FROM movies');
    expect(container.textContent).toContain('analytics');
    expect(container.textContent).toContain('movies');

    const loadBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Load') || b.textContent?.includes('Top Rated Movies')
    );
    expect(loadBtn).not.toBeUndefined();

    act(() => {
      loadBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSelectSql).toHaveBeenCalledWith('SELECT title, score FROM movies WHERE score > 8.5;');
  });

  it('shows Performance Profiler comparison drawer when 2 items are selected', () => {
    act(() => {
      root.render(React.createElement(HistoryPanel, { history: mockHistory, onSelectSql: () => {} }));
    });

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);

    // Select both items for comparison
    act(() => {
      checkboxes[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      checkboxes[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Drawer should open and show comparison metric
    expect(container.textContent).toContain('Performance Profiler');
    expect(container.textContent).toMatch(/Speedup|Slowdown/);
    expect(container.textContent).toContain('30.4ms'); // 45.6 - 15.2 = 30.4ms delta
  });
});
