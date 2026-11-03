const CLAUSE_BREAKS = new Set([
  'FROM', 'WHERE', 'GROUP', 'HAVING', 'WINDOW', 'QUALIFY', 'ORDER', 'LIMIT',
  'OFFSET', 'UNION', 'EXCEPT', 'INTERSECT', 'JOIN', 'ON',
]);

const KEYWORDS = new Set(`select from where and or not null is as on join inner left right full outer cross
  group by having order limit offset union all distinct case when then else end
  exists in between like ilike true false asc desc nulls first last count sum avg min max
  over partition rows range preceding following current row unbounded qualify with recursive
  insert into values update set delete create table view temporary drop alter add column
  explain analyze using pivot unpivot lateral unnest`.toUpperCase().split(/\s+/));

/** Formats common SQL layout while leaving quoted text and comments byte-for-byte intact. */
export function formatSql(sql: string): string {
  const tokens: Array<{ text: string; kind: 'word' | 'space' | 'quoted' | 'comment' | 'symbol' }> = [];
  for (let i = 0; i < sql.length;) {
    const start = i;
    const ch = sql[i];
    if (/\s/.test(ch)) {
      while (i < sql.length && /\s/.test(sql[i])) i++;
      tokens.push({ text: sql.slice(start, i), kind: 'space' });
    } else if (ch === '-' && sql[i + 1] === '-') {
      i += 2;
      while (i < sql.length && sql[i] !== '\n') i++;
      tokens.push({ text: sql.slice(start, i), kind: 'comment' });
    } else if (ch === '/' && sql[i + 1] === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i = Math.min(sql.length, i + 2);
      tokens.push({ text: sql.slice(start, i), kind: 'comment' });
    } else if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i++;
      while (i < sql.length) {
        if (sql[i] === '\\' && i + 1 < sql.length) { i += 2; continue; }
        if (sql[i] === quote && sql[i + 1] === quote) { i += 2; continue; }
        if (sql[i++] === quote) break;
      }
      tokens.push({ text: sql.slice(start, i), kind: 'quoted' });
    } else if (/[\p{L}_]/u.test(ch)) {
      i++;
      while (i < sql.length && /[\p{L}\p{N}_$]/u.test(sql[i])) i++;
      tokens.push({ text: sql.slice(start, i), kind: 'word' });
    } else {
      const operator = ['->>', '<=', '>=', '<>', '!=', '==', '||', '::', '->', ':=']
        .find((candidate) => sql.startsWith(candidate, i));
      i += operator?.length ?? 1;
      tokens.push({ text: sql.slice(start, i), kind: 'symbol' });
    }
  }

  let output = '';
  let indent = 0;
  let lineStart = true;
  let previous = '';
  const append = (text: string) => {
    if (lineStart && text.trim()) { output += '  '.repeat(indent); lineStart = false; }
    output += text;
  };
  const newline = () => {
    output = output.replace(/[ \t]+$/, '');
    if (output && !output.endsWith('\n')) output += '\n';
    lineStart = true;
  };

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.kind === 'space') continue;
    if (token.kind === 'comment') {
      if (!lineStart) append(' ');
      append(token.text);
      if (token.text.startsWith('--')) newline();
      continue;
    }
    let value = token.kind === 'word' && KEYWORDS.has(token.text.toUpperCase())
      ? token.text.toUpperCase() : token.text;
    const joinModifier = ['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS'].includes(previous);
    if (CLAUSE_BREAKS.has(value) && !(value === 'JOIN' && joinModifier) && output.trim()) {
      if (value === 'JOIN' || value === 'ON' || value === 'WHERE' || value === 'HAVING') indent = 1;
      else indent = 0;
      newline();
    }
    if (value === '(') {
      append(previous && /[\w`\]]$/.test(previous) ? '(' : ' (');
      indent++;
    } else if (value === ')') {
      indent = Math.max(0, indent - 1);
      append(')');
    } else if (value === ',') {
      append(',');
      newline();
      indent = 1;
    } else if (value === ';') {
      append(';');
      newline();
      indent = 0;
    } else {
      const needsSpace = output.length > 0 && !lineStart && !/[\s(.[`]$/.test(output) && value !== '.';
      if (needsSpace) append(' ');
      append(value);
    }
    previous = value;
  }
  return output.trim();
}
