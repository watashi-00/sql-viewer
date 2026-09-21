# SQL IDE + Query Debugger + Execution Visualizer

Build a complete browser-based SQL development environment focused on **learning, debugging, understanding and visualizing SQL execution**.

The application should combine:

1. A professional SQL IDE
2. A local relational database engine
3. SQL IntelliSense/autocomplete
4. Query execution
5. A step-by-step SQL debugger
6. A relational-operation visualizer
7. Intermediate-result inspection
8. Execution-plan visualization
9. Performance analysis
10. Database/schema exploration

The product should feel like a serious developer tool, not an educational toy.

Reference concept:

https://sqlvisualizer.pydev.in/

Do NOT clone its visual design.

The goal is to create a substantially more polished and technically coherent alternative.

---

# 1. PRODUCT VISION

The central concept is:

> **SQL should be debuggable.**

A developer should be able to write:

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

and then execute it like a debugger.

Instead of only seeing the final result, the user should be able to inspect:

```text
FROM
 ↓
JOIN
 ↓
WHERE
 ↓
GROUP BY
 ↓
ORDER BY
 ↓
LIMIT
 ↓
RESULT
```

step by step.

At every stage the user must be able to see:

* input rows
* output rows
* rows removed
* rows created
* columns involved
* operation parameters
* execution duration where available
* relationships between rows
* why individual rows were accepted/rejected
* generated intermediate relation

The application must answer:

> "What exactly happened to my data?"

---

# 2. TARGET USERS

Primary:

* backend developers
* software engineers
* CS students
* database students
* SQL learners
* developers studying query optimization
* developers preparing for technical interviews

Secondary:

* teachers
* instructors
* database enthusiasts

The interface must still feel professional enough that an experienced backend developer would willingly use it.

---

# 3. CORE PRODUCT PRINCIPLE

Do not build a static flowchart.

Build an **interactive SQL debugger**.

The user should have:

```text
Run
Pause
Step Forward
Step Backward
Restart
Run To Stage
Inspect
Watch
```

similar to a debugger for programming languages.

Example:

```text
┌─────────────────────────────────────────────────────────────┐
│ SQL DEBUGGER                                                │
│                                                             │
│  ◀ Step Back    ▶ Step     ▶ Run      ↻ Restart             │
│                                                             │
│  Current stage: WHERE                                      │
└─────────────────────────────────────────────────────────────┘
```

---

# 4. DESIGN PHILOSOPHY

Avoid:

* AI-generated-looking dashboards
* excessive rounded cards
* excessive gradients
* neon cyberpunk styling
* emojis
* decorative illustrations
* giant headings
* excessive empty space
* excessive shadows
* meaningless animations
* excessive glassmorphism
* generic SaaS landing-page design

This is a developer tool.

The visual language should resemble a combination of:

* VS Code
* JetBrains IDEs
* database clients
* browser DevTools
* debugger interfaces
* terminal tooling

but should still have its own identity.

The UI must prioritize information density without becoming visually chaotic.

---

# 5. VISUAL IDENTITY

## Brand personality

The product should communicate:

* precision
* engineering
* observability
* computation
* data
* determinism
* debugging
* technical depth

It should look like a tool made by database engineers.

Not like an educational children's application.

---

# 6. COLOR SYSTEM

Default theme: dark.

Use a restrained neutral palette.

Base:

```text
Background:
#0B0D10

Primary Surface:
#111418

Secondary Surface:
#161A20

Border:
#272C33

Primary Text:
#E6E8EB

Secondary Text:
#9299A3

Muted Text:
#626A75
```

Use one primary accent.

Suggested accent:

```text
#7C9CFF
```

Accent should primarily indicate:

* active stage
* selection
* focus
* debugger position
* interactive controls

Do NOT use the accent as decoration everywhere.

Semantic colors:

```text
Success:
#62C58A

Warning:
#D9A441

Error:
#E06C75

Info:
#6EA8FE
```

Semantic colors should only appear when their semantic meaning exists.

Do not color every component.

---

# 7. TYPOGRAPHY

Use a modern developer-oriented type system.

UI:

```text
Inter
```

Code:

```text
JetBrains Mono
```

Fallbacks:

```text
system-ui
monospace
```

SQL editor must use a monospace font.

Use compact line height for code.

Do not use oversized typography.

---

# 8. ICONOGRAPHY

Use a single consistent icon library.

Prefer:

* Lucide
* Phosphor

Do not use emojis as UI icons.

Avoid decorative iconography.

Every icon must communicate an actual function.

---

# 9. APPLICATION STRUCTURE

Main application:

```text
┌────────────────────────────────────────────────────────────────────┐
│ Top Toolbar                                                       │
├────────────┬───────────────────────────────────────┬───────────────┤
│            │                                       │               │
│ DATABASE   │            SQL EDITOR                │   INSPECTOR   │
│ EXPLORER   │                                       │               │
│            │                                       │               │
│            │                                       │               │
├────────────┴───────────────────────────────────────┴───────────────┤
│                    EXECUTION VISUALIZER                           │
├────────────────────────────────────────────────────────────────────┤
│                    RESULT / ROW INSPECTOR                         │
└────────────────────────────────────────────────────────────────────┘
```

All major panels must be resizable.

Allow:

* collapse
* expand
* resize
* fullscreen editor
* fullscreen visualizer
* fullscreen results

Persist layout preferences locally.

---

# 10. TOP TOOLBAR

Toolbar should contain:

```text
Database
Schema
Query
Run
Stop
Step
Restart
Execution Mode
Theme
Settings
```

Example:

```text
┌──────────────────────────────────────────────────────────────────┐
│ SQL Lab │ PostgreSQL │ public │ Query 01 │ Run │ Step │ Restart │
└──────────────────────────────────────────────────────────────────┘
```

No decorative controls.

---

# 11. DATABASE EXPLORER

Left sidebar.

Show:

```text
DATABASE

Schemas
 └── public

Tables
 ├── directors
 ├── movies
 └── reviews
```

Expand table:

```text
movies
 ├── PK movie_id INTEGER
 ├── title VARCHAR
 ├── genre VARCHAR
 ├── year INTEGER
 ├── director_id INTEGER
 ├── budget INTEGER
 ├── revenue INTEGER
 └── runtime INTEGER
```

Use distinct visual markers for:

* primary key
* foreign key
* nullable
* unique
* indexed
* generated/default

Hovering a column should show:

```text
column
type
nullable
default
constraints
indexes
references
```

---

# 12. SCHEMA RELATIONSHIPS

Allow the user to switch the database explorer into a relationship view.

Example:

```text
directors
    │
    │ director_id
    ▼
movies
    │
    │ movie_id
    ▼
reviews
```

Relationships should be interactive.

Selecting a foreign key should highlight its target.

---

# 13. SQL EDITOR

Use a professional code editor.

Prefer:

* Monaco Editor

or another mature editor.

Required:

* syntax highlighting
* line numbers
* bracket matching
* code folding
* minimap optional
* multi-cursor
* selection
* keyboard shortcuts
* query formatting
* error markers
* current-line highlighting

---

# 14. SQL INTELLISENSE

Implement real contextual autocomplete.

When typing:

```sql
SELECT *
FROM mo
```

suggest:

```text
movies
```

When typing:

```sql
SELECT m.
FROM movies m
```

suggest columns:

```text
movie_id
title
genre
year
director_id
budget
revenue
runtime
```

When typing:

```sql
SELECT *
FROM movies m
JOIN reviews r
ON r.
```

suggest:

```text
review_id
movie_id
score
platform
review_year
```

Autocomplete must understand aliases.

For:

```sql
FROM movies m
JOIN reviews r
```

the editor must know:

```text
m → movies
r → reviews
```

and provide correct contextual completions.

---

# 15. SQL KEYWORD COMPLETION

Support completion for:

```text
SELECT
FROM
WHERE
JOIN
LEFT JOIN
RIGHT JOIN
FULL JOIN
INNER JOIN
CROSS JOIN
ON
GROUP BY
HAVING
ORDER BY
LIMIT
OFFSET
DISTINCT
UNION
UNION ALL
INSERT
UPDATE
DELETE
CREATE
ALTER
DROP
CREATE INDEX
CASE
WHEN
THEN
ELSE
END
AS
AND
OR
NOT
IN
EXISTS
BETWEEN
LIKE
IS NULL
IS NOT NULL
```

Include function completion:

```text
COUNT
SUM
AVG
MIN
MAX
COALESCE
NULLIF
LOWER
UPPER
LENGTH
ROUND
```

Autocomplete should display:

```text
COUNT(expression)

Aggregate function
Returns number of non-null values.
```

---

# 16. HOVER INFORMATION

Hover over:

```sql
movie_id
```

should display:

```text
movies.movie_id

INTEGER
PRIMARY KEY
NOT NULL
```

Hover over:

```sql
JOIN
```

should show a concise documentation popup.

Hover over an alias:

```sql
m
```

should show:

```text
Alias

m → movies
```

---

# 17. QUERY ERRORS

SQL errors must be presented directly in the editor.

Example:

```sql
SELECT titl
FROM movies;
```

Show:

```text
Unknown column: "titl"

Did you mean:
  title
```

Do not use AI to fabricate explanations.

Use actual parser/database errors wherever possible.

---

# 18. QUERY EXECUTION MODEL

Use a real SQL engine running locally in the browser.

Preferred:

```text
DuckDB-WASM
```

Alternative engines may be used if technically superior.

No backend should be required for normal execution.

User data should remain local by default.

---

# 19. EXECUTION MODES

Provide:

```text
Execute
Debug
Explain
Performance
```

### Execute

Runs the query normally.

### Debug

Runs the logical execution visualization step-by-step.

### Explain

Shows the engine's execution plan.

### Performance

Shows timing and plan metrics.

---

# 20. DEBUGGER

Debugger toolbar:

```text
|◀
◀
▶
▶|
↻
```

Semantics:

```text
Restart
Step Back
Step Forward
Run To End
Run From Current
```

Keyboard shortcuts:

```text
F5  Run
F10 Step
Shift+F10 Step Back
Shift+F5 Stop
Ctrl+R Restart
```

Allow users to configure shortcuts.

---

# 21. EXECUTION PIPELINE

Display:

```text
FROM
  ↓
JOIN
  ↓
WHERE
  ↓
GROUP BY
  ↓
HAVING
  ↓
SELECT
  ↓
DISTINCT
  ↓
ORDER BY
  ↓
LIMIT
```

Only show stages relevant to the current query.

For example, if there is no `GROUP BY`, do not display a fake GROUP BY stage.

Each stage has a state:

```text
○ Not executed
● Current
✓ Completed
× Failed
```

---

# 22. STAGE ANIMATION

Animation must represent actual data transformation.

Never animate arbitrary decorative particles.

For example:

```text
FROM
150 rows
```

When entering JOIN:

Rows should visually move from the source relation toward the JOIN operation.

When JOIN completes:

Rows should appear in the resulting relation.

For WHERE:

Rows should move through the filter.

Accepted rows continue.

Rejected rows move into a rejected area.

Example:

```text
INPUT
400 rows
 │
 ├───────────────┐
 │               │
 ▼               ▼
MATCH           REJECT
217             183
 │
 ▼
OUTPUT
217
```

Animation duration should be short.

Suggested:

```text
normal:
250–450ms

slow:
600–900ms

instant:
0ms
```

Respect:

```text
prefers-reduced-motion
```

---

# 23. WHERE VISUALIZATION

For:

```sql
WHERE score >= 7
```

display:

```text
FILTER

Predicate:
score >= 7

Input:
400 rows

Accepted:
217

Rejected:
183
```

Rows should be inspectable.

Selecting a row:

```text
review_id: 81
score: 5

Evaluation:

5 >= 7
false
```

For compound predicates:

```sql
WHERE score >= 7
AND platform = 'IMDb'
```

show the evaluation tree:

```text
             AND
            /   \
           /     \
     score >= 7   platform = IMDb
         │              │
       TRUE            FALSE

              ↓

             FALSE
```

This should be generated from the parsed expression tree.

---

# 24. AND / OR VISUALIZATION

For:

```sql
WHERE score >= 7
OR platform = 'IMDb'
```

visualize:

```text
             OR
           /    \
       TRUE     FALSE
                 │
              TRUE
                 │
              RESULT
               TRUE
```

Allow the user to inspect each predicate.

---

# 25. NULL VISUALIZATION

Explicitly teach SQL's three-valued logic.

For:

```sql
WHERE score > 7
```

if:

```text
score = NULL
```

show:

```text
NULL > 7
   ↓
UNKNOWN
   ↓
WHERE rejects row
```

Explain:

```text
TRUE   → keep
FALSE  → discard
UNKNOWN → discard in WHERE
```

Do not simplify SQL NULL semantics into normal boolean logic.

---

# 26. JOIN VISUALIZATION

JOIN is one of the primary visualization features.

For:

```sql
JOIN reviews r
ON r.movie_id = m.movie_id
```

display two input relations:

```text
MOVIES                    REVIEWS

movie_id                  movie_id
────────                  ─────────
1                         1
2                         1
3                         2
4                         8
```

Draw relationships between matching rows.

Example:

```text
movies #1 ───────────── reviews #1
movies #1 ───────────── reviews #2
movies #2 ───────────── reviews #3
```

Clicking a connection should show:

```text
Join predicate

r.movie_id = m.movie_id

Left:
1

Right:
1

Result:
MATCH
```

---

# 27. JOIN TYPES

Support visualization for:

```text
INNER JOIN
LEFT JOIN
RIGHT JOIN
FULL OUTER JOIN
CROSS JOIN
```

For LEFT JOIN, unmatched rows must remain visible.

Example:

```text
movies
1 ───── reviews
2 ───── reviews
3 ───── NULL
```

The UI should explicitly show:

```text
No matching review
```

rather than hiding the row.

---

# 28. GROUP BY VISUALIZATION

For:

```sql
GROUP BY genre
```

show rows being partitioned into groups.

Example:

```text
INPUT

Action
Action
Drama
Comedy
Drama
Action

        ↓

GROUP BY genre

┌─────────┐
│ Action  │
│ 1       │
│ 2       │
│ 6       │
└─────────┘

┌─────────┐
│ Drama   │
│ 3       │
│ 5       │
└─────────┘

┌─────────┐
│ Comedy  │
│ 4       │
└─────────┘
```

Then show aggregate calculations.

For:

```sql
AVG(score)
```

display:

```text
Action

8 + 9 + 7
─────────
    3

= 8.00
```

Do not attempt this visualization if the dataset is too large. Use a representative sample with an explicit indication.

---

# 29. AGGREGATION

Support visualization for:

```text
COUNT
SUM
AVG
MIN
MAX
```

For COUNT:

```text
COUNT(score)

3 non-null values
→ 3
```

For AVG:

```text
SUM(score) = 24
COUNT(score) = 3

24 / 3 = 8
```

Handle NULL correctly.

---

# 30. HAVING

For:

```sql
HAVING COUNT(*) > 5
```

show groups entering HAVING:

```text
Action   count=8   ✓
Drama    count=3   ×
Comedy   count=7   ✓
```

Again, the rejected groups must be inspectable.

---

# 31. SELECT PROJECTION

For:

```sql
SELECT title, year
```

visualize the projection:

```text
INPUT

movie_id
title
genre
year
budget
revenue

       ↓

PROJECT

title
year

       ↓

OUTPUT

title
year
```

The user should understand that projection removes columns from the result relation.

---

# 32. DISTINCT

For:

```sql
SELECT DISTINCT genre
```

show duplicate rows being collapsed.

Example:

```text
Action
Action
Drama
Drama
Comedy

       ↓ DISTINCT

Action
Drama
Comedy
```

Show:

```text
5 input rows
3 output rows
2 duplicates removed
```

---

# 33. ORDER BY

For:

```sql
ORDER BY score DESC
```

visualize the transformation from unsorted to sorted relation.

Show:

```text
Before

5
9
7
8
6

↓

After

9
8
7
6
5
```

For large datasets, use representative visualization rather than rendering thousands of animated rows.

---

# 34. LIMIT / OFFSET

For:

```sql
LIMIT 5
```

show:

```text
Input:
100 rows

LIMIT:
5

Output:
5 rows

95 rows excluded from final result
```

For OFFSET:

```text
OFFSET 10
LIMIT 5
```

show:

```text
rows 1–10    skipped
rows 11–15   returned
rows 16+     remaining
```

---

# 35. SET OPERATIONS

Support:

```text
UNION
UNION ALL
INTERSECT
EXCEPT
```

Visualize them as relational operations.

Example UNION:

```text
A             B

1             3
2             4
3             5

      UNION

1
2
3
4
5
```

For UNION ALL, duplicates must remain.

---

# 36. SUBQUERIES

For:

```sql
SELECT *
FROM movies
WHERE movie_id IN (
    SELECT movie_id
    FROM reviews
    WHERE score >= 9
);
```

show nested execution.

Example:

```text
Outer Query
     │
     ▼
Execute Subquery
     │
     ▼
Subquery Result
     │
     ▼
Feed Result Into Outer Query
     │
     ▼
Final Result
```

Allow the user to enter the subquery and inspect its result independently.

---

# 37. CTE

Support:

```sql
WITH high_scores AS (...)
SELECT ...
```

Visualize the CTE as a named intermediate relation.

Example:

```text
high_scores
     │
     ▼
┌──────────────┐
│ movie_id     │
│ score        │
└──────────────┘
     │
     ▼
main query
```

Clicking the CTE should inspect its generated rows.

---

# 38. WINDOW FUNCTIONS

Eventually support:

```text
ROW_NUMBER
RANK
DENSE_RANK
LAG
LEAD
SUM() OVER
AVG() OVER
```

Visualize partitions and ordering.

For:

```sql
ROW_NUMBER() OVER (
    PARTITION BY genre
    ORDER BY score DESC
)
```

show:

```text
Action
────────────
score  rank
9      1
8      2
7      3

Drama
────────────
score  rank
10     1
8      2
```

---

# 39. RESULT TABLE

Result table must behave like a database grid.

Features:

* sortable columns
* resizable columns
* column type information
* null visualization
* row numbers
* copy cell
* copy row
* copy table
* search
* filtering
* pagination
* selected-row inspector

Do not load millions of DOM elements.

Use virtualization.

---

# 40. ROW INSPECTOR

Selecting a row should open an inspector.

Example:

```text
ROW #81

review_id
81

movie_id
42

score
5

platform
IMDb

review_year
2024
```

Also show provenance where possible:

```text
Source:
reviews

Produced by:
JOIN + WHERE
```

---

# 41. COLUMN PROVENANCE

This is an advanced but important feature.

For:

```sql
SELECT m.title
FROM movies m
JOIN reviews r ...
```

selecting `title` should show:

```text
Output column:
title

Source:
movies.title

Alias:
m.title

Transformation:
none
```

For:

```sql
AVG(r.score) AS average_score
```

show:

```text
Output:
average_score

Source:
reviews.score

Transformation:
AVG

Input:
217 rows

Output:
73 grouped values
```

---

# 42. EXECUTION TIMELINE

Below the visualizer provide a timeline:

```text
FROM        0.2ms
JOIN        1.4ms
WHERE       0.3ms
GROUP BY    0.8ms
ORDER BY    0.5ms
LIMIT       0.1ms
```

Allow clicking a stage to inspect it.

---

# 43. PHYSICAL QUERY PLAN

Provide a dedicated view:

```text
Logical
Physical
```

Physical plan should come from the actual database engine where possible.

Example:

```text
Limit
 └── Sort
      └── HashAggregate
           └── Hash Join
                ├── Seq Scan movies
                └── Seq Scan reviews
```

Show metadata:

```text
Estimated rows
Actual rows
Estimated cost
Actual time
Loops
```

When supported by the engine.

Never fabricate execution statistics.

---

# 44. INDEX LAB

Provide a controlled environment for learning indexes.

Example:

```sql
SELECT *
FROM reviews
WHERE movie_id = 42;
```

Show:

```text
BEFORE INDEX

Seq Scan
400 rows scanned
8 returned
```

Then:

```sql
CREATE INDEX idx_reviews_movie_id
ON reviews(movie_id);
```

Run again.

Show:

```text
AFTER INDEX

Index Scan
8 rows accessed
8 returned
```

Also visualize the conceptual index:

```text
B-Tree

             [42]
            /    \
        [1..41] [43..]
             \
              ↓
           row pointers
```

Clearly label conceptual representations as conceptual.

---

# 45. COMPARISON MODE

Allow:

```text
Compare Query A
vs
Query B
```

Show:

```text
Execution Time
Rows Processed
Rows Returned
Plan
Operators
Indexes
```

Highlight meaningful differences.

Do not assign arbitrary performance scores.

---

# 46. DATA GENERATOR

Include a dataset generator.

Allow:

```text
Table:
reviews

Rows:
1,000
10,000
100,000
1,000,000
```

Generate realistic distributions.

Allow configuration:

```text
NULL percentage
cardinality
distribution
duplicates
```

This is essential for demonstrating performance behavior.

---

# 47. DATASETS

Provide built-in datasets:

```text
Movies
Banking
E-commerce
Social Network
IoT
Employees
Library
```

The Movies dataset should resemble:

```text
directors
movies
reviews
```

with realistic relationships.

---

# 48. PERFORMANCE EXPERIMENTS

Provide prepared experiments:

```text
Index vs No Index
JOIN strategies
ORDER BY
GROUP BY
SELECT *
vs projection
Pagination
Composite indexes
LIKE
Range queries
Aggregation
Large datasets
```

Each experiment should be editable.

---

# 49. ANIMATION RULES

Animation must always encode meaning.

Good:

```text
rows moving through filter
matching rows connecting during JOIN
groups forming during GROUP BY
rows moving into rejected set
columns disappearing during projection
```

Bad:

```text
floating particles
glowing borders
random pulsing
unrelated gradients
continuous decorative motion
```

Animations should be:

* deterministic
* interruptible
* reversible where possible
* synchronized with execution state
* disabled under reduced-motion preferences

---

# 50. DEBUG STATE

Maintain an explicit execution state machine.

Conceptually:

```typescript
type DebugState =
    | "idle"
    | "running"
    | "paused"
    | "stepping"
    | "completed"
    | "error";
```

The visualizer must derive its UI from this state.

Do not implement independent ad-hoc UI states.

---

# 51. EXECUTION EVENTS

Create a normalized event model.

Example:

```typescript
interface ExecutionEvent {
    id: string;
    operation: OperationType;
    inputRelationIds: string[];
    outputRelationId: string;
    inputRowCount: number;
    outputRowCount: number;
    duration?: number;
    metadata: Record<string, unknown>;
}
```

Operations:

```typescript
type OperationType =
    | "SCAN"
    | "JOIN"
    | "FILTER"
    | "PROJECT"
    | "GROUP"
    | "AGGREGATE"
    | "DISTINCT"
    | "SORT"
    | "LIMIT"
    | "OFFSET"
    | "UNION"
    | "INTERSECT"
    | "EXCEPT"
    | "WINDOW";
```

The visualizer should consume these events.

---

# 52. INTERNAL ARCHITECTURE

Separate:

```text
Editor
Schema
Parser
Query Analyzer
Execution Engine
Execution Recorder
Debugger
Visualizer
Inspector
Performance Analyzer
Persistence
```

Suggested architecture:

```text
                   SQL Editor
                       │
                       ▼
                 SQL Parser
                       │
                       ▼
                      AST
                       │
             ┌─────────┴─────────┐
             │                   │
             ▼                   ▼
       Query Analyzer      SQL Engine
             │                   │
             └─────────┬─────────┘
                       ▼
               Execution Recorder
                       │
                       ▼
                Debugger State
                       │
              ┌────────┼────────┐
              ▼        ▼        ▼
         Visualizer Inspector Timeline
```

Do not couple the visualization directly to SQL parsing.

---

# 53. LOCAL-FIRST

Normal usage must work entirely in the browser.

No account required.

No backend required for:

* SQL execution
* schema creation
* dataset creation
* debugging
* visualization

Persist local workspace state where appropriate.

---

# 54. SECURITY

Never execute arbitrary SQL against a remote production database by default.

The application should execute against its local browser database.

If external database connectivity is eventually implemented, isolate it behind explicit configuration and warnings.

---

# 55. RESPONSIVENESS

Desktop-first.

Minimum supported desktop width:

```text
1024px
```

At smaller widths:

* panels collapse
* schema explorer becomes drawer
* inspector becomes bottom sheet/panel
* editor remains primary

Do not attempt to squeeze every panel into a narrow mobile layout.

---

# 56. ACCESSIBILITY

Support:

* keyboard navigation
* visible focus
* sufficient contrast
* reduced motion
* screen-reader labels
* semantic controls
* keyboard shortcuts
* no hover-only functionality

---

# 57. EMPTY STATES

Avoid generic:

```text
Nothing here yet :)
```

Use technical messaging.

Example:

```text
No query executed.

Write a SQL statement and press Run.
```

---

# 58. ERROR STATES

Example:

```text
QUERY FAILED

column "titl" does not exist

Position:
12:8

Did you mean:
title
```

The error should point to the editor location when possible.

---

# 59. NO AI SLOP

Strictly avoid:

* emojis
* "magic" AI buttons
* fake assistant panels
* "Ask AI"
* excessive gradients
* glowing cards
* generic glassmorphism
* meaningless statistics
* marketing copy inside the IDE
* unnecessary badges
* excessive rounded containers
* decorative animations
* fake command-center aesthetics

The product must look like a serious engineering application.

---

# 60. MICROINTERACTIONS

Microinteractions should communicate state.

Examples:

When a stage becomes active:

```text
border/focus transition
150–200ms
```

When a row is accepted:

```text
subtle movement into output
```

When rejected:

```text
move to rejected area
fade slightly
```

When a JOIN matches:

```text
draw connection
200–300ms
```

When a query completes:

```text
execution indicator transitions to completed state
```

Do not use animation merely to make the interface "feel alive".

---

# 61. VISUALIZER ZOOM

The execution visualizer should support:

* zoom in
* zoom out
* fit to screen
* pan
* focus selected operation

Keyboard:

```text
+
-
0
```

Where:

```text
0 = fit view
```

---

# 62. QUERY HISTORY

Maintain local query history.

Each entry:

```text
timestamp
query
execution status
duration
row count
```

Allow restoring previous queries.

---

# 63. MULTIPLE QUERY TABS

Support:

```text
Query 01
Query 02
Query 03
```

Each query should maintain:

* editor state
* execution state
* selected stage
* result
* debugger position

---

# 64. SCHEMA EDITING

Allow users to create:

```sql
CREATE TABLE
ALTER TABLE
DROP TABLE
CREATE INDEX
DROP INDEX
INSERT
UPDATE
DELETE
```

Changes must immediately update the schema explorer.

---

# 65. DATABASE TRANSACTIONS

Eventually support:

```sql
BEGIN;
INSERT ...;
ROLLBACK;
```

Visualization:

```text
Transaction
   │
   ├── INSERT
   ├── UPDATE
   └── ROLLBACK
```

Show committed vs uncommitted state where the engine permits it.

---

# 66. EDUCATIONAL EXPLANATION LAYER

The application should explain technical facts contextually, but never dominate the interface.

Example:

Selecting:

```text
Seq Scan
```

shows:

```text
Sequential Scan

The engine reads table pages sequentially.

Rows examined:
400

Rows returned:
8
```

Selecting:

```text
Index Scan
```

shows:

```text
Index Scan

The engine uses an index to locate matching rows.

Index:
idx_reviews_movie_id
```

Keep explanations concise and technical.

---

# 67. NO FALSE PRECISION

If the browser engine cannot expose:

```text
actual physical behavior
```

do not invent it.

Use labels:

```text
Logical visualization
Conceptual visualization
Actual engine plan
```

These are different things.

---

# 68. PERFORMANCE

The application must remain responsive with large datasets.

Use:

* virtualized tables
* Web Workers where appropriate
* incremental rendering
* bounded animations
* lazy visualization
* sampled visualization for very large datasets

Do not attempt to render one million DOM rows.

---

# 69. PROJECT STRUCTURE

Prefer a clean architecture.

Example:

```text
src/
├── editor/
├── database/
├── parser/
├── analyzer/
├── execution/
├── debugger/
├── visualizer/
├── inspector/
├── performance/
├── schema/
├── datasets/
├── components/
├── state/
├── styles/
└── utils/
```

Keep database execution logic independent from UI components.

---

# 70. TESTING

Test:

* parser integration
* schema introspection
* autocomplete
* alias resolution
* execution events
* JOIN visualization
* WHERE evaluation
* NULL semantics
* aggregation
* grouping
* ordering
* LIMIT/OFFSET
* query errors
* debugger stepping
* state transitions
* performance with large datasets

Especially test that the visualizer never displays a transformation that did not actually occur.

---

# 71. MVP PRIORITY

Do not implement everything simultaneously.

Phase 1:

```text
SQL Editor
Database Explorer
DuckDB-WASM
SELECT
FROM
WHERE
ORDER BY
LIMIT
Result Grid
Basic Debugger
Execution Pipeline
```

Phase 2:

```text
JOIN
GROUP BY
HAVING
Aggregations
DISTINCT
Subqueries
CTEs
```

Phase 3:

```text
Physical Explain
Indexes
Performance Lab
Query Comparison
Dataset Generator
```

Phase 4:

```text
Window Functions
Transactions
Advanced execution visualization
Schema diagram
Advanced performance experiments
```

---

# 72. DEFINITION OF DONE

The application is successful when a user can write:

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

then:

1. Run the query.
2. Enter debugger mode.
3. Step through each logical operation.
4. Watch rows transform.
5. Inspect the JOIN matches.
6. Inspect rows rejected by WHERE.
7. Inspect groups created by GROUP BY.
8. Inspect the AVG calculation.
9. Inspect sorting.
10. Inspect LIMIT.
11. Inspect the final result.
12. Open the physical execution plan.
13. Create an index.
14. Execute again.
15. Compare the resulting plans and measurements.

The user should finish with an actual understanding of:

```text
what the query means
what data it transforms
why each row appears/disappears
how relational operations compose
what the database engine actually executes
how indexes affect execution
```

The application is not a SQL tutorial with animations.

It is a **SQL IDE with a debugger and relational execution visualizer**.
