import type { CellValue, DataBatch, NodeConfigByKind } from '@luke/contracts';

import type { TransformResult } from './types';

export function executeDeduplicate(
  input: DataBatch,
  config: NodeConfigByKind['transform.deduplicate'],
  nodeId: string,
): TransformResult {
  const indexes = new Map(
    input.schema.columns.map((column, index) => [column.id, index]),
  );
  const selectedIndexes: number[] = [];
  for (const [configIndex, columnId] of config.columnIds.entries()) {
    const columnIndex = indexes.get(columnId);
    if (columnIndex === undefined) {
      return {
        batch: input,
        diagnostics: [
          {
            code: 'COLUMN_NOT_FOUND',
            severity: 'error',
            message: `Column ${columnId} does not exist.`,
            nodeId,
            fieldPath: `config.columnIds.${configIndex}`,
            details: { columnId },
          },
        ],
      };
    }
    selectedIndexes.push(columnIndex);
  }

  const retained = new Set<number>();
  const keys = new Set<string>();
  const indexesToVisit =
    config.keep === 'first'
      ? input.rows.map((_, index) => index)
      : input.rows.map((_, index) => index).reverse();
  for (const rowIndex of indexesToVisit) {
    const row = input.rows[rowIndex]!;
    const key = JSON.stringify(
      selectedIndexes.map((columnIndex) =>
        typedValue(row[columnIndex] ?? null),
      ),
    );
    if (!keys.has(key)) {
      keys.add(key);
      retained.add(rowIndex);
    }
  }
  const rows = input.rows.filter((_, index) => retained.has(index));

  return {
    batch: {
      schema: input.schema,
      rows,
      offset: 0,
      totalRows: rows.length,
    },
    diagnostics: [],
  };
}

function typedValue(value: CellValue): [string, CellValue] {
  return [value === null ? 'null' : typeof value, value];
}
