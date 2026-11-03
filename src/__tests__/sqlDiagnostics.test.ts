import { describe, expect, it } from 'vitest';
import { diagnoseSqlError } from '../editor/sqlDiagnostics';
import { createMonacoMarkers } from '../editor/monacoDiagnostics';

describe('SQL error diagnostics', () => {
  it('extracts line and column from DuckDB parser context', () => {
    const diagnostic = diagnoseSqlError(
      new Error('Parser Error: syntax error at or near "FROM"\nLINE 2: SELECT FROM items\n               ^'),
      'SELECT 1\nSELECT FROM items'
    );

    expect(diagnostic.category).toBe('parser');
    expect(diagnostic.line).toBe(2);
    expect(diagnostic.column).toBe(16);
    expect(diagnostic.suggestion).toContain('missing keyword');
  });

  it('describes SQL visualizer parser limitations separately from DuckDB parser errors', () => {
    const error = new SyntaxError('Expected a comma but found NULLS');
    Object.assign(error, { location: { start: { line: 3, column: 20 } } });
    const diagnostic = diagnoseSqlError(error, 'SELECT x\nFROM t\nORDER BY x NULLS FIRST');

    expect(diagnostic.category).toBe('parser');
    expect(diagnostic.message).toContain('SQL visualizer');
    expect(diagnostic.line).toBe(3);
    expect(diagnostic.column).toBe(20);
  });

  it.each([
    ['Binder Error: Referenced column "missing" not found', 'binder', 'column names'],
    ['Catalog Error: Table with name absent does not exist', 'catalog', 'schema'],
    ['Constraint Error: Duplicate key violates primary key constraint', 'constraint', 'primary keys'],
    ['Conversion Error: Could not convert string to integer', 'conversion', 'type of the target'],
    ['QuotaExceededError: workspace storage quota exceeded', 'persistence', 'free space'],
  ] as const)('classifies actionable DuckDB errors (%s)', (message, category, suggestion) => {
    const diagnostic = diagnoseSqlError(new Error(message));
    expect(diagnostic.category).toBe(category);
    expect(diagnostic.suggestion).toContain(suggestion);
    expect(diagnostic.technicalMessage).toBe(message);
  });

  it('creates Monaco markers only when the engine provides a source location', () => {
    const diagnostic = diagnoseSqlError(
      new Error('Parser Error: syntax error\nLINE 1: SELECT FROM t\n       ^'),
      'SELECT FROM t'
    );
    expect(createMonacoMarkers(diagnostic)).toEqual([{
      severity: 8,
      message: 'SQL syntax error: DuckDB could not parse this SQL statement.',
      startLineNumber: 1,
      startColumn: 8,
      endLineNumber: 1,
      endColumn: 9,
    }]);
    expect(createMonacoMarkers({ ...diagnostic, line: undefined })).toEqual([]);
  });

  it('explains that aggregate filters belong in HAVING', () => {
    const diagnostic = diagnoseSqlError(new Error('Binder Error: aggregate functions are not allowed in WHERE'));
    expect(diagnostic.suggestion).toContain('Use HAVING');
  });

  it('classifies file import failures separately from SQL execution failures', () => {
    const diagnostic = diagnoseSqlError(new Error('Invalid JSON row'), '', 'import');
    expect(diagnostic.category).toBe('import');
    expect(diagnostic.title).toBe('File import error');
  });
});
