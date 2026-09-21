import * as duckdb from '@duckdb/duckdb-wasm';
import type { DuckDBBindings, DuckDBConnection as DuckDBBlockingConnection } from '@duckdb/duckdb-wasm/blocking';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { Schema, TableMeta, ColumnMeta, DataRow, RowValue, CustomFileImport } from '../types';
import {
  loadWorkspace,
  saveWorkspace,
  PersistedWorkspace,
} from '../storage/workspaceStore';

export type DuckDBInstance = duckdb.AsyncDuckDB | DuckDBBindings;
export type DuckDBConnection = duckdb.AsyncDuckDBConnection | DuckDBBlockingConnection;

let db: DuckDBInstance | null = null;
let conn: DuckDBConnection | null = null;
let initPromise: Promise<{ db: DuckDBInstance; conn: DuckDBConnection }> | null = null;
let workspaceRestored = false;
let workspaceStateLoaded = false;
let persistedWorkspace: PersistedWorkspace = { files: [], commands: [] };

const isNodeEnvironment =
  typeof window === 'undefined' ||
  typeof Worker === 'undefined' ||
  (typeof process !== 'undefined' && Boolean(process.versions?.node));

async function initNodeDuckDB(): Promise<{ db: DuckDBBindings; conn: DuckDBBlockingConnection }> {
  if (typeof globalThis !== 'undefined' && 'XMLHttpRequest' in globalThis) {
    delete (globalThis as any).XMLHttpRequest;
  }
  if (typeof window !== 'undefined' && 'XMLHttpRequest' in window) {
    delete (window as any).XMLHttpRequest;
  }
  const { createRequire } = await import(/* @vite-ignore */ 'module');
  const req = createRequire(import.meta.url);
  const duckdbNode = req('@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs');
  const wasmPath = req.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm');
  const workerPath = req.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-mvp.worker.cjs');

  const DUCKDB_BUNDLES = {
    mvp: {
      mainModule: wasmPath,
      mainWorker: workerPath,
    },
  };

  const logger = new duckdbNode.ConsoleLogger();
  const nodeDb = await duckdbNode.createDuckDB(DUCKDB_BUNDLES, logger, duckdbNode.NODE_RUNTIME);
  await nodeDb.instantiate();
  const nodeConn = nodeDb.connect();
  return { db: nodeDb as DuckDBBindings, conn: nodeConn as DuckDBBlockingConnection };
}

async function initBrowserDuckDB(): Promise<{ db: duckdb.AsyncDuckDB; conn: duckdb.AsyncDuckDBConnection }> {
  const worker = new Worker(eh_worker);
  const logger = new duckdb.ConsoleLogger();
  const browserDb = new duckdb.AsyncDuckDB(logger, worker);
  await browserDb.instantiate(duckdb_wasm);
  const browserConn = await browserDb.connect();
  return { db: browserDb, conn: browserConn };
}

export async function getDuckDB(): Promise<{ db: DuckDBInstance; conn: DuckDBConnection }> {
  if (db && conn) return { db, conn };
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (isNodeEnvironment) {
        const res = await initNodeDuckDB();
        db = res.db;
        conn = res.conn;
        return { db, conn };
      }

      const res = await initBrowserDuckDB();
      db = res.db;
      conn = res.conn;
      return { db, conn };
    } catch (err) {
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

export const initDuckDB = getDuckDB;

async function ensurePersistedWorkspaceLoaded(): Promise<void> {
  if (workspaceStateLoaded || isNodeEnvironment) return;
  persistedWorkspace = await loadWorkspace();
  workspaceStateLoaded = true;
}

async function tableExists(tableName: string): Promise<boolean> {
  const escapedTableName = tableName.replace(/'/g, "''");
  const result = await executeQuery(`
    SELECT COUNT(*) AS count
    FROM information_schema.tables
    WHERE table_schema = 'main' AND table_name = '${escapedTableName}'
  `);
  return Number(result.rows[0]?.count ?? 0) > 0;
}

export async function restoreWorkspace(): Promise<void> {
  if (isNodeEnvironment || workspaceRestored) return;
  await ensurePersistedWorkspaceLoaded();

  for (const file of persistedWorkspace.files) {
    if (!(await tableExists(file.tableName))) {
      await registerAndLoadFile(file.fileName, file.buffer, file.format, false);
    }
  }

  for (const command of persistedWorkspace.commands) {
    if (!command.tableName || !(await tableExists(command.tableName))) {
      await executeQuery(command.sql);
    }
  }

  workspaceRestored = true;
}

export async function persistWorkspaceFile(file: {
  fileName: string;
  tableName: string;
  format: 'csv' | 'json' | 'parquet';
  buffer: Uint8Array;
}): Promise<void> {
  if (isNodeEnvironment) return;
  await ensurePersistedWorkspaceLoaded();
  persistedWorkspace.files = [
    ...persistedWorkspace.files.filter((item) => item.tableName !== file.tableName),
    file,
  ];
  persistedWorkspace.commands = persistedWorkspace.commands.filter(
    (command) => command.tableName !== file.tableName
  );
  await saveWorkspace(persistedWorkspace);
}

export async function persistWorkspaceCommand(sql: string): Promise<void> {
  if (isNodeEnvironment) return;
  await ensurePersistedWorkspaceLoaded();
  const tableMatch = sql.match(
    /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-zA-Z0-9_]+)["`]?/i
  );
  const tableName = tableMatch?.[1];
  if (tableName) {
    persistedWorkspace.files = persistedWorkspace.files.filter((file) => file.tableName !== tableName);
  }
  persistedWorkspace.commands = [
    ...persistedWorkspace.commands.filter((command) => command.tableName !== tableName),
    { sql, tableName },
  ];
  await saveWorkspace(persistedWorkspace);
}

export async function executeQuery(sql: string): Promise<{ rows: DataRow[]; columns: string[] }> {
  const { conn: currentConn } = await getDuckDB();
  const arrowResult = await currentConn.query(sql);
  const rows: DataRow[] = arrowResult.toArray().map((r) => {
    const json = r.toJSON() as Record<string, unknown>;
    const sanitized: DataRow = {};
    for (const [key, val] of Object.entries(json)) {
      sanitized[key] = typeof val === 'bigint' ? Number(val) : (val as RowValue);
    }
    return sanitized;
  });
  const columns: string[] = arrowResult.schema.fields.map((f) => f.name);
  return { rows, columns };
}

export async function resetDatabase(): Promise<void> {
  const inFlightPromise = initPromise;
  initPromise = null;
  if (inFlightPromise) {
    try {
      await inFlightPromise;
    } catch {
      // Ignore in-flight initialization failure
    }
  }
  if (conn) {
    if (typeof conn.close === 'function') {
      await conn.close();
    }
    conn = null;
  }
  if (db) {
    if ('terminate' in db && typeof db.terminate === 'function') {
      await db.terminate();
    }
    db = null;
  }
  initPromise = null;
  workspaceRestored = false;
  await getDuckDB();
}

export async function fetchSchema(): Promise<Schema> {
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

    let rowCount: number | undefined = undefined;
    try {
      const countRes = await executeQuery(
        `SELECT COUNT(*) as count FROM "${escapedSchemaIdentifier}"."${escapedTableIdentifier}"`
      );
      if (countRes.rows[0]?.count !== undefined) {
        rowCount = Number(countRes.rows[0].count);
      }
    } catch {
      // Ignore count error
    }

    const columns: ColumnMeta[] = colsRes.rows.map((c) => ({
      name: String(c.column_name),
      type: String(c.data_type),
      isNullable: c.is_nullable === 'YES',
    }));

    tables.push({
      name: tableName,
      schema: tableSchema,
      columns,
      rowCount,
    });
  }

  return {
    name: 'main',
    tables,
  };
}

export async function registerAndLoadFile(
  fileName: string,
  buffer: Uint8Array,
  format: 'csv' | 'json' | 'parquet',
  persist = true
): Promise<CustomFileImport> {
  const { db } = await getDuckDB();

  const sanitized = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
  const tableName = sanitized || 'custom_table';
  const escapedTableName = tableName.replace(/"/g, '""');
  const escapedFileName = fileName.replace(/'/g, "''");
  const fileSize = buffer.byteLength;
  const databaseBuffer = buffer.slice();

  await db.registerFileBuffer(fileName, databaseBuffer);

  let readFn = 'read_csv_auto';
  if (format === 'json') {
    readFn = 'read_json_auto';
  } else if (format === 'parquet') {
    readFn = 'read_parquet';
  }

  await executeQuery(`CREATE OR REPLACE TABLE "${escapedTableName}" AS SELECT * FROM ${readFn}('${escapedFileName}')`);

  const schema = await fetchSchema();
  const tableMeta = schema.tables.find((t) => t.name === tableName);

  const columns = tableMeta ? tableMeta.columns : [];
  const rowCount = tableMeta?.rowCount ?? 0;

  if (persist) {
    await persistWorkspaceFile({ fileName, tableName, format, buffer });
  }

  return {
    tableName,
    fileName,
    fileSize,
    format,
    rowCount,
    columns,
  };
}

