import * as duckdb from '@duckdb/duckdb-wasm';
import type { DuckDBBindings, DuckDBConnection as DuckDBBlockingConnection } from '@duckdb/duckdb-wasm/blocking';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import { Schema, TableMeta, ColumnMeta, DataRow, RowValue } from '../types';

export type DuckDBInstance = duckdb.AsyncDuckDB | DuckDBBindings;
export type DuckDBConnection = duckdb.AsyncDuckDBConnection | DuckDBBlockingConnection;

let db: DuckDBInstance | null = null;
let conn: DuckDBConnection | null = null;
let initPromise: Promise<{ db: DuckDBInstance; conn: DuckDBConnection }> | null = null;

const isNodeEnvironment =
  typeof window === 'undefined' ||
  typeof Worker === 'undefined' ||
  (typeof process !== 'undefined' && Boolean(process.versions?.node));

async function initNodeDuckDB(): Promise<{ db: DuckDBBindings; conn: DuckDBBlockingConnection }> {
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
  const DUCKDB_BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
      mainModule: duckdb_wasm,
      mainWorker: mvp_worker,
    },
  };

  const bundle = await duckdb.selectBundle(DUCKDB_BUNDLES);
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const browserDb = new duckdb.AsyncDuckDB(logger, worker);
  await browserDb.instantiate(bundle.mainModule, bundle.pthreadWorker);
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
