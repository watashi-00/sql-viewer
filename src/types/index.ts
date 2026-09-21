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

export interface SubqueryResolution {
  id: string;
  type: 'scalar' | 'set' | 'exists';
  rawQuery: string;
  resolvedValue?: RowValue;
  resolvedSet?: RowValue[];
  existsResult?: boolean;
  parentClause: 'WHERE' | 'HAVING' | 'SELECT';
}

export interface CteScope {
  id: string;
  aliasName: string;
  query: string;
  events: ExecutionEvent[];
  outputRows: DataRow[];
}

export interface ExplainNode {
  id: string;
  operatorType: string;
  description: string;
  timingMs?: number;
  cardinality?: number;
  children: ExplainNode[];
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
  subqueryResolutions?: SubqueryResolution[];
  durationMs?: number;
}

export interface ExecutionPlan {
  query: string;
  stages: OperationType[];
  events: ExecutionEvent[];
  finalResult: DataRow[];
  columns: string[];
  cteScopes?: CteScope[];
  explainTree?: ExplainNode;
}

export type ExportFormat = 'csv' | 'json' | 'parquet';

export interface CustomFileImport {
  tableName: string;
  fileName: string;
  fileSize: number;
  format: 'csv' | 'json' | 'parquet';
  rowCount: number;
  columns: ColumnMeta[];
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  timestamp: number;
  durationMs: number;
  rowCount: number;
  status: 'success' | 'error';
  errorMessage?: string;
  isFavorite?: boolean;
  tags?: string[];
}

export interface SavedSnippet {
  id: string;
  title: string;
  sql: string;
  description?: string;
  tags: string[];
  createdAt: number;
}

export interface VisualQueryNode {
  id: string;
  tableName: string;
  selectedColumns: string[];
  alias?: string;
  position: { x: number; y: number };
}

export interface VisualJoinEdge {
  id: string;
  leftTable: string;
  leftColumn: string;
  rightTable: string;
  rightColumn: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
}

export interface VisualFilterCondition {
  id: string;
  table: string;
  column: string;
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'LIKE' | 'IN';
  value: string;
}

export interface VisualQueryState {
  nodes: VisualQueryNode[];
  joins: VisualJoinEdge[];
  filters: VisualFilterCondition[];
  limit?: number;
}

