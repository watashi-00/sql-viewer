import { connectDuckDB, DuckDBConnection, executeQueryOnConnection } from '../database/duckdb';
import { DataRow } from '../types';
import { ChallengeDefinition } from './types';

const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`;
const quoteString = (value: string) => `'${value.replace(/'/g, "''")}'`;

export interface ChallengeSession {
  execute: (sql: string) => Promise<{ rows: DataRow[]; columns: string[] }>;
  close: () => Promise<void>;
}

export async function createChallengeSession(challenge: ChallengeDefinition): Promise<ChallengeSession> {
  const connection: DuckDBConnection = await connectDuckDB();
  const schemaName = `challenge_${challenge.id.replace(/[^a-z0-9_]/gi, '_')}_${Math.random().toString(36).slice(2, 8)}`;
  const schema = quoteIdentifier(schemaName);
  const execute = (sql: string) => executeQueryOnConnection(connection, sql);

  try {
    await execute(`CREATE SCHEMA ${schema}`);
    await execute(`SET schema = ${quoteString(schemaName)}`);
    for (const statement of challenge.setupSql.split(';').map((part) => part.trim()).filter(Boolean)) {
      await execute(statement);
    }
  } catch (error) {
    await connection.close();
    throw error;
  }

  return {
    execute,
    close: async () => {
      try {
        await execute(`SET schema = ${quoteString('main')}`);
        await execute(`DROP SCHEMA ${schema} CASCADE`);
      } finally {
        await connection.close();
      }
    },
  };
}

function equalValue(actual: unknown, expected: unknown, tolerance: number): boolean {
  if (actual == null || expected == null) return actual == null && expected == null;
  if (typeof actual === 'number' && typeof expected === 'number') {
    return Math.abs(actual - expected) <= tolerance;
  }
  if (actual instanceof Date || expected instanceof Date) {
    return String(actual) === String(expected);
  }
  if (typeof actual === 'object' || typeof expected === 'object') {
    return JSON.stringify(actual) === JSON.stringify(expected);
  }
  return actual === expected;
}

function equalRow(actual: DataRow, expected: DataRow, columns: string[], tolerance: number): boolean {
  return columns.every((column) => equalValue(actual[column], expected[column], tolerance));
}

export function compareChallengeResults(
  actual: DataRow[],
  expected: DataRow[],
  columns: string[],
  options: { ordered?: boolean; floatTolerance?: number } = {}
): boolean {
  if (actual.length !== expected.length) return false;
  const tolerance = options.floatTolerance ?? 1e-9;
  if (options.ordered) return actual.every((row, index) => equalRow(row, expected[index], columns, tolerance));

  const unmatched = [...expected];
  for (const row of actual) {
    const match = unmatched.findIndex((candidate) => equalRow(row, candidate, columns, tolerance));
    if (match === -1) return false;
    unmatched.splice(match, 1);
  }
  return unmatched.length === 0;
}
