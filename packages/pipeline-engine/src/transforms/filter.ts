import type { DataBatch, NodeConfigByKind } from '@luke/contracts';

import { evaluateExpression } from './expression';
import type { TransformResult } from './types';

export function executeFilter(
  input: DataBatch,
  config: NodeConfigByKind['transform.filter'],
  nodeId: string,
): TransformResult {
  const rows: DataBatch['rows'] = [];
  for (const [rowIndex, row] of input.rows.entries()) {
    try {
      const keep = evaluateExpression(config.predicate, { batch: input, row });
      if (typeof keep !== 'boolean') {
        throw new Error('The filter predicate must return a boolean.');
      }
      if (keep) rows.push(row);
    } catch (error) {
      return expressionFailure(input, nodeId, rowIndex, error);
    }
  }

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

function expressionFailure(
  input: DataBatch,
  nodeId: string,
  rowIndex: number,
  error: unknown,
): TransformResult {
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
        fieldPath: 'config.predicate',
        rowNumber: input.offset + rowIndex + 1,
      },
    ],
  };
}
