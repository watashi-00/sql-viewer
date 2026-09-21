export type OperationType =
  | 'FROM'
  | 'JOIN'
  | 'WHERE'
  | 'GROUP BY'
  | 'HAVING'
  | 'SELECT'
  | 'DISTINCT'
  | 'ORDER BY'
  | 'LIMIT';

export type DebugState =
  | 'idle'
  | 'running'
  | 'paused'
  | 'stepping'
  | 'completed'
  | 'error';

export interface ColumnMeta {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  foreignKeyRef?: { table: string; column: string };
  isNullable?: boolean;
  isUnique?: boolean;
  isIndexed?: boolean;
}

export interface TableMeta {
  name: string;
  schema: string;
  columns: ColumnMeta[];
  rowCount?: number;
}

export interface Schema {
  name: string;
  tables: TableMeta[];
}

export type RowValue = string | number | boolean | null | undefined;
export type DataRow = Record<string, RowValue>;

export interface PredicateNode {
  type: 'binary' | 'literal' | 'column';
  operator?: string;
  left?: PredicateNode;
  right?: PredicateNode;
  columnName?: string;
  value?: RowValue;
  result?: boolean | 'UNKNOWN';
}

export interface JoinMatch {
  leftRowId: number;
  rightRowId: number;
  isMatch: boolean;
  leftValues: DataRow;
  rightValues: DataRow;
}

export interface ExecutionEvent {
  id: string;
  stage: OperationType;
  stageIndex: number;
  title: string;
  description: string;
  inputRows: DataRow[];
  outputRows: DataRow[];
  rejectedRows?: DataRow[];
  predicateTree?: PredicateNode;
  joinMatches?: JoinMatch[];
  groupBuckets?: Array<{ key: string; rows: DataRow[]; aggregateResult?: Record<string, RowValue> }>;
  removedDuplicatesCount?: number;
  durationMs?: number;
}

export interface ExecutionPlan {
  query: string;
  stages: OperationType[];
  events: ExecutionEvent[];
  finalResult: DataRow[];
  columns: string[];
}
