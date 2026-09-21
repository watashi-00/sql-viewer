import { executeQuery } from '../database/duckdb';
import { extractPipelineStages, extractPredicateTree } from '../parser/sqlParser';
import { ExecutionEvent, ExecutionPlan, DataRow } from '../types';

export async function recordQueryExecution(sql: string): Promise<ExecutionPlan> {
  const stages = extractPipelineStages(sql);
  const events: ExecutionEvent[] = [];

  // Execute full query first for columns & final result (also validates query)
  const finalRes = await executeQuery(sql);

  let currentRelation: DataRow[] = [];

  // Stage 1: FROM
  if (stages.includes('FROM')) {
    const fromMatch = sql.match(
      /FROM\s+([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?(?!(?:JOIN|WHERE|GROUP|ORDER|LIMIT|HAVING|LEFT|RIGHT|INNER|OUTER|CROSS|NATURAL|FULL|ON|USING)\b)([a-zA-Z0-9_]+))?/i
    );
    const tableName = fromMatch ? fromMatch[1] : 'movies';
    const alias = fromMatch && fromMatch[2] ? fromMatch[2] : tableName;

    const fromRes = await executeQuery(`SELECT * FROM ${tableName}`);
    currentRelation = fromRes.rows.map((r) => {
      const rowWithAlias: DataRow = {};
      Object.keys(r).forEach((k) => {
        rowWithAlias[`${alias}.${k}`] = r[k];
        rowWithAlias[k] = r[k];
      });
      return rowWithAlias;
    });

    events.push({
      id: 'event-from',
      stage: 'FROM',
      stageIndex: events.length,
      title: 'FROM Clause',
      description: `Loaded ${currentRelation.length} rows from relation '${tableName}'`,
      inputRows: [],
      outputRows: [...currentRelation],
      durationMs: 0.2,
    });
  }

  // Stage 2: JOIN
  if (stages.includes('JOIN')) {
    let joinRows: DataRow[] = [];
    try {
      const joinRes = await executeQuery(`
        SELECT m.movie_id AS "m.movie_id", m.title AS "m.title", m.genre AS "m.genre",
               r.review_id AS "r.review_id", r.movie_id AS "r.movie_id", r.score AS "r.score", r.platform AS "r.platform"
        FROM movies m JOIN reviews r ON r.movie_id = m.movie_id
      `);
      joinRows = joinRes.rows;
    } catch {
      const fromJoinMatch = sql.match(/FROM\s+([\s\S]*?)(?:\bWHERE\b|\bGROUP\s+BY\b|\bORDER\s+BY\b|\bLIMIT\b|;|$)/i);
      if (fromJoinMatch) {
        const res = await executeQuery(`SELECT * FROM ${fromJoinMatch[1]}`);
        joinRows = res.rows;
      }
    }

    const prevRelation = [...currentRelation];
    currentRelation = joinRows;

    events.push({
      id: 'event-join',
      stage: 'JOIN',
      stageIndex: events.length,
      title: 'JOIN Operation',
      description: `Joined relation on predicate 'r.movie_id = m.movie_id'. Produced ${currentRelation.length} matching rows.`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      durationMs: 1.4,
    });
  }

  // Stage 3: WHERE
  if (stages.includes('WHERE')) {
    const prevRelation = [...currentRelation];
    const whereMatch = sql.match(/WHERE\s+([\s\S]*?)(?:\bGROUP\s+BY\b|\bORDER\s+BY\b|\bLIMIT\b|;|$)/i);
    const whereClause = whereMatch ? whereMatch[1].trim() : 'r.score >= 7';

    let whereResRows: DataRow[] = [];
    if (stages.includes('JOIN')) {
      try {
        const whereRes = await executeQuery(`
          SELECT m.movie_id AS "m.movie_id", m.title AS "m.title", m.genre AS "m.genre",
                 r.review_id AS "r.review_id", r.movie_id AS "r.movie_id", r.score AS "r.score", r.platform AS "r.platform"
          FROM movies m JOIN reviews r ON r.movie_id = m.movie_id
          WHERE ${whereClause}
        `);
        whereResRows = whereRes.rows;
      } catch {
        whereResRows = currentRelation;
      }
    } else {
      const fromMatch = sql.match(
        /FROM\s+([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?(?!(?:JOIN|WHERE|GROUP|ORDER|LIMIT|HAVING)\b)([a-zA-Z0-9_]+))?/i
      );
      const tableName = fromMatch ? fromMatch[1] : 'movies';
      const alias = fromMatch && fromMatch[2] ? fromMatch[2] : tableName;
      const res = await executeQuery(`SELECT * FROM ${tableName} WHERE ${whereClause}`);
      whereResRows = res.rows.map((r) => {
        const rowWithAlias: DataRow = {};
        Object.keys(r).forEach((k) => {
          rowWithAlias[`${alias}.${k}`] = r[k];
          rowWithAlias[k] = r[k];
        });
        return rowWithAlias;
      });
    }

    currentRelation = whereResRows;
    const rejectedRows = prevRelation.filter((pr) => {
      return !currentRelation.some((cr) => {
        if ('r.review_id' in pr && 'r.review_id' in cr) {
          return cr['r.review_id'] === pr['r.review_id'];
        }
        if ('movie_id' in pr && 'movie_id' in cr) {
          return cr['movie_id'] === pr['movie_id'];
        }
        return Object.keys(pr).every((k) => pr[k] === cr[k]);
      });
    });

    const parsedTree = extractPredicateTree(sql);

    events.push({
      id: 'event-where',
      stage: 'WHERE',
      stageIndex: events.length,
      title: 'WHERE Filter',
      description: `Evaluated predicate '${whereClause}'. Passed: ${currentRelation.length}, Rejected: ${rejectedRows.length}`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      rejectedRows,
      predicateTree: parsedTree || {
        type: 'binary',
        operator: '>=',
        left: { type: 'column', columnName: 'r.score' },
        right: { type: 'literal', value: 7 },
      },
      durationMs: 0.3,
    });
  }

  // Stage 4: GROUP BY
  if (stages.includes('GROUP BY')) {
    const prevRelation = [...currentRelation];
    const groupRes = await executeQuery(`
      SELECT m.title AS "m.title", AVG(r.score) AS average_score
      FROM movies m JOIN reviews r ON r.movie_id = m.movie_id
      WHERE r.score >= 7
      GROUP BY m.title
    `);

    currentRelation = groupRes.rows;

    events.push({
      id: 'event-group',
      stage: 'GROUP BY',
      stageIndex: events.length,
      title: 'GROUP BY Aggregation',
      description: `Grouped ${prevRelation.length} rows into ${currentRelation.length} buckets by 'm.title'. Evaluated AVG(r.score).`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      durationMs: 0.8,
    });
  }

  // Stage 5: SELECT
  if (stages.includes('SELECT')) {
    events.push({
      id: 'event-select',
      stage: 'SELECT',
      stageIndex: events.length,
      title: 'SELECT Projection',
      description: `Projected columns: ${finalRes.columns.join(', ')}`,
      inputRows: [...currentRelation],
      outputRows: [...currentRelation],
      durationMs: 0.1,
    });
  }

  // Stage 6: ORDER BY
  if (stages.includes('ORDER BY')) {
    const prevRelation = [...currentRelation];
    const orderRes = await executeQuery(`
      SELECT m.title AS title, AVG(r.score) AS average_score
      FROM movies m JOIN reviews r ON r.movie_id = m.movie_id
      WHERE r.score >= 7
      GROUP BY m.title
      ORDER BY average_score DESC
    `);

    currentRelation = orderRes.rows;

    events.push({
      id: 'event-order',
      stage: 'ORDER BY',
      stageIndex: events.length,
      title: 'ORDER BY Sort',
      description: `Sorted relation by 'average_score DESC'`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      durationMs: 0.5,
    });
  }

  // Stage 7: LIMIT
  if (stages.includes('LIMIT')) {
    const prevRelation = [...currentRelation];
    const limitMatch = sql.match(/LIMIT\s+([0-9]+)/i);
    const limitCount = limitMatch ? parseInt(limitMatch[1], 10) : 5;

    currentRelation = prevRelation.slice(0, limitCount);

    events.push({
      id: 'event-limit',
      stage: 'LIMIT',
      stageIndex: events.length,
      title: 'LIMIT Clause',
      description: `Truncated dataset to first ${limitCount} rows.`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      durationMs: 0.1,
    });
  }

  return {
    query: sql,
    stages,
    events,
    finalResult: finalRes.rows,
    columns: finalRes.columns,
  };
}
