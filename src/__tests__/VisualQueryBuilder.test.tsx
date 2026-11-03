import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { buildSqlFromState, describeRelationalEffects, VisualQueryBuilder } from '../builder/VisualQueryBuilder';
import { Schema, VisualQueryState } from '../types';
import { clearWorkspace, loadWorkspace, saveBuilderState } from '../storage/workspaceStore';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('VisualQueryBuilder Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockSchema: Schema = {
    name: 'main',
    tables: [
      {
        name: 'movies',
        schema: 'main',
        columns: [
          { name: 'movie_id', type: 'INTEGER', isPrimaryKey: true },
          { name: 'title', type: 'VARCHAR' },
          { name: 'release_year', type: 'INTEGER' }
        ]
      },
      {
        name: 'directors',
        schema: 'main',
        columns: [
          { name: 'director_id', type: 'INTEGER', isPrimaryKey: true },
          { name: 'name', type: 'VARCHAR' }
        ]
      }
    ]
  };

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

  it('builds aggregate queries with grouping, aliases, and filters', () => {
    const sql = buildSqlFromState({
      nodes: [{ id: 'movies', tableName: 'movies', alias: 'm', selectedColumns: [], groupByColumns: ['release_year'], position: { x: 0, y: 0 } }],
      joins: [],
      filters: [{ id: 'f1', table: 'm', column: 'release_year', operator: '>=', value: '2000' }],
      aggregates: [{ id: 'a1', table: 'm', column: '*', fn: 'COUNT', alias: 'movie_count' }],
    });
    expect(sql).toContain('SELECT m.release_year, COUNT(*) AS movie_count');
    expect(sql).toContain('WHERE m.release_year >= 2000');
    expect(sql).toContain('GROUP BY m.release_year');
  });

  it('generates table and expression aliases with editable join predicates', () => {
    const sql = buildSqlFromState({
      nodes: [
        { id: 'm', tableName: 'movies', alias: 'm', selectedColumns: ['title'], columnAliases: { title: 'movie_title' }, position: { x: 0, y: 0 } },
        { id: 'r', tableName: 'reviews', alias: 'r', selectedColumns: [], position: { x: 0, y: 0 } },
      ],
      joins: [{ id: 'j', leftTable: 'm', leftColumn: 'movie_id', rightTable: 'r', rightColumn: 'movie_id', joinType: 'LEFT', operator: '>' }],
      filters: [],
    });
    expect(sql).toContain('SELECT m.title AS movie_title');
    expect(sql).toContain('FROM movies AS m');
    expect(sql).toContain('LEFT JOIN reviews AS r ON m.movie_id > r.movie_id');
    expect(describeRelationalEffects({ nodes: [], joins: [], filters: [] })).toEqual([]);
  });

  it('adds aggregate expressions and lets columns be marked for GROUP BY', () => {
    const onSqlChange = vi.fn();
    act(() => root.render(React.createElement(VisualQueryBuilder, {
      schema: mockSchema,
      onSqlChange,
      initialState: {
        nodes: [{ id: 'movies', tableName: 'movies', selectedColumns: [], position: { x: 0, y: 0 } }],
        joins: [],
        filters: [],
      },
    })));
    const groupBy = container.querySelector('input[aria-label="Group by movies.release_year"]') as HTMLInputElement;
    act(() => groupBy.click());
    const addAggregate = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add Aggregate'));
    act(() => addAggregate?.click());
    const sql = onSqlChange.mock.calls.at(-1)?.[0] as string;
    expect(sql).toContain('COUNT(*) AS count_all');
    expect(sql).toContain('GROUP BY movies.release_year');
  });

  it('restores builder selections from the workspace after remounting', async () => {
    await clearWorkspace();
    await saveBuilderState({
      nodes: [{ id: 'movies', tableName: 'movies', selectedColumns: [], groupByColumns: ['release_year'], position: { x: 0, y: 0 } }],
      joins: [], filters: [], aggregates: [{ id: 'count', table: 'movies', column: '*', fn: 'COUNT' }],
    });
    expect((await loadWorkspace()).builder?.nodes[0]?.groupByColumns).toEqual(['release_year']);
    const onSqlChange = vi.fn();
    let restoredState: VisualQueryState | undefined;
    let resolveRestored!: () => void;
    const restored = new Promise<void>((resolve) => { resolveRestored = resolve; });
    act(() => {
      root.render(React.createElement(VisualQueryBuilder, {
        schema: mockSchema,
        onSqlChange,
        onStateChange: (state) => { restoredState = state; resolveRestored(); },
      }));
    });
    await restored;
    act(() => root.render(React.createElement(VisualQueryBuilder, {
      schema: mockSchema,
      onSqlChange,
      onStateChange: (state) => { restoredState = state; resolveRestored(); },
    })));
    expect(restoredState?.nodes[0].groupByColumns).toEqual(['release_year']);
    expect(onSqlChange.mock.calls.some(([sql]) => String(sql).includes('GROUP BY movies.release_year'))).toBe(true);
  });

  it('renders table selection and header', () => {
    act(() => {
      root.render(
        React.createElement(VisualQueryBuilder, {
          schema: mockSchema,
          onSqlChange: () => {}
        })
      );
    });

    expect(container.textContent).toContain('VISUAL QUERY BUILDER');
  });

  it('allows adding table node and selecting columns to generate SQL', () => {
    const onSqlChange = vi.fn();
    act(() => {
      root.render(
        React.createElement(VisualQueryBuilder, {
          schema: mockSchema,
          onSqlChange
        })
      );
    });

    // Select table from dropdown
    const selectEl = container.querySelector('select[data-testid="add-table-select"]') as HTMLSelectElement;
    expect(selectEl).not.toBeNull();

    act(() => {
      selectEl.value = 'movies';
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const addBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Add Table')
    );
    expect(addBtn).not.toBeUndefined();

    act(() => {
      addBtn?.click();
    });

    // Verify table card for 'movies' is rendered
    expect(container.textContent).toContain('movies');

    // Select column 'title' checkbox
    const titleCheckbox = container.querySelector('input[type="checkbox"][data-column="title"]') as HTMLInputElement;
    expect(titleCheckbox).not.toBeNull();

    act(() => {
      titleCheckbox.click();
    });

    expect(onSqlChange).toHaveBeenCalled();
    const lastCallSql = onSqlChange.mock.calls[onSqlChange.mock.calls.length - 1][0];
    expect(lastCallSql).toContain('SELECT movies.title');
    expect(lastCallSql).toContain('FROM movies');
  });

  it('generates JOIN clause when join is added', () => {
    const onSqlChange = vi.fn();
    act(() => {
      root.render(
        React.createElement(VisualQueryBuilder, {
          schema: mockSchema,
          onSqlChange
        })
      );
    });

    const selectEl = container.querySelector('select[data-testid="add-table-select"]') as HTMLSelectElement;
    const addBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Add Table')
    );

    act(() => {
      selectEl.value = 'movies';
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      addBtn?.click();
    });

    act(() => {
      selectEl.value = 'directors';
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      addBtn?.click();
    });

    const addJoinBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Add Join')
    );
    expect(addJoinBtn).not.toBeUndefined();

    act(() => {
      addJoinBtn?.click();
    });

    const lastCallSql = onSqlChange.mock.calls[onSqlChange.mock.calls.length - 1][0];
    expect(lastCallSql).toContain('JOIN');
  });

  it('generates WHERE clause when filter condition is added', () => {
    const onSqlChange = vi.fn();
    act(() => {
      root.render(
        React.createElement(VisualQueryBuilder, {
          schema: mockSchema,
          onSqlChange
        })
      );
    });

    const selectEl = container.querySelector('select[data-testid="add-table-select"]') as HTMLSelectElement;
    const addBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Add Table')
    );

    act(() => {
      selectEl.value = 'movies';
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      addBtn?.click();
    });

    const addFilterBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Add Filter')
    );
    expect(addFilterBtn).not.toBeUndefined();

    act(() => {
      addFilterBtn?.click();
    });

    const filterInput = container.querySelector('input[data-testid="filter-value-input"]') as HTMLInputElement;
    expect(filterInput).not.toBeNull();

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(filterInput, '2020');
      filterInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const lastCallSql = onSqlChange.mock.calls[onSqlChange.mock.calls.length - 1][0];
    expect(lastCallSql).toContain('WHERE');
    expect(lastCallSql).toContain('2020');
  });
});
