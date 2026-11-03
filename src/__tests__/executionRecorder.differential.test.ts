import { beforeAll, describe, expect, it } from 'vitest';
import { recordQueryExecution } from '../debugger/executionRecorder';
import { executeQuery, resetDatabase } from '../database/duckdb';

function canonicalRows(rows: Record<string, unknown>[]): string[] {
  return rows
    .map((row) =>
      JSON.stringify(
        Object.fromEntries(Object.entries(row).sort(([left], [right]) => left.localeCompare(right)))
      )
    )
    .sort();
}

const differentialQueries = [
  {
    name: 'projection with duplicate input rows',
    sql: 'SELECT grp, value FROM differential_left',
  },
  {
    name: 'three-valued WHERE filtering',
    sql: 'SELECT id FROM differential_left WHERE value > 5',
  },
  {
    name: 'NOT IN when the subquery contains NULL',
    sql: 'SELECT l.id FROM differential_left l WHERE l.id NOT IN (SELECT r.left_id FROM differential_right r)',
  },
  {
    name: 'LEFT JOIN followed by a right-side WHERE predicate',
    sql: 'SELECT l.id, r.score FROM differential_left l LEFT JOIN differential_right r ON l.id = r.left_id WHERE r.score > 5',
  },
  {
    name: 'unfiltered LEFT JOIN with multiple matches and NULL padding',
    sql: 'SELECT l.id, r.score FROM differential_left l LEFT JOIN differential_right r ON l.id = r.left_id',
  },
  {
    name: 'COUNT star and COUNT nullable column',
    sql: 'SELECT grp, COUNT(*) AS row_count, COUNT(value) AS value_count FROM differential_left GROUP BY grp',
  },
  {
    name: 'aggregate after join fan out',
    sql: 'SELECT l.id, SUM(l.value) AS total FROM differential_left l JOIN differential_right r ON l.id = r.left_id GROUP BY l.id',
  },
  {
    name: 'DISTINCT with NULL and duplicate values',
    sql: 'SELECT DISTINCT grp FROM differential_left',
  },
  {
    name: 'HAVING with aggregate filtering',
    sql: 'SELECT grp, COUNT(*) AS n FROM differential_left GROUP BY grp HAVING COUNT(*) > 1',
  },
  {
    name: 'ORDER BY and LIMIT with duplicate sort keys',
    sql: 'SELECT id, grp FROM differential_left ORDER BY grp, id DESC LIMIT 3',
  },
];

describe('Execution recorder differential checks', () => {
  beforeAll(async () => {
    await resetDatabase();
    await executeQuery('CREATE TABLE differential_left (id INTEGER, grp VARCHAR, value INTEGER)');
    await executeQuery(`INSERT INTO differential_left VALUES
      (1, 'a', 10), (2, 'a', NULL), (3, 'b', 3), (4, 'b', 3), (5, NULL, 8)`);
    await executeQuery('CREATE TABLE differential_right (id INTEGER, left_id INTEGER, score INTEGER)');
    await executeQuery(`INSERT INTO differential_right VALUES
      (10, 1, 4), (11, 1, NULL), (12, 2, 8), (13, 99, 2), (14, NULL, 1)`);
  });

  it.each(differentialQueries)('keeps the final recorded stage equal to DuckDB for $name', async ({ sql }) => {
    const [plan, expected] = await Promise.all([recordQueryExecution(sql), executeQuery(sql)]);
    const finalStage = plan.events.at(-1);

    expect(finalStage, 'SELECT query should have a recorded final stage').toBeDefined();
    expect(canonicalRows(finalStage!.outputRows)).toEqual(canonicalRows(expected.rows));
    expect(canonicalRows(plan.finalResult)).toEqual(canonicalRows(expected.rows));
  });
});
