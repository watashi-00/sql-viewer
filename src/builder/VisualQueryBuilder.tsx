import React, { useState, useEffect } from 'react';
import { Schema, VisualQueryState, VisualQueryNode, VisualJoinEdge, VisualFilterCondition } from '../types';
import { Database, Plus, Trash2, Link2, Filter, Table as TableIcon, RefreshCw } from 'lucide-react';

export interface VisualQueryBuilderProps {
  schema: Schema;
  onSqlChange?: (sql: string) => void;
  initialState?: VisualQueryState;
  onStateChange?: (state: VisualQueryState) => void;
}

export function buildSqlFromState(state: VisualQueryState): string {
  if (!state.nodes || state.nodes.length === 0) {
    return '';
  }

  // 1. SELECT clause
  const selectParts: string[] = [];
  state.nodes.forEach((node) => {
    const tablePrefix = node.alias || node.tableName;
    if (node.selectedColumns && node.selectedColumns.length > 0) {
      node.selectedColumns.forEach((col) => {
        selectParts.push(`${tablePrefix}.${col}`);
      });
    }
  });

  const selectClause = selectParts.length > 0 ? `SELECT ${selectParts.join(', ')}` : 'SELECT *';

  // 2. FROM & JOIN clauses: handle connected vs disconnected table nodes
  const joinedTableNames = new Set<string>();
  state.joins.forEach((j) => {
    joinedTableNames.add(j.leftTable);
    joinedTableNames.add(j.rightTable);
  });

  const firstNode = state.nodes[0];
  const firstTableExpr = firstNode.alias
    ? `${firstNode.tableName} AS ${firstNode.alias}`
    : firstNode.tableName;

  const unjoinedNodes = state.nodes.slice(1).filter((n) => {
    const name = n.alias || n.tableName;
    return !joinedTableNames.has(name) && !joinedTableNames.has(n.tableName);
  });

  const fromTableList = [firstTableExpr];
  unjoinedNodes.forEach((n) => {
    const expr = n.alias ? `${n.tableName} AS ${n.alias}` : n.tableName;
    fromTableList.push(expr);
  });

  let fromClause = `FROM ${fromTableList.join(', ')}`;

  // 3. JOIN clause
  const joinClauses: string[] = [];
  state.joins.forEach((j) => {
    const joinTypeWord = j.joinType === 'FULL' ? 'FULL OUTER JOIN' : `${j.joinType} JOIN`;
    joinClauses.push(
      `${joinTypeWord} ${j.rightTable} ON ${j.leftTable}.${j.leftColumn} = ${j.rightTable}.${j.rightColumn}`
    );
  });

  // 4. WHERE clause
  const whereParts: string[] = [];
  state.filters.forEach((f) => {
    if (f.table && f.column && f.operator) {
      let val = f.value;
      if (val !== undefined && val !== '') {
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
          whereParts.push(`${f.table}.${f.column} IN ${formattedVal}`);
        } else {
          const isNumeric = !isNaN(Number(val)) && val.trim() !== '';
          const formattedVal =
            isNumeric || val.startsWith("'") || val.toUpperCase() === 'NULL' ? val : `'${val}'`;
          whereParts.push(`${f.table}.${f.column} ${f.operator} ${formattedVal}`);
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
  if (state.limit !== undefined && state.limit > 0) {
    sql += `\nLIMIT ${state.limit}`;
  }

  return sql + ';';
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

  const [selectedTableToAdd, setSelectedTableToAdd] = useState<string>(
    schema.tables[0]?.name || ''
  );

  useEffect(() => {
    if (schema.tables.length > 0 && !selectedTableToAdd) {
      setSelectedTableToAdd(schema.tables[0].name);
    }
  }, [schema]);

  const updateQueryState = (newState: VisualQueryState) => {
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

  const handleRemoveTableNode = (nodeId: string) => {
    const nodeToRemove = queryState.nodes.find((n) => n.id === nodeId);
    if (!nodeToRemove) return;

    const newNodes = queryState.nodes.filter((n) => n.id !== nodeId);
    // Remove joins referencing this table
    const newJoins = queryState.joins.filter(
      (j) => j.leftTable !== nodeToRemove.tableName && j.rightTable !== nodeToRemove.tableName
    );
    // Remove filters referencing this table
    const newFilters = queryState.filters.filter((f) => f.table !== nodeToRemove.tableName);

    updateQueryState({
      ...queryState,
      nodes: newNodes,
      joins: newJoins,
      filters: newFilters
    });
  };

  const handleToggleColumn = (nodeId: string, colName: string) => {
    const newNodes = queryState.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const isSelected = node.selectedColumns.includes(colName);
      const newCols = isSelected
        ? node.selectedColumns.filter((c) => c !== colName)
        : [...node.selectedColumns, colName];
      return { ...node, selectedColumns: newCols };
    });

    updateQueryState({ ...queryState, nodes: newNodes });
  };

  const handleToggleAllColumns = (nodeId: string, allCols: string[]) => {
    const newNodes = queryState.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const isAllSelected = node.selectedColumns.length === allCols.length;
      return { ...node, selectedColumns: isAllSelected ? [] : [...allCols] };
    });

    updateQueryState({ ...queryState, nodes: newNodes });
  };

  const handleAddJoin = () => {
    const firstTable = queryState.nodes[0]?.tableName || schema.tables[0]?.name || '';
    const secondTable = queryState.nodes[1]?.tableName || schema.tables[1]?.name || firstTable;

    const leftSchemaTable = schema.tables.find((t) => t.name === firstTable);
    const rightSchemaTable = schema.tables.find((t) => t.name === secondTable);

    const leftCol = leftSchemaTable?.columns[0]?.name || '';
    const rightCol = rightSchemaTable?.columns[0]?.name || '';

    const newJoin: VisualJoinEdge = {
      id: `join-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      leftTable: firstTable,
      leftColumn: leftCol,
      rightTable: secondTable,
      rightColumn: rightCol,
      joinType: 'INNER'
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
    const firstTable = queryState.nodes[0]?.tableName || schema.tables[0]?.name || '';
    const tableObj = schema.tables.find((t) => t.name === firstTable);
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
      limit: undefined
    });
  };

  const generatedSql = buildSqlFromState(queryState);

  return (
    <div className="flex flex-col h-full w-full bg-[#0B0D10] text-gray-200 overflow-y-auto p-4 space-y-4">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#111418] border border-gray-800 rounded-lg shadow-sm">
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
      <div className="flex-1 min-h-[160px] p-4 bg-[#111418] border border-gray-800 rounded-lg">
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
                  className="w-64 bg-[#181C22] border border-gray-700 rounded-md shadow-md flex flex-col overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-[#20252D] border-b border-gray-700">
                    <div className="flex items-center space-x-1.5 overflow-hidden">
                      <TableIcon className="w-4 h-4 text-[#7C9CFF] flex-shrink-0" />
                      <span className="font-semibold text-xs text-gray-100 truncate">
                        {node.tableName}
                      </span>
                      {node.alias && (
                        <span className="text-[10px] text-gray-400 bg-gray-800 px-1 py-0.5 rounded font-mono">
                          as {node.alias}
                        </span>
                      )}
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
                        <label
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
                        </label>
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
              const leftCols =
                schema.tables.find((t) => t.name === j.leftTable)?.columns.map((c) => c.name) || [];
              const rightCols =
                schema.tables.find((t) => t.name === j.rightTable)?.columns.map((c) => c.name) || [];

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
                          schema.tables.find((t) => t.name === e.target.value)?.columns[0]?.name || ''
                      })
                    }
                    className="bg-[#111418] border border-gray-700 text-gray-200 rounded px-2 py-1"
                  >
                    {schema.tables.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
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
                          schema.tables.find((t) => t.name === e.target.value)?.columns[0]?.name || ''
                      })
                    }
                    className="bg-[#111418] border border-gray-700 text-gray-200 rounded px-2 py-1"
                  >
                    {schema.tables.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
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

      {/* Filters Section */}
      {queryState.filters.length > 0 && (
        <div className="p-3 bg-[#111418] border border-gray-800 rounded-lg space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-300 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-[#7C9CFF]" />
            <span>Filters ({queryState.filters.length})</span>
          </div>

          <div className="space-y-2">
            {queryState.filters.map((f) => {
              const availableCols =
                schema.tables.find((t) => t.name === f.table)?.columns.map((c) => c.name) || [];

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
                        column:
                          schema.tables.find((t) => t.name === e.target.value)?.columns[0]?.name || ''
                      })
                    }
                    className="bg-[#111418] border border-gray-700 text-gray-200 rounded px-2 py-1"
                  >
                    {schema.tables.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
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
    </div>
  );
};
