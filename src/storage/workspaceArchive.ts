import {
  getWorkspaceOperations,
  PersistedWorkspace,
  PersistedWorkspaceFile,
  PersistedWorkspaceOperation,
} from './workspaceStore';

const ARCHIVE_FORMAT = 'sql-viewer-workspace';
const ARCHIVE_VERSION = 1;

interface EncodedFile extends Omit<PersistedWorkspaceFile, 'buffer'> {
  bufferBase64: string;
}

type EncodedOperation =
  | { type: 'file'; fileIndex: number; legacy?: boolean }
  | { type: 'file'; file: EncodedFile; legacy?: boolean }
  | { type: 'sql'; statements: string[]; tableName?: string; legacy?: boolean };

interface WorkspaceArchive {
  format: typeof ARCHIVE_FORMAT;
  version: typeof ARCHIVE_VERSION;
  exportedAt: string;
  workspace: {
    files: EncodedFile[];
    commands: PersistedWorkspace['commands'];
    operations: EncodedOperation[];
  };
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Workspace file contains invalid base64 data.');
  }
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeFile(file: PersistedWorkspaceFile): EncodedFile {
  const { buffer, ...metadata } = file;
  return { ...metadata, bufferBase64: encodeBase64(buffer) };
}

function sameFile(left: PersistedWorkspaceFile, right: PersistedWorkspaceFile): boolean {
  if (left.fileName !== right.fileName || left.tableName !== right.tableName || left.format !== right.format ||
      left.buffer.byteLength !== right.buffer.byteLength) return false;
  for (let index = 0; index < left.buffer.length; index++) {
    if (left.buffer[index] !== right.buffer[index]) return false;
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeFile(value: unknown): PersistedWorkspaceFile {
  if (!isRecord(value)) throw new Error('Workspace file entry must be an object.');
  const { fileName, tableName, format, bufferBase64 } = value;
  if (typeof fileName !== 'string' || !fileName.trim()) throw new Error('Workspace file is missing its filename.');
  if (typeof tableName !== 'string' || !tableName.trim()) throw new Error('Workspace file is missing its table name.');
  if (format !== 'csv' && format !== 'json' && format !== 'parquet') {
    throw new Error(`Unsupported workspace file format: ${String(format)}.`);
  }
  if (typeof bufferBase64 !== 'string') throw new Error('Workspace file is missing its data.');
  return { fileName, tableName, format, buffer: decodeBase64(bufferBase64) };
}

function decodeOperation(value: unknown, files: PersistedWorkspaceFile[]): PersistedWorkspaceOperation {
  if (!isRecord(value)) throw new Error('Workspace operation must be an object.');
  if (value.legacy !== undefined && typeof value.legacy !== 'boolean') {
    throw new Error('Workspace operation has an invalid legacy marker.');
  }

  if (value.type === 'file') {
    if (value.fileIndex !== undefined) {
      if (!Number.isInteger(value.fileIndex) || (value.fileIndex as number) < 0 || (value.fileIndex as number) >= files.length) {
        throw new Error('Workspace operation references a missing file.');
      }
      return {
        type: 'file',
        file: files[value.fileIndex as number],
        ...(value.legacy === true ? { legacy: true } : {}),
      };
    }
    return {
      type: 'file',
      file: decodeFile(value.file),
      ...(value.legacy === true ? { legacy: true } : {}),
    };
  }
  if (value.type === 'sql') {
    if (!Array.isArray(value.statements) || value.statements.length === 0 ||
        !value.statements.every((statement) => typeof statement === 'string' && statement.trim())) {
      throw new Error('Workspace SQL operation must contain at least one valid statement.');
    }
    if (value.tableName !== undefined && typeof value.tableName !== 'string') {
      throw new Error('Workspace SQL operation has an invalid table name.');
    }
    return {
      type: 'sql',
      statements: value.statements as string[],
      ...(typeof value.tableName === 'string' ? { tableName: value.tableName } : {}),
      ...(value.legacy === true ? { legacy: true } : {}),
    };
  }
  throw new Error('Workspace operation has an unknown type.');
}

export function serializeWorkspaceArchive(workspace: PersistedWorkspace): string {
  const archive: WorkspaceArchive = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    workspace: {
      files: workspace.files.map(encodeFile),
      commands: workspace.commands,
      operations: getWorkspaceOperations(workspace).map((operation): EncodedOperation => {
        if (operation.type !== 'file') return { ...operation };
        const currentFileIndex = workspace.files.findIndex((file) => sameFile(file, operation.file));
        return currentFileIndex >= 0
          ? { type: 'file', fileIndex: currentFileIndex, ...(operation.legacy ? { legacy: true } : {}) }
          : { type: 'file', file: encodeFile(operation.file), ...(operation.legacy ? { legacy: true } : {}) };
      }),
    },
  };
  return JSON.stringify(archive, null, 2);
}

export function parseWorkspaceArchive(json: string): PersistedWorkspace {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!isRecord(parsed) || parsed.format !== ARCHIVE_FORMAT) {
    throw new Error('This file is not a SQL Viewer workspace archive.');
  }
  if (parsed.version !== ARCHIVE_VERSION) {
    throw new Error(`Unsupported workspace archive version: ${String(parsed.version)}.`);
  }
  if (!isRecord(parsed.workspace)) throw new Error('Workspace archive is missing its workspace data.');

  const rawWorkspace = parsed.workspace;
  if (!Array.isArray(rawWorkspace.files) || !Array.isArray(rawWorkspace.commands) ||
      !Array.isArray(rawWorkspace.operations)) {
    throw new Error('Workspace archive has an invalid data structure.');
  }

  const files = rawWorkspace.files.map(decodeFile);
  const commands = rawWorkspace.commands.map((command): PersistedWorkspace['commands'][number] => {
    if (!isRecord(command) || typeof command.sql !== 'string' || !command.sql.trim() ||
        (command.tableName !== undefined && typeof command.tableName !== 'string')) {
      throw new Error('Workspace archive contains an invalid SQL command.');
    }
    return {
      sql: command.sql,
      ...(typeof command.tableName === 'string' ? { tableName: command.tableName } : {}),
    };
  });
  const operations = rawWorkspace.operations.map((operation) => decodeOperation(operation, files));

  if (files.some((file) => !operations.some((operation) => operation.type === 'file' && sameFile(operation.file, file)))) {
    throw new Error('Workspace archive is missing a file restore operation.');
  }
  if (commands.some((command) => !operations.some((operation) =>
    operation.type === 'sql' && operation.statements.includes(command.sql)
  ))) {
    throw new Error('Workspace archive is missing a SQL restore operation.');
  }

  return {
    files,
    commands,
    operations,
  };
}
