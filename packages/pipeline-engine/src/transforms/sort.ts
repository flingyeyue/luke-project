import type { CellValue, DataBatch, NodeConfigByKind } from '@luke/contracts';

import type { TransformResult } from './types';

export function executeSort(
  input: DataBatch,
  config: NodeConfigByKind['transform.sort'],
  nodeId: string,
): TransformResult {
  const indexes = new Map(
    input.schema.columns.map((column, index) => [column.id, index]),
  );
  for (const [ruleIndex, rule] of config.rules.entries()) {
    if (!indexes.has(rule.columnId)) {
      return missingColumn(input, nodeId, rule.columnId, ruleIndex);
    }
  }

  const decorated = input.rows.map((row, index) => ({ row, index }));
  try {
    decorated.sort((left, right) => {
      for (const rule of config.rules) {
        const columnIndex = indexes.get(rule.columnId)!;
        const compared = compareValues(
          left.row[columnIndex] ?? null,
          right.row[columnIndex] ?? null,
          rule.nulls,
        );
        if (compared !== 0) {
          if (
            left.row[columnIndex] === null ||
            right.row[columnIndex] === null
          ) {
            return compared;
          }
          return rule.direction === 'asc' ? compared : -compared;
        }
      }
      return left.index - right.index;
    });
  } catch (error) {
    return {
      batch: input,
      diagnostics: [
        {
          code: 'SORT_COMPARISON_FAILED',
          severity: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Values cannot be compared.',
          nodeId,
          fieldPath: 'config.rules',
        },
      ],
    };
  }

  return {
    batch: {
      schema: input.schema,
      rows: decorated.map((item) => item.row),
      offset: 0,
      ...(input.totalRows === undefined ? {} : { totalRows: input.totalRows }),
    },
    diagnostics: [],
  };
}

function compareValues(
  left: CellValue,
  right: CellValue,
  nulls: 'first' | 'last',
): number {
  if (left === null && right === null) return 0;
  if (left === null) return nulls === 'first' ? -1 : 1;
  if (right === null) return nulls === 'first' ? 1 : -1;
  if (typeof left !== typeof right) {
    throw new Error('Sort values must have matching types.');
  }
  if (left === right) return 0;
  if (typeof left === 'number') return left < (right as number) ? -1 : 1;
  if (typeof left === 'string') return left < (right as string) ? -1 : 1;
  return left ? 1 : -1;
}

function missingColumn(
  input: DataBatch,
  nodeId: string,
  columnId: string,
  ruleIndex: number,
): TransformResult {
  return {
    batch: input,
    diagnostics: [
      {
        code: 'COLUMN_NOT_FOUND',
        severity: 'error',
        message: `Column ${columnId} does not exist.`,
        nodeId,
        fieldPath: `config.rules.${ruleIndex}.columnId`,
        details: { columnId },
      },
    ],
  };
}
