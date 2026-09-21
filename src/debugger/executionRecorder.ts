import { executeQuery } from '../database/duckdb';
import { extractPipelineStages, extractPredicateTree } from '../parser/sqlParser';
import { ExecutionEvent, ExecutionPlan, DataRow } from '../types';

/**
 * Maps rows to include keys prefixed by table alias as well as unaliased keys.
 */
export function withAlias(rows: DataRow[], alias: string): DataRow[] {
  if (!alias) return rows;
  return rows.map((r) => {
    const rowWithAlias: DataRow = {};
    Object.keys(r).forEach((k) => {
      rowWithAlias[`${alias}.${k}`] = r[k];
      rowWithAlias[k] = r[k];
    });
    return rowWithAlias;
  });
}

/**
 * Compares two DataRows for deep equality key-by-key.
 */
export function isSameRow(a: DataRow, b: DataRow): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/**
 * Measures duration in milliseconds rounded to 1 decimal place.
 */
function measureDuration(startTime: number): number {
  return Number((performance.now() - startTime).toFixed(1));
}

/**
 * Extracts individual query clauses for prefix query construction and descriptions.
 */
function extractClauses(sql: string) {
  const cleanSql = sql.replace(/;+\s*$/, '').trim();

  // Extract FROM ... clause up to WHERE, GROUP BY, HAVING, ORDER BY, LIMIT
  const fromJoinMatch = cleanSql.match(
    /\bFROM\s+([\s\S]*?)(?:\bWHERE\b|\bGROUP\s+BY\b|\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|$)/i
  );
  const fromJoinClause = fromJoinMatch ? fromJoinMatch[1].trim() : 'movies';

  // Base table and alias
  let baseTable = 'movies';
  let baseAlias = 'movies';
  const baseMatch = fromJoinClause.match(
    /^([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?(?!(?:LEFT|RIGHT|INNER|OUTER|CROSS|FULL|NATURAL|JOIN)\b)([a-zA-Z0-9_]+))?/i
  );
  if (baseMatch) {
    baseTable = baseMatch[1];
    baseAlias = baseMatch[2] || baseTable;
  }

  // JOIN clause details
  const joinMatch = cleanSql.match(
    /\b(?:LEFT|RIGHT|INNER|OUTER|CROSS|FULL|NATURAL|,)?\s*JOIN\s+([a-zA-Z0-9_]+(?:\s+(?:AS\s+)?[a-zA-Z0-9_]+)?)(?:\s+ON\s+([\s\S]*?))?(?:\b(?:LEFT|RIGHT|INNER|OUTER|CROSS|FULL|NATURAL|,)?\s*JOIN\b|\bWHERE\b|\bGROUP\s+BY\b|\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|$)/i
  );
  const joinTarget = joinMatch ? joinMatch[1].trim() : '';
  const joinPredicate = joinMatch && joinMatch[2] ? joinMatch[2].trim() : '';

  // WHERE clause
  const whereMatch = cleanSql.match(
    /\bWHERE\s+([\s\S]*?)(?:\bGROUP\s+BY\b|\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|$)/i
  );
  const whereClause = whereMatch ? whereMatch[1].trim() : '';

  // GROUP BY clause
  const groupByMatch = cleanSql.match(
    /\bGROUP\s+BY\s+([\s\S]*?)(?:\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|$)/i
  );
  const groupByClause = groupByMatch ? groupByMatch[1].trim() : '';

  // SELECT projection
  const selectMatch = cleanSql.match(/\bSELECT\s+([\s\S]*?)\s+\bFROM\b/i);
  const selectClause = selectMatch ? selectMatch[1].trim() : '*';

  // ORDER BY clause
  const orderByMatch = cleanSql.match(/\bORDER\s+BY\s+([\s\S]*?)(?:\bLIMIT\b|$)/i);
  const orderByClause = orderByMatch ? orderByMatch[1].trim() : '';

  // LIMIT clause
  const limitMatch = cleanSql.match(/\bLIMIT\s+([0-9]+)/i);
  const limitCount = limitMatch ? parseInt(limitMatch[1], 10) : 5;

  return {
    cleanSql,
    fromJoinClause,
    baseTable,
    baseAlias,
    joinTarget,
    joinPredicate,
    whereClause,
    groupByClause,
    selectClause,
    orderByClause,
    limitCount,
  };
}

export async function recordQueryExecution(sql: string): Promise<ExecutionPlan> {
  const stages = extractPipelineStages(sql);
  const events: ExecutionEvent[] = [];

  // Execute full query first for columns & final result (also validates query)
  const finalRes = await executeQuery(sql);

  const {
    cleanSql,
    fromJoinClause,
    baseTable,
    baseAlias,
    joinTarget,
    joinPredicate,
    whereClause,
    groupByClause,
    selectClause,
    orderByClause,
    limitCount,
  } = extractClauses(sql);

  let currentRelation: DataRow[] = [];

  // Stage 1: FROM
  if (stages.includes('FROM')) {
    const startFrom = performance.now();
    const fromRes = await executeQuery(`SELECT * FROM ${baseTable}`);
    const durationMs = measureDuration(startFrom);
    currentRelation = withAlias(fromRes.rows, baseAlias);

    events.push({
      id: 'event-from',
      stage: 'FROM',
      stageIndex: events.length,
      title: 'FROM Clause',
      description: `Loaded ${currentRelation.length} rows from relation '${baseTable}'`,
      inputRows: [],
      outputRows: [...currentRelation],
      durationMs,
    });
  }

  // Stage 2: JOIN
  if (stages.includes('JOIN')) {
    const prevRelation = [...currentRelation];
    const startJoin = performance.now();
    let joinRows: DataRow[] = [];
    try {
      const joinRes = await executeQuery(`SELECT * FROM ${fromJoinClause}`);
      joinRows = joinRes.rows;
    } catch {
      joinRows = currentRelation;
    }
    const durationMs = measureDuration(startJoin);
    currentRelation = joinRows;

    const joinDesc = joinPredicate
      ? `Joined relation on predicate '${joinPredicate}'. Produced ${currentRelation.length} matching rows.`
      : `Joined relation '${joinTarget}'. Produced ${currentRelation.length} matching rows.`;

    events.push({
      id: 'event-join',
      stage: 'JOIN',
      stageIndex: events.length,
      title: 'JOIN Operation',
      description: joinDesc,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      durationMs,
    });
  }

  // Stage 3: WHERE
  if (stages.includes('WHERE')) {
    const prevRelation = [...currentRelation];
    const startWhere = performance.now();
    const whereQuery = `SELECT * FROM ${fromJoinClause} WHERE ${whereClause}`;

    let whereResRows: DataRow[] = [];
    try {
      const whereRes = await executeQuery(whereQuery);
      whereResRows = whereRes.rows;
      if (!stages.includes('JOIN')) {
        whereResRows = withAlias(whereResRows, baseAlias);
      }
    } catch {
      whereResRows = currentRelation;
    }
    const durationMs = measureDuration(startWhere);
    currentRelation = whereResRows;

    const rejectedRows = prevRelation.filter(
      (pr) => !currentRelation.some((cr) => isSameRow(pr, cr))
    );

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
      durationMs,
    });
  }

  // Stage 4: GROUP BY
  if (stages.includes('GROUP BY')) {
    const prevRelation = [...currentRelation];
    const groupQuery = `SELECT ${selectClause} FROM ${fromJoinClause} ${
      whereClause ? `WHERE ${whereClause}` : ''
    } GROUP BY ${groupByClause}`;

    const startGroup = performance.now();
    let groupRows: DataRow[] = [];
    try {
      const groupRes = await executeQuery(groupQuery);
      groupRows = groupRes.rows;
    } catch {
      groupRows = currentRelation;
    }
    const durationMs = measureDuration(startGroup);
    currentRelation = groupRows;

    const aggMatch = selectClause.match(/\b(AVG|COUNT|SUM|MIN|MAX)\s*\([^)]+\)/gi);
    const aggDesc = aggMatch ? ` Evaluated ${aggMatch.join(', ')}.` : '';

    events.push({
      id: 'event-group',
      stage: 'GROUP BY',
      stageIndex: events.length,
      title: 'GROUP BY Aggregation',
      description: `Grouped ${prevRelation.length} rows into ${currentRelation.length} buckets by '${groupByClause}'.${aggDesc}`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      durationMs,
    });
  }

  // Stage 5: SELECT
  if (stages.includes('SELECT')) {
    const prevRelation = [...currentRelation];
    const startSelect = performance.now();

    let selectRows = currentRelation;
    if (!stages.includes('GROUP BY') && selectClause !== '*') {
      selectRows = currentRelation.map((r) => {
        const projected: DataRow = {};
        for (const col of finalRes.columns) {
          if (col in r) {
            projected[col] = r[col];
          }
        }
        return projected;
      });
    }

    currentRelation = selectRows;
    const durationMs = measureDuration(startSelect);

    events.push({
      id: 'event-select',
      stage: 'SELECT',
      stageIndex: events.length,
      title: 'SELECT Projection',
      description: `Projected columns: ${finalRes.columns.join(', ')}`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      durationMs,
    });
  }

  // Stage 6: ORDER BY
  if (stages.includes('ORDER BY')) {
    const prevRelation = [...currentRelation];
    const orderQuery = cleanSql.replace(/\bLIMIT\s+[\s\S]*$/i, '').trim();

    const startOrder = performance.now();
    let orderRows: DataRow[] = [];
    try {
      const orderRes = await executeQuery(orderQuery);
      orderRows = orderRes.rows;
    } catch {
      orderRows = currentRelation;
    }
    const durationMs = measureDuration(startOrder);
    currentRelation = orderRows;

    events.push({
      id: 'event-order',
      stage: 'ORDER BY',
      stageIndex: events.length,
      title: 'ORDER BY Sort',
      description: `Sorted relation by '${orderByClause}'`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      durationMs,
    });
  }

  // Stage 7: LIMIT
  if (stages.includes('LIMIT')) {
    const prevRelation = [...currentRelation];
    const startLimit = performance.now();
    currentRelation = prevRelation.slice(0, limitCount);
    const durationMs = measureDuration(startLimit);

    events.push({
      id: 'event-limit',
      stage: 'LIMIT',
      stageIndex: events.length,
      title: 'LIMIT Clause',
      description: `Truncated dataset to first ${limitCount} rows.`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      durationMs,
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
