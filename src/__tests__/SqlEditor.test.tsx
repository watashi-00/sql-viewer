import React, { act, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { SqlEditor } from '../editor/SqlEditor';
import { DEFAULT_QUERY, useWorkspaceStore } from '../state/useWorkspaceStore';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const originalRunQuery = useWorkspaceStore.getState().runQuery;

const monacoMocks = vi.hoisted(() => ({
  setModelMarkers: vi.fn(),
  registerCompletionItemProvider: vi.fn(),
  defineTheme: vi.fn(),
  addCommand: vi.fn(),
}));

vi.mock('@monaco-editor/react', () => ({
  default: (props: any) => {
    const editor = {
      addCommand: monacoMocks.addCommand,
      getSelection: () => ({ isEmpty: () => false, startLineNumber: 2, startColumn: 4 }),
      getModel: () => ({ getValue: () => props.value, getValueInRange: () => 'SELECT 1' }),
    };
    const monaco = {
      editor: { setModelMarkers: monacoMocks.setModelMarkers, defineTheme: monacoMocks.defineTheme },
      languages: { registerCompletionItemProvider: monacoMocks.registerCompletionItemProvider },
      KeyCode: { F5: 1, Enter: 3 },
      KeyMod: { CtrlCmd: 2048 },
    };
    useEffect(() => props.onMount?.(editor, monaco), []);
    return React.createElement('div', { 'data-testid': 'monaco-mock' });
  },
}));

describe('SqlEditor diagnostics', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    vi.clearAllMocks();
    useWorkspaceStore.setState({
      sql: DEFAULT_QUERY,
      queryError: null,
      lastExecutionMode: null,
      runQuery: originalRunQuery,
    });
  });

  it('renders the actionable error and updates the Monaco marker', () => {
    useWorkspaceStore.setState({
      sql: 'SELECT FROM movies',
      queryError: {
        category: 'parser',
        title: 'SQL syntax error',
        message: 'DuckDB could not parse this SQL statement.',
        technicalMessage: 'Parser Error: syntax error at or near FROM',
        line: 1,
        column: 8,
        suggestion: 'Check the marked location.',
      },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root.render(React.createElement(SqlEditor)));

    expect(container.textContent).toContain('SQL syntax error');
    expect(container.textContent).toContain('Technical details');
    expect(monacoMocks.setModelMarkers).toHaveBeenCalledWith(
      expect.any(Object),
      'sql-viewer-diagnostics',
      [expect.objectContaining({ startLineNumber: 1, startColumn: 8, severity: 8 })]
    );

    act(() => useWorkspaceStore.getState().setSql('SELECT 1'));
    expect(monacoMocks.setModelMarkers).toHaveBeenLastCalledWith(expect.any(Object), 'sql-viewer-diagnostics', []);
  });

  it('executes only the selected SQL with Ctrl+Enter and preserves its editor offset', () => {
    const runQuery = vi.fn().mockImplementation(() => {
      useWorkspaceStore.setState({ lastExecutionMode: 'selection' });
      return Promise.resolve();
    });
    useWorkspaceStore.setState({ sql: 'SELECT 0;\n   SELECT 1;', runQuery, queryError: null });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root.render(React.createElement(SqlEditor)));
    const binding = monacoMocks.addCommand.mock.calls.find(([key]) => key === (2048 | 3));
    expect(binding).toBeDefined();
    act(() => binding?.[1]());

    expect(runQuery).toHaveBeenCalledWith('SELECT 1', { line: 2, column: 4 });
    expect(container.textContent).toContain('Selected SQL executed');
  });
});
