import { executeQuery } from './duckdb';
import { SEED_MOVIES_SQL } from '../datasets/movies';
import { Schema, TableMeta, ColumnMeta } from '../types';

export async function seedMoviesDataset(): Promise<void> {
  const statements = SEED_MOVIES_SQL.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const sql of statements) {
    await executeQuery(sql);
  }
}

export async function getIntrospectedSchema(): Promise<Schema> {
  const tablesRes = await executeQuery(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'main' OR table_schema = 'public'
  `);

  const tables: TableMeta[] = [];

  for (const row of tablesRes.rows) {
    const tableName = String(row.table_name);
    const colsRes = await executeQuery(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = '${tableName}'
    `);

    const countRes = await executeQuery(`SELECT COUNT(*) as count FROM ${tableName}`);
    const rowCount = Number(countRes.rows[0]?.count ?? 0);

    const columns: ColumnMeta[] = colsRes.rows.map((c) => {
      const colName = String(c.column_name);
      const isPk =
        colName.endsWith('_id') &&
        (colName === `${tableName}_id` || colName === `${tableName.slice(0, -1)}_id`);
      const isFk = colName.endsWith('_id') && !isPk;

      return {
        name: colName,
        type: String(c.data_type),
        isNullable: c.is_nullable === 'YES',
        isPrimaryKey: isPk,
        isForeignKey: isFk,
        foreignKeyRef: isFk
          ? { table: `${colName.replace('_id', '')}s`, column: colName }
          : undefined,
      };
    });

    tables.push({
      name: tableName,
      schema: 'main',
      columns,
      rowCount,
    });
  }

  return {
    name: 'main',
    tables,
  };
}
