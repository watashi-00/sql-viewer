import React, { act, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { SqlEditor } from '../editor/SqlEditor';
import { useWorkspaceStore } from '../state/useWorkspaceStore';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const monacoMocks = vi.hoisted(() => ({
  setModelMarkers: vi.fn(),
  registerCompletionItemProvider: vi.fn(),
  defineTheme: vi.fn(),
}));

vi.mock('@monaco-editor/react', () => ({
  default: (props: any) => {
    const editor = {
      addCommand: vi.fn(),
      getModel: () => ({ getValue: () => props.value }),
    };
    const monaco = {
      editor: { setModelMarkers: monacoMocks.setModelMarkers, defineTheme: monacoMocks.defineTheme },
      languages: { registerCompletionItemProvider: monacoMocks.registerCompletionItemProvider },
      KeyCode: { F5: 1 },
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
});
