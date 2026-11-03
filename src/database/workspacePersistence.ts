import { DataRow } from '../types';
import {
  getWorkspaceOperations,
  loadWorkspace,
  PersistedWorkspace,
  PersistedWorkspaceFile,
  PersistedWorkspaceOperation,
  replayWorkspaceOperations,
  saveWorkspace,
} from '../storage/workspaceStore';
import { getSqlMutation, SqlMutationJournal } from './sqlMutation';

interface WorkspacePersistenceDependencies {
  isNodeEnvironment: boolean;
  executeQuery: (sql: string) => Promise<{ rows: DataRow[]; columns: string[] }>;
  registerAndLoadFile: (
    fileName: string,
    buffer: Uint8Array,
    format: 'csv' | 'json' | 'parquet',
    persist?: boolean
  ) => Promise<unknown>;
}

export class WorkspacePersistence {
  private workspaceRestored = false;
  private workspaceStateLoaded = false;
  private persistedWorkspace: PersistedWorkspace = { files: [], commands: [] };
  private readonly mutationJournal = new SqlMutationJournal();

  constructor(private readonly dependencies: WorkspacePersistenceDependencies) {}

  private async ensureLoaded(): Promise<void> {
    if (this.workspaceStateLoaded || this.dependencies.isNodeEnvironment) return;
    this.persistedWorkspace = await loadWorkspace();
    this.workspaceStateLoaded = true;
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const escapedTableName = tableName.replace(/'/g, "''");
    const result = await this.dependencies.executeQuery(`
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = 'main' AND table_name = '${escapedTableName}'
    `);
    return Number(result.rows[0]?.count ?? 0) > 0;
  }

  async restore(): Promise<void> {
    if (this.dependencies.isNodeEnvironment || this.workspaceRestored) return;
    await this.ensureLoaded();

    if (this.persistedWorkspace.operations) {
      await replayWorkspaceOperations(
        getWorkspaceOperations(this.persistedWorkspace),
        async (file) => {
          await this.dependencies.registerAndLoadFile(file.fileName, file.buffer, file.format, false);
        },
        async (sql) => {
          await this.dependencies.executeQuery(sql);
        },
        async (operation) => {
          if (!operation.legacy) return true;
          if (operation.type === 'file') return !(await this.tableExists(operation.file.tableName));
          return !operation.tableName || !(await this.tableExists(operation.tableName));
        }
      );
    } else {
      // Preserve restore behavior for workspaces written before ordered operations existed.
      for (const file of this.persistedWorkspace.files) {
        if (!(await this.tableExists(file.tableName))) {
          await this.dependencies.registerAndLoadFile(file.fileName, file.buffer, file.format, false);
        }
      }
      for (const command of this.persistedWorkspace.commands) {
        if (!command.tableName || !(await this.tableExists(command.tableName))) {
          await this.dependencies.executeQuery(command.sql);
        }
      }
    }

    this.workspaceRestored = true;
  }

  async persistFile(file: PersistedWorkspaceFile): Promise<void> {
    if (this.dependencies.isNodeEnvironment) return;
    await this.ensureLoaded();
    await this.appendOperation({ type: 'file', file });
    this.persistedWorkspace.files = [
      ...this.persistedWorkspace.files.filter((item) => item.tableName !== file.tableName),
      file,
    ];
    this.persistedWorkspace.commands = this.persistedWorkspace.commands.filter(
      (command) => command.tableName !== file.tableName
    );
    await saveWorkspace(this.persistedWorkspace);
  }

  async persistCommand(sql: string): Promise<void> {
    if (this.dependencies.isNodeEnvironment) return;
    await this.ensureLoaded();
    const tableName = getSqlMutation(sql)?.tableName;
    if (this.mutationJournal.inTransaction) {
      await this.persistMutationSql(sql);
      return;
    }
    this.persistedWorkspace.operations = getWorkspaceOperations(this.persistedWorkspace);
    if (tableName) {
      this.persistedWorkspace.files = this.persistedWorkspace.files.filter((file) => file.tableName !== tableName);
    }
    this.persistedWorkspace.commands = [
      ...this.persistedWorkspace.commands.filter((command) => command.tableName !== tableName),
      { sql, tableName },
    ];
    await this.persistMutationSql(sql, tableName);
  }

  async persistMutation(sql: string): Promise<void> {
    if (this.dependencies.isNodeEnvironment) return;
    await this.ensureLoaded();
    await this.persistMutationSql(sql);
  }

  reset(): void {
    this.workspaceRestored = false;
    this.workspaceStateLoaded = false;
    this.persistedWorkspace = { files: [], commands: [] };
    this.mutationJournal.reset();
  }

  private async appendOperation(operation: PersistedWorkspaceOperation): Promise<void> {
    this.persistedWorkspace.operations = getWorkspaceOperations(this.persistedWorkspace);
    this.persistedWorkspace.operations.push(operation);
    await saveWorkspace(this.persistedWorkspace);
  }

  private async persistMutationSql(sql: string, tableName?: string): Promise<void> {
    await this.mutationJournal.record(sql, async (operation) => {
      await this.appendOperation({
        type: 'sql',
        statements: operation.statements,
        ...(tableName ?? operation.tableName ? { tableName: tableName ?? operation.tableName } : {}),
      });
    });
  }
}
