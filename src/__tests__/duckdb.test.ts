import { describe, it, expect, beforeEach } from 'vitest';
import {
  initDuckDB,
  getDuckDB,
  executeQuery,
  resetDatabase,
  fetchSchema,
} from '../database/duckdb';

describe('DuckDB Service', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('should initialize and return db and conn via getDuckDB and initDuckDB', async () => {
    const fromGet = await getDuckDB();
    expect(fromGet).toBeDefined();
    expect(fromGet.db).toBeDefined();
    expect(fromGet.conn).toBeDefined();

    const fromInit = await initDuckDB();
    expect(fromInit.db).toBe(fromGet.db);
    expect(fromInit.conn).toBe(fromGet.conn);
  });

  it('should execute basic SQL query', async () => {
    const res = await executeQuery("SELECT 42 as num, 'hello' as greeting");
    expect(res.rows).toEqual([{ num: 42, greeting: 'hello' }]);
    expect(res.columns).toEqual(['num', 'greeting']);
  });

  it('should handle various SQL data types (integer, bigint, boolean, string, null)', async () => {
    const res = await executeQuery(`
      SELECT
        123 as int_val,
        9007199254740991::BIGINT as bigint_val,
        true as bool_val,
        'sample text' as str_val,
        NULL as null_val
    `);
    expect(res.rows).toEqual([
      {
        int_val: 123,
        bigint_val: 9007199254740991,
        bool_val: true,
        str_val: 'sample text',
        null_val: null,
      },
    ]);
    expect(res.columns).toEqual(['int_val', 'bigint_val', 'bool_val', 'str_val', 'null_val']);
  });

  it('should support CREATE TABLE, INSERT, and SELECT queries', async () => {
    await executeQuery('CREATE TABLE users (id INTEGER, name VARCHAR, active BOOLEAN)');
    await executeQuery("INSERT INTO users VALUES (1, 'Alice', true), (2, 'Bob', false)");

    const res = await executeQuery('SELECT * FROM users ORDER BY id ASC');
    expect(res.columns).toEqual(['id', 'name', 'active']);
    expect(res.rows).toEqual([
      { id: 1, name: 'Alice', active: true },
      { id: 2, name: 'Bob', active: false },
    ]);
  });

  it('should throw an error on invalid SQL syntax', async () => {
    await expect(executeQuery('SELECT FROM INVALID SYNTAX')).rejects.toThrow();
  });

  it('should fetch schema with tables and columns', async () => {
    await executeQuery('CREATE TABLE products (product_id INTEGER, name VARCHAR NOT NULL, price DOUBLE)');
    const schema = await fetchSchema();

    expect(schema.name).toBe('main');
    const productsTable = schema.tables.find((t) => t.name === 'products');
    expect(productsTable).toBeDefined();
    expect(productsTable?.name).toBe('products');
    expect(productsTable?.rowCount).toBe(0);

    const colNames = productsTable?.columns.map((c) => c.name);
    expect(colNames).toContain('product_id');
    expect(colNames).toContain('name');
    expect(colNames).toContain('price');

    const nameCol = productsTable?.columns.find((c) => c.name === 'name');
    expect(nameCol?.isNullable).toBe(false);
  });

  it('should reset database state when resetDatabase is called', async () => {
    await executeQuery('CREATE TABLE temp_table (x INTEGER)');
    await executeQuery('INSERT INTO temp_table VALUES (99)');

    const beforeReset = await executeQuery('SELECT * FROM temp_table');
    expect(beforeReset.rows).toHaveLength(1);

    await resetDatabase();

    // After reset, the temporary table should no longer exist
    await expect(executeQuery('SELECT * FROM temp_table')).rejects.toThrow();
  });

  it('should prevent duplicate initialization on concurrent getDuckDB calls', async () => {
    const [res1, res2, res3] = await Promise.all([
      getDuckDB(),
      getDuckDB(),
      getDuckDB(),
    ]);

    expect(res1.db).toBe(res2.db);
    expect(res2.db).toBe(res3.db);
    expect(res1.conn).toBe(res2.conn);
    expect(res2.conn).toBe(res3.conn);
  });

  it('should handle table names with special characters and quotes in fetchSchema', async () => {
    await executeQuery('CREATE TABLE "user\'s ""special"" table" (id INTEGER, "full name" VARCHAR NOT NULL)');
    await executeQuery('INSERT INTO "user\'s ""special"" table" VALUES (1, \'test\')');

    const schema = await fetchSchema();
    const specialTable = schema.tables.find((t) => t.name === 'user\'s "special" table');
    expect(specialTable).toBeDefined();
    expect(specialTable?.name).toBe('user\'s "special" table');
    expect(specialTable?.rowCount).toBe(1);
    expect(specialTable?.schema).toBe('main');

    const colNames = specialTable?.columns.map((c) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('full name');

    const fullNameCol = specialTable?.columns.find((c) => c.name === 'full name');
    expect(fullNameCol?.isNullable).toBe(false);
  });
});
