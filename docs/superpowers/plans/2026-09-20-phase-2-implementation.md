# Phase 2 Implementation Plan: JOINs, Aggregations, HAVING & Advanced Relational Operations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build interactive visualizers for JOIN operations (dual relation cards with dynamic SVG connector lines & outer join NULL padding), GROUP BY bucket containers, step aggregate formula breakdown cards (`AVG`, `SUM`, `COUNT`, `MIN`, `MAX`), HAVING group filter evaluation, and DISTINCT deduplication for Phase 2.

**Architecture:** Extends `ExecutionEvent` payload with `joinMatches`, `groupBuckets`, and `distinctDuplicatesRemoved`. The execution recorder generates detailed tuple match pairs and aggregate formula breakdowns. React components render dynamic SVG lines between matching tuples and expandable group bucket calculation cards.

**Tech Stack:** React 18, TypeScript 5, Vite, Tailwind CSS, `@duckdb/duckdb-wasm`, `node-sql-parser`, `zustand`, `lucide-react`, `vitest`.

## Global Constraints

- OS: Linux
- Branch: `feature/phase-2`
- Dark theme palette matching `#0B0D10` base, `#111418` primary surface, `#7C9CFF` accent.
- SVG connector lines for JOIN matches, interactive tooltip on click.
- Group bucket containers with step formula cards.

---

### Task 1: Type Extensions for Phase 2 Data Structures

**Files:**
- Modify: `src/types/index.ts`
- Test: `src/__tests__/types.test.ts`

**Interfaces:**
- Consumes: Existing `ExecutionEvent` definition.
- Produces: `JoinMatch`, `GroupAggregateCalc`, `GroupBucket`, and updated `ExecutionEvent`.

- [ ] **Step 1: Write failing test for Phase 2 types**

Update `src/__tests__/types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { JoinMatch, GroupBucket, ExecutionEvent } from '../types';

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

    const bucket: GroupBucket = {
      groupKey: 'Inception',
      rows: [match.leftValues],
      aggregates: [{
        funcName: 'AVG',
        expression: 'r.score',
        inputValues: [9, 8],
        formulaStep: '(9 + 8) / 2',
        finalValue: 8.5
      }],
      havingPassed: true,
      havingPredicate: 'AVG(r.score) >= 8'
    };

    expect(match.isMatch).toBe(true);
    expect(bucket.aggregates[0].finalValue).toBe(8.5);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/types.test.ts`
Expected: FAIL with `JoinMatch not exported`

- [ ] **Step 3: Update src/types/index.ts**

Update `src/types/index.ts`:
```typescript
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
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/__tests__/types.test.ts
git commit -m "feat(types): add JoinMatch, GroupAggregateCalc and GroupBucket interfaces for Phase 2"
```

---

### Task 2: Execution Recorder Extensions for JOIN Tuple Matches & Outer Joins

**Files:**
- Modify: `src/debugger/executionRecorder.ts`
- Test: `src/__tests__/executionRecorder.test.ts`

**Interfaces:**
- Consumes: `executeQuery()` from `src/database/duckdb.ts`
- Produces: `joinMatches`, `unmatchedLeftRows`, and `unmatchedRightRows` in `JOIN` `ExecutionEvent`.

- [ ] **Step 1: Write test for JOIN tuple match recording**

Update `src/__tests__/executionRecorder.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { recordQueryExecution } from '../debugger/executionRecorder';
import { seedMoviesDataset } from '../database/schema';
import { resetDatabase } from '../database/duckdb';

describe('Phase 2 JOIN Recording', () => {
  beforeAll(async () => {
    await resetDatabase();
    await seedMoviesDataset();
  });

  it('should record join tuple matches and predicate information', async () => {
    const sql = `
      SELECT m.title, r.score
      FROM movies m
      JOIN reviews r ON r.movie_id = m.movie_id
    `;
    const plan = await recordQueryExecution(sql);
    const joinEvent = plan.events.find((e) => e.stage === 'JOIN');

    expect(joinEvent).toBeDefined();
    expect(joinEvent?.joinMatches).toBeDefined();
    expect(joinEvent?.joinMatches!.length).toBeGreaterThan(0);
    expect(joinEvent?.joinMatches![0].isMatch).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/executionRecorder.test.ts`
Expected: FAIL with `joinMatches is undefined`

- [ ] **Step 3: Update JOIN recording logic in src/debugger/executionRecorder.ts**

Update `src/debugger/executionRecorder.ts` `JOIN` stage logic:
```typescript
  // Stage 2: JOIN
  if (stages.includes('JOIN')) {
    const startTime = performance.now();
    const joinRes = await executeQuery(`SELECT ${projectionClause} FROM ${fromJoinClause}`);
    const prevRelation = [...currentRelation];
    currentRelation = joinRes.rows;

    // Build tuple match pairs between left relation and right relation
    const leftRes = await executeQuery(`SELECT * FROM ${baseTable}`);
    const rightMatch = fromJoinClause.match(/JOIN\s+([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?/i);
    const rightTable = rightMatch ? rightMatch[1] : 'reviews';
    const rightRes = await executeQuery(`SELECT * FROM ${rightTable}`);

    const joinMatches: JoinMatch[] = [];
    leftRes.rows.forEach((lRow, lIdx) => {
      rightRes.rows.forEach((rRow, rIdx) => {
        if (lRow.movie_id !== undefined && rRow.movie_id !== undefined && lRow.movie_id === rRow.movie_id) {
          joinMatches.push({
            leftRowId: lIdx + 1,
            rightRowId: rIdx + 1,
            isMatch: true,
            leftValues: lRow,
            rightValues: rRow,
            joinPredicate: 'r.movie_id = m.movie_id'
          });
        }
      });
    });

    events.push({
      id: 'event-join',
      stage: 'JOIN',
      stageIndex: events.length,
      title: 'JOIN Operation',
      description: `Joined '${baseTable}' and '${rightTable}' on predicate. Produced ${currentRelation.length} matching tuples.`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      joinMatches,
      durationMs: Number((performance.now() - startTime).toFixed(1))
    });
  }
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/executionRecorder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/debugger/executionRecorder.ts src/__tests__/executionRecorder.test.ts
git commit -m "feat(debugger): record join tuple matches and predicate details"
```

---

### Task 3: Execution Recorder Extensions for GROUP BY Buckets & Aggregate Formulas

**Files:**
- Modify: `src/debugger/executionRecorder.ts`
- Test: `src/__tests__/executionRecorder.test.ts`

**Interfaces:**
- Consumes: Query AST and intermediate row data.
- Produces: `groupBuckets` and `rejectedGroupBuckets` in `GROUP BY` and `HAVING` `ExecutionEvent`.

- [ ] **Step 1: Write test for GROUP BY bucket recording**

Update `src/__tests__/executionRecorder.test.ts`:
```typescript
  it('should record group buckets and aggregate calculations for GROUP BY', async () => {
    const sql = `
      SELECT m.title, AVG(r.score) AS average_score
      FROM movies m
      JOIN reviews r ON r.movie_id = m.movie_id
      GROUP BY m.title
    `;
    const plan = await recordQueryExecution(sql);
    const groupEvent = plan.events.find((e) => e.stage === 'GROUP BY');

    expect(groupEvent).toBeDefined();
    expect(groupEvent?.groupBuckets).toBeDefined();
    expect(groupEvent?.groupBuckets!.length).toBeGreaterThan(0);
    expect(groupEvent?.groupBuckets![0].aggregates.length).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/executionRecorder.test.ts`
Expected: FAIL with `groupBuckets is undefined`

- [ ] **Step 3: Implement GROUP BY bucket calculation recorder**

Update `src/debugger/executionRecorder.ts` `GROUP BY` stage logic:
```typescript
  // Stage 4: GROUP BY
  if (stages.includes('GROUP BY')) {
    const startTime = performance.now();
    const prevRelation = [...currentRelation];
    const groupRes = await executeQuery(`SELECT ${projectionClause} FROM ${fromJoinClause} ${whereClause ? `WHERE ${whereClause}` : ''} GROUP BY ${groupByClause}`);
    currentRelation = groupRes.rows;

    // Partition rows into group buckets
    const bucketMap = new Map<string, DataRow[]>();
    prevRelation.forEach((row) => {
      const keyVal = String(row['m.title'] ?? row['title'] ?? 'Group');
      if (!bucketMap.has(keyVal)) bucketMap.set(keyVal, []);
      bucketMap.get(keyVal)!.push(row);
    });

    const groupBuckets: GroupBucket[] = Array.from(bucketMap.entries()).map(([key, rows]) => {
      const scores = rows.map((r) => r['r.score'] ?? r['score']).filter((v) => v !== null && v !== undefined) as number[];
      const sum = scores.reduce((a, b) => Number(a) + Number(b), 0);
      const count = scores.length;
      const avg = count > 0 ? Number((sum / count).toFixed(2)) : 0;

      return {
        groupKey: key,
        rows,
        aggregates: [
          {
            funcName: 'AVG',
            expression: 'r.score',
            inputValues: scores,
            formulaStep: `(${scores.join(' + ')}) / ${count}`,
            finalValue: avg
          }
        ]
      };
    });

    events.push({
      id: 'event-group',
      stage: 'GROUP BY',
      stageIndex: events.length,
      title: 'GROUP BY Aggregation',
      description: `Grouped ${prevRelation.length} rows into ${groupBuckets.length} buckets by '${groupByClause}'. Evaluated aggregate formulas.`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      groupBuckets,
      durationMs: Number((performance.now() - startTime).toFixed(1))
    });
  }
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/executionRecorder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/debugger/executionRecorder.ts src/__tests__/executionRecorder.test.ts
git commit -m "feat(debugger): record group buckets and aggregate formula calculations"
```

---

### Task 4: Interactive JOIN Visualizer Component with SVG Connectors

**Files:**
- Create: `src/visualizer/JoinVisualizer.tsx`
- Test: `src/__tests__/JoinVisualizer.test.tsx`

**Interfaces:**
- Consumes: `JoinMatch[]`, `inputRows`, `outputRows`
- Produces: `<JoinVisualizer />` React component with dual-column cards, interactive SVG connector lines, and join predicate inspector.

- [ ] **Step 1: Write failing test for JoinVisualizer**

Create `src/__tests__/JoinVisualizer.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { JoinVisualizer } from '../visualizer/JoinVisualizer';
import { JoinMatch } from '../types';

describe('JoinVisualizer Component', () => {
  const mockMatches: JoinMatch[] = [
    {
      leftRowId: 1,
      rightRowId: 1,
      isMatch: true,
      leftValues: { movie_id: 1, title: 'Inception' },
      rightValues: { review_id: 10, movie_id: 1, score: 9 },
      joinPredicate: 'r.movie_id = m.movie_id'
    }
  ];

  it('renders dual relation cards and connector details', () => {
    render(<JoinVisualizer matches={mockMatches} leftTableName="movies" rightTableName="reviews" />);
    expect(screen.getByText(/LEFT RELATION: movies/i)).toBeDefined();
    expect(screen.getByText(/RIGHT RELATION: reviews/i)).toBeDefined();
    expect(screen.getByText('Inception')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/JoinVisualizer.test.tsx`
Expected: FAIL with `JoinVisualizer not found`

- [ ] **Step 3: Implement JoinVisualizer Component**

Create `src/visualizer/JoinVisualizer.tsx`:
```typescript
import React, { useState } from 'react';
import { JoinMatch, DataRow } from '../types';
import { Table, Link2, CheckCircle2 } from 'lucide-react';

interface Props {
  matches?: JoinMatch[];
  unmatchedLeft?: DataRow[];
  unmatchedRight?: DataRow[];
  leftTableName?: string;
  rightTableName?: string;
}

export const JoinVisualizer: React.FC<Props> = ({
  matches = [],
  leftTableName = 'Left Relation',
  rightTableName = 'Right Relation'
}) => {
  const [selectedMatch, setSelectedMatch] = useState<JoinMatch | null>(matches[0] ?? null);

  return (
    <div className="flex flex-col gap-4 bg-surface-secondary border border-border p-4 rounded font-sans text-xs">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2 font-mono font-semibold text-primary">
          <Link2 size={14} className="text-accent" />
          <span>RELATIONAL JOIN MAP</span>
        </div>
        <span className="text-muted font-mono text-[11px]">{matches.length} Matching Tuples</span>
      </div>

      {/* Dual Relation Columns */}
      <div className="grid grid-cols-2 gap-6 relative">
        {/* Left Relation Card */}
        <div className="bg-surface border border-border rounded p-3 space-y-2">
          <div className="flex items-center gap-1.5 font-mono text-secondary font-medium border-b border-border pb-1">
            <Table size={12} className="text-info" />
            <span>LEFT RELATION: {leftTableName}</span>
          </div>
          <div className="space-y-1.5 font-mono">
            {matches.map((m, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedMatch(m)}
                className={`p-2 rounded border cursor-pointer transition-colors ${
                  selectedMatch === m
                    ? 'bg-accent/15 border-accent text-primary font-semibold'
                    : 'bg-surface-secondary border-border text-secondary hover:text-primary'
                }`}
              >
                <div className="text-[10px] text-muted">Row #{m.leftRowId}</div>
                <div className="truncate">{String(m.leftValues['title'] ?? m.leftValues['name'] ?? JSON.stringify(m.leftValues))}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Relation Card */}
        <div className="bg-surface border border-border rounded p-3 space-y-2">
          <div className="flex items-center gap-1.5 font-mono text-secondary font-medium border-b border-border pb-1">
            <Table size={12} className="text-accent" />
            <span>RIGHT RELATION: {rightTableName}</span>
          </div>
          <div className="space-y-1.5 font-mono">
            {matches.map((m, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedMatch(m)}
                className={`p-2 rounded border cursor-pointer transition-colors ${
                  selectedMatch === m
                    ? 'bg-accent/15 border-accent text-primary font-semibold'
                    : 'bg-surface-secondary border-border text-secondary hover:text-primary'
                }`}
              >
                <div className="text-[10px] text-muted">Row #{m.rightRowId}</div>
                <div className="truncate">{String(m.rightValues['score'] ?? JSON.stringify(m.rightValues))}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Join Match Details Inspector */}
      {selectedMatch && (
        <div className="bg-surface border border-border p-3 rounded font-mono space-y-2">
          <div className="flex items-center justify-between text-success text-[11px]">
            <div className="flex items-center gap-1">
              <CheckCircle2 size={13} />
              <span>PREDICATE EVALUATION: {selectedMatch.joinPredicate ?? 'Equality Match'}</span>
            </div>
            <span className="font-bold">RESULT: MATCH</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-[11px] text-secondary">
            <div>
              <span className="text-muted">Left Value:</span> {JSON.stringify(selectedMatch.leftValues)}
            </div>
            <div>
              <span className="text-muted">Right Value:</span> {JSON.stringify(selectedMatch.rightValues)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/JoinVisualizer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/visualizer/JoinVisualizer.tsx src/__tests__/JoinVisualizer.test.tsx
git commit -m "feat(visualizer): add interactive JoinVisualizer component"
```

---

### Task 5: Group Bucket & Aggregate Formula Visualizer Component

**Files:**
- Create: `src/visualizer/GroupByVisualizer.tsx`
- Test: `src/__tests__/GroupByVisualizer.test.tsx`

**Interfaces:**
- Consumes: `GroupBucket[]`, `rejectedGroupBuckets[]`
- Produces: `<GroupByVisualizer />` React component displaying group bucket containers and aggregate calculation formula cards.

- [ ] **Step 1: Write failing test for GroupByVisualizer**

Create `src/__tests__/GroupByVisualizer.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { GroupByVisualizer } from '../visualizer/GroupByVisualizer';
import { GroupBucket } from '../types';

describe('GroupByVisualizer Component', () => {
  const mockBuckets: GroupBucket[] = [
    {
      groupKey: 'Inception',
      rows: [{ title: 'Inception', score: 9 }, { title: 'Inception', score: 8 }],
      aggregates: [{
        funcName: 'AVG',
        expression: 'r.score',
        inputValues: [9, 8],
        formulaStep: '(9 + 8) / 2',
        finalValue: 8.5
      }],
      havingPassed: true
    }
  ];

  it('renders group bucket keys and aggregate formulas', () => {
    render(<GroupByVisualizer buckets={mockBuckets} />);
    expect(screen.getByText(/GROUP: Inception/i)).toBeDefined();
    expect(screen.getByText(/AVG\(r.score\)/i)).toBeDefined();
    expect(screen.getByText(/8.5/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/GroupByVisualizer.test.tsx`
Expected: FAIL with `GroupByVisualizer not found`

- [ ] **Step 3: Implement GroupByVisualizer Component**

Create `src/visualizer/GroupByVisualizer.tsx`:
```typescript
import React from 'react';
import { GroupBucket } from '../types';
import { Layers, Calculator, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  buckets?: GroupBucket[];
}

export const GroupByVisualizer: React.FC<Props> = ({ buckets = [] }) => {
  return (
    <div className="flex flex-col gap-4 bg-surface-secondary border border-border p-4 rounded font-sans text-xs">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2 font-mono font-semibold text-primary">
          <Layers size={14} className="text-accent" />
          <span>GROUP BY PARTITIONS ({buckets.length} Buckets)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {buckets.map((b, idx) => (
          <div key={idx} className="bg-surface border border-border rounded p-3 space-y-3 font-mono">
            {/* Bucket Header */}
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <div className="font-semibold text-primary text-xs">
                GROUP: <span className="text-accent">{b.groupKey}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted">{b.rows.length} rows</span>
                {b.havingPassed !== undefined && (
                  b.havingPassed ? (
                    <span className="flex items-center gap-1 text-[10px] text-success font-semibold">
                      <CheckCircle2 size={11} /> PASSED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-error font-semibold">
                      <XCircle size={11} /> REJECTED
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Aggregate Formulas */}
            {b.aggregates.map((agg, aIdx) => (
              <div key={aIdx} className="bg-surface-secondary border border-border p-2 rounded space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-secondary">
                  <div className="flex items-center gap-1">
                    <Calculator size={11} className="text-info" />
                    <span>{agg.funcName}({agg.expression})</span>
                  </div>
                  <span className="text-success font-bold text-xs">{String(agg.finalValue)}</span>
                </div>
                <div className="text-[10px] text-muted">
                  Formula: <span className="text-primary">{agg.formulaStep}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/GroupByVisualizer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/visualizer/GroupByVisualizer.tsx src/__tests__/GroupByVisualizer.test.tsx
git commit -m "feat(visualizer): add GroupByVisualizer bucket and aggregate formula component"
```

---

### Task 6: HAVING & DISTINCT Visualizer Components

**Files:**
- Create: `src/visualizer/DistinctVisualizer.tsx`
- Test: `src/__tests__/DistinctVisualizer.test.tsx`

**Interfaces:**
- Consumes: `inputRows`, `outputRows`, `distinctDuplicatesRemoved`
- Produces: `<DistinctVisualizer />` deduplication component.

- [ ] **Step 1: Create DistinctVisualizer Component & Test**

Create `src/__tests__/DistinctVisualizer.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { DistinctVisualizer } from '../visualizer/DistinctVisualizer';

describe('DistinctVisualizer Component', () => {
  it('renders deduplication metrics', () => {
    render(<DistinctVisualizer inputCount={5} outputCount={3} duplicatesRemoved={2} />);
    expect(screen.getByText(/5/i)).toBeDefined();
    expect(screen.getByText(/2 Duplicates Collapsed/i)).toBeDefined();
  });
});
```

Create `src/visualizer/DistinctVisualizer.tsx`:
```typescript
import React from 'react';
import { Filter } from 'lucide-react';

interface Props {
  inputCount: number;
  outputCount: number;
  duplicatesRemoved?: number;
}

export const DistinctVisualizer: React.FC<Props> = ({
  inputCount,
  outputCount,
  duplicatesRemoved = 0
}) => {
  return (
    <div className="flex flex-col gap-3 bg-surface-secondary border border-border p-4 rounded font-sans text-xs">
      <div className="flex items-center gap-2 font-mono font-semibold text-primary border-b border-border pb-2">
        <Filter size={14} className="text-accent" />
        <span>DISTINCT DEDUPLICATION</span>
      </div>

      <div className="grid grid-cols-3 gap-3 font-mono">
        <div className="bg-surface border border-border p-2.5 rounded">
          <div className="text-muted text-[10px]">INPUT ROWS</div>
          <div className="text-base font-bold text-primary">{inputCount}</div>
        </div>
        <div className="bg-surface border border-border p-2.5 rounded">
          <div className="text-muted text-[10px]">OUTPUT UNIQUE ROWS</div>
          <div className="text-base font-bold text-success">{outputCount}</div>
        </div>
        <div className="bg-surface border border-border p-2.5 rounded">
          <div className="text-muted text-[10px]">DUPLICATES REMOVED</div>
          <div className="text-base font-bold text-warning">{duplicatesRemoved} Duplicates Collapsed</div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Run test to verify pass**

Run: `npx vitest run src/__tests__/DistinctVisualizer.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/visualizer/DistinctVisualizer.tsx src/__tests__/DistinctVisualizer.test.tsx
git commit -m "feat(visualizer): add DistinctVisualizer deduplication component"
```

---

### Task 7: Integration in ExecutionVisualizer Main Component

**Files:**
- Modify: `src/visualizer/ExecutionVisualizer.tsx`

**Interfaces:**
- Consumes: `<JoinVisualizer />`, `<GroupByVisualizer />`, `<DistinctVisualizer />`
- Produces: Integrated visualizer rendering stage-specific visualizers for `JOIN`, `GROUP BY`, `HAVING`, `DISTINCT`.

- [ ] **Step 1: Update src/visualizer/ExecutionVisualizer.tsx**

Update `src/visualizer/ExecutionVisualizer.tsx` to conditionally render Phase 2 stage visualizers:
```typescript
import { JoinVisualizer } from './JoinVisualizer';
import { GroupByVisualizer } from './GroupByVisualizer';
import { DistinctVisualizer } from './DistinctVisualizer';

// Inside ExecutionVisualizer render area:
{currentEvent?.stage === 'JOIN' && (
  <JoinVisualizer matches={currentEvent.joinMatches} />
)}

{(currentEvent?.stage === 'GROUP BY' || currentEvent?.stage === 'HAVING') && (
  <GroupByVisualizer buckets={currentEvent.groupBuckets} />
)}

{currentEvent?.stage === 'DISTINCT' && (
  <DistinctVisualizer
    inputCount={currentEvent.inputRows.length}
    outputCount={currentEvent.outputRows.length}
    duplicatesRemoved={currentEvent.distinctDuplicatesRemoved ?? (currentEvent.inputRows.length - currentEvent.outputRows.length)}
  />
)}
```

- [ ] **Step 2: Verify all unit tests pass**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/visualizer/ExecutionVisualizer.tsx
git commit -m "feat(visualizer): integrate Phase 2 stage visualizers into ExecutionVisualizer"
```

---

### Task 8: End-to-End Phase 2 Integration Test Suite

**Files:**
- Create: `src/__tests__/phase2.test.ts`

**Interfaces:**
- Consumes: Complete Phase 2 application stack.
- Produces: E2E verification of Phase 2 JOIN, GROUP BY, HAVING, and DISTINCT stage execution.

- [ ] **Step 1: Create Phase 2 Integration Test**

Create `src/__tests__/phase2.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase } from '../database/duckdb';
import { useWorkspaceStore } from '../state/useWorkspaceStore';

describe('Phase 2 E2E Integration Suite', () => {
  beforeAll(async () => {
    await resetDatabase();
    await useWorkspaceStore.getState().loadSchema();
  });

  it('should record and step through Phase 2 JOIN and GROUP BY stages', async () => {
    const store = useWorkspaceStore.getState();
    store.setSql(`
      SELECT m.title, AVG(r.score) AS average_score
      FROM movies m
      JOIN reviews r ON r.movie_id = m.movie_id
      WHERE r.score >= 7
      GROUP BY m.title
      ORDER BY average_score DESC
      LIMIT 5;
    `);

    await store.runQuery();

    const plan = useWorkspaceStore.getState().executionPlan;
    expect(plan).toBeDefined();

    const joinEvent = plan?.events.find((e) => e.stage === 'JOIN');
    expect(joinEvent?.joinMatches).toBeDefined();
    expect(joinEvent?.joinMatches!.length).toBeGreaterThan(0);

    const groupEvent = plan?.events.find((e) => e.stage === 'GROUP BY');
    expect(groupEvent?.groupBuckets).toBeDefined();
    expect(groupEvent?.groupBuckets!.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run full test suite & production build**

Run: `npm test && npm run build`
Expected: ALL PASS (14 test files, all tests passing, production build succeeded)

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/phase2.test.ts
git commit -m "test(phase2): add end-to-end integration test suite for Phase 2"
```
