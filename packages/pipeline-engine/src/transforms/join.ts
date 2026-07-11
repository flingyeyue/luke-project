import type { CellValue, DataBatch, NodeConfigByKind } from '@luke/contracts';

import type { TransformResult } from './types';

export function executeJoin(
  left: DataBatch,
  right: DataBatch,
  config: NodeConfigByKind['combine.join'],
  nodeId: string,
): TransformResult {
  const leftIndexes = columnIndexes(left);
  const rightIndexes = columnIndexes(right);
  const issue = validateKeys(
    left,
    right,
    config,
    nodeId,
    leftIndexes,
    rightIndexes,
  );
  if (issue) return issue;

  const leftKeyIndexes = config.leftKeys.map((id) => leftIndexes.get(id)!);
  const rightKeyIndexes = config.rightKeys.map((id) => rightIndexes.get(id)!);
  const rightRows = new Map<string, DataBatch['rows']>();
  for (const row of right.rows) {
    const key = joinKey(row, rightKeyIndexes);
    if (key === null) continue;
    const matches = rightRows.get(key) ?? [];
    matches.push(row);
    rightRows.set(key, matches);
  }

  const rows: DataBatch['rows'] = [];
  for (const leftRow of left.rows) {
    const key = joinKey(leftRow, leftKeyIndexes);
    const matches = key === null ? undefined : rightRows.get(key);
    if (matches) {
      for (const rightRow of matches) rows.push([...leftRow, ...rightRow]);
    } else if (config.joinType === 'left') {
      rows.push([...leftRow, ...right.schema.columns.map(() => null)]);
    }
  }

  const leftNames = new Set(left.schema.columns.map((column) => column.name));
  return {
    batch: {
      schema: {
        columns: [
          ...left.schema.columns,
          ...right.schema.columns.map((column) => ({
            ...column,
            id: `${nodeId}:right:${column.id}`,
            name: leftNames.has(column.name)
              ? `${config.rightColumnPrefix}${column.name}`
              : column.name,
            nullable: column.nullable || config.joinType === 'left',
          })),
        ],
      },
      rows,
      offset: 0,
      totalRows: rows.length,
    },
    diagnostics: [],
  };
}

function validateKeys(
  left: DataBatch,
  right: DataBatch,
  config: NodeConfigByKind['combine.join'],
  nodeId: string,
  leftIndexes: Map<string, number>,
  rightIndexes: Map<string, number>,
): TransformResult | undefined {
  for (const [index, id] of config.leftKeys.entries()) {
    if (!leftIndexes.has(id))
      return missing(left, nodeId, id, `config.leftKeys.${index}`);
  }
  for (const [index, id] of config.rightKeys.entries()) {
    if (!rightIndexes.has(id))
      return missing(left, nodeId, id, `config.rightKeys.${index}`);
    const leftType =
      left.schema.columns[leftIndexes.get(config.leftKeys[index]!)!]!.type;
    const rightType = right.schema.columns[rightIndexes.get(id)!]!.type;
    if (leftType !== rightType) {
      return {
        batch: left,
        diagnostics: [
          {
            code: 'JOIN_KEY_TYPE_MISMATCH',
            severity: 'error',
            message: `Join key types do not match: ${leftType} and ${rightType}.`,
            nodeId,
            fieldPath: `config.rightKeys.${index}`,
          },
        ],
      };
    }
  }
}

function columnIndexes(batch: DataBatch): Map<string, number> {
  return new Map(
    batch.schema.columns.map((column, index) => [column.id, index]),
  );
}

function joinKey(row: CellValue[], indexes: number[]): string | null {
  const values = indexes.map((index) => row[index] ?? null);
  if (values.some((value) => value === null)) return null;
  return JSON.stringify(values.map((value) => [typeof value, value]));
}

function missing(
  input: DataBatch,
  nodeId: string,
  columnId: string,
  fieldPath: string,
): TransformResult {
  return {
    batch: input,
    diagnostics: [
      {
        code: 'COLUMN_NOT_FOUND',
        severity: 'error',
        message: `Column ${columnId} does not exist.`,
        nodeId,
        fieldPath,
        details: { columnId },
      },
    ],
  };
}
