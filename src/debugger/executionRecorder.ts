import { Parser } from 'node-sql-parser';
import { executeQuery } from '../database/duckdb';
import { extractPipelineStages, extractPredicateTree, parseQueryAST } from '../parser/sqlParser';
import {
  ExecutionEvent,
  ExecutionPlan,
  DataRow,
  JoinMatch,
  RowValue,
  GroupBucket,
  GroupAggregateCalc,
  CteScope,
  SubqueryResolution,
  ExplainNode,
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
    if (val === null) {
      vals.push('NULL');
    } else if (val !== undefined) {
      vals.push(String(val));
    }
  }
  if (vals.length > 0) {
    return vals.join(', ');
  }
  return 'Group';
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
  return null;
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
 * Helper to find the index of a top-level keyword outside parenthesis depth.
 */
function findTopLevelKeywordPos(sql: string, keywordRegex: RegExp, startFrom: number = 0): number {
  let depth = 0;
  let inQuote = false;
  let quoteChar = '';

  for (let i = startFrom; i < sql.length; i++) {
    const char = sql[i];
    if (inQuote) {
      if (char === quoteChar && sql[i - 1] !== '\\') {
        inQuote = false;
      }
    } else {
      if (char === "'" || char === '"') {
        inQuote = true;
        quoteChar = char;
      } else if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
      } else if (depth === 0) {
        const slice = sql.slice(i);
        const match = slice.match(keywordRegex);
        if (match && match.index === 0) {
          return i;
        }
      }
    }
  }
  return -1;
}

/**
 * Parses subquery expressions from clause text.
 */
export function parseSubqueriesFromText(
  text: string,
  parentClause: 'WHERE' | 'HAVING' | 'SELECT'
): Array<{
  id: string;
  type: 'scalar' | 'set' | 'exists';
  rawQuery: string;
  parentClause: 'WHERE' | 'HAVING' | 'SELECT';
}> {
  const results: Array<{
    id: string;
    type: 'scalar' | 'set' | 'exists';
    rawQuery: string;
    parentClause: 'WHERE' | 'HAVING' | 'SELECT';
  }> = [];

  if (!text) return results;

  const regex = /\(\s*SELECT\b/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const startParenIdx = match.index;
    const selectIdx = startParenIdx + match[0].indexOf('SELECT');

    let depth = 0;
    let endParenIdx = -1;
    let inQuote = false;
    let quoteChar = '';

    for (let i = startParenIdx; i < text.length; i++) {
      const char = text[i];
      if (inQuote) {
        if (char === quoteChar && text[i - 1] !== '\\') {
          inQuote = false;
        }
      } else {
        if (char === "'" || char === '"') {
          inQuote = true;
          quoteChar = char;
        } else if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            endParenIdx = i;
            break;
          }
        }
      }
    }

    if (endParenIdx === -1) continue;

    const rawQuery = text.substring(selectIdx, endParenIdx).trim();

    const prefix = text.substring(0, startParenIdx).trim();
    let type: 'scalar' | 'set' | 'exists' = 'scalar';

    if (/\bIN\s*$/i.test(prefix) || /\bNOT\s+IN\s*$/i.test(prefix)) {
      type = 'set';
    } else if (/\bEXISTS\s*$/i.test(prefix) || /\bNOT\s+EXISTS\s*$/i.test(prefix)) {
      type = 'exists';
    } else {
      type = 'scalar';
    }

    const id = `subquery-${parentClause.toLowerCase()}-${results.length + 1}`;

    results.push({
      id,
      type,
      rawQuery,
      parentClause,
    });
  }

  return results;
}

/**
 * Executes extracted subqueries on DuckDB WASM and builds SubqueryResolution objects.
 */
export async function extractAndResolveSubqueries(
  clauseText: string,
  parentClause: 'WHERE' | 'HAVING' | 'SELECT'
): Promise<SubqueryResolution[]> {
  const parsed = parseSubqueriesFromText(clauseText, parentClause);
  const resolutions: SubqueryResolution[] = [];

  for (const sub of parsed) {
    const resolution: SubqueryResolution = {
      id: sub.id,
      type: sub.type,
      rawQuery: sub.rawQuery,
      parentClause: sub.parentClause,
    };

    try {
      const res = await executeQuery(sub.rawQuery);
      if (sub.type === 'set') {
        resolution.resolvedSet = res.rows.map((row) => {
          const keys = Object.keys(row);
          return keys.length > 0 ? row[keys[0]] : null;
        });
      } else if (sub.type === 'scalar') {
        if (res.rows.length > 0) {
          const firstRow = res.rows[0];
          const keys = Object.keys(firstRow);
          resolution.resolvedValue = keys.length > 0 ? firstRow[keys[0]] : null;
        } else {
          resolution.resolvedValue = null;
        }
      } else if (sub.type === 'exists') {
        resolution.existsResult = res.rows.length > 0;
      }
    } catch (_err) {
      if (sub.type === 'set') {
        resolution.resolvedSet = [];
      } else if (sub.type === 'scalar') {
        resolution.resolvedValue = null;
      } else if (sub.type === 'exists') {
        resolution.existsResult = false;
      }
    }

    resolutions.push(resolution);
  }

  return resolutions;
}

/**
 * Extracts individual query clauses for prefix query construction and descriptions.
 */
function extractClauses(sql: string) {
  let cleanSql = sql.replace(/;+\s*$/, '').trim();

  const withMatch = cleanSql.match(/^\s*WITH\s+[\s\S]*?\)\s*(SELECT\b[\s\S]*)$/i);
  if (withMatch) {
    cleanSql = withMatch[1].trim();
  }

  const fromPos = findTopLevelKeywordPos(cleanSql, /^\bFROM\b/i);
  const wherePos = findTopLevelKeywordPos(cleanSql, /^\bWHERE\b/i);
  const groupPos = findTopLevelKeywordPos(cleanSql, /^\bGROUP\s+BY\b/i);
  const havingPos = findTopLevelKeywordPos(cleanSql, /^\bHAVING\b/i);
  const orderPos = findTopLevelKeywordPos(cleanSql, /^\bORDER\s+BY\b/i);
  const limitPos = findTopLevelKeywordPos(cleanSql, /^\bLIMIT\b/i);

  // FROM clause
  let fromJoinClause = 'movies';
  if (fromPos !== -1) {
    const endFrom = [wherePos, groupPos, havingPos, orderPos, limitPos]
      .filter((p) => p > fromPos)
      .reduce((min, p) => (min === -1 || p < min ? p : min), -1);
    fromJoinClause = (endFrom !== -1 ? cleanSql.slice(fromPos + 4, endFrom) : cleanSql.slice(fromPos + 4)).trim();
  }

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
  let whereClause = '';
  if (wherePos !== -1) {
    const endWhere = [groupPos, havingPos, orderPos, limitPos]
      .filter((p) => p > wherePos)
      .reduce((min, p) => (min === -1 || p < min ? p : min), -1);
    whereClause = (endWhere !== -1 ? cleanSql.slice(wherePos + 5, endWhere) : cleanSql.slice(wherePos + 5)).trim();
  }

  // GROUP BY clause
  let groupByClause = '';
  if (groupPos !== -1) {
    const endGroup = [havingPos, orderPos, limitPos]
      .filter((p) => p > groupPos)
      .reduce((min, p) => (min === -1 || p < min ? p : min), -1);
    groupByClause = (endGroup !== -1 ? cleanSql.slice(groupPos + 8, endGroup) : cleanSql.slice(groupPos + 8)).trim();
  }

  // HAVING clause
  let havingClause = '';
  if (havingPos !== -1) {
    const endHaving = [orderPos, limitPos]
      .filter((p) => p > havingPos)
      .reduce((min, p) => (min === -1 || p < min ? p : min), -1);
    havingClause = (endHaving !== -1 ? cleanSql.slice(havingPos + 6, endHaving) : cleanSql.slice(havingPos + 6)).trim();
  }

  // SELECT projection
  let selectClause = '*';
  const selectPos = findTopLevelKeywordPos(cleanSql, /^\bSELECT\b/i);
  if (selectPos !== -1 && fromPos !== -1 && fromPos > selectPos) {
    let selText = cleanSql.slice(selectPos + 6, fromPos).trim();
    if (/^DISTINCT\b/i.test(selText)) {
      selText = selText.replace(/^DISTINCT\b/i, '').trim();
    }
    selectClause = selText || '*';
  }

  // ORDER BY clause
  let orderByClause = '';
  if (orderPos !== -1) {
    const endOrder = [limitPos]
      .filter((p) => p > orderPos)
      .reduce((min, p) => (min === -1 || p < min ? p : min), -1);
    orderByClause = (endOrder !== -1 ? cleanSql.slice(orderPos + 8, endOrder) : cleanSql.slice(orderPos + 8)).trim();
  }

  // LIMIT count
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

/**
 * Parses DuckDB WASM EXPLAIN text output into a hierarchical ExplainNode AST tree.
 */
export function parseDuckDbExplain(explainText: string): ExplainNode | undefined {
  if (!explainText || !explainText.trim()) return undefined;

  const lines = explainText.split('\n');
  const boxes: Array<{
    id: string;
    rStart: number;
    rEnd: number;
    cStart: number;
    cEnd: number;
    operatorType: string;
    description: string;
    cardinality?: number;
    timingMs?: number;
  }> = [];

  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '┌') {
        const cEnd = line.indexOf('┐', c + 1);
        if (cEnd === -1) continue;

        let rEnd = -1;
        for (let rend = r + 1; rend < lines.length; rend++) {
          if (
            lines[rend] &&
            lines[rend][c] === '└' &&
            lines[rend][cEnd] === '┘'
          ) {
            rEnd = rend;
            break;
          }
        }

        if (rEnd !== -1) {
          const contentLines: string[] = [];
          for (let row = r + 1; row < rEnd; row++) {
            const rawRow = lines[row] || '';
            const cell = rawRow.substring(c + 1, cEnd).trim();
            if (cell && !/^─+$/.test(cell)) {
              contentLines.push(cell);
            }
          }

          if (contentLines.length > 0) {
            let operatorType = contentLines[0];
            let cardinality: number | undefined = undefined;
            let timingMs: number | undefined = undefined;
            const descParts: string[] = [];

            for (let i = 0; i < contentLines.length; i++) {
              const lineStr = contentLines[i];
              const cardMatch = lineStr.match(/~?(\d+)\s*rows?/i) || lineStr.match(/^EC:\s*(\d+)/i);
              if (cardMatch) {
                cardinality = parseInt(cardMatch[1], 10);
                continue;
              }
              const timingMatch = lineStr.match(/\((\d+(?:\.\d+)?)s\)/i);
              if (timingMatch) {
                timingMs = parseFloat(timingMatch[1]) * 1000;
                continue;
              }
              const timingMsMatch = lineStr.match(/\((\d+(?:\.\d+)?)ms\)/i);
              if (timingMsMatch) {
                timingMs = parseFloat(timingMsMatch[1]);
                continue;
              }
              if (i === 0) {
                operatorType = lineStr;
              } else {
                descParts.push(lineStr);
              }
            }

            if (operatorType !== 'Query Profiling Information' && operatorType !== 'Total Time') {
              boxes.push({
                id: `explain-node-${boxes.length + 1}`,
                rStart: r,
                rEnd: rEnd,
                cStart: c,
                cEnd: cEnd,
                operatorType,
                description: descParts.length > 0 ? descParts.join(' | ') : operatorType,
                cardinality,
                timingMs,
              });
            }
          }
        }
      }
    }
  }

  if (boxes.length === 0) return undefined;

  const levels: Array<typeof boxes> = [];
  const sortedBoxes = [...boxes].sort((a, b) => a.rStart - b.rStart || a.cStart - b.cStart);

  for (const box of sortedBoxes) {
    let placed = false;
    for (const level of levels) {
      if (Math.abs(level[0].rStart - box.rStart) <= 3) {
        level.push(box);
        placed = true;
        break;
      }
    }
    if (!placed) {
      levels.push([box]);
    }
  }

  for (const level of levels) {
    level.sort((a, b) => a.cStart - b.cStart);
  }

  const nodeMap = new Map<string, ExplainNode>();
  for (const box of boxes) {
    nodeMap.set(box.id, {
      id: box.id,
      operatorType: box.operatorType,
      description: box.description,
      ...(box.timingMs !== undefined ? { timingMs: box.timingMs } : {}),
      ...(box.cardinality !== undefined ? { cardinality: box.cardinality } : {}),
      children: [],
    });
  }

  for (let l = 0; l < levels.length - 1; l++) {
    const parentBoxes = levels[l];
    const childBoxes = levels[l + 1];

    if (parentBoxes.length === 1) {
      const parentNode = nodeMap.get(parentBoxes[0].id)!;
      for (const childBox of childBoxes) {
        parentNode.children.push(nodeMap.get(childBox.id)!);
      }
    } else {
      for (const childBox of childBoxes) {
        const childCenter = (childBox.cStart + childBox.cEnd) / 2;
        let bestParent = parentBoxes[0];
        let minDiff = Infinity;
        for (const parentBox of parentBoxes) {
          const parentCenter = (parentBox.cStart + parentBox.cEnd) / 2;
          const diff = Math.abs(parentCenter - childCenter);
          if (diff < minDiff) {
            minDiff = diff;
            bestParent = parentBox;
          }
        }
        const parentNode = nodeMap.get(bestParent.id)!;
        parentNode.children.push(nodeMap.get(childBox.id)!);
      }
    }
  }

  const rootBox = levels[0][0];
  return nodeMap.get(rootBox.id);
}

export async function recordQueryExecution(sql: string): Promise<ExecutionPlan> {
  const ast = parseQueryAST(sql);
  const astObj: any = Array.isArray(ast) ? ast[0] : ast;


  let cteScopes: CteScope[] | undefined = undefined;

  if (astObj && astObj.with && Array.isArray(astObj.with) && astObj.with.length > 0) {
    cteScopes = [];
    const parser = new Parser();
    for (const cte of astObj.with) {
      const aliasName =
        typeof cte.name === 'object' && cte.name !== null && 'value' in cte.name
          ? cte.name.value
          : String(cte.name);

      let cteSql = '';
      try {
        const innerAst = cte.stmt?.ast || cte.stmt;
        cteSql = parser.sqlify(innerAst).replace(/`/g, '');
      } catch {
        cteSql = '';
      }

      // Record CTE execution recursively
      const ctePlan = await recordQueryExecution(cteSql);

      // Register temporary table in DuckDB WASM
      await executeQuery(`CREATE OR REPLACE TEMP TABLE ${aliasName} AS (${cteSql})`);

      cteScopes.push({
        id: `cte-${aliasName}`,
        aliasName,
        query: cteSql,
        events: ctePlan.events,
        outputRows: ctePlan.finalResult,
      });
    }
  }

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
    const subqueryResolutions = await extractAndResolveSubqueries(whereClause, 'WHERE');

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
      ...(subqueryResolutions.length > 0 ? { subqueryResolutions } : {}),
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
      const aggregates = computeBucketAggregates(rows, aggDefs);

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
      const keyQuery = `SELECT ${groupByClause} FROM ${fromJoinClause} ${
        whereClause ? `WHERE ${whereClause}` : ''
      } GROUP BY ${groupByClause} HAVING ${havingClause}`;
      const keyRes = await executeQuery(keyQuery);
      passedKeys = new Set(keyRes.rows.map((r) => getGroupKey(r, groupByClause)));
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

    const havingSubqueryResolutions = await extractAndResolveSubqueries(havingClause, 'HAVING');

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
      ...(havingSubqueryResolutions.length > 0 ? { subqueryResolutions: havingSubqueryResolutions } : {}),
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

    const selectSubqueryResolutions = await extractAndResolveSubqueries(selectClause, 'SELECT');

    events.push({
      id: 'event-select',
      stage: 'SELECT',
      stageIndex: events.length,
      title: 'SELECT Projection',
      description: `Projected columns: ${finalRes.columns.join(', ')}`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      ...(selectSubqueryResolutions.length > 0 ? { subqueryResolutions: selectSubqueryResolutions } : {}),
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

  let explainTree: ExplainNode | undefined = undefined;

  try {
    const explainRes = await executeQuery(`EXPLAIN ${sql}`);
    if (explainRes.rows.length > 0) {
      const rawPlan =
        String(explainRes.rows[0].explain_value ?? '') ||
        String(explainRes.rows[0].physical_plan ?? '') ||
        String(explainRes.rows[0].logical_plan ?? '');
      explainTree = parseDuckDbExplain(rawPlan);
    }
  } catch (_err) {
    // If EXPLAIN query fails, explainTree remains undefined
  }

  return {
    query: sql,
    stages,
    events,
    finalResult: finalRes.rows,
    columns: finalRes.columns,
    ...(cteScopes && cteScopes.length > 0 ? { cteScopes } : {}),
    ...(explainTree ? { explainTree } : {}),
  };
}

