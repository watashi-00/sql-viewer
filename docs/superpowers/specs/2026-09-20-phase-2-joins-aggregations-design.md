# Technical Design Spec: Phase 2 — JOINs, Aggregations, HAVING & Advanced Relational Operations

**Date**: 2026-09-20  
**Branch**: `feature/phase-2`  
**Status**: Approved  
**Scope**: Phase 2 Relational Operations  

---

## 1. Executive Summary

This document specifies the technical design for **Phase 2** of the SQL IDE + Query Debugger + Execution Visualizer. Building upon the Phase 1 MVP, Phase 2 implements rich, interactive visualizers for `JOIN` operations (with SVG connector lines and outer join `NULL` padding), `GROUP BY` partitioning, step-by-step aggregate formula calculations (`AVG`, `SUM`, `COUNT`, `MIN`, `MAX`), `HAVING` group filters, `DISTINCT` deduplication, and CTE (`WITH`) intermediate relations.

---

## 2. Extended Data Models (`src/types/index.ts`)

```typescript
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
```

---

## 3. Subsystem Specifications

### 3.1 JOIN Visualizer (`src/visualizer/JoinVisualizer.tsx`)
- **Dual Relation Layout**: Renders Left Table and Right Table side-by-side.
- **Interactive SVG Canvas**: Draws Bezier connector curves connecting matching left and right tuples. Hovering/clicking a connector highlights both tuples and displays the inline Join Predicate Inspector (`r.movie_id = m.movie_id` → Left: `1`, Right: `1` → `MATCH`).
- **Outer Join NULL Padding**: Unmatched rows in `LEFT JOIN`, `RIGHT JOIN`, or `FULL OUTER JOIN` render with `NULL` pads and a `No matching record` badge.

### 3.2 GROUP BY & Aggregations Visualizer (`src/visualizer/GroupByVisualizer.tsx`)
- **Group Buckets**: Input rows are partitioned into container cards labeled by group key (e.g. `m.title = 'Inception'`).
- **Aggregate Formulas**: Expandable cards detailing calculation steps:
  - `AVG(r.score)`: `(8 + 9) / 2 = 8.50`
  - `SUM(r.score)`: `8 + 9 = 17`
  - `COUNT(r.score)`: `2 non-null values → 2`
  - `MIN(r.score)` / `MAX(r.score)`: `MIN(8, 9) = 8` / `MAX(8, 9) = 9`

### 3.3 HAVING Group Filter
- Evaluates group-level conditions (`HAVING AVG(r.score) >= 8.5`).
- Passed buckets show `✓ Passed` (green badge); failed buckets show `× Rejected` (red badge) and move to the inspectable "Rejected Groups" container.

### 3.4 DISTINCT & CTE Integration
- **DISTINCT**: Highlights pre-distinct vs post-distinct row count and duplicate row collapsing.
- **CTEs (`WITH ... AS`)**: Visualizes named CTEs as independent intermediate relation cards.

---

## 4. Definition of Done (Phase 2)

Phase 2 is verified when queries containing `INNER JOIN`, `LEFT JOIN`, `GROUP BY`, `AVG()`, `HAVING`, `DISTINCT`, and `WITH` CTEs can be executed, stepped forward/backward, and inspected with full interactive visualizer rendering and 100% test suite pass rate.
