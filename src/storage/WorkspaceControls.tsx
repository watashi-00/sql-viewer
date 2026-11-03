import React, { useRef, useState } from 'react';
import { Check, Database, Download, Plus, Trash2, Upload, X } from 'lucide-react';
import { resetDatabase } from '../database/duckdb';
import { useWorkspaceStore, DEFAULT_QUERY } from '../state/useWorkspaceStore';
import { clearWorkspace, loadWorkspace, saveWorkspace } from './workspaceStore';
import { parseWorkspaceArchive, serializeWorkspaceArchive } from './workspaceArchive';

function notifyWorkspaceChanged() {
  window.dispatchEvent(new Event('sql-viewer-workspace-updated'));
}

export const WorkspaceControls: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const setSql = useWorkspaceStore((state) => state.setSql);
  const loadSchema = useWorkspaceStore((state) => state.loadSchema);

  const restartDatabase = async () => {
    await resetDatabase();
    await loadSchema();
  };

  const startNewWorkspace = async () => {
    if (!window.confirm('Start a new workspace? Imported files and SQL changes will be removed. Query history will remain.')) return;
    setIsBusy(true);
    setMessage('');
    try {
      await clearWorkspace();
      await restartDatabase();
      setSql(DEFAULT_QUERY);
      notifyWorkspaceChanged();
      setMessage('New workspace ready. Query history was kept.');
    } catch (error) {
      setMessage(`Could not create a new workspace: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const clearLocalWorkspace = async () => {
    if (!window.confirm('Clear imported files and SQL changes from this browser? Query history will remain.')) return;
    setIsBusy(true);
    setMessage('');
    try {
      await clearWorkspace();
      await restartDatabase();
      notifyWorkspaceChanged();
      setMessage('Local workspace cleared. Query history was kept.');
    } catch (error) {
      setMessage(`Could not clear the workspace: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const exportWorkspace = async () => {
    setIsBusy(true);
    setMessage('');
    try {
      const json = serializeWorkspaceArchive(await loadWorkspace());
      const objectUrl = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `sql-viewer-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      setMessage('Workspace exported.');
    } catch (error) {
      setMessage(`Could not export the workspace: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const importWorkspace = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsBusy(true);
    setMessage('');
    try {
      const importedWorkspace = parseWorkspaceArchive(await file.text());
      if (!window.confirm('Replace this browser’s local workspace with the imported workspace? Query history will remain.')) return;
      const previousWorkspace = await loadWorkspace();
      try {
        await saveWorkspace(importedWorkspace);
        await restartDatabase();
        if (importedWorkspace.editor) setSql(importedWorkspace.editor.sql);
      } catch (restoreError) {
        try {
          await saveWorkspace(previousWorkspace);
          await restartDatabase();
        } catch (rollbackError) {
          throw new Error(
            `Import failed (${restoreError instanceof Error ? restoreError.message : String(restoreError)}), ` +
            `and restoring the previous workspace also failed (${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}).`
          );
        }
        throw new Error(`The archive could not be restored. The previous workspace was restored. ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`);
      }
      notifyWorkspaceChanged();
      setMessage('Workspace imported and restored. Query history was kept.');
    } catch (error) {
      setMessage(`Could not import the workspace: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex items-center gap-1 px-2 py-1 rounded border border-border text-secondary hover:text-primary"
      >
        <Database size={12} />
        <span>Workspace</span>
      </button>
      {isOpen && (
        <section className="absolute right-0 top-full z-50 mt-2 w-72 rounded border border-border bg-surface p-3 shadow-xl text-xs">
          <div className="mb-3">
            <h2 className="font-semibold text-primary">Local workspace</h2>
            <p className="mt-1 text-muted">Data is stored in this browser. Query history is kept separately.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={isBusy} onClick={() => void startNewWorkspace()} className="flex items-center gap-1.5 rounded border border-border px-2 py-2 text-secondary hover:bg-surface-secondary hover:text-primary disabled:cursor-wait disabled:opacity-50">
              <Plus size={13} /> New workspace
            </button>
            <button type="button" disabled={isBusy} onClick={() => void clearLocalWorkspace()} className="flex items-center gap-1.5 rounded border border-border px-2 py-2 text-secondary hover:bg-surface-secondary hover:text-primary disabled:cursor-wait disabled:opacity-50">
              <Trash2 size={13} /> Clear local data
            </button>
            <button type="button" disabled={isBusy} onClick={() => void exportWorkspace()} className="flex items-center gap-1.5 rounded border border-border px-2 py-2 text-secondary hover:bg-surface-secondary hover:text-primary disabled:cursor-wait disabled:opacity-50">
              <Download size={13} /> Export JSON
            </button>
            <button type="button" disabled={isBusy} onClick={() => fileInput.current?.click()} className="flex items-center gap-1.5 rounded border border-border px-2 py-2 text-secondary hover:bg-surface-secondary hover:text-primary disabled:cursor-wait disabled:opacity-50">
              <Upload size={13} /> Import JSON
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label="Import workspace archive"
            onChange={(event) => void importWorkspace(event)}
          />
          {message && (
            <p role={message.startsWith('Could not') || message.startsWith('The archive') ? 'alert' : 'status'} className="mt-3 flex items-start gap-1.5 text-secondary break-words">
              {!message.startsWith('Could not') && !message.startsWith('The archive') && <Check size={12} className="mt-0.5 shrink-0 text-accent" />}
              {message}
            </p>
          )}
          <button type="button" onClick={() => setIsOpen(false)} className="mt-3 flex items-center gap-1 text-muted hover:text-primary">
            <X size={12} /> Close
          </button>
        </section>
      )}
    </div>
  );
};
