import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import { Schema, TableMeta, ColumnMeta, DataRow } from '../types';

let db: any = null;
let conn: any = null;

const isNodeEnvironment =
  typeof window === 'undefined' ||
  typeof Worker === 'undefined' ||
  (typeof process !== 'undefined' && Boolean(process.versions?.node));

async function initNodeDuckDB(): Promise<{ db: any; conn: any }> {
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
  return { db: nodeDb, conn: nodeConn };
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

export async function getDuckDB(): Promise<{ db: any; conn: any }> {
  if (db && conn) return { db, conn };

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
}

export const initDuckDB = getDuckDB;

export async function executeQuery(sql: string): Promise<{ rows: DataRow[]; columns: string[] }> {
  const { conn: currentConn } = await getDuckDB();
  const arrowResult = await currentConn.query(sql);
  const rows: DataRow[] = arrowResult.toArray().map((r: any) => {
    const json = r.toJSON();
    const sanitized: DataRow = {};
    for (const [key, val] of Object.entries(json)) {
      sanitized[key] = typeof val === 'bigint' ? Number(val) : (val as any);
    }
    return sanitized;
  });
  const columns: string[] = arrowResult.schema.fields.map((f: any) => f.name);
  return { rows, columns };
}

export async function resetDatabase(): Promise<void> {
  if (conn) {
    if (typeof conn.close === 'function') {
      await conn.close();
    }
    conn = null;
  }
  if (db) {
    if (typeof db.terminate === 'function') {
      await db.terminate();
    }
    db = null;
  }
  await getDuckDB();
}

export async function fetchSchema(): Promise<Schema> {
  const tablesRes = await executeQuery(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'main' OR table_schema = 'public'
    ORDER BY table_name
  `);

  const tables: TableMeta[] = [];
  for (const row of tablesRes.rows) {
    const tableName = String(row.table_name);
    const colsRes = await executeQuery(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = '${tableName}'
      ORDER BY ordinal_position
    `);

    let rowCount: number | undefined = undefined;
    try {
      const countRes = await executeQuery(`SELECT COUNT(*) as count FROM "${tableName}"`);
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
