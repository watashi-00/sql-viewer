import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { Database, Table, Key, Hash, AlignLeft } from 'lucide-react';
import { FileDropzone } from './FileDropzone';
import { HistoryPanel } from '../history/HistoryPanel';
import { getHistoryItems, getSnippets, clearHistoryItems, deleteSnippet } from '../storage/historyStore';
import { QueryHistoryItem, SavedSnippet } from '../types';

export const DatabaseExplorer: React.FC = () => {
  const { schema, loadSchema, setSql } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState<'tables' | 'history'>('tables');
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [snippets, setSnippets] = useState<SavedSnippet[]>([]);

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  const loadHistoryData = async () => {
    try {
      const h = await getHistoryItems();
      const s = await getSnippets();
      setHistory(h);
      setSnippets(s);
    } catch {
      // Storage unavailable or empty
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistoryData();
    }
  }, [activeTab]);

  const handleClearHistory = async () => {
    await clearHistoryItems();
    setHistory([]);
  };

  const handleDeleteSnippet = async (id: string) => {
    await deleteSnippet(id);
    setSnippets((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="h-full w-full flex flex-col bg-surface border-r border-border text-primary font-sans select-none overflow-hidden">
      {/* Sidebar Top Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-secondary border-b border-border text-xs font-semibold text-secondary shrink-0">
        <Database size={14} className="text-accent" />
        <span>DATABASE EXPLORER</span>
      </div>

      {/* File Dropzone at top of sidebar */}
      <div className="p-2 border-b border-border shrink-0">
        <FileDropzone />
      </div>

      {/* Sidebar Tabs: [ Tables ] [ History & Snippets ] */}
      <div className="flex border-b border-border bg-surface text-xs font-medium shrink-0">
        <button
          onClick={() => setActiveTab('tables')}
          className={`flex-1 py-1.5 px-2 text-center transition-colors ${
            activeTab === 'tables'
              ? 'border-b-2 border-accent text-accent font-semibold bg-accent/5'
              : 'text-muted hover:text-secondary'
          }`}
        >
          Tables
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-1.5 px-2 text-center transition-colors ${
            activeTab === 'history'
              ? 'border-b-2 border-accent text-accent font-semibold bg-accent/5'
              : 'text-muted hover:text-secondary'
          }`}
        >
          History & Snippets
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tables' ? (
          <div className="p-2 text-xs">
            {!schema ? (
              <div className="text-muted p-2">Loading database schema...</div>
            ) : (
              <div className="space-y-3">
                <div className="text-muted font-mono uppercase tracking-wider text-[10px]">
                  Schema: {schema.name}
                </div>
                {schema.tables.map((table) => (
                  <div key={table.name} className="space-y-1">
                    <div className="flex items-center justify-between font-medium text-primary py-1 px-1.5 rounded hover:bg-surface-secondary cursor-pointer">
                      <div className="flex items-center gap-1.5">
                        <Table size={13} className="text-info" />
                        <span>{table.name}</span>
                      </div>
                      <span className="text-[10px] text-muted font-mono">{table.rowCount} rows</span>
                    </div>

                    <div className="pl-4 space-y-0.5 border-l border-border/50 ml-2">
                      {table.columns.map((col) => (
                        <div
                          key={col.name}
                          className="flex items-center justify-between text-secondary py-0.5 px-1 font-mono text-[11px] hover:text-primary"
                          title={`${col.name} (${col.type})${col.isPrimaryKey ? ' - Primary Key' : ''}${col.isForeignKey ? ' - Foreign Key' : ''}`}
                        >
                          <div className="flex items-center gap-1.5">
                            {col.isPrimaryKey ? (
                              <Key size={11} className="text-warning" />
                            ) : col.isForeignKey ? (
                              <Key size={11} className="text-accent" />
                            ) : col.type.includes('INT') ? (
                              <Hash size={11} className="text-muted" />
                            ) : (
                              <AlignLeft size={11} className="text-muted" />
                            )}
                            <span>{col.name}</span>
                          </div>
                          <span className="text-muted text-[10px] uppercase">{col.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <HistoryPanel
            history={history}
            snippets={snippets}
            onSelectSql={(sql) => setSql(sql)}
            onClearHistory={handleClearHistory}
            onDeleteSnippet={handleDeleteSnippet}
          />
        )}
      </div>
    </div>
  );
};

export default DatabaseExplorer;
