import { Schema, VisualAggregate, VisualFilterCondition, VisualJoinEdge, VisualQueryState } from '../types';
import { Filter, Link2, Sigma, Table as TableIcon, Trash2 } from 'lucide-react';

type RemoveNode = (nodeId: string) => void;
type ToggleColumn = (nodeId: string, column: string) => void;
type ToggleAllColumns = (nodeId: string, columns: string[]) => void;
type UpdateTableAlias = (nodeId: string, alias: string) => void;
type UpdateColumnAlias = (nodeId: string, column: string, alias: string) => void;
type UpdateJoin = (joinId: string, updates: Partial<VisualJoinEdge>) => void;
type UpdateAggregate = (aggregateId: string, updates: Partial<VisualAggregate>) => void;
type UpdateFilter = (filterId: string, updates: Partial<VisualFilterCondition>) => void;

export function BuilderTableCards({ schema, queryState, handleRemoveTableNode, handleToggleAllColumns, handleToggleColumn, handleToggleGroupBy, handleUpdateTableAlias, handleUpdateColumnAlias }: { schema: Schema; queryState: VisualQueryState; handleRemoveTableNode: RemoveNode; handleToggleAllColumns: ToggleAllColumns; handleToggleColumn: ToggleColumn; handleToggleGroupBy: ToggleColumn; handleUpdateTableAlias: UpdateTableAlias; handleUpdateColumnAlias: UpdateColumnAlias }) {
  return (
    <>

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
    </>
  );
}

export function BuilderJoinSection({ schema, queryState, handleUpdateJoin, handleRemoveJoin }: { schema: Schema; queryState: VisualQueryState; handleUpdateJoin: UpdateJoin; handleRemoveJoin: RemoveNode }) {
  return (
    <>

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
    </>
  );
}

export function BuilderAggregateSection({ schema, queryState, handleUpdateAggregate, handleRemoveAggregate }: { schema: Schema; queryState: VisualQueryState; handleUpdateAggregate: UpdateAggregate; handleRemoveAggregate: RemoveNode }) {
  return (
    <>

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
    </>
  );
}

export function BuilderFilterSection({ schema, queryState, handleUpdateFilter, handleRemoveFilter }: { schema: Schema; queryState: VisualQueryState; handleUpdateFilter: UpdateFilter; handleRemoveFilter: RemoveNode }) {
  return (
    <>

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
    </>
  );
}

export function BuilderOutputSection({ generatedSql, relationalEffects }: { generatedSql: string; relationalEffects: string[] }) {
  return (
    <>

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
    </>
  );
}

