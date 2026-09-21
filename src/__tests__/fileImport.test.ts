import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { registerAndLoadFile, resetDatabase } from '../database/duckdb';
import { FileDropzone } from '../schema/FileDropzone';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Custom Data File Import', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(async () => {
    delete (globalThis as any).XMLHttpRequest;
    if (typeof window !== 'undefined') {
      delete (window as any).XMLHttpRequest;
    }
    await resetDatabase();
  });

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

  it('should register a CSV buffer and create a table in DuckDB WASM', async () => {
    const csvContent = 'id,name,score\n1,Alice,95\n2,Bob,88';
    const encoder = new TextEncoder();
    const buffer = encoder.encode(csvContent);

    const result = await registerAndLoadFile('students.csv', buffer, 'csv');

    expect(result.tableName).toBe('students');
    expect(result.rowCount).toBe(2);
    expect(result.columns.map((c) => c.name)).toEqual(['id', 'name', 'score']);
  });

  it('should register a JSON buffer and create a table in DuckDB WASM', async () => {
    const jsonContent = '{"product":"Widget","price":9.99}\n{"product":"Gadget","price":19.99}';
    const encoder = new TextEncoder();
    const buffer = encoder.encode(jsonContent);

    const result = await registerAndLoadFile('products.json', buffer, 'json');

    expect(result.tableName).toBe('products');
    expect(result.rowCount).toBe(2);
    expect(result.columns.map((c) => c.name)).toContain('product');
    expect(result.columns.map((c) => c.name)).toContain('price');
  });

  it('should replace an existing table when the same file is imported again', async () => {
    const encoder = new TextEncoder();
    await registerAndLoadFile('clients.json', encoder.encode('{"id":1}'), 'json');

    const result = await registerAndLoadFile('clients.json', encoder.encode('{"id":2}\n{"id":3}'), 'json');

    expect(result.tableName).toBe('clients');
    expect(result.rowCount).toBe(2);
  });

  it('should sanitize table names with special characters and dashes', async () => {
    const csvContent = 'val\n10';
    const encoder = new TextEncoder();
    const buffer = encoder.encode(csvContent);

    const result = await registerAndLoadFile('my-custom_file (1).csv', buffer, 'csv');

    expect(result.tableName).toBe('my_custom_file__1_');
    expect(result.rowCount).toBe(1);
  });

  it('should render FileDropzone component with drop prompt', () => {
    act(() => {
      root.render(React.createElement(FileDropzone));
    });

    expect(container.textContent).toContain('Drop data files here');
    expect(container.textContent).toContain('CSV');
    expect(container.textContent).toContain('JSON');
    expect(container.textContent).toContain('Parquet');
  });

  it('should process file selection and trigger onFileLoaded callback', async () => {
    const onFileLoaded = vi.fn();
    act(() => {
      root.render(React.createElement(FileDropzone, { onFileLoaded }));
    });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    const fileContent = 'id,city\n1,Tokyo\n2,Paris';
    const file = new File([fileContent], 'cities.csv', { type: 'text/csv' });

    // Mock file.arrayBuffer
    file.arrayBuffer = vi.fn().mockResolvedValue(new TextEncoder().encode(fileContent).buffer);

    await act(async () => {
      const event = new Event('change', { bubbles: true });
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      input.dispatchEvent(event);
    });

    expect(onFileLoaded).toHaveBeenCalledTimes(1);
    expect(onFileLoaded.mock.calls[0][0].tableName).toBe('cities');
    expect(onFileLoaded.mock.calls[0][0].rowCount).toBe(2);
  });
});
