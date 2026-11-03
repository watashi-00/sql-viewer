export function findTopLevelKeywordPos(sql: string, keywordRegex: RegExp, startFrom: number = 0): number {
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
