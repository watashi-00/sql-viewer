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
  joinPredicate?: string;
}

export interface GroupAggregateCalc {
  funcName: 'AVG' | 'SUM' | 'COUNT' | 'MIN' | 'MAX';
  expression: string;
  inputValues: RowValue[];
  formulaStep: string;
  finalValue: RowValue;
}

export interface GroupBucket {
  groupKey: string;
  rows: DataRow[];
  aggregates: GroupAggregateCalc[];
  havingPassed?: boolean;
  havingPredicate?: string;
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
  unmatchedLeftRows?: DataRow[];
  unmatchedRightRows?: DataRow[];
  groupBuckets?: GroupBucket[];
  rejectedGroupBuckets?: GroupBucket[];
  distinctDuplicatesRemoved?: number;
  durationMs?: number;
}

export interface ExecutionPlan {
  query: string;
  stages: OperationType[];
  events: ExecutionEvent[];
  finalResult: DataRow[];
  columns: string[];
}
