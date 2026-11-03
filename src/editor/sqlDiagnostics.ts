export type SqlErrorCategory =
  | 'parser'
  | 'binder'
  | 'catalog'
  | 'constraint'
  | 'conversion'
  | 'import'
  | 'persistence'
  | 'execution';

export interface SqlDiagnostic {
  category: SqlErrorCategory;
  title: string;
  message: string;
  technicalMessage: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

type ErrorContext = 'query' | 'import' | 'persistence';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'An unknown error occurred.';
}

function positiveInteger(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function errorPosition(error: unknown, message: string, sql: string): { line?: number; column?: number } {
  if (error && typeof error === 'object') {
    const object = error as Record<string, any>;
    const location = object.location?.start ?? object.hash?.location?.start ?? object.position;
    const line = positiveInteger(location?.line ?? location?.row ?? object.lineNumber);
    const column = positiveInteger(location?.column ?? location?.col ?? object.columnNumber);
    if (line || column) return { ...(line ? { line } : {}), ...(column ? { column } : {}) };
    const offset = typeof location === 'number' ? location : Number(location?.offset);
    if (Number.isInteger(offset) && offset >= 0 && sql) {
      const before = sql.slice(0, offset);
      const lineNumber = before.split('\n').length;
      const columnNumber = before.length - before.lastIndexOf('\n');
      return { line: lineNumber, column: columnNumber };
    }
  }

  const lines = message.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const lineMatch = lines[index].match(/^\s*LINE\s+(\d+)\s*:/i);
    if (!lineMatch) continue;
    const line = positiveInteger(lineMatch[1]);
    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 4); cursor++) {
      const marker = lines[cursor].indexOf('^');
      if (marker >= 0) return { ...(line ? { line } : {}), column: marker + 1 };
      if (cursor > index + 1 && lines[cursor].trim()) break;
    }
    if (line) return { line };
  }

  const offsetMatch = message.match(/(?:at|position)\s+(?:character\s+)?(\d+)/i);
  if (offsetMatch) return { column: Number(offsetMatch[1]) + 1 };
  return {};
}

function classify(message: string, context: ErrorContext, error: unknown): SqlErrorCategory {
  if (context === 'import') return 'import';
  if (context === 'persistence' || /QuotaExceeded|quota.*exceed|IndexedDB|workspace storage|workspace persistence|workspace.*corrupt/i.test(message)) {
    return 'persistence';
  }
  if (/^(?:Parser|Syntax) Error\b/i.test(message)) return 'parser';
  if (/^Binder Error\b/i.test(message)) return 'binder';
  if (/^Catalog Error\b/i.test(message)) return 'catalog';
  if (/^(?:Constraint|Transaction) Error\b/i.test(message)) return 'constraint';
  if (/^(?:Conversion|Invalid Input) Error\b/i.test(message)) return 'conversion';

  if (error && typeof error === 'object') {
    const name = (error as Record<string, unknown>).name;
    if (name === 'SyntaxError') return 'parser';
  }
  return 'execution';
}

function guidance(category: SqlErrorCategory, message: string, isParserLibraryError: boolean): Pick<SqlDiagnostic, 'message' | 'suggestion'> {
  if (isParserLibraryError) {
    return {
      message: 'The SQL visualizer could not analyze this syntax. DuckDB may support queries that the visualizer parser does not recognize yet.',
      suggestion: 'Try simplifying the query or removing the unsupported clause to inspect its execution stages.',
    };
  }

  switch (category) {
    case 'parser':
      return { message: 'DuckDB could not parse this SQL statement.', suggestion: 'Check the marked location for a missing keyword, comma, quote, or parenthesis.' };
    case 'binder':
      if (/aggregate.*WHERE|WHERE.*aggregate/i.test(message)) {
        return { message: 'An aggregate cannot be used in this WHERE filter.', suggestion: 'Use HAVING to filter grouped results after aggregation.' };
      }
      if (/GROUP BY|aggregate|must appear/i.test(message)) {
        return { message: 'A selected expression is not valid for this grouped query.', suggestion: 'Add non-aggregate expressions to GROUP BY or wrap them in an aggregate function.' };
      }
      if (/alias/i.test(message)) {
        return { message: 'DuckDB could not resolve an alias in this clause.', suggestion: 'Check the alias spelling and whether that alias is available at this stage.' };
      }
      return { message: 'DuckDB could not bind a table, column, or expression in this query.', suggestion: 'Check column names, table aliases, and the active schema.' };
    case 'catalog':
      return { message: 'DuckDB could not find a referenced table or function.', suggestion: 'Check the object name and schema in the Database Explorer.' };
    case 'constraint':
      return { message: 'This change violates a database constraint.', suggestion: 'Check primary keys, unique values, and NOT NULL columns before changing the data.' };
    case 'conversion':
      return { message: 'DuckDB could not convert a value to the required data type.', suggestion: 'Check the value and the type of the target column or expression.' };
    case 'import':
      return { message: 'DuckDB could not import this data file.', suggestion: 'Check the file contents, encoding, and column types.' };
    case 'persistence':
      return { message: 'The query ran, but the workspace change could not be saved locally.', suggestion: 'Check browser storage availability and free space before reloading.' };
    default:
      return { message: 'DuckDB could not execute this statement.', suggestion: 'Inspect the technical details for the engine error and check the referenced data.' };
  }
}

export function diagnoseSqlError(
  error: unknown,
  sql = '',
  context: ErrorContext = 'query'
): SqlDiagnostic {
  const technicalMessage = errorMessage(error);
  const category = classify(technicalMessage, context, error);
  const isParserLibraryError = category === 'parser' &&
    !/^(?:Parser|Syntax) Error\b/i.test(technicalMessage) &&
    Boolean(error && typeof error === 'object' && (error as Record<string, unknown>).name === 'SyntaxError');
  const display = guidance(category, technicalMessage, isParserLibraryError);
  const position = errorPosition(error, technicalMessage, sql);
  const title = {
    parser: isParserLibraryError ? 'SQL visualizer parser' : 'SQL syntax error',
    binder: 'Invalid table, column, or expression',
    catalog: 'Table or function not found',
    constraint: 'Constraint violation',
    conversion: 'Type conversion error',
    import: 'File import error',
    persistence: 'Workspace persistence error',
    execution: 'Query execution error',
  }[category];

  return {
    category,
    title,
    message: display.message,
    technicalMessage: technicalMessage || `Failed SQL: ${sql}`,
    ...position,
    ...(display.suggestion ? { suggestion: display.suggestion } : {}),
  };
}
