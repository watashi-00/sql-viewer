import { describe, it, expect } from 'vitest';
import {
  OperationType,
  DebugState,
  ColumnMeta,
  TableMeta,
  Schema,
  RowValue,
  DataRow,
  PredicateNode,
  JoinMatch,
  GroupBucket,
  GroupAggregateCalc,
  ExecutionEvent,
  ExecutionPlan,
  SubqueryResolution,
  CteScope,
  ExplainNode,
} from '../types';

describe('Types sanity check', () => {
  it('should define valid operation types', () => {
    const ops: OperationType[] = [
      'FROM',
      'JOIN',
      'WHERE',
      'GROUP BY',
      'HAVING',
      'SELECT',
      'DISTINCT',
      'ORDER BY',
      'LIMIT',
    ];
    expect(ops).toHaveLength(9);
  });

  it('should define valid debug states', () => {
    const states: DebugState[] = [
      'idle',
      'running',
      'paused',
      'stepping',
      'completed',
      'error',
    ];
    expect(states).toHaveLength(6);
  });

  it('should allow constructing Schema, TableMeta, and ColumnMeta objects', () => {
    const column: ColumnMeta = {
      name: 'id',
      type: 'INTEGER',
      isPrimaryKey: true,
      isNullable: false,
      isUnique: true,
      isIndexed: true,
    };

    const foreignKeyCol: ColumnMeta = {
      name: 'user_id',
      type: 'INTEGER',
      isForeignKey: true,
      foreignKeyRef: {
        table: 'users',
        column: 'id',
      },
    };

    const table: TableMeta = {
      name: 'orders',
      schema: 'public',
      columns: [column, foreignKeyCol],
      rowCount: 10,
    };

    const schema: Schema = {
      name: 'ecommerce',
      tables: [table],
    };

    expect(schema.name).toBe('ecommerce');
    expect(schema.tables).toHaveLength(1);
    expect(schema.tables[0].columns).toHaveLength(2);
    expect(schema.tables[0].columns[1].foreignKeyRef?.table).toBe('users');
  });

  it('should allow constructing DataRow with various RowValue types', () => {
    const val: RowValue = 'test';
    expect(val).toBe('test');

    const row: DataRow = {
      id: 1,
      name: 'Alice',
      isActive: true,
      notes: null,
      extra: undefined,
    };

    expect(row.id).toBe(1);
    expect(row.name).toBe('Alice');
    expect(row.isActive).toBe(true);
    expect(row.notes).toBeNull();
    expect(row.extra).toBeUndefined();
  });

  it('should allow constructing PredicateNode tree', () => {
    const predicate: PredicateNode = {
      type: 'binary',
      operator: '=',
      left: {
        type: 'column',
        columnName: 'age',
      },
      right: {
        type: 'literal',
        value: 30,
      },
      result: true,
    };

    expect(predicate.type).toBe('binary');
    expect(predicate.left?.columnName).toBe('age');
    expect(predicate.right?.value).toBe(30);
    expect(predicate.result).toBe(true);
  });

  it('should allow constructing JoinMatch', () => {
    const match: JoinMatch = {
      leftRowId: 1,
      rightRowId: 2,
      isMatch: true,
      leftValues: { id: 1, name: 'Alice' },
      rightValues: { orderId: 101, userId: 1 },
    };

    expect(match.isMatch).toBe(true);
    expect(match.leftRowId).toBe(1);
    expect(match.rightRowId).toBe(2);
  });

  it('should allow constructing ExecutionEvent and ExecutionPlan', () => {
    const event: ExecutionEvent = {
      id: 'evt-1',
      stage: 'WHERE',
      stageIndex: 2,
      title: 'Filter active users',
      description: 'Filter where is_active = true',
      inputRows: [{ id: 1, is_active: true }, { id: 2, is_active: false }],
      outputRows: [{ id: 1, is_active: true }],
      rejectedRows: [{ id: 2, is_active: false }],
      predicateTree: {
        type: 'binary',
        operator: '=',
        left: { type: 'column', columnName: 'is_active' },
        right: { type: 'literal', value: true },
        result: true,
      },
      durationMs: 1.5,
    };

    const plan: ExecutionPlan = {
      query: 'SELECT * FROM users WHERE is_active = true',
      stages: ['FROM', 'WHERE', 'SELECT'],
      events: [event],
      finalResult: [{ id: 1, is_active: true }],
      columns: ['id', 'is_active'],
    };

    expect(plan.stages).toHaveLength(3);
    expect(plan.events[0].stage).toBe('WHERE');
    expect(plan.events[0].outputRows).toHaveLength(1);
    expect(plan.finalResult).toHaveLength(1);
  });
});

describe('Phase 2 Types', () => {
  it('should instantiate JoinMatch and GroupBucket interfaces', () => {
    const match: JoinMatch = {
      leftRowId: 1,
      rightRowId: 1,
      isMatch: true,
      leftValues: { movie_id: 1, title: 'Inception' },
      rightValues: { review_id: 10, movie_id: 1, score: 9 },
      joinPredicate: 'r.movie_id = m.movie_id'
    };

    const calc: GroupAggregateCalc = {
      funcName: 'AVG',
      expression: 'r.score',
      inputValues: [9, 8],
      formulaStep: '(9 + 8) / 2',
      finalValue: 8.5
    };

    const bucket: GroupBucket = {
      groupKey: 'Inception',
      rows: [match.leftValues],
      aggregates: [calc],
      havingPassed: true,
      havingPredicate: 'AVG(r.score) >= 8'
    };

    const event: ExecutionEvent = {
      id: 'event-1',
      stage: 'GROUP BY',
      stageIndex: 3,
      title: 'Group by title',
      description: 'Grouped rows',
      inputRows: [match.leftValues],
      outputRows: [match.leftValues],
      joinMatches: [match],
      unmatchedLeftRows: [],
      unmatchedRightRows: [],
      groupBuckets: [bucket],
      rejectedGroupBuckets: [],
      distinctDuplicatesRemoved: 0
    };

    expect(match.isMatch).toBe(true);
    expect(match.joinPredicate).toBe('r.movie_id = m.movie_id');
    expect(bucket.aggregates[0].finalValue).toBe(8.5);
    expect(event.groupBuckets).toHaveLength(1);
    expect(event.groupBuckets![0].aggregates[0].funcName).toBe('AVG');
  });
});

describe('Phase 3 Types', () => {
  it('should instantiate CteScope, SubqueryResolution, and ExplainNode interfaces', () => {
    const subquery: SubqueryResolution = {
      id: 'sub-1',
      type: 'scalar',
      rawQuery: 'SELECT AVG(score) FROM reviews',
      resolvedValue: 8.2,
      parentClause: 'WHERE'
    };

    const cte: CteScope = {
      id: 'cte-1',
      aliasName: 'top_directors',
      query: "SELECT director_id FROM directors WHERE nationality = 'American'",
      events: [],
      outputRows: [{ director_id: 1 }]
    };

    const explainNode: ExplainNode = {
      id: 'node-1',
      operatorType: 'HASH_JOIN',
      description: 'JOIN r.movie_id = m.movie_id',
      timingMs: 1.2,
      cardinality: 15,
      children: []
    };

    const plan: ExecutionPlan = {
      query: 'WITH top_directors AS (...) SELECT * FROM top_directors',
      stages: ['FROM', 'SELECT'],
      events: [],
      finalResult: [],
      columns: ['director_id'],
      cteScopes: [cte],
      explainTree: explainNode
    };

    expect(subquery.resolvedValue).toBe(8.2);
    expect(cte.aliasName).toBe('top_directors');
    expect(plan.cteScopes?.[0].aliasName).toBe('top_directors');
    expect(plan.explainTree?.operatorType).toBe('HASH_JOIN');
  });
});


