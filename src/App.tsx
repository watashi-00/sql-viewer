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

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'editor' | 'builder'>('editor');
  const [theme, setTheme] = useState<AppTheme>(getInitialTheme);
  const [shareCopied, setShareCopied] = useState(false);
  const sharedStateApplied = useRef(false);
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

  return (
    <div className="h-screen w-screen flex flex-col bg-base text-primary overflow-hidden select-none">
      {/* Top Application Toolbar */}
      <header className="h-10 px-3 bg-surface border-b border-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-mono font-bold tracking-wide">
          <Layers size={16} className="text-accent" />
          <h1 className="text-xs">SQL LAB</h1>
          <span className="text-muted text-[10px] font-normal">| SQL Query Debugger · DuckDB (Local)</span>
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
            onClick={() => void shareQuery()}
            title="Copy a link with this SQL query and debugger stage"
            className="flex items-center gap-1 px-2 py-1 rounded border border-border text-secondary hover:text-primary"
          >
            {shareCopied ? <Check size={12} /> : <Share2 size={12} />}
            <span>{shareCopied ? 'Link copied' : 'Share'}</span>
          </button>
          <WorkspaceControls />
          <button
            onClick={restartDebug}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-secondary border border-border text-secondary hover:text-primary"
          >
            <RotateCcw size={12} />
            <span>Restart</span>
          </button>
          <button
            onClick={() => void runQuery()}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-accent text-base font-semibold hover:bg-accent/90"
          >
            <Play size={12} fill="currentColor" />
            <span>Run Query (F5)</span>
          </button>
        </div>
      </header>

      {/* Main Multi-Panel Workspace */}
      <main className="flex-1 flex overflow-hidden" aria-label="SQL workspace">
        {/* Left Sidebar */}
        <div className="w-64 h-full">
          <DatabaseExplorer />
        </div>

        {/* Center Main Panels */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Main Workspace Mode Header / Tabs */}
          <div className="h-9 px-3 bg-surface-secondary border-b border-border flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-1 bg-surface border border-border p-0.5 rounded">
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === 'editor'
                    ? 'bg-accent/20 text-accent font-semibold'
                    : 'text-muted hover:text-secondary'
                }`}
              >
                Monaco SQL Editor
              </button>
              <button
                onClick={() => setActiveTab('builder')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === 'builder'
                    ? 'bg-accent/20 text-accent font-semibold'
                    : 'text-muted hover:text-secondary'
                }`}
              >
                Visual Query Builder
              </button>
            </div>
          </div>

          {/* Top Half: Editor/Builder + Visualizer */}
          <div className="h-1/2 flex border-b border-border">
            <div className="w-1/2 h-full overflow-hidden">
              {activeTab === 'editor' ? (
                <SqlEditor theme={theme} />
              ) : (
                <VisualQueryBuilder
                  schema={schema || { name: 'main', tables: [] }}
                  onSqlChange={setSql}
                />
              )}
            </div>
            <div className="w-1/2 h-full border-l border-border">
              <ExecutionVisualizer />
            </div>
          </div>

          {/* Bottom Half: Result Grid */}
          <div className="flex-1 overflow-hidden">
            <ResultGrid />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
