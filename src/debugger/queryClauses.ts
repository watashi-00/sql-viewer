import { findTopLevelKeywordPos } from './sqlText';

/**
 * Extracts individual query clauses for prefix query construction and descriptions.
 */
export function extractClauses(sql: string) {
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
