import { VisualQueryState } from '../types';

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
