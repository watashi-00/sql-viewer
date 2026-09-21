import { describe, it, expect, beforeAll } from 'vitest';
import { recordQueryExecution } from '../debugger/executionRecorder';
import { seedMoviesDataset } from '../database/schema';
import { resetDatabase, executeQuery } from '../database/duckdb';

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
    expect(joinEvent?.joinMatches).toBeDefined();
    expect(joinEvent?.joinMatches?.length).toBe(8);

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
    expect(groupEvent?.groupBuckets).toBeDefined();
    expect(groupEvent?.groupBuckets!.length).toBeGreaterThan(0);
    expect(groupEvent?.groupBuckets![0].aggregates.length).toBeGreaterThan(0);

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

    // Verify duration measurement
    for (const event of plan.events) {
      expect(typeof event.durationMs).toBe('number');
      expect(event.durationMs).toBeGreaterThanOrEqual(0);
    }
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

  it('should record execution timeline with deep row equality for table without movie_id', async () => {
    const sql = `SELECT * FROM directors WHERE birth_year < 1970`;
    const plan = await recordQueryExecution(sql);

    expect(plan.stages).toEqual(['FROM', 'WHERE', 'SELECT']);
    const whereEvent = plan.events.find((e) => e.stage === 'WHERE');
    expect(whereEvent).toBeDefined();
    expect(whereEvent?.inputRows.length).toBe(3);
    expect(whereEvent?.outputRows.length).toBe(1); // Quentin Tarantino (1963)
    expect(whereEvent?.rejectedRows?.length).toBe(2); // Nolan (1970), Gerwig (1983)
    expect(whereEvent?.description).toContain('birth_year < 1970');
  });

  it('should throw an error on invalid SQL query', async () => {
    const sql = `SELECT * FROM non_existent_table_xyz`;
    await expect(recordQueryExecution(sql)).rejects.toThrow();
  });

  describe('withAlias helper', () => {
    it('should attach alias-prefixed keys alongside original keys', async () => {
      const { withAlias } = await import('../debugger/executionRecorder');
      const rows = [{ id: 1, name: 'Inception' }];
      const result = withAlias(rows, 'm');
      expect(result).toEqual([{ 'm.id': 1, id: 1, 'm.name': 'Inception', name: 'Inception' }]);
    });

    it('should return original rows if alias is empty', async () => {
      const { withAlias } = await import('../debugger/executionRecorder');
      const rows = [{ id: 1, name: 'Inception' }];
      const result = withAlias(rows, '');
      expect(result).toBe(rows);
    });
  });

  describe('Phase 2 JOIN Recording', () => {
    beforeAll(async () => {
      await resetDatabase();
      await seedMoviesDataset();
    });

    it('should record join tuple matches and predicate information', async () => {
      const sql = `
        SELECT m.title, r.score
        FROM movies m
        JOIN reviews r ON r.movie_id = m.movie_id
      `;
      const plan = await recordQueryExecution(sql);
      const joinEvent = plan.events.find((e) => e.stage === 'JOIN');

      expect(joinEvent).toBeDefined();
      expect(joinEvent?.joinMatches).toBeDefined();
      expect(joinEvent?.joinMatches!.length).toBeGreaterThan(0);
      expect(joinEvent?.joinMatches![0].isMatch).toBe(true);
      expect(joinEvent?.joinMatches![0].joinPredicate).toBe('r.movie_id = m.movie_id');
    });

    it('should record unmatched rows for LEFT JOIN with non-matching left tuple', async () => {
      await executeQuery(
        `INSERT INTO movies (movie_id, title, genre, year, director_id) VALUES (99, 'Unreviewed Film', 'Drama', 2024, 1)`
      );
      try {
        const sql = `
          SELECT m.title, r.score
          FROM movies m
          LEFT JOIN reviews r ON r.movie_id = m.movie_id
        `;
        const plan = await recordQueryExecution(sql);
        const joinEvent = plan.events.find((e) => e.stage === 'JOIN');
        expect(joinEvent).toBeDefined();
        expect(joinEvent?.joinMatches).toBeDefined();
        expect(joinEvent?.joinMatches!.length).toBe(8);
        expect(joinEvent?.unmatchedLeftRows).toBeDefined();
        expect(joinEvent?.unmatchedLeftRows?.length).toBe(1);
        expect(joinEvent?.unmatchedLeftRows?.[0].title).toBe('Unreviewed Film');
        expect(joinEvent?.unmatchedRightRows).toBeDefined();
        expect(joinEvent?.unmatchedRightRows?.length).toBe(0);
      } finally {
        await executeQuery(`DELETE FROM movies WHERE movie_id = 99`);
      }
    });

    it('should record unmatched rows when predicate matches nothing in outer join', async () => {
      const sql = `
        SELECT m.title, r.score
        FROM movies m
        LEFT JOIN reviews r ON r.movie_id = 999
      `;
      const plan = await recordQueryExecution(sql);
      const joinEvent = plan.events.find((e) => e.stage === 'JOIN');
      expect(joinEvent).toBeDefined();
      expect(joinEvent?.joinMatches).toBeDefined();
      expect(joinEvent?.joinMatches!.length).toBe(0);
      expect(joinEvent?.unmatchedLeftRows?.length).toBe(5);
      expect(joinEvent?.unmatchedRightRows?.length).toBe(8);
    });
  });

  describe('Phase 2 GROUP BY & Aggregate Formulas Recording', () => {
    it('should record group buckets and aggregate calculations for GROUP BY', async () => {
      const sql = `
        SELECT m.title, AVG(r.score) AS average_score
        FROM movies m
        JOIN reviews r ON r.movie_id = m.movie_id
        GROUP BY m.title
      `;
      const plan = await recordQueryExecution(sql);
      const groupEvent = plan.events.find((e) => e.stage === 'GROUP BY');

      expect(groupEvent).toBeDefined();
      expect(groupEvent?.groupBuckets).toBeDefined();
      expect(groupEvent?.groupBuckets!.length).toBeGreaterThan(0);

      const firstBucket = groupEvent!.groupBuckets![0];
      expect(firstBucket.groupKey).toBeDefined();
      expect(firstBucket.rows.length).toBeGreaterThan(0);
      expect(firstBucket.aggregates.length).toBeGreaterThan(0);

      const avgAgg = firstBucket.aggregates.find((a) => a.funcName === 'AVG');
      expect(avgAgg).toBeDefined();
      expect(avgAgg?.expression).toBe('r.score');
      expect(avgAgg?.inputValues.length).toBeGreaterThan(0);
      expect(avgAgg?.formulaStep).toContain('/');
      expect(typeof avgAgg?.finalValue).toBe('number');
    });

    it('should calculate multiple aggregate formulas (COUNT, SUM, MIN, MAX, AVG)', async () => {
      const sql = `
        SELECT m.title,
               COUNT(r.score) AS review_count,
               SUM(r.score) AS total_score,
               MIN(r.score) AS min_score,
               MAX(r.score) AS max_score,
               AVG(r.score) AS avg_score
        FROM movies m
        JOIN reviews r ON r.movie_id = m.movie_id
        GROUP BY m.title
      `;
      const plan = await recordQueryExecution(sql);
      const groupEvent = plan.events.find((e) => e.stage === 'GROUP BY');

      expect(groupEvent).toBeDefined();
      expect(groupEvent?.groupBuckets).toBeDefined();
      const bucket = groupEvent?.groupBuckets?.find((b) => b.groupKey === 'Inception');
      expect(bucket).toBeDefined();
      expect(bucket?.aggregates.length).toBe(5);

      const countAgg = bucket?.aggregates.find((a) => a.funcName === 'COUNT');
      expect(countAgg?.formulaStep).toContain('non-null values');
      expect(countAgg?.finalValue).toBe(2);

      const sumAgg = bucket?.aggregates.find((a) => a.funcName === 'SUM');
      expect(sumAgg?.formulaStep).toContain('+');
      expect(sumAgg?.finalValue).toBe(17); // 9 + 8

      const minAgg = bucket?.aggregates.find((a) => a.funcName === 'MIN');
      expect(minAgg?.formulaStep).toContain('MIN');
      expect(minAgg?.finalValue).toBe(8);

      const maxAgg = bucket?.aggregates.find((a) => a.funcName === 'MAX');
      expect(maxAgg?.formulaStep).toContain('MAX');
      expect(maxAgg?.finalValue).toBe(9);

      const avgAgg = bucket?.aggregates.find((a) => a.funcName === 'AVG');
      expect(avgAgg?.finalValue).toBe(8.5);
    });

    it('should record HAVING group filtering with passed and rejected buckets', async () => {
      const sql = `
        SELECT m.title, AVG(r.score) AS average_score
        FROM movies m
        JOIN reviews r ON r.movie_id = m.movie_id
        GROUP BY m.title
        HAVING AVG(r.score) >= 8.5
      `;
      const plan = await recordQueryExecution(sql);
      expect(plan.stages).toContain('HAVING');

      const havingEvent = plan.events.find((e) => e.stage === 'HAVING');
      expect(havingEvent).toBeDefined();
      expect(havingEvent?.groupBuckets).toBeDefined();
      expect(havingEvent?.rejectedGroupBuckets).toBeDefined();

      // All buckets in groupBuckets should have havingPassed === true
      for (const bucket of havingEvent!.groupBuckets!) {
        expect(bucket.havingPassed).toBe(true);
        expect(bucket.havingPredicate).toBe('AVG(r.score) >= 8.5');
      }

      // All buckets in rejectedGroupBuckets should have havingPassed === false
      for (const bucket of havingEvent!.rejectedGroupBuckets!) {
        expect(bucket.havingPassed).toBe(false);
        expect(bucket.havingPredicate).toBe('AVG(r.score) >= 8.5');
      }

      // Inception has score 8.5, so it should be in passed groupBuckets
      const passedInception = havingEvent?.groupBuckets?.find((b) => b.groupKey === 'Inception');
      expect(passedInception).toBeDefined();

      // Oppenheimer has scores [9, 8], Pulp Fiction has [9], Barbie has [7, 8] (avg 7.5) -> Barbie should be rejected
      const rejectedBarbie = havingEvent?.rejectedGroupBuckets?.find((b) => b.groupKey === 'Barbie');
      expect(rejectedBarbie).toBeDefined();
    });

    it('should record DISTINCT deduplication metrics', async () => {
      const sql = `SELECT DISTINCT genre FROM movies`;
      const plan = await recordQueryExecution(sql);
      expect(plan.stages).toContain('DISTINCT');

      const distinctEvent = plan.events.find((e) => e.stage === 'DISTINCT');
      expect(distinctEvent).toBeDefined();
      expect(distinctEvent?.distinctDuplicatesRemoved).toBeDefined();
      expect(distinctEvent?.distinctDuplicatesRemoved).toBeGreaterThanOrEqual(0);
      expect(distinctEvent?.outputRows.length).toBeLessThanOrEqual(distinctEvent!.inputRows.length);
    });
  });
});

