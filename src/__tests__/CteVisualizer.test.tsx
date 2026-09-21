import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { CteVisualizer } from '../visualizer/CteVisualizer';
import { CteScope } from '../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('CteVisualizer Component', () => {
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

  const renderComponent = (ui: React.ReactElement) => {
    act(() => {
      root.render(ui);
    });
  };

  const mockScopes: CteScope[] = [
    {
      id: 'cte-1',
      aliasName: 'top_directors',
      query: 'SELECT * FROM directors WHERE rating > 8',
      events: [],
      outputRows: [
        { id: 1, name: 'Nolan', rating: 9 },
        { id: 2, name: 'Villeneuve', rating: 9 }
      ]
    },
    {
      id: 'cte-2',
      aliasName: 'high_scores',
      query: 'SELECT * FROM scores WHERE score >= 90',
      events: [],
      outputRows: []
    }
  ];

  it('renders scope tabs and CTE preview information', () => {
    renderComponent(<CteVisualizer scopes={mockScopes} activeScopeId="cte-1" onSelectScope={() => {}} />);
    expect(container.textContent).toContain('top_directors');
    expect(container.textContent).toContain('Main Query');
    expect(container.textContent).toContain('high_scores');
  });

  it('displays query snippet and output relation rows when a CTE is active', () => {
    renderComponent(<CteVisualizer scopes={mockScopes} activeScopeId="cte-1" onSelectScope={() => {}} />);
    expect(container.textContent).toContain('SELECT * FROM directors WHERE rating > 8');
    expect(container.textContent).toContain('Nolan');
    expect(container.textContent).toContain('Villeneuve');
    expect(container.textContent).toContain('Intermediate Relation Preview (2 rows)');
  });

  it('triggers onSelectScope when scope tabs are clicked', () => {
    const onSelectScope = vi.fn();
    renderComponent(<CteVisualizer scopes={mockScopes} activeScopeId="main" onSelectScope={onSelectScope} />);

    const buttons = container.querySelectorAll('button');
    // buttons[0] is Main Query, buttons[1] is top_directors, buttons[2] is high_scores
    expect(buttons.length).toBe(3);

    act(() => {
      buttons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSelectScope).toHaveBeenCalledWith('cte-1');

    act(() => {
      buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSelectScope).toHaveBeenCalledWith('main');
  });

  it('renders empty output rows state correctly', () => {
    renderComponent(<CteVisualizer scopes={mockScopes} activeScopeId="cte-2" onSelectScope={() => {}} />);
    expect(container.textContent).toContain('high_scores');
    expect(container.textContent).toContain('No output rows produced by this CTE scope.');
  });

  it('renders Main Query active scope state correctly', () => {
    renderComponent(<CteVisualizer scopes={mockScopes} activeScopeId="main" onSelectScope={() => {}} />);
    expect(container.textContent).toContain('Scope: Main Query');
    expect(container.textContent).toContain('Viewing outer execution pipeline');
  });

  it('handles empty scopes gracefully', () => {
    renderComponent(<CteVisualizer scopes={[]} activeScopeId="main" onSelectScope={() => {}} />);
    expect(container.textContent).toContain('Main Query');
    expect(container.textContent).toContain('Scope: Main Query');
  });

  it('renders NULL values in table data preview correctly', () => {
    const nullScope: CteScope[] = [
      {
        id: 'cte-null',
        aliasName: 'nullable_cte',
        query: 'SELECT name, age FROM users',
        events: [],
        outputRows: [{ name: 'Alice', age: null }]
      }
    ];
    renderComponent(<CteVisualizer scopes={nullScope} activeScopeId="cte-null" onSelectScope={() => {}} />);
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('NULL');
  });
});
