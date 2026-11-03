import { ColumnMeta, CustomFileImport, Schema } from '../types';

interface DuckDBFileDatabase {
  registerFileBuffer: (fileName: string, buffer: Uint8Array) => Promise<void> | void;
}

interface WorkspaceFileImportDependencies {
  getDuckDB: () => Promise<{ db: DuckDBFileDatabase }>;
  executeQuery: (sql: string) => Promise<{ rows: Record<string, unknown>[]; columns: string[] }>;
  fetchSchema: () => Promise<Schema>;
  persistWorkspaceFile: (file: {
    fileName: string;
    tableName: string;
    format: 'csv' | 'json' | 'parquet';
    buffer: Uint8Array;
  }) => Promise<void>;
}

export async function importWorkspaceFile(
  dependencies: WorkspaceFileImportDependencies,
  fileName: string,
  buffer: Uint8Array,
  format: 'csv' | 'json' | 'parquet',
  persist = true
): Promise<CustomFileImport> {
  const { db } = await dependencies.getDuckDB();
  const sanitized = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
  const tableName = sanitized || 'custom_table';
  const escapedTableName = tableName.replace(/"/g, '""');
  const escapedFileName = fileName.replace(/'/g, "''");
  const fileSize = buffer.byteLength;
  const databaseBuffer = buffer.slice();

  await db.registerFileBuffer(fileName, databaseBuffer);

  const reader = format === 'json' ? 'read_json_auto' : format === 'parquet' ? 'read_parquet' : 'read_csv_auto';
  await dependencies.executeQuery(
    `CREATE OR REPLACE TABLE "${escapedTableName}" AS SELECT * FROM ${reader}('${escapedFileName}')`
  );

  const schema = await dependencies.fetchSchema();
  const tableMeta = schema.tables.find((table) => table.name === tableName);
  const columns: ColumnMeta[] = tableMeta?.columns || [];
  const rowCount = tableMeta?.rowCount ?? 0;

  if (persist) await dependencies.persistWorkspaceFile({ fileName, tableName, format, buffer });
  return { tableName, fileName, fileSize, format, rowCount, columns };
}
