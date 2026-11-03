import { ExplainNode } from '../types';

/**
 * Parses DuckDB WASM EXPLAIN text output into a hierarchical ExplainNode AST tree.
 */
export function parseDuckDbExplain(explainText: string): ExplainNode | undefined {
  if (!explainText || !explainText.trim()) return undefined;

  const lines = explainText.split('\n');
  const boxes: Array<{
    id: string;
    rStart: number;
    rEnd: number;
    cStart: number;
    cEnd: number;
    operatorType: string;
    description: string;
    cardinality?: number;
    timingMs?: number;
  }> = [];

  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '┌') {
        const cEnd = line.indexOf('┐', c + 1);
        if (cEnd === -1) continue;

        let rEnd = -1;
        for (let rend = r + 1; rend < lines.length; rend++) {
          if (
            lines[rend] &&
            lines[rend][c] === '└' &&
            lines[rend][cEnd] === '┘'
          ) {
            rEnd = rend;
            break;
          }
        }

        if (rEnd !== -1) {
          const contentLines: string[] = [];
          for (let row = r + 1; row < rEnd; row++) {
            const rawRow = lines[row] || '';
            const cell = rawRow.substring(c + 1, cEnd).trim();
            if (cell && !/^─+$/.test(cell)) {
              contentLines.push(cell);
            }
          }

          if (contentLines.length > 0) {
            let operatorType = '';
            let cardinality: number | undefined = undefined;
            let timingMs: number | undefined = undefined;
            const descParts: string[] = [];

            for (let i = 0; i < contentLines.length; i++) {
              const lineStr = contentLines[i];
              if (/[┌┐└┘├┤┬┴┼─]/.test(lineStr)) {
                continue;
              }
              const cardMatch = lineStr.match(/~?(\d+)\s*rows?/i) || lineStr.match(/^EC:\s*~?(\d+)/i);
              if (cardMatch) {
                cardinality = parseInt(cardMatch[1], 10);
                continue;
              }
              const timingMatch = lineStr.match(/\((\d+(?:\.\d+)?)s\)/i);
              if (timingMatch) {
                timingMs = parseFloat(timingMatch[1]) * 1000;
                continue;
              }
              const timingMsMatch = lineStr.match(/\((\d+(?:\.\d+)?)ms\)/i);
              if (timingMsMatch) {
                timingMs = parseFloat(timingMsMatch[1]);
                continue;
              }
              if (!operatorType) {
                operatorType = lineStr;
              } else {
                descParts.push(lineStr);
              }
            }

            if (operatorType && operatorType !== 'Query Profiling Information' && operatorType !== 'Total Time') {
              boxes.push({
                id: `explain-node-${boxes.length + 1}`,
                rStart: r,
                rEnd: rEnd,
                cStart: c,
                cEnd: cEnd,
                operatorType,
                description: descParts.length > 0 ? descParts.join(' | ') : operatorType,
                cardinality,
                timingMs,
              });
            }
          }
        }
      }
    }
  }

  if (boxes.length === 0) return undefined;

  const levels: Array<typeof boxes> = [];
  const sortedBoxes = [...boxes].sort((a, b) => a.rStart - b.rStart || a.cStart - b.cStart);

  for (const box of sortedBoxes) {
    let placed = false;
    for (const level of levels) {
      if (Math.abs(level[0].rStart - box.rStart) <= 1) {
        level.push(box);
        placed = true;
        break;
      }
    }
    if (!placed) {
      levels.push([box]);
    }
  }

  for (const level of levels) {
    level.sort((a, b) => a.cStart - b.cStart);
  }

  const nodeMap = new Map<string, ExplainNode>();
  for (const box of boxes) {
    nodeMap.set(box.id, {
      id: box.id,
      operatorType: box.operatorType,
      description: box.description,
      ...(box.timingMs !== undefined ? { timingMs: box.timingMs } : {}),
      ...(box.cardinality !== undefined ? { cardinality: box.cardinality } : {}),
      children: [],
    });
  }

  for (let l = 0; l < levels.length - 1; l++) {
    const parentBoxes = levels[l];
    const childBoxes = levels[l + 1];

    if (parentBoxes.length === 1) {
      const parentNode = nodeMap.get(parentBoxes[0].id)!;
      for (const childBox of childBoxes) {
        parentNode.children.push(nodeMap.get(childBox.id)!);
      }
    } else {
      for (const childBox of childBoxes) {
        const childCenter = (childBox.cStart + childBox.cEnd) / 2;
        let bestParent = parentBoxes[0];
        let minDiff = Infinity;
        for (const parentBox of parentBoxes) {
          const parentCenter = (parentBox.cStart + parentBox.cEnd) / 2;
          const diff = Math.abs(parentCenter - childCenter);
          if (diff < minDiff) {
            minDiff = diff;
            bestParent = parentBox;
          }
        }
        const parentNode = nodeMap.get(bestParent.id)!;
        parentNode.children.push(nodeMap.get(childBox.id)!);
      }
    }
  }

  const rootBox = levels[0][0];
  return nodeMap.get(rootBox.id);
}
