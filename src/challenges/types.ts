import { DataRow, ExecutionPlan } from '../types';

export type ChallengeDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface ChallengeDefinition {
  id: string;
  title: string;
  summary: string;
  prompt: string;
  difficulty: ChallengeDifficulty;
  topics: string[];
  setupSql: string;
  starterSql: string;
  solutionSql: string;
  ordered?: boolean;
  floatTolerance?: number;
  hints: string[];
}

export interface ChallengeAttempt {
  sql: string;
  plan: ExecutionPlan | null;
  rows: DataRow[];
  columns: string[];
  error: string | null;
  passed: boolean | null;
}
