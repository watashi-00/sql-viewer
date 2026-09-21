import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { clearWorkspace, loadWorkspace, saveWorkspace } from '../storage/workspaceStore';

describe('Workspace storage', () => {
  it('persists imported files and creation commands in IndexedDB', async () => {
    await clearWorkspace();

    await saveWorkspace({
      files: [
        {
          fileName: 'clients.json',
          tableName: 'clients',
          format: 'json',
          buffer: new Uint8Array([91, 93]),
        },
      ],
      commands: [{ sql: 'CREATE TABLE clients (id INTEGER)', tableName: 'clients' }],
    });

    const workspace = await loadWorkspace();
    expect(workspace.files[0].fileName).toBe('clients.json');
    expect(Array.from(workspace.files[0].buffer)).toEqual([91, 93]);
    expect(workspace.commands[0].tableName).toBe('clients');
  });
});