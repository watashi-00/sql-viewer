import { Schema } from '../types';
import { extractAliasMap } from '../parser/sqlParser';

export interface CompletionItem {
  label: string;
  kind: number;
  insertText: string;
  insertTextRules?: number;
  detail?: string;
}

export function getCompletionsForPosition(
  sql: string,
  word: string,
  schema: Schema | null
): CompletionItem[] {
  const completions: CompletionItem[] = [];

  // SQL Keywords
  const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'DISTINCT', 'AS', 'AND', 'OR'];
  keywords.forEach((kw) => {
    if (!word || kw.toLowerCase().startsWith(word.toLowerCase())) {
      completions.push({ label: kw, kind: 14, insertText: kw, detail: 'SQL Keyword' });
    }
  });

  // Aggregates
  const funcs = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE'];
  funcs.forEach((fn) => {
    if (!word || fn.toLowerCase().startsWith(word.toLowerCase())) {
      completions.push({
        label: `${fn}(expression)`,
        kind: 3,
        insertText: `${fn}($1)`,
        insertTextRules: 4,
        detail: 'Aggregate Function',
      });
    }
  });

  if (!schema) return completions;

  const aliasMap = extractAliasMap(sql);

  // Table names
  schema.tables.forEach((tbl) => {
    if (!word || tbl.name.toLowerCase().startsWith(word.toLowerCase())) {
      completions.push({
        label: tbl.name,
        kind: 5,
        insertText: tbl.name,
        detail: `Table (${tbl.columns.length} columns)`,
      });
    }
  });

  // Table aliases + columns
  Object.entries(aliasMap).forEach(([alias, tableName]) => {
    const tableObj = schema.tables.find((t) => t.name === tableName);
    if (tableObj) {
      tableObj.columns.forEach((col) => {
        let matches = false;
        if (!word) {
          matches = true;
        } else if (word.includes('.')) {
          const dotIndex = word.lastIndexOf('.');
          const aliasPrefix = word.slice(0, dotIndex).toLowerCase();
          const colPrefix = word.slice(dotIndex + 1).toLowerCase();
          if (alias.toLowerCase() === aliasPrefix) {
            matches = col.name.toLowerCase().startsWith(colPrefix);
          }
        } else {
          const lowerWord = word.toLowerCase();
          matches =
            col.name.toLowerCase().startsWith(lowerWord) ||
            `${alias}.${col.name}`.toLowerCase().startsWith(lowerWord) ||
            alias.toLowerCase().startsWith(lowerWord);
        }

        if (matches) {
          completions.push({
            label: `${alias}.${col.name}`,
            kind: 9,
            insertText: col.name,
            detail: `${tableName}.${col.name} ${col.type}`,
          });
        }
      });
    }
  });

  return completions;
}
