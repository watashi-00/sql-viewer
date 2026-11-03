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

export interface PersistedEditorState {
  sql: string;
  selection: { start: number; end: number };
}

export type PersistedWorkspaceOperation =
  | { type: 'file'; file: PersistedWorkspaceFile; legacy?: boolean }
  | { type: 'sql'; statements: string[]; tableName?: string; legacy?: boolean };

export interface PersistedWorkspace {
  files: PersistedWorkspaceFile[];
  commands: PersistedWorkspaceCommand[];
  /** Ordered log used by new workspaces; absent in records created by older versions. */
  operations?: PersistedWorkspaceOperation[];
  editor?: PersistedEditorState;
}

const DB_NAME = 'sql_viewer_workspace';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';
const WORKSPACE_KEY = 'current';

let memoryWorkspace: PersistedWorkspace | null = null;

function emptyWorkspace(): PersistedWorkspace {
  return { files: [], commands: [] };
}

function isPersistedFile(value: unknown): value is PersistedWorkspaceFile {
  if (!value || typeof value !== 'object') return false;
  const file = value as Record<string, unknown>;
  return typeof file.fileName === 'string' && typeof file.tableName === 'string' &&
    ['csv', 'json', 'parquet'].includes(String(file.format)) && file.buffer instanceof Uint8Array;
}

function isPersistedOperation(value: unknown): value is PersistedWorkspaceOperation {
  if (!value || typeof value !== 'object') return false;
  const operation = value as Record<string, unknown>;
  if (operation.legacy !== undefined && typeof operation.legacy !== 'boolean') return false;
  if (operation.type === 'file') return isPersistedFile(operation.file);
  return operation.type === 'sql' && Array.isArray(operation.statements) && operation.statements.length > 0 &&
    operation.statements.every((statement) => typeof statement === 'string' && statement.trim().length > 0) &&
    (operation.tableName === undefined || typeof operation.tableName === 'string');
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

  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(WORKSPACE_KEY);
    request.onsuccess = () => {
      try {
        resolve(validateStoredWorkspace(request.result));
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(new Error('Could not read the saved workspace. It may be corrupted.'));
  });
}

function validateStoredWorkspace(value: unknown): PersistedWorkspace {
  if (value === undefined || value === null) return emptyWorkspace();
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Saved workspace data is corrupted.');
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.files) || !Array.isArray(candidate.commands) ||
      (candidate.operations !== undefined && !Array.isArray(candidate.operations)) ||
      (candidate.editor !== undefined && (!candidate.editor || typeof candidate.editor !== 'object' ||
        typeof (candidate.editor as Record<string, unknown>).sql !== 'string' ||
        !(candidate.editor as Record<string, unknown>).selection ||
        typeof ((candidate.editor as Record<string, unknown>).selection as Record<string, unknown>).start !== 'number' ||
        typeof ((candidate.editor as Record<string, unknown>).selection as Record<string, unknown>).end !== 'number'))) {
    throw new Error('Saved workspace data is corrupted. Clear it or import a valid backup.');
  }
  if (!candidate.files.every(isPersistedFile)) {
    throw new Error('Saved workspace contains a corrupted file entry. Clear it or import a valid backup.');
  }
  for (const command of candidate.commands) {
    if (!command || typeof command !== 'object' || typeof command.sql !== 'string' ||
        (command.tableName !== undefined && typeof command.tableName !== 'string')) {
      throw new Error('Saved workspace contains a corrupted SQL command. Clear it or import a valid backup.');
    }
  }
  if (candidate.operations && !candidate.operations.every(isPersistedOperation)) {
    throw new Error('Saved workspace contains a corrupted operation log. Clear it or import a valid backup.');
  }
  return value as PersistedWorkspace;
}

export async function saveEditorState(editor: PersistedEditorState): Promise<void> {
  const workspace = await loadWorkspace();
  workspace.editor = structuredClone(editor);
  await saveWorkspace(workspace);
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

export function getWorkspaceOperations(workspace: PersistedWorkspace): PersistedWorkspaceOperation[] {
  if (workspace.operations) return structuredClone(workspace.operations);
  return [
    ...workspace.files.map((file): PersistedWorkspaceOperation => ({ type: 'file', file, legacy: true })),
    ...workspace.commands.map((command): PersistedWorkspaceOperation => ({
      type: 'sql',
      statements: [command.sql],
      legacy: true,
      ...(command.tableName ? { tableName: command.tableName } : {}),
    })),
  ];
}

export async function appendWorkspaceOperation(operation: PersistedWorkspaceOperation): Promise<void> {
  const workspace = await loadWorkspace();
  workspace.operations = getWorkspaceOperations(workspace);
  workspace.operations.push(structuredClone(operation));
  await saveWorkspace(workspace);
}

export async function replayWorkspaceOperations(
  operations: PersistedWorkspaceOperation[],
  restoreFile: (file: PersistedWorkspaceFile) => Promise<void>,
  executeSql: (sql: string) => Promise<void>,
  shouldReplay: (operation: PersistedWorkspaceOperation) => Promise<boolean> = async () => true
): Promise<void> {
  for (const operation of operations) {
    if (!(await shouldReplay(operation))) continue;
    if (operation.type === 'file') {
      await restoreFile(operation.file);
      continue;
    }
    for (const statement of operation.statements) {
      await executeSql(statement);
    }
  }
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
