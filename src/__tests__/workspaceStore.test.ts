import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  clearWorkspace,
  getWorkspaceOperations,
  loadWorkspace,
  replayWorkspaceOperations,
  saveWorkspace,
  appendWorkspaceOperation,
  saveBuilderState,
} from '../storage/workspaceStore';

describe('Workspace storage', () => {
  it('persists visual query builder state in the local workspace', async () => {
    await clearWorkspace();
    const builder = {
      nodes: [{ id: 'n1', tableName: 'movies', alias: 'm', selectedColumns: [], groupByColumns: ['release_year'], position: { x: 0, y: 0 } }],
      joins: [], filters: [], aggregates: [{ id: 'a1', table: 'm', column: '*', fn: 'COUNT' as const }],
    };
    await saveBuilderState(builder);
    expect((await loadWorkspace()).builder).toEqual(builder);
  });

  it('persists imported files and creation commands in IndexedDB', async () => {
    await clearWorkspace();

    await saveWorkspace({
      files: [
        {
          fileName: 'clients.json',
          tableName: 'clients',
          format: 'json',
          buffer: new Uint8Array([91, 93]),
        },
      ],
      commands: [{ sql: 'CREATE TABLE clients (id INTEGER)', tableName: 'clients' }],
    });

    const workspace = await loadWorkspace();
    expect(workspace.files[0].fileName).toBe('clients.json');
    expect(Array.from(workspace.files[0].buffer)).toEqual([91, 93]);
    expect(workspace.commands[0].tableName).toBe('clients');
  });

  it('migrates legacy records and appends new operations in replay order', async () => {
    await clearWorkspace();
    await saveWorkspace({
      files: [{ fileName: 'clients.csv', tableName: 'clients', format: 'csv', buffer: new Uint8Array([1]) }],
      commands: [{ sql: 'CREATE TABLE audit (id INTEGER)', tableName: 'audit' }],
    });

    await appendWorkspaceOperation({ type: 'sql', statements: ["INSERT INTO audit VALUES (1)"] });
    const workspace = await loadWorkspace();
    expect(getWorkspaceOperations(workspace)).toEqual([
      { type: 'file', file: workspace.files[0], legacy: true },
      { type: 'sql', statements: ['CREATE TABLE audit (id INTEGER)'], tableName: 'audit', legacy: true },
      { type: 'sql', statements: ['INSERT INTO audit VALUES (1)'] },
    ]);
  });

  it('replays file and SQL operations sequentially and stops on a failed statement', async () => {
    const events: string[] = [];
    const operations = [
      { type: 'sql' as const, statements: ['CREATE TABLE t (id INTEGER)'] },
      {
        type: 'file' as const,
        file: { fileName: 'other.csv', tableName: 'other', format: 'csv' as const, buffer: new Uint8Array() },
      },
      { type: 'sql' as const, statements: ['INSERT INTO t VALUES (1)', 'UPDATE t SET id = 2'] },
    ];

    await expect(
      replayWorkspaceOperations(
        operations,
        async (file) => { events.push(`file:${file.tableName}`); },
        async (sql) => {
          events.push(`sql:${sql}`);
          if (sql.startsWith('INSERT')) throw new Error('replay failed');
        }
      )
    ).rejects.toThrow('replay failed');

    expect(events).toEqual([
      'sql:CREATE TABLE t (id INTEGER)',
      'file:other',
      'sql:INSERT INTO t VALUES (1)',
    ]);
  });

  it('restores the same SQL mutation sequence after reloading IndexedDB state', async () => {
    await clearWorkspace();
    await saveWorkspace({
      files: [],
      commands: [],
      operations: [
        { type: 'sql', statements: ['CREATE TABLE ledger (id INTEGER)'] },
        { type: 'sql', statements: ['INSERT INTO ledger VALUES (1)'] },
        { type: 'sql', statements: ['UPDATE ledger SET id = 2'] },
      ],
    });

    const restoredSql: string[] = [];
    await replayWorkspaceOperations(getWorkspaceOperations(await loadWorkspace()), async () => {}, async (sql) => {
      restoredSql.push(sql);
    });

    expect(restoredSql).toEqual([
      'CREATE TABLE ledger (id INTEGER)',
      'INSERT INTO ledger VALUES (1)',
      'UPDATE ledger SET id = 2',
    ]);
  });

  it('retains existence checks for migrated records but replays new ordered mutations', async () => {
    const restored: string[] = [];
    const operations = getWorkspaceOperations({
      files: [{ fileName: 'existing.csv', tableName: 'existing', format: 'csv', buffer: new Uint8Array() }],
      commands: [
        { sql: 'CREATE TABLE existing (id INTEGER)', tableName: 'existing' },
        { sql: 'CREATE TABLE missing (id INTEGER)', tableName: 'missing' },
      ],
    });
    operations.push({ type: 'sql', statements: ['INSERT INTO existing VALUES (1)'] });

    await replayWorkspaceOperations(
      operations,
      async (file) => { restored.push(`file:${file.tableName}`); },
      async (sql) => { restored.push(`sql:${sql}`); },
      async (operation) => {
        if (!operation.legacy) return true;
        const tableName = operation.type === 'file' ? operation.file.tableName : operation.tableName;
        return !tableName || tableName !== 'existing';
      }
    );

    expect(restored).toEqual([
      'sql:CREATE TABLE missing (id INTEGER)',
      'sql:INSERT INTO existing VALUES (1)',
    ]);
  });

  it('reports malformed local workspace records instead of silently treating them as empty', async () => {
    await clearWorkspace();
    await saveWorkspace({ files: 'broken' as unknown as [], commands: [] });

    await expect(loadWorkspace()).rejects.toThrow('Saved workspace data is corrupted');
  });

  it('reports a corrupted ordered operation log', async () => {
    await clearWorkspace();
    await saveWorkspace({ files: [], commands: [], operations: ['not an operation'] as unknown as [] });

    await expect(loadWorkspace()).rejects.toThrow('corrupted operation log');
  });
});
