import { describe, expect, it } from 'vitest';
import { formatSql } from '../editor/formatSql';

describe('formatSql', () => {
  it('formats common clauses, indentation, and keywords', () => {
    expect(formatSql('select a,b from users where id=1 order by a')).toBe(
      'SELECT a,\n  b\nFROM users\n  WHERE id = 1\nORDER BY a'
    );
  });

  it('preserves string literals, quoted identifiers, and comments', () => {
    const sql = `select 'where  x=1', "Mixed Case" from t -- keep  this\nwhere note = 'a''b'`;
    const formatted = formatSql(sql);
    expect(formatted).toContain("'where  x=1'");
    expect(formatted).toContain('"Mixed Case"');
    expect(formatted).toContain('-- keep  this');
    expect(formatted).toContain("'a''b'");
  });

  it('keeps multi-character SQL operators intact', () => {
    expect(formatSql('select a>=b and c<>d and e||f from t'))
      .toBe('SELECT a >= b AND c <> d AND e || f\nFROM t');
  });
});
