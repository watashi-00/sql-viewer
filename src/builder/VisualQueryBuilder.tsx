import React, { useState, useEffect, useRef } from 'react';
import { Schema, VisualQueryState } from '../types';
import { Database, Plus, Link2, Filter, Table as TableIcon, RefreshCw, Sigma } from 'lucide-react';
import { loadWorkspace, saveBuilderState } from '../storage/workspaceStore';
import { buildSqlFromState, describeRelationalEffects } from './queryBuilder';
import { useVisualQueryBuilderActions } from './useVisualQueryBuilderActions';
import { BuilderAggregateSection, BuilderFilterSection, BuilderJoinSection, BuilderOutputSection, BuilderTableCards } from './BuilderSections';

export interface VisualQueryBuilderProps {
  schema: Schema;
  onSqlChange?: (sql: string) => void;
  initialState?: VisualQueryState;
  onStateChange?: (state: VisualQueryState) => void;
}

export { buildSqlFromState, describeRelationalEffects } from './queryBuilder';

export const VisualQueryBuilder: React.FC<VisualQueryBuilderProps> = ({
  schema,
  onSqlChange,
  initialState,
  onStateChange
}) => {
  const [queryState, setQueryState] = useState<VisualQueryState>(
    initialState || {
      nodes: [],
      joins: [],
      filters: []
    }
  );
  const queryStateRef = useRef(queryState);
  queryStateRef.current = queryState;
  const builderSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const builderTouched = useRef(false);

  const [selectedTableToAdd, setSelectedTableToAdd] = useState<string>(
    schema.tables[0]?.name || ''
  );

  useEffect(() => {
    if (schema.tables.length > 0 && !selectedTableToAdd) {
      setSelectedTableToAdd(schema.tables[0].name);
    }
  }, [schema]);

  const applyPersistedBuilderState = (state: VisualQueryState, syncSql = true) => {
    builderTouched.current = false;
    queryStateRef.current = state;
    setQueryState(state);
    onStateChange?.(state);
    if (syncSql) onSqlChange?.(buildSqlFromState(state));
  };

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const workspace = await loadWorkspace();
        if (!cancelled && !initialState && !builderTouched.current && workspace.builder) {
          applyPersistedBuilderState(workspace.builder);
        }
      } catch {
        // An unavailable workspace store should not block using the builder.
      }
    };
    void restore();
    const handleWorkspaceUpdated = () => {
      void loadWorkspace().then((workspace) => {
        if (workspace.builder) applyPersistedBuilderState(workspace.builder);
        else applyPersistedBuilderState({ nodes: [], joins: [], filters: [] }, false);
      }).catch(() => undefined);
    };
    window.addEventListener('sql-viewer-workspace-updated', handleWorkspaceUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('sql-viewer-workspace-updated', handleWorkspaceUpdated);
      if (builderSaveTimer.current) clearTimeout(builderSaveTimer.current);
      if (builderTouched.current) void saveBuilderState(queryStateRef.current);
    };
  }, []);

  const scheduleBuilderSave = (state: VisualQueryState) => {
    queryStateRef.current = state;
    if (builderSaveTimer.current) clearTimeout(builderSaveTimer.current);
    builderSaveTimer.current = setTimeout(() => void saveBuilderState(state), 250);
  };

  const updateQueryState = (newState: VisualQueryState) => {
    builderTouched.current = true;
    scheduleBuilderSave(newState);
    setQueryState(newState);
    onStateChange?.(newState);
    const sql = buildSqlFromState(newState);
    onSqlChange?.(sql);
  };

  const { handleAddTable, handleUpdateTableAlias, handleUpdateColumnAlias, handleRemoveTableNode, handleToggleColumn, handleToggleAllColumns, handleToggleGroupBy, handleAddAggregate, handleUpdateAggregate, handleRemoveAggregate, handleAddJoin, handleUpdateJoin, handleRemoveJoin, handleAddFilter, handleUpdateFilter, handleRemoveFilter, handleReset } = useVisualQueryBuilderActions({ queryState, schema, selectedTableToAdd, updateQueryState });

  const generatedSql = buildSqlFromState(queryState);
  const relationalEffects = describeRelationalEffects(queryState);

  return (
    <div className="flex flex-col h-full w-full bg-[#0B0D10] text-gray-200 overflow-y-auto p-4 space-y-4">
      {/* Header & Controls Toolbar */}
      <div className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 p-3 bg-[#111418] border border-gray-800 rounded-lg shadow-sm">
        <div className="flex items-center space-x-2">
          <Database className="w-5 h-5 text-[#7C9CFF]" />
          <h2 className="text-sm font-semibold tracking-wider text-gray-100 uppercase">
            VISUAL QUERY BUILDER
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add Table Controls */}
          <div className="flex items-center space-x-1.5 bg-[#181C22] p-1 rounded border border-gray-700">
            <TableIcon className="w-4 h-4 text-gray-400 ml-1" />
            <select
              aria-label="Add Table"
              data-testid="add-table-select"
              value={selectedTableToAdd}
              onChange={(e) => setSelectedTableToAdd(e.target.value)}
              className="bg-transparent text-xs text-gray-200 focus:outline-none pr-2 py-0.5 cursor-pointer"
            >
              {schema.tables.map((t) => (
                <option key={t.name} value={t.name} className="bg-[#111418] text-gray-200">
                  {t.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddTable}
              className="px-2 py-1 text-xs font-medium bg-[#7C9CFF] hover:bg-indigo-500 text-white rounded transition flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Table</span>
            </button>
          </div>

          {/* Add Join */}
          <button
            onClick={handleAddJoin}
            disabled={queryState.nodes.length < 2}
            className="px-2.5 py-1 text-xs font-medium bg-[#181C22] hover:bg-gray-800 text-gray-200 border border-gray-700 rounded transition flex items-center space-x-1"
          >
            <Link2 className="w-3.5 h-3.5 text-[#7C9CFF]" />
            <span>Add Join</span>
          </button>

          {/* Add Filter */}
          <button
            onClick={handleAddFilter}
            className="px-2.5 py-1 text-xs font-medium bg-[#181C22] hover:bg-gray-800 text-gray-200 border border-gray-700 rounded transition flex items-center space-x-1"
          >
            <Filter className="w-3.5 h-3.5 text-[#7C9CFF]" />
            <span>Add Filter</span>
          </button>

          <button
            onClick={handleAddAggregate}
            disabled={queryState.nodes.length === 0}
            className="px-2.5 py-1 text-xs font-medium bg-[#181C22] hover:bg-gray-800 text-gray-200 border border-gray-700 rounded transition flex items-center space-x-1 disabled:opacity-50"
          >
            <Sigma className="w-3.5 h-3.5 text-[#7C9CFF]" />
            <span>Add Aggregate</span>
          </button>

          {/* Limit Input */}
          <div className="flex items-center space-x-1 text-xs text-gray-400 bg-[#181C22] px-2 py-1 border border-gray-700 rounded">
            <span>Limit:</span>
            <input
              type="number"
              min="1"
              placeholder="All"
              value={queryState.limit || ''}
              onChange={(e) =>
                updateQueryState({
                  ...queryState,
                  limit: e.target.value ? parseInt(e.target.value, 10) : undefined
                })
              }
              className="w-16 bg-transparent text-xs text-gray-200 focus:outline-none border-b border-gray-600 focus:border-[#7C9CFF] px-1 text-center"
            />
          </div>

          {/* Reset */}
          <button
            onClick={handleReset}
            title="Reset Builder Canvas"
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <BuilderTableCards schema={schema} queryState={queryState} handleRemoveTableNode={handleRemoveTableNode} handleToggleAllColumns={handleToggleAllColumns} handleToggleColumn={handleToggleColumn} handleToggleGroupBy={handleToggleGroupBy} handleUpdateTableAlias={handleUpdateTableAlias} handleUpdateColumnAlias={handleUpdateColumnAlias} />
      <BuilderJoinSection schema={schema} queryState={queryState} handleUpdateJoin={handleUpdateJoin} handleRemoveJoin={handleRemoveJoin} />
      <BuilderAggregateSection schema={schema} queryState={queryState} handleUpdateAggregate={handleUpdateAggregate} handleRemoveAggregate={handleRemoveAggregate} />
      <BuilderFilterSection schema={schema} queryState={queryState} handleUpdateFilter={handleUpdateFilter} handleRemoveFilter={handleRemoveFilter} />
      <BuilderOutputSection generatedSql={generatedSql} relationalEffects={relationalEffects} />
    </div>
  );
};
