import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { WorkspaceControls } from '../storage/WorkspaceControls';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  clearWorkspace: vi.fn().mockResolvedValue(undefined),
  loadWorkspace: vi.fn().mockResolvedValue({ files: [], commands: [], operations: [] }),
  saveWorkspace: vi.fn().mockResolvedValue(undefined),
  resetDatabase: vi.fn().mockResolvedValue(undefined),
  loadSchema: vi.fn().mockResolvedValue(undefined),
  setSql: vi.fn(),
}));

vi.mock('../database/duckdb', () => ({ resetDatabase: mocks.resetDatabase }));
vi.mock('../storage/workspaceStore', () => ({
  clearWorkspace: mocks.clearWorkspace,
  loadWorkspace: mocks.loadWorkspace,
  saveWorkspace: mocks.saveWorkspace,
}));
vi.mock('../storage/workspaceArchive', () => ({
  parseWorkspaceArchive: vi.fn(),
  serializeWorkspaceArchive: vi.fn().mockReturnValue('{}'),
}));
vi.mock('../state/useWorkspaceStore', () => ({
  DEFAULT_QUERY: 'SELECT 1',
  useWorkspaceStore: (selector: (state: unknown) => unknown) =>
    selector({ loadSchema: mocks.loadSchema, setSql: mocks.setSql }),
}));

describe('WorkspaceControls', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    vi.restoreAllMocks();
    Object.values(mocks).forEach((mock) => mock.mockClear());
  });

  it('confirms and starts a fresh local workspace without clearing query history', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    act(() => root.render(React.createElement(WorkspaceControls)));
    const openButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Workspace'));
    act(() => openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.textContent).toContain('Query history is kept separately.');
    const newWorkspaceButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('New workspace'));
    await act(async () => {
      newWorkspaceButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.clearWorkspace).toHaveBeenCalledOnce();
    expect(mocks.resetDatabase).toHaveBeenCalledOnce();
    expect(mocks.loadSchema).toHaveBeenCalledOnce();
    expect(mocks.setSql).toHaveBeenCalledWith('SELECT 1');
    expect(container.textContent).toContain('Query history was kept.');
  });
});
