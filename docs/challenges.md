# Contributing SQL challenges

Challenges are local learning exercises, not leaderboard submissions. Each definition in `src/challenges/catalog.ts` includes its own setup SQL, a starter query, a reference query, a prompt, topics, difficulty, and progressive hints.

## Add a challenge

Add a `ChallengeDefinition` object to `challengeCatalog`:

```ts
{
  id: 'unique-kebab-case-id',
  title: 'Short problem title',
  summary: 'One sentence for the catalog card.',
  prompt: 'Describe the requested columns, rows, and ordering precisely.',
  difficulty: 'Beginner', // Beginner | Intermediate | Advanced
  topics: ['JOIN', 'GROUP BY'],
  setupSql: `CREATE TABLE ...;
INSERT INTO ...;`,
  starterSql: `SELECT ...;`,
  solutionSql: `SELECT ...;`,
  ordered: false,
  floatTolerance: 1e-9,
  hints: ['A small nudge.', 'A more specific direction.'],
}
```

The setup script runs in a temporary schema dedicated to that challenge. Keep datasets small, deterministic, and self-contained. Avoid creating files or referring to workspace tables.

The validator compares returned column names and values. Rows are compared as a multiset by default, so equivalent results do not need to use the same row order. Set `ordered: true` only when the prompt requires a particular order. Floating point values use the configured tolerance (default `1e-9`). Prefer deterministic data and avoid relying on wall-clock time, random values, or unspecified row order.

Starter SQL should be runnable when possible and leave a meaningful part of the task unfinished. Hints should progress from a concept toward a concrete technique without revealing the entire solution in the first hint. Include edge cases that distinguish a correct result from a superficially plausible one.

Reference SQL is shipped to the browser because validation happens locally. Do not use this format for exams or any task where the solution must remain secret.
