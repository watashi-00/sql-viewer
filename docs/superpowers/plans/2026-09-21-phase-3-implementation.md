# Phase 3 Implementation Plan: CTEs, Subqueries & Physical Execution Plan Graphs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement isolated CTE scope debugging (`WITH ... AS (...)`), subquery resolution inspection (`IN`, `EXISTS`, scalar, correlated), and an interactive physical execution plan tree powered by DuckDB WASM `EXPLAIN`.

**Architecture:** Extends `ExecutionPlan` with `cteScopes` and `explainTree`, and `ExecutionEvent` with `subqueryResolutions`. `executionRecorder.ts` parses `WITH` AST definitions to execute and log CTE scopes independently, records subquery scalar/set resolution payloads, and parses DuckDB `EXPLAIN` operator nodes. React visualizer components (`CteVisualizer`, `SubqueryVisualizer`, `ExplainTreeVisualizer`) render scope selection tabs, subquery result cards, and interactive physical operator graphs.

**Tech Stack:** React 18, TypeScript 5, Vite, Tailwind CSS, `@duckdb/duckdb-wasm`, `node-sql-parser`, `zustand`, `lucide-react`, `vitest`.

## Global Constraints

- OS: Linux
- Branch: `feature/phase-3`
- Dark theme palette matching `#0B0D10` base, `#111418` primary surface, `#7C9CFF` accent.
- Scope selection tabs for CTE debugging.
- Interactive physical operator node tree for DuckDB `EXPLAIN`.

---

### Task 1: Type Extensions for Phase 3 Data Structures

**Files:**
- Modify: `src/types/index.ts`
- Test: `src/__tests__/types.test.ts`

**Interfaces:**
- Consumes: Existing `ExecutionEvent` and `ExecutionPlan` definitions.
- Produces: `SubqueryResolution`, `CteScope`, `ExplainNode`, and updated `ExecutionPlan` / `ExecutionEvent`.

- [ ] **Step 1: Write failing test for Phase 3 types**

Update `src/__tests__/types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { SubqueryResolution, CteScope, ExplainNode, ExecutionPlan } from '../types';

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
      query: 'SELECT director_id FROM directors WHERE nationality = \'American\'',
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
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/types.test.ts`
Expected: FAIL with `SubqueryResolution not exported`

- [ ] **Step 3: Update src/types/index.ts**

Update `src/types/index.ts` to append Phase 3 interfaces:
```typescript
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

// Extend ExecutionEvent
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

// Extend ExecutionPlan
export interface ExecutionPlan {
  query: string;
  stages: OperationType[];
  events: ExecutionEvent[];
  finalResult: DataRow[];
  columns: string[];
  cteScopes?: CteScope[];
  explainTree?: ExplainNode;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/__tests__/types.test.ts
git commit -m "feat(types): add CteScope, SubqueryResolution, and ExplainNode interfaces for Phase 3"
```

---

### Task 2: Execution Recorder Extensions for CTE Scope Partitioning

**Files:**
- Modify: `src/debugger/executionRecorder.ts`
- Test: `src/__tests__/executionRecorder.test.ts`

**Interfaces:**
- Consumes: AST `with` array from `node-sql-parser` and `executeQuery()` from DuckDB WASM.
- Produces: `cteScopes` array in `ExecutionPlan`.

- [ ] **Step 1: Write failing test for CTE scope recording**

Update `src/__tests__/executionRecorder.test.ts`:
```typescript
describe('Phase 3 CTE Scope Recording', () => {
  it('should record isolated CTE scopes for WITH clause queries', async () => {
    const sql = `
      WITH top_movies AS (
        SELECT movie_id, title FROM movies WHERE release_year >= 2010
      )
      SELECT tm.title, r.score
      FROM top_movies tm
      JOIN reviews r ON r.movie_id = tm.movie_id;
    `;
    const plan = await recordQueryExecution(sql);

    expect(plan.cteScopes).toBeDefined();
    expect(plan.cteScopes?.length).toBe(1);
    expect(plan.cteScopes![0].aliasName).toBe('top_movies');
    expect(plan.cteScopes![0].outputRows.length).toBeGreaterThan(0);
    expect(plan.cteScopes![0].events.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/executionRecorder.test.ts`
Expected: FAIL with `plan.cteScopes is undefined`

- [ ] **Step 3: Update src/debugger/executionRecorder.ts**

Update `recordQueryExecution()` in `src/debugger/executionRecorder.ts`:
- Parse `with` block from AST (`astObj.with`).
- For each CTE entry:
  - Extract CTE name `cteName = cte.name.value` or `cte.name`.
  - Extract CTE inner query SQL `cteSql`.
  - Execute `recordQueryExecution(cteSql)` recursively or build its events pipeline.
  - Run `CREATE TEMP TABLE ${cteName} AS (${cteSql})` on DuckDB WASM.
  - Store resulting `CteScope` into `cteScopes`.

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/executionRecorder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/debugger/executionRecorder.ts src/__tests__/executionRecorder.test.ts
git commit -m "feat(debugger): record CTE scopes and register temporary tables in DuckDB WASM"
```

---

### Task 3: Execution Recorder Extensions for Subquery Resolution

**Files:**
- Modify: `src/debugger/executionRecorder.ts`
- Test: `src/__tests__/executionRecorder.test.ts`

**Interfaces:**
- Consumes: AST predicate expressions with nested subqueries.
- Produces: `subqueryResolutions` in `ExecutionEvent`.

- [ ] **Step 1: Write failing test for subquery resolution**

Update `src/__tests__/executionRecorder.test.ts`:
```typescript
describe('Phase 3 Subquery Recording', () => {
  it('should record scalar and set subquery resolutions', async () => {
    const sql = `
      SELECT title, release_year
      FROM movies
      WHERE movie_id IN (SELECT movie_id FROM reviews WHERE score >= 8.5);
    `;
    const plan = await recordQueryExecution(sql);
    const whereEvent = plan.events.find((e) => e.stage === 'WHERE');

    expect(whereEvent).toBeDefined();
    expect(whereEvent?.subqueryResolutions).toBeDefined();
    expect(whereEvent?.subqueryResolutions!.length).toBeGreaterThan(0);
    expect(whereEvent?.subqueryResolutions![0].type).toBe('set');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/executionRecorder.test.ts`
Expected: FAIL with `subqueryResolutions is undefined`

- [ ] **Step 3: Update src/debugger/executionRecorder.ts**

Inside `recordQueryExecution()`:
- Inspect `WHERE` and `HAVING` predicate expressions for subqueries (`IN (SELECT ...)`, `EXISTS (SELECT ...)`, `(SELECT ...)`).
- Execute subqueries on DuckDB WASM to capture their evaluated scalar or set results.
- Create `SubqueryResolution` objects and attach to `ExecutionEvent.subqueryResolutions`.

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/executionRecorder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/debugger/executionRecorder.ts src/__tests__/executionRecorder.test.ts
git commit -m "feat(debugger): resolve and record scalar, set, and exists subqueries"
```

---

### Task 4: DuckDB WASM EXPLAIN Tree Parser & Execution Recorder Extension

**Files:**
- Modify: `src/debugger/executionRecorder.ts`
- Test: `src/__tests__/executionRecorder.test.ts`

**Interfaces:**
- Consumes: DuckDB WASM `EXPLAIN <sql>` raw output.
- Produces: `explainTree` (`ExplainNode`) in `ExecutionPlan`.

- [ ] **Step 1: Write failing test for EXPLAIN tree parsing**

Update `src/__tests__/executionRecorder.test.ts`:
```typescript
describe('Phase 3 EXPLAIN Tree Recording', () => {
  it('should execute EXPLAIN and build ExplainNode AST tree', async () => {
    const sql = `SELECT m.title, r.score FROM movies m JOIN reviews r ON r.movie_id = m.movie_id;`;
    const plan = await recordQueryExecution(sql);

    expect(plan.explainTree).toBeDefined();
    expect(plan.explainTree?.operatorType).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/executionRecorder.test.ts`
Expected: FAIL with `plan.explainTree is undefined`

- [ ] **Step 3: Implement EXPLAIN tree parser in src/debugger/executionRecorder.ts**

- Execute `const explainRes = await executeQuery("EXPLAIN " + query);`.
- Parse text formatting or plan structure returned by DuckDB WASM into hierarchical `ExplainNode` trees.

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/executionRecorder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/debugger/executionRecorder.ts src/__tests__/executionRecorder.test.ts
git commit -m "feat(debugger): parse DuckDB WASM EXPLAIN output into ExplainNode AST tree"
```

---

### Task 5: `<CteVisualizer />` Scope Tab Bar & Canvas Component

**Files:**
- Create: `src/visualizer/CteVisualizer.tsx`
- Test: `src/__tests__/CteVisualizer.test.tsx`

**Interfaces:**
- Consumes: `CteScope[]`, active scope selection handler.
- Produces: `<CteVisualizer />` component with scope tabs and CTE output preview.

- [ ] **Step 1: Write failing test for CteVisualizer**

Create `src/__tests__/CteVisualizer.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CteVisualizer } from '../visualizer/CteVisualizer';
import { CteScope } from '../types';

describe('CteVisualizer Component', () => {
  const mockScopes: CteScope[] = [
    {
      id: 'cte-1',
      aliasName: 'top_directors',
      query: 'SELECT * FROM directors',
      events: [],
      outputRows: [{ name: 'Nolan' }]
    }
  ];

  it('renders scope tabs and CTE preview information', () => {
    render(<CteVisualizer scopes={mockScopes} activeScopeId="cte-1" onSelectScope={() => {}} />);
    expect(screen.getByText(/top_directors/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/CteVisualizer.test.tsx`
Expected: FAIL with `CteVisualizer not found`

- [ ] **Step 3: Implement CteVisualizer component**

Create `src/visualizer/CteVisualizer.tsx`:
- Render tab bar with `Main Query` and each `CteScope.aliasName`.
- Show active scope query snippet and output row count.

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/CteVisualizer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/visualizer/CteVisualizer.tsx src/__tests__/CteVisualizer.test.tsx
git commit -m "feat(visualizer): add CteVisualizer scope tab bar component"
```

---

### Task 6: `<SubqueryVisualizer />` Component & Predicate Tree Subquery Badges

**Files:**
- Create: `src/visualizer/SubqueryVisualizer.tsx`
- Test: `src/__tests__/SubqueryVisualizer.test.tsx`

**Interfaces:**
- Consumes: `SubqueryResolution[]`
- Produces: `<SubqueryVisualizer />` expandable card component.

- [ ] **Step 1: Write failing test for SubqueryVisualizer**

Create `src/__tests__/SubqueryVisualizer.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SubqueryVisualizer } from '../visualizer/SubqueryVisualizer';
import { SubqueryResolution } from '../types';

describe('SubqueryVisualizer Component', () => {
  const mockResolutions: SubqueryResolution[] = [
    {
      id: 'sub-1',
      type: 'scalar',
      rawQuery: 'SELECT AVG(score) FROM reviews',
      resolvedValue: 8.5,
      parentClause: 'WHERE'
    }
  ];

  it('renders subquery raw query and resolved value badge', () => {
    render(<SubqueryVisualizer resolutions={mockResolutions} />);
    expect(screen.getByText(/SELECT AVG\(score\)/i)).toBeDefined();
    expect(screen.getByText(/8.5/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/SubqueryVisualizer.test.tsx`
Expected: FAIL with `SubqueryVisualizer not found`

- [ ] **Step 3: Implement SubqueryVisualizer component**

Create `src/visualizer/SubqueryVisualizer.tsx`:
- Render subquery type badge (`SCALAR`, `SET (IN)`, `EXISTS`).
- Display raw SQL code snippet.
- Render resolved output value / set list in styled cards.

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/SubqueryVisualizer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/visualizer/SubqueryVisualizer.tsx src/__tests__/SubqueryVisualizer.test.tsx
git commit -m "feat(visualizer): add SubqueryVisualizer resolved value inspector component"
```

---

### Task 7: `<ExplainTreeVisualizer />` Interactive Operator Graph Component

**Files:**
- Create: `src/visualizer/ExplainTreeVisualizer.tsx`
- Test: `src/__tests__/ExplainTreeVisualizer.test.tsx`

**Interfaces:**
- Consumes: `ExplainNode` tree.
- Produces: `<ExplainTreeVisualizer />` physical operator node tree.

- [ ] **Step 1: Write failing test for ExplainTreeVisualizer**

Create `src/__tests__/ExplainTreeVisualizer.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ExplainTreeVisualizer } from '../visualizer/ExplainTreeVisualizer';
import { ExplainNode } from '../types';

describe('ExplainTreeVisualizer Component', () => {
  const mockTree: ExplainNode = {
    id: 'node-1',
    operatorType: 'HASH_JOIN',
    description: 'JOIN ON r.movie_id = m.movie_id',
    timingMs: 2.5,
    cardinality: 10,
    children: []
  };

  it('renders operator node cards and metrics', () => {
    render(<ExplainTreeVisualizer rootNode={mockTree} />);
    expect(screen.getByText(/HASH_JOIN/i)).toBeDefined();
    expect(screen.getByText(/2.5/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/ExplainTreeVisualizer.test.tsx`
Expected: FAIL with `ExplainTreeVisualizer not found`

- [ ] **Step 3: Implement ExplainTreeVisualizer component**

Create `src/visualizer/ExplainTreeVisualizer.tsx`:
- Render hierarchical tree of operator nodes.
- Color code operator types (`HASH_JOIN` purple, `SEQ_SCAN` cyan, `FILTER` amber, `AGGREGATE` emerald).
- Display timing (`durationMs`) and row cardinality metrics per operator.

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/ExplainTreeVisualizer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/visualizer/ExplainTreeVisualizer.tsx src/__tests__/ExplainTreeVisualizer.test.tsx
git commit -m "feat(visualizer): add ExplainTreeVisualizer physical plan graph component"
```

---

### Task 8: ExecutionVisualizer View Mode Switch & Phase 3 Visualizer Integration

**Files:**
- Modify: `src/visualizer/ExecutionVisualizer.tsx`
- Test: `src/__tests__/ExecutionVisualizer.test.tsx`

**Interfaces:**
- Consumes: `<CteVisualizer />`, `<SubqueryVisualizer />`, `<ExplainTreeVisualizer />`
- Produces: Integrated visualizer supporting CTE scope tabs and View Mode toggle switch (`[ Relational Pipeline | Physical EXPLAIN Tree ]`).

- [ ] **Step 1: Update src/visualizer/ExecutionVisualizer.tsx**

- Add state `viewMode: 'relational' | 'explain'`.
- Add state `activeCteScopeId: string | 'main'`.
- Render view mode toggle buttons in canvas header.
- Conditionally render `<ExplainTreeVisualizer />` when `viewMode === 'explain'`.
- Render `<CteVisualizer />` scope tabs and `<SubqueryVisualizer />` cards in relational pipeline view.

- [ ] **Step 2: Verify unit tests pass**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/visualizer/ExecutionVisualizer.tsx src/__tests__/ExecutionVisualizer.test.tsx
git commit -m "feat(visualizer): integrate Phase 3 CTE tabs, subquery cards, and EXPLAIN tree view"
```

---

### Task 9: End-to-End Phase 3 Integration Test Suite

**Files:**
- Create: `src/__tests__/phase3.test.ts`

**Interfaces:**
- Consumes: Full Phase 3 application stack.
- Produces: E2E verification of CTE, subquery, and EXPLAIN execution pipelines.

- [ ] **Step 1: Create Phase 3 Integration Test**

Create `src/__tests__/phase3.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase } from '../database/duckdb';
import { useWorkspaceStore } from '../state/useWorkspaceStore';

describe('Phase 3 E2E Integration Suite', () => {
  beforeAll(async () => {
    await resetDatabase();
    await useWorkspaceStore.getState().loadSchema();
  });

  it('should execute and record CTE, subquery, and EXPLAIN plan queries', async () => {
    const store = useWorkspaceStore.getState();
    store.setSql(`
      WITH top_movies AS (
        SELECT movie_id, title FROM movies WHERE release_year >= 2010
      )
      SELECT tm.title, AVG(r.score) AS average_score
      FROM top_movies tm
      JOIN reviews r ON r.movie_id = tm.movie_id
      WHERE r.movie_id IN (SELECT movie_id FROM reviews WHERE score >= 8)
      GROUP BY tm.title;
    `);

    await store.runQuery();

    const plan = useWorkspaceStore.getState().executionPlan;
    expect(plan).toBeDefined();
    expect(plan?.cteScopes).toBeDefined();
    expect(plan?.cteScopes!.length).toBeGreaterThan(0);
    expect(plan?.explainTree).toBeDefined();
  });
});
```

- [ ] **Step 2: Run full test suite & production build**

Run: `npm test && npm run build`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/phase3.test.ts
git commit -m "test(phase3): add end-to-end integration test suite for Phase 3"
```
