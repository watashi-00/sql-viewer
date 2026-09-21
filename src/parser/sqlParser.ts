import { Parser, AST } from 'node-sql-parser';
import { OperationType, PredicateNode, RowValue } from '../types';

const parser = new Parser();

/**
 * Parses a SQL query string into an AST using node-sql-parser.
 */
export function parseQueryAST(sql: string): AST | AST[] {
  return parser.astify(sql);
}

/**
 * Extracts a map of table aliases to actual table names (e.g., { m: 'movies', r: 'reviews' }).
 * Falls back to regex matching if AST parser encounters non-standard dialect syntax.
 */
export function extractAliasMap(sql: string): Record<string, string> {
  const aliasMap: Record<string, string> = {};

  try {
    const ast = parser.astify(sql);
    const astObj = Array.isArray(ast) ? ast[0] : ast;
    if (astObj && astObj.type === 'select' && Array.isArray(astObj.from)) {
      for (const item of astObj.from) {
        const tableItem = item as any;
        if (typeof tableItem.table === 'string') {
          if (typeof tableItem.as === 'string' && tableItem.as.length > 0) {
            aliasMap[tableItem.as] = tableItem.table;
          } else {
            aliasMap[tableItem.table] = tableItem.table;
          }
        }
      }
      return aliasMap;
    }
  } catch (_e) {
    // Regex fallback if AST parser encounters non-standard dialect syntax
  }

  const fromMatches = sql.matchAll(
    /(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?(?!(?:JOIN|WHERE|ON|LEFT|RIGHT|INNER|OUTER|CROSS|NATURAL|FULL|GROUP|ORDER|LIMIT|HAVING|USING|UNION)\b)([a-zA-Z0-9_]+))?/gi
  );
  const keywords = new Set([
    'WHERE',
    'JOIN',
    'ON',
    'GROUP',
    'ORDER',
    'LIMIT',
    'HAVING',
    'LEFT',
    'RIGHT',
    'INNER',
    'OUTER',
    'CROSS',
    'NATURAL',
    'FULL',
    'USING',
    'UNION',
  ]);

  for (const match of fromMatches) {
    const tableName = match[1];
    const alias = match[2];
    if (tableName && alias && !keywords.has(alias.toUpperCase())) {
      aliasMap[alias] = tableName;
    } else if (tableName) {
      aliasMap[tableName] = tableName;
    }
  }

  return aliasMap;
}

/**
 * Extracts SQL query execution pipeline stages in logical SQL execution order:
 * FROM -> JOIN -> WHERE -> GROUP BY -> HAVING -> SELECT -> DISTINCT -> ORDER BY -> LIMIT
 */
export function extractPipelineStages(sql: string): OperationType[] {
  const stages: OperationType[] = [];

  try {
    const ast = parser.astify(sql);
    const astObj: any = Array.isArray(ast) ? ast[0] : ast;
    if (astObj && astObj.type === 'select') {
      if (astObj.from && astObj.from.length > 0) stages.push('FROM');
      if (astObj.from && (astObj.from.length > 1 || astObj.from.some((f: any) => f.join))) stages.push('JOIN');
      if (astObj.where) stages.push('WHERE');
      if (astObj.groupby) stages.push('GROUP BY');
      if (astObj.having) stages.push('HAVING');
      if (astObj.columns) stages.push('SELECT');
      if (astObj.distinct) stages.push('DISTINCT');
      if (astObj.orderby) stages.push('ORDER BY');
      if (astObj.limit) stages.push('LIMIT');
      return stages;
    }
  } catch (_e) {
    // Fallback to regex token checking
  }

  if (/\bFROM\b/i.test(sql)) stages.push('FROM');
  if (/\bJOIN\b/i.test(sql)) stages.push('JOIN');
  if (/\bWHERE\b/i.test(sql)) stages.push('WHERE');
  if (/\bGROUP\s+BY\b/i.test(sql)) stages.push('GROUP BY');
  if (/\bHAVING\b/i.test(sql)) stages.push('HAVING');
  if (/\bSELECT\b/i.test(sql)) stages.push('SELECT');
  if (/\bDISTINCT\b/i.test(sql)) stages.push('DISTINCT');
  if (/\bORDER\s+BY\b/i.test(sql)) stages.push('ORDER BY');
  if (/\bLIMIT\b/i.test(sql)) stages.push('LIMIT');

  return stages;
}

/**
 * Recursively converts an AST expression node into a PredicateNode tree.
 */
export function buildPredicateTree(expr: any): PredicateNode | undefined {
  if (!expr) return undefined;

  if (expr.type === 'binary_expr') {
    return {
      type: 'binary',
      operator: expr.operator,
      left: buildPredicateTree(expr.left),
      right: buildPredicateTree(expr.right),
    };
  }

  if (expr.type === 'column_ref') {
    const columnName = expr.table ? `${expr.table}.${expr.column}` : expr.column;
    return {
      type: 'column',
      columnName,
    };
  }

  if (
    expr.type === 'number' ||
    expr.type === 'string' ||
    expr.type === 'single_quote_string' ||
    expr.type === 'bool' ||
    expr.type === 'null'
  ) {
    return {
      type: 'literal',
      value: expr.value as RowValue,
    };
  }

  if ('value' in expr) {
    return {
      type: 'literal',
      value: expr.value as RowValue,
    };
  }

  return undefined;
}

/**
 * Parses the WHERE clause of a query and extracts its structured PredicateNode tree.
 */
export function extractPredicateTree(sql: string): PredicateNode | undefined {
  try {
    const ast = parser.astify(sql);
    const astObj: any = Array.isArray(ast) ? ast[0] : ast;
    if (astObj && astObj.type === 'select' && astObj.where) {
      return buildPredicateTree(astObj.where);
    }
  } catch (_e) {
    return undefined;
  }
  return undefined;
}
