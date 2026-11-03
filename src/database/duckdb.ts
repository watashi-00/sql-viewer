import * as duckdb from '@duckdb/duckdb-wasm';
import type { DuckDBBindings, DuckDBConnection as DuckDBBlockingConnection } from '@duckdb/duckdb-wasm/blocking';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { Schema, DataRow, RowValue, CustomFileImport } from '../types';
import type { PersistedWorkspaceFile } from '../storage/workspaceStore';
import { WorkspacePersistence } from './workspacePersistence';
import { importWorkspaceFile } from './fileImport';
import { inspectDatabaseSchema } from './schemaIntrospection';

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

export function restoreWorkspace(): Promise<void> {
  return workspacePersistence.restore();
}

export function persistWorkspaceFile(file: PersistedWorkspaceFile): Promise<void> {
  return workspacePersistence.persistFile(file);
}

export function persistWorkspaceCommand(sql: string): Promise<void> {
  return workspacePersistence.persistCommand(sql);
}

export function persistWorkspaceMutation(sql: string): Promise<void> {
  return workspacePersistence.persistMutation(sql);
}

export async function executeQuery(sql: string): Promise<{ rows: DataRow[]; columns: string[] }> {
  const { conn: currentConn } = await getDuckDB();
  return executeQueryOnConnection(currentConn, sql);
}

export async function executeQueryOnConnection(
  connection: DuckDBConnection,
  sql: string
): Promise<{ rows: DataRow[]; columns: string[] }> {
  const arrowResult = await connection.query(sql);
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

export async function connectDuckDB(): Promise<DuckDBConnection> {
  const { db } = await getDuckDB();
  return await db.connect();
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
  workspacePersistence.reset();
  await getDuckDB();
}

export function fetchSchema(): Promise<Schema> {
  return inspectDatabaseSchema(executeQuery);
}

export function registerAndLoadFile(
  fileName: string,
  buffer: Uint8Array,
  format: 'csv' | 'json' | 'parquet',
  persist = true
): Promise<CustomFileImport> {
  return importWorkspaceFile(
    { getDuckDB, executeQuery, fetchSchema, persistWorkspaceFile },
    fileName,
    buffer,
    format,
    persist
  );
}

const workspacePersistence = new WorkspacePersistence({
  isNodeEnvironment,
  executeQuery,
  registerAndLoadFile,
});
