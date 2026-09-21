import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { RowInspector } from '../inspector/RowInspector';
import { ResultGrid } from '../inspector/ResultGrid';
import { useWorkspaceStore } from '../state/useWorkspaceStore';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('RowInspector Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useWorkspaceStore.setState({
      selectedRow: null,
      isInspectingRow: false,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders null when selectedRow is null', () => {
    act(() => {
      root.render(React.createElement(RowInspector));
    });

    expect(container.innerHTML).toBe('');
  });

  it('renders drawer with row inspector header when selectedRow exists', () => {
    useWorkspaceStore.setState({
      selectedRow: { movie_id: 1, title: 'Inception', score: 8.8 },
    });

    act(() => {
      root.render(React.createElement(RowInspector));
    });

    expect(container.textContent).toContain('ROW INSPECTOR');
  });

  it('renders all key-value pairs of the selected row', () => {
    useWorkspaceStore.setState({
      selectedRow: {
        movie_id: 1,
        title: 'Inception',
        score: 8.8,
        description: null,
      },
    });

    act(() => {
      root.render(React.createElement(RowInspector));
    });

    expect(container.textContent).toContain('movie_id');
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('title');
    expect(container.textContent).toContain('Inception');
    expect(container.textContent).toContain('score');
    expect(container.textContent).toContain('8.8');
    expect(container.textContent).toContain('description');
    expect(container.textContent).toContain('NULL');
  });

  it('clicking the close button sets selectedRow to null', () => {
    const setSelectedRowSpy = vi.fn();
    useWorkspaceStore.setState({
      selectedRow: { id: 42, name: 'Alice' },
      setSelectedRow: setSelectedRowSpy,
    });

    act(() => {
      root.render(React.createElement(RowInspector));
    });

    const closeButton = container.querySelector('button');
    expect(closeButton).not.toBeNull();

    act(() => {
      closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(setSelectedRowSpy).toHaveBeenCalledWith(null);
  });
});

describe('ResultGrid Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useWorkspaceStore.setState({
      resultRows: [],
      resultColumns: [],
      selectedRow: null,
      isInspectingRow: false,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders empty state when resultColumns is empty', () => {
    act(() => {
      root.render(React.createElement(ResultGrid));
    });

    expect(container.textContent).toContain('RESULT SET (0 rows)');
    expect(container.textContent).toContain('No results to display. Run a SQL query.');
  });

  it('renders header with row count', () => {
    useWorkspaceStore.setState({
      resultRows: [{ id: 1 }, { id: 2 }, { id: 3 }],
      resultColumns: ['id'],
    });

    act(() => {
      root.render(React.createElement(ResultGrid));
    });

    expect(container.textContent).toContain('RESULT SET (3 rows)');
  });

  it('renders table headers for each result column plus index column', () => {
    useWorkspaceStore.setState({
      resultRows: [
        { id: 1, title: 'The Matrix', score: 8.7 },
      ],
      resultColumns: ['id', 'title', 'score'],
    });

    act(() => {
      root.render(React.createElement(ResultGrid));
    });

    const headers = Array.from(container.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['#', 'id', 'title', 'score']);
  });

  it('renders rows with 1-based indexing and cell values', () => {
    useWorkspaceStore.setState({
      resultRows: [
        { id: 101, title: 'Inception', score: 8.8 },
        { id: 102, title: 'Interstellar', score: 8.6 },
      ],
      resultColumns: ['id', 'title', 'score'],
    });

    act(() => {
      root.render(React.createElement(ResultGrid));
    });

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    const firstRowCells = Array.from(rows[0].querySelectorAll('td')).map((td) => td.textContent?.trim());
    expect(firstRowCells).toEqual(['1', '101', 'Inception', '8.8']);

    const secondRowCells = Array.from(rows[1].querySelectorAll('td')).map((td) => td.textContent?.trim());
    expect(secondRowCells).toEqual(['2', '102', 'Interstellar', '8.6']);
  });

  it('renders NULL cell values with italic styling', () => {
    useWorkspaceStore.setState({
      resultRows: [
        { id: 1, title: null },
      ],
      resultColumns: ['id', 'title'],
    });

    act(() => {
      root.render(React.createElement(ResultGrid));
    });

    const nullSpan = container.querySelector('span.italic');
    expect(nullSpan).not.toBeNull();
    expect(nullSpan?.textContent).toBe('NULL');
  });

  it('clicking a row calls setSelectedRow with the row data', () => {
    const row1 = { id: 1, title: 'Inception' };
    const row2 = { id: 2, title: 'Tenet' };

    const setSelectedRowSpy = vi.fn();
    useWorkspaceStore.setState({
      resultRows: [row1, row2],
      resultColumns: ['id', 'title'],
      setSelectedRow: setSelectedRowSpy,
    });

    act(() => {
      root.render(React.createElement(ResultGrid));
    });

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    act(() => {
      rows[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(setSelectedRowSpy).toHaveBeenCalledWith(row2);
  });

  it('integrates RowInspector drawer when selectedRow is active in store', () => {
    const row = { id: 99, title: 'Oppenheimer', score: 8.9 };

    useWorkspaceStore.setState({
      resultRows: [row],
      resultColumns: ['id', 'title', 'score'],
      selectedRow: row,
    });

    act(() => {
      root.render(React.createElement(ResultGrid));
    });

    expect(container.textContent).toContain('ROW INSPECTOR');
    expect(container.textContent).toContain('Oppenheimer');
  });

  it('renders export buttons for CSV, JSON, and Parquet', () => {
    useWorkspaceStore.setState({
      resultRows: [{ id: 1, name: 'Inception' }],
      resultColumns: ['id', 'name'],
    });

    act(() => {
      root.render(React.createElement(ResultGrid));
    });

    expect(container.textContent).toContain('Export CSV');
    expect(container.textContent).toContain('Export JSON');
    expect(container.textContent).toContain('Export Parquet');
  });

  it('accepts rows and columns props directly', () => {
    act(() => {
      root.render(React.createElement(ResultGrid, { rows: [{ id: 1, name: 'Inception' }], columns: ['id', 'name'] }));
    });

    expect(container.textContent).toContain('Export CSV');
    expect(container.textContent).toContain('Inception');
  });

  it('triggers CSV download when Export CSV button is clicked', () => {
    const createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-csv-url');
    const revokeObjectURLSpy = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    globalThis.URL.createObjectURL = createObjectURLSpy;
    globalThis.URL.revokeObjectURL = revokeObjectURLSpy;

    useWorkspaceStore.setState({
      resultRows: [{ id: 1, title: 'Inception', comma: 'a,b' }],
      resultColumns: ['id', 'title', 'comma'],
    });

    act(() => {
      root.render(React.createElement(ResultGrid));
    });

    const csvBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Export CSV')
    );
    expect(csvBtn).not.toBeUndefined();

    act(() => {
      csvBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    const createdBlob = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(createdBlob.type).toBe('text/csv');

    clickSpy.mockRestore();
  });

  it('triggers JSON download when Export JSON button is clicked', () => {
    const createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-json-url');
    const revokeObjectURLSpy = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    globalThis.URL.createObjectURL = createObjectURLSpy;
    globalThis.URL.revokeObjectURL = revokeObjectURLSpy;

    useWorkspaceStore.setState({
      resultRows: [{ id: 1, title: 'Inception' }],
      resultColumns: ['id', 'title'],
    });

    act(() => {
      root.render(React.createElement(ResultGrid));
    });

    const jsonBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Export JSON')
    );
    expect(jsonBtn).not.toBeUndefined();

    act(() => {
      jsonBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    const createdBlob = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(createdBlob.type).toBe('application/json');

    clickSpy.mockRestore();
  });

  it('triggers Parquet download when Export Parquet button is clicked', () => {
    const createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-parquet-url');
    const revokeObjectURLSpy = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    globalThis.URL.createObjectURL = createObjectURLSpy;
    globalThis.URL.revokeObjectURL = revokeObjectURLSpy;

    useWorkspaceStore.setState({
      resultRows: [{ id: 1, title: 'Inception' }],
      resultColumns: ['id', 'title'],
    });

    act(() => {
      root.render(React.createElement(ResultGrid));
    });

    const parquetBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Export Parquet')
    );
    expect(parquetBtn).not.toBeUndefined();

    act(() => {
      parquetBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    const createdBlob = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(createdBlob.type).toBe('application/octet-stream');

    clickSpy.mockRestore();
  });
});

