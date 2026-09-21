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

  it('should record and verify HAVING filtering and DISTINCT deduplication', async () => {
    const store = useWorkspaceStore.getState();
    store.setSql(`
      SELECT DISTINCT m.genre
      FROM movies m
      JOIN reviews r ON r.movie_id = m.movie_id
      GROUP BY m.genre, m.movie_id
      HAVING AVG(r.score) >= 8.0;
    `);

    await store.runQuery();

    const plan = useWorkspaceStore.getState().executionPlan;
    expect(plan).toBeDefined();

    const distinctEvent = plan?.events.find((e) => e.stage === 'DISTINCT');
    expect(distinctEvent).toBeDefined();
    expect(distinctEvent?.outputRows.length).toBeLessThanOrEqual(distinctEvent?.inputRows.length ?? 0);
  });
});
