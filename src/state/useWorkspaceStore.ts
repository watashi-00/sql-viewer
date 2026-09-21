import { create } from 'zustand';
import { DebugState, ExecutionPlan, OperationType, Schema, DataRow } from '../types';
import { isCreateTableStatement, recordQueryExecution } from '../debugger/executionRecorder';
import { getIntrospectedSchema, seedMoviesDataset } from '../database/schema';
import { addHistoryItem } from '../storage/historyStore';

export const DEFAULT_QUERY = `SELECT
    m.title,
    AVG(r.score) AS average_score
FROM movies m
JOIN reviews r
    ON r.movie_id = m.movie_id
WHERE r.score >= 7
GROUP BY m.title
ORDER BY average_score DESC
LIMIT 5;`;

export interface WorkspaceStore {
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
    const startTime = performance.now();
    const sql = get().sql;
    try {
      const plan = await recordQueryExecution(sql);
      const durationMs = performance.now() - startTime;
      set({
        executionPlan: plan,
        stages: plan.stages,
        currentStageIndex: 0,
        resultRows: plan.finalResult,
        resultColumns: plan.columns,
        debugState: 'paused',
      });
      if (isCreateTableStatement(sql)) {
        await get().loadSchema();
      }
      await addHistoryItem({
        id: `h-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sql,
        timestamp: Date.now(),
        durationMs,
        rowCount: plan.finalResult.length,
        status: 'success',
      });
    } catch (err: any) {
      const durationMs = performance.now() - startTime;
      set({ debugState: 'error' });
      await addHistoryItem({
        id: `h-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sql: get().sql,
        timestamp: Date.now(),
        durationMs,
        rowCount: 0,
        status: 'error',
        errorMessage: err?.message || 'Query execution error',
      });
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

  setSelectedRow: (row) => set({ selectedRow: row, isInspectingRow: !!row }),
}));
