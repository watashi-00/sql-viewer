import { executeQuery } from '../database/duckdb';
import { SubqueryResolution } from '../types';

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
