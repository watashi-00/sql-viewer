import { DataRow, RowValue, GroupAggregateCalc } from '../types';

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
