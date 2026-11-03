import { Schema, VisualQueryState, VisualQueryNode, VisualJoinEdge, VisualFilterCondition, VisualAggregate } from '../types';

interface BuilderActionOptions {
  queryState: VisualQueryState;
  schema: Schema;
  selectedTableToAdd: string;
  updateQueryState: (state: VisualQueryState) => void;
}

export function useVisualQueryBuilderActions({ queryState, schema, selectedTableToAdd, updateQueryState }: BuilderActionOptions) {
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

  return { handleAddTable, handleUpdateTableAlias, handleUpdateColumnAlias, handleRemoveTableNode, handleToggleColumn, handleToggleAllColumns, handleToggleGroupBy, handleAddAggregate, handleUpdateAggregate, handleRemoveAggregate, handleAddJoin, handleUpdateJoin, handleRemoveJoin, handleAddFilter, handleUpdateFilter, handleRemoveFilter, handleReset };
}
