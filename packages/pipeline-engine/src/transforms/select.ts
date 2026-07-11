import type { DataBatch, NodeConfigByKind } from '@luke/contracts';

import type { TransformResult } from './types';

export function executeSelect(
  input: DataBatch,
  config: NodeConfigByKind['transform.select'],
  nodeId: string,
): TransformResult {
  const indexes = new Map(
    input.schema.columns.map((column, index) => [column.id, index]),
  );
  const missing = config.columns.filter(
    (column) => !indexes.has(column.sourceColumnId),
  );
  if (missing.length > 0) {
    return {
      batch: input,
      diagnostics: missing.map((column) => ({
        code: 'COLUMN_NOT_FOUND',
        severity: 'error',
        message: `Column ${column.sourceColumnId} does not exist.`,
        nodeId,
        fieldPath: 'config.columns',
        details: { columnId: column.sourceColumnId },
      })),
    };
  }

  const selectedIndexes = config.columns.map((column) =>
    indexes.get(column.sourceColumnId)!,
  );
  return {
    batch: {
      schema: {
        columns: config.columns.map((selection, index) => ({
          ...input.schema.columns[selectedIndexes[index]!]!,
          name: selection.outputName,
        })),
      },
      rows: input.rows.map((row) =>
        selectedIndexes.map((index) => row[index] ?? null),
      ),
      offset: input.offset,
      ...(input.totalRows === undefined ? {} : { totalRows: input.totalRows }),
    },
    diagnostics: [],
  };
}
