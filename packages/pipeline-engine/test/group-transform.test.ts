import type { DataBatch } from '@luke/contracts';
import { describe, expect, it } from 'vitest';

import { executeGroup, executeTransformNode } from '../src';

const batch: DataBatch = {
  schema: {
    columns: [
      { id: 'region', name: 'Region', type: 'string', nullable: false },
      { id: 'status', name: 'Status', type: 'string', nullable: false },
      { id: 'amount', name: 'Amount', type: 'number', nullable: true },
    ],
  },
  rows: [
    ['north', 'open', 10],
    ['south', 'open', 8],
    ['north', 'open', 20],
    ['north', 'closed', null],
    ['south', 'open', 12],
  ],
  offset: 0,
  totalRows: 5,
};

describe('executeGroup', () => {
  it('calculates all aggregate operations by multiple fields', () => {
    const result = executeGroup(
      batch,
      {
        groupBy: ['region', 'status'],
        aggregates: [
          { operation: 'count', outputName: 'Rows' },
          { operation: 'count', columnId: 'amount', outputName: 'Amounts' },
          { operation: 'sum', columnId: 'amount', outputName: 'Total' },
          { operation: 'avg', columnId: 'amount', outputName: 'Average' },
          { operation: 'min', columnId: 'amount', outputName: 'Minimum' },
          { operation: 'max', columnId: 'amount', outputName: 'Maximum' },
        ],
      },
      'group-1',
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.batch.rows).toEqual([
      ['north', 'open', 2, 2, 30, 15, 10, 20],
      ['south', 'open', 2, 2, 20, 10, 8, 12],
      ['north', 'closed', 1, 0, null, null, null, null],
    ]);
    expect(result.batch.schema.columns.map((column) => column.name)).toEqual([
      'Region',
      'Status',
      'Rows',
      'Amounts',
      'Total',
      'Average',
      'Minimum',
      'Maximum',
    ]);
    expect(result.batch.totalRows).toBe(3);
  });

  it('produces one all-table group for empty input without group fields', () => {
    const result = executeGroup(
      { ...batch, rows: [], totalRows: 0 },
      {
        groupBy: [],
        aggregates: [
          { operation: 'count', outputName: 'Rows' },
          { operation: 'sum', columnId: 'amount', outputName: 'Total' },
        ],
      },
      'group-1',
    );

    expect(result.batch.rows).toEqual([[0, null]]);
    expect(result.batch.schema.columns).toEqual([
      {
        id: 'group-1:aggregate:0',
        name: 'Rows',
        type: 'number',
        nullable: false,
      },
      {
        id: 'group-1:aggregate:1',
        name: 'Total',
        type: 'number',
        nullable: true,
      },
    ]);
  });

  it('returns no groups for empty input with group fields', () => {
    const result = executeGroup(
      { ...batch, rows: [], totalRows: 0 },
      {
        groupBy: ['region'],
        aggregates: [{ operation: 'count', outputName: 'Rows' }],
      },
      'group-1',
    );

    expect(result.batch.rows).toEqual([]);
    expect(result.batch.totalRows).toBe(0);
  });

  it('validates missing columns and aggregate type requirements', () => {
    const missing = executeGroup(
      batch,
      {
        groupBy: ['missing'],
        aggregates: [{ operation: 'count', outputName: 'Rows' }],
      },
      'group-1',
    );
    expect(missing.diagnostics[0]).toMatchObject({
      code: 'COLUMN_NOT_FOUND',
      fieldPath: 'config.groupBy.0',
    });

    const noColumn = executeGroup(
      batch,
      {
        groupBy: [],
        aggregates: [{ operation: 'sum', outputName: 'Total' }],
      },
      'group-1',
    );
    expect(noColumn.diagnostics[0]).toMatchObject({
      code: 'AGGREGATION_CONFIG_INVALID',
    });

    const wrongType = executeGroup(
      batch,
      {
        groupBy: [],
        aggregates: [
          { operation: 'avg', columnId: 'region', outputName: 'Average' },
        ],
      },
      'group-1',
    );
    expect(wrongType.diagnostics[0]).toMatchObject({
      code: 'AGGREGATION_CONFIG_INVALID',
    });
    expect(wrongType.diagnostics[0]?.message).toMatch(/number column/u);
  });

  it('rejects runtime values that disagree with numeric schema', () => {
    const invalid: DataBatch = {
      ...batch,
      rows: [['north', 'open', 'not-a-number']],
    };
    const result = executeGroup(
      invalid,
      {
        groupBy: [],
        aggregates: [
          { operation: 'sum', columnId: 'amount', outputName: 'Total' },
        ],
      },
      'group-1',
    );

    expect(result.batch).toBe(invalid);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'AGGREGATION_FAILED',
      nodeId: 'group-1',
    });
  });

  it('dispatches group nodes through the transform registry', () => {
    const result = executeTransformNode(
      {
        id: 'group-1',
        kind: 'aggregate.group',
        label: 'By region',
        position: { x: 0, y: 0 },
        config: {
          groupBy: ['region'],
          aggregates: [{ operation: 'count', outputName: 'Rows' }],
        },
      },
      batch,
    );

    expect(result.batch.rows).toEqual([
      ['north', 3],
      ['south', 2],
    ]);
  });
});
