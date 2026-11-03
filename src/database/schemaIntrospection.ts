import { ColumnMeta, DataRow, Schema, TableMeta } from '../types';

type QueryExecutor = (sql: string) => Promise<{ rows: DataRow[]; columns: string[] }>;

export async function inspectDatabaseSchema(executeQuery: QueryExecutor): Promise<Schema> {
  const tablesRes = await executeQuery(`
    SELECT table_name, table_schema
    FROM information_schema.tables
    WHERE table_schema = 'main' OR table_schema = 'public'
    ORDER BY table_name
  `);

  const tables: TableMeta[] = [];
  for (const row of tablesRes.rows) {
    const tableName = String(row.table_name);
    const tableSchema = String(row.table_schema ?? 'main');
    const escapedTableLiteral = tableName.replace(/'/g, "''");
    const escapedSchemaLiteral = tableSchema.replace(/'/g, "''");
    const escapedTableIdentifier = tableName.replace(/"/g, '""');
    const escapedSchemaIdentifier = tableSchema.replace(/"/g, '""');

    const colsRes = await executeQuery(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = '${escapedTableLiteral}' AND table_schema = '${escapedSchemaLiteral}'
      ORDER BY ordinal_position
    `);

    let rowCount: number | undefined;
    try {
      const countRes = await executeQuery(
        `SELECT COUNT(*) as count FROM "${escapedSchemaIdentifier}"."${escapedTableIdentifier}"`
      );
      if (countRes.rows[0]?.count !== undefined) rowCount = Number(countRes.rows[0].count);
    } catch {
      // Row counts are optional metadata; an inaccessible table should not hide its schema.
    }

    const columns: ColumnMeta[] = colsRes.rows.map((column) => ({
      name: String(column.column_name),
      type: String(column.data_type),
      isNullable: column.is_nullable === 'YES',
    }));
    tables.push({ name: tableName, schema: tableSchema, columns, rowCount });
  }

  return { name: 'main', tables };
}
