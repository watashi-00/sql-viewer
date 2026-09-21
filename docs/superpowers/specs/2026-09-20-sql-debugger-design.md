# Technical Design Spec: SQL IDE + Query Debugger + Execution Visualizer

**Date**: 2026-09-20  
**Status**: Approved  
**Scope**: Phase 1 MVP  

---

## 1. Executive Summary

This document specifies the technical architecture and implementation details for the **SQL IDE + Query Debugger + Execution Visualizer**. The product is a desktop-first, local-first developer environment running entirely in the browser. It combines a Monaco-based SQL IDE, DuckDB-WASM relational engine, AST-based logical query execution recorder, step-by-step debugger, animated relational operation visualizer, and virtualized result inspector.

The core goal is making SQL execution transparently debuggable: stepping through `FROM` → `JOIN` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `DISTINCT` → `ORDER BY` → `LIMIT`, capturing input/output rows, predicate evaluations, aggregate calculations, and intermediate relations.

---

## 2. Technology Stack & Key Dependencies

- **UI Framework & Build**: React 18, TypeScript, Vite, Tailwind CSS
- **Code Editor**: `@monaco-editor/react` (Monaco Editor)
- **Database Engine**: `@duckdb/duckdb-wasm` (running inside a dedicated Web Worker)
- **SQL Parser & AST**: `node-sql-parser` / `sql-parser-cst`
- **State Management**: Zustand
- **Icons**: Lucide Icons (`lucide-react`)
- **Virtualization**: `@tanstack/react-virtual`

---

## 3. System Architecture & Directory Structure

### 3.1 High-Level Architecture

```text
                               ┌───────────────────────────┐
                               │     Monaco SQL Editor     │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │    SQL Parser & Analyzer  │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │   DuckDB-WASM Worker Engine│
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │ Execution Event Recorder  │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │   Debugger State Machine  │
                               └──────┬──────────────┬─────┘
                                      │              │
                ┌─────────────────────┴───┐      ┌───┴─────────────────────┐
                │ Execution Visualizer UI │      │ Result Grid & Inspector │
                └─────────────────────────┘      └─────────────────────────┘
```

### 3.2 Directory Layout (`src/`)

```text
src/
├── components/          # Base UI primitives (Panel, Splitter, Button, Badge, Modal)
├── editor/              # Monaco editor setup, themes, IntelliSense, hover, error markers
├── database/            # DuckDB-WASM Web Worker, connection pool, schema introspector
├── parser/              # SQL AST parser, query analyzer, alias resolver, predicate tree builder
├── debugger/            # Debugger state machine, event recorder, instrumented step runner
├── visualizer/          # Pipeline flow, stage detail cards, predicate trees, animated rows, canvas controls
├── inspector/           # Virtualized result table, Row Inspector, Column Provenance, Execution Timeline
├── schema/              # Database Explorer tree, table/column metadata, schema relationship diagram
├── datasets/            # Built-in seed datasets (Movies, Banking, E-commerce)
├── state/               # Zustand stores (workspace, database, debugger, layout)
├── styles/              # Global CSS, theme colors, typography definitions
└── types/               # Core TS interfaces (ExecutionEvent, Schema, DebugState, AST)
```

---

## 4. Visual Identity & Theme Specifications

Compliant with Sections 4–6 of `spec.md`:

- **Background Base**: `#0B0D10`
- **Primary Surface**: `#111418`
- **Secondary Surface**: `#161A20`
- **Border Neutral**: `#272C33`
- **Text Primary**: `#E6E8EB`
- **Text Secondary**: `#9299A3`
- **Text Muted**: `#626A75`
- **Primary Accent**: `#7C9CFF` (used strictly for active debugger position, selections, and focal stage)
- **Semantic Colors**:
  - Success: `#62C58A`
  - Warning: `#D9A441`
  - Error: `#E06C75`
  - Info: `#6EA8FE`
- **Typography**: `Inter` for UI, `JetBrains Mono` for SQL editor, monospace grid cells, and code popups.

---

## 5. Subsystem Design

### 5.1 Database Layer & Schema Introspector
- **DuckDB-WASM Worker**: Instantiated in `src/database/duckdb.worker.ts`. Runs asynchronous query execution off the main UI looper thread.
- **Catalog Introspection**: Queries `information_schema.tables`, `information_schema.columns`, `duckdb_constraints()`, and `duckdb_indexes()` to extract table names, column data types, PK/FK relationships, and constraints.
- **Seed Datasets**: Pre-loads default `Movies` schema:
  - `directors` (`director_id` INT PK, `name` VARCHAR, `nationality` VARCHAR, `birth_year` INT)
  - `movies` (`movie_id` INT PK, `title` VARCHAR, `genre` VARCHAR, `year` INT, `director_id` INT FK, `budget` INT, `revenue` INT, `runtime` INT)
  - `reviews` (`review_id` INT PK, `movie_id` INT FK, `score` INT, `platform` VARCHAR, `review_year` INT)

### 5.2 Contextual Monaco Editor & IntelliSense
- **AST Alias Resolver**: Tracks alias mappings in the active SQL doc (e.g. `FROM movies m JOIN reviews r` maps `m → movies`, `r → reviews`).
- **Completion Provider**:
  - After `FROM` / `JOIN`: Suggests tables in active schema.
  - After `ON`: Suggests valid FK equality join conditions (e.g. `r.movie_id = m.movie_id`).
  - After table alias prefix (`m.`): Suggests columns belonging to `movies`.
  - SQL Keywords & Aggregates (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `COALESCE`) with detailed documentation tooltip signatures.
- **Hover Provider**: Shows data types, primary/foreign keys, and alias references on hover.
- **Error Diagnostics**: Maps SQL syntax and DuckDB runtime error positions to inline Monaco markers with fuzzy recommendation hints.

### 5.3 Debugger State Machine & Event Recorder
- **Debug States**: `idle` | `running` | `paused` | `stepping` | `completed` | `error`
- **Active Stages**: Dynamic subset of `[FROM, JOIN, WHERE, GROUP BY, HAVING, SELECT, DISTINCT, ORDER BY, LIMIT]`.
- **Event Recorder Algorithm**:
  1. Parses input query into AST.
  2. For `FROM`: Fetches initial relation snapshot.
  3. For `JOIN`: Executes left/right relation cross-check query to capture matched pairs and unmatched rows (`LEFT JOIN` NULL padding).
  4. For `WHERE`: Evaluates boolean expression tree per row. Records row evaluation results including 3-valued SQL logic (`TRUE`, `FALSE`, `UNKNOWN` for `NULL`).
  5. For `GROUP BY`: Partitions rows into group buckets, step-evaluates aggregate functions.
  6. For `HAVING`: Filters aggregate group results.
  7. For `SELECT`: Applies column projections and alias renames.
  8. For `DISTINCT`: Identifies duplicate row vectors and records count of removed duplicates.
  9. For `ORDER BY`: Captures pre-sort vs post-sort tuple index mapping.
  10. For `LIMIT` / `OFFSET`: Slices sorted dataset, records returned vs excluded rows.

### 5.4 Execution Visualizer UI
- **Pipeline Toolbar**: `Restart` (`|◀`), `Step Back` (`◀`), `Step Forward` (`▶`), `Run` (`▶▶`), `Stop`, and animation speed selector (`250ms`, `600ms`, `0ms`).
- **Stage Flow Visualizer**: Interactive canvas showing stage pipeline cards with status indicators (`○ Not executed`, `● Current`, `✓ Completed`, `× Failed`).
- **Predicate Evaluation Tree Component**: Renders AST binary expression trees for `WHERE` and `HAVING` clauses, highlighting boolean evaluation paths for selected rows.
- **Row Flow Animation**: Smooth row transits from input stage to accepted/rejected output buckets. Fully supports `prefers-reduced-motion`.
- **Zoom & Pan Controls**: Zoom in (`+`), zoom out (`-`), reset fit (`0`), pan canvas via dragging.

### 5.5 Virtualized Result Grid & Inspector
- **Data Grid**: Renders final query result set or active stage intermediate table using `@tanstack/react-virtual`. Features column sorting, column resizing, cell/row copying, and NULL value styling.
- **Row Inspector**: Side drawer detailing row column values, originating source table, and pipeline step transformations.
- **Column Provenance**: Explains column origin, aliases, and aggregate transformations.
- **Execution Timeline**: Millisecond/microsecond execution bar chart per pipeline stage.

---

## 6. Verification & Definition of Done (Phase 1 MVP)

The implementation is verified when the canonical benchmark query:
```sql
SELECT
    m.title,
    AVG(r.score) AS average_score
FROM movies m
JOIN reviews r
    ON r.movie_id = m.movie_id
WHERE r.score >= 7
GROUP BY m.title
ORDER BY average_score DESC
LIMIT 5;
```
can be executed, stepped forward/backward, and inspected at every logical stage without errors or UI main thread locking.
