import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight, Circle, Clock3, Lightbulb, Play, Search, Trophy } from 'lucide-react';
import { SqlEditor } from '../editor/SqlEditor';
import { ExecutionVisualizer } from '../visualizer/ExecutionVisualizer';
import { ResultGrid } from '../inspector/ResultGrid';
import { AppTheme } from '../theme';
import { DataRow, DebugState, ExecutionPlan, OperationType } from '../types';
import { challengeCatalog } from './catalog';
import { ChallengeSession, compareChallengeResults, createChallengeSession } from './challengeSession';
import { recordQueryExecution } from '../debugger/executionRecorder';
import { diagnoseSqlError, SqlDiagnostic } from '../editor/sqlDiagnostics';

const PROGRESS_KEY = 'sql-viewer-challenge-progress-v1';
type Progress = Record<string, { solved: boolean; attempts: number }>;

function readProgress(): Progress {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') as Progress; } catch { return {}; }
}

function saveProgress(progress: Progress): void {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* Progress remains available for this session. */ }
}

interface ChallengesPageProps { theme: AppTheme; }

export const ChallengesPage: React.FC<ChallengesPageProps> = ({ theme }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('All levels');
  const [progress, setProgress] = useState<Progress>(readProgress);
  const [sqlDrafts, setSqlDrafts] = useState<Record<string, string>>({});
  const [session, setSession] = useState<ChallengeSession | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<{ plan: ExecutionPlan | null; rows: any[]; columns: string[]; diagnostic: SqlDiagnostic | null; passed: boolean | null }>({ plan: null, rows: [], columns: [], diagnostic: null, passed: null });
  const [stageIndex, setStageIndex] = useState(0);
  const [state, setState] = useState<DebugState>('idle');
  const [visibleHints, setVisibleHints] = useState(0);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedResultRow, setSelectedResultRow] = useState<DataRow | null>(null);
  const challenge = challengeCatalog.find((item) => item.id === selectedId) ?? null;
  const sql = challenge ? (sqlDrafts[challenge.id] ?? challenge.starterSql) : '';

  const filteredChallenges = useMemo(() => challengeCatalog.filter((item) => {
    const matchesText = `${item.title} ${item.summary} ${item.topics.join(' ')}`.toLowerCase().includes(query.toLowerCase());
    return matchesText && (difficulty === 'All levels' || item.difficulty === difficulty);
  }), [difficulty, query]);

  useEffect(() => {
    if (!challenge) return;
    let active = true;
    setSession(null);
    setSessionError(null);
    setAttempt({ plan: null, rows: [], columns: [], diagnostic: null, passed: null });
    setSelectedResultRow(null);
    setStageIndex(0);
    setState('running');
    setVisibleHints(0);
    void createChallengeSession(challenge).then((nextSession) => {
      if (!active) { void nextSession.close(); return; }
      setSession(nextSession);
      setState('idle');
    }).catch((error: unknown) => {
      if (!active) return;
      setSessionError(error instanceof Error ? error.message : String(error));
      setState('error');
    });
    return () => { active = false; };
  }, [challenge?.id]);

  useEffect(() => () => { if (session) void session.close(); }, [session]);

  const changeSql = (value: string) => {
    if (!challenge) return;
    setSqlDrafts((drafts) => ({ ...drafts, [challenge.id]: value }));
    if (attempt.diagnostic) setAttempt((current) => ({ ...current, diagnostic: null, passed: null }));
  };

  const run = async (override?: string) => {
    if (!challenge || !session || busy) return;
    const statement = override?.trim() || sql;
    setBusy(true);
    setState('running');
    setAttempt({ plan: null, rows: [], columns: [], diagnostic: null, passed: null });
    setSelectedResultRow(null);
    try {
      const plan = await recordQueryExecution(statement, { execute: session.execute, persistMutations: false });
      const expected = await session.execute(challenge.solutionSql);
      const outputColumns = plan.columns;
      const passed = outputColumns.length === expected.columns.length
        && outputColumns.every((column, index) => column === expected.columns[index])
        && compareChallengeResults(plan.finalResult, expected.rows, outputColumns, {
        ordered: challenge.ordered,
        floatTolerance: challenge.floatTolerance,
      });
      setAttempt({ plan, rows: plan.finalResult, columns: outputColumns, diagnostic: null, passed });
      setStageIndex(0);
      setState('paused');
      const nextProgress = { ...readProgress() };
      const previous = nextProgress[challenge.id] ?? { solved: false, attempts: 0 };
      nextProgress[challenge.id] = { solved: previous.solved || passed, attempts: previous.attempts + 1 };
      saveProgress(nextProgress);
      setProgress(nextProgress);
    } catch (error: unknown) {
      const diagnostic = diagnoseSqlError(error, statement);
      setAttempt({ plan: null, rows: [], columns: [], diagnostic, passed: false });
      setState('error');
      const nextProgress = { ...readProgress() };
      const previous = nextProgress[challenge.id] ?? { solved: false, attempts: 0 };
      nextProgress[challenge.id] = { solved: previous.solved, attempts: previous.attempts + 1 };
      saveProgress(nextProgress);
      setProgress(nextProgress);
    } finally {
      setBusy(false);
    }
  };

  const controller = {
    executionPlan: attempt.plan,
    stages: attempt.plan?.stages ?? [] as OperationType[],
    currentStageIndex: stageIndex,
    debugState: state,
    stepForward: () => setStageIndex((index) => Math.min(index + 1, (attempt.plan?.stages.length ?? 1) - 1)),
    stepBack: () => setStageIndex((index) => Math.max(0, index - 1)),
    restartDebug: () => setStageIndex(0),
    runQuery: () => run(),
    jumpToStage: (index: number) => setStageIndex(index),
  };

  const backToCatalog = () => setSelectedId(null);
  const solvedCount = Object.values(progress).filter((entry) => entry.solved).length;

  if (!challenge) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-base">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-4">
          <div><div className="font-mono text-[10px] tracking-[0.2em] text-accent">SQL PRACTICE</div><h1 className="mt-1 text-xl font-semibold">Challenges</h1><p className="mt-1 text-sm text-secondary">Solve SQL problems against real datasets and inspect how each query works.</p></div>
          <div className="flex items-center gap-4 text-xs text-secondary"><span className="flex items-center gap-1.5"><Trophy size={14} className="text-accent" />{solvedCount} solved</span><button type="button" onClick={() => setContributeOpen(true)} className="rounded border border-border bg-surface-secondary px-3 py-2 text-primary hover:border-accent/50">Contribute a challenge</button></div>
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface">
            <div className="space-y-2 border-b border-border p-3">
              <label className="flex items-center gap-2 rounded border border-border bg-base px-2.5 py-2"><Search size={14} className="text-muted" /><input aria-label="Search challenges" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search challenges" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted" /></label>
              <select aria-label="Filter by difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="w-full rounded border border-border bg-base px-2.5 py-2 text-xs text-secondary"><option>All levels</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filteredChallenges.map((item, index) => {
                const solved = progress[item.id]?.solved;
                return <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="mb-1 flex w-full items-start gap-2 rounded-lg p-3 text-left hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent">
                  {solved ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" /> : <Circle size={15} className="mt-0.5 shrink-0 text-muted" />}
                  <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-primary">{index + 1}. {item.title}</span><span className="mt-1 block text-[10px] text-muted">{item.difficulty} · {item.topics.slice(0, 2).join(', ')}</span></span><ChevronRight size={14} className="mt-0.5 text-muted" />
                </button>;
              })}
              {filteredChallenges.length === 0 && <p className="p-4 text-xs text-muted">No challenges match those filters.</p>}
            </div>
          </aside>
          <div className="min-w-0 flex-1 overflow-y-auto p-8">
            <div className="mx-auto max-w-4xl">
              <div className="mb-6 flex items-center gap-2 text-xs text-muted"><span>Challenges</span><ChevronRight size={12} /><span className="text-secondary">Problem set</span></div>
              <h2 className="text-2xl font-semibold">Build your SQL skills</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">Every challenge has its own isolated dataset. Your attempt is checked by its result, so you can solve each problem using the SQL approach you prefer.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-border bg-surface p-4"><div className="text-lg font-semibold">{challengeCatalog.length}</div><div className="mt-1 text-xs text-muted">Challenges available</div></div><div className="rounded-lg border border-border bg-surface p-4"><div className="text-lg font-semibold">{solvedCount}</div><div className="mt-1 text-xs text-muted">Solved on this device</div></div><div className="rounded-lg border border-border bg-surface p-4"><div className="text-lg font-semibold">{new Set(challengeCatalog.flatMap((item) => item.topics)).size}</div><div className="mt-1 text-xs text-muted">SQL topics</div></div></div>
              <h3 className="mt-9 text-sm font-semibold">Start practicing</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{filteredChallenges.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent/50"><div className="flex items-center justify-between"><span className="text-sm font-semibold">{item.title}</span>{progress[item.id]?.solved && <CheckCircle2 size={15} className="text-emerald-400" />}</div><p className="mt-2 text-xs leading-5 text-secondary">{item.summary}</p><div className="mt-4 flex flex-wrap gap-1.5">{item.topics.map((topic) => <span key={topic} className="rounded bg-surface-secondary px-2 py-1 font-mono text-[10px] text-muted">{topic}</span>)}</div><div className="mt-4 flex items-center justify-between text-[10px] text-muted"><span>{item.difficulty}</span><span className="flex items-center gap-1 text-accent">Solve <ChevronRight size={12} /></span></div></button>)}</div>
            </div>
          </div>
        </div>
        {contributeOpen && <div role="dialog" aria-modal="true" aria-labelledby="contribute-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setContributeOpen(false); }}><section className="w-full max-w-xl rounded-xl border border-border bg-surface p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="contribute-title" className="text-lg font-semibold">Contribute a challenge</h2><p className="mt-1 text-sm text-secondary">Challenges live in the source catalog and can be added through a pull request.</p></div><button type="button" onClick={() => setContributeOpen(false)} className="text-muted hover:text-primary" aria-label="Close">×</button></div><ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-secondary"><li>Add a self-contained definition to <code className="text-accent">src/challenges/catalog.ts</code>.</li><li>Include setup SQL, a starter query, a result-based reference, topic tags, and progressive hints.</li><li>Keep the dataset isolated and small, and state explicitly if output order matters.</li><li>Run the project checks and submit a pull request with the challenge description.</li></ol><p className="mt-5 rounded-lg border border-border bg-base p-3 text-xs text-muted">Solutions are client-side learning material, so challenges are not suitable for secure exams or competitive leaderboards.</p></section></div>}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-base">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5"><div className="flex items-center gap-3"><button type="button" onClick={backToCatalog} aria-label="Back to challenges" className="rounded p-1.5 text-secondary hover:bg-surface-secondary hover:text-primary"><ArrowLeft size={16} /></button><div><div className="text-sm font-semibold">{challenge.title}</div><div className="mt-0.5 text-[10px] text-muted">{challenge.difficulty} · {challenge.topics.join(' · ')}</div></div></div><button type="button" onClick={() => setContributeOpen(true)} className="rounded border border-border px-2.5 py-1.5 text-[10px] text-secondary hover:text-primary">Contribute a challenge</button></div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="w-[34%] min-w-[280px] max-w-[520px] shrink-0 overflow-y-auto border-r border-border bg-surface p-5">
          <div className="font-mono text-[10px] tracking-widest text-muted">PROBLEM</div><h1 className="mt-2 text-xl font-semibold">{challenge.title}</h1><p className="mt-4 text-sm leading-6 text-secondary">{challenge.prompt}</p>
          <div className="mt-5 rounded-lg border border-border bg-base p-3"><div className="text-[10px] font-mono tracking-wider text-muted">DATASET</div><p className="mt-1 text-xs leading-5 text-secondary">Tables are loaded into a temporary schema for this challenge. Your workspace tables and history are not changed.</p></div>
          <div className="mt-6"><div className="flex items-center gap-2 text-xs font-semibold"><Lightbulb size={14} className="text-accent" />Hints <span className="font-normal text-muted">{visibleHints}/{challenge.hints.length}</span></div>{visibleHints > 0 && <div className="mt-2 space-y-2">{challenge.hints.slice(0, visibleHints).map((hint, index) => <div key={hint} className="rounded border border-border bg-base p-3 text-xs leading-5 text-secondary"><span className="mb-1 block font-mono text-[9px] text-muted">HINT {index + 1}</span>{hint}</div>)}</div>}{visibleHints < challenge.hints.length && <button type="button" onClick={() => setVisibleHints((count) => count + 1)} className="mt-2 text-xs text-accent hover:underline">Reveal next hint</button>}</div>
          {progress[challenge.id] && <div className="mt-6 flex items-center gap-2 text-xs text-muted"><Clock3 size={13} />{progress[challenge.id].attempts} attempts{progress[challenge.id].solved && <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 size={13} />Solved</span>}</div>}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-[36%] flex-1 flex-col overflow-hidden border-b border-border"><div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-secondary px-3 py-1.5 text-xs"><span className="font-mono text-[10px] font-semibold tracking-wider text-muted">YOUR SOLUTION</span><button type="button" onClick={() => void run()} disabled={!session || busy} className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-base disabled:opacity-50"><Play size={12} fill="currentColor" />{busy ? 'Running…' : 'Run & Check'}</button></div><div className="min-h-0 flex-1"><SqlEditor theme={theme} value={sql} onChange={changeSql} onRun={(statement) => run(statement)} diagnostic={attempt.diagnostic} /></div></div>
          <div className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden"><section className="min-w-0 overflow-hidden border-r border-border"><ExecutionVisualizer controller={controller} /></section><section className="min-w-0 overflow-hidden"><div className="flex h-full flex-col"><div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-3 py-2"><span className="font-mono text-[10px] tracking-wider text-muted">RESULTS</span>{attempt.passed !== null && <span className={`flex items-center gap-1.5 text-xs ${attempt.passed ? 'text-emerald-400' : 'text-error'}`}>{attempt.passed ? <CheckCircle2 size={13} /> : <Circle size={13} />}{attempt.passed ? 'Challenge passed' : 'Result does not match'}</span>}</div>{sessionError && <div role="alert" className="p-3 text-xs text-error">Could not load challenge data: {sessionError}</div>}<div className="min-h-0 flex-1"><ResultGrid rows={attempt.rows} columns={attempt.columns} selectedRowValue={selectedResultRow} onSelectRow={setSelectedResultRow} disableParquet /></div></div></section></div>
        </div>
      </div>
      {contributeOpen && <div role="dialog" aria-modal="true" aria-labelledby="contribute-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><section className="w-full max-w-xl rounded-xl border border-border bg-surface p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="contribute-title" className="text-lg font-semibold">Contribute a challenge</h2><p className="mt-1 text-sm text-secondary">Add a definition to <code className="text-accent">src/challenges/catalog.ts</code>, then open a pull request.</p></div><button type="button" onClick={() => setContributeOpen(false)} aria-label="Close" className="text-muted hover:text-primary">×</button></div><ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-secondary"><li>Write isolated setup SQL and a clear prompt with expected output columns.</li><li>Add a starter query, reference query, difficulty, topics, and progressive hints.</li><li>Use result comparison; set ordered output only when the prompt requires it.</li></ol></section></div>}
    </div>
  );
};
