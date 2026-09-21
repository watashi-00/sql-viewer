import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { resetDatabase } from '../database/duckdb';
import { useWorkspaceStore, DEFAULT_QUERY } from '../state/useWorkspaceStore';

describe('E2E Benchmark Query Verification', () => {
  beforeAll(async () => {
    await resetDatabase();
    await useWorkspaceStore.getState().loadSchema();
  });

  beforeEach(async () => {
    useWorkspaceStore.setState({
      sql: DEFAULT_QUERY,
      debugState: 'idle',
      executionPlan: null,
      stages: [],
      currentStageIndex: 0,
      resultRows: [],
      resultColumns: [],
      selectedRow: null,
      isInspectingRow: false,
    });
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

  it('should complete full stepper lifecycle: forward, backward, jump, restart, and completion', async () => {
    await useWorkspaceStore.getState().runQuery();
    const state = useWorkspaceStore.getState();
    expect(state.debugState).toBe('paused');
    expect(state.currentStageIndex).toBe(0);
    expect(state.stages.length).toBe(7);

    // Step forward through all stages
    for (let i = 1; i < state.stages.length; i++) {
      useWorkspaceStore.getState().stepForward();
      expect(useWorkspaceStore.getState().currentStageIndex).toBe(i);
      expect(useWorkspaceStore.getState().debugState).toBe('paused');
    }

    // Stepping forward at the last stage should transition to 'completed'
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(6);
    useWorkspaceStore.getState().stepForward();
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(6);
    expect(useWorkspaceStore.getState().debugState).toBe('completed');

    // Step back reverts to 'paused' and previous stage
    useWorkspaceStore.getState().stepBack();
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(5);
    expect(useWorkspaceStore.getState().debugState).toBe('paused');

    // Jump to specific stages
    useWorkspaceStore.getState().jumpToStage(2);
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(2);

    useWorkspaceStore.getState().jumpToStage(0);
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(0);

    // Restart debugging resets to index 0 and 'paused'
    useWorkspaceStore.getState().jumpToStage(4);
    useWorkspaceStore.getState().restartDebug();
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(0);
    expect(useWorkspaceStore.getState().debugState).toBe('paused');
  });

  it('should verify detailed event payloads across all pipeline stages', async () => {
    await useWorkspaceStore.getState().runQuery();
    const plan = useWorkspaceStore.getState().executionPlan;
    expect(plan).not.toBeNull();
    if (!plan) return;

    // 1. FROM event
    const fromEvent = plan.events[0];
    expect(fromEvent.stage).toBe('FROM');
    expect(fromEvent.stageIndex).toBe(0);
    expect(fromEvent.outputRows.length).toBe(5);
    expect(fromEvent.outputRows[0]).toHaveProperty('title');
    expect(fromEvent.outputRows[0]).toHaveProperty('movie_id');

    // 2. JOIN event
    const joinEvent = plan.events[1];
    expect(joinEvent.stage).toBe('JOIN');
    expect(joinEvent.stageIndex).toBe(1);
    expect(joinEvent.outputRows.length).toBe(8);
    expect(joinEvent.outputRows[0]).toHaveProperty('score');

    // 3. WHERE event
    const whereEvent = plan.events[2];
    expect(whereEvent.stage).toBe('WHERE');
    expect(whereEvent.outputRows.length).toBe(8);
    expect(whereEvent.rejectedRows).toBeDefined();
    // In benchmark dataset, all 8 reviews have score >= 7, so rejectedRows is []
    expect(whereEvent.rejectedRows?.length).toBe(0);
    whereEvent.outputRows.forEach((row) => {
      expect(Number(row.score)).toBeGreaterThanOrEqual(7);
    });

    // 4. GROUP BY event
    const groupEvent = plan.events[3];
    expect(groupEvent.stage).toBe('GROUP BY');
    expect(groupEvent.outputRows.length).toBeGreaterThan(0);

    // 5. SELECT event
    const selectEvent = plan.events[4];
    expect(selectEvent.stage).toBe('SELECT');
    expect(selectEvent.outputRows[0]).toHaveProperty('average_score');
    expect(selectEvent.outputRows[0]).toHaveProperty('title');

    // 6. ORDER BY event
    const orderEvent = plan.events[5];
    expect(orderEvent.stage).toBe('ORDER BY');
    const scores = orderEvent.outputRows.map((r) => Number(r.average_score));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }

    // 7. LIMIT event
    const limitEvent = plan.events[6];
    expect(limitEvent.stage).toBe('LIMIT');
    expect(limitEvent.outputRows.length).toBe(5);
  });

  it('should capture rejected rows when WHERE predicate filters out records', async () => {
    // Custom query with stricter WHERE filter (score >= 9) where some reviews are rejected
    useWorkspaceStore.getState().setSql(`
      SELECT m.title, AVG(r.score) AS average_score
      FROM movies m
      JOIN reviews r ON r.movie_id = m.movie_id
      WHERE r.score >= 9
      GROUP BY m.title
      ORDER BY average_score DESC
      LIMIT 5;
    `);

    await useWorkspaceStore.getState().runQuery();
    const plan = useWorkspaceStore.getState().executionPlan;
    expect(plan).not.toBeNull();
    const whereEvent = plan?.events.find((e) => e.stage === 'WHERE');
    expect(whereEvent).toBeDefined();
    expect(whereEvent?.outputRows.length).toBeGreaterThan(0);
    expect(whereEvent?.rejectedRows).toBeDefined();
    expect(whereEvent?.rejectedRows?.length).toBeGreaterThan(0);

    whereEvent?.outputRows.forEach((row) => {
      expect(Number(row.score)).toBeGreaterThanOrEqual(9);
    });
    whereEvent?.rejectedRows?.forEach((row) => {
      expect(Number(row.score)).toBeLessThan(9);
    });
  });

  it('should support interactive row inspection', async () => {
    await useWorkspaceStore.getState().runQuery();
    const rows = useWorkspaceStore.getState().resultRows;
    expect(rows.length).toBeGreaterThan(0);

    const targetRow = rows[0];
    useWorkspaceStore.getState().setSelectedRow(targetRow);

    let state = useWorkspaceStore.getState();
    expect(state.isInspectingRow).toBe(true);
    expect(state.selectedRow).toEqual(targetRow);

    // Clear inspection
    useWorkspaceStore.getState().setSelectedRow(null);
    state = useWorkspaceStore.getState();
    expect(state.isInspectingRow).toBe(false);
    expect(state.selectedRow).toBeNull();
  });

  it('should transition debugState to error when query execution fails', async () => {
    useWorkspaceStore.getState().setSql('SELECT * FROM nonexistent_table;');
    await useWorkspaceStore.getState().runQuery();

    const state = useWorkspaceStore.getState();
    expect(state.debugState).toBe('error');
  });
});
