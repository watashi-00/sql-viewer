import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { DatabaseExplorer } from '../schema/DatabaseExplorer';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { Schema } from '../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('DatabaseExplorer Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockSchema: Schema = {
    name: 'main',
    tables: [
      {
        name: 'movies',
        schema: 'main',
        rowCount: 10,
        columns: [
          { name: 'movie_id', type: 'INTEGER', isPrimaryKey: true },
          { name: 'title', type: 'VARCHAR' },
          { name: 'release_year', type: 'INTEGER' },
        ],
      },
      {
        name: 'reviews',
        schema: 'main',
        rowCount: 25,
        columns: [
          { name: 'review_id', type: 'INTEGER', isPrimaryKey: true },
          { name: 'movie_id', type: 'INTEGER', isForeignKey: true },
          { name: 'score', type: 'FLOAT' },
          { name: 'comment', type: 'VARCHAR' },
        ],
      },
    ],
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useWorkspaceStore.setState({
      schema: null,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('should call loadSchema on mount', () => {
    const loadSchemaSpy = vi.fn().mockResolvedValue(undefined);
    useWorkspaceStore.setState({
      loadSchema: loadSchemaSpy,
      schema: null,
    });

    act(() => {
      root.render(React.createElement(DatabaseExplorer));
    });

    expect(loadSchemaSpy).toHaveBeenCalledTimes(1);
  });

  it('should render loading state when schema is null', () => {
    act(() => {
      root.render(React.createElement(DatabaseExplorer));
    });

    expect(container.textContent).toContain('DATABASE EXPLORER');
    expect(container.textContent).toContain('Loading database schema...');
  });

  it('should render schema name and tables with row counts when schema is loaded', () => {
    useWorkspaceStore.setState({
      schema: mockSchema,
    });

    act(() => {
      root.render(React.createElement(DatabaseExplorer));
    });

    expect(container.textContent).toContain('DATABASE EXPLORER');
    expect(container.textContent).toContain('Schema: main');
    expect(container.textContent).toContain('movies');
    expect(container.textContent).toContain('10 rows');
    expect(container.textContent).toContain('reviews');
    expect(container.textContent).toContain('25 rows');
  });

  it('should render columns with names and uppercase types', () => {
    useWorkspaceStore.setState({
      schema: mockSchema,
    });

    act(() => {
      root.render(React.createElement(DatabaseExplorer));
    });

    expect(container.textContent).toContain('movie_id');
    expect(container.textContent).toContain('INTEGER');
    expect(container.textContent).toContain('title');
    expect(container.textContent).toContain('VARCHAR');
    expect(container.textContent).toContain('release_year');
    expect(container.textContent).toContain('score');
    expect(container.textContent).toContain('FLOAT');
    expect(container.textContent).toContain('comment');
  });

  it('should render correct tooltips for primary key, foreign key, and normal columns', () => {
    useWorkspaceStore.setState({
      schema: mockSchema,
    });

    act(() => {
      root.render(React.createElement(DatabaseExplorer));
    });

    const pkCol = container.querySelector('[title="movie_id (INTEGER) - Primary Key"]');
    expect(pkCol).not.toBeNull();
    expect(pkCol?.textContent).toContain('movie_id');
    expect(pkCol?.textContent).toContain('INTEGER');

    const fkCol = container.querySelector('[title="movie_id (INTEGER) - Foreign Key"]');
    expect(fkCol).not.toBeNull();
    expect(fkCol?.textContent).toContain('movie_id');
    expect(fkCol?.textContent).toContain('INTEGER');

    const regularCol = container.querySelector('[title="title (VARCHAR)"]');
    expect(regularCol).not.toBeNull();
    expect(regularCol?.textContent).toContain('title');
    expect(regularCol?.textContent).toContain('VARCHAR');
  });

  it('should render distinct icons for primary keys, foreign keys, int columns, and text columns', () => {
    useWorkspaceStore.setState({
      schema: mockSchema,
    });

    act(() => {
      root.render(React.createElement(DatabaseExplorer));
    });

    const pkCol = container.querySelector('[title="movie_id (INTEGER) - Primary Key"]');
    const pkSvg = pkCol?.querySelector('svg.text-warning');
    expect(pkSvg).not.toBeNull();

    const fkCol = container.querySelector('[title="movie_id (INTEGER) - Foreign Key"]');
    const fkSvg = fkCol?.querySelector('svg.text-accent');
    expect(fkSvg).not.toBeNull();

    const intCol = container.querySelector('[title="release_year (INTEGER)"]');
    const intSvg = intCol?.querySelector('svg.text-muted');
    expect(intSvg).not.toBeNull();

    const textCol = container.querySelector('[title="title (VARCHAR)"]');
    const textSvg = textCol?.querySelector('svg.text-muted');
    expect(textSvg).not.toBeNull();
  });
});
