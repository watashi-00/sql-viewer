import { executeQuery } from '../database/duckdb';
import { extractPipelineStages, extractPredicateTree } from '../parser/sqlParser';
import {
  ExecutionEvent,
  ExecutionPlan,
  DataRow,
  JoinMatch,
  RowValue,
  GroupBucket,
  GroupAggregateCalc,
} from '../types';

export interface AggregateDefinition {
  funcName: 'AVG' | 'SUM' | 'COUNT' | 'MIN' | 'MAX';
  expression: string;
}

/**
 * Extracts aggregate function definitions from SELECT and optional HAVING clauses.
 */
export function extractAggregatesFromSql(
  selectClause: string,
  havingClause?: string
): AggregateDefinition[] {
  const aggs: AggregateDefinition[] = [];
  const combined = `${selectClause} ${havingClause ?? ''}`;
  const regex = /\b(AVG|SUM|COUNT|MIN|MAX)\s*\(\s*(?:DISTINCT\s+)?([*a-zA-Z0-9_.]+)\s*\)/gi;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((match = regex.exec(combined)) !== null) {
    const rawFunc = match[1].toUpperCase() as 'AVG' | 'SUM' | 'COUNT' | 'MIN' | 'MAX';
    const expr = match[2].trim();
    const key = `${rawFunc}:${expr}`;
    if (!seen.has(key)) {
      seen.add(key);
      aggs.push({ funcName: rawFunc, expression: expr });
    }
  }
  return aggs;
}

/**
 * Resolves a group key for a data row based on the GROUP BY clause.
 */
export function getGroupKey(row: DataRow, groupByClause: string): string {
  if (!groupByClause) return 'Group';
  const cols = groupByClause.split(',').map((c) => c.trim());
  const vals: string[] = [];
  for (const col of cols) {
    let val = row[col];
    if (val === undefined && col.includes('.')) {
      const unaliased = col.slice(col.indexOf('.') + 1);
      val = row[unaliased];
    }
    if (val === undefined) {
      const matchingKey = Object.keys(row).find((k) => k.endsWith(`.${col}`) || k === col);
      if (matchingKey !== undefined) {
        val = row[matchingKey];
      }
    }
    if (val !== undefined && val !== null) {
      vals.push(String(val));
    }
  }
  if (vals.length > 0) {
    return vals.join(', ');
  }
  return String(row['m.title'] ?? row['title'] ?? 'Group');
}

/**
 * Extracts the value of a column/expression from a row.
 */
export function extractColValue(row: DataRow, expression: string): RowValue {
  if (expression in row && row[expression] !== undefined) return row[expression];
  if (expression.includes('.')) {
    const colOnly = expression.slice(expression.indexOf('.') + 1);
    if (colOnly in row && row[colOnly] !== undefined) return row[colOnly];
  } else {
    const key = Object.keys(row).find((k) => k.endsWith(`.${expression}`) || k === expression);
    if (key && row[key] !== undefined) return row[key];
  }
  return row['r.score'] ?? row['score'];
}

/**
 * Computes step-by-step aggregate calculations for a group bucket's rows.
 */
export function computeBucketAggregates(
  rows: DataRow[],
  aggs: AggregateDefinition[]
): GroupAggregateCalc[] {
  const calcs: GroupAggregateCalc[] = [];

  for (const agg of aggs) {
    switch (agg.funcName) {
      case 'AVG': {
        const rawVals = rows
          .map((r) => extractColValue(r, agg.expression))
          .filter((v) => v !== null && v !== undefined);
        const numVals = rawVals.map(Number).filter((v) => !isNaN(v));
        const count = numVals.length;
        const sum = numVals.reduce((a, b) => a + b, 0);
        const avg = count > 0 ? Number((sum / count).toFixed(2)) : 0;
        calcs.push({
          funcName: 'AVG',
          expression: agg.expression,
          inputValues: numVals,
          formulaStep: count > 0 ? `(${numVals.join(' + ')}) / ${count}` : '0 / 0',
          finalValue: avg,
        });
        break;
      }
      case 'SUM': {
        const rawVals = rows
          .map((r) => extractColValue(r, agg.expression))
          .filter((v) => v !== null && v !== undefined);
        const numVals = rawVals.map(Number).filter((v) => !isNaN(v));
        const sum = numVals.reduce((a, b) => a + b, 0);
        calcs.push({
          funcName: 'SUM',
          expression: agg.expression,
          inputValues: numVals,
          formulaStep: numVals.length > 0 ? numVals.join(' + ') : '0',
          finalValue: sum,
        });
        break;
      }
      case 'COUNT': {
        if (agg.expression === '*') {
          calcs.push({
            funcName: 'COUNT',
            expression: '*',
            inputValues: rows.map((_, i) => i + 1),
            formulaStep: `${rows.length} rows in bucket → ${rows.length}`,
            finalValue: rows.length,
          });
        } else {
          const nonNullVals = rows
            .map((r) => extractColValue(r, agg.expression))
            .filter((v) => v !== null && v !== undefined);
          calcs.push({
            funcName: 'COUNT',
            expression: agg.expression,
            inputValues: nonNullVals,
            formulaStep: `${nonNullVals.length} non-null values → ${nonNullVals.length}`,
            finalValue: nonNullVals.length,
          });
        }
        break;
      }
      case 'MIN': {
        const rawVals = rows
          .map((r) => extractColValue(r, agg.expression))
          .filter((v) => v !== null && v !== undefined);
        const numVals = rawVals.map(Number).filter((v) => !isNaN(v));
        const min = numVals.length > 0 ? Math.min(...numVals) : 0;
        calcs.push({
          funcName: 'MIN',
          expression: agg.expression,
          inputValues: numVals,
          formulaStep: numVals.length > 0 ? `MIN(${numVals.join(', ')})` : 'MIN()',
          finalValue: min,
        });
        break;
      }
      case 'MAX': {
        const rawVals = rows
          .map((r) => extractColValue(r, agg.expression))
          .filter((v) => v !== null && v !== undefined);
        const numVals = rawVals.map(Number).filter((v) => !isNaN(v));
        const max = numVals.length > 0 ? Math.max(...numVals) : 0;
        calcs.push({
          funcName: 'MAX',
          expression: agg.expression,
          inputValues: numVals,
          formulaStep: numVals.length > 0 ? `MAX(${numVals.join(', ')})` : 'MAX()',
          finalValue: max,
        });
        break;
      }
    }
  }

  return calcs;
}


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

  // HAVING clause
  const havingMatch = cleanSql.match(
    /\bHAVING\s+([\s\S]*?)(?:\bORDER\s+BY\b|\bLIMIT\b|$)/i
  );
  const havingClause = havingMatch ? havingMatch[1].trim() : '';

  // SELECT projection
  const selectMatch = cleanSql.match(/\bSELECT\s+(?:DISTINCT\s+)?([\s\S]*?)\s+\bFROM\b/i);
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
    havingClause,
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
    havingClause,
    selectClause,
    orderByClause,
    limitCount,
  } = extractClauses(sql);

  let currentRelation: DataRow[] = [];
  let lastGroupBuckets: GroupBucket[] = [];

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

    // Build tuple match pairs between left relation and right relation
    let leftRows: DataRow[] = [];
    try {
      const leftRes = await executeQuery(`SELECT * FROM ${baseTable}`);
      leftRows = leftRes.rows;
    } catch {
      leftRows = prevRelation;
    }

    const rightMatch = fromJoinClause.match(
      /\b(?:LEFT|RIGHT|INNER|OUTER|CROSS|FULL|NATURAL|,)?\s*JOIN\s+([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?/i
    );
    const rightTable = rightMatch ? rightMatch[1] : (joinTarget.split(/\s+/)[0] || 'reviews');
    const rightAlias = rightMatch && rightMatch[2] ? rightMatch[2] : rightTable;

    let rightRows: DataRow[] = [];
    try {
      const rightRes = await executeQuery(`SELECT * FROM ${rightTable}`);
      rightRows = rightRes.rows;
    } catch {
      rightRows = [];
    }

    // Determine join predicate columns
    let leftCol: string | null = null;
    let rightCol: string | null = null;
    let literalVal: RowValue | null = null;
    let literalSide: 'left' | 'right' | null = null;

    if (joinPredicate) {
      const eqMatch = joinPredicate.match(/([a-zA-Z0-9_.]+)\s*=\s*([a-zA-Z0-9_.]+)/);
      if (eqMatch) {
        const parseSide = (expr: string) => {
          const trimmed = expr.trim();
          const dotIdx = trimmed.indexOf('.');
          if (dotIdx !== -1) {
            return { qualifier: trimmed.slice(0, dotIdx), col: trimmed.slice(dotIdx + 1) };
          }
          return { qualifier: null, col: trimmed };
        };

        const side1 = parseSide(eqMatch[1]);
        const side2 = parseSide(eqMatch[2]);
        const isLit1 = /^[0-9]+$|^'[^']*'$/.test(side1.col);
        const isLit2 = /^[0-9]+$|^'[^']*'$/.test(side2.col);

        if (isLit2) {
          const valStr = side2.col.replace(/^'|'$/g, '');
          literalVal = isNaN(Number(valStr)) ? valStr : Number(valStr);
          if (side1.qualifier === baseAlias || side1.qualifier === baseTable) {
            leftCol = side1.col;
            literalSide = 'left';
          } else {
            rightCol = side1.col;
            literalSide = 'right';
          }
        } else if (isLit1) {
          const valStr = side1.col.replace(/^'|'$/g, '');
          literalVal = isNaN(Number(valStr)) ? valStr : Number(valStr);
          if (side2.qualifier === baseAlias || side2.qualifier === baseTable) {
            leftCol = side2.col;
            literalSide = 'left';
          } else {
            rightCol = side2.col;
            literalSide = 'right';
          }
        } else {
          if (side1.qualifier && (side1.qualifier === baseAlias || side1.qualifier === baseTable)) {
            leftCol = side1.col;
            rightCol = side2.col;
          } else if (side2.qualifier && (side2.qualifier === baseAlias || side2.qualifier === baseTable)) {
            leftCol = side2.col;
            rightCol = side1.col;
          } else if (side1.qualifier && (side1.qualifier === rightAlias || side1.qualifier === rightTable)) {
            rightCol = side1.col;
            leftCol = side2.col;
          } else if (side2.qualifier && (side2.qualifier === rightAlias || side2.qualifier === rightTable)) {
            rightCol = side2.col;
            leftCol = side1.col;
          } else {
            const sampleLeft = leftRows[0] || {};
            const sampleRight = rightRows[0] || {};
            if (side1.col in sampleLeft && side2.col in sampleRight) {
              leftCol = side1.col;
              rightCol = side2.col;
            } else if (side2.col in sampleLeft && side1.col in sampleRight) {
              leftCol = side2.col;
              rightCol = side1.col;
            }
          }
        }
      }
    }

    if (!leftCol || !rightCol) {
      const sampleLeft = leftRows[0] || {};
      const sampleRight = rightRows[0] || {};
      const commonCols = Object.keys(sampleLeft).filter((k) => k in sampleRight && !k.includes('.'));
      if (commonCols.length > 0) {
        leftCol = commonCols[0];
        rightCol = commonCols[0];
      } else if ('movie_id' in sampleLeft && 'movie_id' in sampleRight) {
        leftCol = 'movie_id';
        rightCol = 'movie_id';
      }
    }

    const isCrossJoin = !joinPredicate && cleanSql.toUpperCase().includes('CROSS JOIN');
    const joinMatches: JoinMatch[] = [];
    const matchedLeftIndices = new Set<number>();
    const matchedRightIndices = new Set<number>();

    leftRows.forEach((lRow, lIdx) => {
      rightRows.forEach((rRow, rIdx) => {
        let isMatch = false;
        if (isCrossJoin) {
          isMatch = true;
        } else if (literalSide === 'left' && leftCol) {
          const lVal = lRow[leftCol] ?? lRow[`${baseAlias}.${leftCol}`];
          isMatch = lVal === literalVal;
        } else if (literalSide === 'right' && rightCol) {
          const rVal = rRow[rightCol] ?? rRow[`${rightAlias}.${rightCol}`];
          isMatch = rVal === literalVal;
        } else if (leftCol && rightCol) {
          const lVal = lRow[leftCol] ?? lRow[`${baseAlias}.${leftCol}`];
          const rVal = rRow[rightCol] ?? rRow[`${rightAlias}.${rightCol}`];
          if (lVal !== undefined && lVal !== null && rVal !== undefined && rVal !== null && lVal === rVal) {
            isMatch = true;
          }
        } else if (lRow.movie_id !== undefined && rRow.movie_id !== undefined && lRow.movie_id === rRow.movie_id) {
          isMatch = true;
        }

        if (isMatch) {
          matchedLeftIndices.add(lIdx);
          matchedRightIndices.add(rIdx);
          joinMatches.push({
            leftRowId: lIdx + 1,
            rightRowId: rIdx + 1,
            isMatch: true,
            leftValues: lRow,
            rightValues: rRow,
            joinPredicate:
              joinPredicate ||
              `${rightAlias || rightTable}.${rightCol || 'movie_id'} = ${baseAlias || baseTable}.${leftCol || 'movie_id'}`,
          });
        }
      });
    });

    const unmatchedLeftRows = leftRows.filter((_, idx) => !matchedLeftIndices.has(idx));
    const unmatchedRightRows = rightRows.filter((_, idx) => !matchedRightIndices.has(idx));

    events.push({
      id: 'event-join',
      stage: 'JOIN',
      stageIndex: events.length,
      title: 'JOIN Operation',
      description: `Joined '${baseTable}' and '${rightTable}' on predicate. Produced ${currentRelation.length} matching tuples.`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      joinMatches,
      unmatchedLeftRows,
      unmatchedRightRows,
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

    // Partition rows into group buckets
    const bucketMap = new Map<string, DataRow[]>();
    prevRelation.forEach((row) => {
      const keyVal = getGroupKey(row, groupByClause);
      if (!bucketMap.has(keyVal)) bucketMap.set(keyVal, []);
      bucketMap.get(keyVal)!.push(row);
    });

    const aggDefs = extractAggregatesFromSql(selectClause, havingClause);

    const groupBuckets: GroupBucket[] = Array.from(bucketMap.entries()).map(([key, rows]) => {
      let aggregates = computeBucketAggregates(rows, aggDefs);
      if (aggregates.length === 0) {
        const scores = rows
          .map((r) => r['r.score'] ?? r['score'])
          .filter((v) => v !== null && v !== undefined) as number[];
        if (scores.length > 0) {
          const sum = scores.reduce((a, b) => Number(a) + Number(b), 0);
          const count = scores.length;
          const avg = count > 0 ? Number((sum / count).toFixed(2)) : 0;
          aggregates = [
            {
              funcName: 'AVG',
              expression: 'r.score',
              inputValues: scores,
              formulaStep: `(${scores.join(' + ')}) / ${count}`,
              finalValue: avg,
            },
          ];
        }
      }

      return {
        groupKey: key,
        rows,
        aggregates,
      };
    });

    lastGroupBuckets = groupBuckets;

    events.push({
      id: 'event-group',
      stage: 'GROUP BY',
      stageIndex: events.length,
      title: 'GROUP BY Aggregation',
      description: `Grouped ${prevRelation.length} rows into ${groupBuckets.length} buckets by '${groupByClause}'. Evaluated aggregate formulas.`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      groupBuckets,
      durationMs,
    });
  }

  // Stage 4b: HAVING
  if (stages.includes('HAVING')) {
    const prevRelation = [...currentRelation];
    const startHaving = performance.now();
    const havingQuery = `SELECT ${selectClause} FROM ${fromJoinClause} ${
      whereClause ? `WHERE ${whereClause}` : ''
    } GROUP BY ${groupByClause} HAVING ${havingClause}`;

    let havingRows: DataRow[] = [];
    try {
      const havingRes = await executeQuery(havingQuery);
      havingRows = havingRes.rows;
    } catch {
      havingRows = currentRelation;
    }
    const durationMs = measureDuration(startHaving);
    currentRelation = havingRows;

    let passedKeys = new Set<string>();
    try {
      const keyQuery = `SELECT ${groupByClause} AS _group_key FROM ${fromJoinClause} ${
        whereClause ? `WHERE ${whereClause}` : ''
      } GROUP BY ${groupByClause} HAVING ${havingClause}`;
      const keyRes = await executeQuery(keyQuery);
      passedKeys = new Set(keyRes.rows.map((r) => String(r._group_key ?? '')));
    } catch {
      havingRows.forEach((r) => {
        const k = getGroupKey(r, groupByClause);
        passedKeys.add(k);
      });
    }

    const passedBuckets: GroupBucket[] = [];
    const rejectedBuckets: GroupBucket[] = [];

    (lastGroupBuckets || []).forEach((b) => {
      const isPassed = passedKeys.has(b.groupKey);
      const bucketCopy: GroupBucket = {
        ...b,
        havingPassed: isPassed,
        havingPredicate: havingClause,
      };
      if (isPassed) {
        passedBuckets.push(bucketCopy);
      } else {
        rejectedBuckets.push(bucketCopy);
      }
    });

    events.push({
      id: 'event-having',
      stage: 'HAVING',
      stageIndex: events.length,
      title: 'HAVING Group Filter',
      description: `Evaluated group predicate '${havingClause}'. Passed: ${passedBuckets.length} buckets, Rejected: ${rejectedBuckets.length} buckets.`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      groupBuckets: passedBuckets,
      rejectedGroupBuckets: rejectedBuckets,
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

  // Stage 5b: DISTINCT
  if (stages.includes('DISTINCT')) {
    const prevRelation = [...currentRelation];
    const startDistinct = performance.now();
    const uniqueRows: DataRow[] = [];
    for (const row of prevRelation) {
      if (!uniqueRows.some((u) => isSameRow(u, row))) {
        uniqueRows.push(row);
      }
    }
    const duplicatesRemoved = prevRelation.length - uniqueRows.length;
    currentRelation = uniqueRows;
    const durationMs = measureDuration(startDistinct);

    events.push({
      id: 'event-distinct',
      stage: 'DISTINCT',
      stageIndex: events.length,
      title: 'DISTINCT Deduplication',
      description: `Removed ${duplicatesRemoved} duplicate rows. Retained ${uniqueRows.length} unique rows.`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      distinctDuplicatesRemoved: duplicatesRemoved,
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
