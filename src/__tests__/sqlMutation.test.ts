import { describe, expect, it } from 'vitest';
import { getSqlMutation, isCreateTableStatement, SqlMutationJournal } from '../database/sqlMutation';
import { recordQueryExecution } from '../debugger/executionRecorder';
import { executeQuery, resetDatabase } from '../database/duckdb';

describe('SQL mutation classification', () => {
  it('recognizes mutating statements after leading comments', () => {
    expect(getSqlMutation('-- user command\n INSERT INTO "order items" VALUES (1)')).toEqual({ kind: 'insert' });
    expect(getSqlMutation('/* schema change */ CREATE OR REPLACE TABLE "user table" (id INT)')).toEqual({
      kind: 'create',
      tableName: 'user table',
    });
    expect(isCreateTableStatement('/* create */ CREATE TABLE data (id INT)')).toBe(true);
    expect(getSqlMutation('CREATE TEMP TABLE scratch (id INT)')).toBeNull();
    expect(getSqlMutation('SELECT * FROM data')).toBeNull();
    expect(getSqlMutation('WITH target AS (SELECT 1 AS id) UPDATE data SET id = 2')).toEqual({ kind: 'update' });
  });

  it('journals successful standalone mutations in order', async () => {
    const journal = new SqlMutationJournal();
    const persisted: Array<{ statements: string[]; tableName?: string }> = [];
    const persist = async (operation: { statements: string[]; tableName?: string }) => {
      persisted.push(operation);
    };

    await journal.record('CREATE TABLE t (id INT)', persist);
    await journal.record('INSERT INTO t VALUES (1)', persist);
    await journal.record('UPDATE t SET id = 2', persist);
    await journal.record('DELETE FROM t WHERE id = 2', persist);

    expect(persisted).toEqual([
      { statements: ['CREATE TABLE t (id INT)'], tableName: 't' },
      { statements: ['INSERT INTO t VALUES (1)'] },
      { statements: ['UPDATE t SET id = 2'] },
      { statements: ['DELETE FROM t WHERE id = 2'] },
    ]);
  });

  it('persists a transaction as one ordered operation only after commit', async () => {
    const journal = new SqlMutationJournal();
    const persisted: Array<{ statements: string[]; tableName?: string }> = [];
    const persist = async (operation: { statements: string[]; tableName?: string }) => {
      persisted.push(operation);
    };

    await journal.record('BEGIN TRANSACTION', persist);
    await journal.record('CREATE TABLE t (id INT)', persist);
    await journal.record('INSERT INTO t VALUES (1)', persist);
    expect(journal.inTransaction).toBe(true);
    expect(persisted).toEqual([]);

    await journal.record('COMMIT', persist);
    expect(journal.inTransaction).toBe(false);
    expect(persisted).toEqual([{
      statements: ['BEGIN TRANSACTION', 'CREATE TABLE t (id INT)', 'INSERT INTO t VALUES (1)', 'COMMIT'],
    }]);
  });

  it('discards a rolled back transaction', async () => {
    const journal = new SqlMutationJournal();
    const persist = async () => { throw new Error('should not persist'); };

    await journal.record('BEGIN', persist);
    await journal.record('INSERT INTO t VALUES (1)', persist);
    await journal.record('ROLLBACK', persist);
    expect(journal.inTransaction).toBe(false);
  });

  it('executes DML through the recorder and records no fabricated relational stages', async () => {
    await resetDatabase();
    const table = 'recorder_mutation_test';
    await recordQueryExecution(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY, value INTEGER)`);
    const insertPlan = await recordQueryExecution(`INSERT INTO ${table} VALUES (1, 10), (2, 20)`);
    await recordQueryExecution(`UPDATE ${table} SET value = 25 WHERE id = 2`);
    await recordQueryExecution(`DELETE FROM ${table} WHERE id = 1`);

    expect(insertPlan.events).toEqual([]);
    expect((await executeQuery(`SELECT * FROM ${table}`)).rows).toEqual([{ id: 2, value: 25 }]);
    await expect(recordQueryExecution(`INSERT INTO ${table} VALUES (2, 99)`)).rejects.toThrow();
    await recordQueryExecution(`DROP TABLE ${table}`);
  }, 30000);
});
