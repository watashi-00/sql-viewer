import { describe, expect, it } from 'vitest';
import { parseWorkspaceArchive, serializeWorkspaceArchive } from '../storage/workspaceArchive';

describe('Workspace archive', () => {
  it('round trips file bytes and ordered SQL operations as versioned JSON', () => {
    const workspace = {
      files: [{ fileName: 'people.csv', tableName: 'people', format: 'csv' as const, buffer: new Uint8Array([0, 1, 255, 42]) }],
      commands: [{ sql: 'CREATE TABLE extra (id INTEGER)', tableName: 'extra' }],
      operations: [
        { type: 'file' as const, file: { fileName: 'people.csv', tableName: 'people', format: 'csv' as const, buffer: new Uint8Array([0, 1, 255, 42]) } },
        { type: 'sql' as const, statements: ['CREATE TABLE extra (id INTEGER)'], tableName: 'extra' },
        { type: 'sql' as const, statements: ['INSERT INTO people VALUES (1)'] },
      ],
    };

    const serialized = serializeWorkspaceArchive(workspace);
    expect(JSON.parse(serialized).version).toBe(1);
    expect(JSON.parse(serialized).workspace.operations[0].fileIndex).toBe(0);
    const restored = parseWorkspaceArchive(serialized);
    expect(Array.from(restored.files[0].buffer)).toEqual([0, 1, 255, 42]);
    expect(restored.commands).toEqual(workspace.commands);
    expect(restored.operations?.[2]).toEqual(workspace.operations[2]);
  });

  it.each([
    ['invalid JSON', '{'],
    ['wrong archive format', JSON.stringify({ format: 'other', version: 1, workspace: {} })],
    ['unsupported version', JSON.stringify({ format: 'sql-viewer-workspace', version: 99, workspace: {} })],
    ['invalid structure', JSON.stringify({ format: 'sql-viewer-workspace', version: 1, workspace: { files: [], commands: [] } })],
  ])('rejects %s with a useful validation error', (_name, json) => {
    expect(() => parseWorkspaceArchive(json)).toThrow();
  });

  it('rejects malformed file data before it can replace a workspace', () => {
    const malformed = {
      format: 'sql-viewer-workspace',
      version: 1,
      workspace: {
        files: [{ fileName: 'bad.csv', tableName: 'bad', format: 'csv', bufferBase64: 'not base64!' }],
        commands: [],
        operations: [],
      },
    };
    expect(() => parseWorkspaceArchive(JSON.stringify(malformed))).toThrow('invalid base64');
  });
});
