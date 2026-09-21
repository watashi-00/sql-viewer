export interface PersistedWorkspaceFile {
  fileName: string;
  tableName: string;
  format: 'csv' | 'json' | 'parquet';
  buffer: Uint8Array;
}

export interface PersistedWorkspaceCommand {
  sql: string;
  tableName?: string;
}

export interface PersistedWorkspace {
  files: PersistedWorkspaceFile[];
  commands: PersistedWorkspaceCommand[];
}

const DB_NAME = 'sql_viewer_workspace';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';
const WORKSPACE_KEY = 'current';

let memoryWorkspace: PersistedWorkspace | null = null;

function emptyWorkspace(): PersistedWorkspace {
  return { files: [], commands: [] };
}

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function loadWorkspace(): Promise<PersistedWorkspace> {
  const db = await openDB();
  if (!db) return memoryWorkspace ? structuredClone(memoryWorkspace) : emptyWorkspace();

  return new Promise((resolve) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(WORKSPACE_KEY);
    request.onsuccess = () => resolve(request.result ? request.result as PersistedWorkspace : emptyWorkspace());
    request.onerror = () => resolve(emptyWorkspace());
  });
}

export async function saveWorkspace(workspace: PersistedWorkspace): Promise<void> {
  memoryWorkspace = structuredClone(workspace);
  const db = await openDB();
  if (!db) return;

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(workspace, WORKSPACE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearWorkspace(): Promise<void> {
  memoryWorkspace = null;
  const db = await openDB();
  if (!db) return;

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(WORKSPACE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
