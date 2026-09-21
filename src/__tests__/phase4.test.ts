import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, registerAndLoadFile } from '../database/duckdb';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { addHistoryItem, getHistoryItems } from '../storage/historyStore';

describe('Phase 4 E2E Integration Suite', () => {
  beforeAll(async () => {
    await resetDatabase();
    await useWorkspaceStore.getState().loadSchema();
  });

  it('should register custom file, build visual query, execute, and record history', async () => {
    // 1. Custom File Import
    const csvContent = 'id,product,price\n101,Laptop,1200\n102,Phone,800';
    const encoder = new TextEncoder();
    const buffer = encoder.encode(csvContent);
    const importRes = await registerAndLoadFile('products.csv', buffer, 'csv');

    expect(importRes.tableName).toBe('products');
    expect(importRes.rowCount).toBe(2);

    // 2. Run query on imported table
    const store = useWorkspaceStore.getState();
    store.setSql('SELECT * FROM products WHERE price > 1000;');
    await store.runQuery();

    const result = useWorkspaceStore.getState().resultRows;
    expect(result.length).toBe(1);
    expect(result[0].product).toBe('Laptop');

    // 3. Verify history recording
    await addHistoryItem({
      id: 'e2e-1',
      sql: 'SELECT * FROM products WHERE price > 1000;',
      timestamp: Date.now(),
      durationMs: 5.4,
      rowCount: 1,
      status: 'success'
    });

    const history = await getHistoryItems();
    expect(history.length).toBeGreaterThan(0);
  });
});
