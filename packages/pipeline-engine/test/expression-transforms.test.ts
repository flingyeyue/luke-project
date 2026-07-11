import type { DataBatch, Expression } from '@luke/contracts';
import { describe, expect, it } from 'vitest';

import {
  evaluateExpression,
  executeDerive,
  executeFilter,
  executeTransformNode,
} from '../src';

const batch: DataBatch = {
  schema: {
    columns: [
      { id: 'region', name: 'Region', type: 'string', nullable: false },
      { id: 'amount', name: 'Amount', type: 'number', nullable: true },
      { id: 'tax', name: 'Tax', type: 'number', nullable: false },
    ],
  },
  rows: [
    ['north', 120, 0.1],
    ['south', 80, 0.08],
    ['north', null, 0.1],
  ],
  offset: 0,
  totalRows: 3,
};

const column = (columnId: string): Expression => ({
  type: 'column',
  columnId,
});
const literal = (value: number | string | boolean | null): Expression => ({
  type: 'literal',
  value,
});

describe('evaluateExpression', () => {
  it('evaluates nested contract AST without executing source text', () => {
    const expression: Expression = {
      type: 'binary',
      operator: 'and',
      left: {
        type: 'binary',
        operator: 'eq',
        left: column('region'),
        right: literal('north'),
      },
      right: {
        type: 'binary',
        operator: 'gt',
        left: column('amount'),
        right: literal(100),
      },
    };

    expect(evaluateExpression(expression, { batch, row: batch.rows[0]! })).toBe(
      true,
    );
    expect(evaluateExpression(expression, { batch, row: batch.rows[1]! })).toBe(
      false,
    );
  });

  it('short-circuits logical expressions', () => {
    const expression: Expression = {
      type: 'binary',
      operator: 'or',
      left: literal(true),
      right: column('missing'),
    };

    expect(evaluateExpression(expression, { batch, row: batch.rows[0]! })).toBe(
      true,
    );
  });

  it('rejects mixed types and division by zero', () => {
    expect(() =>
      evaluateExpression(
        {
          type: 'binary',
          operator: 'gt',
          left: literal('120'),
          right: literal(100),
        },
        { batch, row: batch.rows[0]! },
      ),
    ).toThrow(/two numbers or two strings/u);
    expect(() =>
      evaluateExpression(
        {
          type: 'binary',
          operator: 'divide',
          left: literal(10),
          right: literal(0),
        },
        { batch, row: batch.rows[0]! },
      ),
    ).toThrow(/Division by zero/u);
  });
});

describe('executeFilter', () => {
  it('keeps rows whose predicate is true', () => {
    const result = executeFilter(
      batch,
      {
        predicate: {
          type: 'binary',
          operator: 'eq',
          left: column('region'),
          right: literal('north'),
        },
      },
      'filter-1',
    );

    expect(result.batch.rows).toEqual([batch.rows[0], batch.rows[2]]);
    expect(result.batch.totalRows).toBe(2);
    expect(result.diagnostics).toEqual([]);
  });

  it('reports a row-level error when the predicate is not boolean', () => {
    const result = executeFilter(
      batch,
      { predicate: column('region') },
      'filter-1',
    );

    expect(result.batch).toBe(batch);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'EXPRESSION_EVALUATION_FAILED',
      nodeId: 'filter-1',
      rowNumber: 1,
    });
  });
});

describe('executeDerive', () => {
  it('adds a calculated field and infers its type', () => {
    const nonNullBatch: DataBatch = {
      ...batch,
      rows: batch.rows.slice(0, 2),
      totalRows: 2,
    };
    const result = executeDerive(
      nonNullBatch,
      {
        outputName: 'Gross',
        expression: {
          type: 'binary',
          operator: 'multiply',
          left: column('amount'),
          right: {
            type: 'binary',
            operator: 'add',
            left: literal(1),
            right: column('tax'),
          },
        },
      },
      'derive-1',
    );

    expect(result.batch.schema.columns.at(-1)).toEqual({
      id: 'derive-1:derived',
      name: 'Gross',
      type: 'number',
      nullable: false,
    });
    expect(result.batch.rows[0]?.at(-1)).toBeCloseTo(132);
  });

  it('returns the original batch when a row cannot be calculated', () => {
    const result = executeDerive(
      batch,
      {
        outputName: 'Gross',
        expression: {
          type: 'binary',
          operator: 'multiply',
          left: column('amount'),
          right: literal(2),
        },
      },
      'derive-1',
    );

    expect(result.batch).toBe(batch);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'EXPRESSION_EVALUATION_FAILED',
      rowNumber: 3,
    });
  });

  it('dispatches filter and derive nodes through the registry', () => {
    const result = executeTransformNode(
      {
        id: 'filter-1',
        kind: 'transform.filter',
        label: 'North only',
        position: { x: 0, y: 0 },
        config: {
          predicate: {
            type: 'binary',
            operator: 'eq',
            left: column('region'),
            right: literal('north'),
          },
        },
      },
      batch,
    );

    expect(result.batch.rows).toHaveLength(2);
  });
});
