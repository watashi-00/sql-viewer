import React, { useState, useEffect, useRef } from 'react';
import { Schema, VisualQueryState, VisualQueryNode, VisualJoinEdge, VisualFilterCondition, VisualAggregate } from '../types';
import { Database, Plus, Trash2, Link2, Filter, Table as TableIcon, RefreshCw, Sigma } from 'lucide-react';
import { loadWorkspace, saveBuilderState } from '../storage/workspaceStore';

export interface VisualQueryBuilderProps {
  schema: Schema;
  onSqlChange?: (sql: string) => void;
  initialState?: VisualQueryState;
  onStateChange?: (state: VisualQueryState) => void;
}

function sqlIdentifier(value: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ? value : `"${value.replace(/"/g, '""')}"`;
}

function tableReference(state: VisualQueryState, table: string): string {
  const node = state.nodes.find((candidate) => candidate.alias === table) ||
    state.nodes.find((candidate) => candidate.tableName === table);
  return sqlIdentifier(node?.alias || table);
}

function tableSource(state: VisualQueryState, table: string): string {
  const node = state.nodes.find((candidate) => candidate.alias === table) ||
    state.nodes.find((candidate) => candidate.tableName === table);
  if (!node) return sqlIdentifier(table);
  return node.alias
    ? `${sqlIdentifier(node.tableName)} AS ${sqlIdentifier(node.alias)}`
    : sqlIdentifier(node.tableName);
}

export function buildSqlFromState(state: VisualQueryState): string {
  if (!state.nodes || state.nodes.length === 0) {
    return '';
  }

  // 1. SELECT clause
  const selectParts: string[] = [];
  const aggregates = state.aggregates || [];
  const groupByParts = state.nodes.flatMap((node) =>
    (node.groupByColumns || []).map((column) => `${sqlIdentifier(node.alias || node.tableName)}.${sqlIdentifier(column)}`)
  );
  if (aggregates.length > 0 || groupByParts.length > 0) {
    state.nodes.forEach((node) => (node.groupByColumns || []).forEach((column) => {
      const expression = `${sqlIdentifier(node.alias || node.tableName)}.${sqlIdentifier(column)}`;
      const alias = node.columnAliases?.[column]?.trim();
      selectParts.push(alias ? `${expression} AS ${sqlIdentifier(alias)}` : expression);
    }));
    aggregates.forEach((aggregate) => {
      const expression = `${aggregate.fn}(${aggregate.column === '*' ? '*' : `${sqlIdentifier(aggregate.table)}.${sqlIdentifier(aggregate.column)}`})`;
      const proposedAlias = aggregate.alias?.trim() || `${aggregate.fn.toLowerCase()}_${aggregate.column === '*' ? 'all' : aggregate.column}`;
      selectParts.push(`${expression} AS ${sqlIdentifier(proposedAlias)}`);
    });
  } else {
    state.nodes.forEach((node) => {
      const tablePrefix = node.alias || node.tableName;
      if (node.selectedColumns && node.selectedColumns.length > 0) {
        node.selectedColumns.forEach((col) => {
          const expression = `${sqlIdentifier(tablePrefix)}.${sqlIdentifier(col)}`;
          const alias = node.columnAliases?.[col]?.trim();
          selectParts.push(alias ? `${expression} AS ${sqlIdentifier(alias)}` : expression);
        });
      }
    });
  }

  const selectClause = selectParts.length > 0 ? `SELECT ${selectParts.join(', ')}` : 'SELECT *';

  // 2. FROM & JOIN clauses: handle connected vs disconnected table nodes
  const joinedTableNames = new Set<string>();
  state.joins.forEach((j) => {
    joinedTableNames.add(j.leftTable);
    joinedTableNames.add(j.rightTable);
  });

  const firstNode = state.nodes[0];
  const firstTableExpr = firstNode.alias
    ? `${sqlIdentifier(firstNode.tableName)} AS ${sqlIdentifier(firstNode.alias)}`
    : sqlIdentifier(firstNode.tableName);

  const unjoinedNodes = state.nodes.slice(1).filter((n) => {
    const name = n.alias || n.tableName;
    return !joinedTableNames.has(name) && !joinedTableNames.has(n.tableName);
  });

  const fromTableList = [firstTableExpr];
  unjoinedNodes.forEach((n) => {
    const expr = n.alias
      ? `${sqlIdentifier(n.tableName)} AS ${sqlIdentifier(n.alias)}`
      : sqlIdentifier(n.tableName);
    fromTableList.push(expr);
  });

  let fromClause = `FROM ${fromTableList.join(', ')}`;

  // 3. JOIN clause
  const joinClauses: string[] = [];
  state.joins.forEach((j) => {
    const joinTypeWord = j.joinType === 'FULL' ? 'FULL OUTER JOIN' : `${j.joinType} JOIN`;
    joinClauses.push(
      `${joinTypeWord} ${tableSource(state, j.rightTable)} ON ${tableReference(state, j.leftTable)}.${sqlIdentifier(j.leftColumn)} ${j.operator || '='} ${tableReference(state, j.rightTable)}.${sqlIdentifier(j.rightColumn)}`
    );
  });

  // 4. WHERE clause
  const whereParts: string[] = [];
  state.filters.forEach((f) => {
    if (f.table && f.column && f.operator) {
      let val = f.value;
      if (val !== undefined && val !== '') {
        const field = `${tableReference(state, f.table)}.${sqlIdentifier(f.column)}`;
        if (f.operator === 'IN') {
          let formattedVal = val.trim();
          if (!formattedVal.startsWith('(')) {
            const parts = formattedVal.split(',').map((s) => {
              const trimmed = s.trim();
              if (!trimmed) return "''";
              if (!isNaN(Number(trimmed)) || trimmed.startsWith("'")) return trimmed;
              return `'${trimmed}'`;
            });
            formattedVal = `(${parts.join(', ')})`;
          }
          whereParts.push(`${field} IN ${formattedVal}`);
        } else {
          const isNumeric = !isNaN(Number(val)) && val.trim() !== '';
          const formattedVal =
            isNumeric || val.startsWith("'") || val.toUpperCase() === 'NULL' ? val : `'${val}'`;
          whereParts.push(`${field} ${f.operator} ${formattedVal}`);
        }
      }
    }
  });

  let sql = `${selectClause}\n${fromClause}`;
  if (joinClauses.length > 0) {
    sql += `\n${joinClauses.join('\n')}`;
  }
  if (whereParts.length > 0) {
    sql += `\nWHERE ${whereParts.join(' AND ')}`;
  }
  if (groupByParts.length > 0) {
    sql += `\nGROUP BY ${groupByParts.join(', ')}`;
  }
  if (state.limit !== undefined && state.limit > 0) {
    sql += `\nLIMIT ${state.limit}`;
  }

  return sql + ';';
}

export function describeRelationalEffects(state: VisualQueryState): string[] {
  if (!state.nodes.length) return [];
  const effects = [`FROM ${state.nodes.map((node) => `${node.tableName}${node.alias ? ` AS ${node.alias}` : ''}`).join(', ')}`];
  state.joins.forEach((join) => effects.push(
    `${join.joinType} JOIN ${join.rightTable} ON ${join.leftTable}.${join.leftColumn} ${join.operator || '='} ${join.rightTable}.${join.rightColumn}`
  ));
  if (state.filters.length) effects.push(`WHERE filters rows using ${state.filters.map((filter) => `${filter.table}.${filter.column} ${filter.operator} …`).join(' AND ')}`);
  const groups = state.nodes.flatMap((node) => (node.groupByColumns || []).map((column) => `${node.alias || node.tableName}.${column}`));
  if (groups.length) effects.push(`GROUP BY forms ${groups.length} group key${groups.length === 1 ? '' : 's'}: ${groups.join(', ')}`);
  (state.aggregates || []).forEach((aggregate) => effects.push(
    `${aggregate.fn} computes ${aggregate.fn}(${aggregate.column === '*' ? '*' : `${aggregate.table}.${aggregate.column}`})${aggregate.alias ? ` AS ${aggregate.alias}` : ''}`
  ));
  const projections = state.nodes.flatMap((node) => node.selectedColumns.map((column) => {
    const alias = node.columnAliases?.[column];
    return `${node.alias || node.tableName}.${column}${alias ? ` AS ${alias}` : ''}`;
  }));
  if (projections.length) effects.push(`SELECT projects ${projections.join(', ')}`);
  if (state.limit && state.limit > 0) effects.push(`LIMIT keeps at most ${state.limit} result rows`);
  return effects;
}

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

  const handleAddTable = () => {
    if (!selectedTableToAdd) return;

    const existingCount = queryState.nodes.filter((n) => n.tableName === selectedTableToAdd).length;
    const alias = existingCount > 0 ? `${selectedTableToAdd}_${existingCount + 1}` : undefined;

    const newNode: VisualQueryNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tableName: selectedTableToAdd,
      selectedColumns: [],
      alias,
      position: { x: queryState.nodes.length * 220, y: 50 }
    };

    const newState: VisualQueryState = {
      ...queryState,
      nodes: [...queryState.nodes, newNode]
    };

    updateQueryState(newState);
  };

  const handleUpdateTableAlias = (nodeId: string, requestedAlias: string) => {
    const target = queryState.nodes.find((node) => node.id === nodeId);
    if (!target) return;
    const alias = requestedAlias.trim();
    if (alias && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) return;
    if (alias && queryState.nodes.some((node) => node.id !== nodeId &&
        (node.alias === alias || (!node.alias && node.tableName === alias)))) return;
    const oldRef = target.alias || target.tableName;
    const newRef = alias || target.tableName;
    const nodes = queryState.nodes.map((node) => node.id === nodeId ? { ...node, alias: alias || undefined } : node);
    const joins = queryState.joins.map((join) => ({
      ...join,
      ...(join.leftTable === oldRef ? { leftTable: newRef } : {}),
      ...(join.rightTable === oldRef ? { rightTable: newRef } : {}),
    }));
    const filters = queryState.filters.map((filter) => filter.table === oldRef ? { ...filter, table: newRef } : filter);
    const aggregates = (queryState.aggregates || []).map((aggregate) => aggregate.table === oldRef
      ? { ...aggregate, table: newRef } : aggregate);
    updateQueryState({ ...queryState, nodes, joins, filters, aggregates });
  };

  const handleUpdateColumnAlias = (nodeId: string, column: string, alias: string) => {
    const nodes = queryState.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const columnAliases = { ...node.columnAliases };
      if (!alias.trim()) delete columnAliases[column];
      else columnAliases[column] = alias.trim();
      return { ...node, columnAliases };
    });
    updateQueryState({ ...queryState, nodes });
  };

  const handleRemoveTableNode = (nodeId: string) => {
    const nodeToRemove = queryState.nodes.find((n) => n.id === nodeId);
    if (!nodeToRemove) return;

    const newNodes = queryState.nodes.filter((n) => n.id !== nodeId);
    // Remove joins referencing this table
    const nodeNames = [nodeToRemove.tableName, nodeToRemove.alias].filter(Boolean);
    const newJoins = queryState.joins.filter(
      (j) => !nodeNames.includes(j.leftTable) && !nodeNames.includes(j.rightTable)
    );
    // Remove filters referencing this table
    const newFilters = queryState.filters.filter((f) => f.table !== nodeToRemove.tableName);
    const newAggregates = (queryState.aggregates || []).filter((aggregate) => !nodeNames.includes(aggregate.table));

    updateQueryState({
      ...queryState,
      nodes: newNodes,
      joins: newJoins,
      filters: newFilters,
      aggregates: newAggregates,
    });
  };

  const handleToggleColumn = (nodeId: string, colName: string) => {
    const newNodes = queryState.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const isSelected = node.selectedColumns.includes(colName);
      const newCols = isSelected
        ? node.selectedColumns.filter((c) => c !== colName)
        : [...node.selectedColumns, colName];
      const groupByColumns = node.groupByColumns || [];
      const shouldGroup = (queryState.aggregates || []).length > 0;
      return {
        ...node,
        selectedColumns: newCols,
        ...(shouldGroup ? { groupByColumns: isSelected
          ? groupByColumns.filter((column) => column !== colName)
          : groupByColumns.includes(colName) ? groupByColumns : [...groupByColumns, colName] } : {}),
      };
    });

    updateQueryState({ ...queryState, nodes: newNodes });
  };

  const handleToggleAllColumns = (nodeId: string, allCols: string[]) => {
    const newNodes = queryState.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const isAllSelected = node.selectedColumns.length === allCols.length;
      const selectedColumns = isAllSelected ? [] : [...allCols];
      return {
        ...node,
        selectedColumns,
        ...((queryState.aggregates || []).length > 0 ? {
          groupByColumns: isAllSelected
            ? (node.groupByColumns || []).filter((column) => !node.selectedColumns.includes(column))
            : [...new Set([...(node.groupByColumns || []), ...selectedColumns])],
        } : {}),
      };
    });

    updateQueryState({ ...queryState, nodes: newNodes });
  };

  const handleToggleGroupBy = (nodeId: string, column: string) => {
    const newNodes = queryState.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const groupByColumns = node.groupByColumns || [];
      return {
        ...node,
        groupByColumns: groupByColumns.includes(column)
          ? groupByColumns.filter((name) => name !== column)
          : [...groupByColumns, column],
      };
    });
    updateQueryState({ ...queryState, nodes: newNodes });
  };

  const handleAddAggregate = () => {
    const node = queryState.nodes[0];
    const column = '*';
    const aggregate: VisualAggregate = {
      id: `aggregate-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      table: node?.alias || node?.tableName || schema.tables[0]?.name || '',
      column,
      fn: 'COUNT',
    };
    const nodes = queryState.nodes.map((item) => ({
      ...item,
      groupByColumns: [...new Set([...(item.groupByColumns || []), ...item.selectedColumns])],
    }));
    updateQueryState({ ...queryState, nodes, aggregates: [...(queryState.aggregates || []), aggregate] });
  };

  const handleUpdateAggregate = (id: string, updates: Partial<VisualAggregate>) => {
    const aggregates = (queryState.aggregates || []).map((aggregate) =>
      aggregate.id === id ? { ...aggregate, ...updates } : aggregate
    );
    updateQueryState({ ...queryState, aggregates });
  };

  const handleRemoveAggregate = (id: string) => {
    updateQueryState({ ...queryState, aggregates: (queryState.aggregates || []).filter((aggregate) => aggregate.id !== id) });
  };

  const handleAddJoin = () => {
    const firstNode = queryState.nodes[0];
    const secondNode = queryState.nodes[1];
    if (!firstNode || !secondNode) return;
    const firstTable = firstNode.alias || firstNode.tableName;
    const secondTable = secondNode.alias || secondNode.tableName;

    const leftSchemaTable = schema.tables.find((t) => t.name === firstNode.tableName);
    const rightSchemaTable = schema.tables.find((t) => t.name === secondNode.tableName);

    const leftCol = leftSchemaTable?.columns[0]?.name || '';
    const rightCol = rightSchemaTable?.columns[0]?.name || '';

    const newJoin: VisualJoinEdge = {
      id: `join-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      leftTable: firstTable,
      leftColumn: leftCol,
      rightTable: secondTable,
      rightColumn: rightCol,
      joinType: 'INNER',
      operator: '=',
    };

    updateQueryState({
      ...queryState,
      joins: [...queryState.joins, newJoin]
    });
  };

  const handleUpdateJoin = (joinId: string, updates: Partial<VisualJoinEdge>) => {
    const newJoins = queryState.joins.map((j) => (j.id === joinId ? { ...j, ...updates } : j));
    updateQueryState({ ...queryState, joins: newJoins });
  };

  const handleRemoveJoin = (joinId: string) => {
    const newJoins = queryState.joins.filter((j) => j.id !== joinId);
    updateQueryState({ ...queryState, joins: newJoins });
  };

  const handleAddFilter = () => {
    const firstNode = queryState.nodes[0];
    const firstTable = firstNode?.alias || firstNode?.tableName || schema.tables[0]?.name || '';
    const tableObj = schema.tables.find((t) => t.name === firstNode?.tableName) || schema.tables.find((t) => t.name === firstTable);
    const col = tableObj?.columns[0]?.name || '';

    const newFilter: VisualFilterCondition = {
      id: `filter-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      table: firstTable,
      column: col,
      operator: '=',
      value: ''
    };

    updateQueryState({
      ...queryState,
      filters: [...queryState.filters, newFilter]
    });
  };

  const handleUpdateFilter = (filterId: string, updates: Partial<VisualFilterCondition>) => {
    const newFilters = queryState.filters.map((f) => (f.id === filterId ? { ...f, ...updates } : f));
    updateQueryState({ ...queryState, filters: newFilters });
  };

  const handleRemoveFilter = (filterId: string) => {
    const newFilters = queryState.filters.filter((f) => f.id !== filterId);
    updateQueryState({ ...queryState, filters: newFilters });
  };

  const handleReset = () => {
    updateQueryState({
      nodes: [],
      joins: [],
      filters: [],
      aggregates: [],
      limit: undefined
    });
  };

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

      {/* Canvas Area: Table Cards */}
      <div className="flex-none min-h-[160px] p-4 bg-[#111418] border border-gray-800 rounded-lg">
        {queryState.nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500 text-sm space-y-2">
            <TableIcon className="w-8 h-8 opacity-40" />
            <p>No tables added to the canvas yet. Select a table above to start building.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 items-start">
            {queryState.nodes.map((node) => {
              const tableMeta = schema.tables.find((t) => t.name === node.tableName);
              const columns = tableMeta?.columns || [];
              const isAllChecked =
                columns.length > 0 && node.selectedColumns.length === columns.length;

              return (
                <div
                  key={node.id}
                  className="w-full max-w-full sm:w-64 bg-[#181C22] border border-gray-700 rounded-md shadow-md flex flex-col overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-[#20252D] border-b border-gray-700">
                    <div className="flex items-center space-x-1.5 overflow-hidden">
                      <TableIcon className="w-4 h-4 text-[#7C9CFF] flex-shrink-0" />
                      <span className="font-semibold text-xs text-gray-100 truncate">
                        {node.tableName}
                      </span>
                  <label className="flex items-center gap-1 text-[10px] text-gray-400">
                    alias
                    <input
                      aria-label={`Table alias for ${node.tableName}`}
                      value={node.alias || ''}
                      onChange={(event) => handleUpdateTableAlias(node.id, event.target.value)}
                      placeholder="optional"
                      className="w-20 bg-[#111418] border border-gray-700 rounded px-1 py-0.5 font-mono text-gray-200"
                    />
                  </label>
                    </div>
                    <button
                      onClick={() => handleRemoveTableNode(node.id)}
                      className="text-gray-400 hover:text-red-400 p-0.5 rounded transition ml-1"
                      title="Remove Table"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Column Header Action */}
                  <div className="flex items-center justify-between px-3 py-1 bg-[#15191F] text-[11px] text-gray-400 border-b border-gray-800">
                    <span>Columns ({node.selectedColumns.length}/{columns.length})</span>
                    <button
                      onClick={() =>
                        handleToggleAllColumns(
                          node.id,
                          columns.map((c) => c.name)
                        )
                      }
                      className="text-[#7C9CFF] hover:underline"
                    >
                      {isAllChecked ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {/* Column List */}
                  <div className="max-h-48 overflow-y-auto divide-y divide-gray-800">
                    {columns.map((col) => {
                      const isChecked = node.selectedColumns.includes(col.name);
                      return (
                        <div
                          key={col.name}
                          className="flex items-center justify-between px-3 py-1.5 hover:bg-[#20252D] cursor-pointer text-xs text-gray-300"
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              data-column={col.name}
                              checked={isChecked}
                              onChange={() => handleToggleColumn(node.id, col.name)}
                              className="rounded border-gray-600 text-[#7C9CFF] focus:ring-0 bg-gray-900 cursor-pointer"
                            />
                            <span>{col.name}</span>
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {col.type}
                          </span>
                          <label className="flex items-center gap-1 text-[10px] text-gray-400" title="Include this column in GROUP BY">
                            <input
                              type="checkbox"
                              aria-label={`Group by ${node.tableName}.${col.name}`}
                              checked={(node.groupByColumns || []).includes(col.name)}
                              onChange={() => handleToggleGroupBy(node.id, col.name)}
                              className="rounded border-gray-600 text-[#7C9CFF] focus:ring-0 bg-gray-900 cursor-pointer"
                            />
                            Group
                          </label>
                          {(isChecked || (node.groupByColumns || []).includes(col.name)) && (
                            <input
                              aria-label={`Alias ${node.tableName}.${col.name}`}
                              value={node.columnAliases?.[col.name] || ''}
                              onChange={(event) => handleUpdateColumnAlias(node.id, col.name, event.target.value)}
                              placeholder="column alias"
                              className="w-24 bg-[#111418] border border-gray-700 rounded px-1 py-0.5 text-[10px] text-gray-200"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Joins Section */}
      {queryState.joins.length > 0 && (
        <div className="p-3 bg-[#111418] border border-gray-800 rounded-lg space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-300 uppercase tracking-wider">
            <Link2 className="w-4 h-4 text-[#7C9CFF]" />
            <span>Joins ({queryState.joins.length})</span>
          </div>

          <div className="space-y-2">
            {queryState.joins.map((j) => {
              const leftNode = queryState.nodes.find((node) => (node.alias || node.tableName) === j.leftTable);
              const rightNode = queryState.nodes.find((node) => (node.alias || node.tableName) === j.rightTable);
              const leftCols = schema.tables.find((table) => table.name === leftNode?.tableName)?.columns.map((column) => column.name) || [];
              const rightCols = schema.tables.find((table) => table.name === rightNode?.tableName)?.columns.map((column) => column.name) || [];

              return (
                <div
                  key={j.id}
                  className="flex flex-wrap items-center gap-2 p-2 bg-[#181C22] border border-gray-700 rounded text-xs"
                >
                  {/* Left Table & Column */}
                  <select
                    value={j.leftTable}
                    onChange={(e) =>
                      handleUpdateJoin(j.id, {
                        leftTable: e.target.value,
                        leftColumn:
                          schema.tables.find((t) => t.name === queryState.nodes.find((node) => (node.alias || node.tableName) === e.target.value)?.tableName)?.columns[0]?.name || ''
                      })
                    }
                    className="bg-[#111418] border border-gray-700 text-gray-200 rounded px-2 py-1"
                  >
                    {queryState.nodes.map((node) => (
                      <option key={node.id} value={node.alias || node.tableName}>
                        {node.alias ? `${node.tableName} AS ${node.alias}` : node.tableName}
                      </option>
                    ))}
                  </select>

                  <select
                    value={j.leftColumn}
                    onChange={(e) => handleUpdateJoin(j.id, { leftColumn: e.target.value })}
                    className="bg-[#111418] border border-gray-700 text-gray-200 rounded px-2 py-1"
                  >
                    {leftCols.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  {/* Join Type */}
                  <select
                    value={j.joinType}
                    onChange={(e) =>
                      handleUpdateJoin(j.id, {
                        joinType: e.target.value as 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
                      })
                    }
                    className="bg-[#20252D] font-bold text-[#7C9CFF] border border-gray-700 rounded px-2 py-1"
                  >
                    <option value="INNER">INNER JOIN</option>
                    <option value="LEFT">LEFT JOIN</option>
                    <option value="RIGHT">RIGHT JOIN</option>
                    <option value="FULL">FULL OUTER JOIN</option>
                  </select>

                  {/* Right Table & Column */}
                  <select
                    value={j.rightTable}
                    onChange={(e) =>
                      handleUpdateJoin(j.id, {
                        rightTable: e.target.value,
                        rightColumn:
                          schema.tables.find((t) => t.name === queryState.nodes.find((node) => (node.alias || node.tableName) === e.target.value)?.tableName)?.columns[0]?.name || ''
                      })
                    }
                    className="bg-[#111418] border border-gray-700 text-gray-200 rounded px-2 py-1"
                  >
                    {queryState.nodes.map((node) => (
                      <option key={node.id} value={node.alias || node.tableName}>
                        {node.alias ? `${node.tableName} AS ${node.alias}` : node.tableName}
                      </option>
                    ))}
                  </select>

                  <select
                    value={j.rightColumn}
                    onChange={(e) => handleUpdateJoin(j.id, { rightColumn: e.target.value })}
                    className="bg-[#111418] border border-gray-700 text-gray-200 rounded px-2 py-1"
                  >
                    {rightCols.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Join comparison"
                    value={j.operator || '='}
                    onChange={(e) => handleUpdateJoin(j.id, { operator: e.target.value as VisualJoinEdge['operator'] })}
                    className="bg-[#20252D] font-mono text-[#7C9CFF] border border-gray-700 rounded px-2 py-1"
                  >
                    {['=', '!=', '>', '>=', '<', '<='].map((operator) => <option key={operator} value={operator}>{operator}</option>)}
                  </select>

                  <button
                    onClick={() => handleRemoveJoin(j.id)}
                    className="text-gray-400 hover:text-red-400 p-1 rounded ml-auto"
                    title="Remove Join"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(queryState.aggregates || []).length > 0 && (
        <div className="p-3 bg-[#111418] border border-gray-800 rounded-lg space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-300 uppercase tracking-wider">
            <Sigma className="w-4 h-4 text-[#7C9CFF]" />
            <span>Aggregations</span>
          </div>
          {(queryState.aggregates || []).map((aggregate) => {
            const node = queryState.nodes.find((item) => (item.alias || item.tableName) === aggregate.table);
            const columns = schema.tables.find((item) => item.name === node?.tableName)?.columns || [];
            const isNumeric = (type: string) => /INT|REAL|DOUBLE|DECIMAL|NUMERIC|FLOAT/i.test(type);
            const availableColumns = aggregate.fn === 'SUM' || aggregate.fn === 'AVG'
              ? columns.filter((column) => isNumeric(column.type)) : columns;
            return (
              <div key={aggregate.id} className="flex flex-wrap items-center gap-2 p-2 bg-[#181C22] border border-gray-700 rounded text-xs">
                <select
                  aria-label="Aggregate table"
                  value={aggregate.table}
                  onChange={(event) => {
                    const nextNode = queryState.nodes.find((item) => (item.alias || item.tableName) === event.target.value);
                    const nextColumns = schema.tables.find((table) => table.name === nextNode?.tableName)?.columns || [];
                    const numericColumns = nextColumns.filter((column) => isNumeric(column.type));
                    const nextColumn = aggregate.fn === 'COUNT' ? '*' :
                      (aggregate.fn === 'SUM' || aggregate.fn === 'AVG' ? numericColumns[0]?.name : nextColumns[0]?.name) || '*';
                    handleUpdateAggregate(aggregate.id, { table: event.target.value, column: nextColumn });
                  }}
                  className="bg-[#111418] border border-gray-700 text-gray-200 rounded px-2 py-1"
                >
                  {queryState.nodes.map((item) => <option key={item.id} value={item.alias || item.tableName}>{item.alias ? `${item.tableName} AS ${item.alias}` : item.tableName}</option>)}
                </select>
                <select
                  aria-label="Aggregate function"
                  value={aggregate.fn}
                  onChange={(event) => {
                    const fn = event.target.value as VisualAggregate['fn'];
                    const options = fn === 'SUM' || fn === 'AVG' ? columns.filter((column) => isNumeric(column.type)) : columns;
                    const currentValid = options.some((column) => column.name === aggregate.column);
                    handleUpdateAggregate(aggregate.id, { fn, ...(!currentValid && options[0] ? { column: options[0].name } : {}) });
                  }}
                  className="bg-[#20252D] text-[#7C9CFF] border border-gray-700 rounded px-2 py-1"
                >
                  {(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] as const).map((fn) => <option key={fn} value={fn} disabled={(fn === 'SUM' || fn === 'AVG') && !columns.some((column) => isNumeric(column.type))}>{fn}</option>)}
                </select>
                <select
                  aria-label="Aggregate column"
                  value={aggregate.column}
                  onChange={(event) => handleUpdateAggregate(aggregate.id, { column: event.target.value })}
                  className="bg-[#111418] border border-gray-700 text-gray-200 rounded px-2 py-1"
                >
                  {aggregate.fn === 'COUNT' && <option value="*">*</option>}
                  {availableColumns.map((column) => <option key={column.name} value={column.name}>{aggregate.table}.{column.name}</option>)}
                </select>
                <span className="text-gray-500">AS</span>
                <input
                  aria-label="Aggregate alias"
                  value={aggregate.alias || ''}
                  placeholder={`${aggregate.fn.toLowerCase()}_${aggregate.column === '*' ? 'all' : aggregate.column}`}
                  onChange={(event) => handleUpdateAggregate(aggregate.id, { alias: event.target.value })}
                  className="bg-[#111418] border border-gray-700 text-gray-200 rounded px-2 py-1 min-w-32"
                />
                <button onClick={() => handleRemoveAggregate(aggregate.id)} className="text-gray-400 hover:text-red-400 p-1 rounded ml-auto" title="Remove Aggregate">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters Section */}
      {queryState.filters.length > 0 && (
        <div className="p-3 bg-[#111418] border border-gray-800 rounded-lg space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-300 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-[#7C9CFF]" />
            <span>Filters ({queryState.filters.length})</span>
          </div>

          <div className="space-y-2">
            {queryState.filters.map((f) => {
              const filterNode = queryState.nodes.find((node) => (node.alias || node.tableName) === f.table);
              const availableCols = schema.tables.find((table) => table.name === filterNode?.tableName || table.name === f.table)?.columns.map((column) => column.name) || [];

              return (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center gap-2 p-2 bg-[#181C22] border border-gray-700 rounded text-xs"
                >
                  <select
                    value={f.table}
                    onChange={(e) =>
                      handleUpdateFilter(f.id, {
                        table: e.target.value,
                        column: schema.tables.find((table) => table.name === queryState.nodes.find((node) => (node.alias || node.tableName) === e.target.value)?.tableName || table.name === e.target.value)?.columns[0]?.name || ''
                      })
                    }
                    className="bg-[#111418] border border-gray-700 text-gray-200 rounded px-2 py-1"
                  >
                    {(queryState.nodes.length ? queryState.nodes.map((node) => ({ name: node.alias || node.tableName, label: node.alias ? `${node.tableName} AS ${node.alias}` : node.tableName })) : schema.tables.map((table) => ({ name: table.name, label: table.name }))).map((table) => (
                      <option key={table.name} value={table.name}>
                        {table.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={f.column}
                    onChange={(e) => handleUpdateFilter(f.id, { column: e.target.value })}
                    className="bg-[#111418] border border-gray-700 text-gray-200 rounded px-2 py-1"
                  >
                    {availableCols.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <select
                    value={f.operator}
                    onChange={(e) =>
                      handleUpdateFilter(f.id, {
                        operator: e.target.value as any
                      })
                    }
                    className="bg-[#20252D] font-mono text-[#7C9CFF] border border-gray-700 rounded px-2 py-1 font-semibold"
                  >
                    <option value="=">=</option>
                    <option value="!=">!=</option>
                    <option value=">">&gt;</option>
                    <option value=">=">&gt;=</option>
                    <option value="<">&lt;</option>
                    <option value="<=">&lt;=</option>
                    <option value="LIKE">LIKE</option>
                    <option value="IN">IN</option>
                  </select>

                  <input
                    type="text"
                    data-testid="filter-value-input"
                    placeholder="Filter value..."
                    value={f.value}
                    onChange={(e) => handleUpdateFilter(f.id, { value: e.target.value })}
                    className="bg-[#111418] border border-gray-700 text-gray-200 rounded px-2 py-1 flex-1 min-w-[120px] focus:outline-none focus:border-[#7C9CFF]"
                  />

                  <button
                    onClick={() => handleRemoveFilter(f.id)}
                    className="text-gray-400 hover:text-red-400 p-1 rounded ml-auto"
                    title="Remove Filter"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Generated SQL Code Box */}
      <div className="p-3 bg-[#111418] border border-gray-800 rounded-lg space-y-1">
        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          <span>GENERATED SQL</span>
        </div>
        <pre className="p-3 bg-[#0B0D10] text-[#7C9CFF] font-mono text-xs rounded border border-gray-800 overflow-x-auto whitespace-pre-wrap">
          {generatedSql || '-- Build your visual query above to see SQL generated here'}
        </pre>
      </div>
      <div className="p-3 bg-[#111418] border border-gray-800 rounded-lg space-y-2">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">RELATIONAL EFFECTS</div>
        {relationalEffects.length ? (
          <ol className="space-y-1 text-xs text-gray-300">
            {relationalEffects.map((effect, index) => <li key={`${index}-${effect}`}><span className="mr-2 font-mono text-[#7C9CFF]">{index + 1}.</span>{effect}</li>)}
          </ol>
        ) : <p className="text-xs text-gray-500">Add tables and builder choices to preview their relational effects.</p>}
      </div>
    </div>
  );
};
