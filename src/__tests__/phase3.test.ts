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
        SELECT movie_id, title FROM movies WHERE year >= 2010
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
