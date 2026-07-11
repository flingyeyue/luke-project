import type { DataBatch } from '@luke/contracts';
import { describe, expect, it } from 'vitest';

import { executeCast, executeSelect, executeTransformNode } from '../src';

const batch: DataBatch = {
  schema: {
    columns: [
      { id: 'id', name: 'ID', type: 'string', nullable: false },
      { id: 'amount', name: 'Amount', type: 'string', nullable: true },
      { id: 'active', name: 'Active', type: 'string', nullable: false },
    ],
  },
  rows: [
    ['A-1', '12.5', 'true'],
    ['A-2', null, 'false'],
    ['A-3', 'invalid', 'unknown'],
  ],
  offset: 4,
  totalRows: 3,
};

describe('executeSelect', () => {
  it('selects, reorders, and renames columns by stable id', () => {
    const result = executeSelect(
      batch,
      {
        columns: [
          { sourceColumnId: 'amount', outputName: 'Total' },
          { sourceColumnId: 'id', outputName: 'Order' },
        ],
      },
      'select-1',
    );

    expect(result.batch.schema.columns).toEqual([
      { id: 'amount', name: 'Total', type: 'string', nullable: true },
      { id: 'id', name: 'Order', type: 'string', nullable: false },
    ]);
    expect(result.batch.rows).toEqual([
      ['12.5', 'A-1'],
      [null, 'A-2'],
      ['invalid', 'A-3'],
    ]);
    expect(result.batch).toMatchObject({ offset: 4, totalRows: 3 });
  });

  it('returns a node-scoped error for a missing column', () => {
    const result = executeSelect(
      batch,
      { columns: [{ sourceColumnId: 'missing', outputName: 'Missing' }] },
      'select-1',
    );

    expect(result.batch).toBe(batch);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'COLUMN_NOT_FOUND',
        severity: 'error',
        nodeId: 'select-1',
      }),
    ]);
  });
});

describe('executeCast', () => {
  it('casts values while preserving nulls', () => {
    const result = executeCast(
      batch,
      {
        rules: [
          { columnId: 'amount', targetType: 'number', onError: 'null' },
          { columnId: 'active', targetType: 'boolean', onError: 'null' },
        ],
      },
      'cast-1',
    );

    expect(result.batch.rows).toEqual([
      ['A-1', 12.5, true],
      ['A-2', null, false],
      ['A-3', null, null],
    ]);
    expect(result.batch.schema.columns[1]).toMatchObject({
      type: 'number',
      nullable: true,
    });
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'TYPE_CONVERSION_FAILED',
      severity: 'warning',
      rowNumber: 7,
      nodeId: 'cast-1',
    });
  });

  it('stops and returns the original batch with the fail strategy', () => {
    const result = executeCast(
      batch,
      {
        rules: [{ columnId: 'amount', targetType: 'number', onError: 'fail' }],
      },
      'cast-1',
    );

    expect(result.batch).toBe(batch);
    expect(result.diagnostics.at(-1)).toMatchObject({
      severity: 'error',
      rowNumber: 7,
    });
  });

  it('keeps invalid originals with the keep-original strategy', () => {
    const result = executeCast(
      batch,
      {
        rules: [
          {
            columnId: 'active',
            targetType: 'boolean',
            onError: 'keep-original',
          },
        ],
      },
      'cast-1',
    );

    expect(result.batch.rows[2]).toEqual(['A-3', 'invalid', 'unknown']);
    expect(result.diagnostics[0]).toMatchObject({ severity: 'warning' });
  });

  it('rejects invalid calendar dates', () => {
    const dateBatch: DataBatch = {
      schema: {
        columns: [
          { id: 'date', name: 'Date', type: 'string', nullable: false },
        ],
      },
      rows: [['2026-02-31']],
      offset: 0,
    };
    const result = executeCast(
      dateBatch,
      {
        rules: [{ columnId: 'date', targetType: 'date', onError: 'fail' }],
      },
      'cast-1',
    );

    expect(result.diagnostics[0]).toMatchObject({
      code: 'TYPE_CONVERSION_FAILED',
      severity: 'error',
    });
  });
});

describe('executeTransformNode', () => {
  it('validates config before dispatching to a registered executor', () => {
    const result = executeTransformNode(
      {
        id: 'cast-1',
        kind: 'transform.cast',
        label: 'Cast',
        position: { x: 0, y: 0 },
        config: { rules: [] },
      },
      batch,
    );

    expect(result.batch).toBe(batch);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'NODE_CONFIG_INVALID',
      nodeId: 'cast-1',
    });
  });
});
