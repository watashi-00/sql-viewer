import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { PredicateTree } from '../visualizer/PredicateTree';
import { ExecutionVisualizer } from '../visualizer/ExecutionVisualizer';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { ExecutionPlan, PredicateNode } from '../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('PredicateTree Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders null when node is undefined', () => {
    act(() => {
      root.render(React.createElement(PredicateTree, { node: undefined }));
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders a column node with columnName and info styling', () => {
    const colNode: PredicateNode = {
      type: 'column',
      columnName: 'score',
    };
    act(() => {
      root.render(React.createElement(PredicateTree, { node: colNode }));
    });
    const colSpan = container.querySelector('span.text-info');
    expect(colSpan).not.toBeNull();
    expect(colSpan?.textContent).toBe('score');
  });

  it('renders a literal node with value and success styling', () => {
    const litNode: PredicateNode = {
      type: 'literal',
      value: 7,
    };
    act(() => {
      root.render(React.createElement(PredicateTree, { node: litNode }));
    });
    const valSpan = container.querySelector('span.text-success');
    expect(valSpan).not.toBeNull();
    expect(valSpan?.textContent).toBe('7');
  });

  it('renders a binary node with operator badge and child branches', () => {
    const binaryNode: PredicateNode = {
      type: 'binary',
      operator: '>=',
      left: {
        type: 'column',
        columnName: 'r.score',
      },
      right: {
        type: 'literal',
        value: 7,
      },
    };
    act(() => {
      root.render(React.createElement(PredicateTree, { node: binaryNode }));
    });

    const opBadge = container.querySelector('span.bg-accent\\/20');
    expect(opBadge).not.toBeNull();
    expect(opBadge?.textContent).toBe('>=');

    const colSpan = container.querySelector('span.text-info');
    expect(colSpan?.textContent).toBe('r.score');

    const litSpan = container.querySelector('span.text-success');
    expect(litSpan?.textContent).toBe('7');
  });

  it('renders nested binary nodes recursively', () => {
    const nestedNode: PredicateNode = {
      type: 'binary',
      operator: 'AND',
      left: {
        type: 'binary',
        operator: '>=',
        left: { type: 'column', columnName: 'score' },
        right: { type: 'literal', value: 7 },
      },
      right: {
        type: 'binary',
        operator: '=',
        left: { type: 'column', columnName: 'genre' },
        right: { type: 'literal', value: 'Action' },
      },
    };

    act(() => {
      root.render(React.createElement(PredicateTree, { node: nestedNode }));
    });

    expect(container.textContent).toContain('AND');
    expect(container.textContent).toContain('>=');
    expect(container.textContent).toContain('=');
    expect(container.textContent).toContain('score');
    expect(container.textContent).toContain('7');
    expect(container.textContent).toContain('genre');
    expect(container.textContent).toContain('Action');
  });
});

describe('ExecutionVisualizer Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockPlan: ExecutionPlan = {
    query: 'SELECT * FROM movies WHERE score >= 7',
    stages: ['FROM', 'WHERE', 'SELECT'],
    events: [
      {
        id: 'event-from',
        stage: 'FROM',
        stageIndex: 0,
        title: 'Stage: FROM',
        description: 'Loaded rows from table movies',
        durationMs: 12,
        inputRows: [{ id: 1, title: 'Inception', score: 8.8 }, { id: 2, title: 'Movie B', score: 6.5 }],
        outputRows: [{ id: 1, title: 'Inception', score: 8.8 }, { id: 2, title: 'Movie B', score: 6.5 }],
      },
      {
        id: 'event-where',
        stage: 'WHERE',
        stageIndex: 1,
        title: 'Stage: WHERE',
        description: 'Filtered rows where score >= 7',
        durationMs: 5,
        inputRows: [{ id: 1, title: 'Inception', score: 8.8 }, { id: 2, title: 'Movie B', score: 6.5 }],
        outputRows: [{ id: 1, title: 'Inception', score: 8.8 }],
        rejectedRows: [{ id: 2, title: 'Movie B', score: 6.5 }],
        predicateTree: {
          type: 'binary',
          operator: '>=',
          left: { type: 'column', columnName: 'score' },
          right: { type: 'literal', value: 7 },
        },
      },
      {
        id: 'event-select',
        stage: 'SELECT',
        stageIndex: 2,
        title: 'Stage: SELECT',
        description: 'Projected columns',
        durationMs: 3,
        inputRows: [{ id: 1, title: 'Inception', score: 8.8 }],
        outputRows: [{ id: 1, title: 'Inception', score: 8.8 }],
      },
    ],
    finalResult: [{ id: 1, title: 'Inception', score: 8.8 }],
    columns: ['id', 'title', 'score'],
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useWorkspaceStore.setState({
      executionPlan: null,
      stages: [],
      currentStageIndex: 0,
      debugState: 'idle',
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders toolbar with debug state and empty state message when no plan', () => {
    act(() => {
      root.render(React.createElement(ExecutionVisualizer));
    });

    expect(container.textContent).toContain('SQL DEBUGGER');
    expect(container.textContent?.toLowerCase()).toContain('idle');
    expect(container.textContent).toContain('No query executed. Press Run to start debugging pipeline.');
    expect(container.textContent).toContain('Execute a query to inspect logical stage step transformations.');
  });

  it('disables control buttons when executionPlan is null', () => {
    act(() => {
      root.render(React.createElement(ExecutionVisualizer));
    });

    const restartBtn = container.querySelector('button[title="Restart (Ctrl+R)"]') as HTMLButtonElement;
    const stepBackBtn = container.querySelector('button[title="Step Back (Shift+F10)"]') as HTMLButtonElement;
    const stepFwdBtn = container.querySelector('button[title="Step Forward (F10)"]') as HTMLButtonElement;
    const runBtn = container.querySelector('button[title="Run Query (F5)"]') as HTMLButtonElement;

    expect(restartBtn.disabled).toBe(true);
    expect(stepBackBtn.disabled).toBe(true);
    expect(stepFwdBtn.disabled).toBe(true);
    expect(runBtn.disabled).toBe(false);
  });

  it('calls runQuery when Run button is clicked', () => {
    const runQuerySpy = vi.fn().mockResolvedValue(undefined);
    useWorkspaceStore.setState({ runQuery: runQuerySpy });

    act(() => {
      root.render(React.createElement(ExecutionVisualizer));
    });

    const runBtn = container.querySelector('button[title="Run Query (F5)"]') as HTMLButtonElement;
    act(() => {
      runBtn.click();
    });

    expect(runQuerySpy).toHaveBeenCalledTimes(1);
  });

  it('renders pipeline stages with indicators and allows jumping to a stage', () => {
    const jumpToStageSpy = vi.fn();
    useWorkspaceStore.setState({
      executionPlan: mockPlan,
      stages: mockPlan.stages,
      currentStageIndex: 1,
      debugState: 'paused',
      jumpToStage: jumpToStageSpy,
    });

    act(() => {
      root.render(React.createElement(ExecutionVisualizer));
    });

    expect(container.textContent).toContain('FROM');
    expect(container.textContent).toContain('WHERE');
    expect(container.textContent).toContain('SELECT');

    // Stage 0 (FROM) is done -> should have CheckCircle2 (lucide icon)
    // Stage 1 (WHERE) is active -> should have Circle and active border/bg class
    // Click on Stage 2 (SELECT)
    const stageElements = container.querySelectorAll('.cursor-pointer');
    expect(stageElements.length).toBe(3);

    act(() => {
      (stageElements[2] as HTMLElement).click();
    });

    expect(jumpToStageSpy).toHaveBeenCalledWith(2);
  });

  it('handles stepForward, stepBack, and restartDebug button clicks', () => {
    const stepFwdSpy = vi.fn();
    const stepBackSpy = vi.fn();
    const restartSpy = vi.fn();

    useWorkspaceStore.setState({
      executionPlan: mockPlan,
      stages: mockPlan.stages,
      currentStageIndex: 1,
      debugState: 'paused',
      stepForward: stepFwdSpy,
      stepBack: stepBackSpy,
      restartDebug: restartSpy,
    });

    act(() => {
      root.render(React.createElement(ExecutionVisualizer));
    });

    const restartBtn = container.querySelector('button[title="Restart (Ctrl+R)"]') as HTMLButtonElement;
    const stepBackBtn = container.querySelector('button[title="Step Back (Shift+F10)"]') as HTMLButtonElement;
    const stepFwdBtn = container.querySelector('button[title="Step Forward (F10)"]') as HTMLButtonElement;

    expect(restartBtn.disabled).toBe(false);
    expect(stepBackBtn.disabled).toBe(false);
    expect(stepFwdBtn.disabled).toBe(false);

    act(() => {
      stepBackBtn.click();
    });
    expect(stepBackSpy).toHaveBeenCalledTimes(1);

    act(() => {
      stepFwdBtn.click();
    });
    expect(stepFwdSpy).toHaveBeenCalledTimes(1);

    act(() => {
      restartBtn.click();
    });
    expect(restartSpy).toHaveBeenCalledTimes(1);
  });

  it('disables stepBack at first stage and stepForward at last stage', () => {
    useWorkspaceStore.setState({
      executionPlan: mockPlan,
      stages: mockPlan.stages,
      currentStageIndex: 0,
    });

    act(() => {
      root.render(React.createElement(ExecutionVisualizer));
    });

    let stepBackBtn = container.querySelector('button[title="Step Back (Shift+F10)"]') as HTMLButtonElement;
    let stepFwdBtn = container.querySelector('button[title="Step Forward (F10)"]') as HTMLButtonElement;
    expect(stepBackBtn.disabled).toBe(true);
    expect(stepFwdBtn.disabled).toBe(false);

    act(() => {
      useWorkspaceStore.setState({
        currentStageIndex: 2,
      });
      root.render(React.createElement(ExecutionVisualizer));
    });

    stepBackBtn = container.querySelector('button[title="Step Back (Shift+F10)"]') as HTMLButtonElement;
    stepFwdBtn = container.querySelector('button[title="Step Forward (F10)"]') as HTMLButtonElement;
    expect(stepBackBtn.disabled).toBe(false);
    expect(stepFwdBtn.disabled).toBe(true);
  });

  it('renders stage details: title, description, duration, and row metrics', () => {
    useWorkspaceStore.setState({
      executionPlan: mockPlan,
      stages: mockPlan.stages,
      currentStageIndex: 1, // WHERE stage
      debugState: 'paused',
    });

    act(() => {
      root.render(React.createElement(ExecutionVisualizer));
    });

    expect(container.textContent).toContain('Stage: WHERE');
    expect(container.textContent).toContain('Filtered rows where score >= 7');
    expect(container.textContent).toContain('5 ms');

    // Check row metrics
    expect(container.textContent).toContain('INPUT ROWS');
    expect(container.textContent).toContain('OUTPUT ROWS');
    expect(container.textContent).toContain('REJECTED ROWS');

    // Input rows = 2, Output rows = 1, Rejected rows = 1
    const text = container.textContent || '';
    expect(text).toContain('INPUT ROWS2');
    expect(text).toContain('OUTPUT ROWS1');
    expect(text).toContain('REJECTED ROWS1');
  });

  it('renders PredicateTree when current stage has predicateTree', () => {
    useWorkspaceStore.setState({
      executionPlan: mockPlan,
      stages: mockPlan.stages,
      currentStageIndex: 1, // WHERE stage with predicateTree
      debugState: 'paused',
    });

    act(() => {
      root.render(React.createElement(ExecutionVisualizer));
    });

    expect(container.textContent).toContain('Predicate Evaluation Tree');
    expect(container.textContent).toContain('>=');
    expect(container.textContent).toContain('score');
    expect(container.textContent).toContain('7');
  });

  it('does not render PredicateTree section when predicateTree is not present', () => {
    useWorkspaceStore.setState({
      executionPlan: mockPlan,
      stages: mockPlan.stages,
      currentStageIndex: 0, // FROM stage has no predicateTree
      debugState: 'paused',
    });

    act(() => {
      root.render(React.createElement(ExecutionVisualizer));
    });

    expect(container.textContent).not.toContain('PREDICATE EVALUATION TREE');
  });

  it('renders JoinVisualizer when stage is JOIN', () => {
    const joinPlan: ExecutionPlan = {
      query: 'SELECT * FROM A JOIN B ON A.id = B.a_id',
      stages: ['JOIN'],
      events: [
        {
          id: 'event-join',
          stage: 'JOIN',
          stageIndex: 0,
          title: 'Stage: JOIN',
          description: 'Joined A and B',
          inputRows: [{ id: 1 }, { id: 2 }],
          outputRows: [{ id: 1, a_id: 1 }],
          joinMatches: [
            {
              leftRowId: 1,
              rightRowId: 1,
              isMatch: true,
              leftValues: { id: 1, title: 'Inception' },
              rightValues: { a_id: 1, title: 'Inception' },
              joinPredicate: 'A.id = B.a_id',
            },
          ],
        },
      ],
      finalResult: [],
      columns: [],
    };

    useWorkspaceStore.setState({
      executionPlan: joinPlan,
      stages: joinPlan.stages,
      currentStageIndex: 0,
      debugState: 'paused',
    });

    act(() => {
      root.render(React.createElement(ExecutionVisualizer));
    });

    expect(container.textContent).toContain('LEFT RELATION');
    expect(container.textContent).toContain('Inception');
  });

  it('renders GroupByVisualizer when stage is GROUP BY or HAVING', () => {
    const groupByPlan: ExecutionPlan = {
      query: 'SELECT genre, COUNT(*) FROM movies GROUP BY genre HAVING COUNT(*) > 1',
      stages: ['GROUP BY', 'HAVING'],
      events: [
        {
          id: 'event-groupby',
          stage: 'GROUP BY',
          stageIndex: 0,
          title: 'Stage: GROUP BY',
          description: 'Grouped rows by genre',
          inputRows: [{ genre: 'Action' }],
          outputRows: [{ genre: 'Action', count: 2 }],
          groupBuckets: [
            {
              groupKey: 'Action',
              rows: [{ genre: 'Action' }, { genre: 'Action' }],
              aggregates: [],
            },
          ],
        },
        {
          id: 'event-having',
          stage: 'HAVING',
          stageIndex: 1,
          title: 'Stage: HAVING',
          description: 'Filtered groups',
          inputRows: [{ genre: 'Action', count: 2 }],
          outputRows: [{ genre: 'Action', count: 2 }],
          groupBuckets: [
            {
              groupKey: 'Action',
              rows: [{ genre: 'Action' }, { genre: 'Action' }],
              aggregates: [],
            },
          ],
        },
      ],
      finalResult: [],
      columns: [],
    };

    // Test GROUP BY
    useWorkspaceStore.setState({
      executionPlan: groupByPlan,
      stages: groupByPlan.stages,
      currentStageIndex: 0,
      debugState: 'paused',
    });

    act(() => {
      root.render(React.createElement(ExecutionVisualizer));
    });

    expect(container.textContent).toContain('GROUP BY PARTITIONS');
    expect(container.textContent).toContain('Action');

    // Test HAVING
    act(() => {
      useWorkspaceStore.setState({
        currentStageIndex: 1,
      });
      root.render(React.createElement(ExecutionVisualizer));
    });

    expect(container.textContent).toContain('GROUP BY PARTITIONS');
  });

  it('renders DistinctVisualizer when stage is DISTINCT', () => {
    const distinctPlan: ExecutionPlan = {
      query: 'SELECT DISTINCT genre FROM movies',
      stages: ['DISTINCT'],
      events: [
        {
          id: 'event-distinct',
          stage: 'DISTINCT',
          stageIndex: 0,
          title: 'Stage: DISTINCT',
          description: 'Deduplicated rows',
          inputRows: [{ genre: 'Action' }, { genre: 'Action' }, { genre: 'Drama' }],
          outputRows: [{ genre: 'Action' }, { genre: 'Drama' }],
          distinctDuplicatesRemoved: 1,
        },
      ],
      finalResult: [],
      columns: [],
    };

    useWorkspaceStore.setState({
      executionPlan: distinctPlan,
      stages: distinctPlan.stages,
      currentStageIndex: 0,
      debugState: 'paused',
    });

    act(() => {
      root.render(React.createElement(ExecutionVisualizer));
    });

    expect(container.textContent).toContain('DISTINCT DEDUPLICATION');
    expect(container.textContent).toContain('1 Duplicates Collapsed');
  });
});

