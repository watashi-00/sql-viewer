import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import * as schemaModule from '../database/schema';
import * as recorderModule from '../debugger/executionRecorder';
import * as historyStoreModule from '../storage/historyStore';
import { Schema, ExecutionPlan } from '../types';

describe('Workspace Store', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      sql: `SELECT
    m.title,
    AVG(r.score) AS average_score
FROM movies m
JOIN reviews r
    ON r.movie_id = m.movie_id
WHERE r.score >= 7
GROUP BY m.title
ORDER BY average_score DESC
LIMIT 5;`,
      schema: null,
      queryError: null,
      lastExecutionMode: null,
      debugState: 'idle',
      executionPlan: null,
      stages: [],
      currentStageIndex: 0,
      resultRows: [],
      resultColumns: [],
      selectedRow: null,
      isInspectingRow: false,
    });
    vi.restoreAllMocks();
  });

  it('should initialize with default SQL and idle debug state', () => {
    const state = useWorkspaceStore.getState();
    expect(state.debugState).toBe('idle');
    expect(state.sql).toContain('SELECT');
    expect(state.schema).toBeNull();
    expect(state.queryError).toBeNull();
    expect(state.executionPlan).toBeNull();
    expect(state.stages).toEqual([]);
    expect(state.currentStageIndex).toBe(0);
    expect(state.resultRows).toEqual([]);
    expect(state.resultColumns).toEqual([]);
    expect(state.selectedRow).toBeNull();
    expect(state.isInspectingRow).toBe(false);
  });

  it('should update sql when setSql is called', () => {
    useWorkspaceStore.getState().setSql('SELECT * FROM movies;');
    expect(useWorkspaceStore.getState().sql).toBe('SELECT * FROM movies;');
  });

  it('should update selectedRow and isInspectingRow', () => {
    const row = { movie_id: 1, title: 'Inception' };
    useWorkspaceStore.getState().setSelectedRow(row);
    expect(useWorkspaceStore.getState().selectedRow).toEqual(row);
    expect(useWorkspaceStore.getState().isInspectingRow).toBe(true);

    useWorkspaceStore.getState().setSelectedRow(null);
    expect(useWorkspaceStore.getState().selectedRow).toBeNull();
    expect(useWorkspaceStore.getState().isInspectingRow).toBe(false);
  });

  it('should update step position on stepForward', () => {
    useWorkspaceStore.setState({
      stages: ['FROM', 'JOIN', 'WHERE'],
      currentStageIndex: 0,
      debugState: 'paused',
    });

    useWorkspaceStore.getState().stepForward();
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(1);
    expect(useWorkspaceStore.getState().debugState).toBe('paused');
  });

  it('should set debugState to completed on stepForward at the last stage', () => {
    useWorkspaceStore.setState({
      stages: ['FROM', 'JOIN'],
      currentStageIndex: 1,
      debugState: 'paused',
    });

    useWorkspaceStore.getState().stepForward();
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(1);
    expect(useWorkspaceStore.getState().debugState).toBe('completed');
  });

  it('should step back when currentStageIndex > 0 and set debugState to paused', () => {
    useWorkspaceStore.setState({
      stages: ['FROM', 'JOIN', 'WHERE'],
      currentStageIndex: 2,
      debugState: 'completed',
    });

    useWorkspaceStore.getState().stepBack();
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(1);
    expect(useWorkspaceStore.getState().debugState).toBe('paused');

    useWorkspaceStore.getState().stepBack();
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(0);
    expect(useWorkspaceStore.getState().debugState).toBe('paused');

    // Should not step back below 0
    useWorkspaceStore.getState().stepBack();
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(0);
  });

  it('should restart debug by resetting stage index to 0 and debugState to paused', () => {
    useWorkspaceStore.setState({
      stages: ['FROM', 'JOIN', 'WHERE'],
      currentStageIndex: 2,
      debugState: 'completed',
    });

    useWorkspaceStore.getState().restartDebug();
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(0);
    expect(useWorkspaceStore.getState().debugState).toBe('paused');
  });

  it('should jump to a specific valid stage and set debugState to paused', () => {
    useWorkspaceStore.setState({
      stages: ['FROM', 'JOIN', 'WHERE', 'SELECT'],
      currentStageIndex: 0,
      debugState: 'paused',
    });

    useWorkspaceStore.getState().jumpToStage(2);
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(2);
    expect(useWorkspaceStore.getState().debugState).toBe('paused');

    // Out of bounds jumps should be ignored
    useWorkspaceStore.getState().jumpToStage(-1);
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(2);

    useWorkspaceStore.getState().jumpToStage(10);
    expect(useWorkspaceStore.getState().currentStageIndex).toBe(2);
  });

  it('should seed dataset and load schema on loadSchema', async () => {
    const mockSchema: Schema = {
      name: 'main',
      tables: [
        {
          name: 'movies',
          schema: 'main',
          columns: [{ name: 'movie_id', type: 'INTEGER' }],
          rowCount: 10,
        },
      ],
    };

    const seedSpy = vi.spyOn(schemaModule, 'seedMoviesDataset').mockResolvedValue(undefined);
    const schemaSpy = vi.spyOn(schemaModule, 'getIntrospectedSchema').mockResolvedValue(mockSchema);

    await useWorkspaceStore.getState().loadSchema();

    expect(seedSpy).toHaveBeenCalledOnce();
    expect(schemaSpy).toHaveBeenCalledOnce();
    expect(useWorkspaceStore.getState().schema).toEqual(mockSchema);
  });

  it('should execute query and update execution plan, stages, and results on runQuery success', async () => {
    const mockPlan: ExecutionPlan = {
      query: 'SELECT * FROM movies',
      stages: ['FROM', 'SELECT'],
      events: [
        {
          id: '1',
          stage: 'FROM',
          stageIndex: 0,
          title: 'FROM',
          description: 'Loaded rows',
          inputRows: [],
          outputRows: [{ movie_id: 1, title: 'Inception' }],
        },
      ],
      finalResult: [{ movie_id: 1, title: 'Inception' }],
      columns: ['movie_id', 'title'],
    };

    const recordSpy = vi.spyOn(recorderModule, 'recordQueryExecution').mockResolvedValue(mockPlan);

    await useWorkspaceStore.getState().runQuery();

    expect(recordSpy).toHaveBeenCalledWith(useWorkspaceStore.getState().sql);
    const state = useWorkspaceStore.getState();
    expect(state.executionPlan).toEqual(mockPlan);
    expect(state.stages).toEqual(['FROM', 'SELECT']);
    expect(state.currentStageIndex).toBe(0);
    expect(state.resultRows).toEqual(mockPlan.finalResult);
    expect(state.resultColumns).toEqual(mockPlan.columns);
    expect(state.debugState).toBe('paused');
  });

  it('should refresh the schema after a CREATE TABLE command succeeds', async () => {
    const mockPlan: ExecutionPlan = {
      query: 'CREATE TABLE clients (id INTEGER)',
      stages: [],
      events: [],
      finalResult: [],
      columns: [],
    };
    const mockSchema: Schema = { name: 'main', tables: [] };
    const recordSpy = vi.spyOn(recorderModule, 'recordQueryExecution').mockResolvedValue(mockPlan);
    const seedSpy = vi.spyOn(schemaModule, 'seedMoviesDataset').mockResolvedValue(undefined);
    const schemaSpy = vi.spyOn(schemaModule, 'getIntrospectedSchema').mockResolvedValue(mockSchema);

    useWorkspaceStore.getState().setSql(mockPlan.query);
    await useWorkspaceStore.getState().runQuery();

    expect(recordSpy).toHaveBeenCalledWith(mockPlan.query);
    expect(seedSpy).toHaveBeenCalledOnce();
    expect(schemaSpy).toHaveBeenCalledOnce();
    expect(useWorkspaceStore.getState().schema).toEqual(mockSchema);
    expect(useWorkspaceStore.getState().debugState).toBe('paused');
  });

  it('should set debugState to error when recordQueryExecution fails in runQuery', async () => {
    vi.spyOn(recorderModule, 'recordQueryExecution').mockRejectedValue(new Error('Syntax error'));
    useWorkspaceStore.setState({
      executionPlan: {
        query: 'SELECT 1', stages: ['SELECT'], events: [], finalResult: [{ value: 1 }], columns: ['value'],
      },
      resultRows: [{ value: 1 }],
      resultColumns: ['value'],
    });

    await useWorkspaceStore.getState().runQuery();

    expect(useWorkspaceStore.getState().debugState).toBe('error');
    expect(useWorkspaceStore.getState().queryError?.category).toBe('parser');
    expect(useWorkspaceStore.getState().executionPlan).toBeNull();
    expect(useWorkspaceStore.getState().resultRows).toEqual([]);

    useWorkspaceStore.getState().setSql('SELECT 2');
    expect(useWorkspaceStore.getState().queryError).toBeNull();
    expect(useWorkspaceStore.getState().debugState).toBe('idle');
  });

  it('runs selected SQL without replacing the editor contents and records selection mode', async () => {
    const selectedSql = 'SELECT movie_id FROM movies';
    const plan: ExecutionPlan = {
      query: selectedSql,
      stages: ['FROM', 'SELECT'],
      events: [],
      finalResult: [{ movie_id: 1 }],
      columns: ['movie_id'],
    };
    const recordSpy = vi.spyOn(recorderModule, 'recordQueryExecution').mockResolvedValue(plan);
    const historySpy = vi.spyOn(historyStoreModule, 'addHistoryItem').mockResolvedValue(undefined);
    const editorSql = 'SELECT 1;\nSELECT movie_id FROM movies;';
    useWorkspaceStore.getState().setSql(editorSql);

    await useWorkspaceStore.getState().runQuery(selectedSql, { line: 2, column: 1 });

    expect(recordSpy).toHaveBeenCalledWith(selectedSql);
    expect(useWorkspaceStore.getState().sql).toBe(editorSql);
    expect(useWorkspaceStore.getState().lastExecutionMode).toBe('selection');
    expect(historySpy).toHaveBeenCalledWith(expect.objectContaining({ sql: selectedSql, status: 'success' }));
  });

  it('maps selected-query error locations back to editor coordinates', async () => {
    const parserError = new SyntaxError('Expected a column name');
    Object.assign(parserError, { location: { start: { line: 1, column: 4 } } });
    vi.spyOn(recorderModule, 'recordQueryExecution').mockRejectedValue(parserError);
    vi.spyOn(historyStoreModule, 'addHistoryItem').mockResolvedValue(undefined);

    await useWorkspaceStore.getState().runQuery('SELECT FROM movies', { line: 5, column: 4 });

    expect(useWorkspaceStore.getState().queryError).toMatchObject({ line: 5, column: 7 });
    expect(useWorkspaceStore.getState().lastExecutionMode).toBe('selection');
  });

  it('should automatically record executed queries into historyStore on runQuery success', async () => {
    const mockPlan: ExecutionPlan = {
      query: 'SELECT * FROM movies',
      stages: ['FROM', 'SELECT'],
      events: [],
      finalResult: [{ movie_id: 1 }],
      columns: ['movie_id'],
    };

    const addHistorySpy = vi.spyOn(historyStoreModule, 'addHistoryItem').mockResolvedValue(undefined);
    vi.spyOn(recorderModule, 'recordQueryExecution').mockResolvedValue(mockPlan);

    await useWorkspaceStore.getState().runQuery();

    expect(addHistorySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: useWorkspaceStore.getState().sql,
        rowCount: 1,
        status: 'success',
      })
    );
  });
});
