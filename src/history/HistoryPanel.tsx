import React, { useState, useMemo } from 'react';
import { QueryHistoryItem, SavedSnippet } from '../types';
import { Clock, Bookmark, Search, Trash2, ArrowRight, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface HistoryPanelProps {
  history: QueryHistoryItem[];
  snippets?: SavedSnippet[];
  onSelectSql: (sql: string) => void;
  onSaveSnippet?: (snippet: SavedSnippet) => void;
  onDeleteSnippet?: (id: string) => void;
  onClearHistory?: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  snippets = [],
  onSelectSql,
  onSaveSnippet: _onSaveSnippet,
  onDeleteSnippet,
  onClearHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'snippets'>('history');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  // Filter history based on search query
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const q = searchQuery.toLowerCase();
    return history.filter(
      (item) =>
        item.sql.toLowerCase().includes(q) ||
        (item.errorMessage && item.errorMessage.toLowerCase().includes(q))
    );
  }, [history, searchQuery]);

  // Filter snippets based on search query
  const filteredSnippets = useMemo(() => {
    if (!searchQuery.trim()) return snippets;
    const q = searchQuery.toLowerCase();
    return snippets.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.sql.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [snippets, searchQuery]);

  // Handle selection for performance comparison
  const toggleSelectForCompare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 2) {
        // Keep the second one and add the new one
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  // Compute comparison stats if 2 items are selected
  const comparisonData = useMemo(() => {
    if (selectedForCompare.length !== 2) return null;
    const itemA = history.find((h) => h.id === selectedForCompare[0]);
    const itemB = history.find((h) => h.id === selectedForCompare[1]);
    if (!itemA || !itemB) return null;

    // Order chronologically or by selection order (itemA as baseline, itemB as compare)
    const baseline = itemA;
    const target = itemB;

    const deltaMs = target.durationMs - baseline.durationMs;
    const absDelta = Math.abs(deltaMs);

    let percent = 0;
    if (baseline.durationMs > 0) {
      percent = (absDelta / baseline.durationMs) * 100;
    }

    const isFaster = deltaMs < 0;
    const isSame = deltaMs === 0;

    return {
      baseline,
      target,
      deltaMs,
      absDelta,
      percent: percent.toFixed(1),
      isFaster,
      isSame,
    };
  }, [history, selectedForCompare]);

  return (
    <div className="flex flex-col h-full bg-surface text-primary border-l border-border overflow-hidden select-none font-sans text-xs">
      {/* Header & Tabs */}
      <div className="p-3 border-b border-border bg-surface-secondary/40 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold tracking-wide text-secondary uppercase text-[11px]">
            <Clock size={14} className="text-accent" />
            <span>Query History & Snippets</span>
          </div>

          {activeTab === 'history' && history.length > 0 && onClearHistory && (
            <button
              onClick={onClearHistory}
              className="flex items-center gap-1 text-[10px] text-muted hover:text-rose-400 transition-colors"
              title="Clear History"
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-surface border border-border p-0.5 rounded">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-1 px-2 rounded text-center font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-accent/20 text-accent font-semibold'
                : 'text-muted hover:text-secondary'
            }`}
          >
            History ({history.length})
          </button>
          <button
            onClick={() => setActiveTab('snippets')}
            className={`flex-1 py-1 px-2 rounded text-center font-medium transition-colors ${
              activeTab === 'snippets'
                ? 'bg-accent/20 text-accent font-semibold'
                : 'text-muted hover:text-secondary'
            }`}
          >
            Snippets ({snippets.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex items-center">
          <Search size={12} className="absolute left-2.5 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder={activeTab === 'history' ? 'Filter history...' : 'Search snippets or tags...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1 rounded bg-surface border border-border text-primary placeholder-muted focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {activeTab === 'history' && (
          <>
            {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted text-center gap-2">
                <Clock size={24} className="opacity-40" />
                <p>No query history recorded yet.</p>
              </div>
            ) : (
              filteredHistory.map((item) => {
                const isSelectedForCompare = selectedForCompare.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectSql(item.sql)}
                    className={`group relative p-2.5 rounded border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isSelectedForCompare
                        ? 'border-accent bg-accent/5'
                        : 'border-border bg-surface hover:border-border-hover hover:bg-surface-secondary/30'
                    }`}
                  >
                    {/* Entry Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Comparison Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelectedForCompare}
                          onChange={() => {}}
                          onClick={(e) => toggleSelectForCompare(item.id, e)}
                          title="Select to compare performance"
                          className="w-3.5 h-3.5 accent-accent cursor-pointer"
                        />

                        {/* Status Badge */}
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider ${
                            item.status === 'success'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {item.status.toUpperCase()}
                        </span>

                        <span className="text-[10px] font-mono text-muted">
                          {item.durationMs.toFixed(1)}ms
                        </span>
                        <span className="text-[10px] text-muted">
                          • {item.rowCount} {item.rowCount === 1 ? 'row' : 'rows'}
                        </span>
                      </div>

                      <span className="text-[10px] text-muted">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* SQL Text Block */}
                    <div className="font-mono text-[11px] bg-base/50 p-2 rounded border border-border/50 text-secondary group-hover:text-primary whitespace-pre-wrap break-all line-clamp-3">
                      {item.sql}
                    </div>

                    {/* Error Message Preview */}
                    {item.status === 'error' && item.errorMessage && (
                      <div className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 p-1.5 rounded border border-rose-500/20">
                        <AlertTriangle size={11} className="shrink-0" />
                        <span className="truncate">{item.errorMessage}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {activeTab === 'snippets' && (
          <>
            {filteredSnippets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted text-center gap-2">
                <Bookmark size={24} className="opacity-40" />
                <p>No saved snippets found.</p>
              </div>
            ) : (
              filteredSnippets.map((snippet) => (
                <div
                  key={snippet.id}
                  onClick={() => onSelectSql(snippet.sql)}
                  className="group p-2.5 rounded border border-border bg-surface hover:border-accent/40 hover:bg-surface-secondary/30 transition-all cursor-pointer flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-primary">{snippet.title}</h4>
                    {onDeleteSnippet && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSnippet(snippet.id);
                        }}
                        className="text-muted hover:text-rose-400 p-1 rounded transition-colors"
                        title="Delete Snippet"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {snippet.description && (
                    <p className="text-[10px] text-muted line-clamp-2">{snippet.description}</p>
                  )}

                  <div className="font-mono text-[11px] bg-base/50 p-2 rounded border border-border/50 text-secondary group-hover:text-primary whitespace-pre-wrap break-all line-clamp-3">
                    {snippet.sql}
                  </div>

                  {snippet.tags && snippet.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {snippet.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 text-[9px] rounded bg-surface-secondary border border-border text-muted"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end mt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSql(snippet.sql);
                      }}
                      className="px-2 py-0.5 rounded bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 text-[10px] font-medium flex items-center gap-1"
                    >
                      <span>Load into Editor</span>
                      <ArrowRight size={10} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* Performance Profiler Drawer (When 2 history items selected) */}
      {comparisonData && (
        <div className="border-t border-accent/40 bg-surface-secondary p-3 flex flex-col gap-2 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-accent uppercase text-[11px]">
              <Zap size={14} />
              <span>Performance Profiler</span>
            </div>
            <button
              onClick={() => setSelectedForCompare([])}
              className="text-[10px] text-muted hover:text-primary"
            >
              Clear Selection
            </button>
          </div>

          <div className="flex items-center justify-between bg-surface p-2 rounded border border-border text-[11px]">
            <div className="flex flex-col">
              <span className="text-[9px] text-muted uppercase font-semibold">Baseline</span>
              <span className="font-mono text-secondary truncate max-w-[120px]" title={comparisonData.baseline.sql}>
                {comparisonData.baseline.sql}
              </span>
              <span className="font-mono text-muted">{comparisonData.baseline.durationMs.toFixed(1)}ms</span>
            </div>

            <ArrowRight size={14} className="text-muted shrink-0 mx-1" />

            <div className="flex flex-col">
              <span className="text-[9px] text-muted uppercase font-semibold">Target</span>
              <span className="font-mono text-secondary truncate max-w-[120px]" title={comparisonData.target.sql}>
                {comparisonData.target.sql}
              </span>
              <span className="font-mono text-muted">{comparisonData.target.durationMs.toFixed(1)}ms</span>
            </div>
          </div>

          {/* Comparison Result Metric */}
          <div
            className={`p-2 rounded border flex items-center justify-between font-mono font-medium ${
              comparisonData.isFaster
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : comparisonData.isSame
                ? 'bg-surface border-border text-muted'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {comparisonData.isFaster ? (
                <CheckCircle2 size={14} />
              ) : (
                <AlertTriangle size={14} />
              )}
              <span>
                {comparisonData.isFaster
                  ? `${comparisonData.percent}% Speedup`
                  : comparisonData.isSame
                  ? 'No speed difference'
                  : `${comparisonData.percent}% Slowdown`}
              </span>
            </div>
            <span>
              {comparisonData.deltaMs > 0 ? `+${comparisonData.deltaMs.toFixed(1)}ms` : `${comparisonData.deltaMs.toFixed(1)}ms`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
