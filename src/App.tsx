import React, { useEffect } from 'react';
import { DatabaseExplorer } from './schema/DatabaseExplorer';
import { SqlEditor } from './editor/SqlEditor';
import { ExecutionVisualizer } from './visualizer/ExecutionVisualizer';
import { ResultGrid } from './inspector/ResultGrid';
import { Play, RotateCcw, Layers } from 'lucide-react';
import { useWorkspaceStore } from './state/useWorkspaceStore';

export const App: React.FC = () => {
  const { runQuery, restartDebug } = useWorkspaceStore();

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
          <span>SQL LAB</span>
          <span className="text-muted text-[10px] font-normal">| DuckDB Engine (Local)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={restartDebug}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-secondary border border-border text-secondary hover:text-primary"
          >
            <RotateCcw size={12} />
            <span>Restart</span>
          </button>
          <button
            onClick={runQuery}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-accent text-base font-semibold hover:bg-accent/90"
          >
            <Play size={12} fill="currentColor" />
            <span>Run Query (F5)</span>
          </button>
        </div>
      </header>

      {/* Main Multi-Panel Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 h-full">
          <DatabaseExplorer />
        </div>

        {/* Center Main Panels */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Top Half: Editor + Visualizer */}
          <div className="h-1/2 flex border-b border-border">
            <div className="w-1/2 h-full">
              <SqlEditor />
            </div>
            <div className="w-1/2 h-full border-l border-border">
              <ExecutionVisualizer />
            </div>
          </div>

          {/* Bottom Half: Result Grid */}
          <div className="h-1/2 h-full">
            <ResultGrid />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
