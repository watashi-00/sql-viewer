import { Schema } from '../types';
import { extractAliasMap } from '../parser/sqlParser';

export function getCompletionsForPosition(
  sql: string,
  word: string,
  schema: Schema | null
): Array<{ label: string; kind: number; insertText: string; detail?: string }> {
  const completions: Array<{ label: string; kind: number; insertText: string; detail?: string }> = [];

  // SQL Keywords
  const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'DISTINCT', 'AS', 'AND', 'OR'];
  keywords.forEach((kw) => {
    if (kw.toLowerCase().startsWith(word.toLowerCase())) {
      completions.push({ label: kw, kind: 14, insertText: kw, detail: 'SQL Keyword' });
    }
  });

  // Aggregates
  const funcs = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE'];
  funcs.forEach((fn) => {
    if (fn.toLowerCase().startsWith(word.toLowerCase())) {
      completions.push({ label: `${fn}(expression)`, kind: 3, insertText: `${fn}($1)`, detail: 'Aggregate Function' });
    }
  });

  if (!schema) return completions;

  const aliasMap = extractAliasMap(sql);

  // Table names
  schema.tables.forEach((tbl) => {
    completions.push({ label: tbl.name, kind: 5, insertText: tbl.name, detail: `Table (${tbl.columns.length} columns)` });
  });

  // Table aliases + columns
  Object.entries(aliasMap).forEach(([alias, tableName]) => {
    const tableObj = schema.tables.find((t) => t.name === tableName);
    if (tableObj) {
      tableObj.columns.forEach((col) => {
        completions.push({
          label: `${alias}.${col.name}`,
          kind: 9,
          insertText: `${alias}.${col.name}`,
          detail: `${tableName}.${col.name} ${col.type}`,
        });
      });
    }
  });

  return completions;
}
