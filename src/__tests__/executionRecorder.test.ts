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

    // Verify FROM event
    const fromEvent = plan.events.find((e) => e.stage === 'FROM');
    expect(fromEvent).toBeDefined();
    expect(fromEvent?.stageIndex).toBe(0);
    expect(fromEvent?.inputRows).toEqual([]);
    expect(fromEvent?.outputRows.length).toBe(5); // 5 movies
    expect(fromEvent?.description).toContain('movies');

    // Verify JOIN event
    const joinEvent = plan.events.find((e) => e.stage === 'JOIN');
    expect(joinEvent).toBeDefined();
    expect(joinEvent?.inputRows.length).toBe(5);
    expect(joinEvent?.outputRows.length).toBe(8); // 8 reviews joined with movies

    // Verify WHERE event
    const whereEvent = plan.events.find((e) => e.stage === 'WHERE');
    expect(whereEvent).toBeDefined();
    expect(whereEvent?.inputRows.length).toBe(8);
    expect(whereEvent?.outputRows.length).toBeGreaterThan(0);
    expect(whereEvent?.rejectedRows).toBeDefined();
    expect(whereEvent?.predicateTree).toBeDefined();
    expect(whereEvent?.predicateTree?.type).toBe('binary');
    expect(whereEvent?.predicateTree?.operator).toBe('>=');

    // Verify GROUP BY event
    const groupEvent = plan.events.find((e) => e.stage === 'GROUP BY');
    expect(groupEvent).toBeDefined();
    expect(groupEvent?.inputRows.length).toBe(whereEvent?.outputRows.length);
    expect(groupEvent?.outputRows.length).toBeGreaterThan(0);

    // Verify SELECT event
    const selectEvent = plan.events.find((e) => e.stage === 'SELECT');
    expect(selectEvent).toBeDefined();
    expect(selectEvent?.outputRows.length).toBe(groupEvent?.outputRows.length);

    // Verify ORDER BY event
    const orderEvent = plan.events.find((e) => e.stage === 'ORDER BY');
    expect(orderEvent).toBeDefined();
    expect(orderEvent?.outputRows.length).toBe(selectEvent?.outputRows.length);

    // Verify LIMIT event
    const limitEvent = plan.events.find((e) => e.stage === 'LIMIT');
    expect(limitEvent).toBeDefined();
    expect(limitEvent?.outputRows.length).toBeLessThanOrEqual(5);

    // Verify columns and final result
    expect(plan.columns).toEqual(['title', 'average_score']);
    expect(plan.finalResult.length).toBe(limitEvent?.outputRows.length);
  });

  it('should record execution timeline for simple query without JOIN or GROUP BY', async () => {
    const sql = `SELECT * FROM movies WHERE year > 2010`;
    const plan = await recordQueryExecution(sql);

    expect(plan.stages).toEqual(['FROM', 'WHERE', 'SELECT']);
    expect(plan.events.length).toBe(3);

    const fromEvent = plan.events.find((e) => e.stage === 'FROM');
    expect(fromEvent?.outputRows.length).toBe(5);

    const whereEvent = plan.events.find((e) => e.stage === 'WHERE');
    expect(whereEvent?.inputRows.length).toBe(5);
    expect(whereEvent?.outputRows.length).toBe(3); // Interstellar (2014), Barbie (2023), Oppenheimer (2023)
    expect(whereEvent?.rejectedRows?.length).toBe(2); // Inception (2010), Pulp Fiction (1994)
  });

  it('should throw an error on invalid SQL query', async () => {
    const sql = `SELECT * FROM non_existent_table_xyz`;
    await expect(recordQueryExecution(sql)).rejects.toThrow();
  });
});
