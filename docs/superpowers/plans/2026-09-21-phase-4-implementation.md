# Phase 4 Implementation Plan: Custom Data Import/Export, Visual Query Builder & History Profiler

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement custom file import (CSV, JSON, Parquet) via DuckDB WASM buffer registration, result data export, an interactive drag-and-drop Visual Query Builder synchronized with Monaco, and an IndexedDB-backed Query History, Snippets, and Performance Profiling panel.

**Architecture:** Extends `src/types/index.ts` with `CustomFileImport`, `QueryHistoryItem`, `SavedSnippet`, and `VisualQueryState`. `historyStore.ts` provides IndexedDB persistence for execution history and saved queries. `FileDropzone` loads files into DuckDB WASM via `registerFileBuffer` + auto-readers. `ResultGrid` provides CSV/JSON/Parquet file blob exports. `VisualQueryBuilder` renders interactive table nodes and join edges to generate clean SQL. `HistoryPanel` displays chronological execution runs and run comparison performance deltas.

**Tech Stack:** React 18, TypeScript 5, Vite, Tailwind CSS, `@duckdb/duckdb-wasm`, `node-sql-parser`, `zustand`, `lucide-react`, `vitest`.

## Global Constraints

- OS: Linux
- Branch: `feature/phase-4`
- Dark theme palette matching `#0B0D10` base, `#111418` primary surface, `#7C9CFF` accent.
- Drag-and-drop file import for CSV, JSON, Parquet.
- Real-time SQL synchronization in Visual Query Builder.

---

### Task 1: Type Extensions & IndexedDB History Store Infrastructure

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/storage/historyStore.ts`
- Test: `src/__tests__/types.test.ts`, `src/__tests__/historyStore.test.ts`

**Interfaces:**
- Consumes: Existing types.
- Produces: `CustomFileImport`, `QueryHistoryItem`, `SavedSnippet`, `VisualQueryState`, `ExportFormat`, and IndexedDB helper methods in `historyStore.ts`.

- [ ] **Step 1: Write failing test for Phase 4 types and historyStore**

Create `src/__tests__/historyStore.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { addHistoryItem, getHistoryItems, clearHistoryItems } from '../storage/historyStore';
import { QueryHistoryItem } from '../types';

describe('HistoryStore Infrastructure', () => {
  beforeEach(async () => {
    await clearHistoryItems();
  });

  it('should store and retrieve query history items', async () => {
    const item: QueryHistoryItem = {
      id: 'h-1',
      sql: 'SELECT * FROM movies;',
      timestamp: Date.now(),
      durationMs: 12.5,
      rowCount: 5,
      status: 'success'
    };

    await addHistoryItem(item);
    const items = await getHistoryItems();

    expect(items.length).toBe(1);
    expect(items[0].sql).toBe('SELECT * FROM movies;');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/historyStore.test.ts`
Expected: FAIL with `historyStore module not found`

- [ ] **Step 3: Update src/types/index.ts and create src/storage/historyStore.ts**

Update `src/types/index.ts` to add Phase 4 interfaces:
```typescript
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
```

Create `src/storage/historyStore.ts`:
- Implement IndexedDB database initialization (`sql_viewer_db`, store `history`).
- Provide `addHistoryItem`, `getHistoryItems`, `clearHistoryItems`, `saveSnippet`, `getSnippets`.

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/historyStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/storage/historyStore.ts src/__tests__/historyStore.test.ts
git commit -m "feat(storage): add Phase 4 interfaces and IndexedDB history store infrastructure"
```

---

### Task 2: Custom File Import Component & WASM Buffer Registration

**Files:**
- Create: `src/schema/FileDropzone.tsx`
- Modify: `src/database/duckdb.ts`
- Test: `src/__tests__/fileImport.test.ts`

**Interfaces:**
- Consumes: DuckDB WASM instance (`registerFileBuffer`, `executeQuery`).
- Produces: `<FileDropzone />` component registering CSV/JSON/Parquet files into DuckDB WASM state.

- [ ] **Step 1: Write failing test for file import**

Create `src/__tests__/fileImport.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { registerAndLoadFile } from '../database/duckdb';
import { resetDatabase } from '../database/duckdb';

describe('Custom Data File Import', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it('should register a CSV buffer and create a table in DuckDB WASM', async () => {
    const csvContent = 'id,name,score\n1,Alice,95\n2,Bob,88';
    const encoder = new TextEncoder();
    const buffer = encoder.encode(csvContent);

    const result = await registerAndLoadFile('students.csv', buffer, 'csv');

    expect(result.tableName).toBe('students');
    expect(result.rowCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/fileImport.test.ts`
Expected: FAIL with `registerAndLoadFile not exported`

- [ ] **Step 3: Update src/database/duckdb.ts & Create src/schema/FileDropzone.tsx**

Update `src/database/duckdb.ts`:
- Implement `registerAndLoadFile(fileName: string, buffer: Uint8Array, format: 'csv' | 'json' | 'parquet')`:
  - Sanitize `tableName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')`.
  - Call `db.registerFileBuffer(fileName, buffer)`.
  - Execute `CREATE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${fileName}')` (or `read_json_auto` / `read_parquet`).
  - Query row count and column metadata, return `CustomFileImport`.

Create `src/schema/FileDropzone.tsx`:
- Render dropzone area supporting drag-and-drop or file selection.
- Read file as `Uint8Array`, call `registerAndLoadFile`, and trigger schema reload callback.

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/fileImport.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/database/duckdb.ts src/schema/FileDropzone.tsx src/__tests__/fileImport.test.ts
git commit -m "feat(import): add custom CSV, JSON, and Parquet file import with WASM buffer registration"
```

---

### Task 3: Result Grid Data Export Toolbar Component

**Files:**
- Modify: `src/grid/ResultGrid.tsx`
- Test: `src/__tests__/ResultGrid.test.tsx`

**Interfaces:**
- Consumes: Current `rows` and `columns` in `ResultGrid`.
- Produces: CSV, JSON, and Parquet file download exporter.

- [ ] **Step 1: Write test for result grid export**

Update `src/__tests__/ResultGrid.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ResultGrid } from '../grid/ResultGrid';

describe('ResultGrid Export Toolbar', () => {
  it('renders export buttons for CSV, JSON, and Parquet', () => {
    render(<ResultGrid rows={[{ id: 1, name: 'Inception' }]} columns={['id', 'name']} />);
    expect(screen.getByText(/Export CSV/i)).toBeDefined();
    expect(screen.getByText(/Export JSON/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/ResultGrid.test.tsx`
Expected: FAIL with `Export CSV not found`

- [ ] **Step 3: Update src/grid/ResultGrid.tsx**

Add export toolbar to `ResultGrid`:
- Render export buttons (`Export CSV`, `Export JSON`, `Export Parquet`).
- Implement blob generators:
  - CSV: Format header and row values, create `Blob(['...'], { type: 'text/csv' })`, trigger download link.
  - JSON: Format `JSON.stringify(rows, null, 2)`, create `Blob(['...'], { type: 'application/json' })`, trigger download link.

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/ResultGrid.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/grid/ResultGrid.tsx src/__tests__/ResultGrid.test.tsx
git commit -m "feat(grid): add CSV, JSON, and Parquet data export toolbar to ResultGrid"
```

---

### Task 4: `<VisualQueryBuilder />` Canvas & AST Generator Component

**Files:**
- Create: `src/builder/VisualQueryBuilder.tsx`
- Test: `src/__tests__/VisualQueryBuilder.test.tsx`

**Interfaces:**
- Consumes: `Schema` tables, active `VisualQueryState`.
- Produces: `<VisualQueryBuilder />` React component generating SQL strings.

- [ ] **Step 1: Write failing test for VisualQueryBuilder**

Create `src/__tests__/VisualQueryBuilder.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisualQueryBuilder } from '../builder/VisualQueryBuilder';
import { Schema } from '../types';

describe('VisualQueryBuilder Component', () => {
  const mockSchema: Schema = {
    name: 'main',
    tables: [
      {
        name: 'movies',
        schema: 'main',
        columns: [{ name: 'movie_id', type: 'INTEGER' }, { name: 'title', type: 'VARCHAR' }]
      }
    ]
  };

  it('renders table selection and generates SQL syntax', () => {
    let generatedSql = '';
    render(<VisualQueryBuilder schema={mockSchema} onSqlChange={(sql) => { generatedSql = sql; }} />);

    expect(screen.getByText(/VISUAL QUERY BUILDER/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/VisualQueryBuilder.test.tsx`
Expected: FAIL with `VisualQueryBuilder not found`

- [ ] **Step 3: Implement VisualQueryBuilder component**

Create `src/builder/VisualQueryBuilder.tsx`:
- Render interactive table cards with column checkboxes.
- Provide table adder dropdown.
- Provide Join edge connector controls (`INNER`, `LEFT`, `RIGHT`, `FULL`).
- Provide Filter condition rows (`WHERE` clause).
- Build formatted SQL string and call `onSqlChange(sql)` on state update.

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/VisualQueryBuilder.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/builder/VisualQueryBuilder.tsx src/__tests__/VisualQueryBuilder.test.tsx
git commit -m "feat(builder): add VisualQueryBuilder drag-and-drop table and SQL generator component"
```

---

### Task 5: `<HistoryPanel />` Timeline, Saved Snippets & Performance Profiler

**Files:**
- Create: `src/history/HistoryPanel.tsx`
- Test: `src/__tests__/HistoryPanel.test.tsx`

**Interfaces:**
- Consumes: `QueryHistoryItem[]`, `SavedSnippet[]`.
- Produces: `<HistoryPanel />` timeline renderer and run performance comparison.

- [ ] **Step 1: Write failing test for HistoryPanel**

Create `src/__tests__/HistoryPanel.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { HistoryPanel } from '../history/HistoryPanel';
import { QueryHistoryItem } from '../types';

describe('HistoryPanel Component', () => {
  const mockHistory: QueryHistoryItem[] = [
    {
      id: 'h-1',
      sql: 'SELECT * FROM movies;',
      timestamp: Date.now(),
      durationMs: 15.2,
      rowCount: 10,
      status: 'success'
    }
  ];

  it('renders history timeline entries and duration metrics', () => {
    render(<HistoryPanel history={mockHistory} onSelectSql={() => {}} />);
    expect(screen.getByText(/SELECT \* FROM movies;/i)).toBeDefined();
    expect(screen.getByText(/15.2ms/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/HistoryPanel.test.tsx`
Expected: FAIL with `HistoryPanel not found`

- [ ] **Step 3: Implement HistoryPanel component**

Create `src/history/HistoryPanel.tsx`:
- Render timeline entries with status badges (`SUCCESS` green, `ERROR` red), execution timestamp, duration `ms`, and row count.
- Allow clicking entry to load SQL into workspace editor.
- Render Saved Snippets tab with tags and description.
- Provide Performance Profiler comparison drawer showing run time delta (`ms` difference and % speedup/slowdown).

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/HistoryPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/history/HistoryPanel.tsx src/__tests__/HistoryPanel.test.tsx
git commit -m "feat(history): add HistoryPanel timeline, saved snippets, and performance profiler component"
```

---

### Task 6: Main App Layout & Editor Header Mode Integration

**Files:**
- Modify: `src/App.tsx`, `src/schema/DatabaseExplorer.tsx`
- Test: `src/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: `<FileDropzone />`, `<VisualQueryBuilder />`, `<HistoryPanel />`.
- Produces: Complete Phase 4 integrated application UI.

- [ ] **Step 1: Update DatabaseExplorer and Main Workspace Layout**

Update `src/schema/DatabaseExplorer.tsx`:
- Render `<FileDropzone />` at the top of the schema tree sidebar.
- Add sidebar tabs: `[ Tables ] [ History & Snippets ]`.

Update `src/App.tsx`:
- Add center main workspace tab header: `[ Monaco SQL Editor | Visual Query Builder ]`.
- Conditionally render `<VisualQueryBuilder />` when Visual Builder tab is selected.
- Automatically record executed queries into `historyStore`.

- [ ] **Step 2: Verify unit tests pass**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/schema/DatabaseExplorer.tsx src/__tests__/App.test.tsx
git commit -m "feat(app): integrate FileDropzone, VisualQueryBuilder, and HistoryPanel into main layout"
```

---

### Task 7: End-to-End Phase 4 Integration Test Suite

**Files:**
- Create: `src/__tests__/phase4.test.ts`

**Interfaces:**
- Consumes: Complete Phase 4 application stack.
- Produces: E2E verification of custom file import, visual query builder, result export, and history profiling.

- [ ] **Step 1: Create Phase 4 Integration Test**

Create `src/__tests__/phase4.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, registerAndLoadFile } from '../database/duckdb';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { addHistoryItem, getHistoryItems } from '../storage/historyStore';

describe('Phase 4 E2E Integration Suite', () => {
  beforeAll(async () => {
    await resetDatabase();
    await useWorkspaceStore.getState().loadSchema();
  });

  it('should register custom file, build visual query, execute, and record history', async () => {
    // 1. Custom File Import
    const csvContent = 'id,product,price\n101,Laptop,1200\n102,Phone,800';
    const encoder = new TextEncoder();
    const buffer = encoder.encode(csvContent);
    const importRes = await registerAndLoadFile('products.csv', buffer, 'csv');

    expect(importRes.tableName).toBe('products');
    expect(importRes.rowCount).toBe(2);

    // 2. Run query on imported table
    const store = useWorkspaceStore.getState();
    store.setSql('SELECT * FROM products WHERE price > 1000;');
    await store.runQuery();

    const result = useWorkspaceStore.getState().resultRows;
    expect(result.length).toBe(1);
    expect(result[0].product).toBe('Laptop');

    // 3. Verify history recording
    await addHistoryItem({
      id: 'e2e-1',
      sql: 'SELECT * FROM products WHERE price > 1000;',
      timestamp: Date.now(),
      durationMs: 5.4,
      rowCount: 1,
      status: 'success'
    });

    const history = await getHistoryItems();
    expect(history.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run full test suite & production build**

Run: `npm test && npm run build`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/phase4.test.ts
git commit -m "test(phase4): add end-to-end integration test suite for Phase 4"
```
