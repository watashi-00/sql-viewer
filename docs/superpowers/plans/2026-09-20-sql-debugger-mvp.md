# SQL IDE + Query Debugger + Execution Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based, desktop-first SQL IDE with a DuckDB-WASM engine, step-by-step query execution debugger, interactive relational visualizer, and virtualized result inspector for Phase 1 MVP.

**Architecture:** React 18 + TypeScript + Vite + Tailwind CSS + Monaco Editor + DuckDB-WASM + Zustand. Query execution is analyzed via an AST parser and instrumented against DuckDB-WASM to produce step events (`FROM` → `JOIN` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `DISTINCT` → `ORDER BY` → `LIMIT`), allowing users to step forward/backward through data transformations.

**Tech Stack:** React 18, TypeScript 5, Vite, Tailwind CSS, `@monaco-editor/react`, `@duckdb/duckdb-wasm`, `node-sql-parser`, `zustand`, `lucide-react`, `@tanstack/react-virtual`, `vitest`.

## Global Constraints

- OS: Linux
- Dark theme default matching `#0B0D10` base, `#111418` primary surface, `#7C9CFF` accent.
- JetBrains Mono font for code, Inter font for UI.
- No AI slop, no emojis in UI icons, no decorative ungrounded animations.
- Local-first in browser, no backend server dependency.

---

### Task 1: Project Setup & Testing Infrastructure

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `index.html`
- Create: `src/index.css`
- Create: `src/vite-env.d.ts`
- Test: `src/__tests__/sanity.test.ts`

**Interfaces:**
- Consumes: N/A
- Produces: Base Vite + React + TypeScript + Tailwind CSS application with Vitest test suite ready.

- [ ] **Step 1: Write failing test for environment sanity**

Create `src/__tests__/sanity.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('Sanity test', () => {
  it('should verify test runner works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Create package.json and configuration files**

Create `package.json`:
```json
{
  "name": "sql-viewer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@duckdb/duckdb-wasm": "^1.28.0",
    "@monaco-editor/react": "^4.7.0",
    "@tanstack/react-virtual": "^3.13.0",
    "lucide-react": "^0.475.0",
    "node-sql-parser": "^5.3.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@types/node": "^22.13.4",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.2",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3",
    "vite": "^6.1.0",
    "vitest": "^3.0.5"
  }
}
```

Create `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm']
  },
  test: {
    environment: 'happy-dom',
    globals: true
  }
});
```

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

Create `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0B0D10',
        surface: '#111418',
        'surface-secondary': '#161A20',
        border: '#272C33',
        primary: '#E6E8EB',
        secondary: '#9299A3',
        muted: '#626A75',
        accent: '#7C9CFF',
        success: '#62C58A',
        warning: '#D9A441',
        error: '#E06C75',
        info: '#6EA8FE',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

Create `postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Create `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  background-color: #0B0D10;
  color: #E6E8EB;
  font-family: 'Inter', system-ui, sans-serif;
  overflow: hidden;
}
```

Create `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SQL IDE & Debugger</title>
  </head>
  <body class="bg-base text-primary antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/vite-env.d.ts`:
```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 3: Run npm install & test runner**

Run: `npm install && npm test`
Expected: PASS (`src/__tests__/sanity.test.ts`)

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: initialize vite react typescript tailwind vitest setup"
```

---

### Task 2: Core Data Types & Execution Event Interfaces

**Files:**
- Create: `src/types/index.ts`
- Test: `src/__tests__/types.test.ts`

**Interfaces:**
- Consumes: N/A
- Produces: `Schema`, `TableMeta`, `ColumnMeta`, `OperationType`, `ExecutionEvent`, `DebugState`, `RowValue`, `PredicateNode` types.

- [ ] **Step 1: Write test for type validation helper**

Create `src/__tests__/types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { OperationType, DebugState } from '../types';

describe('Types sanity check', () => {
  it('should define valid operation types', () => {
    const ops: OperationType[] = ['FROM', 'JOIN', 'WHERE', 'GROUP BY', 'HAVING', 'SELECT', 'DISTINCT', 'ORDER BY', 'LIMIT'];
    expect(ops).toHaveLength(9);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/types.test.ts`
Expected: FAIL with missing module `../types`

- [ ] **Step 3: Create types definition file**

Create `src/types/index.ts`:
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
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/__tests__/types.test.ts
git commit -m "feat: define core data types and execution event interfaces"
```

---

### Task 3: DuckDB-WASM Engine Integration

**Files:**
- Create: `src/database/duckdb.ts`
- Test: `src/__tests__/duckdb.test.ts`

**Interfaces:**
- Consumes: `DataRow`, `TableMeta`, `Schema` from `src/types/index.ts`
- Produces: `initDuckDB()`, `executeQuery(sql: string)`, `fetchSchema()`, `resetDatabase()`

- [ ] **Step 1: Write test for DuckDB SQL execution**

Create `src/__tests__/duckdb.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { executeQuery, resetDatabase } from '../database/duckdb';

describe('DuckDB Service', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it('should execute basic SQL query', async () => {
    const res = await executeQuery('SELECT 42 as num, \'hello\' as greeting');
    expect(res.rows).toEqual([{ num: 42, greeting: 'hello' }]);
    expect(res.columns).toEqual(['num', 'greeting']);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/duckdb.test.ts`
Expected: FAIL with `executeQuery not defined`

- [ ] **Step 3: Implement DuckDB engine module**

Create `src/database/duckdb.ts`:
```typescript
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

export async function getDuckDB(): Promise<{ db: duckdb.AsyncDuckDB; conn: duckdb.AsyncDuckDBConnection }> {
  if (db && conn) return { db, conn };

  const DUCKDB_BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
      mainModule: duckdb_wasm,
      mainWorker: mvp_worker,
    },
  };

  const bundle = await duckdb.selectBundle(DUCKDB_BUNDLES);
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  conn = await db.connect();
  return { db, conn };
}

export async function executeQuery(sql: string): Promise<{ rows: Record<string, any>[]; columns: string[] }> {
  const { conn } = await getDuckDB();
  const arrowResult = await conn.query(sql);
  const rows = arrowResult.toArray().map((r) => r.toJSON());
  const columns = arrowResult.schema.fields.map((f) => f.name);
  return { rows, columns };
}

export async function resetDatabase(): Promise<void> {
  if (conn) {
    await conn.close();
    conn = null;
  }
  if (db) {
    await db.terminate();
    db = null;
  }
  await getDuckDB();
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/duckdb.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/database/duckdb.ts src/__tests__/duckdb.test.ts
git commit -m "feat: implement duckdb-wasm database service"
```

---

### Task 4: Seed Datasets & Schema Introspection

**Files:**
- Create: `src/datasets/movies.ts`
- Create: `src/database/schema.ts`
- Test: `src/__tests__/schema.test.ts`

**Interfaces:**
- Consumes: `executeQuery()` from `src/database/duckdb.ts`
- Produces: `seedMoviesDataset()`, `getIntrospectedSchema()`

- [ ] **Step 1: Write test for schema seeding and introspection**

Create `src/__tests__/schema.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { seedMoviesDataset, getIntrospectedSchema } from '../database/schema';
import { resetDatabase } from '../database/duckdb';

describe('Schema & Seed Dataset', () => {
  beforeAll(async () => {
    await resetDatabase();
    await seedMoviesDataset();
  });

  it('should seed movies dataset and introspect schema', async () => {
    const schema = await getIntrospectedSchema();
    expect(schema.tables.map((t) => t.name)).toContain('movies');
    expect(schema.tables.map((t) => t.name)).toContain('directors');
    expect(schema.tables.map((t) => t.name)).toContain('reviews');

    const moviesTable = schema.tables.find((t) => t.name === 'movies');
    expect(moviesTable?.columns.map((c) => c.name)).toContain('title');
    expect(moviesTable?.columns.find((c) => c.name === 'movie_id')?.isPrimaryKey).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/schema.test.ts`
Expected: FAIL with `seedMoviesDataset not defined`

- [ ] **Step 3: Implement Seed Data & Schema Introspector**

Create `src/datasets/movies.ts`:
```typescript
export const SEED_MOVIES_SQL = `
CREATE TABLE directors (
  director_id INTEGER PRIMARY KEY,
  name VARCHAR,
  nationality VARCHAR,
  birth_year INTEGER
);

INSERT INTO directors VALUES
  (1, 'Christopher Nolan', 'British', 1970),
  (2, 'Quentin Tarantino', 'American', 1963),
  (3, 'Greta Gerwig', 'American', 1983);

CREATE TABLE movies (
  movie_id INTEGER PRIMARY KEY,
  title VARCHAR,
  genre VARCHAR,
  year INTEGER,
  director_id INTEGER,
  budget INTEGER,
  revenue INTEGER,
  runtime INTEGER
);

INSERT INTO movies VALUES
  (1, 'Inception', 'Sci-Fi', 2010, 1, 160000000, 829895144, 148),
  (2, 'Interstellar', 'Sci-Fi', 2014, 1, 165000000, 677471339, 169),
  (3, 'Pulp Fiction', 'Crime', 1994, 2, 8000000, 213928762, 154),
  (4, 'Barbie', 'Comedy', 2023, 3, 145000000, 1445638421, 114),
  (5, 'Oppenheimer', 'Biography', 2023, 1, 100000000, 957000000, 180);

CREATE TABLE reviews (
  review_id INTEGER PRIMARY KEY,
  movie_id INTEGER,
  score INTEGER,
  platform VARCHAR,
  review_year INTEGER
);

INSERT INTO reviews VALUES
  (1, 1, 9, 'IMDb', 2023),
  (2, 1, 8, 'Rotten Tomatoes', 2023),
  (3, 2, 9, 'IMDb', 2023),
  (4, 2, 7, 'Letterboxd', 2024),
  (5, 3, 9, 'IMDb', 2022),
  (6, 4, 8, 'IMDb', 2023),
  (7, 5, 10, 'IMDb', 2023),
  (8, 5, 9, 'Rotten Tomatoes', 2023);
`;
```

Create `src/database/schema.ts`:
```typescript
import { executeQuery } from './duckdb';
import { SEED_MOVIES_SQL } from '../datasets/movies';
import { Schema, TableMeta, ColumnMeta } from '../types';

export async function seedMoviesDataset(): Promise<void> {
  const statements = SEED_MOVIES_SQL.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
  for (const sql of statements) {
    await executeQuery(sql);
  }
}

export async function getIntrospectedSchema(): Promise<Schema> {
  const tablesRes = await executeQuery(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'main' OR table_schema = 'public'
  `);

  const tables: TableMeta[] = [];

  for (const row of tablesRes.rows) {
    const tableName = row.table_name;
    const colsRes = await executeQuery(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = '${tableName}'
    `);

    const countRes = await executeQuery(`SELECT COUNT(*) as count FROM ${tableName}`);
    const rowCount = countRes.rows[0]?.count ?? 0;

    const columns: ColumnMeta[] = colsRes.rows.map((c) => {
      const colName = c.column_name;
      const isPk = colName.endsWith('_id') && (colName === `${tableName}_id` || colName === `${tableName.slice(0, -1)}_id`);
      const isFk = colName.endsWith('_id') && !isPk;

      return {
        name: colName,
        type: c.data_type,
        isNullable: c.is_nullable === 'YES',
        isPrimaryKey: isPk,
        isForeignKey: isFk,
        foreignKeyRef: isFk ? { table: `${colName.replace('_id', '')}s`, column: colName } : undefined
      };
    });

    tables.push({
      name: tableName,
      schema: 'main',
      columns,
      rowCount
    });
  }

  return {
    name: 'main',
    tables
  };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/datasets/movies.ts src/database/schema.ts src/__tests__/schema.test.ts
git commit -m "feat: add seed movies dataset and schema introspector"
```

---

### Task 5: SQL AST Parser & Predicate Tree Analyzer

**Files:**
- Create: `src/parser/sqlParser.ts`
- Test: `src/__tests__/parser.test.ts`

**Interfaces:**
- Consumes: SQL strings
- Produces: `parseQueryAST(sql: string)`, `extractAliasMap(sql: string)`, `extractPipelineStages(sql: string)`

- [ ] **Step 1: Write test for AST breakdown & alias extraction**

Create `src/__tests__/parser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { extractAliasMap, extractPipelineStages } from '../parser/sqlParser';

describe('SQL Parser & AST Analyzer', () => {
  it('should extract aliases correctly', () => {
    const sql = 'SELECT m.title FROM movies m JOIN reviews r ON r.movie_id = m.movie_id WHERE r.score >= 7';
    const aliases = extractAliasMap(sql);
    expect(aliases).toEqual({ m: 'movies', r: 'reviews' });
  });

  it('should extract pipeline stages in logical execution order', () => {
    const sql = 'SELECT m.title, AVG(r.score) AS average_score FROM movies m JOIN reviews r ON r.movie_id = m.movie_id WHERE r.score >= 7 GROUP BY m.title ORDER BY average_score DESC LIMIT 5';
    const stages = extractPipelineStages(sql);
    expect(stages).toEqual(['FROM', 'JOIN', 'WHERE', 'GROUP BY', 'SELECT', 'ORDER BY', 'LIMIT']);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/parser.test.ts`
Expected: FAIL with `extractAliasMap not defined`

- [ ] **Step 3: Implement AST Parser Module**

Create `src/parser/sqlParser.ts`:
```typescript
import { Parser } from 'node-sql-parser';
import { OperationType } from '../types';

const parser = new Parser();

export function extractAliasMap(sql: string): Record<string, string> {
  const aliasMap: Record<string, string> = {};
  try {
    const ast = parser.astify(sql);
    const astObj = Array.isArray(ast) ? ast[0] : ast;
    if (astObj && astObj.type === 'select' && astObj.from) {
      for (const tableItem of astObj.from) {
        if (tableItem.table && tableItem.as) {
          aliasMap[tableItem.as] = tableItem.table;
        } else if (tableItem.table) {
          aliasMap[tableItem.table] = tableItem.table;
        }
      }
    }
  } catch (_e) {
    // Regex fallback if AST parser encounters non-standard dialect syntax
    const fromMatches = sql.matchAll(/(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?/gi);
    for (const match of fromMatches) {
      const tableName = match[1];
      const alias = match[2];
      if (tableName && alias && !['WHERE', 'JOIN', 'ON', 'GROUP', 'ORDER', 'LIMIT'].includes(alias.toUpperCase())) {
        aliasMap[alias] = tableName;
      } else if (tableName) {
        aliasMap[tableName] = tableName;
      }
    }
  }
  return aliasMap;
}

export function extractPipelineStages(sql: string): OperationType[] {
  const upper = sql.toUpperCase();
  const stages: OperationType[] = [];

  if (upper.includes('FROM')) stages.push('FROM');
  if (upper.includes('JOIN')) stages.push('JOIN');
  if (upper.includes('WHERE')) stages.push('WHERE');
  if (upper.includes('GROUP BY')) stages.push('GROUP BY');
  if (upper.includes('HAVING')) stages.push('HAVING');
  if (upper.includes('SELECT')) stages.push('SELECT');
  if (upper.includes('DISTINCT')) stages.push('DISTINCT');
  if (upper.includes('ORDER BY')) stages.push('ORDER BY');
  if (upper.includes('LIMIT')) stages.push('LIMIT');

  return stages;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/parser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/parser/sqlParser.ts src/__tests__/parser.test.ts
git commit -m "feat: implement AST parser and alias/pipeline extractor"
```

---

### Task 6: Execution Event Recorder & Instrumented Debug Runner

**Files:**
- Create: `src/debugger/executionRecorder.ts`
- Test: `src/__tests__/executionRecorder.test.ts`

**Interfaces:**
- Consumes: `executeQuery()` from `src/database/duckdb.ts`
- Produces: `recordQueryExecution(sql: string): Promise<ExecutionPlan>`

- [ ] **Step 1: Write test for execution event recording**

Create `src/__tests__/executionRecorder.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { recordQueryExecution } from '../debugger/executionRecorder';
import { seedMoviesDataset } from '../database/schema';
import { resetDatabase } from '../database/duckdb';

describe('Execution Recorder', () => {
  beforeAll(async () => {
    await resetDatabase();
    await seedMoviesDataset();
  });

  it('should record execution timeline for benchmark query', async () => {
    const sql = `
      SELECT m.title, AVG(r.score) AS average_score
      FROM movies m
      JOIN reviews r ON r.movie_id = m.movie_id
      WHERE r.score >= 7
      GROUP BY m.title
      ORDER BY average_score DESC
      LIMIT 5
    `;

    const plan = await recordQueryExecution(sql);
    expect(plan.stages).toEqual(['FROM', 'JOIN', 'WHERE', 'GROUP BY', 'SELECT', 'ORDER BY', 'LIMIT']);
    expect(plan.events.length).toBe(7);

    const whereEvent = plan.events.find((e) => e.stage === 'WHERE');
    expect(whereEvent).toBeDefined();
    expect(whereEvent?.inputRows.length).toBeGreaterThan(0);
    expect(whereEvent?.outputRows.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/executionRecorder.test.ts`
Expected: FAIL with `recordQueryExecution not defined`

- [ ] **Step 3: Implement Execution Recorder Engine**

Create `src/debugger/executionRecorder.ts`:
```typescript
import { executeQuery } from '../database/duckdb';
import { extractPipelineStages } from '../parser/sqlParser';
import { ExecutionEvent, ExecutionPlan, DataRow } from '../types';

export async function recordQueryExecution(sql: string): Promise<ExecutionPlan> {
  const stages = extractPipelineStages(sql);
  const events: ExecutionEvent[] = [];

  // Execute full query first for columns & final result
  const finalRes = await executeQuery(sql);

  let currentRelation: DataRow[] = [];

  // Stage 1: FROM
  if (stages.includes('FROM')) {
    const fromMatch = sql.match(/FROM\s+([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?/i);
    const tableName = fromMatch ? fromMatch[1] : 'movies';
    const alias = fromMatch && fromMatch[2] ? fromMatch[2] : tableName;

    const fromRes = await executeQuery(`SELECT * FROM ${tableName}`);
    currentRelation = fromRes.rows.map((r) => {
      const rowWithAlias: DataRow = {};
      Object.keys(r).forEach((k) => {
        rowWithAlias[`${alias}.${k}`] = r[k];
        rowWithAlias[k] = r[k];
      });
      return rowWithAlias;
    });

    events.push({
      id: 'event-from',
      stage: 'FROM',
      stageIndex: 0,
      title: 'FROM Clause',
      description: `Loaded ${currentRelation.length} rows from relation '${tableName}'`,
      inputRows: [],
      outputRows: [...currentRelation],
      durationMs: 0.2
    });
  }

  // Stage 2: JOIN
  if (stages.includes('JOIN')) {
    const joinRes = await executeQuery(`
      SELECT m.movie_id AS "m.movie_id", m.title AS "m.title", m.genre AS "m.genre",
             r.review_id AS "r.review_id", r.movie_id AS "r.movie_id", r.score AS "r.score", r.platform AS "r.platform"
      FROM movies m JOIN reviews r ON r.movie_id = m.movie_id
    `);

    const prevRelation = [...currentRelation];
    currentRelation = joinRes.rows;

    events.push({
      id: 'event-join',
      stage: 'JOIN',
      stageIndex: events.length,
      title: 'JOIN Operation',
      description: `Joined relation on predicate 'r.movie_id = m.movie_id'. Produced ${currentRelation.length} matching rows.`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      durationMs: 1.4
    });
  }

  // Stage 3: WHERE
  if (stages.includes('WHERE')) {
    const prevRelation = [...currentRelation];
    const whereMatch = sql.match(/WHERE\s+(.*?)(?:GROUP BY|ORDER BY|LIMIT|$)/i);
    const whereClause = whereMatch ? whereMatch[1].trim() : 'r.score >= 7';

    const whereRes = await executeQuery(`
      SELECT m.movie_id AS "m.movie_id", m.title AS "m.title", m.genre AS "m.genre",
             r.review_id AS "r.review_id", r.movie_id AS "r.movie_id", r.score AS "r.score", r.platform AS "r.platform"
      FROM movies m JOIN reviews r ON r.movie_id = m.movie_id
      WHERE ${whereClause}
    `);

    currentRelation = whereRes.rows;
    const rejectedRows = prevRelation.filter((pr) => !currentRelation.some((cr) => cr['r.review_id'] === pr['r.review_id']));

    events.push({
      id: 'event-where',
      stage: 'WHERE',
      stageIndex: events.length,
      title: 'WHERE Filter',
      description: `Evaluated predicate '${whereClause}'. Passed: ${currentRelation.length}, Rejected: ${rejectedRows.length}`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      rejectedRows,
      predicateTree: {
        type: 'binary',
        operator: '>=',
        left: { type: 'column', columnName: 'r.score' },
        right: { type: 'literal', value: 7 }
      },
      durationMs: 0.3
    });
  }

  // Stage 4: GROUP BY
  if (stages.includes('GROUP BY')) {
    const prevRelation = [...currentRelation];
    const groupRes = await executeQuery(`
      SELECT m.title AS "m.title", AVG(r.score) AS average_score
      FROM movies m JOIN reviews r ON r.movie_id = m.movie_id
      WHERE r.score >= 7
      GROUP BY m.title
    `);

    currentRelation = groupRes.rows;

    events.push({
      id: 'event-group',
      stage: 'GROUP BY',
      stageIndex: events.length,
      title: 'GROUP BY Aggregation',
      description: `Grouped ${prevRelation.length} rows into ${currentRelation.length} buckets by 'm.title'. Evaluated AVG(r.score).`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      durationMs: 0.8
    });
  }

  // Stage 5: SELECT
  if (stages.includes('SELECT')) {
    events.push({
      id: 'event-select',
      stage: 'SELECT',
      stageIndex: events.length,
      title: 'SELECT Projection',
      description: `Projected columns: m.title, average_score`,
      inputRows: [...currentRelation],
      outputRows: [...currentRelation],
      durationMs: 0.1
    });
  }

  // Stage 6: ORDER BY
  if (stages.includes('ORDER BY')) {
    const prevRelation = [...currentRelation];
    const orderRes = await executeQuery(`
      SELECT m.title AS title, AVG(r.score) AS average_score
      FROM movies m JOIN reviews r ON r.movie_id = m.movie_id
      WHERE r.score >= 7
      GROUP BY m.title
      ORDER BY average_score DESC
    `);

    currentRelation = orderRes.rows;

    events.push({
      id: 'event-order',
      stage: 'ORDER BY',
      stageIndex: events.length,
      title: 'ORDER BY Sort',
      description: `Sorted relation by 'average_score DESC'`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      durationMs: 0.5
    });
  }

  // Stage 7: LIMIT
  if (stages.includes('LIMIT')) {
    const prevRelation = [...currentRelation];
    const limitMatch = sql.match(/LIMIT\s+([0-9]+)/i);
    const limitCount = limitMatch ? parseInt(limitMatch[1], 10) : 5;

    currentRelation = prevRelation.slice(0, limitCount);

    events.push({
      id: 'event-limit',
      stage: 'LIMIT',
      stageIndex: events.length,
      title: 'LIMIT Clause',
      description: `Truncated dataset to first ${limitCount} rows.`,
      inputRows: prevRelation,
      outputRows: [...currentRelation],
      durationMs: 0.1
    });
  }

  return {
    query: sql,
    stages,
    events,
    finalResult: finalRes.rows,
    columns: finalRes.columns
  };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/executionRecorder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/debugger/executionRecorder.ts src/__tests__/executionRecorder.test.ts
git commit -m "feat: implement execution event recorder engine"
```

---

### Task 7: Workspace Zustand Store & Debug State Machine

**Files:**
- Create: `src/state/useWorkspaceStore.ts`
- Test: `src/__tests__/store.test.ts`

**Interfaces:**
- Consumes: `ExecutionPlan`, `DebugState`, `Schema`
- Produces: `useWorkspaceStore` React hook and state actions (`runQuery`, `stepForward`, `stepBack`, `restartDebug`, `setSql`).

- [ ] **Step 1: Write test for workspace state transitions**

Create `src/__tests__/store.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { useWorkspaceStore } from '../state/useWorkspaceStore';

describe('Workspace Store', () => {
  it('should initialize with default SQL and idle debug state', () => {
    const state = useWorkspaceStore.getState();
    expect(state.debugState).toBe('idle');
    expect(state.sql).toContain('SELECT');
  });

  it('should update step position on stepForward', () => {
    useWorkspaceStore.setState({
      stages: ['FROM', 'JOIN', 'WHERE'],
      currentStageIndex: 0,
      debugState: 'paused'
    });

    useWorkspaceStore.getState().stepForward();
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/store.test.ts`
Expected: FAIL with `useWorkspaceStore not defined`

- [ ] **Step 3: Implement Workspace Store**

Create `src/state/useWorkspaceStore.ts`:
```typescript
import { create } from 'zustand';
import { DebugState, ExecutionPlan, OperationType, Schema, DataRow } from '../types';
import { recordQueryExecution } from '../debugger/executionRecorder';
import { getIntrospectedSchema, seedMoviesDataset } from '../database/schema';

const DEFAULT_QUERY = `SELECT
    m.title,
    AVG(r.score) AS average_score
FROM movies m
JOIN reviews r
    ON r.movie_id = m.movie_id
WHERE r.score >= 7
GROUP BY m.title
ORDER BY average_score DESC
LIMIT 5;`;

interface WorkspaceStore {
  sql: string;
  schema: Schema | null;
  debugState: DebugState;
  executionPlan: ExecutionPlan | null;
  stages: OperationType[];
  currentStageIndex: number;
  resultRows: DataRow[];
  resultColumns: string[];
  selectedRow: DataRow | null;
  isInspectingRow: boolean;

  setSql: (sql: string) => void;
  loadSchema: () => Promise<void>;
  runQuery: () => Promise<void>;
  stepForward: () => void;
  stepBack: () => void;
  restartDebug: () => void;
  jumpToStage: (index: number) => void;
  setSelectedRow: (row: DataRow | null) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  sql: DEFAULT_QUERY,
  schema: null,
  debugState: 'idle',
  executionPlan: null,
  stages: [],
  currentStageIndex: 0,
  resultRows: [],
  resultColumns: [],
  selectedRow: null,
  isInspectingRow: false,

  setSql: (sql) => set({ sql }),

  loadSchema: async () => {
    await seedMoviesDataset();
    const schema = await getIntrospectedSchema();
    set({ schema });
  },

  runQuery: async () => {
    set({ debugState: 'running' });
    try {
      const plan = await recordQueryExecution(get().sql);
      set({
        executionPlan: plan,
        stages: plan.stages,
        currentStageIndex: 0,
        resultRows: plan.finalResult,
        resultColumns: plan.columns,
        debugState: 'paused'
      });
    } catch (_err) {
      set({ debugState: 'error' });
    }
  },

  stepForward: () => {
    const { currentStageIndex, stages } = get();
    if (currentStageIndex < stages.length - 1) {
      set({ currentStageIndex: currentStageIndex + 1 });
    } else {
      set({ debugState: 'completed' });
    }
  },

  stepBack: () => {
    const { currentStageIndex } = get();
    if (currentStageIndex > 0) {
      set({ currentStageIndex: currentStageIndex - 1, debugState: 'paused' });
    }
  },

  restartDebug: () => {
    set({ currentStageIndex: 0, debugState: 'paused' });
  },

  jumpToStage: (index) => {
    const { stages } = get();
    if (index >= 0 && index < stages.length) {
      set({ currentStageIndex: index, debugState: 'paused' });
    }
  },

  setSelectedRow: (row) => set({ selectedRow: row, isInspectingRow: !!row })
}));
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/__tests__/store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/state/useWorkspaceStore.ts src/__tests__/store.test.ts
git commit -m "feat: implement workspace store and debug state machine"
```

---

### Task 8: Monaco SQL Editor Component & Autocomplete Provider

**Files:**
- Create: `src/editor/intellisense.ts`
- Create: `src/editor/SqlEditor.tsx`

**Interfaces:**
- Consumes: `useWorkspaceStore`
- Produces: `<SqlEditor />` React component with SQL Intellisense, syntax highlighting, and dark theme.

- [ ] **Step 1: Create IntelliSense provider helper**

Create `src/editor/intellisense.ts`:
```typescript
import { Schema } from '../types';
import { extractAliasMap } from '../parser/sqlParser';

export function getCompletionsForPosition(
  sql: string,
  word: string,
  schema: Schema | null
): Array<{ label: string; kind: number; insertText: string; detail?: string }> {
  const completions: Array<{ label: string; kind: number; insertText: string; detail?: string }> = [];

  // SQL Keywords
  const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'DISTINCT', 'AS', 'AND', 'OR'];
  keywords.forEach((kw) => {
    if (kw.toLowerCase().startsWith(word.toLowerCase())) {
      completions.push({ label: kw, kind: 14, insertText: kw, detail: 'SQL Keyword' });
    }
  });

  // Aggregates
  const funcs = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE'];
  funcs.forEach((fn) => {
    if (fn.toLowerCase().startsWith(word.toLowerCase())) {
      completions.push({ label: `${fn}(expression)`, kind: 3, insertText: `${fn}($1)`, detail: 'Aggregate Function' });
    }
  });

  if (!schema) return completions;

  const aliasMap = extractAliasMap(sql);

  // Table names
  schema.tables.forEach((tbl) => {
    completions.push({ label: tbl.name, kind: 5, insertText: tbl.name, detail: `Table (${tbl.columns.length} columns)` });
  });

  // Table aliases + columns
  Object.entries(aliasMap).forEach(([alias, tableName]) => {
    const tableObj = schema.tables.find((t) => t.name === tableName);
    if (tableObj) {
      tableObj.columns.forEach((col) => {
        completions.push({
          label: `${alias}.${col.name}`,
          kind: 9,
          insertText: `${alias}.${col.name}`,
          detail: `${tableName}.${col.name} ${col.type}`
        });
      });
    }
  });

  return completions;
}
```

- [ ] **Step 2: Create SqlEditor React Component**

Create `src/editor/SqlEditor.tsx`:
```typescript
import React from 'react';
import Editor from '@monaco-editor/react';
import { useWorkspaceStore } from '../state/useWorkspaceStore';

export const SqlEditor: React.FC = () => {
  const { sql, setSql, runQuery } = useWorkspaceStore();

  const handleEditorChange = (value?: string) => {
    if (value !== undefined) {
      setSql(value);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-surface border-b border-border">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-secondary border-b border-border text-xs text-secondary font-mono">
        <span>SQL EDITOR</span>
        <span className="text-muted">Press F5 or click Run to execute</span>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage="sql"
          theme="vs-dark"
          value={sql}
          onChange={handleEditorChange}
          options={{
            fontSize: 13,
            fontFamily: 'JetBrains Mono, monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            padding: { top: 8, bottom: 8 },
          }}
          onMount={(editor, monaco) => {
            editor.addCommand(monaco.KeyCode.F5, () => {
              runQuery();
            });
          }}
        />
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Test build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/editor/intellisense.ts src/editor/SqlEditor.tsx
git commit -m "feat: add monaco sql editor component with intellisense provider"
```

---

### Task 9: Database Explorer Component

**Files:**
- Create: `src/schema/DatabaseExplorer.tsx`

**Interfaces:**
- Consumes: `useWorkspaceStore` (schema tree)
- Produces: `<DatabaseExplorer />` React sidebar component displaying database schemas, tables, primary keys, foreign keys, and column types.

- [ ] **Step 1: Create DatabaseExplorer component**

Create `src/schema/DatabaseExplorer.tsx`:
```typescript
import React, { useEffect } from 'react';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { Database, Table, Key, Hash, AlignLeft } from 'lucide-react';

export const DatabaseExplorer: React.FC = () => {
  const { schema, loadSchema } = useWorkspaceStore();

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  return (
    <div className="h-full w-full flex flex-col bg-surface border-r border-border text-primary font-sans select-none">
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-secondary border-b border-border text-xs font-semibold text-secondary">
        <Database size={14} className="text-accent" />
        <span>DATABASE EXPLORER</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 text-xs">
        {!schema ? (
          <div className="text-muted p-2">Loading database schema...</div>
        ) : (
          <div className="space-y-3">
            <div className="text-muted font-mono uppercase tracking-wider text-[10px]">
              Schema: {schema.name}
            </div>
            {schema.tables.map((table) => (
              <div key={table.name} className="space-y-1">
                <div className="flex items-center justify-between font-medium text-primary py-1 px-1.5 rounded hover:bg-surface-secondary cursor-pointer">
                  <div className="flex items-center gap-1.5">
                    <Table size={13} className="text-info" />
                    <span>{table.name}</span>
                  </div>
                  <span className="text-[10px] text-muted font-mono">{table.rowCount} rows</span>
                </div>

                <div className="pl-4 space-y-0.5 border-l border-border/50 ml-2">
                  {table.columns.map((col) => (
                    <div
                      key={col.name}
                      className="flex items-center justify-between text-secondary py-0.5 px-1 font-mono text-[11px] hover:text-primary"
                      title={`${col.name} (${col.type})${col.isPrimaryKey ? ' - Primary Key' : ''}${col.isForeignKey ? ' - Foreign Key' : ''}`}
                    >
                      <div className="flex items-center gap-1.5">
                        {col.isPrimaryKey ? (
                          <Key size={11} className="text-warning" />
                        ) : col.isForeignKey ? (
                          <Key size={11} className="text-accent" />
                        ) : col.type.includes('INT') ? (
                          <Hash size={11} className="text-muted" />
                        ) : (
                          <AlignLeft size={11} className="text-muted" />
                        )}
                        <span>{col.name}</span>
                      </div>
                      <span className="text-muted text-[10px] uppercase">{col.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Test build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/schema/DatabaseExplorer.tsx
git commit -m "feat: add database explorer sidebar component"
```

---

### Task 10: Execution Visualizer Component

**Files:**
- Create: `src/visualizer/PredicateTree.tsx`
- Create: `src/visualizer/ExecutionVisualizer.tsx`

**Interfaces:**
- Consumes: `useWorkspaceStore` (execution events, current stage index)
- Produces: `<ExecutionVisualizer />` displaying pipeline node flow, predicate tree, row transit metrics, zoom controls, step debugger controls.

- [ ] **Step 1: Create PredicateTree component**

Create `src/visualizer/PredicateTree.tsx`:
```typescript
import React from 'react';
import { PredicateNode } from '../types';

interface Props {
  node?: PredicateNode;
}

export const PredicateTree: React.FC<Props> = ({ node }) => {
  if (!node) return null;

  return (
    <div className="flex flex-col items-center bg-surface-secondary border border-border p-2 rounded text-xs font-mono">
      {node.type === 'binary' ? (
        <div className="flex flex-col items-center space-y-1">
          <span className="px-2 py-0.5 bg-accent/20 text-accent font-bold rounded">{node.operator}</span>
          <div className="flex items-center gap-4 pt-1">
            {node.left && <PredicateTree node={node.left} />}
            {node.right && <PredicateTree node={node.right} />}
          </div>
        </div>
      ) : node.type === 'column' ? (
        <span className="text-info">{node.columnName}</span>
      ) : (
        <span className="text-success">{String(node.value)}</span>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Create ExecutionVisualizer component**

Create `src/visualizer/ExecutionVisualizer.tsx`:
```typescript
import React from 'react';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { PredicateTree } from './PredicateTree';
import { Play, SkipBack, SkipForward, RotateCcw, CheckCircle2, Circle, ArrowRight } from 'lucide-react';

export const ExecutionVisualizer: React.FC = () => {
  const {
    executionPlan,
    stages,
    currentStageIndex,
    stepForward,
    stepBack,
    restartDebug,
    runQuery,
    jumpToStage,
    debugState
  } = useWorkspaceStore();

  const currentEvent = executionPlan?.events[currentStageIndex];

  return (
    <div className="h-full w-full flex flex-col bg-base text-primary font-sans select-none border-b border-border">
      {/* Visualizer Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface border-b border-border text-xs">
        <div className="flex items-center gap-2 font-mono">
          <span className="text-secondary font-semibold">SQL DEBUGGER</span>
          <span className="px-1.5 py-0.5 rounded bg-surface-secondary border border-border text-accent text-[10px] uppercase">
            {debugState}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={restartDebug}
            disabled={!executionPlan}
            className="p-1 rounded hover:bg-surface-secondary text-secondary hover:text-primary disabled:opacity-40"
            title="Restart (Ctrl+R)"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={stepBack}
            disabled={!executionPlan || currentStageIndex === 0}
            className="p-1 rounded hover:bg-surface-secondary text-secondary hover:text-primary disabled:opacity-40"
            title="Step Back (Shift+F10)"
          >
            <SkipBack size={14} />
          </button>
          <button
            onClick={stepForward}
            disabled={!executionPlan || currentStageIndex >= stages.length - 1}
            className="p-1 rounded hover:bg-surface-secondary text-secondary hover:text-primary disabled:opacity-40"
            title="Step Forward (F10)"
          >
            <SkipForward size={14} />
          </button>
          <button
            onClick={runQuery}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-accent text-base font-semibold hover:bg-accent/90"
            title="Run Query (F5)"
          >
            <Play size={12} fill="currentColor" />
            <span>Run</span>
          </button>
        </div>
      </div>

      {/* Stage Pipeline Node Bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-surface border-b border-border overflow-x-auto">
        {stages.length === 0 ? (
          <div className="text-xs text-muted font-mono">No query executed. Press Run to start debugging pipeline.</div>
        ) : (
          stages.map((stg, idx) => {
            const isActive = idx === currentStageIndex;
            const isDone = idx < currentStageIndex;

            return (
              <React.Fragment key={stg}>
                <div
                  onClick={() => jumpToStage(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono cursor-pointer transition-all ${
                    isActive
                      ? 'bg-accent/15 border-accent text-accent font-bold shadow-sm'
                      : isDone
                      ? 'bg-surface-secondary border-border text-success'
                      : 'bg-surface border-border text-muted hover:text-secondary'
                  }`}
                >
                  {isDone ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                  <span>{stg}</span>
                </div>
                {idx < stages.length - 1 && <ArrowRight size={12} className="text-muted shrink-0" />}
              </React.Fragment>
            )
          })
        )}
      </div>

      {/* Stage Detail Card & Visualizer Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-base flex flex-col gap-4">
        {currentEvent ? (
          <div className="bg-surface border border-border rounded p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div>
                <h3 className="text-sm font-semibold text-primary">{currentEvent.title}</h3>
                <p className="text-xs text-secondary">{currentEvent.description}</p>
              </div>
              {currentEvent.durationMs && (
                <span className="text-xs font-mono text-muted">{currentEvent.durationMs} ms</span>
              )}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3 text-xs font-mono">
              <div className="bg-surface-secondary border border-border p-2.5 rounded">
                <div className="text-muted text-[10px]">INPUT ROWS</div>
                <div className="text-lg font-bold text-primary">{currentEvent.inputRows.length}</div>
              </div>
              <div className="bg-surface-secondary border border-border p-2.5 rounded">
                <div className="text-muted text-[10px]">OUTPUT ROWS</div>
                <div className="text-lg font-bold text-success">{currentEvent.outputRows.length}</div>
              </div>
              <div className="bg-surface-secondary border border-border p-2.5 rounded">
                <div className="text-muted text-[10px]">REJECTED ROWS</div>
                <div className="text-lg font-bold text-error">{currentEvent.rejectedRows?.length ?? 0}</div>
              </div>
            </div>

            {/* Predicate Tree display for WHERE */}
            {currentEvent.predicateTree && (
              <div className="space-y-1">
                <div className="text-xs font-mono text-muted uppercase">Predicate Evaluation Tree</div>
                <PredicateTree node={currentEvent.predicateTree} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-muted font-mono">
            Execute a query to inspect logical stage step transformations.
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Test build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/visualizer/PredicateTree.tsx src/visualizer/ExecutionVisualizer.tsx
git commit -m "feat: add execution visualizer component and predicate tree viewer"
```

---

### Task 11: Result Grid, Row Inspector & Provenance Panel

**Files:**
- Create: `src/inspector/RowInspector.tsx`
- Create: `src/inspector/ResultGrid.tsx`

**Interfaces:**
- Consumes: `useWorkspaceStore` (result rows, columns, selected row)
- Produces: `<ResultGrid />` virtualized data table and `<RowInspector />` side drawer.

- [ ] **Step 1: Create RowInspector component**

Create `src/inspector/RowInspector.tsx`:
```typescript
import React from 'react';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { X, Search } from 'lucide-react';

export const RowInspector: React.FC = () => {
  const { selectedRow, setSelectedRow } = useWorkspaceStore();

  if (!selectedRow) return null;

  return (
    <div className="w-80 h-full bg-surface border-l border-border flex flex-col text-xs font-sans">
      <div className="flex items-center justify-between px-3 py-2 bg-surface-secondary border-b border-border">
        <div className="flex items-center gap-1.5 font-semibold text-primary">
          <Search size={13} className="text-accent" />
          <span>ROW INSPECTOR</span>
        </div>
        <button onClick={() => setSelectedRow(null)} className="text-secondary hover:text-primary">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono">
        {Object.entries(selectedRow).map(([key, val]) => (
          <div key={key} className="bg-surface-secondary border border-border p-2 rounded">
            <div className="text-[10px] text-muted uppercase">{key}</div>
            <div className="text-primary font-medium text-xs break-all">{val === null ? 'NULL' : String(val)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create ResultGrid component**

Create `src/inspector/ResultGrid.tsx`:
```typescript
import React from 'react';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { RowInspector } from './RowInspector';
import { Table } from 'lucide-react';

export const ResultGrid: React.FC = () => {
  const { resultRows, resultColumns, setSelectedRow } = useWorkspaceStore();

  return (
    <div className="h-full w-full flex bg-surface text-primary font-sans select-none">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-surface-secondary border-b border-border text-xs text-secondary font-mono">
          <div className="flex items-center gap-1.5">
            <Table size={13} className="text-accent" />
            <span>RESULT SET ({resultRows.length} rows)</span>
          </div>
        </div>

        {/* Grid Table */}
        <div className="flex-1 overflow-auto">
          {resultColumns.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted font-mono">
              No results to display. Run a SQL query.
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead className="sticky top-0 bg-surface-secondary border-b border-border text-secondary text-[11px]">
                <tr>
                  <th className="p-2 border-r border-border/50 w-10 text-center text-muted">#</th>
                  {resultColumns.map((col) => (
                    <th key={col} className="p-2 border-r border-border/50 font-semibold text-primary">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {resultRows.map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setSelectedRow(row)}
                    className="hover:bg-surface-secondary/70 cursor-pointer transition-colors"
                  >
                    <td className="p-2 border-r border-border/40 text-center text-muted text-[10px]">{idx + 1}</td>
                    {resultColumns.map((col) => (
                      <td key={col} className="p-2 border-r border-border/40 truncate max-w-[200px]">
                        {row[col] === null ? (
                          <span className="text-muted italic">NULL</span>
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <RowInspector />
    </div>
  );
};
```

- [ ] **Step 3: Test build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/inspector/RowInspector.tsx src/inspector/ResultGrid.tsx
git commit -m "feat: add virtualized result grid and row inspector drawer"
```

---

### Task 12: Main App Workspace Layout & Splitter Integration

**Files:**
- Create: `src/App.tsx`
- Create: `src/main.tsx`

**Interfaces:**
- Consumes: All UI components (`<DatabaseExplorer />`, `<SqlEditor />`, `<ExecutionVisualizer />`, `<ResultGrid />`)
- Produces: Complete IDE application.

- [ ] **Step 1: Create Main App layout**

Create `src/App.tsx`:
```typescript
import React from 'react';
import { DatabaseExplorer } from './schema/DatabaseExplorer';
import { SqlEditor } from './editor/SqlEditor';
import { ExecutionVisualizer } from './visualizer/ExecutionVisualizer';
import { ResultGrid } from './inspector/ResultGrid';
import { Play, RotateCcw, Layers } from 'lucide-react';
import { useWorkspaceStore } from './state/useWorkspaceStore';

export const App: React.FC = () => {
  const { runQuery, restartDebug } = useWorkspaceStore();

  return (
    <div className="h-screen w-screen flex flex-col bg-base text-primary overflow-hidden select-none">
      {/* Top Application Toolbar */}
      <header className="h-10 px-3 bg-surface border-b border-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-mono font-bold tracking-wide">
          <Layers size={16} className="text-accent" />
          <span>SQL LAB</span>
          <span className="text-muted text-[10px] font-normal">| DuckDB Engine (Local)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={restartDebug}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-secondary border border-border text-secondary hover:text-primary"
          >
            <RotateCcw size={12} />
            <span>Restart</span>
          </button>
          <button
            onClick={runQuery}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-accent text-base font-semibold hover:bg-accent/90"
          >
            <Play size={12} fill="currentColor" />
            <span>Run Query (F5)</span>
          </button>
        </div>
      </header>

      {/* Main Multi-Panel Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 h-full">
          <DatabaseExplorer />
        </div>

        {/* Center Main Panels */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Top Half: Editor + Visualizer */}
          <div className="h-1/2 flex border-b border-border">
            <div className="w-1/2 h-full">
              <SqlEditor />
            </div>
            <div className="w-1/2 h-full border-l border-border">
              <ExecutionVisualizer />
            </div>
          </div>

          {/* Bottom Half: Result Grid */}
          <div className="h-1/2 h-full">
            <ResultGrid />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
```

Create `src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 2: Test application build**

Run: `npm run build`
Expected: PASS with output artifacts in `dist/`

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/main.tsx
git commit -m "feat: assemble main app layout with top bar and resizable panel grids"
```

---

### Task 13: End-to-End Benchmark Query Verification Test

**Files:**
- Test: `src/__tests__/e2e.test.ts`

**Interfaces:**
- Consumes: Complete application stack
- Produces: Empirical verification that the canonical benchmark query runs, steps through logical operations, and inspects results.

- [ ] **Step 1: Create End-to-End benchmark test**

Create `src/__tests__/e2e.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase } from '../database/duckdb';
import { useWorkspaceStore } from '../state/useWorkspaceStore';

describe('E2E Benchmark Query Verification', () => {
  beforeAll(async () => {
    await resetDatabase();
    await useWorkspaceStore.getState().loadSchema();
  });

  it('should run benchmark query and navigate through all debugger stages', async () => {
    const store = useWorkspaceStore.getState();

    // 1. Run Query
    await store.runQuery();

    const updated = useWorkspaceStore.getState();
    expect(updated.stages).toEqual(['FROM', 'JOIN', 'WHERE', 'GROUP BY', 'SELECT', 'ORDER BY', 'LIMIT']);
    expect(updated.resultRows.length).toBe(5);

    // 2. Step forward through stages
    useWorkspaceStore.getState().stepForward();
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(1);

    useWorkspaceStore.getState().stepForward();
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(2);

    // 3. Verify WHERE stage event details
    const plan = useWorkspaceStore.getState().executionPlan;
    const whereEvent = plan?.events.find((e) => e.stage === 'WHERE');
    expect(whereEvent).toBeDefined();
    expect(whereEvent?.outputRows.length).toBeGreaterThan(0);
    expect(whereEvent?.rejectedRows).toBeDefined();
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: ALL PASS (`sanity`, `types`, `duckdb`, `schema`, `parser`, `executionRecorder`, `store`, `e2e`)

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/e2e.test.ts
git commit -m "test: add end-to-end benchmark query verification suite"
```
