import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { VisualQueryBuilder } from '../builder/VisualQueryBuilder';
import { Schema } from '../types';

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
