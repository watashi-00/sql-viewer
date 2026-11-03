export type SqlMutationKind =
  | 'create'
  | 'insert'
  | 'update'
  | 'delete'
  | 'merge'
  | 'alter'
  | 'drop'
  | 'truncate'
  | 'begin'
  | 'commit'
  | 'rollback';

export interface SqlMutation {
  kind: SqlMutationKind;
  tableName?: string;
}

function stripLeadingComments(sql: string): string {
  return sql.replace(/^\s*(?:(?:--[^\n]*(?:\n|$))|(?:\/\*[\s\S]*?\*\/\s*))*\s*/, '');
}

function statementKeyword(statement: string): string | undefined {
  const initialKeyword = statement.match(/^([a-z]+)/i)?.[1]?.toUpperCase();
  if (initialKeyword !== 'WITH') return initialKeyword;

  const topLevelTokens: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < statement.length; i++) {
    const char = statement[i];
    if (quote) {
      if (char === quote && statement[i + 1] === quote) i++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') {
      depth++;
      continue;
    }
    if (char === ')') {
      depth--;
      if (depth === 0) topLevelTokens.push(')');
      continue;
    }
    if (depth === 0) {
      if (char === ',') topLevelTokens.push(',');
      const word = statement.slice(i).match(/^[a-z]+/i)?.[0];
      if (word) {
        topLevelTokens.push(word.toUpperCase());
        i += word.length - 1;
      }
    }
  }

  for (let i = 1; i < topLevelTokens.length; i++) {
    if (topLevelTokens[i - 1] !== ')') continue;
    if (['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'MERGE'].includes(topLevelTokens[i])) {
      return topLevelTokens[i];
    }
  }
  return initialKeyword;
}

export function getSqlMutation(sql: string): SqlMutation | null {
  const statement = stripLeadingComments(sql);
  const keyword = statementKeyword(statement);
  if (!keyword) return null;

  if (keyword === 'START' && /^START\s+TRANSACTION\b/i.test(statement)) {
    return { kind: 'begin' };
  }
  if (keyword === 'BEGIN') return { kind: 'begin' };
  if (keyword === 'COMMIT' || keyword === 'END') return { kind: 'commit' };
  if (keyword === 'ROLLBACK') return { kind: 'rollback' };

  const kinds: Record<string, SqlMutationKind> = {
    CREATE: 'create',
    INSERT: 'insert',
    UPDATE: 'update',
    DELETE: 'delete',
    MERGE: 'merge',
    ALTER: 'alter',
    DROP: 'drop',
    TRUNCATE: 'truncate',
  };
  const kind = kinds[keyword];
  if (!kind) return null;

  // Temporary objects are session-only and must not be replayed as workspace data.
  if (kind === 'create' && /^CREATE\s+(?:OR\s+REPLACE\s+)?TEMP(?:ORARY)?\b/i.test(statement)) {
    return null;
  }

  const tableMatch = statement.match(
    /^CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"((?:[^"]|"")+)"|`([^`]+)`|([\w$]+))/i
  );
  const tableName = tableMatch
    ? (tableMatch[1]?.replace(/""/g, '"') ?? tableMatch[2] ?? tableMatch[3])
    : undefined;

  return { kind, ...(tableName ? { tableName } : {}) };
}

export function isMutatingStatement(sql: string): boolean {
  return getSqlMutation(sql) !== null;
}

export function isCreateTableStatement(sql: string): boolean {
  return getSqlMutation(sql)?.kind === 'create' && /^\s*(?:--[^\n]*\n\s*)?CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\b/i.test(stripLeadingComments(sql));
}

export interface JournaledSqlOperation {
  statements: string[];
  tableName?: string;
}

export class SqlMutationJournal {
  private pending: string[] | null = null;

  get inTransaction(): boolean {
    return this.pending !== null;
  }

  reset(): void {
    this.pending = null;
  }

  async record(sql: string, persist: (operation: JournaledSqlOperation) => Promise<void>): Promise<void> {
    const mutation = getSqlMutation(sql);
    if (!mutation) return;

    if (mutation.kind === 'begin') {
      this.pending = [sql];
      return;
    }
    if (mutation.kind === 'rollback') {
      this.pending = null;
      return;
    }
    if (mutation.kind === 'commit') {
      if (this.pending) {
        const statements = [...this.pending, sql];
        this.pending = null;
        await persist({ statements });
        return;
      }
      this.pending = null;
      return;
    }
    if (this.pending) {
      this.pending.push(sql);
      return;
    }

    await persist({ statements: [sql], ...(mutation.tableName ? { tableName: mutation.tableName } : {}) });
  }
}
