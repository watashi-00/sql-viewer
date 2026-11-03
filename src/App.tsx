import React, { useState, useEffect, useRef } from 'react';
import { DatabaseExplorer } from './schema/DatabaseExplorer';
import { SqlEditor } from './editor/SqlEditor';
import { VisualQueryBuilder } from './builder/VisualQueryBuilder';
import { ExecutionVisualizer } from './visualizer/ExecutionVisualizer';
import { ResultGrid } from './inspector/ResultGrid';
import { Play, RotateCcw, Layers, Palette, Share2, Check } from 'lucide-react';
import { useWorkspaceStore } from './state/useWorkspaceStore';
import { applyTheme, getInitialTheme, AppTheme } from './theme';
import { createShareableUrl, readShareableState } from './sharing/shareableQuery';
import { WorkspaceControls } from './storage/WorkspaceControls';
import { ResizeHandle } from './components/ResizeHandle';

interface PanelLayout {
  databaseOpen: boolean;
  editorOpen: boolean;
  debuggerOpen: boolean;
  resultsOpen: boolean;
  databaseWidth: number;
  debuggerRightWidth: number;
  resultsHeight: number;
}

const PANEL_LAYOUT_KEY = 'sql-viewer-panel-layout-v1';

const defaultPanelLayout: PanelLayout = {
  databaseOpen: true,
  editorOpen: true,
  debuggerOpen: true,
  resultsOpen: true,
  databaseWidth: 256,
  debuggerRightWidth: 48,
  resultsHeight: 34,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const readPanelLayout = (): PanelLayout => {
  try {
    const stored = localStorage.getItem(PANEL_LAYOUT_KEY);
    if (!stored) return defaultPanelLayout;
    const parsed = JSON.parse(stored) as Partial<PanelLayout>;
    return {
      databaseOpen: typeof parsed.databaseOpen === 'boolean' ? parsed.databaseOpen : defaultPanelLayout.databaseOpen,
      editorOpen: typeof parsed.editorOpen === 'boolean' ? parsed.editorOpen : defaultPanelLayout.editorOpen,
      debuggerOpen: typeof parsed.debuggerOpen === 'boolean' ? parsed.debuggerOpen : defaultPanelLayout.debuggerOpen,
      resultsOpen: typeof parsed.resultsOpen === 'boolean' ? parsed.resultsOpen : defaultPanelLayout.resultsOpen,
      databaseWidth: typeof parsed.databaseWidth === 'number' ? clamp(parsed.databaseWidth, 180, 440) : defaultPanelLayout.databaseWidth,
      debuggerRightWidth: typeof parsed.debuggerRightWidth === 'number' ? clamp(parsed.debuggerRightWidth, 28, 72) : defaultPanelLayout.debuggerRightWidth,
      resultsHeight: typeof parsed.resultsHeight === 'number' ? clamp(parsed.resultsHeight, 18, 70) : defaultPanelLayout.resultsHeight,
    };
  } catch {
    return defaultPanelLayout;
  }
};

interface PanelToggleProps {
  label: string;
  open: boolean;
  onClick: () => void;
}

const PanelToggle: React.FC<PanelToggleProps> = ({ label, open, onClick }) => (
  <button
    type="button"
    aria-pressed={open}
    onClick={onClick}
    title={`${open ? 'Hide' : 'Show'} ${label}`}
    className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
      open
        ? 'border-accent/40 bg-accent/10 text-accent'
        : 'border-border bg-surface text-muted hover:text-primary'
    }`}
  >
    <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-accent' : 'bg-muted'}`} />
    {label}
  </button>
);

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'editor' | 'builder'>('editor');
  const [theme, setTheme] = useState<AppTheme>(getInitialTheme);
  const [shareCopied, setShareCopied] = useState(false);
  const [panelLayout, setPanelLayout] = useState<PanelLayout>(readPanelLayout);
  const sharedStateApplied = useRef(false);
  const workspaceAreaRef = useRef<HTMLDivElement>(null);
  const contentRegionRef = useRef<HTMLDivElement>(null);
  const saveLayoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { schema, setSql, runQuery, restartDebug, jumpToStage, sql, currentStageIndex } = useWorkspaceStore();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const sharedState = readShareableState();
    if (!schema || !sharedState || sharedStateApplied.current) return;

    sharedStateApplied.current = true;
    setSql(sharedState.sql);
    void runQuery().then(() => jumpToStage(sharedState.stage));
  }, [schema, setSql, runQuery, jumpToStage]);

  useEffect(() => {
    if (saveLayoutTimer.current) clearTimeout(saveLayoutTimer.current);
    saveLayoutTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(panelLayout));
      } catch {
        // Keep the current layout for this session when browser storage is unavailable.
      }
    }, 150);
    return () => {
      if (saveLayoutTimer.current) clearTimeout(saveLayoutTimer.current);
    };
  }, [panelLayout]);

  const shareQuery = async () => {
    const url = createShareableUrl(sql, currentStageIndex);
    window.history.replaceState(null, '', url);

    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch {
      const input = document.createElement('textarea');
      input.value = url;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        runQuery();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [runQuery]);

  const togglePanel = (panel: 'databaseOpen' | 'editorOpen' | 'debuggerOpen' | 'resultsOpen') => {
    setPanelLayout((layout) => ({ ...layout, [panel]: !layout[panel] }));
  };

  const resizeDatabase = (delta: number) => {
    setPanelLayout((layout) => ({ ...layout, databaseWidth: clamp(layout.databaseWidth + delta, 180, 440) }));
  };

  const resizeRightDebugger = (delta: number) => {
    const width = contentRegionRef.current?.getBoundingClientRect().width ?? 1;
    setPanelLayout((layout) => ({
      ...layout,
      debuggerRightWidth: clamp(layout.debuggerRightWidth - (delta / width) * 100, 28, 72),
    }));
  };

  const resizeResults = (delta: number) => {
    const height = workspaceAreaRef.current?.getBoundingClientRect().height ?? 1;
    setPanelLayout((layout) => ({
      ...layout,
      resultsHeight: clamp(layout.resultsHeight - (delta / height) * 100, 18, 70),
    }));
  };

  const hasEditorOrDebugger = panelLayout.editorOpen || panelLayout.debuggerOpen;
  const hasWorkspacePanels = hasEditorOrDebugger || panelLayout.resultsOpen;
  const showDockSplitter = panelLayout.editorOpen && panelLayout.debuggerOpen;

  return (
    <div className="h-screen w-screen flex flex-col bg-base text-primary overflow-hidden select-none">
      <header className="h-10 px-3 bg-surface border-b border-border flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2 font-mono font-bold tracking-wide">
          <Layers size={16} className="text-accent" />
          <span>SQL LAB</span>
          <span className="text-muted text-[10px] font-normal">| DuckDB Engine (Local)</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-secondary" title="Color theme">
            <Palette size={13} />
            <select
              aria-label="Color theme"
              value={theme}
              onChange={(event) => setTheme(event.target.value as AppTheme)}
              className="bg-transparent text-[11px] text-secondary focus:outline-none cursor-pointer"
            >
              <option value="midnight">Midnight</option>
              <option value="light">Light</option>
              <option value="noir">Noir</option>
              <option value="ocean">Ocean</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void shareQuery()}
            title="Copy a link with this SQL query and debugger stage"
            className="flex items-center gap-1 px-2 py-1 rounded border border-border text-secondary hover:text-primary"
          >
            {shareCopied ? <Check size={12} /> : <Share2 size={12} />}
            <span>{shareCopied ? 'Link copied' : 'Share'}</span>
          </button>
          <WorkspaceControls />
          <button
            type="button"
            onClick={restartDebug}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-secondary border border-border text-secondary hover:text-primary"
          >
            <RotateCcw size={12} />
            <span>Restart</span>
          </button>
          <button
            type="button"
            onClick={() => void runQuery()}
            className="flex items-center gap-1.5 rounded bg-accent px-2.5 py-1 text-[11px] font-semibold hover:bg-accent/90"
          >
            <Play size={12} fill="currentColor" />
            <span>Run Query (F5)</span>
          </button>
        </div>
      </header>

      <div role="toolbar" aria-label="Workspace panels" className="flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-secondary px-3 py-1.5 text-xs">
        <span className="font-mono text-[10px] font-semibold tracking-wider text-muted">PANELS</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <PanelToggle label="Database" open={panelLayout.databaseOpen} onClick={() => togglePanel('databaseOpen')} />
          <PanelToggle label="Editor" open={panelLayout.editorOpen} onClick={() => togglePanel('editorOpen')} />
          <PanelToggle label="SQL Debugger" open={panelLayout.debuggerOpen} onClick={() => togglePanel('debuggerOpen')} />
          <PanelToggle label="Results" open={panelLayout.resultsOpen} onClick={() => togglePanel('resultsOpen')} />
        </div>
      </div>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {panelLayout.databaseOpen && (
          <aside className="min-h-0 shrink-0 overflow-hidden" style={{ width: panelLayout.databaseWidth }}>
            <DatabaseExplorer onClose={() => togglePanel('databaseOpen')} />
          </aside>
        )}
        {panelLayout.databaseOpen && (
          <ResizeHandle
            orientation="vertical"
            label="Resize Database Explorer"
            value={panelLayout.databaseWidth}
            min={180}
            max={440}
            onResize={resizeDatabase}
          />
        )}

        <div ref={workspaceAreaRef} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {hasEditorOrDebugger && (
            <div
              ref={contentRegionRef}
              className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden"
              style={panelLayout.resultsOpen ? { flexBasis: `${100 - panelLayout.resultsHeight}%` } : undefined}
            >
              {panelLayout.editorOpen && (
                <section
                  className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden"
                  style={panelLayout.debuggerOpen
                    ? { flex: `1 1 ${100 - panelLayout.debuggerRightWidth}%` }
                    : { flex: '1 1 0%' }}
                >
                  <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                    <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-surface-secondary px-3 text-xs">
                      <div className="flex items-center gap-1 rounded border border-border bg-surface p-0.5">
                        <button
                          type="button"
                          onClick={() => setActiveTab('editor')}
                          aria-pressed={activeTab === 'editor'}
                          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                            activeTab === 'editor' ? 'bg-accent/20 text-accent font-semibold' : 'text-muted hover:text-secondary'
                          }`}
                        >
                          Monaco SQL Editor
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('builder')}
                          aria-pressed={activeTab === 'builder'}
                          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                            activeTab === 'builder' ? 'bg-accent/20 text-accent font-semibold' : 'text-muted hover:text-secondary'
                          }`}
                        >
                          Visual Query Builder
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePanel('editorOpen')}
                        aria-label="Close Editor panel"
                        title="Close Editor panel"
                        className="rounded px-1.5 py-1 text-muted hover:bg-surface hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                      >
                        ×
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-hidden">
                      {activeTab === 'editor' ? (
                        <SqlEditor theme={theme} />
                      ) : (
                        <VisualQueryBuilder
                          schema={schema || { name: 'main', tables: [] }}
                          onSqlChange={setSql}
                        />
                      )}
                    </div>
                  </div>
                </section>
              )}

              {showDockSplitter && (
                <ResizeHandle
                  orientation="vertical"
                  label="Resize SQL Debugger panel"
                  value={panelLayout.debuggerRightWidth}
                  min={28}
                  max={72}
                  onResize={resizeRightDebugger}
                />
              )}

              {panelLayout.debuggerOpen && (
                <section
                  className="h-full min-h-0 min-w-0 overflow-hidden"
                  style={panelLayout.editorOpen
                    ? { flex: `0 0 ${panelLayout.debuggerRightWidth}%` }
                    : { flex: '1 1 auto' }}
                >
                  <ExecutionVisualizer
                    onClose={() => togglePanel('debuggerOpen')}
                  />
                </section>
              )}
            </div>
          )}

          {panelLayout.resultsOpen && hasEditorOrDebugger && (
            <ResizeHandle
              orientation="horizontal"
              label="Resize Result Set panel"
              value={panelLayout.resultsHeight}
              min={18}
              max={70}
              onResize={resizeResults}
            />
          )}

          {panelLayout.resultsOpen && (
            <section
              className="min-h-0 min-w-0 overflow-hidden"
              style={hasEditorOrDebugger ? { flex: `0 0 ${panelLayout.resultsHeight}%` } : { flex: '1 1 auto' }}
            >
              <ResultGrid onClose={() => togglePanel('resultsOpen')} />
            </section>
          )}

          {!hasWorkspacePanels && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <Layers size={24} className="text-muted" />
              <p className="text-sm font-medium text-secondary">All workspace panels are closed.</p>
              <p className="text-xs text-muted">Use the panel controls above to open the sections you need.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
