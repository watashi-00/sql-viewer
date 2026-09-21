import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import App, { App as AppNamed } from '../App';
import { useWorkspaceStore } from '../state/useWorkspaceStore';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@monaco-editor/react', () => ({
  default: (props: any) => {
    return React.createElement('div', {
      'data-testid': 'mock-monaco-editor',
      'data-value': props.value,
    });
  },
}));

vi.mock('../database/schema', () => ({
  getIntrospectedSchema: vi.fn().mockResolvedValue({
    name: 'main',
    tables: [
      {
        name: 'movies',
        schema: 'main',
        rowCount: 10,
        columns: [{ name: 'movie_id', type: 'INTEGER', isPrimaryKey: true }],
      },
    ],
  }),
  seedMoviesDataset: vi.fn().mockResolvedValue(undefined),
}));

describe('App Component Layout and Integration', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useWorkspaceStore.setState({
      schema: {
        name: 'main',
        tables: [],
      },
      loadSchema: vi.fn().mockResolvedValue(undefined),
      runQuery: vi.fn().mockResolvedValue(undefined),
      restartDebug: vi.fn(),
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('exports App as both named and default export', () => {
    expect(App).toBeDefined();
    expect(AppNamed).toBeDefined();
    expect(App).toBe(AppNamed);
  });

  it('renders top toolbar with SQL LAB branding and DuckDB badge', () => {
    act(() => {
      root.render(React.createElement(App));
    });

    expect(container.textContent).toContain('SQL LAB');
    expect(container.textContent).toContain('DuckDB Engine (Local)');
  });

  it('renders Restart and Run Query action buttons in header', () => {
    act(() => {
      root.render(React.createElement(App));
    });

    const buttons = Array.from(container.querySelectorAll('header button'));
    const buttonTexts = buttons.map((b) => b.textContent?.trim());

    expect(buttonTexts).toContain('Restart');
    expect(buttonTexts.some((t) => t?.includes('Run Query (F5)'))).toBe(true);
  });

  it('renders all 4 main panels: DatabaseExplorer, SqlEditor, ExecutionVisualizer, and ResultGrid', () => {
    act(() => {
      root.render(React.createElement(App));
    });

    // DatabaseExplorer
    expect(container.textContent).toContain('DATABASE EXPLORER');
    // SqlEditor
    expect(container.textContent).toContain('SQL EDITOR');
    // ExecutionVisualizer
    expect(container.textContent).toContain('SQL DEBUGGER');
    // ResultGrid
    expect(container.textContent).toContain('RESULT SET');
  });

  it('calls runQuery when Run Query (F5) button is clicked', () => {
    const runQuerySpy = vi.fn().mockResolvedValue(undefined);
    useWorkspaceStore.setState({ runQuery: runQuerySpy });

    act(() => {
      root.render(React.createElement(App));
    });

    const runButton = Array.from(container.querySelectorAll('header button')).find((b) =>
      b.textContent?.includes('Run Query')
    );
    expect(runButton).toBeDefined();

    act(() => {
      runButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(runQuerySpy).toHaveBeenCalledTimes(1);
  });

  it('calls restartDebug when Restart button is clicked', () => {
    const restartDebugSpy = vi.fn();
    useWorkspaceStore.setState({ restartDebug: restartDebugSpy });

    act(() => {
      root.render(React.createElement(App));
    });

    const restartButton = Array.from(container.querySelectorAll('header button')).find((b) =>
      b.textContent?.includes('Restart')
    );
    expect(restartButton).toBeDefined();

    act(() => {
      restartButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(restartDebugSpy).toHaveBeenCalledTimes(1);
  });

  it('triggers runQuery when F5 key is pressed on window', () => {
    const runQuerySpy = vi.fn().mockResolvedValue(undefined);
    useWorkspaceStore.setState({ runQuery: runQuerySpy });

    act(() => {
      root.render(React.createElement(App));
    });

    const f5Event = new KeyboardEvent('keydown', {
      key: 'F5',
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(f5Event, 'preventDefault');

    act(() => {
      window.dispatchEvent(f5Event);
    });

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(runQuerySpy).toHaveBeenCalledTimes(1);
  });

  it('does not trigger runQuery on other keydown events', () => {
    const runQuerySpy = vi.fn().mockResolvedValue(undefined);
    useWorkspaceStore.setState({ runQuery: runQuerySpy });

    act(() => {
      root.render(React.createElement(App));
    });

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      window.dispatchEvent(enterEvent);
    });

    expect(runQuerySpy).not.toHaveBeenCalled();
  });

  it('removes the F5 keydown event listener when unmounted', () => {
    const runQuerySpy = vi.fn().mockResolvedValue(undefined);
    useWorkspaceStore.setState({ runQuery: runQuerySpy });

    act(() => {
      root.render(React.createElement(App));
    });

    act(() => {
      root.unmount();
    });

    const f5Event = new KeyboardEvent('keydown', {
      key: 'F5',
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      window.dispatchEvent(f5Event);
    });

    expect(runQuerySpy).not.toHaveBeenCalled();
  });

  it('applies the required layout structure and classes', () => {
    act(() => {
      root.render(React.createElement(App));
    });

    const rootEl = container.firstElementChild as HTMLElement;
    expect(rootEl.className).toContain('h-screen');
    expect(rootEl.className).toContain('w-screen');
    expect(rootEl.className).toContain('flex-col');

    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(header?.className).toContain('h-10');

    // Left sidebar container
    const sidebar = container.querySelector('.w-64');
    expect(sidebar).not.toBeNull();
    expect(sidebar?.contains(container.querySelector('div:has(> span)')!)).toBeDefined();
  });

  it('renders center main workspace tab header [ Monaco SQL Editor | Visual Query Builder ] and switches view', () => {
    act(() => {
      root.render(React.createElement(App));
    });

    const editorTabBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Monaco SQL Editor') || b.textContent?.includes('SQL Editor')
    );
    const builderTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Visual Query Builder')
    );

    expect(editorTabBtn).toBeDefined();
    expect(builderTabBtn).toBeDefined();

    // Default: Monaco SQL Editor is active
    expect(container.querySelector('[data-testid="mock-monaco-editor"]')).not.toBeNull();
    expect(container.textContent).not.toContain('VISUAL QUERY BUILDER');

    // Click Visual Query Builder tab
    act(() => {
      builderTabBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('VISUAL QUERY BUILDER');

    // Click back to SQL Editor tab
    act(() => {
      editorTabBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="mock-monaco-editor"]')).not.toBeNull();
  });

  it('renders FileDropzone and sidebar tabs [ Tables | History & Snippets ] in DatabaseExplorer sidebar', () => {
    act(() => {
      root.render(React.createElement(App));
    });

    // FileDropzone should be present in sidebar
    expect(container.textContent).toContain('Drop data files here, or click to browse');

    // Sidebar tabs [ Tables ] [ History & Snippets ]
    const tablesTab = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Tables'
    );
    const historyTab = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('History')
    );

    expect(tablesTab).toBeDefined();
    expect(historyTab).toBeDefined();
  });

  it('switches DatabaseExplorer sidebar tab to History & Snippets and renders HistoryPanel', async () => {
    act(() => {
      root.render(React.createElement(App));
    });

    const historyTab = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('History')
    );
    expect(historyTab).toBeDefined();

    await act(async () => {
      historyTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Query History & Snippets');
  });
});

