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
  ExecutionEvent,
  ExecutionPlan,
} from '../types';
import '../types';

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
