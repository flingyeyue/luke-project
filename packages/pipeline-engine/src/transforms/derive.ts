import type {
  CellValue,
  ColumnType,
  DataBatch,
  NodeConfigByKind,
} from '@luke/contracts';

import { evaluateExpression } from './expression';
import type { TransformResult } from './types';

export function executeDerive(
  input: DataBatch,
  config: NodeConfigByKind['transform.derive'],
  nodeId: string,
): TransformResult {
  const values: CellValue[] = [];
  for (const [rowIndex, row] of input.rows.entries()) {
    try {
      values.push(evaluateExpression(config.expression, { batch: input, row }));
    } catch (error) {
      return {
        batch: input,
        diagnostics: [
          {
            code: 'EXPRESSION_EVALUATION_FAILED',
            severity: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Expression evaluation failed.',
            nodeId,
            fieldPath: 'config.expression',
            rowNumber: input.offset + rowIndex + 1,
          },
        ],
      };
    }
  }

  return {
    batch: {
      schema: {
        columns: [
          ...input.schema.columns,
          {
            id: `${nodeId}:derived`,
            name: config.outputName,
            type: inferType(values),
            nullable: values.some((value) => value === null),
          },
        ],
      },
      rows: input.rows.map((row, index) => [...row, values[index] ?? null]),
      offset: input.offset,
      ...(input.totalRows === undefined ? {} : { totalRows: input.totalRows }),
    },
    diagnostics: [],
  };
}

function inferType(values: CellValue[]): ColumnType {
  const types = new Set(
    values
      .filter((value) => value !== null)
      .map((value) => typeof value as 'string' | 'number' | 'boolean'),
  );
  if (types.size !== 1) return 'unknown';
  return types.values().next().value ?? 'unknown';
}
